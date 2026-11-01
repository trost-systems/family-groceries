// Job 64: two members adding the same item at the same moment leave one open row. Each member
// writes on its own connection, as two phones do through PostgREST: the first insert stays
// uncommitted while the second one is sent. Runs like add_paths_integration_test.ts: the db gate
// sets FG_DB_TEST=1 and SUPABASE_DB_URL; skipped without them.
import { assertEquals } from '@std/assert';
import postgres from 'postgres';

const enabled = Deno.env.get('FG_DB_TEST') === '1';
const url = () => Deno.env.get('SUPABASE_DB_URL')!;

type Sql = postgres.Sql;
type Member = { id: string; sql: Sql };

async function withCouple(work: (anna: Member, ben: Member, householdId: string) => Promise<void>) {
  const admin = postgres(url(), { max: 1, prepare: false });
  const anna = { id: crypto.randomUUID(), sql: postgres(url(), { max: 1, prepare: false }) };
  const ben = { id: crypto.randomUUID(), sql: postgres(url(), { max: 1, prepare: false }) };
  try {
    for (const m of [anna, ben]) {
      await admin`insert into auth.users (id, email) values (${m.id}, ${`${m.id}@fg-test.invalid`})`;
    }
    const householdId = await as(anna, async (tx) => {
      const [row] = await tx<{ id: string }[]>`select id from public.create_household('64')`;
      return row.id;
    });
    await admin`insert into public.household_members (household_id, user_id, role)
      values (${householdId}, ${ben.id}, 'member')`;
    await work(anna, ben, householdId);
  } finally {
    await admin`delete from public.households where id in (
      select household_id from public.household_members where user_id = ${anna.id})`;
    await admin`delete from auth.users where id in (${anna.id}, ${ben.id})`;
    await Promise.all([admin.end(), anna.sql.end(), ben.sql.end()]);
  }
}

function as<T>(m: Member, work: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  const claims = JSON.stringify({ sub: m.id, role: 'authenticated' });
  return m.sql.begin(async (tx) => {
    await tx`select set_config('role', 'authenticated', true),
                    set_config('request.jwt.claims', ${claims}, true)`;
    return await work(tx);
  }) as Promise<T>;
}

/** The app's add: an upsert of a client-made id that ignores an existing id. */
const appAdd = (
  tx: postgres.TransactionSql,
  householdId: string,
  name: string,
  extra: Record<string, string> = {},
) =>
  tx<{ id: string }[]>`
    insert into public.items ${
    tx({ id: crypto.randomUUID(), household_id: householdId, name, ...extra })
  }
    on conflict (id) do nothing returning id`;

const pause = () => new Promise((r) => setTimeout(r, 300));

/** [first] holds its transaction open until [second] was sent and had time to run. */
async function overlapping<A, B>(
  first: (release: Promise<void>) => Promise<A>,
  second: () => Promise<B>,
) {
  let release!: () => void;
  const a = first(new Promise<void>((resolve) => (release = resolve)));
  await pause();
  const b = second();
  await pause();
  release();
  return [await a, await b] as const;
}

const openRows = (m: Member, householdId: string) =>
  as(
    m,
    (tx) =>
      tx<{ name: string; brand: string | null; properties: string | null; added_by: string }[]>`
      select name, brand, properties, added_by from public.items
      where household_id = ${householdId} and status = 'active' order by created_at, name`,
  );

Deno.test({
  name: 'two members adding Milch at the same moment leave one open Milch, the first one',
  ignore: !enabled,
  sanitizeResources: false,
  fn: () =>
    withCouple(async (anna, ben, householdId) => {
      const [annas, bens] = await overlapping(
        (release) =>
          as(anna, async (tx) => {
            const rows = await appAdd(tx, householdId, 'Milch');
            await release;
            return rows;
          }),
        () => as(ben, (tx) => appAdd(tx, householdId, ' milch ')),
      );
      assertEquals([annas.length, bens.length], [1, 0], "Anna's add lands, Ben's gets no row back");
      assertEquals((await openRows(ben, householdId)).map((r) => [r.name, r.added_by]), [[
        'Milch',
        anna.id,
      ]]);
    }),
});

Deno.test({
  name: 'add_item (MCP, Siri, Alexa) racing the app returns the open row instead of a second one',
  ignore: !enabled,
  sanitizeResources: false,
  fn: () =>
    withCouple(async (anna, ben, householdId) => {
      const [annas, bens] = await overlapping(
        (release) =>
          as(anna, async (tx) => {
            const rows = await appAdd(tx, householdId, 'Eier');
            await release;
            return rows;
          }),
        () =>
          as(ben, (tx) =>
            tx<{ id: string }[]>`select id from public.add_item(${householdId}, 'Eier')`),
      );
      assertEquals(
        bens.map((r) =>
          r.id
        ),
        annas.map((r) => r.id),
      );
      assertEquals((await openRows(anna, householdId)).length, 1);
    }),
});

Deno.test({
  name:
    'details in any order are the same item; another size, a ticked copy or another brand are not',
  ignore: !enabled,
  sanitizeResources: false,
  fn: () =>
    withCouple(async (anna, ben, householdId) => {
      await as(anna, (tx) =>
        appAdd(tx, householdId, 'Windeln', { brand: 'Pampers', properties: 'Größe 3, sensitiv' }));
      assertEquals(
        (await as(ben, (tx) =>
          appAdd(tx, householdId, 'windeln', { brand: 'pampers', properties: 'Sensitiv,Größe 3' })))
          .length,
        0,
        'the same diapers in other words',
      );
      for (
        const extra of [{ brand: 'Pampers', properties: 'Größe 4' }, {
          brand: 'Huggies',
          properties: 'Größe 3',
        }]
      ) {
        assertEquals(
          (await as(ben, (tx) =>
            appAdd(tx, householdId, 'Windeln', extra))).length,
          1,
          JSON.stringify(extra),
        );
      }
      await as(anna, (tx) =>
        tx`insert into public.items (household_id, name, status) values (${householdId}, 'Brot', 'bought')`);
      assertEquals(
        (await as(ben, (tx) =>
          appAdd(tx, householdId, 'Brot'))).length,
        1,
        'a ticked Brot does not block a new one',
      );
      assertEquals((await openRows(anna, householdId)).length, 4);
    }),
});
