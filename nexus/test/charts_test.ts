import { assertEquals } from '@std/assert';
import { thinTicks } from '../web/charts.ts';

const weeks = ['14 Sept', '21 Sept', '28 Sept', '5 Oct', '12 Oct', '19 Oct', '26 Oct', '2 Nov'];

Deno.test('week ticks all show on a wide chart, every other one, newest kept, on a phone', () => {
  assertEquals(thinTicks(weeks, 120), weeks);
  assertEquals(thinTicks(weeks, 40), ['', '21 Sept', '', '5 Oct', '', '19 Oct', '', '2 Nov']);
});

Deno.test('ticks a caller already thinned are spaced by their own gap', () => {
  const days = ['Mo', '', 'We', '', 'Fr', '', 'Su'];
  assertEquals(thinTicks(days, 20), days);
  assertEquals(thinTicks(days, 8), ['', '', 'We', '', '', '', 'Su']);
});
