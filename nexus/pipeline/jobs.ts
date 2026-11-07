// A job's files in the ops dir, reduced to the Job of the snapshot. Reading (readJobDir) keeps
// only parsed tokens and times; brief, review and log prose never leave this module.
import type { Job, JobKind, JobState, Runner, Step, Verdict } from '../src/snapshot.ts';
import { runners } from '../src/snapshot.ts';
import type { PrRecord } from './github.ts';

/** What the pipeline takes from jobs/<id>/: tokens and times only. */
export interface JobFiles {
  id: string;
  status: string | null;
  branch: string | null;
  runnerFile: string | null;
  /** A workdir file exists: the hz run-queue started this job here. */
  hasWorkdir: boolean;
  /** Its pid file names a running job-worker on this host. */
  workerAlive: boolean;
  queuedAt: Date | null;
  statusAt: Date | null;
  startAfter: Date | null;
  events: LogEvent[];
  verdicts: { round: number; verdict: Verdict; requeued: boolean }[];
}

export type LogEvent =
  | { at: Date; kind: 'step-start'; step: string }
  | { at: Date; kind: 'step-ok'; step: string }
  | { at: Date; kind: 'status'; status: string };

const zones: Readonly<Record<string, string>> = { CET: '+01:00', CEST: '+02:00', UTC: 'Z', GMT: 'Z' };
const logLine = /^\[(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([A-Z]+)\] (.*)$/;

/** job-worker's log lines (`[2026-11-06 22:17:40 CET] step fix1 start (...)`); other lines are skipped. */
export function parseLog(text: string): LogEvent[] {
  const events: LogEvent[] = [];
  for (const line of text.split('\n')) {
    const m = logLine.exec(line);
    if (m === null) continue;
    const [, day, time, zone = '', rest = ''] = m;
    const offset = zones[zone];
    if (offset === undefined) continue;
    const at = new Date(`${day}T${time}${offset}`);
    const step = /^step (\S+) (start|ok)\b/.exec(rest);
    if (step !== null) {
      const [, name = '', what] = step;
      events.push(
        what === 'start' ? { at, kind: 'step-start', step: name } : { at, kind: 'step-ok', step: name },
      );
      continue;
    }
    const status = /^status=(\S+)$/.exec(rest);
    if (status !== null) events.push({ at, kind: 'status', status: status[1] ?? '' });
  }
  return events;
}

/** The verdict a review file ends with (job-worker reads its last lines the same way). */
export function parseVerdict(text: string): Verdict | null {
  const tail = text.trimEnd().split('\n').slice(-3).join('\n');
  const m = /VERDICT: (PASS|FIX)\s*$/.exec(tail);
  if (m === null) return null;
  return m[1] === 'PASS' ? 'pass' : 'fix';
}

/**
 * The review round a file holds: review.<N>.md is the verdict the worker acted on, review.<N>.pass.md
 * the reviewer's PASS the lead later overrode with a requeue (that review.<N>.md is the lead's FIX).
 * review.<N>.lead-requeue.md is the lead's note and holds no round of its own.
 */
export function reviewRound(fileName: string): { round: number; overridden: boolean } | null {
  const m = /^review\.(\d+)\.(pass\.)?md$/.exec(fileName);
  return m === null ? null : { round: Number(m[1]), overridden: m[2] !== undefined };
}

export function stepsOf(events: readonly LogEvent[]): Step[] {
  const steps: Step[] = [];
  let open: Step | null = null;
  for (const e of events) {
    if (e.kind === 'step-start') {
      if (open !== null && open.endedAt === null) open.endedAt = e.at.toISOString();
      open = { name: e.step, startedAt: e.at.toISOString(), endedAt: null };
      steps.push(open);
    } else if (e.kind === 'step-ok' && open !== null && open.name === e.step) {
      open.endedAt = e.at.toISOString();
    }
  }
  return steps;
}

const kinds: readonly [RegExp, JobKind][] = [
  [/^(vmaint|zz)-/, 'maintenance'],
  [/(^|-)hc-/, 'hillclimb'],
  [/flake/, 'flake'],
];

export function kindOf(id: string): JobKind {
  return kinds.find(([pattern]) => pattern.test(id))?.[1] ?? 'feature';
}

/** "156-nexus-dashboard" -> "nexus dashboard". */
export function readableSlug(id: string): string {
  return id.replace(/^\d+[a-z]?-/, '').replaceAll('-', ' ');
}

function runnerOf(files: JobFiles): Runner | null {
  const named = runners.find((r) => r === files.runnerFile);
  if (named !== undefined) return named;
  const moved = /^moved-(\w+)$/.exec(files.status ?? '');
  const movedTo = runners.find((r) => r === moved?.[1]);
  if (movedTo !== undefined) return movedTo;
  return files.workerAlive || files.hasWorkdir ? 'hz' : null;
}

function liveState(step: string | null): JobState {
  if (step === null || step === 'build') return 'building';
  if (step.startsWith('review')) return 'reviewing';
  if (step.startsWith('fix')) return 'fixing';
  return 'building';
}

/** What the state machine reads of a PR. */
export type PrFacts = Pick<PrRecord, 'state' | 'notForMerge'>;

function finishedState(pr: PrFacts | null): JobState {
  switch (pr?.state) {
    case 'merged':
      return 'merged';
    case 'open':
      return pr.notForMerge ? 'parked' : 'awaiting-merge';
    case 'closed':
      return 'closed';
    case undefined:
      return 'done';
  }
}

/**
 * The state machine. A running/review job is live only while a worker runs it: its job-worker on
 * this host, or (box, mac) as their status says. An hz job without a worker waits for a lane.
 */
export function stateOf(
  files: JobFiles,
  runner: Runner | null,
  step: string | null,
  pr: PrFacts | null,
  now: Date,
): JobState {
  const status = files.status ?? '';
  switch (status) {
    case 'cancelled':
      return 'cancelled';
    case 'queued':
      return files.startAfter !== null && files.startAfter > now ? 'waiting' : 'queued';
    case 'waiting':
      return 'waiting';
    case 'limit-blocked':
    case 'failed':
      return 'blocked';
    case 'running':
    case 'review': {
      const live = files.workerAlive || (runner !== null && runner !== 'hz');
      return live ? liveState(step) : 'waiting';
    }
    case 'done':
      return finishedState(pr);
  }
  if (status.startsWith('moved-')) return finishedState(pr);
  if (status.startsWith('paused')) return 'blocked';
  return 'blocked';
}

/** A job's PR: its branch's, else the newest of the branches it fanned out to (`<branch>-app`), open first. */
export function prFor(branch: string, prs: readonly PrRecord[]): PrRecord | null {
  const exact = prs.filter((p) => p.head === branch);
  const pool = exact.length > 0 ? exact : prs.filter((p) => p.head.startsWith(`${branch}-`));
  const ranked = [...pool].sort((a, b) =>
    Number(b.state === 'open') - Number(a.state === 'open') || b.createdAt.localeCompare(a.createdAt)
  );
  return ranked[0] ?? null;
}

export function jobOf(
  files: JobFiles,
  prs: readonly PrRecord[],
  now: Date,
): Job {
  const branch = files.branch ?? `job/${files.id}`;
  const pr = prFor(branch, prs);
  const steps = stepsOf(files.events);
  const current = steps.at(-1) ?? null;
  const runner = runnerOf(files);
  const state = stateOf(files, runner, current?.name ?? null, pr, now);
  const live = state === 'building' || state === 'reviewing' || state === 'fixing';
  const ends = files.events.filter((e) =>
    e.kind === 'status' && ['done', 'cancelled', 'failed'].includes(e.status)
  );
  return {
    id: files.id,
    title: pr?.title ?? readableSlug(files.id),
    kind: kindOf(files.id),
    runner,
    state,
    step: live ? current?.name ?? null : null,
    stepSince: live ? current?.startedAt ?? null : null,
    queuedAt: files.queuedAt?.toISOString() ?? null,
    statusSince: files.statusAt?.toISOString() ?? null,
    startedAt: files.events[0]?.at.toISOString() ?? null,
    finishedAt: ends.at(-1)?.at.toISOString() ?? null,
    steps,
    verdicts: files.verdicts,
    pr: pr === null
      ? null
      : { number: pr.number, url: pr.url, state: pr.state, ci: pr.ci, mergedAt: pr.mergedAt },
  };
}

/** Live and waiting jobs always; finished ones while their last sign of life is under 7 days old. */
export function inWindow(job: Job, now: Date): boolean {
  if (job.state !== 'merged' && job.state !== 'done' && job.state !== 'closed' && job.state !== 'cancelled') {
    return true;
  }
  const times = [job.finishedAt, job.pr?.mergedAt ?? null, job.steps.at(-1)?.endedAt ?? null]
    .filter((t): t is string => t !== null)
    .map((t) => Date.parse(t));
  const last = Math.max(...times, -Infinity);
  return now.getTime() - last <= 7 * 24 * 3600_000;
}

async function readText(path: string): Promise<string | null> {
  try {
    return await Deno.readTextFile(path);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return null;
    throw e;
  }
}

async function mtime(path: string): Promise<Date | null> {
  try {
    return (await Deno.stat(path)).mtime;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return null;
    throw e;
  }
}

const firstLine = (text: string | null): string | null => text?.split('\n')[0]?.trim() || null;

/** Reads jobs/<id>/. Returns null for a dir without brief.md (run-queue skips those too). */
export async function readJobDir(
  dir: string,
  id: string,
  isWorkerAlive: (pid: number) => boolean,
): Promise<JobFiles | null> {
  const briefAt = await mtime(`${dir}/brief.md`);
  if (briefAt === null) return null;
  const pid = Number(firstLine(await readText(`${dir}/pid`)));
  const startAfter = Number(firstLine(await readText(`${dir}/start_after`)));
  const acted = new Map<number, Verdict>();
  const overridden = new Map<number, 'pass'>();
  for await (const entry of Deno.readDir(dir)) {
    const file = reviewRound(entry.name);
    if (file === null) continue;
    // A .pass.md exists only to keep a PASS; the watcher writes some as a one-line marker
    // ("PASS from review.1.md at ...") with no VERDICT line.
    if (file.overridden) {
      overridden.set(file.round, 'pass');
      continue;
    }
    const verdict = parseVerdict(await Deno.readTextFile(`${dir}/${entry.name}`));
    if (verdict !== null) acted.set(file.round, verdict);
  }
  const verdicts = [...acted].map(([round, verdict]) => {
    const pass = overridden.get(round) === 'pass';
    return { round, verdict: pass ? 'pass' as const : verdict, requeued: pass && verdict === 'fix' };
  }).sort((a, b) => a.round - b.round);
  const events = parseLog((await readText(`${dir}/log`)) ?? '');
  const firstEvent = events[0]?.at;
  return {
    id,
    status: firstLine(await readText(`${dir}/status`)),
    branch: firstLine(await readText(`${dir}/branch`)),
    runnerFile: firstLine(await readText(`${dir}/runner`)),
    hasWorkdir: (await mtime(`${dir}/workdir`)) !== null,
    workerAlive: Number.isInteger(pid) && pid > 0 && isWorkerAlive(pid),
    queuedAt: firstEvent !== undefined && firstEvent < briefAt ? firstEvent : briefAt,
    statusAt: await mtime(`${dir}/status`),
    startAfter: Number.isFinite(startAfter) && startAfter > 0 ? new Date(startAfter * 1000) : null,
    events,
    verdicts,
  };
}

/** Like run-queue's `alive`: /proc/<pid>/cmdline names job-worker. */
export function procWorkerAlive(pid: number): boolean {
  try {
    return Deno.readTextFileSync(`/proc/${pid}/cmdline`).includes('job-worker');
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return false;
    throw e;
  }
}
