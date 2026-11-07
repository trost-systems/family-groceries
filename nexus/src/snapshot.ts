// The one contract between the pipeline (nexus/pipeline/, writes data/snapshot.json) and the page
// (nexus/web/, reads it). Only repo-level, non-personal facts fit these types; see README "Privacy".

export type Runner = 'hz' | 'box' | 'mac';
export const runners: readonly Runner[] = ['hz', 'box', 'mac'];

/** One state per job, derived from its status file, worker, last log step and PR (pipeline/jobs.ts). */
export type JobState =
  | 'queued'
  | 'waiting'
  | 'blocked'
  | 'building'
  | 'reviewing'
  | 'fixing'
  | 'awaiting-merge'
  | 'parked'
  | 'merged'
  | 'closed'
  | 'done'
  | 'cancelled';

/** Which page section a state belongs to. */
export type StateGroup = 'now' | 'waiting' | 'finished';
/** The only colours the page spends: one per tone, always next to the state's label. */
export type Tone = 'live' | 'idle' | 'attention' | 'ok' | 'off' | 'bad';

export const jobStates: Readonly<
  Record<JobState, { readonly label: string; readonly group: StateGroup; readonly tone: Tone }>
> = {
  building: { label: 'building', group: 'now', tone: 'live' },
  reviewing: { label: 'in review', group: 'now', tone: 'live' },
  fixing: { label: 'fixing', group: 'now', tone: 'live' },
  queued: { label: 'queued', group: 'waiting', tone: 'idle' },
  waiting: { label: 'waiting', group: 'waiting', tone: 'idle' },
  blocked: { label: 'blocked', group: 'waiting', tone: 'bad' },
  'awaiting-merge': { label: 'awaiting merge', group: 'waiting', tone: 'attention' },
  parked: { label: 'parked', group: 'waiting', tone: 'idle' },
  merged: { label: 'merged', group: 'finished', tone: 'ok' },
  done: { label: 'done', group: 'finished', tone: 'ok' },
  closed: { label: 'closed', group: 'finished', tone: 'off' },
  cancelled: { label: 'cancelled', group: 'finished', tone: 'off' },
};

export type JobKind = 'feature' | 'hillclimb' | 'flake' | 'maintenance';
export type Verdict = 'pass' | 'fix';
export type CiResult = 'pass' | 'fail' | 'pending';

/** A worker step from the job's log: build, reviewN or fixN. */
export interface Step {
  name: string;
  startedAt: string;
  endedAt: string | null;
}

export interface PullRequest {
  number: number;
  url: string;
  state: 'open' | 'merged' | 'closed';
  ci: CiResult | null;
  mergedAt: string | null;
}

export interface Job {
  id: string;
  /** The PR title when a PR exists, else the slug made readable. */
  title: string;
  kind: JobKind;
  runner: Runner | null;
  state: JobState;
  step: string | null;
  stepSince: string | null;
  /** The earlier of brief.md's mtime and the first log line: the lead appends addenda to briefs. */
  queuedAt: string | null;
  /** The status file's mtime: when the lead queued it or the worker last changed its status. */
  statusSince: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  steps: Step[];
  /** The verdict of each review round that has one (review.<round>.md). */
  /**
   * `requeued`: the reviewer's PASS (review.<N>.pass.md) that the lead overrode with a requeue, for
   * a rebase or a late addendum; counted as that round's PASS.
   */
  verdicts: { round: number; verdict: Verdict; requeued: boolean }[];
  pr: PullRequest | null;
}

export interface Lane {
  runner: Runner;
  capacity: number | null;
  busy: number;
}

export interface Host {
  name: 'hz';
  cores: number;
  load: [number, number, number];
  memAvailGb: number;
  memTotalGb: number;
  diskFreeGb: number;
}

export interface HillClimb {
  id: string;
  metric: string;
  direction: 'lower' | 'higher';
  baseline: number;
  best: number;
  target: number | null;
  /** Scores of the kept attempts, in order. */
  steps: number[];
}

export interface NeedsLeadItem {
  title: string;
  source: 'NEEDS_LEAD.md' | 'job';
  /** A job id, or a key made from the NEEDS_LEAD.md heading without its remarks in parentheses. */
  ref: string;
}

export interface Snapshot {
  schema: 1;
  generatedAt: string;
  /** Live, queued and waiting jobs, plus anything finished or merged in the last 7 days. */
  jobs: Job[];
  lanes: Lane[];
  host: Host | null;
  /** ci.yml runs per Europe/Berlin day, 14 days, main and PRs; cancelled runs left out. */
  ci: { daily: { date: string; pass: number; fail: number }[] };
  /** daily: Europe/Berlin days, 14 days. last7d and prior7d: rolling 7 x 24 h windows before generatedAt. */
  merges: {
    daily: { date: string; count: number }[];
    last7d: number;
    prior7d: number;
    medianQueuedToMergedH: number | null;
  };
  /** Issues labelled `flaky`; weeks start on Monday, 8 weeks. */
  flaky: { open: number; weekly: { week: string; opened: number; closed: number }[] };
  hillclimbs: HillClimb[];
  /** pace = 0.95 x the elapsed fraction of the usage week. */
  usage: { weeklyUtil: number; pace: number; resetAt: string } | null;
  needsLead: NeedsLeadItem[];
}

export const snapshotPath = '/data/snapshot.json';
