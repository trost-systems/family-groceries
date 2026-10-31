// Job 43: the purchases function's production wiring (deps.ts) against a database with the repo's
// migrations, driven by RevenueCat-shaped events: a purchase unlocks the household RevenueCat
// names, the partner reads the unlock but not who paid, the buyer's claim sends one
// purchase_completed, a duplicate delivery and a transfer to another household change nothing, a
// refund takes the unlock away and its reversal gives it back, a tombstoned transaction never
// binds, and the claim's rate limit holds. The session check is the shared auth.ts
// (auth_test.ts); here a resolver stands in for it. The db gate sets FG_DB_TEST=1 and
// SUPABASE_DB_URL; without them this is skipped.
import { assertEquals, assertRejects } from '@std/assert';
import postgres from 'postgres';
import { asUser } from '../_shared/db.ts';
import { telemetryFor } from '../_shared/telemetry.ts';
import { productionDeps } from './deps.ts';
import { createHandler } from './handler.ts';
import { hmacHex, testEvent } from './revenuecat.ts';
import { callsPerMinute } from './store.ts';

const enabled = Deno.env.get('FG_DB_TEST') === '1';
const admin = () => postgres(Deno.env.get('SUPABASE_DB_URL')!, { max: 1, prepare: false });
const AUTH = 'Bearer integration-webhook';
const TOMBSTONE_KEY = 'integration-tombstone-key';

interface Member {
  userId: string;
  householdId: string;
}

/** Peter and Lea in one household, Max in another, with Peter's analytics yes; removed after. */
async function withHouseholds(
  work: (sql: postgres.Sql, peter: Member, lea: Member, max: Member) => Promise<void>,
) {
  const sql = admin();
  const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  const households: string[] = [];
  try {
    for (const id of ids) {
      await sql`insert into auth.users (id, email) values (${id}, ${`${id}@fg-test.invalid`})`;
    }
    const household = async (userId: string) =>
      await asUser(userId, async (tx) => {
        const [h] = await tx<{ id: string }[]>`select id from public.create_household('Test')`;
        return h.id;
      });
    const home = await household(ids[0]);
    const other = await household(ids[2]);
    households.push(home, other);
    const code = await asUser(ids[0], async (tx) => {
      const [i] = await tx<
        { code: string }[]
      >`select code from public.create_invite(${home}::uuid)`;
      await tx`select public.record_analytics_consent(${crypto.randomUUID()}::uuid, true)`;
      return i.code;
    });
    const joined = await asUser(
      ids[1],
      (tx) => tx<{ id: string }[]>`select public.join_household(${code}) as id`,
    );
    assertEquals(joined[0].id, home);
    await work(
      sql,
      { userId: ids[0], householdId: home },
      { userId: ids[1], householdId: home },
      { userId: ids[2], householdId: other },
    );
  } finally {
    await sql`delete from public.purchases where bound_household = any(${households}::uuid[])`;
    await sql`delete from public.households where id = any(${households}::uuid[])`;
    await sql`delete from public.revenuecat_deletions where app_user_id = any(${households}::uuid[])`;
    await sql`delete from auth.users where id = any(${ids}::uuid[])`;
    await sql.end();
  }
}

Deno.test({
  name: 'RevenueCat events unlock the household they name, and only that one',
  ignore: !enabled,
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await withHouseholds(async (sql, peter, lea, max) => {
      const telemetry = telemetryFor('purchases', {
        get: (k) =>
          ({
            POSTHOG_PROJECT_API_KEY: 'phc_testprojectkey0123456789',
            POSTHOG_HOST: 'https://eu.i.posthog.com',
          })[k],
      });
      let caller: Member = peter;
      const deps = productionDeps(
        {
          webhook: { authorization: AUTH, signingSecret: null, tombstoneKey: TOMBSTONE_KEY },
          local: true,
          region: null,
          revenueCat: null,
          deletionsSecret: null,
        },
        telemetry,
        { authenticate: () => Promise.resolve(caller) },
      );
      const handler = createHandler(deps);
      const post = async (path: string, body: unknown, authorization = AUTH) => {
        const res = await handler(
          new Request(`http://local/functions/v1/purchases${path}`, {
            method: 'POST',
            headers: { authorization },
            body: JSON.stringify(body),
          }),
        );
        return { status: res.status, body: await res.json() };
      };
      const eventIds: string[] = [];
      const tx = `43${Date.now()}`;
      const tombstoned = `${tx}9`;
      const event = (type: string, appUserId: string, transactionId = tx) => {
        const e = testEvent({ type, appUserId, transactionId }, new Date())!;
        eventIds.push((e.event as { id: string }).id);
        return e;
      };
      const deliver = async (type: string, appUserId: string, transactionId = tx) =>
        (await post('/revenuecat/webhook', event(type, appUserId, transactionId))).body;
      const unlocks = (who: Member) =>
        asUser(
          who.userId,
          (t) => t<{ household_id: string }[]>`select household_id from public.entitlements`,
        )
          .then((rows) => rows.map((r) => r.household_id));
      const queued = () => telemetry.queued.map((e) => e.event);

      try {
        const bought = event('NON_RENEWING_PURCHASE', peter.householdId);
        assertEquals((await post('/revenuecat/webhook', bought)).body, { status: 'granted' });
        assertEquals((await post('/revenuecat/webhook', bought)).body, { status: 'duplicate' });
        assertEquals(await unlocks(lea), [peter.householdId]);
        // H-55: the partner sees the unlock, not who paid.
        await assertRejects(() =>
          asUser(lea.userId, (t) => t`select granted_by from public.entitlements`)
        );
        assertEquals(await unlocks(max), []);
        assertEquals(queued(), []);

        // The buyer's claim, after the webhook: purchase_completed, once.
        assertEquals(
          (await post('/claim', {
            store: 'apple',
            householdId: peter.householdId,
            transactionId: tx,
          }, 'Bearer s')).body,
          {
            status: 'recorded',
          },
        );
        assertEquals(
          (await post('/claim', {
            store: 'apple',
            householdId: peter.householdId,
            transactionId: tx,
          }, 'Bearer s')).body,
          {
            status: 'recorded',
          },
        );
        // Max was never in Peter's household: the claim for it records nothing.
        caller = max;
        assertEquals(
          (await post('/claim', {
            store: 'apple',
            householdId: peter.householdId,
            transactionId: tx,
          }, 'Bearer s'))
            .status,
          403,
        );
        caller = lea;
        assertEquals(
          (await post('/claim', {
            store: 'apple',
            householdId: peter.householdId,
            transactionId: tx,
          }, 'Bearer s')).body,
          {
            status: 'taken',
          },
        );
        assertEquals(queued(), ['purchase_completed']);
        const completed = telemetry.queued[0].properties as Record<string, unknown>;
        assertEquals(
          [completed.is_internal, completed.price, completed.household_id],
          [true, 9.99, peter.householdId],
        );

        // H-56: a restore or transfer into another household binds nothing there.
        assertEquals(await deliver('NON_RENEWING_PURCHASE', max.householdId), {
          status: 'used_elsewhere',
        });
        assertEquals(await deliver('TRANSFER', max.householdId), { status: 'ignored' });
        assertEquals(await unlocks(max), []);
        assertEquals(await deliver('NON_RENEWING_PURCHASE', crypto.randomUUID(), `${tx}1`), {
          status: 'no_household',
        });

        assertEquals(await deliver('CANCELLATION', peter.householdId), { status: 'revoked' });
        assertEquals(await deliver('CANCELLATION', peter.householdId), { status: 'unchanged' });
        assertEquals(await unlocks(lea), []);
        assertEquals(queued(), ['purchase_completed', 'purchase_refunded']);
        assertEquals(await deliver('REFUND_REVERSED', peter.householdId), {
          status: 'reinstated',
        });
        assertEquals(await unlocks(lea), [peter.householdId]);

        // The local route runs the same path.
        assertEquals(
          (await post('/test/event', { appUserId: lea.householdId, transactionId: tx }, '')).body,
          { status: 'restored' },
        );

        await sql`insert into public.purchase_tombstones (transaction_hmac)
                  values (${await hmacHex(TOMBSTONE_KEY, tombstoned)})`;
        assertEquals(await deliver('NON_RENEWING_PURCHASE', peter.householdId, tombstoned), {
          status: 'tombstoned',
        });
        const [row] = await sql<{ transaction_hmac: string }[]>`
          select transaction_hmac from public.purchases where transaction_id = ${tx}`;
        assertEquals(row.transaction_hmac, await hmacHex(TOMBSTONE_KEY, tx));
        assertEquals(
          (await sql`select from public.revenuecat_events where id = any(${eventIds})`).length,
          eventIds.length,
        );

        for (let i = 0; i < callsPerMinute; i++) await deps.takeCall(lea.userId);
        assertEquals(
          (await post('/claim', {
            store: 'apple',
            householdId: peter.householdId,
            transactionId: tx,
          }, 'Bearer s')).status,
          429,
        );
      } finally {
        await sql`delete from public.purchase_tombstones
                  where transaction_hmac = ${await hmacHex(TOMBSTONE_KEY, tombstoned)}`;
        await sql`delete from public.revenuecat_events where id = any(${eventIds})`;
      }
    });
  },
});
