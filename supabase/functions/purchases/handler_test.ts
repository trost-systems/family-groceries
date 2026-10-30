// The purchases handler against fake stores and an in-memory ledger: Apple transactions are real
// JWS from the test CA (apple_test_ca.ts), verified by apple.ts as in production.
import { assert, assertEquals } from '@std/assert';
import { AuthError } from '../_shared/auth.ts';
import type { PurchaseEvent, Revenue } from '../_shared/purchases.ts';
import type { Subject } from '../_shared/telemetry.ts';
import { appleNotification, applePurchase, appleTransaction } from './apple.ts';
import { type AppleTestCa, makeAppleTestCa, sampleTransaction } from './apple_test_ca.ts';
import type { GoogleVerification, VoidedPurchase } from './google.ts';
import { createHandler, type Deps, NotConfigured } from './handler.ts';
import type { Outcome, Revoked, RevokedFacts } from './store.ts';
import {
  appId,
  lifetimeProductId,
  Refused,
  type StoreEnvironment,
  type StorePurchase,
  StoreUnavailable,
} from './types.ts';

const PETER = '00000000-0000-4000-8000-0000000025a1';
const HOME = '00000000-0000-4000-8000-00000000a0e1';
const INSTALL = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';
const base = 'http://localhost/functions/v1/purchases';

/** The ledger the migration keeps, in memory: transaction -> household or revoked. */
class Ledger {
  rows = new Map<string, { household: string | null; revoked: boolean; user: string }>();
  grant(p: StorePurchase, user: string, household: string): Outcome {
    const row = this.rows.get(p.transactionId);
    if (!row) {
      this.rows.set(p.transactionId, {
        household: p.revokedAt ? null : household,
        revoked: !!p.revokedAt,
        user,
      });
      return p.revokedAt ? 'revoked' : 'granted';
    }
    if (row.revoked) return 'revoked';
    if (p.revokedAt) {
      row.revoked = true;
      row.household = null;
      return 'refunded';
    }
    if (row.household && row.household !== household) return 'used_elsewhere';
    row.household = household;
    return 'restored';
  }
  revoked: { id: string; facts: RevokedFacts }[] = [];
  revoke(id: string, facts: RevokedFacts): Revoked | null {
    this.revoked.push({ id, facts });
    const row = this.rows.get(id);
    if (!row) {
      this.rows.set(id, { household: null, revoked: true, user: '' });
      return null;
    }
    if (row.revoked) return null;
    const household = row.household;
    row.revoked = true;
    row.household = null;
    return {
      userId: row.user,
      householdId: household,
      productId: lifetimeProductId,
      environment: 'Sandbox',
      price: 9.99,
      currency: 'EUR',
      country: 'DE',
    };
  }
}

interface World {
  ca: AppleTestCa;
  deps: Deps;
  ledger: Ledger;
  events: { name: PurchaseEvent; revenue: Revenue; subject: Subject }[];
  reported: unknown[];
  acks: string[];
  google: { answer: () => Promise<GoogleVerification>; voided: VoidedPurchase[] };
  handle(path: string, body?: unknown, headers?: Record<string, string>): Promise<Response>;
}

async function world(overrides: Partial<Deps> = {}): Promise<World> {
  const ca = await makeAppleTestCa();
  const ledger = new Ledger();
  const events: World['events'] = [];
  const reported: unknown[] = [];
  const acks: string[] = [];
  const google: World['google'] = {
    answer: () =>
      Promise.resolve({
        purchase: {
          store: 'google',
          productId: lifetimeProductId,
          transactionId: 'GPA.3333-4444-5555-66666',
          environment: 'Sandbox',
          purchasedAt: new Date(),
          revokedAt: null,
          pending: false,
          price: 9.99,
          currency: 'EUR',
          country: 'AT',
          tax: 1.67,
        },
        needsAcknowledge: true,
      }),
    voided: [],
  };
  const deps: Deps = {
    environments: ['Sandbox'],
    authenticate: (req) => {
      if (!req.headers.get('authorization')) {
        return Promise.reject(new AuthError('missing_token', 'missing'));
      }
      return Promise.resolve({ userId: PETER, householdId: HOME });
    },
    takeCall: () => Promise.resolve(true),
    apple: {
      transaction: async (jws) => applePurchase(await appleTransaction(jws, ca.trust())),
      notification: (payload) => appleNotification(payload, ca.trust()),
    },
    google: {
      verify: () => google.answer(),
      acknowledge: (_p, token) => {
        acks.push(token);
        return Promise.resolve();
      },
      voided: () => Promise.resolve(google.voided),
      transactionId: (v) => Promise.resolve(v.orderId ?? `token:${v.purchaseToken}`),
    },
    cronSecret: 'cron-secret-for-tests',
    testSigner: null,
    grant: (p, user, household) => Promise.resolve(ledger.grant(p, user, household)),
    revoke: (_store, id, _at, facts) => Promise.resolve(ledger.revoke(id, facts)),
    reinstate: (_store, id) => {
      const row = ledger.rows.get(id);
      if (!row?.revoked) return Promise.resolve(false);
      row.revoked = false;
      return Promise.resolve(true);
    },
    subject: () => Promise.resolve({ installId: INSTALL, householdId: HOME, internal: false }),
    event: (name, revenue, subject) => {
      events.push({ name, revenue, subject });
      return Promise.resolve();
    },
    report: (e) => reported.push(e),
    now: () => new Date(),
    ...overrides,
  };
  const handler = createHandler(deps);
  return {
    ca,
    deps,
    ledger,
    events,
    reported,
    acks,
    google,
    handle: (path, body, headers = { authorization: 'Bearer session' }) =>
      handler(
        new Request(`${base}${path}`, {
          method: body === undefined ? 'GET' : 'POST',
          headers: { 'content-type': 'application/json', ...headers },
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
      ),
  };
}

const appleBody = async (w: World, source = 'purchase', overrides = {}) => ({
  store: 'apple',
  source,
  jws: await w.ca.sign(sampleTransaction(overrides)),
});

async function expect(res: Response, status: number, body?: Record<string, unknown>) {
  const got = await res.json();
  assertEquals(res.status, status, JSON.stringify(got));
  if (body) assertEquals(got, body);
  return got;
}

Deno.test('unconfigured, everything but the status answers 503', async () => {
  const w = await world({ environments: [] });
  await expect(await w.handle(''), 200, { configured: false, environments: [] });
  await expect(await w.handle('/verify', await appleBody(w)), 503, { error: 'not_configured' });
  await expect(await w.handle('/apple/notifications', { signedPayload: 'x' }), 503);
  await expect(await w.handle('/google/voided', {}), 503);
  assertEquals(w.ledger.rows.size, 0);
});

Deno.test('a verified purchase unlocks the household and counts once', async () => {
  const w = await world();
  const body = await appleBody(w);
  await expect(await w.handle('/verify', body), 200, { status: 'granted', unlocked: true });
  // The app retries after a lost answer, a double tap, a restart mid-purchase.
  await expect(await w.handle('/verify', body), 200, { status: 'restored', unlocked: true });
  assertEquals(w.events.map((e) => e.name), ['purchase_completed']);
  const [e] = w.events;
  assertEquals(e.revenue.price, 9.99);
  assertEquals(e.revenue.originalTransactionId, '2000000812345678');
  assertEquals(e.subject, { installId: INSTALL, householdId: HOME, internal: true });
});

Deno.test('a restore is purchase_restored, without revenue', async () => {
  const w = await world();
  await w.handle('/verify', await appleBody(w));
  await expect(await w.handle('/verify', await appleBody(w, 'restore')), 200, {
    status: 'restored',
    unlocked: true,
  });
  assertEquals(w.events.map((e) => e.name), ['purchase_completed', 'purchase_restored']);
});

Deno.test('no event for a buyer without analytics consent', async () => {
  const w = await world({ subject: () => Promise.resolve(null) });
  await expect(await w.handle('/verify', await appleBody(w)), 200);
  assertEquals(w.events, []);
});

Deno.test('a production purchase is not internal', async () => {
  const w = await world({ environments: ['Production'] });
  await w.handle('/verify', await appleBody(w, 'purchase', { environment: 'Production' }));
  assertEquals(w.events[0].subject.internal, false);
});

Deno.test('forged, foreign and wrong-product transactions are refused, nothing granted', async () => {
  const w = await world();
  const stranger = await makeAppleTestCa();
  const cases: [Record<string, unknown>, string][] = [
    [
      { store: 'apple', source: 'purchase', jws: await stranger.sign(sampleTransaction()) },
      'untrusted_chain',
    ],
    [await appleBody(w, 'purchase', { bundleId: 'com.example.other' }), 'wrong_app'],
    [await appleBody(w, 'purchase', { productId: 'com.hummlist.app.other' }), 'wrong_product'],
    [{ store: 'apple', source: 'purchase', jws: 'a.b.c' }, 'malformed'],
  ];
  for (const [body, reason] of cases) {
    await expect(await w.handle('/verify', body), 422, { error: 'refused', reason });
  }
  assertEquals(w.ledger.rows.size, 0);
  assertEquals(w.events, []);
});

Deno.test('a sandbox transaction against a production configuration is refused', async () => {
  const w = await world({ environments: ['Production'] });
  await expect(await w.handle('/verify', await appleBody(w)), 422, {
    error: 'refused',
    reason: 'wrong_environment',
  });
  assertEquals(w.ledger.rows.size, 0);
});

Deno.test('a transaction already used in another household is not granted here', async () => {
  const w = await world();
  const body = await appleBody(w);
  w.ledger.rows.set('2000000812345678', { household: 'other', revoked: false, user: 'max' });
  await expect(await w.handle('/verify', body), 200, { status: 'used_elsewhere', unlocked: false });
  assertEquals(w.events, []);
});

Deno.test('verification learning of a refund removes the unlock and reports it once', async () => {
  const w = await world();
  await w.handle('/verify', await appleBody(w));
  const refunded = await appleBody(w, 'restore', { revocationDate: Date.now() - 1000 });
  await expect(await w.handle('/verify', refunded), 200, { status: 'refunded', unlocked: false });
  await expect(await w.handle('/verify', refunded), 200, { status: 'revoked', unlocked: false });
  assertEquals(w.events.map((e) => e.name), ['purchase_completed', 'purchase_refunded']);
});

Deno.test('auth, body and rate limit come before any store call', async () => {
  let calls = 0;
  const w = await world({
    takeCall: () => Promise.resolve(++calls < 2),
    authenticate: (req) =>
      req.headers.get('authorization') === 'Bearer nohousehold'
        ? Promise.reject(new AuthError('no_household', 'none'))
        : req.headers.get('authorization')
        ? Promise.resolve({ userId: PETER, householdId: HOME })
        : Promise.reject(new AuthError('missing_token', 'missing')),
  });
  const body = await appleBody(w);
  await expect(await w.handle('/verify', body, {}), 401, { error: 'missing_token' });
  await expect(await w.handle('/verify', body, { authorization: 'Bearer nohousehold' }), 403, {
    error: 'no_household',
  });
  await expect(await w.handle('/verify', { store: 'apple' }), 400, { error: 'bad_request' });
  await expect(await w.handle('/verify', { store: 'amazon', source: 'purchase' }), 400);
  await expect(await w.handle('/verify', body), 200);
  await expect(await w.handle('/verify', body), 429, { error: 'rate_limited' });
});

Deno.test('the store down is a 502 the app retries; nothing is granted', async () => {
  const w = await world({
    apple: {
      transaction: () => Promise.reject(new StoreUnavailable('down')),
      notification: () => Promise.reject(new StoreUnavailable('down')),
    },
  });
  await expect(await w.handle('/verify', await appleBody(w)), 502, {
    error: 'store_unavailable',
  });
  assertEquals(w.ledger.rows.size, 0);
});

Deno.test('a refused credential is a 503 that reaches error tracking', async () => {
  const w = await world({
    apple: {
      transaction: () => Promise.reject(new NotConfigured('key refused')),
      notification: () => Promise.reject(new Refused('malformed')),
    },
  });
  await expect(await w.handle('/verify', await appleBody(w)), 503, { error: 'not_configured' });
  assertEquals(w.reported.length, 1);
});

Deno.test('Google: verified, granted, then acknowledged', async () => {
  const w = await world();
  const body = {
    store: 'google',
    source: 'purchase',
    productId: lifetimeProductId,
    purchaseToken: 'token-1',
  };
  await expect(await w.handle('/verify', body), 200, { status: 'granted', unlocked: true });
  assertEquals(w.acks, ['token-1']);
  assertEquals(w.events[0].revenue.tax, 1.67);
  assertEquals(w.events[0].revenue.store, 'google');
});

Deno.test('Google: another product is refused before Google is asked', async () => {
  let asked = false;
  const w = await world();
  w.google.answer = () => {
    asked = true;
    return Promise.reject(new Error('should not be asked'));
  };
  await expect(
    await w.handle('/verify', {
      store: 'google',
      source: 'purchase',
      productId: 'other',
      purchaseToken: 't',
    }),
    422,
    { error: 'refused', reason: 'wrong_product' },
  );
  assert(!asked);
});

Deno.test('Google: a pending purchase is not granted and not acknowledged', async () => {
  const w = await world();
  const real = w.google.answer;
  w.google.answer = async () => {
    const v = await real();
    return { purchase: { ...v.purchase, pending: true }, needsAcknowledge: false };
  };
  await expect(
    await w.handle('/verify', {
      store: 'google',
      source: 'purchase',
      productId: lifetimeProductId,
      purchaseToken: 't',
    }),
    202,
    { status: 'pending', unlocked: false },
  );
  assertEquals(w.ledger.rows.size, 0);
  assertEquals(w.acks, []);
});

Deno.test('Google: not acknowledged when used elsewhere; an acknowledge failure is reported', async () => {
  const w = await world();
  w.ledger.rows.set('GPA.3333-4444-5555-66666', { household: 'other', revoked: false, user: 'x' });
  const body = {
    store: 'google',
    source: 'restore',
    productId: lifetimeProductId,
    purchaseToken: 't',
  };
  await expect(await w.handle('/verify', body), 200, { status: 'used_elsewhere', unlocked: false });
  assertEquals(w.acks, []);
  const failing = await world({
    google: {
      ...w.deps.google!,
      verify: () => w.google.answer(),
      acknowledge: () => Promise.reject(new StoreUnavailable('down')),
    },
  });
  await expect(await failing.handle('/verify', body), 200, { status: 'granted', unlocked: true });
  assertEquals(failing.reported.length, 1);
});

Deno.test('Google: unconfigured answers 503', async () => {
  const w = await world({ google: null });
  await expect(
    await w.handle('/verify', {
      store: 'google',
      source: 'purchase',
      productId: lifetimeProductId,
      purchaseToken: 't',
    }),
    503,
  );
});

async function notification(
  w: World,
  type: string,
  overrides: Record<string, unknown> = {},
  environment: StoreEnvironment | 'Xcode' = 'Sandbox',
) {
  return {
    signedPayload: await w.ca.sign({
      notificationType: type,
      notificationUUID: crypto.randomUUID(),
      signedDate: Date.now() - 100,
      version: '2.0',
      data: {
        bundleId: appId,
        environment,
        signedTransactionInfo: await w.ca.sign(
          sampleTransaction({ revocationDate: Date.now() - 1000, ...overrides }),
        ),
      },
    }),
  };
}

Deno.test('Apple REFUND removes the unlock and sends purchase_refunded once', async () => {
  const w = await world();
  await w.handle('/verify', await appleBody(w));
  const refund = await notification(w, 'REFUND');
  await expect(await w.handle('/apple/notifications', refund, {}), 200, { status: 'revoked' });
  await expect(await w.handle('/apple/notifications', refund, {}), 200, { status: 'unchanged' });
  await expect(await w.handle('/apple/notifications', await notification(w, 'REVOKE'), {}), 200, {
    status: 'unchanged',
  });
  assertEquals(w.events.map((e) => e.name), ['purchase_completed', 'purchase_refunded']);
  const refunded = w.events[1];
  assertEquals(refunded.revenue.price, 9.99);
  assertEquals(refunded.subject.householdId, HOME);
  assertEquals(w.ledger.rows.get('2000000812345678')?.household, null);
});

Deno.test('Apple REFUND_REVERSED reinstates the purchase', async () => {
  const w = await world();
  await w.handle('/verify', await appleBody(w));
  await w.handle('/apple/notifications', await notification(w, 'REFUND'), {});
  await expect(
    await w.handle('/apple/notifications', await notification(w, 'REFUND_REVERSED'), {}),
    200,
    { status: 'reinstated' },
  );
  assertEquals(w.ledger.rows.get('2000000812345678')?.revoked, false);
});

Deno.test('Apple notifications we do not act on are acknowledged with 200', async () => {
  const w = await world();
  await w.handle('/verify', await appleBody(w));
  const ignored = [
    await notification(w, 'TEST'),
    await notification(w, 'REFUND', { productId: 'com.hummlist.app.other' }),
    await notification(w, 'REFUND', {}, 'Production'),
    await notification(w, 'CONSUMPTION_REQUEST'),
  ];
  for (const n of ignored) {
    await expect(await w.handle('/apple/notifications', n, {}), 200, { status: 'ignored' });
  }
  assertEquals(w.ledger.rows.get('2000000812345678')?.revoked, false);
});

Deno.test('a forged Apple notification is refused with 400 and changes nothing', async () => {
  const w = await world();
  await w.handle('/verify', await appleBody(w));
  const stranger = await makeAppleTestCa();
  const forged = {
    signedPayload: await stranger.sign({
      notificationType: 'REFUND',
      notificationUUID: 'x',
      signedDate: Date.now(),
      data: { bundleId: appId, environment: 'Sandbox' },
    }),
  };
  await expect(await w.handle('/apple/notifications', forged, {}), 400, {
    error: 'refused',
    reason: 'untrusted_chain',
  });
  await expect(await w.handle('/apple/notifications', { nope: 1 }, {}), 400);
  assertEquals(w.ledger.rows.get('2000000812345678')?.revoked, false);
});

Deno.test('the voided poll needs the cron secret and revokes each voided purchase once', async () => {
  const w = await world();
  await w.handle('/verify', {
    store: 'google',
    source: 'purchase',
    productId: lifetimeProductId,
    purchaseToken: 't',
  });
  w.google.voided = [{
    purchaseToken: 't',
    orderId: 'GPA.3333-4444-5555-66666',
    voidedAt: new Date(),
    source: 'user',
    reason: 'remorse',
  }, {
    purchaseToken: 'unknown',
    orderId: null,
    voidedAt: new Date(),
    source: 'google',
    reason: 'chargeback',
  }];
  await expect(await w.handle('/google/voided', {}, {}), 401, { error: 'invalid_token' });
  await expect(await w.handle('/google/voided', {}, { authorization: 'Bearer wrong' }), 401);
  const auth = { authorization: 'Bearer cron-secret-for-tests' };
  await expect(await w.handle('/google/voided', {}, auth), 200, { checked: 2, revoked: 1 });
  await expect(await w.handle('/google/voided', {}, auth), 200, { checked: 2, revoked: 0 });
  assertEquals(w.events.map((e) => e.name), ['purchase_completed', 'purchase_refunded']);
});

Deno.test('the voided poll without a secret configured answers 503', async () => {
  const w = await world({ cronSecret: null });
  await expect(await w.handle('/google/voided', {}, { authorization: 'Bearer x' }), 503);
});

Deno.test('unknown routes and methods are 404; preflight is answered', async () => {
  const w = await world();
  await expect(await w.handle('/nope', {}), 404);
  const handler = createHandler(w.deps);
  const res = await handler(new Request(`${base}/verify`, { method: 'OPTIONS' }));
  assertEquals(res.status, 204);
});

Deno.test('a refund that arrives before the first verification blocks the receipt for good', async () => {
  const w = await world();
  await expect(await w.handle('/apple/notifications', await notification(w, 'REFUND'), {}), 200, {
    status: 'unchanged',
  });
  assertEquals(w.ledger.revoked[0].facts, {
    productId: lifetimeProductId,
    environment: 'Sandbox',
    purchasedAt: w.ledger.revoked[0].facts.purchasedAt,
  });
  // The saved receipt sent later, without a revocationDate of its own:
  await expect(await w.handle('/verify', await appleBody(w)), 200, {
    status: 'revoked',
    unlocked: false,
  });
  assertEquals(w.events, []);
});

Deno.test('leaving the household while verifying answers 403, not 500', async () => {
  const w = await world({
    grant: () => Promise.reject(new AuthError('no_household', 'left')),
  });
  await expect(await w.handle('/verify', await appleBody(w)), 403, { error: 'no_household' });
});
