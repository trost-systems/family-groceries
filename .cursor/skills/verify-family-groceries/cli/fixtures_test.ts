import { assert, assertEquals, assertMatch, assertThrows } from '@std/assert';
import { checkRunId, emailFor, type Manifest, newFixtureRunId, publicView, runOfEmail, runUserIds, splitHouseholds } from './fixtures.ts';

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
