import { assert, assertEquals, assertMatch, assertRejects } from '@std/assert';
import { FgError } from './core.ts';
import { realShell } from './fg.ts';
import { expectedCounts, listScenarios, loadScenario, parseScenario, plan, resolveTime } from './scenario.ts';

const repo = new URL('../../../../', import.meta.url).pathname.replace(/\/$/, '');
const parse = (yaml: string, file = 'test/fixtures/scenarios/tt.yaml') => parseScenario(realShell, repo, file, yaml);

async function problems(yaml: string): Promise<string> {
  const e = await assertRejects(() => parse(yaml), FgError);
  assertEquals(e.code, 'bad_scenario');
  return e.message;
}

Deno.test('every shipped scenario validates and the required ones exist', async () => {
  const names = (await listScenarios(realShell, repo)).map((s) => s.name);
  for (
    const n of [
      'empty-new-user',
      'solo-long-list',
      'household-3-mid-shop',
      'heavy-history',
      'many-stores',
      'edge-cases',
      'pending-invite',
      'h-list-walk',
    ]
  ) {
    assert(names.includes(n), `${n} is shipped`);
  }
});

Deno.test('shipped scenarios have the shape their summary promises', async () => {
  const now = new Date('2026-10-25T10:00:00Z');
  const counts = async (n: string) => expectedCounts(plan(await loadScenario(realShell, repo, n), now));
  assertEquals((await counts('empty-new-user')).withoutHousehold, 1);
  assert((await counts('solo-long-list')).households.home.activeItems >= 60);
  const mid = await counts('household-3-mid-shop');
  assertEquals(mid.households.home.members, 3);
  assert(mid.households.home.boughtItems > 0 && mid.households.home.activeItems > 0, 'partly ticked');
  assert((await counts('many-stores')).households.home.stores >= 8);
  const walk = await counts('h-list-walk');
  assertEquals([walk.households.home.stores, walk.households.home.activeItems], [3, 14]);
  const invite = await counts('pending-invite');
  assertEquals(invite.households.home.openInvites, 1);
  assertEquals(invite.withoutHousehold, 1);
  const edge = plan(await loadScenario(realShell, repo, 'edge-cases'), now);
  assert(edge.households[0].items.some((i) => [...i.name].length === 120), 'a 120-character name');
  assertEquals(new Set(edge.users.map((u) => u.locale)), new Set(['de', 'en']));
});

Deno.test('a wrong field is named with its path', async () => {
  const base = 'name: tt\nsummary: A scenario for the tests.\nusers:\n  - { handle: anna, name: Anna }\n';
  assertMatch(
    await problems(base + 'households:\n  - { name: H, members: [anna], items: [{ name: X, quantity: 3 }] }\n'),
    /households\[0\]\.items\[0\]\.quantity: must be string/,
  );
  assertMatch(
    await problems(base + 'households:\n  - { name: H, members: [anna], items: [{ name: X, colour: red }] }\n'),
    /households\[0\]\.items\[0\]\.colour: unknown field/,
  );
  assertMatch(await problems(base.replace('handle: anna, ', '')), /users\[0\]\.handle: is required/);
  assertMatch(await problems(base.replace('Anna }', 'Anna, locale: fr }')), /users\[0\]\.locale: must be one of de, en/);
  assertMatch(
    await problems(base + 'households:\n  - { name: H, members: [anna], history: [{ at: "-0d 18:00", items: [X] }] }\n'),
    /households\[0\]\.history\[0\]\.at/,
  );
});

Deno.test('cross references are checked: members, stores, categories, reserved handles, file name', async () => {
  const base = 'name: tt\nsummary: A scenario for the tests.\nusers:\n  - { handle: anna, name: Anna }\n  - { handle: ben, name: Ben }\n';
  assertMatch(
    await problems(base + 'households:\n  - { name: H, members: [anna, carl] }\n'),
    /households\[0\]\.members\[1\]: no user "carl"/,
  );
  assertMatch(
    await problems(base + 'households:\n  - { name: H, members: [anna], items: [{ name: X, by: ben }] }\n'),
    /items\[0\]\.by: "ben" is not a member/,
  );
  assertMatch(
    await problems(base + 'households:\n  - { name: H, members: [anna], items: [{ name: X, store: Aldi }] }\n'),
    /items\[0\]\.store: no store "Aldi"/,
  );
  assertMatch(
    await problems(base + 'households:\n  - { name: H, members: [anna], items: [{ name: X, category: Bücher }] }\n'),
    /items\[0\]\.category: no category "Bücher"/,
  );
  assertMatch(
    await problems(base + 'households:\n  - { name: H, members: [anna] }\n  - { name: G, members: [anna] }\n'),
    /households\[1\]\.members\[0\]: "anna" is already in households\[0\]/,
  );
  assertMatch(await problems(base.replace('handle: anna', 'handle: peter')), /users\[0\]\.handle: "peter" is reserved/);
  assertMatch(
    await problems(base + 'households:\n  - { name: H, members: [anna], history: [{ at: "-2d", times: 3, items: [X] }] }\n'),
    /history\[0\]\.every: needed/,
  );
  assertMatch(
    await problems(base + 'households:\n  - { name: H, members: [anna] }\nexpect:\n  due: { home: [Milch] }\n'),
    /expect\.due\.home\[0\]: "Milch" is never bought/,
  );
  assertMatch(await problems(base + 'views:\n  ben: { store: Lidl }\n'), /views\.ben\.store: "ben" is in no household/);
  assertMatch(await problems(base.replace('name: tt', 'name: other')), /name: "other" must match the file name "tt"/);
  assertMatch(await problems('name: tt\nsummary: [unclosed\n'), /not valid YAML/);
});

Deno.test('relative times: offsets, Berlin wall clock across DST, always in the past', () => {
  const now = new Date('2026-10-25T10:00:00Z'); // 11:00 in Berlin, the first day of winter time
  assertEquals(resolveTime('-2h', now).toISOString(), '2026-10-25T08:00:00.000Z');
  assertEquals(resolveTime('-90m', now).toISOString(), '2026-10-25T08:30:00.000Z');
  assertEquals(resolveTime('-1d 18:10', now).toISOString(), '2026-10-24T16:10:00.000Z', 'summer time: UTC+2');
  assertEquals(resolveTime('-7d 18:10', now).toISOString(), '2026-10-18T16:10:00.000Z');
  assertEquals(resolveTime('-1d 18:10', new Date('2026-10-27T10:00:00Z')).toISOString(), '2026-10-26T17:10:00.000Z', 'winter: UTC+1');
  // Just after midnight in Berlin, "-1d 23:59" is yesterday, still in the past.
  const lateNight = new Date('2026-10-26T23:05:00Z'); // 00:05 on the 27th in Berlin
  assert(resolveTime('-1d 23:59', lateNight) < lateNight);
});

Deno.test('repeated trips keep their wall-clock time and come out oldest first', async () => {
  const s = await loadScenario(realShell, repo, 'heavy-history');
  const trips = plan(s, new Date('2026-11-10T12:00:00Z')).households[0].trips;
  assertEquals(trips.length, 8 + 8 + 4 + 1);
  for (let i = 1; i < trips.length; i++) assert(trips[i - 1].at <= trips[i].at, 'oldest first');
  const edeka = trips.filter((t) => t.store === 'Edeka');
  const berlin = (d: Date) => new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(d);
  assertEquals(new Set(edeka.map((t) => berlin(t.at))), new Set(['17:30']), 'same wall clock before and after the DST change');
});

Deno.test('heavy-history due margins hold at any time of day', async () => {
  // suggest_items marks due when purchases >= 2 and gap <= days since last <= 4 * gap.
  const s = await loadScenario(realShell, repo, 'heavy-history');
  for (let hour = 0; hour < 24; hour++) {
    const now = new Date(Date.UTC(2026, 10, 10, hour, 30));
    const trips = plan(s, now).households[0].trips;
    for (const [store, gap, due] of [['Edeka', 7, true], ['Lidl', 7, false], ['dm', 14, true]] as const) {
      const last = trips.filter((t) => t.store === store).at(-1)!;
      const days = (now.getTime() - last.at.getTime()) / 86_400_000;
      assertEquals(days >= gap && days <= 4 * gap, due, `${store} at ${hour}:30 UTC: ${days.toFixed(2)} days`);
    }
  }
});
