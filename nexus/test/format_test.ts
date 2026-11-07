import { assertEquals } from '@std/assert';
import { change, duration, freshness, score } from '../web/format.ts';

const now = new Date('2026-11-07T10:00:00Z');
const before = (min: number): string => new Date(now.getTime() - min * 60_000).toISOString();

Deno.test('freshness: fresh up to 30 min, stale to 2 h, outdated after', () => {
  assertEquals(freshness(before(0.5), now), { level: 'fresh', label: 'updated just now' });
  assertEquals(freshness(before(4), now), { level: 'fresh', label: 'updated 4 min ago' });
  assertEquals(freshness(before(31), now).level, 'stale');
  assertEquals(freshness(before(121), now), { level: 'outdated', label: 'updated 2 h 1 min ago' });
});

Deno.test('durations', () => {
  assertEquals([45_000, 4 * 60_000, 130 * 60_000, 120 * 60_000, 76 * 3600_000].map(duration), [
    '45 s',
    '4 min',
    '2 h 10 min',
    '2 h',
    '3 d 4 h',
  ]);
});

Deno.test('changes and scores read the way the page shows them', () => {
  assertEquals([change(122.82, 91.98), change(10.36, 19.2368), change(7.479, 6.598), change(1, 1)], [
    '−25 %',
    '+86 %',
    '−12 %',
    '0 %',
  ]);
  assertEquals([change(1030, 2), change(175, 0.000491), change(10, 0), change(10, 20)], [
    '−99.8 %',
    '−99.9 %',
    '−100 %',
    '+100 %',
  ]);
  assertEquals([score(175.000509), score(0.000491), score(10.36), score(0)], [
    '175',
    '< 0.01',
    '10.4',
    '0',
  ]);
});
