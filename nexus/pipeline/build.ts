// Builds the snapshot from an ops dir, a repo checkout, gh and the host. Every input is injected
// so the tests run on a fixture ops dir with no network.
import type { Host, Job, Lane, Snapshot } from '../src/snapshot.ts';
import { runners } from '../src/snapshot.ts';
import { type GhReader, parseIssues, parseRuns, pullsOf } from './github.ts';
import { readHillClimbs } from './hillclimbs.ts';
import { inWindow, jobOf, readJobDir } from './jobs.ts';
import { configNumber, openNeedsLead, parseUsage } from './ops.ts';
import { ciDaily, flakyTrend, medianQueuedToMerged, mergedInWeek, mergesDaily } from './series.ts';

export interface Inputs {
  /** ~/groceries-ops */
  opsDir: string;
  /** A checkout of main: docs/NEEDS_LEAD.md and docs/hillclimb/. */
  repoDir: string;
  gh: GhReader;
  host: () => Promise<Host | null>;
  isWorkerAlive: (pid: number) => boolean;
  now: Date;
  warn: (msg: string) => void;
}

async function readOptional(path: string): Promise<string | null> {
  try {
    return await Deno.readTextFile(path);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return null;
    throw e;
  }
}

const live = (j: Job): boolean => j.state === 'building' || j.state === 'reviewing' || j.state === 'fixing';

export function lanesOf(
  jobs: readonly Job[],
  capacity: Readonly<Record<'hz' | 'box', number | null>>,
): Lane[] {
  return runners.flatMap((runner) => {
    const busy = jobs.filter((j) => live(j) && j.runner === runner).length;
    if (runner !== 'hz' && busy === 0) return [];
    return [{ runner, capacity: runner === 'mac' ? null : capacity[runner], busy }];
  });
}

const stateOrder: readonly Job['state'][] = [
  'building',
  'reviewing',
  'fixing',
  'blocked',
  'awaiting-merge',
  'parked',
  'queued',
  'waiting',
  'merged',
  'done',
  'closed',
  'cancelled',
];

export async function buildSnapshot(input: Inputs): Promise<Snapshot> {
  const { opsDir, repoDir, gh, now } = input;
  // The 14-day series and the two rolling weeks, with a day to spare for Berlin vs UTC.
  const since = new Date(now.getTime() - 15 * 24 * 3600_000);
  const [runsJson, openJson, finishedJson, issuesJson] = await Promise.all([
    gh.ciRuns(since),
    gh.openPulls(),
    gh.finishedPulls(since),
    gh.flakyIssues(),
  ]);
  const runs = parseRuns(runsJson);
  const prs = pullsOf(openJson, finishedJson, runs);

  const jobs: Job[] = [];
  for await (const entry of Deno.readDir(`${opsDir}/jobs`)) {
    if (!entry.isDirectory) continue;
    const files = await readJobDir(`${opsDir}/jobs/${entry.name}`, entry.name, input.isWorkerAlive);
    if (files === null) continue;
    const job = jobOf(files, prs, now);
    if (inWindow(job, now)) jobs.push(job);
  }
  jobs.sort((a, b) =>
    stateOrder.indexOf(a.state) - stateOrder.indexOf(b.state) ||
    (b.pr?.mergedAt ?? b.finishedAt ?? b.queuedAt ?? '').localeCompare(
      a.pr?.mergedAt ?? a.finishedAt ?? a.queuedAt ?? '',
    )
  );

  const configHz = (await readOptional(`${opsDir}/config.hz`)) ?? '';
  const configBox = (await readOptional(`${opsDir}/config`)) ?? '';
  const usageText = await readOptional(`${opsDir}/usage-feed.json`);
  const needsLeadText = (await readOptional(`${repoDir}/docs/NEEDS_LEAD.md`)) ?? '';

  return {
    schema: 1,
    generatedAt: now.toISOString(),
    jobs,
    lanes: lanesOf(jobs, {
      hz: configNumber(configHz, 'HZ_LANES'),
      box: configNumber(configBox, 'MAX_PARALLEL'),
    }),
    host: await input.host(),
    ci: { daily: ciDaily(runs, now) },
    merges: {
      daily: mergesDaily(prs, now),
      last7d: mergedInWeek(prs, now, 0),
      prior7d: mergedInWeek(prs, now, 1),
      medianQueuedToMergedH: medianQueuedToMerged(jobs, now),
    },
    flaky: flakyTrend(parseIssues(issuesJson), now),
    hillclimbs: await readHillClimbs(`${repoDir}/docs/hillclimb`, input.warn),
    usage: usageText === null ? null : parseUsage(JSON.parse(usageText), now),
    needsLead: [
      ...jobs.filter((j) => j.state === 'awaiting-merge').map((j) => ({
        title: j.title,
        source: 'job' as const,
        ref: j.id,
      })),
      ...openNeedsLead(needsLeadText),
    ],
  };
}
