import { assertEquals } from '@std/assert';
import { berlinDay, lastDays, median, weekOf } from '../pipeline/series.ts';

Deno.test('days are Europe/Berlin calendar days, across DST', () => {
  assertEquals(berlinDay('2026-11-06T23:30:00Z'), '2026-11-07');
  assertEquals(berlinDay('2026-07-06T22:30:00Z'), '2026-07-07');
  assertEquals(berlinDay('2026-07-06T21:30:00Z'), '2026-07-06');
  assertEquals(lastDays(new Date('2026-10-26T12:00:00Z'), 3), ['2026-10-24', '2026-10-25', '2026-10-26']);
});

Deno.test('weeks start on Monday', () => {
  assertEquals(['2026-11-02', '2026-11-07', '2026-11-08', '2026-11-09'].map(weekOf), [
    '2026-11-02',
    '2026-11-02',
    '2026-11-02',
    '2026-11-09',
  ]);
});

Deno.test('median', () => {
  assertEquals([median([]), median([3, 1, 2]), median([4, 1, 2, 3])], [null, 2, 2.5]);
});
