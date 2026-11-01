import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@^1';
import { encodeBase64 } from 'jsr:@std/encoding@^1/base64';
import { compare, type Io, run } from './price_drift.ts';
import { expectedPrices, lifetime, type Plan, yearly } from './product.ts';

type Prices = Record<Plan, Map<string, [currency: string, amount: string]>>;
interface World {
  apple: Prices;
  google: Prices;
}

/** What the stores charge for a storefront whose yearly amount isn't recorded yet. */
const unrecorded: Record<string, [string, string]> = {
  BR: ['BRL', '49.9'],
  MX: ['MXN', '179'],
  IN: ['INR', '799'],
};

/** Both stores selling exactly what expectedPrices says, plus Apple selling yearly in Japan. */
function matching(): World {
  const prices = (): Prices => {
    const p: Prices = { yearly: new Map(), lifetime: new Map() };
    for (const [region, s] of Object.entries(expectedPrices)) {
      for (const plan of ['yearly', 'lifetime'] as const) {
        const e = s[plan];
        if (e === 'not sold') continue;
        p[plan].set(region, e === null ? unrecorded[region] : [s.currency, e]);
      }
    }
    return p;
  };
  const world = { apple: prices(), google: prices() };
  world.apple.yearly.set('JPN', ['JPY', '1500']);
  return world;
}

const pem = (label: string, der: ArrayBuffer) =>
  `-----BEGIN ${label}-----\n${
    encodeBase64(der).match(/.{1,64}/g)!.join('\n')
  }\n-----END ${label}-----\n`;
const ecKey = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
]);
const rsaKey = await crypto.subtle.generateKey(
  {
    name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
  },
  true,
  ['sign'],
);
const p8 = pem('PRIVATE KEY', await crypto.subtle.exportKey('pkcs8', ecKey.privateKey));
const rsaPem = pem('PRIVATE KEY', await crypto.subtle.exportKey('pkcs8', rsaKey.privateKey));
const accessToken = 'fake-play-access-token-for-tests';
const secrets: Record<string, string> = {
  ASC_KEY_ID: 'FAKEKEYID9',
  ASC_ISSUER_ID: 'fake-issuer-0000-1111-2222',
  ASC_KEY_PATH: '/fake/AuthKey_FAKEKEYID9.p8',
  GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: JSON.stringify({
    client_email: 'drift@fake-project.iam.gserviceaccount.com',
    private_key: rsaPem,
    token_uri: 'https://oauth2.fake.test/token',
  }),
};

const alpha3 = new Map(Object.entries(expectedPrices).map(([a2, s]) => [a2, s.apple]));
const json = (body: unknown) => new Response(JSON.stringify(body));
const pricePage = (type: string, pointType: string, prices: Prices['yearly'], extra: unknown[]) => {
  const rows = [...prices].map(([region, [currency, amount]], i) => {
    const territory = alpha3.get(region) ?? region;
    return {
      row: {
        type,
        id: `${type}-${i}`,
        attributes: { startDate: null },
        relationships: {
          territory: { data: { type: 'territories', id: territory } },
          [pointType.slice(0, -1)]: { data: { type: pointType, id: `pp-${i}` } },
        },
      },
      included: [
        { type: pointType, id: `pp-${i}`, attributes: { customerPrice: amount } },
        { type: 'territories', id: territory, attributes: { currency } },
      ],
    };
  });
  return {
    data: [...rows.map((r) => r.row), ...extra],
    included: [...rows.flatMap((r) => r.included), {
      type: pointType,
      id: 'pp-later',
      attributes: { customerPrice: '99.99' },
    }],
  };
};
/** A price change scheduled for later: not today's price. */
const later = (type: string, pointType: string) => ({
  type,
  id: `${type}-later`,
  attributes: { startDate: '2099-01-01' },
  relationships: {
    territory: { data: { type: 'territories', id: 'DEU' } },
    [pointType.slice(0, -1)]: { data: { type: pointType, id: 'pp-later' } },
  },
});
const territories = (prices: Prices['yearly']) =>
  [...prices.keys()].map((r) => ({ type: 'territories', id: alpha3.get(r) ?? r }));
const money = ([currencyCode, amount]: [string, string]) => {
  const [units, fraction = ''] = amount.split('.');
  return { currencyCode, units, nanos: Number(fraction.padEnd(9, '0')) };
};

/** The App Store Connect and Play Developer API answers for the world, by method and URL. */
function fakeStores(world: World, seen: string[]) {
  const sub = `/v1/subscriptions/${yearly.appleId}`;
  const iap = `/v2/inAppPurchases/${lifetime.appleId}`;
  const subTerritories = territories(world.apple.yearly);
  const routes: Record<string, () => Response> = {
    [sub]: () =>
      json({
        data: { type: 'subscriptions', id: yearly.appleId, attributes: { productId: yearly.id } },
      }),
    [`${sub}/subscriptionAvailability`]: () =>
      json({ data: { type: 'subscriptionAvailabilities', id: 'sa1' } }),
    '/v1/subscriptionAvailabilities/sa1/availableTerritories?limit=200': () =>
      json({
        data: subTerritories.slice(0, 10),
        links: {
          next:
            'https://api.appstoreconnect.apple.com/v1/subscriptionAvailabilities/sa1/availableTerritories?cursor=2',
        },
      }),
    '/v1/subscriptionAvailabilities/sa1/availableTerritories?cursor=2': () =>
      json({ data: subTerritories.slice(10) }),
    [`${sub}/prices?include=subscriptionPricePoint,territory&limit=200`]: () =>
      json(pricePage('subscriptionPrices', 'subscriptionPricePoints', world.apple.yearly, [
        later('subscriptionPrices', 'subscriptionPricePoints'),
      ])),
    [iap]: () =>
      json({
        data: {
          type: 'inAppPurchases',
          id: lifetime.appleId,
          attributes: { productId: lifetime.id },
        },
      }),
    [`${iap}/inAppPurchaseAvailability`]: () =>
      json({ data: { type: 'inAppPurchaseAvailabilities', id: 'ia1' } }),
    '/v1/inAppPurchaseAvailabilities/ia1/availableTerritories?limit=200': () =>
      json({ data: territories(world.apple.lifetime) }),
    [`${iap}/iapPriceSchedule`]: () =>
      json({ data: { type: 'inAppPurchasePriceSchedules', id: 'ps1' } }),
    '/v1/inAppPurchasePriceSchedules/ps1/manualPrices?include=inAppPurchasePricePoint,territory&limit=200':
      () =>
        json(pricePage(
          'inAppPurchasePrices',
          'inAppPurchasePricePoints',
          new Map([...world.apple.lifetime].filter(([r]) => r === 'DE')),
          [later('inAppPurchasePrices', 'inAppPurchasePricePoints')],
        )),
    '/v1/inAppPurchasePriceSchedules/ps1/automaticPrices?include=inAppPurchasePricePoint,territory&limit=200':
      () =>
        json(pricePage(
          'inAppPurchasePrices',
          'inAppPurchasePricePoints',
          new Map([...world.apple.lifetime].filter(([r]) => r !== 'DE')),
          [],
        )),
    'POST https://oauth2.fake.test/token': () => json({ access_token: accessToken }),
    '/androidpublisher/v3/applications/com.hummlist.app/subscriptions/com.hummlist.app.yearly':
      () =>
        json({
          basePlans: [{
            basePlanId: 'yearly',
            state: 'ACTIVE',
            regionalConfigs: [...world.google.yearly].map(([regionCode, price]) => ({
              regionCode,
              newSubscriberAvailability: true,
              price: money(price),
            })),
          }],
        }),
    '/androidpublisher/v3/applications/com.hummlist.app/oneTimeProducts/com.hummlist.app.lifetime':
      () =>
        json({
          purchaseOptions: [{
            purchaseOptionId: 'buy',
            state: 'ACTIVE',
            regionalPricingAndAvailabilityConfigs: [
              ...[...world.google.lifetime].map(([regionCode, price]) => ({
                regionCode,
                availability: 'AVAILABLE',
                price: money(price),
              })),
              {
                regionCode: 'JP',
                availability: 'NO_LONGER_AVAILABLE',
                price: money(['JPY', '4500']),
              },
            ],
          }],
        }),
  };
  return (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const key = method === 'GET' ? url.pathname + url.search : `${method} ${url}`;
    if (method === 'GET') {
      const auth = new Headers(init?.headers).get('authorization') ?? '';
      seen.push(auth);
      assert(auth.startsWith('Bearer '), `${key} sent no bearer token`);
    }
    const route = routes[key];
    return Promise.resolve(route ? route() : new Response('not found', { status: 404 }));
  };
}

async function check(world: World, env: Record<string, string> = secrets, args: string[] = []) {
  const lines: string[] = [];
  const seen: string[] = [];
  const io: Io = {
    args,
    env: (k) => env[k],
    readTextFile: (path) =>
      path === secrets.ASC_KEY_PATH ? Promise.resolve(p8) : Promise.reject(new Error(path)),
    fetch: fakeStores(world, seen) as typeof fetch,
    log: (l) => lines.push(l),
    now: new Date('2026-11-01T05:17:00Z'),
  };
  const code = await run(io);
  return { code, out: lines.join('\n'), lines, seen };
}

const fails = (out: string) => out.split('\n').filter((l) => l.startsWith('FAIL: '));

Deno.test('every expected price on both stores passes, with notes for the unrecorded ones', async () => {
  const { code, out, lines } = await check(matching(), secrets, ['--require']);
  assertEquals(fails(out), []);
  assertEquals(code, 0);
  for (const region of ['BR', 'MX', 'IN']) {
    for (const store of ['App Store', 'Google Play']) {
      const [currency, amount] = unrecorded[region];
      assertStringIncludes(out, `note: yearly ${region} (${store}): ${amount} ${currency}`);
    }
  }
  assertStringIncludes(
    out,
    'note: info: yearly (App Store) also sold in 1 storefronts not listed: JPN',
  );
  assert(
    !out.includes('lifetime (Google Play) also sold'),
    'a no-longer-available region is not sold',
  );
  assertEquals(lines.at(-1), 'no drift');
});

Deno.test('drift in yearly DE, lifetime GB and CH fails naming plan, storefront and prices', async () => {
  const world = matching();
  world.apple.yearly.set('DE', ['EUR', '10.99']);
  world.google.lifetime.set('GB', ['GBP', '26.99']);
  world.apple.lifetime.set('CH', ['CHF', '31']);
  world.google.lifetime.delete('CH');
  const { code, out } = await check(world);
  assertEquals(code, 1);
  assertEquals(fails(out), [
    'FAIL: yearly DE (App Store): expected 9.99 EUR, found 10.99 EUR',
    'FAIL: lifetime CH (App Store): expected 30 CHF, found 31 CHF',
    'FAIL: lifetime GB (Google Play): expected 24.99 GBP, found 26.99 GBP',
    'FAIL: lifetime CH (Google Play): expected 30 CHF, found not sold',
  ]);
});

Deno.test('a price in the wrong currency is drift', () => {
  const { failures } = compare(expectedPrices, {
    'Google Play': [{ plan: 'yearly', storefront: 'US', currency: 'EUR', amount: '9.99' }],
  });
  assertStringIncludes(
    failures.join('\n'),
    'yearly US (Google Play): expected 9.99 USD, found 9.99 EUR',
  );
});

Deno.test('Lifetime on sale in BR, MX or IN fails', async () => {
  const world = matching();
  world.apple.lifetime.set('BR', ['BRL', '149.9']);
  world.google.lifetime.set('MX', ['MXN', '549']);
  world.google.lifetime.set('IN', ['INR', '2499']);
  const { code, out } = await check(world);
  assertEquals(code, 1);
  assertEquals(fails(out), [
    'FAIL: lifetime BR (App Store): expected not sold, found 149.9 BRL',
    'FAIL: lifetime MX (Google Play): expected not sold, found 549 MXN',
    'FAIL: lifetime IN (Google Play): expected not sold, found 2499 INR',
  ]);
});

Deno.test('yearly no longer sold where it should be fails, also in BR', async () => {
  const world = matching();
  world.google.yearly.delete('BR');
  const { code, out } = await check(world);
  assertEquals(code, 1);
  assertEquals(fails(out), ['FAIL: yearly BR (Google Play): expected sold (BRL), found not sold']);
});

Deno.test('missing secrets skip the store: exit 0, or 2 with --require', async () => {
  const none = await check(matching(), {});
  assertEquals(none.code, 0);
  for (
    const k of ['ASC_KEY_ID', 'ASC_ISSUER_ID', 'ASC_KEY_PATH', 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON']
  ) {
    assertStringIncludes(none.out, `SKIPPED: ${k} missing (NEEDS_LEAD Job 49)`);
  }
  assertEquals(none.seen, []);
  assertEquals((await check(matching(), {}, ['--require'])).code, 2);

  const { ASC_KEY_ID: _, ...noKeyId } = secrets;
  const apple = await check(matching(), noKeyId, ['--require']);
  assertEquals(apple.code, 2);
  assertStringIncludes(
    apple.out,
    'SKIPPED: ASC_KEY_ID missing (NEEDS_LEAD Job 49), App Store not checked',
  );
  assertStringIncludes(apple.out, 'checked: Google Play');
});

Deno.test('drift beats a skipped store: exit 1', async () => {
  const world = matching();
  world.google.yearly.set('DE', ['EUR', '8.99']);
  const { ASC_KEY_ID: _, ...googleOnly } = secrets;
  assertEquals((await check(world, googleOnly, ['--require'])).code, 1);
});

Deno.test('no key, token or Authorization header in the output', async () => {
  const world = matching();
  world.apple.yearly.set('DE', ['EUR', '10.99']);
  const runs = [
    await check(world),
    await check(world, {
      ...secrets,
      GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: `{"private_key":"${rsaPem}`,
    }),
  ];
  const tokens = runs.flatMap((r) => r.seen).map((h) => h.slice('Bearer '.length));
  assert(tokens.includes(accessToken), 'the Play calls used the access token');
  assert(tokens.some((t) => t.startsWith('eyJ')), 'the App Store calls used a signed JWT');
  assertStringIncludes(
    runs[1].out,
    'FAIL: Google Play: GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not a service account key',
  );
  const keyBody = (k: string) => k.split('\n')[1];
  for (const { out } of runs) {
    for (
      const secret of [
        secrets.ASC_KEY_ID,
        secrets.ASC_ISSUER_ID,
        keyBody(p8),
        keyBody(rsaPem),
        'PRIVATE KEY',
        ...tokens,
      ]
    ) {
      assert(!out.includes(secret), `output contains a secret: ${secret.slice(0, 6)}...`);
    }
    assert(!/authorization|bearer/i.test(out), 'output names an Authorization header');
  }
});
