// GitHub facts through `gh` (read-only). The reader is injected so tests run without network; the
// parsers are the boundary that turns gh's JSON into typed records.
import type { CiResult, PullRequest } from '../src/snapshot.ts';

export const repo = 'trost-systems/family-groceries';

export interface PrRecord extends PullRequest {
  head: string;
  title: string;
  createdAt: string;
  /** A draft, or a title that says the PR is not meant to merge (hill-climbs, prototypes). */
  notForMerge: boolean;
}

/** "[DO NOT MERGE]", "(NOT FOR MERGE)", "(preview, not for merge)", any case. */
const notForMergeTitle = /\b(?:do not merge|not for merge)\b/i;

export interface CiRun {
  branch: string;
  createdAt: string;
  /** null while the run is queued or in progress. */
  conclusion: string | null;
}

export interface FlakyIssue {
  createdAt: string;
  closedAt: string | null;
  open: boolean;
}

/** Raw JSON from gh; the pipeline parses it. */
export interface GhReader {
  /** Every open PR, however old. */
  openPulls(): Promise<unknown>;
  /** PRs merged or closed since the day of `since`. */
  finishedPulls(since: Date): Promise<unknown>;
  ciRuns(since: Date): Promise<unknown>;
  flakyIssues(): Promise<unknown>;
}

function record(v: unknown, what: string): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    throw new Error(`gh: ${what} is not an object`);
  }
  return v as Record<string, unknown>;
}

function list(v: unknown, what: string): Record<string, unknown>[] {
  if (!Array.isArray(v)) throw new Error(`gh: ${what} is not a list`);
  return v.map((item) => record(item, what));
}

function str(r: Record<string, unknown>, key: string, what: string): string {
  const v = r[key];
  if (typeof v !== 'string') throw new Error(`gh: ${what}.${key} is not a string`);
  return v;
}

function optStr(r: Record<string, unknown>, key: string): string | null {
  const v = r[key];
  return typeof v === 'string' && v !== '' ? v : null;
}

const prStates: Readonly<Record<string, PullRequest['state']>> = {
  OPEN: 'open',
  MERGED: 'merged',
  CLOSED: 'closed',
};

export function parseRuns(json: unknown): CiRun[] {
  return list(json, 'run').map((r) => ({
    branch: str(r, 'headBranch', 'run'),
    createdAt: str(r, 'createdAt', 'run'),
    conclusion: str(r, 'status', 'run') === 'completed' ? str(r, 'conclusion', 'run') : null,
  }));
}

/** The newest run of a branch that was not cancelled decides its CI. */
export function ciOf(branch: string, runs: readonly CiRun[]): CiResult | null {
  const latest = runs
    .filter((r) => r.branch === branch && r.conclusion !== 'cancelled' && r.conclusion !== 'skipped')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (latest === undefined) return null;
  if (latest.conclusion === null) return 'pending';
  return latest.conclusion === 'success' ? 'pass' : 'fail';
}

export function parsePulls(json: unknown, runs: readonly CiRun[]): PrRecord[] {
  return list(json, 'pull').map((r) => {
    const number = r['number'];
    if (typeof number !== 'number') throw new Error('gh: pull.number is not a number');
    const state = prStates[str(r, 'state', 'pull')];
    if (state === undefined) throw new Error(`gh: unknown pull state ${String(r['state'])}`);
    const head = str(r, 'headRefName', 'pull');
    const title = str(r, 'title', 'pull');
    const isDraft = r['isDraft'];
    if (typeof isDraft !== 'boolean') throw new Error('gh: pull.isDraft is not a boolean');
    return {
      number,
      url: str(r, 'url', 'pull'),
      title,
      head,
      createdAt: str(r, 'createdAt', 'pull'),
      state,
      mergedAt: optStr(r, 'mergedAt'),
      ci: ciOf(head, runs),
      notForMerge: isDraft || notForMergeTitle.test(title),
    };
  });
}

/**
 * One record per PR number. A PR that merged or closed between the two gh calls is in both lists;
 * its finished record wins.
 */
export function pullsOf(open: unknown, finished: unknown, runs: readonly CiRun[]): PrRecord[] {
  const byNumber = new Map<number, PrRecord>();
  for (const pr of [...parsePulls(open, runs), ...parsePulls(finished, runs)]) byNumber.set(pr.number, pr);
  return [...byNumber.values()];
}

export function parseIssues(json: unknown): FlakyIssue[] {
  return list(json, 'issue').map((r) => ({
    createdAt: str(r, 'createdAt', 'issue'),
    closedAt: optStr(r, 'closedAt'),
    open: str(r, 'state', 'issue') === 'OPEN',
  }));
}

async function gh(args: readonly string[]): Promise<unknown> {
  const { code, stdout, stderr } = await new Deno.Command('gh', {
    args: [...args, '-R', repo],
    stdout: 'piped',
    stderr: 'piped',
  })
    .output();
  if (code !== 0) {
    throw new Error(`gh ${args.slice(0, 2).join(' ')} failed: ${new TextDecoder().decode(stderr).trim()}`);
  }
  return JSON.parse(new TextDecoder().decode(stdout));
}

const pullFields = 'number,url,title,state,isDraft,headRefName,createdAt,mergedAt';

export const ghCli: GhReader = {
  openPulls: () => gh(['pr', 'list', '--state', 'open', '--limit', '1000', '--json', pullFields]),
  finishedPulls: async (since) => {
    const day = since.toISOString().slice(0, 10);
    const [merged, closed] = await Promise.all([
      gh([
        'pr',
        'list',
        '--state',
        'merged',
        '--search',
        `merged:>=${day}`,
        '--limit',
        '1000',
        '--json',
        pullFields,
      ]),
      gh([
        'pr',
        'list',
        '--state',
        'closed',
        '--search',
        `closed:>=${day}`,
        '--limit',
        '1000',
        '--json',
        pullFields,
      ]),
    ]);
    return [merged, closed].flatMap((prs) => Array.isArray(prs) ? prs : [prs]);
  },
  // GitHub answers a filtered run list with at most 1000 runs, so ask one UTC day at a time.
  ciRuns: async (since) => {
    const days: string[] = [];
    for (let d = new Date(since); d.getTime() <= Date.now(); d = new Date(d.getTime() + 24 * 3600_000)) {
      days.push(d.toISOString().slice(0, 10));
    }
    const perDay = await Promise.all(
      days.map((day) =>
        gh([
          'run',
          'list',
          '--workflow',
          'ci.yml',
          '--limit',
          '1000',
          '--created',
          day,
          '--json',
          'headBranch,createdAt,status,conclusion',
        ])
      ),
    );
    return perDay.flatMap((runs) => Array.isArray(runs) ? runs : [runs]);
  },
  flakyIssues: () =>
    gh([
      'issue',
      'list',
      '--label',
      'flaky',
      '--state',
      'all',
      '--limit',
      '1000',
      '--json',
      'createdAt,closedAt,state',
    ]),
};
