/**
 * fg sync: seed (or reuse) a scenario run, serve the checkout's web build
 * against its target, and run a sync script in N signed-in browser clients
 * (e2e/sync/engine.mjs), which captures frames and videos by itself. Then
 * report latencies and write index.md / index.html next to the artifacts.
 */

import { type Command, type Ctx, FgError, int, type JsonObject, stopIf, str, usage } from './core.ts';
import { checkRunId, type Manifest, newFixtureRunId, readManifest, seedScenario, teardownRun } from './fixtures.ts';
import { withTeardownOnFailure } from './fixture_commands.ts';
import { loadScenario, type Scenario } from './scenario.ts';
import { mustRun } from './stack.ts';
import { fingerprint } from './surfaces.ts';
import { DEFAULT_WITHIN_MS, LETTERS, parseScript, type Step } from './sync_dsl.ts';
import { Api, resolveTarget, type Target, targetFlag, type TargetKind } from './target.ts';

export const E2E_LOCK = '/tmp/fg-e2e.lock';
const WEB_BUILD_LOCK = '/tmp/fg-web-build.lock';
const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';

// The e2e lock --------------------------------------------------------------------

/**
 * True when a process above this one (or this one, by inheritance) already
 * holds the lock: `flock /tmp/fg-e2e.lock scripts/fg sync ...`, or the e2e
 * gate's `exec 9>>lock; flock 9`. The second pattern leaves no live pid in
 * /proc/locks (the flock helper has exited), so the test is an open file
 * descriptor on the lock file in this process or an ancestor; both patterns
 * open the file only to lock it.
 */
export async function heldByAncestor(path: string): Promise<boolean> {
  let target: string;
  try {
    target = await Deno.realPath(path);
  } catch {
    return false;
  }
  for (let pid = Deno.pid; pid > 1;) {
    try {
      for await (const fd of Deno.readDir(`/proc/${pid}/fd`)) {
        const link = await Deno.readLink(`/proc/${pid}/fd/${fd.name}`).catch(() => '');
        if (link === target) return true;
      }
    } catch { /* another user's process: not ours to inspect */ }
    const stat = await Deno.readTextFile(`/proc/${pid}/stat`).catch(() => '');
    pid = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]);
    if (!pid) break;
  }
  return false;
}

/** The box-wide Playwright lock; FG_E2E_LOCK overrides it, as for the e2e gate. */
export const e2eLockPath = () => Deno.env.get('FG_E2E_LOCK') ?? E2E_LOCK;

/**
 * Takes the box-wide Playwright lock (one browser run at a time); returns its
 * release. Aborting `signal` kills the waiting flock, so a stop signal ends
 * the wait at once instead of after --lock-wait.
 */
export async function takeE2eLock(
  ctx: Pick<Ctx, 'log'>,
  waitS: number,
  signal?: AbortSignal,
  path = e2eLockPath(),
): Promise<() => Promise<void>> {
  stopIf(signal, 'Waiting for the e2e lock');
  if (await heldByAncestor(path)) {
    ctx.log(`${path} is already held by a parent process; using it`);
    return () => Promise.resolve();
  }
  // A stop during the ancestor walk must not reach spawn() as an already-aborted signal.
  stopIf(signal, 'Waiting for the e2e lock');
  ctx.log(`waiting for ${path} (up to ${waitS} s; another Playwright run may hold it)`);
  const child = new Deno.Command('flock', {
    args: ['-w', String(waitS), path, 'sh', '-c', 'echo locked; read _'],
    stdin: 'piped',
    stdout: 'piped',
    stderr: 'null',
    signal,
  }).spawn();
  const reader = child.stdout.getReader();
  const first = await reader.read().catch(() => ({ done: true, value: undefined }));
  if (first.done || !new TextDecoder().decode(first.value).includes('locked')) {
    const { code } = await child.status;
    stopIf(signal, 'Waiting for the e2e lock');
    throw new FgError(
      'e2e_lock_busy',
      `${path} stayed taken for ${waitS} s (flock exit ${code}): another Playwright run is using the box.`,
      'Retry later or pass --lock-wait <seconds>; `fuser -v /tmp/fg-e2e.lock` shows who holds it.',
    );
  }
  ctx.log(`holding ${path}`);
  return async () => {
    reader.releaseLock();
    await child.stdin.close().catch(() => {});
    await child.status;
  };
}

// Web build ----------------------------------------------------------------------

/** Builds the web app against the target into the state dir, unless the build there is current. */
async function webBuild(ctx: Ctx, t: Target, force: boolean, signal?: AbortSignal): Promise<string> {
  const dir = `${ctx.inst.stateDir}/web-${t.kind}`;
  // The hosted build is the production configuration: the defaults in environment.dart.
  const defines = t.kind === 'local'
    ? [`--dart-define=SUPABASE_URL=${t.apiUrl}`, `--dart-define=SUPABASE_PUBLISHABLE_KEY=${t.publishableKey}`]
    : [];
  const fp = await fingerprint(ctx.sh, ctx.inst, 'web', defines);
  const marker = `${dir}/.fg-build`;
  if (
    !force && (await ctx.sh.exists(marker)) && (await ctx.sh.readText(marker)).trim() === fp && (await ctx.sh.exists(`${dir}/main.dart.js`))
  ) {
    return dir;
  }
  ctx.log(`building the web app for the ${t.kind} target (about 40 s; one web build at a time on this box)`);
  await ctx.sh.mkdir(`${ctx.inst.repo}/app/build`);
  await mustRun(ctx.sh, [
    'flock',
    '-w',
    '1200',
    WEB_BUILD_LOCK,
    'flutter',
    'build',
    'web',
    '--release',
    '--no-web-resources-cdn',
    '--wasm',
    '-o',
    dir,
    ...defines,
  ], { cwd: `${ctx.inst.repo}/app`, timeoutMs: 1_500_000, signal });
  await ctx.sh.writeText(marker, fp);
  return dir;
}

/** The process listening on a local TCP port, from ss; null when ss cannot tell. */
async function portHolder(ctx: Ctx, port: number): Promise<{ pid: number; ppid: number; cmd: string } | null> {
  const res = await ctx.sh.run(['ss', '-ltnpH', `sport = :${port}`]).catch(() => null);
  const pid = Number(/pid=(\d+)/.exec(res?.stdout ?? '')?.[1]);
  if (!pid) return null;
  const cmd = (await ctx.sh.readText(`/proc/${pid}/cmdline`).catch(() => '')).replaceAll('\0', ' ').trim();
  const stat = await ctx.sh.readText(`/proc/${pid}/stat`).catch(() => '');
  const ppid = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]);
  return { pid, ppid, cmd };
}

async function serve(ctx: Ctx, dir: string, port: number): Promise<{ url: string; stop: () => Promise<void> }> {
  const url = `http://127.0.0.1:${port}`;
  const answers = async () => {
    const res = await ctx.sh.fetch(url).catch(() => null);
    await res?.body?.cancel();
    return res !== null;
  };
  if (await answers()) {
    const holder = await portHolder(ctx, port);
    // The port is this instance's (<prefix>80); an orphaned static server on it is left over from a
    // killed run (fg sync's or the e2e gate's Playwright webServer), so it is reclaimed.
    if (holder && holder.ppid === 1 && holder.cmd.includes('serve.mjs')) {
      ctx.log(`port ${port}: stopping a leftover static server (pid ${holder.pid}: ${holder.cmd})`);
      await ctx.sh.kill(holder.pid, 'SIGTERM');
      for (let i = 0; i < 20 && (await answers()); i++) await ctx.sh.sleep(100);
    }
    if (await answers()) {
      throw new FgError(
        'port_taken',
        `Port ${port} already serves something${holder ? ` (pid ${holder.pid}, parent ${holder.ppid}: ${holder.cmd})` : ''}.`,
        `Stop that process, or use another FG_PORT_PREFIX (the web port is <prefix>80).`,
      );
    }
  }
  const pid = await ctx.sh.spawn(['node', `${ctx.inst.repo}/e2e/serve.mjs`, dir, String(port)], {
    log: `${ctx.inst.stateDir}/sync-serve.log`,
  });
  for (let i = 0; i < 50 && !(await answers()); i++) await ctx.sh.sleep(100);
  if (!(await answers())) {
    await ctx.sh.kill(pid, 'SIGTERM');
    throw new FgError('serve_failed', `The web build did not come up on ${url} within 5 s.`, `Read ${ctx.inst.stateDir}/sync-serve.log.`);
  }
  return { url, stop: () => ctx.sh.kill(pid, 'SIGTERM') };
}

// Report ---------------------------------------------------------------------------

export interface Observation {
  client: string;
  visibleAt: number | null;
  fromInputMs: number | null;
  fromAckMs: number | null;
  fromEventMs?: number | null;
  /** The condition held before the action (e.g. gone for a row that never came): no latency. */
  alreadyHeld?: boolean;
  /** Delivered by a reconnect (resync), not live. */
  catchUp?: boolean;
}
export interface StepResult {
  index: number;
  line?: number;
  source: string;
  kind: string;
  ok: boolean;
  error?: string;
  issuedAt?: number;
  startedAt?: number;
  frame?: string;
  catchUp?: boolean;
  action?: {
    line: number;
    client: string;
    kind?: string;
    issuedAt: number;
    ack: { at: number; method: string; path: string; status: number } | null;
    event?: JsonObject | null;
  };
  observations?: Observation[];
}
export interface EngineResult {
  ok: boolean;
  startedAt: string;
  durationMs: number;
  clients: { label: string; ref: string; name: string; screen: string | null; store: string | null; video: string | null }[];
  steps: StepResult[];
  frames: {
    id: string;
    kind: string;
    at: number;
    ms: number;
    cause: string;
    step: number | null;
    files: Record<string, string | null>;
    composite: string;
  }[];
  changeFrames: number;
  changeFramesCapped: boolean;
  compositeVideo: string | null;
}

const EVENT_FOR: Record<string, string> = { add: 'added', tick: 'bought', edit: 'edited', delete: 'deleted' };

/**
 * Adds the item_events row time (server clock) to each action: a second
 * latency origin, local stack only (same clock). Each event is used once,
 * matched by action, time and item name.
 */
async function addEventTimes(api: Api, householdId: string, result: EngineResult, steps: Step[]): Promise<void> {
  const since = new Date(new Date(result.startedAt).getTime() - 5000).toISOString();
  const events = (await api.rest(
    `item_events?select=id,action,item_name,created_at&household_id=eq.${householdId}&created_at=gte.${
      encodeURIComponent(since)
    }&order=created_at`,
  )) as JsonObject[];
  const used = new Set<unknown>();
  const at = (e: JsonObject) => new Date(e.created_at as string).getTime();
  for (const s of result.steps) {
    if (!s.action) continue;
    const step = steps.find((x) => x.line === s.action!.line);
    if (step?.kind !== 'act' || !EVENT_FOR[step.action]) continue;
    const names = step.action === 'add'
      ? [step.text]
      : step.action === 'edit'
      ? [step.item, step.value]
      : step.action === 'tick' || step.action === 'delete'
      ? [step.item]
      : [];
    const fits = (e: JsonObject) =>
      !used.has(e.id) && e.action === EVENT_FOR[step.action] && at(e) >= s.action!.issuedAt - 1000 &&
      names.some((n) => n === e.item_name || n.includes(String(e.item_name)));
    const ev = events.find(fits);
    if (ev) used.add(ev.id);
    s.action.event = ev ? { action: ev.action, item: ev.item_name, at: at(ev) } : null;
    for (const o of s.observations ?? []) {
      o.fromEventMs = ev && o.visibleAt !== null && !o.alreadyHeld ? o.visibleAt - at(ev) : null;
    }
  }
}

function stats(values: (number | null | undefined)[]) {
  const xs = values.filter((v): v is number => typeof v === 'number').sort((a, b) => a - b);
  if (!xs.length) return null;
  return { n: xs.length, p50: xs[Math.floor((xs.length - 1) / 2)], max: xs[xs.length - 1], min: xs[0] };
}

/** The latency table: each observing client, all of them together, then catch-up after a reconnect. */
const latencyRows = (summary: ReturnType<typeof latencySummary>) =>
  [...Object.entries(summary.perClient), ['all clients (live)', summary.all], ['catch-up after reconnect', summary.catchUp]] as [
    string,
    ReturnType<typeof latencySummary>['all'],
  ][];

/** Live propagation per observing client (the acting client's own view and catch-up after a reconnect left out), and catch-up apart (every client, the reconnecting one too). */
export function latencySummary(result: EngineResult) {
  // The acting client's own view is optimistic, not propagation; after `online` it is that client catching up.
  const counts = (s: StepResult, o: Observation) => o.client !== s.action!.client || (isCatchUp(s, o) && s.action!.kind === 'online');
  const isCatchUp = (s: StepResult, o: Observation) => Boolean(o.catchUp ?? s.catchUp);
  const observed = (catchUp: boolean) =>
    result.steps.flatMap((s) =>
      (s.action ? s.observations ?? [] : []).filter((o) => isCatchUp(s, o) === catchUp && counts(s, o) && !o.alreadyHeld)
    );
  const of = (obs: Observation[]) => ({
    fromAckMs: stats(obs.map((o) => o.fromAckMs)),
    fromInputMs: stats(obs.map((o) => o.fromInputMs)),
    fromEventMs: stats(obs.map((o) => o.fromEventMs)),
  });
  const live = observed(false);
  return {
    perClient: Object.fromEntries(result.clients.map((c) => [c.label, of(live.filter((o) => o.client === c.label))])),
    all: of(live),
    catchUp: of(observed(true)),
  };
}

export const RESOLUTION =
  'Visible = the first rendered frame whose Flutter semantics DOM satisfies the expectation (a MutationObserver in each page, so one frame, ~16 ms, plus the callback). Ack = the acting client\'s first successful REST write after the input, seen by Playwright (a few ms after the response). Event = the item_events row time (local stack only: same clock). All clients run in one Chromium on one machine, so their clocks agree. The summary leaves out the acting client\'s own (optimistic) view and expectations that held before the action ("held already"); delivery after a reconnect is reported apart as catch-up.';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const ms = (v: number | null | undefined) => (typeof v === 'number' ? `${v} ms` : '–');

export function indexMarkdown(meta: JsonObject, result: EngineResult, summary: ReturnType<typeof latencySummary>): string {
  const lines = [
    `# fg sync: ${meta.scenario} (${result.ok ? 'PASS' : 'FAIL'})`,
    '',
    `Run ${meta.run} on the ${meta.target} target, ${result.clients.length} clients, ${
      (result.durationMs / 1000).toFixed(1)
    } s, ${result.frames.length} frames (${result.changeFrames} on observed changes).`,
    '',
    '| Client | Member | View | Video |',
    '| --- | --- | --- | --- |',
    ...result.clients.map((c) =>
      `| ${c.label} | ${c.name} (\`${c.ref}\`) | ${c.store ?? 'Alle'} | ${c.video ? `[${c.video}](${c.video})` : '–'} |`
    ),
    '',
    result.compositeVideo ? `Composite video: [${result.compositeVideo}](${result.compositeVideo})` : 'Composite video: none',
    '',
    '## Steps',
    '',
    '| # | Line | Step | Result | Latency (visible − ack) | Frame |',
    '| --- | --- | --- | --- | --- | --- |',
    ...result.steps.map((s) => {
      const lat = (s.observations ?? []).map((o) =>
        o.alreadyHeld ? `${o.client}: held already` : `${o.client}: ${ms(o.fromAckMs)} (input ${ms(o.fromInputMs)})`
      ).join('<br>') +
        (s.catchUp ? ' (catch-up)' : '');
      const frame = result.frames.find((f) =>
        f.id === s.frame
      );
      return `| ${s.index + 1} | ${s.line ?? ''} | \`${s.source.replaceAll('|', '\\|')}\` | ${s.ok ? 'ok' : `**FAILED**: ${s.error}`} | ${
        lat || ''
      } | ${frame ? `[${frame.id}](${frame.composite})` : ''} |`;
    }),
    '',
    '## Latency',
    '',
    '| Client | n | p50 from ack | max from ack | p50 from input | max from input | p50 from event | max from event |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...latencyRows(summary).map(([c, x]) =>
      `| ${c} | ${x.fromAckMs?.n ?? x.fromInputMs?.n ?? 0} | ${ms(x.fromAckMs?.p50)} | ${ms(x.fromAckMs?.max)} | ${
        ms(x.fromInputMs?.p50)
      } | ${ms(x.fromInputMs?.max)} | ${ms(x.fromEventMs?.p50)} | ${ms(x.fromEventMs?.max)} |`
    ),
    '',
    RESOLUTION,
    '',
    '## Frames',
    '',
    ...result.frames.map((f) => `- [${f.id} ${f.kind}](${f.composite}) +${f.ms} ms: ${f.cause}`),
    '',
  ];
  return lines.join('\n');
}

export function indexHtml(meta: JsonObject, result: EngineResult, summary: ReturnType<typeof latencySummary>): string {
  const failed = result.steps.find((s) => !s.ok);
  const around = failed ? result.frames.filter((f) => f.step !== null && f.step >= failed.index - 1) : [];
  const card = (f: EngineResult['frames'][number]) =>
    `<a class="frame ${f.kind}" href="${esc(f.composite)}"><img loading="lazy" src="${
      esc(f.composite)
    }"><span>#${f.id} ${f.kind} +${f.ms} ms<br>${esc(f.cause)}</span></a>`;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>fg sync ${esc(meta.scenario)} ${result.ok ? 'PASS' : 'FAIL'}</title>
<style>
body{font:14px/1.45 system-ui,sans-serif;margin:24px;color:#1e1e1e;max-width:1500px}
h1 .pass{color:#146c2e} h1 .fail{color:#b3261e} table{border-collapse:collapse;margin:8px 0 20px} td,th{border:1px solid #ddd;padding:5px 8px;text-align:left;vertical-align:top}
tr.bad td{background:#fce8e6} code{background:#f1f1f1;padding:1px 4px;border-radius:3px} .muted{color:#666}
.frames{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:12px} .frame{display:block;border:2px solid #ddd;border-radius:6px;overflow:hidden;text-decoration:none;color:inherit}
.frame img{width:100%;display:block} .frame span{display:block;padding:6px 8px;font-size:12px} .frame.change{border-color:#0b57d0} .frame.failure{border-color:#b3261e}
video{max-width:100%;border:1px solid #ccc}
</style>
<h1>fg sync: ${esc(meta.scenario)} <span class="${result.ok ? 'pass' : 'fail'}">${result.ok ? 'PASS' : 'FAIL'}</span></h1>
<p class="muted">Run <code>${esc(meta.run)}</code> on the ${esc(meta.target)} target · ${result.clients.length} clients · ${
    (result.durationMs / 1000).toFixed(1)
  } s · ${result.frames.length} frames (${result.changeFrames} on observed changes${
    result.changeFramesCapped ? ', capped' : ''
  }) · script <code>${esc(meta.script)}</code></p>
${
    failed
      ? `<h2>Failure</h2><p><b>Line ${failed.line ?? ''}:</b> <code>${esc(failed.source)}</code>: ${
        esc(failed.error)
      }</p><div class="frames">${around.map(card).join('')}</div>`
      : ''
  }
<h2>Clients</h2>
<table><tr><th>Client</th><th>Member</th><th>View</th><th>Video</th></tr>
${
    result.clients.map((c) =>
      `<tr><td>${c.label}</td><td>${esc(c.name)} <code>${esc(c.ref)}</code></td><td>${esc(c.store ?? 'Alle')}</td><td>${
        c.video ? `<a href="${esc(c.video)}">${esc(c.video)}</a>` : '–'
      }</td></tr>`
    ).join('')
  }
</table>
${
    result.compositeVideo
      ? `<video controls muted preload="metadata" poster="${
        esc(result.frames.filter((f) => f.kind !== 'change').at(-1)?.composite ?? '')
      }" src="${esc(result.compositeVideo)}"></video>`
      : '<p>No composite video.</p>'
  }
<h2>Steps</h2>
<table><tr><th>#</th><th>Line</th><th>Step</th><th>Result</th><th>Latency: visible − ack (− input)</th><th>Frame</th></tr>
${
    result.steps.map((s) => {
      const f = result.frames.find((x) => x.id === s.frame);
      const lat = (s.observations ?? []).map((o) =>
        o.alreadyHeld ? `${o.client}: held already` : `${o.client}: ${ms(o.fromAckMs)} <span class="muted">(${ms(o.fromInputMs)})</span>`
      )
        .join('<br>') + (s.catchUp ? ' <span class="muted">(catch-up)</span>' : '');
      return `<tr class="${s.ok ? '' : 'bad'}"><td>${s.index + 1}</td><td>${s.line ?? ''}</td><td><code>${esc(s.source)}</code></td><td>${
        s.ok ? 'ok' : `<b>FAILED</b>: ${esc(s.error)}`
      }</td><td>${lat}</td><td>${f ? `<a href="${esc(f.composite)}">#${f.id}</a>` : ''}</td></tr>`;
    }).join('')
  }
</table>
<h2>Latency</h2>
<table><tr><th>Client</th><th>n</th><th>p50 / max from ack</th><th>p50 / max from input</th><th>p50 / max from item_events</th></tr>
${
    latencyRows(summary).map(([c, x]) =>
      `<tr><td>${c}</td><td>${x.fromAckMs?.n ?? x.fromInputMs?.n ?? 0}</td><td>${ms(x.fromAckMs?.p50)} / ${ms(x.fromAckMs?.max)}</td><td>${
        ms(x.fromInputMs?.p50)
      } / ${ms(x.fromInputMs?.max)}</td><td>${ms(x.fromEventMs?.p50)} / ${ms(x.fromEventMs?.max)}</td></tr>`
    ).join('')
  }
</table>
<p class="muted">${esc(RESOLUTION)}</p>
<h2>Frames</h2>
<div class="frames">${result.frames.map(card).join('')}</div>
</html>
`;
}

// Command ----------------------------------------------------------------------------

/** A scenario's users and households in manifest form, to pick clients and check a script before seeding. */
export function scenarioShape(scenario: Scenario): Manifest {
  const shape = {
    scenario: scenario.name,
    users: Object.fromEntries(scenario.users.map((u) => [u.handle, { household: null as string | null }])),
    households: {} as Record<string, { id: string; name: string; members: string[] }>,
  };
  (scenario.households ?? []).forEach((h, i) => {
    const key = h.handle ?? (i === 0 ? 'home' : `home${i + 1}`);
    shape.households[key] = { id: '', name: h.name, members: h.members };
    for (const member of h.members) shape.users[member].household = key;
  });
  return shape as unknown as Manifest;
}

/**
 * The household the clients sign in to and the members playing A, B, C. A
 * scenario without households (empty-new-user) signs in users who have none.
 */
export function pickClients(m: Manifest, raw: string): { household: string | null; members: string[] } {
  const households = Object.entries(m.households);
  const homeless = Object.keys(m.users).filter((h) => !m.users[h].household);
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    if (n < 1 || n > LETTERS.length) {
      throw usage(`--clients ${raw}: 1 to ${LETTERS.length} clients.`, 'e.g. --clients 3 (three contexts in one Chromium).');
    }
    const home = households.find(([, h]) => h.members.length >= n);
    if (home) return { household: home[0], members: home[1].members.slice(0, n) };
    if (!households.length && homeless.length >= n) return { household: null, members: homeless.slice(0, n) };
    throw usage(
      `Scenario ${m.scenario} has no household with ${n} members.`,
      `Its households: ${households.map(([k, h]) => `${k} (${h.members.length})`).join(', ') || 'none'}; household-3-mid-shop has three.`,
    );
  }
  const members = raw.split(',').map((x) => x.trim()).filter(Boolean);
  if (!members.length || members.length > LETTERS.length) {
    throw usage(`--clients takes 1-${LETTERS.length} handles.`, 'e.g. --clients mia,noah');
  }
  for (const h of members) {
    if (!m.users[h]) throw usage(`No member "${h}" in ${m.scenario}.`, `Members: ${Object.keys(m.users).join(', ')}.`);
  }
  const home = m.users[members[0]].household;
  if (members.some((h) => m.users[h].household !== home)) {
    throw usage(
      'Sync clients must share one household (or all have none).',
      `Households: ${households.map(([k, h]) => `${k}: ${h.members.join(',')}`).join('; ')}.`,
    );
  }
  return { household: home, members };
}

export const syncCommands: Command[] = [{
  name: 'sync',
  summary: 'Run a sync script in 2-3 signed-in web clients of one household; frames, videos and latencies are captured automatically.',
  usage: 'fg sync <scenario> --clients 2|3|h1,h2 --script FILE [--run-id ID] [--target local|hosted] [--keep] [--dry-run]',
  description: [
    'Checks the script against the scenario, builds the web app of this checkout against the target (cached by source fingerprint), takes /tmp/fg-e2e.lock (waits up to --lock-wait seconds; code e2e_lock_busy otherwise; a lock held by a parent `flock` is reused), then seeds the scenario as a new run (or reuses --run-id), serves the build on port <prefix>80 and opens one Chromium with one isolated context per client, each signed in as a household member (A, B, C in member order). The script runs step by step:',
    '  A add "Hafermilch 2"                         type into "Was fehlt?" and press Enter',
    '  B tick "Milch"  /  A delete "Brot"           tick the row\'s checkbox / open it and press Löschen',
    '  C edit "Bananen" quantity "6"  (or name)     open the row, retype the field, Speichern',
    '  A offline  /  A online                       cut the client off (HTTP and the open realtime socket) / reconnect',
    '  A store "Supermarkt"  /  A reload            fold all but Supermarkt and Ohne Laden ("Alle": unfold) / reload',
    `  expect B,C see|gone|text "X" [within 2000ms] wait until each client shows or lost row "X" (or any text "X"); default ${DEFAULT_WITHIN_MS} ms`,
    '  wait 500ms  /  screenshot "name"             pause / an extra frame',
    "Capture needs no trigger: every client is screenshotted at once after each step and whenever any client's screen changes (a MutationObserver on Flutter's semantics tree), composited side by side with labels and times; each context records a video and ffmpeg stacks them into one composite video. Latency per expectation is measured from the acting client's server ack (and input, and the item_events row on local) to the first frame showing the change. Artifacts: $FG_EVIDENCE_DIR/<run>/sync/ with index.md and index.html. Exits 1 on a failed expectation (code sync_failed), with the failure frames first in index.html. A run fg sync seeded is torn down afterwards unless --keep; a --run-id run is left as it was. Ctrl-C, SIGTERM and SIGHUP kill the lock wait, build or browser at once, tear down a run this command seeded, and exit 130/143/129; a stop before the seed leaves nothing.",
  ].join('\n'),
  flags: [
    { name: 'clients', help: 'How many clients (2 or 3; 1 works too) or which members (mia,noah). Default 2.' },
    { name: 'script', help: 'The script file (see above).' },
    { name: 'run-id', help: 'Use this seeded run instead of seeding a new one.' },
    targetFlag,
    { name: 'keep', type: 'boolean', help: 'Keep the run fg sync seeded (default: tear it down).' },
    { name: 'rebuild', type: 'boolean', help: 'Rebuild the web app even if the cached build matches.' },
    { name: 'web-build', help: 'Serve this existing web build instead (it must point at the target; CI passes app/build/web).' },
    { name: 'lock-wait', help: 'Seconds to wait for /tmp/fg-e2e.lock (default 1200).' },
    { name: 'viewport', help: 'Client size WxH (default 480x900).' },
  ],
  examples: [
    'fg sync household-3-mid-shop --clients 3 --script .cursor/skills/verify-family-groceries/journeys/sync-3-clients.fgs',
    'fg sync household-3-mid-shop --clients 2 --script my.fgs --run-id fx-1025-1432-k3x9',
    'fg sync household-3-mid-shop --clients mia,ida --script my.fgs --keep',
    'fg sync empty-new-user --clients 1 --script signin.fgs --target hosted',
  ],
  destructive: true,
  async run(ctx, args) {
    const name = args.positional[0];
    if (!name) throw usage('Which scenario?', '`fg scenario list`; household-3-mid-shop has three members.');
    const scriptPath = str(args, 'script');
    if (!scriptPath) {
      throw usage('--script is required.', 'Write one step per line, e.g. A add "Milch" / expect B see "Milch". See `fg help sync`.');
    }
    const scenario = await loadScenario(ctx.sh, ctx.inst.repo, name);
    const scriptFile = scriptPath.startsWith('/') ? scriptPath : `${Deno.cwd()}/${scriptPath}`;
    if (!(await ctx.sh.exists(scriptFile))) throw usage(`No script file ${scriptPath}.`, 'Pass a path relative to the current directory.');
    const scriptText = await ctx.sh.readText(scriptFile);
    const kind = ((args.flags.target as string | undefined) ?? 'local') as TargetKind;
    const clientsRaw = str(args, 'clients') ?? '2';
    const [vw, vh] = (str(args, 'viewport') ?? '480x900').split('x').map(Number);
    if (!vw || !vh) throw usage('--viewport takes WxH, e.g. 480x900.', 'e.g. --viewport 412x892');
    if (!(await ctx.sh.exists(`${ctx.inst.repo}/e2e/node_modules/@playwright/test`))) {
      throw new FgError(
        'missing_tool',
        'Playwright is not installed in e2e/.',
        'Run `cd e2e && npm ci && npx playwright install chromium`.',
      );
    }

    const requested = str(args, 'run-id');
    const run = checkRunId(requested ?? newFixtureRunId());
    // Clients and script are checked against the scenario before anything is seeded or built.
    const shape = scenarioShape(scenario);
    const preview = pickClients(shape, clientsRaw);
    parseScript(scriptText, preview.members.map((h, i) => ({ label: LETTERS[i], handle: h })));
    const given = str(args, 'web-build');
    if (given && !(await ctx.sh.exists(`${given}/main.dart.js`))) {
      throw usage(`--web-build ${given} has no main.dart.js.`, 'Build it first, or leave the flag out.');
    }
    if (ctx.dryRun) {
      const steps = parseScript(scriptText, preview.members.map((h, i) => ({ label: LETTERS[i], handle: h })));
      ctx.actions.push(
        given ? `serve ${given}` : `build the web app for ${kind} if stale`,
        `take ${e2eLockPath()} (wait up to ${int(args, 'lock-wait', 1200)} s)`,
        requested ? `reuse run ${run}` : `seed ${scenario.name} as run ${run} on the ${kind} target`,
        `serve on port ${ctx.inst.prefix}80, run ${steps.length} steps in ${preview.members.length} Chromium contexts (${
          preview.members.join(', ')
        })`,
        `write frames, videos and index.html to ${ctx.inst.evidenceRoot}/${run}/sync/`,
        ...(requested || args.flags.keep ? [] : [`tear down run ${run}`]),
      );
      return { run, scenario: scenario.name, clients: preview.members, steps: steps.length };
    }

    const t = await resolveTarget(ctx, kind);
    let m = requested ? await readManifest(ctx, t, run) : null;
    if (requested && !m) {
      throw new FgError('unknown_run', `No run ${run} on the ${t.label}.`, '`fg runs` lists runs; omit --run-id to seed a new one.');
    }
    if (m && m.status !== 'ready') {
      throw new FgError('run_not_ready', `Run ${run} is ${m.status}, not ready.`, `\`fg teardown ${run}\` and seed again.`);
    }
    if (m && m.scenario !== scenario.name) {
      throw usage(`Run ${run} is ${m.scenario}, not ${scenario.name}.`, `fg sync ${m.scenario} --run-id ${run} ...`);
    }
    const seededHere = !m;
    const hosted = kind === 'hosted';
    const keep = Boolean(args.flags.keep);
    let seedStarted = false;
    // Build, then the lock, then the seed: a run never waits idle for the lock, so a kill while
    // waiting leaves nothing behind.
    const work = async (signal: AbortSignal) => {
      const web = given ?? (await webBuild(ctx, t, Boolean(args.flags.rebuild), signal));
      const release = await takeE2eLock(ctx, int(args, 'lock-wait', 1200), signal);
      const config = `${ctx.inst.stateDir}/sync-${run}.json`;
      let server: Awaited<ReturnType<typeof serve>> | null = null;
      let engine: { code: number; stdout: string; stderr: string };
      let out = '';
      let picked: ReturnType<typeof pickClients>;
      let labels: { label: string; handle: string }[];
      let steps: Step[];
      try {
        if (!m) {
          ctx.log(`seeding ${scenario.name} as run ${run} on the ${t.label}`);
          seedStarted = true;
          const seeded = await seedScenario(ctx, t, scenario, run, new Date(), signal);
          const bad = seeded.checks.filter((c) => !c.ok);
          if (bad.length) {
            throw new FgError(
              'assert_failed',
              `Seeding ${run} failed its checks: ${bad.map((c) => c.name).join('; ')}.`,
              `\`fg seed ${scenario.name}\` shows the details.`,
            );
          }
          m = seeded.manifest;
        }
        picked = pickClients(m, clientsRaw);
        labels = picked.members.map((h, i) => ({ label: LETTERS[i], handle: h }));
        steps = parseScript(scriptText, labels);
        out = `${ctx.inst.evidenceRoot}/${run}/sync`;
        for (let n = 2; await ctx.sh.exists(out); n++) out = `${ctx.inst.evidenceRoot}/${run}/sync-${n}`;
        await ctx.sh.mkdir(out);
        stopIf(signal, 'fg sync');
        server = await serve(ctx, web, Number(`${ctx.inst.prefix}80`));
        await ctx.sh.writeText(
          config,
          JSON.stringify({
            baseURL: server.url,
            outDir: out,
            viewport: { width: vw, height: vh },
            supabaseUrl: t.apiUrl,
            fontFile: (await ctx.sh.exists(FONT)) ? FONT : null,
            clients: labels.map(({ label, handle }) => {
              const u = m!.users[handle];
              return {
                label,
                ref: `${run}:${handle}`,
                name: u.name,
                email: u.email,
                password: u.password,
                locale: u.locale,
                store: m!.views[handle]?.store ?? null,
              };
            }),
            steps,
          }),
          { mode: 0o600 },
        );
        await ctx.sh.run(['chmod', '600', config]);
        ctx.log(`running ${steps.length} steps in ${labels.length} clients (${labels.map((l) => `${l.label}=${l.handle}`).join(', ')})`);
        // A stop signal kills the driver; its browser exits with it (Playwright's pipe closes).
        engine = await ctx.sh.run(['node', `${ctx.inst.repo}/e2e/sync/engine.mjs`, config], {
          cwd: `${ctx.inst.repo}/e2e`,
          timeoutMs: 1_800_000,
          signal,
        });
      } finally {
        await ctx.sh.remove(config);
        await server?.stop();
        await release();
      }
      for (const line of engine.stderr.split('\n').filter(Boolean)) ctx.log(line.replace(/^\[sync\] /, 'sync: '));
      if (!(await ctx.sh.exists(`${out}/result.json`))) {
        throw new FgError(
          'sync_crashed',
          `The sync driver exited ${engine.code} without a result: ${engine.stderr.trim().split('\n').slice(-3).join(' | ')}`,
          `Read ${out}; \`fg doctor\` for the stack.`,
        );
      }
      const result = JSON.parse(await ctx.sh.readText(`${out}/result.json`)) as EngineResult;
      const api = new Api(ctx.sh, t);
      if (t.kind === 'local' && picked.household) await addEventTimes(api, m.households[picked.household].id, result, steps);
      const summary = latencySummary(result);
      const meta = { scenario: scenario.name, run, target: kind, script: scriptPath };
      await ctx.sh.writeText(`${out}/result.json`, JSON.stringify(result, null, 2));
      await ctx.sh.writeText(`${out}/index.md`, indexMarkdown(meta, result, summary));
      await ctx.sh.writeText(`${out}/index.html`, indexHtml(meta, result, summary));
      // The artifacts get copied into PRs: none may carry a seeded password or the service key.
      const secrets = [t.secretKey, ...labels.map(({ handle }) => m!.users[handle].password)].filter((x) => x.length >= 8);
      for (const file of ['result.json', 'index.md', 'index.html']) {
        const text = await ctx.sh.readText(`${out}/${file}`);
        if (secrets.some((x) => text.includes(x))) {
          await ctx.sh.remove(`${out}/${file}`);
          throw new FgError(
            'secret_in_evidence',
            `${out}/${file} contained a password or key; it was deleted.`,
            'This is a bug in fg sync; report it.',
          );
        }
      }
      // Still inside the signal handling: a stop during this teardown repeats it (it is idempotent).
      const teardown = seededHere && !keep ? (await teardownRun(ctx, t, run)) as unknown as JsonObject : null;
      return { result, summary, out, picked, teardown };
    };
    const { result, summary, out, picked, teardown } = await withTeardownOnFailure(
      ctx,
      t,
      run,
      () => seedStarted && (hosted || !keep),
      work,
    );
    const failed = result.steps.find((s) => !s.ok);
    const doc = {
      run,
      scenario: scenario.name,
      target: kind,
      clients: result.clients.map((c) => ({ label: c.label, ref: c.ref, name: c.name, view: c.store ?? 'Alle' })),
      household: picked.household,
      passed: result.ok,
      steps: result.steps.map((s) => ({
        line: s.line ?? null,
        step: s.source,
        ok: s.ok,
        ...(s.error ? { error: s.error } : {}),
        ...(s.observations
          ? {
            latency: Object.fromEntries(
              s.observations.map((
                o,
              ) => [o.client, {
                fromAckMs: o.fromAckMs,
                fromInputMs: o.fromInputMs,
                ...(o.fromEventMs !== undefined ? { fromEventMs: o.fromEventMs } : {}),
              }]),
            ),
          }
          : {}),
      })),
      latency: summary,
      resolution: RESOLUTION,
      evidence: {
        dir: out,
        index: `${out}/index.html`,
        markdown: `${out}/index.md`,
        compositeVideo: result.compositeVideo ? `${out}/${result.compositeVideo}` : null,
        frames: result.frames.length,
        changeFrames: result.changeFrames,
      },
      teardown: teardown
        ? {
          leftovers: teardown.leftovers,
          ...(teardown.nonTestCountsUnchanged !== undefined
            ? { nonTestCountsUnchanged: teardown.nonTestCountsUnchanged, nonTestCounts: teardown.nonTestCounts }
            : {}),
        }
        : seededHere
        ? 'kept (--keep)'
        : 'reused run left as is',
    };
    if (failed) {
      const frames = result.frames.filter((f) => f.step !== null && f.step >= failed.index - 1).map((f) => `${out}/${f.composite}`);
      throw new FgError(
        'sync_failed',
        `Line ${failed.line ?? '?'} failed: ${failed.error}`,
        `Open ${out}/index.html; the failure frames come first.`,
        1,
        { ...doc, failureFrames: frames } as never,
      );
    }
    return doc;
  },
}];
