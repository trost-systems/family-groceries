import { assertEquals } from '@std/assert';
import { anchor, configNumber, openNeedsLead, parseHost, parseUsage } from '../pipeline/ops.ts';

Deno.test('config values ignore comments', () => {
  assertEquals(configNumber('# x\nHZ_LANES=6          # lowered 21:42\n', 'HZ_LANES'), 6);
  assertEquals(configNumber('X_HZ_LANES=6\n', 'HZ_LANES'), null);
});

Deno.test('usage pace is 0.95 of the elapsed week', () => {
  const now = new Date('2026-11-07T00:00:00Z');
  const reset = now.getTime() / 1000 + 7 * 24 * 3600;
  assertEquals(parseUsage({ weekly_util: 0.1, weekly_reset_epoch: reset }, now)?.pace, 0);
  assertEquals(parseUsage({ weekly_util: 0.1, weekly_reset_epoch: now.getTime() / 1000 }, now)?.pace, 0.95);
  assertEquals(parseUsage({ weekly_util: '0.1' }, now), null);
});

Deno.test('open NEEDS_LEAD sections: a Status line that is not done', () => {
  const md = [
    '# Needs',
    '## mcp.hummlist.com',
    'Status: done. Live.',
    "## Job 124: report upstream? (after Erika's OK, Nov 1)",
    "Status: open, the Lead's call.",
    '## Job 23: pipeline',
    'Status (2026-10-28): all done. Nothing is open.',
    '### Job 23 sub',
    'Status: open (a subsection belongs to its section)',
    '## Job 40: no status',
    'Body.',
  ].join('\n\n');
  assertEquals(openNeedsLead(md), [{
    title: 'Job 124: report upstream?',
    source: 'NEEDS_LEAD.md',
    ref: 'job-124-report-upstream',
  }]);
  assertEquals(anchor('Job 114: „Zuletzt verwendet“ #62, a.b'), 'job-114-zuletzt-verwendet-62-ab');
});

Deno.test('host from /proc text', () => {
  const host = parseHost(
    '11.29 14.34 12.13 9/2048 123\n',
    'MemTotal:       65748912 kB\nMemFree:  1 kB\nMemAvailable:   57599616 kB\n',
    12,
    300_000_000,
  );
  assertEquals(host, {
    name: 'hz',
    cores: 12,
    load: [11.29, 14.34, 12.13],
    memAvailGb: 54.9,
    memTotalGb: 62.7,
    diskFreeGb: 286,
  });
});
