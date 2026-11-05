// Job 111: in-app dictation (mode parse with split) splits brand, details and store off a dictated
// item the way public.add_item splits a typed or Siri-added one. Runs voice/items.ts as a signed-in
// user against the local stack; the db gate sets FG_DB_TEST=1 and SUPABASE_DB_URL. Skipped without
// FG_DB_TEST.
import { assertEquals } from '@std/assert';
import postgres from 'postgres';
import { asUser } from '../_shared/db.ts';
import type { SplitItem } from './handler.ts';
import { addItems, splitItems } from './items.ts';
import { parseSentence } from './parse.ts';

const enabled = Deno.env.get('FG_DB_TEST') === '1';

async function withHousehold(work: (userId: string, householdId: string) => Promise<void>) {
  const admin = postgres(Deno.env.get('SUPABASE_DB_URL')!, { max: 1, prepare: false });
  const userId = crypto.randomUUID();
  try {
    await admin`insert into auth.users (id, email) values (${userId}, ${`${userId}@fg-test.invalid`})`;
    const householdId = await asUser(userId, async (tx) => {
      const [row] = await tx<{ id: string }[]>`select id from public.create_household('111')`;
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

const said = 'Windeln Pampers Größe 3, zwei Liter Milch und Klopapier Zewa 16 Rollen';

Deno.test({
  name: 'a dictated item gets the brand, details and store a typed or Siri add gets',
  ignore: !enabled,
  sanitizeResources: false,
  fn: () =>
    withHousehold(async (userId, householdId) => {
      const dm = await asUser(userId, async (tx) => {
        const [row] = await tx<{ id: string }[]>`
          insert into public.stores (household_id, name, seed_key, sort_order)
          values (${householdId}, 'dm', 'dm', 1)
          returning id`;
        return row.id;
      });
      const heard = parseSentence(said, 30);
      const split = await asUser(userId, (tx) => splitItems(tx, householdId, heard));
      assertEquals(split, [
        { name: 'Windeln', brand: 'Pampers', properties: 'Größe 3', quantity: null, storeId: dm },
        { name: 'Milch', brand: null, properties: null, quantity: '2 l', storeId: null },
        {
          name: 'Klopapier',
          brand: 'Zewa',
          properties: null,
          quantity: '16 Rollen',
          storeId: null,
        },
      ]);
      await asUser(userId, (tx) => addItems(tx, householdId, heard));
      const stored = await asUser(userId, (tx) =>
        tx<SplitItem[]>`
          select name, brand, properties, quantity, store_id as "storeId" from public.items
          where household_id = ${householdId}`);
      const byName = (a: SplitItem, b: SplitItem) => a.name.localeCompare(b.name);
      assertEquals([...stored].sort(byName), [...split].sort(byName));
    }),
});
