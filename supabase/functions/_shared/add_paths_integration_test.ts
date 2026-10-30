// Job 32a (Spec #8 AC7): the MCP and the voice/Siri add paths classify spelling variants, synonyms
// and typos through the shared database classifier, and keep the text as said or typed. Runs the
// functions' real add code (mcp/list.ts, voice/items.ts) as a signed-in user against a database
// with the repo's migrations: the db gate sets FG_DB_TEST=1 and SUPABASE_DB_URL to the local stack.
// Without FG_DB_TEST the tests are skipped (the functions gate has no database).
import { assertEquals } from '@std/assert';
import postgres from 'postgres';
import { asUser } from './db.ts';
import { addItems as mcpAddItems } from '../mcp/list.ts';
import { addItems as voiceAddItems } from '../voice/items.ts';

const enabled = Deno.env.get('FG_DB_TEST') === '1';

/** A user with a fresh household for one test, removed afterwards. */
async function withHousehold(work: (userId: string, householdId: string) => Promise<void>) {
  const admin = postgres(Deno.env.get('SUPABASE_DB_URL')!, { max: 1, prepare: false });
  const userId = crypto.randomUUID();
  try {
    await admin`insert into auth.users (id, email) values (${userId}, ${`${userId}@fg-test.invalid`})`;
    const householdId = await asUser(userId, async (tx) => {
      const [row] = await tx<{ id: string }[]>`select id from public.create_household('32a')`;
      return row.id;
    });
    await work(userId, householdId);
  } finally {
    await admin`delete from public.households where id in (
      select household_id from public.household_members where user_id = ${userId})`;
    await admin`delete from auth.users where id = ${userId}`;
    await admin.end();
  }
}

const variants = [
  ['Karrotten', 'Obst & Gemüse'],
  ['Paradeiser', 'Obst & Gemüse'],
  ['Schokolde', 'Süßes & Snacks'],
  ['Semmeln', 'Brot & Backwaren'],
  ['Mlich', 'Kühlregal'],
] as const;

Deno.test({
  name: 'MCP add_items classifies variants like the app and keeps the typed text',
  ignore: !enabled,
  sanitizeResources: false,
  fn: () =>
    withHousehold(async (userId, householdId) => {
      const { added } = await asUser(
        userId,
        (tx) => mcpAddItems(tx, householdId, variants.map(([name]) => ({ name }))),
      );
      assertEquals(added.map((i) => [i.name, i.category]), variants.map((v) => [...v]));
    }),
});

Deno.test({
  name: 'voice and Siri add classifies variants like the app and keeps the spoken text',
  ignore: !enabled,
  sanitizeResources: false,
  fn: () =>
    withHousehold(async (userId, householdId) => {
      const added = await asUser(
        userId,
        (tx) =>
          voiceAddItems(tx, householdId, variants.map(([name]) => ({ name, quantity: null }))),
      );
      assertEquals(added.map((i) => [i.name, i.category]), variants.map((v) => [...v]));
    }),
});

Deno.test({
  name: 'a correction made in the app holds for MCP adds of the variant',
  ignore: !enabled,
  sanitizeResources: false,
  fn: () =>
    withHousehold(async (userId, householdId) => {
      await asUser(userId, async (tx) => {
        await tx`insert into public.items (household_id, name) values (${householdId}, 'Möhren')`;
        await tx`update public.items set category_id = (
          select id from public.categories where household_id = ${householdId} and seed_key = 'drinks')
          where household_id = ${householdId} and name = 'Möhren'`;
      });
      const { added } = await asUser(
        userId,
        (tx) => mcpAddItems(tx, householdId, [{ name: 'Karotten' }]),
      );
      assertEquals(added.map((i) => [i.name, i.category]), [['Karotten', 'Getränke']]);
    }),
});
