import { assertEquals, assertThrows } from '@std/assert';
import { parsePulls, pullsOf } from '../pipeline/github.ts';

const pull = (title: string, isDraft: boolean): unknown => ({
  number: 1,
  url: 'https://github.com/trost-systems/family-groceries/pull/1',
  title,
  state: 'OPEN',
  isDraft,
  headRefName: 'job/1-x',
  createdAt: '2026-11-06T09:00:00Z',
  mergedAt: null,
});

Deno.test('a PR is not for merge when it is a draft or its title says so, in any case', () => {
  const cases: [string, boolean, boolean][] = [
    ['Store rating: native prompt after a completed trip', false, false],
    ['Store rating: native prompt after a completed trip', true, true],
    ['hc(hc-web-bundle): first load 3.94 -> 3.10 MB [DO NOT MERGE]', false, true],
    ['hc(hc-memory): Linux app memory 413.7 -> 381.0 (DO NOT MERGE)', false, true],
    ['hc(hc-memory): Linux app memory 413.7 -> 381.0 (DO NOT MERGE', false, true],
    ['Sync indicator prototypes S1-S5 (NOT FOR MERGE)', false, true],
    ['Job 84: store screenshots in frame P2 (not for merge)', false, true],
    ['Job 81: paywall prototypes (preview, not for merge)', false, true],
    ['Merge the donot-merge-list helper', false, false],
  ];
  for (const [title, isDraft, want] of cases) {
    assertEquals(parsePulls([pull(title, isDraft)], [])[0]?.notForMerge, want, `${title} draft=${isDraft}`);
  }
});

Deno.test('a pull without isDraft is rejected at the boundary', () => {
  const { isDraft: _, ...rest } = pull('t', false) as Record<string, unknown>;
  assertThrows(() => parsePulls([rest], []), Error, 'isDraft');
});

Deno.test('a PR in both lists counts once, as its finished record', () => {
  const merged = {
    ...(pull('t', false) as Record<string, unknown>),
    state: 'MERGED',
    mergedAt: '2026-11-06T10:00:00Z',
  };
  const prs = pullsOf([pull('t', false)], [merged], []);
  assertEquals(prs.map((p) => [p.number, p.state]), [[1, 'merged']]);
});
