import { assert, assertEquals, assertExists, assertMatch, assertThrows } from '@std/assert';
import type { JsonObject } from './core.ts';
import { realShell } from './fg.ts';
import {
  checkRunId,
  emailFor,
  type Manifest,
  newFixtureRunId,
  publicView,
  runOfEmail,
  runUserIds,
  splitHouseholds,
  verifyRun,
} from './fixtures.ts';
import { expectedCounts, parseScenario, plan } from './scenario.ts';
import type { Api } from './target.ts';

Deno.test('run ids are short, valid and land in the test email domain', () => {
  const run = newFixtureRunId(new Date(2026, 9, 25, 14, 32));
  assertMatch(run, /^fx-1025-1432-[a-z2-9]{4}$/);
  assertEquals(checkRunId(run), run);
  assertEquals(emailFor('mia', run), `mia.${run}@fg-test.invalid`);
  assertEquals(runOfEmail(emailFor('mia', run)), run);
  assertEquals(runOfEmail('peter@fg.test'), null, 'baseline users belong to no run');
  assertEquals(runOfEmail(`mia.${run}@example.com`), null, 'outside the test domain');
  assertThrows(() => checkRunId('../etc'));
  assertThrows(() => checkRunId('Fx'));
});

const user = (id: string, email: string, fg_run?: string) => ({
  id,
  email,
  app_metadata: (fg_run ? { fg_run } : {}) as Record<string, string>,
});
const manifest = (users: string[]) => ({ created: { users } }) as unknown as Manifest;

Deno.test('teardown picks the run users by tag, address or manifest, never a non-test account', () => {
  const users = [
    user('a', 'mia.r1@fg-test.invalid', 'r1'),
    user('b', 'noah.r1@fg-test.invalid'), // tag lost: found by address
    user('c', 'ida.r2@fg-test.invalid', 'r2'), // another run
    user('d', 'peter@fg.test'), // baseline
    user('e', 'real@example.com', 'r1'), // a real account somehow tagged: never
    user('f', 'x.other@fg-test.invalid'), // listed in the manifest only
  ];
  assertEquals(runUserIds('r1', manifest(['f', 'd']), users).sort(), ['a', 'b', 'f']);
  assertEquals(runUserIds('r1', null, users).sort(), ['a', 'b']);
  assertEquals(runUserIds('r3', null, users), []);
});

Deno.test('a household goes only when all its members are the run users', () => {
  const { deletable, kept } = splitHouseholds(
    ['a', 'b'],
    new Map([
      ['h1', ['a', 'b']],
      ['h2', ['a', 'peter']], // someone else joined: keep, only a leaves
      ['h3', []], // members already gone: delete
    ]),
  );
  assertEquals(deletable, ['h1', 'h3']);
  assertEquals(kept, ['h2']);
});

Deno.test('the printed view of a run carries no password', () => {
  const m = {
    run: 'r1',
    scenario: 's',
    target: 'local',
    createdAt: '',
    users: {
      mia: {
        handle: 'mia',
        id: 'a',
        email: 'mia.r1@fg-test.invalid',
        password: 'hunter2-secret',
        name: 'Mia',
        locale: 'de',
        household: 'home',
      },
    },
    households: {},
    invites: [],
    views: {},
  } as unknown as Manifest;
  const text = JSON.stringify(publicView(m));
  assert(!text.includes('hunter2-secret'));
  assert(text.includes('r1:mia'));
});

Deno.test('verifyRun counts more rows than PostgREST returns (max_rows 1000)', async () => {
  const repo = new URL('../../../../', import.meta.url).pathname.replace(/\/$/, '');
  const scenario = await parseScenario(
    realShell,
    repo,
    'test/fixtures/scenarios/tt.yaml',
    `name: tt
summary: One member who bought 20 items on 55 days, 1,100 bought rows.
users: [{ handle: ann, name: Ann }]
households:
  - name: Haus
    members: [ann]
    items: [Brot]
    history:
      - { at: "-1d 10:00", every: 1d, times: 55, items: [${Array.from({ length: 20 }, (_, i) => `Ding${i}`).join(', ')}] }
`,
  );
  const p = plan(scenario, new Date('2026-11-05T12:00:00Z'));
  const want = expectedCounts(p).households['home'];
  assertExists(want);
  assertEquals(want.boughtItems, 1100);
  const hid = 'h1';
  const many = (n: number, row: JsonObject) => Array.from({ length: n }, () => ({ household_id: hid, ...row }));
  const tables: Record<string, JsonObject[]> = {
    'household_members': many(want.members, {}),
    items: [...many(want.activeItems, { status: 'active' }), ...many(want.boughtItems, { status: 'bought' })],
    stores: many(want.stores, {}),
    categories: many(want.categories, {}),
    invites: [],
    households: [{ id: hid }],
  };
  const matches = (row: JsonObject, query: string) =>
    query.split('&').filter((f) => f.includes('=') && !f.startsWith('select=') && !f.startsWith('limit=')).every((f) => {
      const [col = '', cond = ''] = f.split('=');
      const [op, value] = [cond.slice(0, cond.indexOf('.')), cond.slice(cond.indexOf('.') + 1)];
      if (op === 'eq') return String(row[col]) === value;
      if (op === 'neq') return String(row[col]) !== value;
      return true;
    });
  const tableOf = (name: string | undefined): JsonObject[] => {
    const rows = name === undefined ? undefined : tables[name];
    if (rows === undefined) throw new Error(`no table ${name}`);
    return rows;
  };
  const api = {
    count: (table: string, filter: string) => Promise.resolve(tableOf(table).filter((r) => matches(r, filter)).length),
    rest: (path: string) => {
      const [table, query] = path.split('?');
      return Promise.resolve(tableOf(table).filter((r) => matches(r, query ?? '')).slice(0, 1000));
    },
    rpc: () => Promise.resolve([]),
  } as unknown as Api;
  const manifest = { households: { home: { id: hid, name: 'Haus', members: ['ann'] } } } as unknown as Manifest;
  const checks = await verifyRun(api, manifest, p, { ann: 'token' });
  assertEquals(checks.filter((c) => !c.ok), []);
  assertEquals(checks.find((c) => c.name === 'home: bought items')?.actual, 1100);
});
