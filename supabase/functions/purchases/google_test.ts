// GooglePlay against a scripted fetch: no request leaves the process. The fixtures in
// testdata/google/ follow Google's documented response shapes (see google.ts), not a live API.
import { assert, assertEquals, assertRejects } from '@std/assert';
import { decodeProtectedHeader, exportPKCS8, exportSPKI, importSPKI, jwtVerify } from 'jose';
import {
  androidPublisherScope,
  GoogleConfigError,
  GooglePlay,
  tokenTransactionId,
  voidedWindowMs,
} from './google.ts';
import { lifetimeProductId, Refused, StoreUnavailable } from './types.ts';
import productPurchased from './testdata/google/product_purchased.json' with { type: 'json' };
import productLicenseTest from './testdata/google/product_license_test.json' with { type: 'json' };
import productPending from './testdata/google/product_pending.json' with { type: 'json' };
import productCanceled from './testdata/google/product_canceled.json' with { type: 'json' };
import productAcknowledged from './testdata/google/product_acknowledged.json' with {
  type: 'json',
};
import order from './testdata/google/order.json' with { type: 'json' };
import voidedPage1 from './testdata/google/voided_page1.json' with { type: 'json' };
import voidedPage2 from './testdata/google/voided_page2.json' with { type: 'json' };
import error403 from './testdata/google/error_403.json' with { type: 'json' };
import error404 from './testdata/google/error_404.json' with { type: 'json' };
import error503 from './testdata/google/error_503.json' with { type: 'json' };
import errorAck400 from './testdata/google/error_ack_400.json' with { type: 'json' };
import tokenAnswer from './testdata/google/token.json' with { type: 'json' };

const tokenUri = 'https://oauth2.googleapis.com/token';
const clientEmail = 'play-verifier@hummlist-test.iam.gserviceaccount.com';
const purchaseToken = 'opaque-token-up-to-150-chars.AO-J1Oz';
const base = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/' +
  'com.hummlist.app';
const productUrl = `${base}/purchases/products/${lifetimeProductId}/tokens/${purchaseToken}`;
const orderUrl = `${base}/orders/GPA.3301-2345-6789-01234`;

/** A throwaway RSA key pair, as a key file would carry it (PKCS#8 PEM). */
const keys = await crypto.subtle.generateKey(
  {
    name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
  },
  true,
  ['sign', 'verify'],
);
const privatePem = await exportPKCS8(keys.privateKey);
const publicKey = await importSPKI(await exportSPKI(keys.publicKey), 'RS256');

const serviceAccount = JSON.stringify({
  type: 'service_account',
  project_id: 'hummlist-test',
  private_key_id: 'test',
  private_key: privatePem,
  client_email: clientEmail,
  token_uri: tokenUri,
});

interface Seen {
  method: string;
  url: string;
  body: string | null;
  auth: string | null;
}

type Route = (req: Seen) => Response | Promise<Response> | undefined;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** A fetch that answers the token endpoint itself and everything else from [routes]. */
function fakeGoogle(routes: Record<string, Route | Response | unknown>) {
  const seen: Seen[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = init?.body === undefined || init.body === null ? null : String(init.body);
    const req: Seen = {
      method: init?.method ?? 'GET',
      url: String(input),
      body,
      auth: new Headers(init?.headers).get('authorization'),
    };
    seen.push(req);
    if (req.url === tokenUri && !(tokenUri in routes)) return json(tokenAnswer);
    const route = routes[req.url];
    if (route === undefined) throw new Error(`unexpected request ${req.method} ${req.url}`);
    if (typeof route === 'function') {
      const res = await (route as Route)(req);
      if (res) return res;
      throw new TypeError('network');
    }
    return route instanceof Response ? route.clone() : json(route);
  };
  return { fetch: fetch as typeof globalThis.fetch, seen };
}

const now = new Date('2025-10-30T12:00:00Z');

function play(fetch: typeof globalThis.fetch, at: () => Date = () => now) {
  return new GooglePlay({ serviceAccount, fetch, now: at });
}

const apiCalls = (seen: Seen[]) => seen.filter((s) => s.url !== tokenUri);

Deno.test('verify: a real purchase with its order', async () => {
  const g = fakeGoogle({ [productUrl]: productPurchased, [orderUrl]: order });
  const { purchase, needsAcknowledge } = await play(g.fetch).verify(
    lifetimeProductId,
    purchaseToken,
  );
  assertEquals(purchase, {
    store: 'google',
    productId: lifetimeProductId,
    transactionId: 'GPA.3301-2345-6789-01234',
    environment: 'Production',
    purchasedAt: new Date(1761811200000),
    revokedAt: null,
    pending: false,
    price: 4.99,
    currency: 'EUR',
    country: 'DE',
    tax: 0.8,
  });
  assert(needsAcknowledge);
  for (const call of apiCalls(g.seen)) assertEquals(call.auth, 'Bearer ya29.fake-access-token');
});

Deno.test('the token request is an RS256 JWT bearer assertion for androidpublisher', async () => {
  const g = fakeGoogle({ [productUrl]: productPurchased, [orderUrl]: order });
  await play(g.fetch).verify(lifetimeProductId, purchaseToken);
  const tokenRequest = g.seen.find((s) => s.url === tokenUri)!;
  assertEquals(tokenRequest.method, 'POST');
  const form = new URLSearchParams(tokenRequest.body!);
  assertEquals(form.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  const assertion = form.get('assertion')!;
  assertEquals(decodeProtectedHeader(assertion).alg, 'RS256');
  const { payload } = await jwtVerify(assertion, publicKey, {
    issuer: clientEmail,
    audience: tokenUri,
    currentDate: now,
  });
  assertEquals(payload.scope, androidPublisherScope);
  assertEquals(payload.iat, now.getTime() / 1000);
  assertEquals(payload.exp, now.getTime() / 1000 + 3600);
});

Deno.test('verify: a license test purchase without an orderId is Sandbox, id from the token', async () => {
  const g = fakeGoogle({ [productUrl]: productLicenseTest });
  const { purchase, needsAcknowledge } = await play(g.fetch).verify(
    lifetimeProductId,
    purchaseToken,
  );
  assertEquals(purchase.environment, 'Sandbox');
  assertEquals(purchase.transactionId, await tokenTransactionId(purchaseToken));
  assert(/^token:[0-9a-f]{32}$/.test(purchase.transactionId));
  assertEquals([purchase.price, purchase.currency, purchase.tax], [null, null, null]);
  assertEquals(purchase.country, 'DE');
  assert(needsAcknowledge);
  // No orderId, no Orders API call.
  assertEquals(apiCalls(g.seen).length, 1);
});

Deno.test('verify: promo-code purchases count as Production', async () => {
  const g = fakeGoogle({
    [productUrl]: { ...productPurchased, purchaseType: 1 },
    [orderUrl]: order,
  });
  const { purchase } = await play(g.fetch).verify(lifetimeProductId, purchaseToken);
  assertEquals(purchase.environment, 'Production');
});

Deno.test('verify: pending is pending and is not acknowledged', async () => {
  const g = fakeGoogle({
    [productUrl]: productPending,
    [`${base}/orders/GPA.3301-2345-6789-05678`]: json(error404, 404),
  });
  const { purchase, needsAcknowledge } = await play(g.fetch).verify(
    lifetimeProductId,
    purchaseToken,
  );
  assert(purchase.pending);
  assertEquals(purchase.revokedAt, null);
  assert(!needsAcknowledge);
});

Deno.test('verify: canceled is revoked now', async () => {
  const g = fakeGoogle({ [productUrl]: productCanceled, [orderUrl]: order });
  const { purchase, needsAcknowledge } = await play(g.fetch).verify(
    lifetimeProductId,
    purchaseToken,
  );
  assertEquals(purchase.revokedAt, now);
  assert(!purchase.pending);
  assert(!needsAcknowledge);
});

Deno.test('verify: an acknowledged purchase needs no acknowledge', async () => {
  const g = fakeGoogle({ [productUrl]: productAcknowledged, [orderUrl]: order });
  const { needsAcknowledge } = await play(g.fetch).verify(lifetimeProductId, purchaseToken);
  assert(!needsAcknowledge);
});

Deno.test('verify: a wrong product is refused before asking Google', async () => {
  const g = fakeGoogle({});
  const e = await assertRejects(
    () => play(g.fetch).verify('com.hummlist.app.other', purchaseToken),
    Refused,
  );
  assertEquals(e.reason, 'wrong_product');
  assertEquals(g.seen.length, 0);
});

Deno.test('verify: Google naming another product is refused', async () => {
  const g = fakeGoogle({ [productUrl]: { ...productPurchased, productId: 'other' } });
  const e = await assertRejects(
    () => play(g.fetch).verify(lifetimeProductId, purchaseToken),
    Refused,
  );
  assertEquals(e.reason, 'wrong_product');
});

Deno.test('verify: 404 and 410 are an unknown purchase', async () => {
  for (const status of [400, 404, 410]) {
    const g = fakeGoogle({ [productUrl]: json(error404, status) });
    const e = await assertRejects(
      () => play(g.fetch).verify(lifetimeProductId, purchaseToken),
      Refused,
    );
    assertEquals(e.reason, 'unknown_purchase');
  }
});

Deno.test('verify: 503, 429 and network errors are StoreUnavailable', async () => {
  for (const route of [json(error503, 503), json(error503, 429), () => undefined]) {
    const g = fakeGoogle({ [productUrl]: route });
    await assertRejects(
      () => play(g.fetch).verify(lifetimeProductId, purchaseToken),
      StoreUnavailable,
    );
  }
});

Deno.test('verify: 403 is a configuration error', async () => {
  const g = fakeGoogle({ [productUrl]: json(error403, 403) });
  await assertRejects(
    () => play(g.fetch).verify(lifetimeProductId, purchaseToken),
    GoogleConfigError,
  );
});

Deno.test('a 401 fetches a new token once, then is a configuration error', async () => {
  const g = fakeGoogle({ [productUrl]: json(error403, 401) });
  await assertRejects(
    () => play(g.fetch).getProductPurchase(lifetimeProductId, purchaseToken),
    GoogleConfigError,
  );
  assertEquals(g.seen.filter((s) => s.url === tokenUri).length, 2);
  assertEquals(apiCalls(g.seen).length, 2);
});

Deno.test('a refused token request is a configuration error, a 5xx is unavailable', async () => {
  const refused = fakeGoogle({
    [tokenUri]: json({ error: 'invalid_grant', error_description: 'Invalid JWT Signature.' }, 400),
  });
  await assertRejects(() => play(refused.fetch).getOrder('GPA.1'), GoogleConfigError);
  const down = fakeGoogle({ [tokenUri]: json({}, 503) });
  await assertRejects(() => play(down.fetch).getOrder('GPA.1'), StoreUnavailable);
});

Deno.test('a malformed service account is a configuration error', () => {
  const fetch = fakeGoogle({}).fetch;
  for (
    const bad of [
      'not json',
      '{}',
      JSON.stringify({ client_email: clientEmail, private_key: 'x', token_uri: tokenUri }),
      JSON.stringify({ client_email: clientEmail, private_key: privatePem }),
    ]
  ) {
    let thrown: unknown;
    try {
      new GooglePlay({ serviceAccount: bad, fetch, now: () => now });
    } catch (e) {
      thrown = e;
    }
    assert(thrown instanceof GoogleConfigError);
    assert(!thrown.message.includes('PRIVATE KEY'));
  }
});

Deno.test('an unreadable private key is a configuration error', async () => {
  const broken = JSON.stringify({
    client_email: clientEmail,
    private_key: '-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----\n',
    token_uri: tokenUri,
  });
  const g = fakeGoogle({});
  const p = new GooglePlay({ serviceAccount: broken, fetch: g.fetch, now: () => now });
  await assertRejects(() => p.getOrder('GPA.1'), GoogleConfigError);
  assertEquals(g.seen.length, 0);
});

Deno.test('the access token is cached until a minute before it expires', async () => {
  let at = now;
  const g = fakeGoogle({ [productUrl]: productAcknowledged, [orderUrl]: order });
  const p = play(g.fetch, () => at);
  await p.verify(lifetimeProductId, purchaseToken);
  await p.verify(lifetimeProductId, purchaseToken);
  assertEquals(g.seen.filter((s) => s.url === tokenUri).length, 1);
  at = new Date(now.getTime() + (3599 - 61) * 1000);
  await p.getOrder('GPA.3301-2345-6789-01234');
  assertEquals(g.seen.filter((s) => s.url === tokenUri).length, 1);
  at = new Date(now.getTime() + (3599 - 60) * 1000);
  await p.getOrder('GPA.3301-2345-6789-01234');
  assertEquals(g.seen.filter((s) => s.url === tokenUri).length, 2);
});

Deno.test('concurrent calls share one token request', async () => {
  const g = fakeGoogle({ [orderUrl]: order });
  const p = play(g.fetch);
  await Promise.all([p.getOrder(order.orderId), p.getOrder(order.orderId)]);
  assertEquals(g.seen.filter((s) => s.url === tokenUri).length, 1);
});

Deno.test('acknowledge posts an empty body', async () => {
  const g = fakeGoogle({ [`${productUrl}:acknowledge`]: new Response(null, { status: 200 }) });
  await play(g.fetch).acknowledge(lifetimeProductId, purchaseToken);
  const [ack] = apiCalls(g.seen);
  assertEquals([ack.method, ack.body], ['POST', '{}']);
});

Deno.test('acknowledge: a 400 on an acknowledged purchase is done, else retry later', async () => {
  const done = fakeGoogle({
    [`${productUrl}:acknowledge`]: json(errorAck400, 400),
    [productUrl]: productAcknowledged,
  });
  await play(done.fetch).acknowledge(lifetimeProductId, purchaseToken);
  const notYet = fakeGoogle({
    [`${productUrl}:acknowledge`]: json(errorAck400, 400),
    [productUrl]: productPurchased,
  });
  await assertRejects(
    () => play(notYet.fetch).acknowledge(lifetimeProductId, purchaseToken),
    StoreUnavailable,
  );
});

Deno.test('acknowledge: 404 is unknown, 403 configuration, 503 unavailable', async () => {
  const ack = `${productUrl}:acknowledge`;
  const e = await assertRejects(
    () =>
      play(fakeGoogle({ [ack]: json(error404, 404) }).fetch).acknowledge(
        lifetimeProductId,
        purchaseToken,
      ),
    Refused,
  );
  assertEquals(e.reason, 'unknown_purchase');
  await assertRejects(
    () =>
      play(fakeGoogle({ [ack]: json(error403, 403) }).fetch).acknowledge(
        lifetimeProductId,
        purchaseToken,
      ),
    GoogleConfigError,
  );
  await assertRejects(
    () =>
      play(fakeGoogle({ [ack]: json(error503, 503) }).fetch).acknowledge(
        lifetimeProductId,
        purchaseToken,
      ),
    StoreUnavailable,
  );
});

Deno.test('verify: a failing Orders API still verifies, country from products.get', async () => {
  for (const answer of [json(error404, 404), json(error403, 403), json(error503, 503)]) {
    const g = fakeGoogle({ [productUrl]: productPurchased, [orderUrl]: answer });
    const { purchase } = await play(g.fetch).verify(lifetimeProductId, purchaseToken);
    assertEquals(purchase.transactionId, 'GPA.3301-2345-6789-01234');
    assertEquals([purchase.price, purchase.currency, purchase.tax], [null, null, null]);
    assertEquals(purchase.country, 'AT');
  }
});

Deno.test('verify: an order for another token is ignored', async () => {
  const g = fakeGoogle({
    [productUrl]: productPurchased,
    [orderUrl]: { ...order, purchaseToken: 'someone-else' },
  });
  const { purchase } = await play(g.fetch).verify(lifetimeProductId, purchaseToken);
  assertEquals([purchase.price, purchase.country], [null, 'AT']);
});

Deno.test('getOrder: a network error throws', async () => {
  const g = fakeGoogle({ [orderUrl]: () => undefined });
  await assertRejects(() => play(g.fetch).getOrder(order.orderId), StoreUnavailable);
});

Deno.test('path parts are URL-encoded', async () => {
  const token = 'a/b?c#d';
  const url = `${base}/purchases/products/${lifetimeProductId}/tokens/a%2Fb%3Fc%23d`;
  const g = fakeGoogle({ [url]: productLicenseTest });
  await play(g.fetch).verify(lifetimeProductId, token);
  assertEquals(apiCalls(g.seen)[0].url, url);
});

Deno.test('voidedPurchases follows the page token', async () => {
  const since = new Date(now.getTime() - 3_600_000);
  const first =
    `${base}/purchases/voidedpurchases?type=0&maxResults=1000&startTime=${since.getTime()}`;
  const second = `${base}/purchases/voidedpurchases?type=0&maxResults=1000&token=page-2`;
  const g = fakeGoogle({ [first]: voidedPage1, [second]: voidedPage2 });
  const voided = await play(g.fetch).voidedPurchases(since);
  assertEquals(voided, [
    {
      purchaseToken: 'voided-token-1',
      orderId: 'GPA.3301-0000-0000-00001',
      voidedAt: new Date(1761500000000),
      source: 'user',
      reason: 'remorse',
    },
    {
      purchaseToken: 'voided-token-2',
      orderId: 'GPA.3301-0000-0000-00002',
      voidedAt: new Date(1761600000000),
      source: 'google',
      reason: 'chargeback',
    },
    {
      purchaseToken: 'voided-token-3',
      orderId: null,
      voidedAt: new Date(1761700000000),
      source: 'developer',
      reason: 'unknown',
    },
  ]);
});

Deno.test('voidedPurchases looks back at most 30 days', async () => {
  const start = now.getTime() - voidedWindowMs;
  const url = `${base}/purchases/voidedpurchases?type=0&maxResults=1000&startTime=${start}`;
  const g = fakeGoogle({ [url]: { voidedPurchases: [] } });
  assertEquals(await play(g.fetch).voidedPurchases(new Date(0)), []);
});

Deno.test('voidedPurchases: 503 is StoreUnavailable', async () => {
  const since = new Date(now.getTime() - 3_600_000);
  const url =
    `${base}/purchases/voidedpurchases?type=0&maxResults=1000&startTime=${since.getTime()}`;
  const g = fakeGoogle({ [url]: json(error503, 503) });
  await assertRejects(() => play(g.fetch).voidedPurchases(since), StoreUnavailable);
});
