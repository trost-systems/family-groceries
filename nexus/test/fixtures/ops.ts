// A fixture ops dir (~/groceries-ops shape), written into a temp dir per test. Briefs, BOARD and
// review prose carry a person's name and email on purpose: the privacy test looks for them.
import type { GhReader } from '../../pipeline/github.ts';

export const now = new Date('2026-11-07T10:00:00Z');
export const personName = 'Erika Mustermann';
export const personEmail = 'erika.mustermann@example.org';
/** The pid fake job-workers run under; isWorkerAlive answers yes for it only. */
export const livePid = 4242;

const prose = `Brief written for ${personName} <${personEmail}>, about her household list "Milch, Eier".\n`;

interface FixtureJob {
  files: Record<string, string>;
  /** brief.md mtime. */
  queued: string;
  /** status mtime when it differs from the brief's (a requeued fix round). */
  statusAt?: string;
}

const log = (...lines: string[]): string => lines.map((l) => `[${l}`).join('\n') + '\n';

export const fixtureJobs: Record<string, FixtureJob> = {
  '201-live-build': {
    queued: '2026-11-07T08:00:00Z',
    files: {
      status: 'running',
      pid: String(livePid),
      workdir: '/home/agents/fg-wt/201-live-build',
      log: log(
        `2026-11-07 09:01:00 CET] status=running`,
        `2026-11-07 09:01:01 CET] step build start (model opus, resume=no, session x)`,
      ),
    },
  },
  '202-live-review': {
    queued: '2026-11-06T08:00:00Z',
    files: {
      status: 'review',
      pid: String(livePid),
      workdir: '/w',
      log: log(
        `2026-11-06 09:00:00 CET] step build start (model opus)`,
        `2026-11-06 11:00:00 CET] step build ok`,
        `2026-11-06 11:00:00 CET] status=review`,
        `2026-11-06 11:00:01 CET] step review0 start (model opus)`,
      ),
    },
  },
  '203-hc-live-fix': {
    queued: '2026-11-06T08:00:00Z',
    files: {
      status: 'running',
      runner: 'hz',
      pid: String(livePid),
      log: log(
        `2026-11-06 09:00:00 CET] step build start`,
        `2026-11-06 10:00:00 CET] step build ok`,
        `2026-11-06 10:00:01 CET] step review0 start`,
        `2026-11-06 10:30:00 CET] step review0 ok`,
        `2026-11-06 10:30:01 CET] step fix1 start`,
      ),
      'review.0.md': `${prose}\nVERDICT: FIX\n`,
    },
  },
  '204-dead-worker': {
    queued: '2026-11-06T08:00:00Z',
    files: {
      status: 'running',
      pid: '999999',
      workdir: '/w',
      log: log(`2026-11-06 09:00:00 CET] step build start`),
    },
  },
  '205-queued': {
    queued: '2026-11-07T07:00:00Z',
    statusAt: '2026-11-07T09:30:00Z',
    files: { status: 'queued' },
  },
  '206-later': {
    queued: '2026-11-07T07:00:00Z',
    files: { status: 'queued', start_after: String(now.getTime() / 1000 + 3600) },
  },
  '207-limit': { queued: '2026-11-05T07:00:00Z', files: { status: 'limit-blocked', workdir: '/w' } },
  '208-merged-flake': {
    // The lead appended an addendum to the brief after the build had started.
    queued: '2026-11-05T09:45:00Z',
    files: {
      status: 'done',
      stage: 'done',
      runner: 'hz',
      log: log(
        `2026-11-05 09:00:00 CET] step build start`,
        `2026-11-05 10:00:00 CET] step build ok`,
        `2026-11-05 10:00:01 CET] step review0 start`,
        `2026-11-05 10:20:00 CET] step review0 ok`,
        `2026-11-05 10:20:01 CET] step fix1 start`,
        `2026-11-05 11:00:00 CET] step fix1 ok`,
        `2026-11-05 11:00:01 CET] step review1 start`,
        `2026-11-05 11:30:00 CET] step review1 ok`,
        `2026-11-05 11:30:00 CET] status=done`,
      ),
      'review.0.md': `Must fix: call ${personName}.\nVERDICT: FIX\n`,
      'review.1.md': 'Lead requeue.\n\nVERDICT: FIX\n',
      'review.1.pass.md': 'PASS from review.1.md at 2026-11-05T11:30:00+01:00\n',
      'review.1.lead-requeue.md': 'Rebase.\n\nVERDICT: FIX\n',
      'review.2.md': 'All good.\n\nVERDICT: PASS\n',
      'review.0-probe.png': 'binary',
    },
  },
  '170-old-open': {
    queued: '2026-09-01T08:00:00Z',
    files: { status: 'done', log: log(`2026-09-01 12:00:00 CEST] status=done`) },
  },
  '209-open-pr': {
    queued: '2026-11-04T08:00:00Z',
    files: { status: 'done', branch: 'job/209-open-pr', log: log(`2026-11-04 09:00:00 CET] status=done`) },
  },
  '210-no-pr': {
    queued: '2026-11-05T08:00:00Z',
    files: { status: 'done', log: log(`2026-11-06 09:00:00 CET] status=done`) },
  },
  '211-cancelled': {
    queued: '2026-11-05T08:00:00Z',
    files: { status: 'cancelled', log: log(`2026-11-05 09:00:00 CET] status=cancelled`) },
  },
  '212-old-merged': {
    queued: '2026-10-01T08:00:00Z',
    files: { status: 'done', log: log(`2026-10-01 09:00:00 CEST] status=done`) },
  },
  '213-fanned-out': {
    queued: '2026-11-06T08:00:00Z',
    files: { status: 'done', log: log(`2026-11-06 12:00:00 CET] status=done`) },
  },
  '214-draft': {
    queued: '2026-11-05T08:00:00Z',
    files: { status: 'done', log: log(`2026-11-05 12:00:00 CET] status=done`) },
  },
  '215-hc-parked': {
    queued: '2026-11-05T08:00:00Z',
    files: { status: 'done', log: log(`2026-11-05 12:00:00 CET] status=done`) },
  },
  'vmaint-20261106': {
    queued: '2026-11-06T02:00:00Z',
    files: { status: 'done', log: log(`2026-11-06 05:00:00 CET] status=done`) },
  },
  'no-brief': { queued: '', files: { status: 'running' } },
};

export async function writeFixtureOps(): Promise<{ opsDir: string; repoDir: string }> {
  const root = await Deno.makeTempDir({ prefix: 'nexus-fixture-' });
  const opsDir = `${root}/ops`;
  const repoDir = `${root}/repo`;
  for (const [id, job] of Object.entries(fixtureJobs)) {
    const dir = `${opsDir}/jobs/${id}`;
    await Deno.mkdir(dir, { recursive: true });
    for (const [name, text] of Object.entries(job.files)) await Deno.writeTextFile(`${dir}/${name}`, text);
    if (job.queued !== '') {
      await Deno.writeTextFile(`${dir}/brief.md`, prose);
      await Deno.utime(`${dir}/brief.md`, new Date(job.queued), new Date(job.queued));
      const statusAt = new Date(job.statusAt ?? job.queued);
      if (job.files['status'] !== undefined) await Deno.utime(`${dir}/status`, statusAt, statusAt);
      await Deno.writeTextFile(`${dir}/prompt.build.md`, prose);
    }
  }
  await Deno.writeTextFile(
    `${opsDir}/BOARD.md`,
    `[09:00] lead: ${personName} (${personEmail}) asked for nexus.\n`,
  );
  await Deno.writeTextFile(
    `${opsDir}/config.hz`,
    `# lanes\nHZ_LANES=4          # lowered by the watcher\nHZ_MEM_START_MB=12288\n`,
  );
  await Deno.writeTextFile(`${opsDir}/config`, `MAX_PARALLEL=3\nBUILD_MODEL=opus\n`);
  await Deno.writeTextFile(
    `${opsDir}/usage-feed.json`,
    JSON.stringify({
      weekly_util: 0.4,
      weekly_reset_epoch: now.getTime() / 1000 + 3.5 * 24 * 3600,
      seen_at: 1,
      source: 'x',
    }),
  );
  await Deno.mkdir(`${repoDir}/docs/hillclimb`, { recursive: true });
  await Deno.writeTextFile(
    `${repoDir}/docs/NEEDS_LEAD.md`,
    [
      '# Needs the Engineering Lead',
      '## Job 1: finished thing',
      'Status: done.',
      '## Job 2: a question for the lead',
      `Status: open, ask ${personName}.`,
      '## Job 3: a record without status',
      'Text.',
      '## Job 4: release pipeline',
      'Status (2026-10-28): all done.',
    ].join('\n\n'),
  );
  await Deno.copyFile(
    new URL('../../../docs/hillclimb/hc-strictness.md', import.meta.url).pathname,
    `${repoDir}/docs/hillclimb/hc-strictness.md`,
  );
  return { opsDir, repoDir };
}

const pull = (
  number: number,
  head: string,
  state: string,
  createdAt: string,
  mergedAt: string | null,
  { title = `PR ${number} for ${head}`, isDraft = false }: { title?: string; isDraft?: boolean } = {},
): unknown => ({
  number,
  url: `https://github.com/trost-systems/family-groceries/pull/${number}`,
  title,
  state,
  isDraft,
  headRefName: head,
  createdAt,
  mergedAt,
});

// #170 is open and older than every merged or closed PR: only the open list carries it.
export const fakeGh: GhReader = {
  openPulls: () =>
    Promise.resolve([
      pull(170, 'job/170-old-open', 'OPEN', '2026-09-01T09:00:00Z', null),
      pull(302, 'job/209-open-pr', 'OPEN', '2026-11-04T09:00:00Z', null),
      pull(305, 'job/213-fanned-out-app', 'OPEN', '2026-11-06T08:00:00Z', null),
      pull(306, 'job/203-hc-live-fix', 'OPEN', '2026-11-06T09:30:00Z', null),
      pull(308, 'job/214-draft', 'OPEN', '2026-11-05T11:00:00Z', null, { isDraft: true }),
      pull(309, 'job/215-hc-parked', 'OPEN', '2026-11-05T11:00:00Z', null, {
        title: 'hc(x): 2 -> 1 [do not merge]',
      }),
    ]),
  finishedPulls: () =>
    Promise.resolve([
      pull(290, 'docs/rolling-week-edge', 'MERGED', '2026-10-31T09:00:00Z', '2026-10-31T11:00:00Z'),
      pull(291, 'docs/prior-week', 'MERGED', '2026-10-28T09:00:00Z', '2026-10-28T11:00:00Z'),
      pull(301, 'job/208-merged-flake', 'MERGED', '2026-11-05T09:00:00Z', '2026-11-06T13:00:00Z'),
      pull(303, 'job/212-old-merged', 'MERGED', '2026-10-01T09:00:00Z', '2026-10-02T09:00:00Z'),
      pull(304, 'job/213-fanned-out-web', 'MERGED', '2026-11-06T09:00:00Z', '2026-11-06T10:00:00Z'),
      pull(307, 'job/2', 'MERGED', '2026-11-06T09:30:00Z', '2026-11-06T09:40:00Z'),
    ]),
  ciRuns: () =>
    Promise.resolve([
      {
        headBranch: 'job/209-open-pr',
        createdAt: '2026-11-04T10:00:00Z',
        status: 'completed',
        conclusion: 'failure',
      },
      {
        headBranch: 'job/209-open-pr',
        createdAt: '2026-11-04T11:00:00Z',
        status: 'completed',
        conclusion: 'success',
      },
      {
        headBranch: 'job/209-open-pr',
        createdAt: '2026-11-04T12:00:00Z',
        status: 'completed',
        conclusion: 'cancelled',
      },
      {
        headBranch: 'job/203-hc-live-fix',
        createdAt: '2026-11-07T09:50:00Z',
        status: 'in_progress',
        conclusion: '',
      },
      { headBranch: 'main', createdAt: '2026-11-06T22:30:00Z', status: 'completed', conclusion: 'failure' },
    ]),
  flakyIssues: () =>
    Promise.resolve([
      { createdAt: '2026-11-02T10:00:00Z', closedAt: null, state: 'OPEN' },
      { createdAt: '2026-10-27T10:00:00Z', closedAt: '2026-11-03T10:00:00Z', state: 'CLOSED' },
    ]),
};
