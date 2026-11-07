import { assertEquals } from '@std/assert';
import {
  type JobFiles,
  kindOf,
  parseLog,
  parseVerdict,
  prFor,
  readableSlug,
  reviewRound,
  stateOf,
} from '../pipeline/jobs.ts';
import type { PrRecord } from '../pipeline/github.ts';
import type { JobState, Runner } from '../src/snapshot.ts';

const now = new Date('2026-11-07T10:00:00Z');

Deno.test('parseLog keeps step and status tokens in UTC, drops the rest', () => {
  const events = parseLog(
    [
      '[2026-11-06 22:17:40 CET] step fix1 start (model opus, resume=no, session abc)',
      '[2026-07-06 22:17:40 CEST] step fix1 ok',
      '[2026-11-06 22:17:41 CET] status=review',
      '[2026-11-06 22:17:42 CET] usage gate blocks step review1: weekly 0.96 (re-check in 15 min)',
      '[2026-11-06 22:17:43 PST] status=done',
      'free text from a tool',
    ].join('\n'),
  );
  assertEquals(events.map((e) => [e.at.toISOString(), e.kind, 'step' in e ? e.step : e.status]), [
    ['2026-11-06T21:17:40.000Z', 'step-start', 'fix1'],
    ['2026-07-06T20:17:40.000Z', 'step-ok', 'fix1'],
    ['2026-11-06T21:17:41.000Z', 'status', 'review'],
  ]);
});

Deno.test('a verdict is the last VERDICT line; review.<N>.md and its .pass.md hold a round', () => {
  assertEquals(parseVerdict('x\nVERDICT: PASS\n'), 'pass');
  assertEquals(parseVerdict('VERDICT: PASS\n' + 'more\n'.repeat(5)), null);
  assertEquals(parseVerdict('## Must fix\n\nVERDICT: FIX'), 'fix');
  assertEquals(
    ['review.3.md', 'review.3.pass.md', 'review.2.lead-requeue.md', 'review3.result', 'review.0-x.png'].map(
      reviewRound,
    ),
    [
      { round: 3, overridden: false },
      { round: 3, overridden: true },
      null,
      null,
      null,
    ],
  );
});

const files = (status: string | null, over: Partial<JobFiles> = {}): JobFiles => ({
  id: '1-x',
  status,
  branch: null,
  runnerFile: null,
  hasWorkdir: true,
  workerAlive: false,
  queuedAt: null,
  statusAt: null,
  startAfter: null,
  events: [],
  verdicts: [],
  ...over,
});

const pr = (state: 'open' | 'merged' | 'closed'): PrRecord => ({
  number: 1,
  url: 'u',
  state,
  ci: null,
  mergedAt: null,
  head: 'job/1-x',
  title: 't',
  createdAt: '2026-11-01T00:00:00Z',
  notForMerge: false,
});

Deno.test('the state machine', () => {
  const cases: [JobFiles, Runner | null, string | null, PrRecord | null, JobState][] = [
    [files('running', { workerAlive: true }), 'hz', null, null, 'building'],
    [files('running', { workerAlive: true }), 'hz', 'build', null, 'building'],
    [files('review', { workerAlive: true }), 'hz', 'review3', null, 'reviewing'],
    [files('running', { workerAlive: true }), 'hz', 'fix2', null, 'fixing'],
    [files('running'), 'hz', 'fix2', null, 'waiting'],
    [files('running'), 'box', 'fix2', null, 'fixing'],
    [files('review'), 'mac', 'review1', null, 'reviewing'],
    [files('queued'), null, null, null, 'queued'],
    [files('queued', { startAfter: new Date('2026-11-08T00:00:00Z') }), null, null, null, 'waiting'],
    [files('queued', { startAfter: new Date('2026-11-06T00:00:00Z') }), null, null, null, 'queued'],
    [files('waiting'), null, null, null, 'waiting'],
    [files('limit-blocked'), 'hz', null, null, 'blocked'],
    [files('failed'), 'hz', null, null, 'blocked'],
    [files('paused-ram'), 'hz', null, null, 'blocked'],
    [files('done'), 'hz', null, pr('merged'), 'merged'],
    [files('done'), 'hz', null, pr('open'), 'awaiting-merge'],
    [files('done'), 'hz', null, { ...pr('open'), notForMerge: true }, 'parked'],
    [files('moved-mac'), 'mac', null, { ...pr('open'), notForMerge: true }, 'parked'],
    [files('done'), 'hz', null, pr('closed'), 'closed'],
    [files('done'), 'hz', null, null, 'done'],
    [files('moved-mac'), 'mac', null, null, 'done'],
    [files('moved-mac'), 'mac', null, pr('merged'), 'merged'],
    [files('cancelled'), null, null, pr('open'), 'cancelled'],
    [files(null), null, null, null, 'blocked'],
  ];
  for (const [f, runner, step, p, want] of cases) {
    assertEquals(stateOf(f, runner, step, p, now), want, `${f.status} ${runner} ${step} ${p?.state}`);
  }
});

Deno.test("a job's PR: exact branch first, else its fan-out branches, open before merged", () => {
  const prs: PrRecord[] = [
    { ...pr('merged'), number: 1, head: 'job/154-hc-v2-web', createdAt: '2026-11-06T02:00:00Z' },
    { ...pr('open'), number: 2, head: 'job/154-hc-v2-app', createdAt: '2026-11-06T01:00:00Z' },
    { ...pr('open'), number: 3, head: 'job/15', createdAt: '2026-11-06T03:00:00Z' },
    { ...pr('closed'), number: 4, head: 'job/155-x', createdAt: '2026-11-06T01:00:00Z' },
    { ...pr('merged'), number: 5, head: 'job/155-x', createdAt: '2026-11-06T02:00:00Z' },
  ];
  assertEquals(prFor('job/154-hc-v2', prs)?.number, 2);
  assertEquals(prFor('job/155-x', prs)?.number, 5);
  assertEquals(prFor('job/1', prs), null);
});

Deno.test('kinds and readable slugs', () => {
  assertEquals(
    [
      '128-hc-domain-tests',
      '120-fix-live-sync-flakes',
      'vmaint-20261106',
      'zz-hz-smoke',
      '156-nexus-dashboard',
    ].map(kindOf),
    [
      'hillclimb',
      'flake',
      'maintenance',
      'maintenance',
      'feature',
    ],
  );
  assertEquals(readableSlug('156-nexus-dashboard'), 'nexus dashboard');
  assertEquals(readableSlug('25b-iap-followups'), 'iap followups');
  assertEquals(readableSlug('vmaint-20261106'), 'vmaint 20261106');
});
