// The page from one snapshot: summary tiles, then Now, Waiting, Shipped, Hill-climbs, Health.
// Charts are registered as plots and drawn once their slot has a width (main.ts).
import type { CiResult, HillClimb, Job, NeedsLeadItem, Snapshot, Tone } from '../src/snapshot.ts';
import { jobStates } from '../src/snapshot.ts';
import { columns, meter, mirrored, sparkline } from './charts.ts';
import { type Child, h, hex } from './dom.ts';
import { ago, change, clock, dayLabel, duration, percent, score, weekdayLabel } from './format.ts';

export interface Plot {
  slot: HTMLElement;
  draw: (width: number) => Element;
}

export interface Rendered {
  main: HTMLElement;
  plots: Plot[];
}

const isLive = (j: Job): boolean => jobStates[j.state].group === 'now';
const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

function stateBadge(job: Job): HTMLElement {
  const meta = jobStates[job.state];
  return h('span', { class: `state tone-${meta.tone}` }, hex(meta.tone), meta.label);
}

const ciWords: Readonly<Record<CiResult, [Tone, string]>> = {
  pass: ['ok', 'CI pass'],
  fail: ['bad', 'CI failing'],
  pending: ['idle', 'CI running'],
};

function prLink(job: Job): Child {
  if (job.pr === null) return h('span', { class: 'pr none' }, 'no PR');
  const ci = job.pr.ci === null ? null : ciWords[job.pr.ci];
  return h(
    'span',
    { class: 'pr' },
    h('a', { href: job.pr.url, rel: 'noopener', target: '_blank' }, `#${job.pr.number}`),
    ci === null ? null : h('span', { class: `ci tone-${ci[0]}` }, hex(ci[0], 11), ci[1]),
  );
}

function jobTitle(job: Job): HTMLElement {
  return h(
    'button',
    { type: 'button', class: 'job-open', 'data-job': job.id, 'aria-haspopup': 'dialog' },
    h('span', { class: 'job-title' }, job.title),
    h('span', { class: 'job-id' }, job.id),
  );
}

function stepText(job: Job, now: Date): string {
  if (job.step === null || job.stepSince === null) return '';
  return `${job.step} · ${duration(now.getTime() - Date.parse(job.stepSince))}`;
}

function jobRow(job: Job, detail: string): HTMLElement {
  return h(
    'li',
    { class: 'job' },
    stateBadge(job),
    jobTitle(job),
    h('span', { class: 'detail' }, detail),
    prLink(job),
  );
}

function section(id: string, title: string, sub: string, ...body: Child[]): HTMLElement {
  return h(
    'section',
    { id, class: `panel panel-${id}`, 'aria-labelledby': `${id}-h` },
    h('header', { class: 'panel-head' }, h('h2', { id: `${id}-h` }, title), h('p', { class: 'sub' }, sub)),
    ...body,
  );
}

/** A chart: caption with the takeaway, the plot slot, the numbers as a table. */
function figure(
  plots: Plot[],
  title: string,
  takeaway: string,
  draw: (width: number) => Element,
  table: { head: string[]; rows: (string | number)[][] },
  legend: Child = null,
): HTMLElement {
  const slot = h('div', { class: 'plot' });
  plots.push({ slot, draw });
  return h(
    'figure',
    { class: 'fig' },
    h('figcaption', {}, h('span', { class: 'fig-title' }, title), h('span', { class: 'takeaway' }, takeaway)),
    legend,
    slot,
    h(
      'details',
      { class: 'data' },
      h('summary', {}, 'Data table'),
      h(
        'table',
        {},
        h('thead', {}, h('tr', {}, ...table.head.map((c) => h('th', { scope: 'col' }, c)))),
        h('tbody', {}, ...table.rows.map((r) => h('tr', {}, ...r.map((c) => h('td', {}, String(c)))))),
      ),
    ),
  );
}

function legend(...items: [string, string][]): HTMLElement {
  return h(
    'ul',
    { class: 'legend' },
    ...items.map(([mark, label]) =>
      h('li', {}, h('span', { class: `swatch ${mark}`, 'aria-hidden': 'true' }), label)
    ),
  );
}

/** The newest shown, the rest behind one "more" toggle. */
function capped<T>(
  items: readonly T[],
  shown: number,
  row: (t: T) => HTMLElement,
  cls: string,
): HTMLElement[] {
  const head = h('ul', { class: cls }, ...items.slice(0, shown).map(row));
  if (items.length <= shown) return [head];
  return [
    head,
    h(
      'details',
      { class: 'more' },
      h('summary', {}, `${items.length - shown} more`),
      h('ul', { class: cls }, ...items.slice(shown).map(row)),
    ),
  ];
}

function tile(href: string, label: string, value: string, sub: string, tone: Tone | null): HTMLElement {
  return h(
    'li',
    {},
    h(
      'a',
      { class: `tile${tone === null ? '' : ` tone-${tone}`}`, href },
      h('span', { class: 'tile-label' }, label, tone === null ? null : hex(tone, 12)),
      h('span', { class: 'tile-value' }, value),
      h('span', { class: 'tile-sub' }, sub),
    ),
  );
}

function summary(snap: Snapshot): HTMLElement {
  const live = snap.jobs.filter(isLive).length;
  const capacity = sum(snap.lanes.map((l) => l.capacity ?? 0));
  const queued = snap.jobs.filter((j) => j.state === 'queued' || j.state === 'waiting').length;
  const blocked = snap.jobs.filter((j) => j.state === 'blocked').length;
  const prs = snap.needsLead.filter((n) => n.source === 'job').length;
  const notes = snap.needsLead.length - prs;
  const ci7 = snap.ci.daily.slice(-7);
  const pass = sum(ci7.map((d) => d.pass));
  const runs = pass + sum(ci7.map((d) => d.fail));
  const rate = runs === 0 ? null : pass / runs;
  const usage = snap.usage;
  const median = snap.merges.medianQueuedToMergedH;
  return h(
    'nav',
    { class: 'summary', 'aria-label': 'Summary' },
    h(
      'ul',
      {},
      tile(
        '#now',
        'Running',
        capacity > 0 ? `${live}/${capacity}` : String(live),
        'lanes busy',
        live > 0 ? 'live' : null,
      ),
      tile(
        '#waiting',
        'Queued',
        String(queued),
        blocked > 0 ? `${blocked} blocked` : 'none blocked',
        blocked > 0 ? 'bad' : null,
      ),
      tile(
        '#waiting',
        'Needs lead',
        String(snap.needsLead.length),
        `${plural(prs, 'PR')} to merge, ${plural(notes, 'note')}`,
        snap.needsLead.length > 0 ? 'attention' : null,
      ),
      tile(
        '#shipped',
        'Merged 7d',
        String(snap.merges.last7d),
        median === null ? 'no job merged' : `median ${median} h brief to merge`,
        null,
      ),
      tile(
        '#health',
        'CI pass 7d',
        rate === null ? 'no data' : percent(rate),
        `${runs} ci.yml runs`,
        rate === null ? null : rate >= 0.85 ? 'ok' : 'bad',
      ),
      tile(
        '#claude',
        'Claude week',
        usage === null ? 'no data' : percent(usage.weeklyUtil),
        usage === null ? 'usage feed missing' : `pace ${percent(usage.pace)}`,
        usage === null ? null : usage.weeklyUtil > usage.pace ? 'attention' : 'ok',
      ),
    ),
  );
}

function nowSection(snap: Snapshot, now: Date): HTMLElement {
  const live = snap.jobs.filter(isLive);
  const lanes = snap.lanes.map((l) => `${l.runner} ${l.busy}/${l.capacity ?? '?'}`).join(', ');
  return section(
    'now',
    'Now',
    `Running jobs, current step and how long it has run. Lanes: ${lanes}.`,
    live.length === 0
      ? h('p', { class: 'empty' }, 'Nothing is running.')
      : h('ul', { class: 'jobs' }, ...live.map((j) => jobRow(j, stepText(j, now)))),
  );
}

function leadRow(item: NeedsLeadItem): HTMLElement {
  return h(
    'li',
    { class: 'note' },
    h('span', { class: 'state tone-attention' }, hex('attention'), 'open'),
    h('span', { class: 'note-title' }, item.title),
    h('span', { class: 'detail' }, 'NEEDS_LEAD.md'),
  );
}

function waitingSection(snap: Snapshot, now: Date): HTMLElement {
  const of = (...states: Job['state'][]): Job[] => snap.jobs.filter((j) => states.includes(j.state));
  const blocked = of('blocked');
  const merge = of('awaiting-merge');
  const parked = of('parked');
  const queued = of('queued', 'waiting');
  const notes = snap.needsLead.filter((n) => n.source === 'NEEDS_LEAD.md');
  const since = (j: Job): string => {
    const at = j.statusSince ?? j.queuedAt;
    return at === null ? '' : `${j.state === 'blocked' ? 'blocked' : 'queued'} ${ago(at, now)}`;
  };
  const finished = (j: Job): string => j.finishedAt === null ? '' : `done ${ago(j.finishedAt, now)}`;
  const group = (title: string, count: number, body: HTMLElement[]): Child =>
    count === 0 ? null : h(
      'div',
      { class: 'group' },
      h('h3', {}, title, h('span', { class: 'count' }, String(count))),
      ...body,
    );
  const empty = blocked.length + merge.length + queued.length + notes.length + parked.length === 0;
  return section(
    'waiting',
    'Waiting',
    'Blocked and queued jobs, PRs the lead merges, open NEEDS_LEAD.md items, parked drafts.',
    empty ? h('p', { class: 'empty' }, 'Nothing is waiting.') : null,
    group('Blocked', blocked.length, capped(blocked, 5, (j) => jobRow(j, since(j)), 'jobs')),
    group('Queued', queued.length, capped(queued, 5, (j) => jobRow(j, since(j)), 'jobs')),
    group('Awaiting merge', merge.length, capped(merge, 5, (j) => jobRow(j, finished(j)), 'jobs')),
    group('For the lead', notes.length, capped(notes, 4, leadRow, 'jobs')),
    parked.length === 0 ? null : h(
      'details',
      { class: 'group parked' },
      h(
        'summary',
        {},
        'Parked',
        h('span', { class: 'count' }, String(parked.length)),
        'drafts, not for merge',
      ),
      h('ul', { class: 'jobs' }, ...parked.map((j) => jobRow(j, finished(j)))),
    ),
  );
}

function shippedSection(snap: Snapshot, now: Date, plots: Plot[]): HTMLElement {
  const merged = snap.jobs.filter((j) => j.state === 'merged');
  const days = snap.merges.daily;
  const week = days.slice(-7);
  const busiest = [...week].sort((a, b) => b.count - a.count)[0];
  const median = snap.merges.medianQueuedToMergedH;
  const takeaway =
    `${snap.merges.last7d} merged in the last 7 days (${snap.merges.prior7d} in the 7 days before)${
      busiest !== undefined && busiest.count > 0
        ? `, most on ${dayLabel(busiest.date)} (${busiest.count})`
        : ''
    }.`;
  return section(
    'shipped',
    'Shipped 7d',
    median === null ? 'PRs merged to main.' : `PRs merged to main. Median from brief to merge: ${median} h.`,
    figure(
      plots,
      'Merges per day, 14 days',
      takeaway,
      (width) =>
        columns(width, {
          labels: days.map((d) => d.date),
          ticks: days.map((d, i) => (i % 2 === days.length % 2 ? '' : weekdayLabel(d.date).slice(0, 2))),
          series: [{ name: 'merged', mark: 'mark-accent', values: days.map((d) => d.count) }],
          height: 120,
          quietBefore: days.length - 7,
          tip: (i) => `${dayLabel(days[i]?.date ?? '')}: ${days[i]?.count ?? 0} merged`,
        }),
      { head: ['Day', 'Merged'], rows: days.map((d) => [d.date, d.count]) },
    ),
    merged.length === 0
      ? h('p', { class: 'empty' }, 'Nothing merged in 7 days.')
      : h('h3', { class: 'list-head' }, 'Merged jobs'),
    ...capped(
      merged,
      6,
      (j) => jobRow(j, j.pr?.mergedAt ? `merged ${ago(j.pr.mergedAt, now)}` : ''),
      'jobs',
    ),
  );
}

function climbRow(hc: HillClimb): HTMLElement {
  const better = hc.direction === 'lower' ? hc.best < hc.baseline : hc.best > hc.baseline;
  const delta = change(hc.baseline, hc.best);
  const tone: Tone = better ? 'ok' : 'idle';
  return h(
    'li',
    { class: 'climb' },
    h(
      'div',
      { class: 'climb-name' },
      h('span', { class: 'climb-id' }, hc.id),
      h('span', { class: 'climb-metric' }, `${hc.metric}, ${hc.direction} is better`),
    ),
    sparkline(
      [hc.baseline, ...hc.steps],
      88,
      28,
      `${hc.id}: baseline then ${plural(hc.steps.length, 'kept step')}`,
    ),
    h(
      'div',
      { class: 'climb-nums' },
      h(
        'span',
        { class: 'climb-move', title: `${hc.baseline} → ${hc.best}` },
        `${score(hc.baseline)} → ${score(hc.best)}`,
      ),
      h(
        'span',
        { class: `state tone-${tone}` },
        hex(tone, 11),
        better ? delta : 'no kept step',
        hc.target === null ? null : h('span', { class: 'target' }, ` target ${score(hc.target)}`),
      ),
    ),
  );
}

function climbSection(snap: Snapshot): HTMLElement {
  const improved = snap.hillclimbs.filter((c) => c.best !== c.baseline).length;
  return section(
    'climbs',
    'Hill-climbs',
    `Baseline to best kept score, from docs/hillclimb on main. ${improved} of ${snap.hillclimbs.length} moved.`,
    snap.hillclimbs.length === 0
      ? h('p', { class: 'empty' }, 'No hill-climb docs parsed.')
      : h('ul', { class: 'climbs' }, ...snap.hillclimbs.map(climbRow)),
  );
}

/** FIX rounds before the PASS, per job that has a PASS. */
function reviewRounds(jobs: readonly Job[]): number[] {
  const buckets = [0, 0, 0, 0, 0];
  for (const j of jobs) {
    const pass = j.verdicts.findIndex((v) => v.verdict === 'pass');
    if (pass < 0) continue;
    const fixes = j.verdicts.slice(0, pass).filter((v) => v.verdict === 'fix').length;
    buckets[Math.min(fixes, 4)] = (buckets[Math.min(fixes, 4)] ?? 0) + 1;
  }
  return buckets;
}

function healthSection(snap: Snapshot, plots: Plot[]): HTMLElement {
  const host = snap.host;
  const usage = snap.usage;
  const ci = snap.ci.daily;
  const ciPass = sum(ci.map((d) => d.pass));
  const ciRuns = ciPass + sum(ci.map((d) => d.fail));
  const worst =
    [...ci].filter((d) => d.pass + d.fail > 0).sort((a, b) =>
      b.fail / (b.pass + b.fail) - a.fail / (a.pass + a.fail)
    )[0];
  const flaky = snap.flaky;
  const opened4 = sum(flaky.weekly.slice(-4).map((w) => w.opened));
  const closed4 = sum(flaky.weekly.slice(-4).map((w) => w.closed));
  const rounds = reviewRounds(snap.jobs);
  const roundLabels = ['0', '1', '2', '3', '4+'];
  const reviewed = sum(rounds);
  const firstTime = rounds[0] ?? 0;

  const lanes = h(
    'div',
    { class: 'resource' },
    h('h3', {}, 'Lanes and host'),
    ...snap.lanes.map((l) =>
      h(
        'div',
        { class: 'res-row' },
        h('span', { class: 'res-name' }, `${l.runner} lanes`),
        h(
          'span',
          { class: 'pips', role: 'img', 'aria-label': `${l.busy} of ${l.capacity ?? 'unknown'} busy` },
          ...Array.from({ length: Math.max(l.capacity ?? 0, l.busy) }, (_, i) =>
            hex(i < l.busy ? 'live' : 'free', 14)),
        ),
        h('span', { class: 'res-val' }, `${l.busy}/${l.capacity ?? '?'} busy`),
      )
    ),
    host === null ? h('p', { class: 'empty' }, 'No host data.') : hostRows(host, plots),
  );

  const claude = h(
    'div',
    { class: 'resource', id: 'claude' },
    h('h3', {}, 'Claude week'),
    usage === null ? h('p', { class: 'empty' }, 'No usage data.') : (() => {
      const slot = h('div', { class: 'plot plot-meter' });
      const ahead = usage.weeklyUtil > usage.pace;
      plots.push({
        slot,
        draw: (w) =>
          meter(w, {
            value: usage.weeklyUtil,
            max: 1,
            tick: usage.pace,
            mark: ahead ? 'mark-attention' : 'mark-accent',
            label: `${percent(usage.weeklyUtil)} of the weekly limit used, pace ${percent(usage.pace)}`,
          }),
      });
      return h(
        'div',
        {},
        h(
          'div',
          { class: 'res-row' },
          h('span', { class: 'res-name' }, 'used'),
          slot,
          h('span', { class: 'res-val' }, percent(usage.weeklyUtil)),
        ),
        h(
          'p',
          { class: 'res-note' },
          `${ahead ? 'Ahead of' : 'Within'} pace (${percent(usage.pace)}, the line). Resets ${
            clock(usage.resetAt)
          }.`,
        ),
      );
    })(),
  );

  return section(
    'health',
    'Health',
    'Lanes, the hz host, Claude usage, CI, flaky tests and review rounds.',
    h('div', { class: 'resources' }, lanes, claude),
    h(
      'div',
      { class: 'figs' },
      figure(
        plots,
        'CI runs per day, 14 days',
        ciRuns === 0
          ? 'No finished ci.yml runs.'
          : `${percent(ciPass / ciRuns)} passed of ${ciRuns} runs${
            worst !== undefined && worst.fail > 0
              ? `; worst day ${dayLabel(worst.date)} (${worst.fail} failed)`
              : ''
          }.`,
        (width) =>
          columns(width, {
            labels: ci.map((d) => d.date),
            ticks: ci.map((d, i) => (i % 2 === ci.length % 2 ? '' : weekdayLabel(d.date).slice(0, 2))),
            series: [
              { name: 'pass', mark: 'mark-ok', values: ci.map((d) => d.pass) },
              { name: 'fail', mark: 'mark-bad', values: ci.map((d) => d.fail) },
            ],
            height: 120,
            tip: (i) =>
              `${dayLabel(ci[i]?.date ?? '')}: ${ci[i]?.pass ?? 0} passed, ${ci[i]?.fail ?? 0} failed`,
          }),
        { head: ['Day', 'Passed', 'Failed'], rows: ci.map((d) => [d.date, d.pass, d.fail]) },
        legend(['mark-ok', 'passed'], ['mark-bad', 'failed']),
      ),
      figure(
        plots,
        'Flaky issues per week, 8 weeks',
        `${flaky.open} open; ${opened4} opened and ${closed4} closed in 4 weeks.`,
        (width) =>
          mirrored(width, {
            labels: flaky.weekly.map((w) => w.week),
            ticks: flaky.weekly.map((w) => dayLabel(w.week)),
            up: { name: 'opened', mark: 'mark-bad', values: flaky.weekly.map((w) => w.opened) },
            down: { name: 'closed', mark: 'mark-ok', values: flaky.weekly.map((w) => w.closed) },
            height: 120,
            tip: (i) =>
              `Week of ${dayLabel(flaky.weekly[i]?.week ?? '')}: ${flaky.weekly[i]?.opened ?? 0} opened, ${
                flaky.weekly[i]?.closed ?? 0
              } closed`,
          }),
        {
          head: ['Week of', 'Opened', 'Closed'],
          rows: flaky.weekly.map((w) => [w.week, w.opened, w.closed]),
        },
        legend(['mark-bad', 'opened (up)'], ['mark-ok', 'closed (down)']),
      ),
      figure(
        plots,
        'Review rounds before PASS',
        reviewed === 0
          ? 'No job in the window has a PASS yet.'
          : `${firstTime} of ${reviewed} jobs passed their first review; ${
            reviewed - firstTime
          } needed fixes.`,
        (width) =>
          columns(width, {
            labels: roundLabels,
            ticks: roundLabels.map((l) => `${l} fix`),
            series: [{ name: 'jobs', mark: 'mark-accent', values: rounds }],
            height: 120,
            tip: (i) => `${plural(rounds[i] ?? 0, 'job')} with ${roundLabels[i]} FIX rounds`,
          }),
        { head: ['FIX rounds', 'Jobs'], rows: rounds.map((n, i) => [roundLabels[i] ?? '', n]) },
      ),
    ),
  );
}

function hostRows(host: NonNullable<Snapshot['host']>, plots: Plot[]): HTMLElement {
  const row = (
    name: string,
    value: number,
    max: number,
    tick: number | undefined,
    text: string,
    hot: boolean,
  ) => {
    const slot = h('div', { class: 'plot plot-meter' });
    plots.push({
      slot,
      draw: (w) =>
        meter(w, {
          value,
          max,
          mark: hot ? 'mark-attention' : 'mark-quiet',
          label: `${name}: ${text}`,
          ...(tick === undefined ? {} : { tick }),
        }),
    });
    return h(
      'div',
      { class: 'res-row' },
      h('span', { class: 'res-name' }, name),
      slot,
      h('span', { class: 'res-val' }, text),
    );
  };
  const [l1, l5, l15] = host.load;
  const memUsed = host.memTotalGb - host.memAvailGb;
  return h(
    'div',
    {},
    row(
      'load',
      l1,
      Math.max(host.cores * 2, l1),
      host.cores,
      `${l1.toFixed(1)} on ${host.cores} cores`,
      l1 > host.cores,
    ),
    row('memory', memUsed, host.memTotalGb, undefined, `${host.memAvailGb} GB free`, host.memAvailGb < 12),
    h(
      'p',
      { class: 'res-note' },
      `Load 5/15 min ${l5.toFixed(1)}/${
        l15.toFixed(1)
      }; the line is the core count. Disk ${host.diskFreeGb} GB free.`,
    ),
  );
}

export function renderPage(snap: Snapshot, now: Date): Rendered {
  const plots: Plot[] = [];
  const main = h(
    'main',
    { id: 'main' },
    summary(snap),
    h(
      'div',
      { class: 'grid' },
      h(
        'div',
        { class: 'col col-work' },
        nowSection(snap, now),
        waitingSection(snap, now),
        shippedSection(snap, now, plots),
      ),
      h('div', { class: 'col col-side' }, climbSection(snap), healthSection(snap, plots)),
    ),
  );
  return { main, plots };
}

/** The drawer's body: what happened to one job, in order. */
export function renderJob(job: Job, now: Date): HTMLElement {
  const events: { at: string; what: string; detail: Child }[] = [];
  if (job.queuedAt !== null) events.push({ at: job.queuedAt, what: 'queued', detail: 'brief handed out' });
  for (const step of job.steps) {
    const round = /^review(\d+)$/.exec(step.name)?.[1];
    const review = round === undefined ? undefined : job.verdicts.find((v) => v.round === Number(round));
    const verdict = review?.verdict;
    const took = step.endedAt === null
      ? `running for ${duration(now.getTime() - Date.parse(step.startedAt))}`
      : duration(Date.parse(step.endedAt) - Date.parse(step.startedAt));
    events.push({
      at: step.startedAt,
      what: step.name,
      detail: h(
        'span',
        {},
        took,
        verdict === undefined ? null : h(
          'span',
          { class: `state verdict tone-${verdict === 'pass' ? 'ok' : 'attention'}` },
          hex(verdict === 'pass' ? 'ok' : 'attention', 11),
          verdict === 'pass' ? 'PASS' : 'FIX',
        ),
        review?.requeued === true ? ' requeued by the lead' : null,
      ),
    });
  }
  if (job.finishedAt !== null) events.push({ at: job.finishedAt, what: 'done', detail: 'worker finished' });
  if (job.pr?.mergedAt) events.push({ at: job.pr.mergedAt, what: 'merged', detail: `PR #${job.pr.number}` });
  events.sort((a, b) => a.at.localeCompare(b.at));
  const fixes = job.verdicts.filter((v) => v.verdict === 'fix').length;
  const passes = job.verdicts.length - fixes;
  const requeued = job.verdicts.filter((v) => v.requeued).length;
  return h(
    'div',
    { class: 'job-detail' },
    h(
      'dl',
      { class: 'facts' },
      h('dt', {}, 'State'),
      h('dd', {}, stateBadge(job), job.step === null ? null : ` ${stepText(job, now)}`),
      h('dt', {}, 'Job'),
      h('dd', {}, `${job.id} · ${job.kind}${job.runner === null ? '' : ` · ${job.runner}`}`),
      h('dt', {}, 'PR'),
      h('dd', {}, prLink(job)),
      h('dt', {}, 'Reviews'),
      h(
        'dd',
        {},
        job.verdicts.length === 0
          ? 'none yet'
          : `${plural(fixes, 'FIX', 'FIX')}, ${plural(passes, 'PASS', 'PASS')}${
            requeued === 0 ? '' : ` (${requeued} requeued by the lead)`
          }`,
      ),
    ),
    h('h3', {}, 'Timeline'),
    events.length === 0 ? h('p', { class: 'empty' }, 'No log lines yet.') : h(
      'ol',
      { class: 'timeline' },
      ...events.map((e) =>
        h(
          'li',
          {},
          h('time', { datetime: e.at }, clock(e.at)),
          h('span', { class: 'tl-what' }, e.what),
          h('span', { class: 'tl-detail' }, e.detail),
        )
      ),
    ),
  );
}
