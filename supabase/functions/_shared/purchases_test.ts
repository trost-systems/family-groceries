import { assertEquals, assertRejects } from '@std/assert';
import {
  FakePurchaseVerifier,
  fromApple,
  fromGoogle,
  netAmount,
  recordPurchase,
  UnverifiedPurchase,
} from './purchases.ts';
import { type Env, telemetryFor } from './telemetry.ts';

const INSTALL = '0b6f7a52-6c1e-4f4e-9d55-3f1f0c2a9e01';
const HOUSEHOLD = '7d0c1c55-1111-4a2b-8c3d-2e9f6a1b0c02';
const env: Env = {
  get: (k) =>
    ({
      POSTHOG_PROJECT_API_KEY: 'phc_testprojectkey0123456789',
      POSTHOG_HOST: 'https://eu.i.posthog.com',
    })[k],
};

/** Shaped like Apple's decoded JWSTransactionDecodedPayload (only the fields used). */
const apple = {
  originalTransactionId: '2000000123456789',
  productId: 'lifetime',
  price: 9990,
  currency: 'EUR',
  storefront: 'DEU',
};

/** Shaped like a Google Play Orders API order. */
const google = {
  orderId: 'GPA.3333-4444-5555-66666',
  productId: 'lifetime',
  total: { currencyCode: 'EUR', units: '9', nanos: 990_000_000 },
  tax: { currencyCode: 'EUR', units: '1', nanos: 820_000_000 },
  regionCode: 'AT',
};

function setup() {
  const sent: Record<string, unknown>[][] = [];
  const telemetry = telemetryFor(
    'iap',
    env,
    ((_: unknown, init?: RequestInit) => {
      sent.push(JSON.parse(String(init?.body)).batch);
      return Promise.resolve(new Response('{}'));
    }) as typeof fetch,
  );
  return { sent, deps: { verifier: new FakePurchaseVerifier(), telemetry } };
}

const buyer = { consent: true, installId: INSTALL, householdId: HOUSEHOLD };

Deno.test('a verified Apple purchase sends purchase_completed with net amount', async () => {
  const { sent, deps } = setup();
  const name = await recordPurchase({ fake: true, kind: 'purchase', apple }, buyer, deps);
  await deps.telemetry.flush();
  assertEquals(name, 'purchase_completed');
  const p = sent[0][0].properties as Record<string, unknown>;
  assertEquals(p.price, 9.99);
  assertEquals(p.currency, 'EUR');
  assertEquals(p.country, 'DE');
  assertEquals(p.app_store, 'apple');
  // 9.99 / 1.19 = 8.39 net of VAT, less the 15 % store fee.
  assertEquals(p.net_amount, 7.14);
  assertEquals(p.distinct_id, INSTALL);
  assertEquals(p.household_id, HOUSEHOLD);
  assertEquals((p.transaction_ref as string).length, 32);
  assertEquals(JSON.stringify(sent).includes(apple.originalTransactionId), false);
});

Deno.test('a Google refund uses the reported tax and keeps the same ref', async () => {
  const { sent, deps } = setup();
  await recordPurchase({ fake: true, kind: 'purchase', google }, buyer, deps);
  await recordPurchase({ fake: true, kind: 'refund', google }, buyer, deps);
  await deps.telemetry.flush();
  const [bought, refunded] = sent[0].map((e) => e.properties as Record<string, unknown>);
  assertEquals(sent[0].map((e) => e.event), ['purchase_completed', 'purchase_refunded']);
  // (9.99 - 1.82) * 0.85
  assertEquals(refunded.net_amount, 6.94);
  assertEquals(refunded.transaction_ref, bought.transaction_ref);
});

Deno.test('a restore carries no revenue', async () => {
  const { sent, deps } = setup();
  await recordPurchase({ fake: true, kind: 'restore', apple }, buyer, deps);
  await deps.telemetry.flush();
  const p = sent[0][0].properties as Record<string, unknown>;
  assertEquals(sent[0][0].event, 'purchase_restored');
  assertEquals('price' in p || 'net_amount' in p, false);
});

Deno.test('nothing is sent for an unverified payload or without consent', async () => {
  const { sent, deps } = setup();
  await assertRejects(
    () => recordPurchase({ kind: 'purchase', apple }, buyer, deps),
    UnverifiedPurchase,
  );
  assertEquals(
    await recordPurchase(
      { fake: true, kind: 'purchase', apple },
      { ...buyer, consent: false },
      deps,
    ),
    null,
  );
  assertEquals(
    await recordPurchase(
      { fake: true, kind: 'purchase', apple },
      { ...buyer, installId: null },
      deps,
    ),
    null,
  );
  await deps.telemetry.flush();
  assertEquals(sent, []);
});

Deno.test('net amount: unknown country and no tax gives none', () => {
  assertEquals(netAmount(fromApple({ ...apple, storefront: 'USA' }, 'purchase')), null);
  assertEquals(netAmount(fromApple({ ...apple, storefront: 'CHE' }, 'purchase')), 7.86);
  assertEquals(netAmount(fromGoogle(google, 'purchase'), 0.3), 5.72);
});
