// Job 62: list_items reports the whole list's counts next to the items, whatever the filter, and
// only the caller's household. Runs mcp/list.ts as a signed-in user against the local stack
// (FG_DB_TEST=1, see _shared/add_paths_integration_test.ts).
import { assertEquals } from '@std/assert';
import postgres from 'postgres';
import { asUser } from '../_shared/db.ts';
import { addItems, listItems, tickItems } from './list.ts';

const enabled = Deno.env.get('FG_DB_TEST') === '1';

Deno.test({
  name: 'list_items counts open and recently ticked items of the whole list, per household',
  ignore: !enabled,
  sanitizeResources: false,
  fn: async () => {
    const admin = postgres(Deno.env.get('SUPABASE_DB_URL')!, { max: 1, prepare: false });
    const users = [crypto.randomUUID(), crypto.randomUUID()];
    try {
      const households: string[] = [];
      for (const user of users) {
        await admin`insert into auth.users (id, email) values (${user}, ${`${user}@fg-test.invalid`})`;
        households.push(
          await asUser(user, async (tx) => {
            const [row] = await tx<{ id: string }[]>`select id from public.create_household('62')`;
            return row.id;
          }),
        );
      }
      const [mine, theirs] = households;
      await asUser(users[1], (tx) => addItems(tx, theirs, [{ name: 'Brot' }, { name: 'Käse' }]));

      await asUser(users[0], async (tx) => {
        const empty = await listItems(tx, mine, {});
        assertEquals(empty.counts, { open: 0, checkedLast24h: 0 });

        await addItems(tx, mine, [
          { name: 'Milch' },
          { name: 'Zahnpasta', store: 'dm' },
          { name: 'Äpfel' },
          { name: 'Butter' },
          { name: 'Salz' },
        ]);
        await tickItems(tx, mine, ['Butter', 'Salz']);
      });
      await admin`update public.items set bought_at = now() - interval '2 days'
                  where household_id = ${mine} and name = 'Salz'`;

      await asUser(users[0], async (tx) => {
        const all = await listItems(tx, mine, {});
        assertEquals(all.items.length, 3);
        assertEquals(all.counts, { open: 3, checkedLast24h: 1 }, 'Salz was ticked two days ago');

        const lidl = await listItems(tx, mine, { store: 'Lidl' });
        assertEquals(lidl.items.map((i) => i.name).sort(), ['Milch', 'Äpfel']);
        assertEquals(lidl.counts, all.counts, 'a store filter keeps the whole list counts');

        const fruit = await listItems(tx, mine, { category: 'Obst' });
        assertEquals(fruit.items.map((i) => i.name), ['Äpfel']);
        assertEquals(fruit.counts.open, 3);
      });

      await asUser(users[1], async (tx) => {
        assertEquals((await listItems(tx, theirs, {})).counts, { open: 2, checkedLast24h: 0 });
        assertEquals(
          (await listItems(tx, mine, {})).counts,
          { open: 0, checkedLast24h: 0 },
          "RLS hides another household's items from the counts too",
        );
      });
    } finally {
      for (const user of users) {
        await admin`delete from public.households where id in (
          select household_id from public.household_members where user_id = ${user})`;
        await admin`delete from auth.users where id = ${user}`;
      }
      await admin.end();
    }
  },
});
