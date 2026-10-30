// Job 25: the purchases function's production wiring (deps.ts) against a database with the repo's
// migrations: a test-CA transaction unlocks the buyer's household, the partner reads it under RLS,
// a replay from another household is refused, Apple's refund takes it away with one
// purchase_refunded, and the rate limit holds. The session check is the shared auth.ts
// (auth_test.ts); here a resolver stands in for it. The db gate sets FG_DB_TEST=1 and
// SUPABASE_DB_URL; without them this is skipped.
import { assertEquals } from '@std/assert';
import postgres from 'postgres';
import { asUser } from '../_shared/db.ts';
import { telemetryFor } from '../_shared/telemetry.ts';
import { makeAppleTestCa, sampleTransaction } from './apple_test_ca.ts';
import { productionDeps } from './deps.ts';
import { createHandler } from './handler.ts';
import { callsPerMinute } from './store.ts';
import { appId } from './types.ts';

const enabled = Deno.env.get('FG_DB_TEST') === '1';
const admin = () => postgres(Deno.env.get('SUPABASE_DB_URL')!, { max: 1, prepare: false });

interface Member {
  userId: string;
  householdId: string;
}

/** Peter and Lea in one household, Max in another, with Peter's analytics yes; removed after. */
async function withHouseholds(work: (peter: Member, lea: Member, max: Member) => Promise<void>) {
  const sql = admin();
  const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
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
      { userId: ids[0], householdId: home },
      { userId: ids[1], householdId: home },
      { userId: ids[2], householdId: other },
    );
  } finally {
    await sql`delete from public.purchases where user_id = any(${ids}::uuid[])`;
    await sql`delete from public.households where id in (
      select household_id from public.household_members where user_id = any(${ids}::uuid[]))`;
    await sql`delete from auth.users where id = any(${ids}::uuid[])`;
    await sql.end();
  }
}

Deno.test({
  name: 'a verified purchase unlocks the household; replays and refunds behave',
  ignore: !enabled,
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await withHouseholds(async (peter, lea, max) => {
      const ca = await makeAppleTestCa();
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
          environments: ['Sandbox'],
          apple: ca.trust(),
          appleKey: null,
          googleServiceAccount: null,
          cronSecret: null,
          testSigner: null,
        },
        telemetry,
        { authenticate: () => Promise.resolve(caller) },
      );
      const handler = createHandler(deps);
      const tx = `25${Date.now()}`;
      const jws = await ca.sign(
        sampleTransaction({ transactionId: tx, originalTransactionId: tx }),
      );
      const verify = async (body: unknown) => {
        const res = await handler(
          new Request('http://local/functions/v1/purchases/verify', {
            method: 'POST',
            body: JSON.stringify(body),
          }),
        );
        return { status: res.status, body: await res.json() };
      };

      assertEquals(await verify({ store: 'apple', source: 'purchase', jws }), {
        status: 200,
        body: { status: 'granted', unlocked: true },
      });
      const seen = await asUser(
        lea.userId,
        (t) =>
          t<{ household_id: string; granted_by: string }[]>`
          select household_id, granted_by from public.entitlements`,
      );
      assertEquals(seen.map((r) => [r.household_id, r.granted_by]), [[
        peter.householdId,
        peter.userId,
      ]]);
      assertEquals(
        await asUser(max.userId, (t) => t`select * from public.entitlements`).then((r) => r.length),
        0,
      );

      caller = max;
      assertEquals((await verify({ store: 'apple', source: 'restore', jws })).body, {
        status: 'used_elsewhere',
        unlocked: false,
      });

      const queued = () => telemetry.queued.map((e) => e.event);
      assertEquals(queued(), ['purchase_completed']);
      const completed = telemetry.queued[0].properties as Record<string, unknown>;
      assertEquals(completed.is_internal, true);
      assertEquals(completed.price, 9.99);
      assertEquals(completed.household_id, peter.householdId);

      const refund = await ca.sign({
        notificationType: 'REFUND',
        notificationUUID: crypto.randomUUID(),
        signedDate: Date.now(),
        data: {
          bundleId: appId,
          environment: 'Sandbox',
          signedTransactionInfo: await ca.sign(
            sampleTransaction({
              transactionId: tx,
              originalTransactionId: tx,
              revocationDate: Date.now() - 1000,
            }),
          ),
        },
      });
      const notify = () =>
        handler(
          new Request('http://local/functions/v1/purchases/apple/notifications', {
            method: 'POST',
            body: JSON.stringify({ signedPayload: refund }),
          }),
        ).then((r) => r.json());
      assertEquals(await notify(), { status: 'revoked' });
      assertEquals(await notify(), { status: 'unchanged' });
      assertEquals(
        await asUser(lea.userId, (t) => t`select * from public.entitlements`).then((r) => r.length),
        0,
      );
      assertEquals(queued(), ['purchase_completed', 'purchase_refunded']);

      caller = lea;
      for (let i = 0; i < callsPerMinute; i++) await deps.takeCall(lea.userId);
      assertEquals((await verify({ store: 'apple', source: 'restore', jws })).status, 429);
    });
  },
});
