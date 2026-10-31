import { assertEquals, assertThrows } from 'jsr:@std/assert@^1';
import { literal, parseArgs, type Query, run } from './testers.ts';

const ID = '00000000-0000-4000-8000-0000000043d1';

/** Answers like the database: one account, on the tester list ([listed]: grants, used) or not. */
function fakeDb(listed: { grants: number; used: number } | null) {
  const sent: string[] = [];
  const query: Query = (sql) => {
    sent.push(sql);
    if (sql.includes('from auth.users')) {
      return Promise.resolve(sql.includes("'dana@example.com'") ? [{ id: ID }] : []);
    }
    if (sql.includes('where t.user_id =')) return Promise.resolve(listed ? [listed] : []);
    return Promise.resolve([]);
  };
  return { query, sent, writes: () => sent.filter((s) => /^\s*(insert|update|delete)/.test(s)) };
}

Deno.test('add is a dry run until --apply, with one grant by default', async () => {
  const db = fakeDb(null);
  assertEquals(await run(db.query, parseArgs(['add', '--email', 'dana@example.com'])), [
    `dry run, would add ${ID} with 1 grant(s) (add --apply to do it)`,
  ]);
  assertEquals(db.writes(), []);
  const go = parseArgs([
    'add',
    '--email',
    'dana@example.com',
    '--grants',
    '2',
    '--note',
    "Dana's TestFlight",
    '--apply',
  ]);
  assertEquals(await run(db.query, go), [`add ${ID} with 2 grant(s)`]);
  assertEquals(db.writes().length, 1);
  assertEquals(db.writes()[0].includes(`'Dana''s TestFlight'`), true);
  assertEquals(db.writes()[0].includes(', 2, '), true);
  assertEquals(db.sent.some((s) => s.includes('email') && s.includes('insert')), false);
});

Deno.test('set-grants raises or lowers a count; given unlocks stay', async () => {
  const db = fakeDb({ grants: 2, used: 2 });
  const lower = parseArgs(['set-grants', '--email', 'dana@example.com', '--grants', '1']);
  assertEquals(await run(db.query, lower), [
    `dry run, would set ${ID} from 2 to 1 grant(s); the 2 unlock(s) already given stay (add --apply to do it)`,
  ]);
  assertEquals(db.writes(), []);
  const raise = parseArgs([
    'set-grants',
    '--email',
    'dana@example.com',
    '--grants',
    '5',
    '--apply',
  ]);
  assertEquals(await run(db.query, raise), [`set ${ID} from 2 to 5 grant(s)`]);
  assertEquals(db.writes(), [
    `update public.lifetime_testers set grants = 5 where user_id = '${ID}'::uuid`,
  ]);
  assertThrows(() => parseArgs(['set-grants', '--email', 'dana@example.com']));
});

Deno.test('remove only removes a listed tester, and only with --apply', async () => {
  assertEquals(
    await run(fakeDb(null).query, parseArgs(['remove', '--email', 'dana@example.com', '--apply'])),
    [`${ID} is not a tester; nothing changed`],
  );
  const db = fakeDb({ grants: 1, used: 1 });
  await run(db.query, parseArgs(['remove', '--email', 'dana@example.com']));
  assertEquals(db.writes(), []);
  assertEquals(
    await run(db.query, parseArgs(['remove', '--email', 'dana@example.com', '--apply'])),
    [
      `remove ${ID}; the 1 unlock(s) already given stay, without the tester mark`,
    ],
  );
  // The plain delete: the trigger lifetime_testers_removed clears entitlements.tester (H-72;
  // supabase/tests/household_bound.test.sql runs the same delete against the database).
  assertEquals(db.writes(), [`delete from public.lifetime_testers where user_id = '${ID}'::uuid`]);
});

Deno.test('an unknown e-mail changes nothing', async () => {
  const db = fakeDb(null);
  assertEquals(
    await run(db.query, parseArgs(['add', '--email', 'nobody@example.com', '--apply'])),
    [
      'no account with that e-mail; nothing changed',
    ],
  );
  assertEquals(db.writes(), []);
});

Deno.test('arguments: an e-mail or count that could break the SQL is refused', () => {
  for (const email of ["a'@b.de", 'a@b', 'a b@c.de', 'a$x@b.de', '']) {
    assertThrows(() => parseArgs(['add', '--email', email]));
  }
  for (const grants of ['-1', '101', '1; drop', '1.5', 'x']) {
    assertThrows(() => parseArgs(['add', '--email', 'a@b.de', '--grants', grants]));
  }
  assertThrows(() => parseArgs(['add', '--email', 'a@b.de', '--force']));
  assertThrows(() => parseArgs(['drop']));
  assertEquals(parseArgs(['list']), { action: 'list' });
  assertEquals(literal("it's"), "'it''s'");
});
