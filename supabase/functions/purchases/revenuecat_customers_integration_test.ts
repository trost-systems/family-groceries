// Job 211: an account deleted while RevenueCat's webhook (or the app's note before Buy) records
// its id as a RevenueCat customer still gets its customer queued for deletion, whichever of the two
// transactions commits first. Two connections hold the two transactions open against a database
// with the repo's migrations. The db gate sets FG_DB_TEST=1 and SUPABASE_DB_URL; without them
// this is skipped.
import { assertEquals } from '@std/assert';
import postgres from 'postgres';
import { databaseUrl } from '../_shared/db.ts';

const enabled = Deno.env.get('FG_DB_TEST') === '1';
const connect = () => postgres(databaseUrl(), { max: 1, prepare: false, onnotice: () => {} });

/** A RevenueCat customer note for [user] inside the open transaction [tx]. */
type Note = (tx: postgres.TransactionSql, user: string) => Promise<unknown>;

/** RevenueCat ended a promotional grant the user never had here: its early return. */
const grantEnded: Note = (tx, user) =>
  tx`select public.promotional_premium_sync_user(${user}::uuid, false, null)`;

/** RevenueCat granted the user promotional premium: a row for the account. */
const granted: Note = (tx, user) =>
  tx`select public.promotional_premium_sync_user(${user}::uuid, true, null)`;

/** RevenueCat reported the user's first purchase: a purchase and an unlock for the account. */
const purchased: Note = (tx, user) => {
  const transaction = crypto.randomUUID();
  const hmac = `${transaction}${crypto.randomUUID()}`.replaceAll('-', '');
  return tx`select public.purchase_record_user('apple', ${transaction}, ${transaction},
    ${hmac}, 'com.snacklist.app.lifetime', 'premium', 'lifetime', 'Sandbox', now(), 29.99,
    'EUR', 'DE', ${user}::uuid)`;
};

/** The app, signed in as the user, right before Buy reaches RevenueCat. */
const app: Note = async (tx, user) => {
  await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: user })}, true)`;
  await tx`set local role authenticated`;
  await tx`select public.note_revenuecat_customer()`;
};

/** Resolves once the backend [pid] waits for a lock, or after 10 s (it never does). */
async function waitsForLock(sql: postgres.Sql, pid: number): Promise<boolean> {
  for (let i = 0; i < 200; i++) {
    const [row] = await sql<{ waiting: boolean }[]>`
      select wait_event_type = 'Lock' as waiting from pg_stat_activity where pid = ${pid}`;
    if (row?.waiting === true) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

async function pidOf(sql: postgres.Sql): Promise<number> {
  const [row] = await sql<{ pid: number }[]>`select pg_backend_pid() as pid`;
  if (row === undefined) throw new Error('no backend pid');
  return row.pid;
}

/**
 * Runs [first]'s transaction up to its commit, starts [second]'s, then commits the first and
 * awaits the second. Returns what is left of the account at RevenueCat's side: queued for deletion,
 * and an orphan marker.
 */
async function race(
  order: 'note first' | 'deletion first',
  note: Note,
): Promise<{ waited: boolean; queued: boolean; orphanMarker: boolean }> {
  const admin = connect();
  const noting = connect();
  const deleting = connect();
  const user = crypto.randomUUID();
  try {
    await admin`insert into auth.users (id, email) values (${user}, ${`${user}@fg-test.invalid`})`;
    const notingPid = await pidOf(noting);
    const deletingPid = await pidOf(deleting);
    const committed = Promise.withResolvers<void>();
    const firstReady = Promise.withResolvers<void>();
    const noteTx = (wait: boolean) =>
      noting.begin(async (tx) => {
        await note(tx, user);
        if (wait) {
          firstReady.resolve();
          await committed.promise;
        }
      });
    const deleteTx = (wait: boolean) =>
      deleting.begin(async (tx) => {
        await tx`select public.delete_account(${user}::uuid)`;
        if (wait) {
          firstReady.resolve();
          await committed.promise;
        }
      });
    const first = order === 'note first' ? noteTx(true) : deleteTx(true);
    await Promise.race([firstReady.promise, first]);
    const second = order === 'note first' ? deleteTx(false) : noteTx(false);
    const waited = await waitsForLock(admin, order === 'note first' ? deletingPid : notingPid);
    committed.resolve();
    await first;
    await second;
    const [row] = await admin<{ queued: boolean; orphan: boolean }[]>`
      select exists (select from public.revenuecat_deletions where app_user_id = ${user}::uuid)
               as queued,
             exists (select from public.revenuecat_customers where user_id = ${user}::uuid)
               as orphan`;
    return { waited, queued: row?.queued === true, orphanMarker: row?.orphan === true };
  } finally {
    await admin`delete from public.revenuecat_deletions where app_user_id = ${user}::uuid`;
    await admin`delete from public.revenuecat_customers where user_id = ${user}::uuid`;
    await admin`delete from public.purchases where bound_user = ${user}::uuid`;
    await admin`delete from auth.users where id = ${user}::uuid`;
    await Promise.all([admin.end(), noting.end(), deleting.end()]);
  }
}

const notes = [
  ['an ended grant', grantEnded],
  ['a grant', granted],
  ['a first purchase', purchased],
  ['the app', app],
] as const;

for (const [who, note] of notes) {
  for (const order of ['note first', 'deletion first'] as const) {
    Deno.test({
      name: `${who} for an account deleted meanwhile (${order}): queued, no orphan`,
      ignore: !enabled,
      sanitizeResources: false,
      sanitizeOps: false,
      async fn() {
        assertEquals(await race(order, note), { waited: true, queued: true, orphanMarker: false });
      },
    });
  }
}

Deno.test({
  name: "an event under the user's id for their household's purchase, while their account is " +
    'deleted: both finish, the customer is queued',
  ignore: !enabled,
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const admin = connect();
    const blocking = connect();
    const deleting = connect();
    const noting = connect();
    const user = crypto.randomUUID();
    const archived = crypto.randomUUID();
    const transaction = crypto.randomUUID();
    const hmac = `${transaction}${crypto.randomUUID()}`.replaceAll('-', '');
    let household: string | undefined;
    try {
      await admin`insert into auth.users (id, email) values (${user}, ${`${user}@fg-test.invalid`})`;
      household = await admin.begin(async (tx) => {
        await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: user })}, true)`;
        await tx`set local role authenticated`;
        const [h] = await tx<{ id: string }[]>`select id from public.create_household('Test')`;
        return h?.id;
      });
      if (household === undefined) throw new Error('no household');
      // A plan bought before job 185: bound to the household, the user its last member.
      const record = (sql: postgres.Sql | postgres.TransactionSql, owner: string, fn: string) =>
        sql`select ${sql(fn)}('apple', ${transaction}, ${transaction}, ${hmac},
          'com.snacklist.app.lifetime', 'premium', 'lifetime', 'Sandbox', now(), 29.99, 'EUR', 'DE',
          ${owner}::uuid)`;
      await record(admin, household, 'purchase_record');
      // A household the user archived: delete_account deletes it after their own households, so a
      // lock on it stops the deletion between the household's purchase and the account's row.
      await admin`insert into public.households (id, name, archived_at, archived_by)
                  values (${archived}, 'Archiv', now(), ${user})`;
      const deletingPid = await pidOf(deleting);
      const notingPid = await pidOf(noting);
      const released = Promise.withResolvers<void>();
      const held = Promise.withResolvers<void>();
      const blocker = blocking.begin(async (tx) => {
        await tx`select from public.households where id = ${archived}::uuid for update`;
        held.resolve();
        await released.promise;
      });
      await held.promise;
      const deletion = deleting.begin((tx) => tx`select public.delete_account(${user}::uuid)`);
      assertEquals(await waitsForLock(admin, deletingPid), true, 'the deletion holds');
      const event = noting.begin((tx) => record(tx, user, 'purchase_record_user'));
      assertEquals(await waitsForLock(admin, notingPid), true, 'the event waits');
      released.resolve();
      await blocker;
      const [deleted, recorded] = await Promise.allSettled([deletion, event]);
      assertEquals(
        [deleted.status, recorded.status],
        ['fulfilled', 'fulfilled'],
        [deleted, recorded].map((r) => r.status === 'rejected' ? String(r.reason) : '').join(' '),
      );
      const [row] = await admin<{ queued: boolean }[]>`
        select exists (select from public.revenuecat_deletions where app_user_id = ${user}::uuid)
          as queued`;
      assertEquals(row?.queued, true);
    } finally {
      await admin`delete from public.purchases where transaction_id = ${transaction}`;
      await admin`delete from public.households where id = any(${[
        archived,
        household ?? archived,
      ]}::uuid[])`;
      await admin`delete from public.revenuecat_households where app_user_id = ${
        household ?? archived
      }::uuid`;
      await admin`delete from public.revenuecat_deletions
                  where app_user_id = any(${[user, household ?? archived]}::uuid[])`;
      await admin`delete from public.revenuecat_customers where user_id = ${user}::uuid`;
      await admin`delete from auth.users where id = ${user}::uuid`;
      await Promise.all([admin.end(), blocking.end(), deleting.end(), noting.end()]);
    }
  },
});
