// Job 32b (Spec #8 AC10): the MCP and voice/Siri add paths add an item whose spelling variant or
// synonym is already open, and report the open one; nothing is dropped or merged. Also checks
// public.merge_quantities against the case table the app's mirror is tested with
// (supabase/tests/merge_quantities.tsv). Runs like add_paths_integration_test.ts: the db gate
// sets FG_DB_TEST=1 and SUPABASE_DB_URL; skipped without them.
import { assertEquals } from '@std/assert';
import postgres from 'postgres';
import { asUser } from './db.ts';
import { addItems as mcpAddItems } from '../mcp/list.ts';
import { addItems as voiceAddItems } from '../voice/items.ts';
import { confirmation } from '../voice/handler.ts';

const enabled = Deno.env.get('FG_DB_TEST') === '1';

async function withHousehold(work: (userId: string, householdId: string) => Promise<void>) {
  const admin = postgres(Deno.env.get('SUPABASE_DB_URL')!, { max: 1, prepare: false });
  const userId = crypto.randomUUID();
  try {
    await admin`insert into auth.users (id, email) values (${userId}, ${`${userId}@fg-test.invalid`})`;
    const householdId = await asUser(userId, async (tx) => {
      const [row] = await tx<{ id: string }[]>`select id from public.create_household('32b')`;
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

const openItems = (userId: string, householdId: string) =>
  asUser(userId, (tx) =>
    tx<{ name: string; quantity: string | null }[]>`
      select name, quantity from public.items
      where household_id = ${householdId} and status = 'active' order by created_at, name`);

Deno.test({
  name: 'MCP add_items adds Karotten with Möhren open and reports Möhren under similarOnList',
  ignore: !enabled,
  sanitizeResources: false,
  fn: () =>
    withHousehold(async (userId, householdId) => {
      await asUser(userId, (tx) =>
        tx`insert into public.items (household_id, name, quantity) values (${householdId}, 'Möhren', '500 g')`);
      const result = await asUser(
        userId,
        (tx) =>
          mcpAddItems(tx, householdId, [{ name: 'Karotten', quantity: '1 kg' }, { name: 'Milch' }]),
      );
      assertEquals(
        result.added.map((i) =>
          i.name
        ),
        ['Karotten', 'Milch'],
      );
      assertEquals(result.alreadyOnList, []);
      assertEquals(
        result.similarOnList.map((s) => [s.added, s.onList.map((i) => [i.name, i.quantity])]),
        [['Karotten', [['Möhren', '500 g']]]],
      );
      assertEquals([...await openItems(userId, householdId)], [
        { name: 'Möhren', quantity: '500 g' },
        { name: 'Karotten', quantity: '1 kg' },
        { name: 'Milch', quantity: null },
      ]);
    }),
});

Deno.test({
  name: 'voice and Siri add Karotten with Möhren open and say Möhren is on the list',
  ignore: !enabled,
  sanitizeResources: false,
  fn: () =>
    withHousehold(async (userId, householdId) => {
      await asUser(userId, (tx) =>
        tx`insert into public.items (household_id, name) values (${householdId}, 'Möhren')`);
      const added = await asUser(
        userId,
        (tx) =>
          voiceAddItems(tx, householdId, [
            { name: 'Karotten', quantity: '500 g' },
            { name: 'Möhren', quantity: null },
          ]),
      );
      assertEquals(
        added.map((a) => [a.name, a.alreadyOnList, a.similarOnList]),
        [['Karotten', false, ['Möhren']], ['Möhren', true, []]],
      );
      assertEquals(
        confirmation(added),
        'Hinzugefügt: 500 g Karotten. Schon auf der Liste: Möhren. Möhren steht schon auf der Liste.',
      );
      assertEquals(
        (await openItems(userId, householdId)).map((i) =>
          i.name
        ),
        ['Möhren', 'Karotten'],
      );
    }),
});

Deno.test({
  name: 'merge_quantities gives what supabase/tests/merge_quantities.tsv says',
  ignore: !enabled,
  sanitizeResources: false,
  fn: async () => {
    const table = await Deno.readTextFile(
      new URL('../../tests/merge_quantities.tsv', import.meta.url),
    );
    const rows = table.split('\n').filter((l) => l.trim() && !l.startsWith('#')).map((l) =>
      l.split('\t')
    );
    const db = postgres(Deno.env.get('SUPABASE_DB_URL')!, { max: 1, prepare: false });
    try {
      for (const [open, other, merged] of rows) {
        let got: string;
        try {
          const [row] = await db<{ q: string }[]>`
            select public.merge_quantities(${open || null}, ${other || null}) as q`;
          got = row.q;
        } catch (e) {
          got = String(e).includes('merged_quantity_too_long') ? '!too_long' : String(e);
        }
        assertEquals([open, other, got], [open, other, merged]);
      }
    } finally {
      await db.end();
    }
  },
});
