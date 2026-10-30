// Creates Hummlist Lifetime in App Store Connect through the App Store Connect API, without
// submitting it for review (docs/PURCHASES.md, "Store setup"). Dry run by default: it reads what
// exists and prints each write it would make. --apply makes them. Idempotent: it skips whatever
// exists (the product, a localization, a price schedule, availability).
//
//   ASC_KEY_ID=4J3N457M89 ASC_ISSUER_ID=<issuer> ASC_KEY_PATH=<AuthKey .p8> \
//     deno run --allow-env --allow-read --allow-net scripts/iap/apple_product.ts [--apply]
//
// Needs an App Store Connect API key with the App Manager or Admin role (the Lead's
// family-groceries-ci key). Prints ids and prices, never the key. Never creates a review
// submission or a review screenshot: those stay manual, after Peter's go (NEEDS_PETER Job 25).
import { importPKCS8, SignJWT } from 'npm:jose@6.2.13';
import { product } from './product.ts';

export const appAppleId = '6826922741';
const api = 'https://api.appstoreconnect.apple.com';

type Json = Record<string, unknown>;

export function createProductBody(appId = appAppleId): Json {
  return {
    data: {
      type: 'inAppPurchases',
      attributes: {
        name: product.referenceName,
        productId: product.id,
        inAppPurchaseType: 'NON_CONSUMABLE',
        familySharable: product.familySharable,
      },
      relationships: { app: { data: { type: 'apps', id: appId } } },
    },
  };
}

export function localizationBody(iapId: string, listing: (typeof product.listings)[number]): Json {
  return {
    data: {
      type: 'inAppPurchaseLocalizations',
      attributes: { locale: listing.apple, name: listing.name, description: listing.description },
      relationships: { inAppPurchaseV2: { data: { type: 'inAppPurchases', id: iapId } } },
    },
  };
}

/** A manual price in the base territory; Apple equalizes the others (automatic prices). */
export function priceScheduleBody(iapId: string, pricePointId: string): Json {
  const priceId = '${base-price}';
  return {
    data: {
      type: 'inAppPurchasePriceSchedules',
      relationships: {
        inAppPurchase: { data: { type: 'inAppPurchases', id: iapId } },
        baseTerritory: { data: { type: 'territories', id: product.basePrice.territory } },
        manualPrices: { data: [{ type: 'inAppPurchasePrices', id: priceId }] },
      },
    },
    included: [{
      type: 'inAppPurchasePrices',
      id: priceId,
      attributes: { startDate: null },
      relationships: {
        inAppPurchasePricePoint: { data: { type: 'inAppPurchasePricePoints', id: pricePointId } },
      },
    }],
  };
}

export function availabilityBody(iapId: string, territories: string[]): Json {
  return {
    data: {
      type: 'inAppPurchaseAvailabilities',
      attributes: { availableInNewTerritories: true },
      relationships: {
        inAppPurchase: { data: { type: 'inAppPurchases', id: iapId } },
        availableTerritories: { data: territories.map((id) => ({ type: 'territories', id })) },
      },
    },
  };
}

/** The price point whose customer price is the base price, e.g. "9.99". */
export function basePricePoint(points: { id: string; attributes: { customerPrice: string } }[]) {
  return points.find((p) =>
    Number(p.attributes.customerPrice) === Number(product.basePrice.amount)
  );
}

async function main() {
  const apply = Deno.args.includes('--apply');
  const env = (k: string) => {
    const v = Deno.env.get(k);
    if (!v) throw new Error(`${k} is not set`);
    return v;
  };
  const key = await importPKCS8(await Deno.readTextFile(env('ASC_KEY_PATH')), 'ES256');
  const token = async () =>
    await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: env('ASC_KEY_ID'), typ: 'JWT' })
      .setIssuer(env('ASC_ISSUER_ID'))
      .setIssuedAt()
      .setExpirationTime('15m')
      .setAudience('appstoreconnect-v1')
      .sign(key);
  const call = async (method: string, path: string, body?: Json): Promise<Json> => {
    const res = await fetch(`${api}${path}`, {
      method,
      headers: { authorization: `Bearer ${await token()}`, 'content-type': 'application/json' },
      body: body && JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${text.slice(0, 800)}`);
    return text ? JSON.parse(text) : {};
  };
  const write = async (what: string, method: string, path: string, body: Json) => {
    if (!apply) {
      console.log(`would ${what}: ${method} ${path}`);
      return null;
    }
    const out = await call(method, path, body);
    console.log(`${what}: done`);
    return out;
  };

  const existing = await call(
    'GET',
    `/v1/apps/${appAppleId}/inAppPurchasesV2?filter[productId]=${product.id}`,
  ) as { data: { id: string }[] };
  let iapId = existing.data[0]?.id;
  if (iapId) console.log(`product exists: ${iapId}`);
  else {
    const created = await write(
      'create the product',
      'POST',
      '/v2/inAppPurchases',
      createProductBody(),
    );
    iapId = (created as { data?: { id: string } } | null)?.data?.id ?? '';
    if (!iapId) return console.log('dry run: stopping before the steps that need the product id');
  }

  const locs = await call('GET', `/v2/inAppPurchases/${iapId}/inAppPurchaseLocalizations`) as {
    data: { attributes: { locale: string } }[];
  };
  for (const listing of product.listings) {
    if (locs.data.some((l) => l.attributes.locale === listing.apple)) continue;
    await write(
      `add ${listing.apple}`,
      'POST',
      '/v1/inAppPurchaseLocalizations',
      localizationBody(iapId, listing),
    );
  }

  const points = await call(
    'GET',
    `/v2/inAppPurchases/${iapId}/pricePoints?filter[territory]=${product.basePrice.territory}&limit=8000`,
  ) as { data: { id: string; attributes: { customerPrice: string } }[] };
  const base = basePricePoint(points.data);
  if (!base) throw new Error(`no ${product.basePrice.amount} price point in DEU`);
  const schedule = await fetch(`${api}/v2/inAppPurchases/${iapId}/iapPriceSchedule`, {
    headers: { authorization: `Bearer ${await token()}` },
  });
  await schedule.body?.cancel();
  if (schedule.status === 404) {
    await write(
      `set ${product.basePrice.amount} EUR in Germany`,
      'POST',
      '/v1/inAppPurchasePriceSchedules',
      priceScheduleBody(iapId, base.id),
    );
  } else console.log('price schedule exists');

  const equal = await call(
    'GET',
    `/v1/inAppPurchasePricePoints/${base.id}/equalizations?filter[territory]=AUT,CHE&include=territory&limit=10`,
  ) as { data: { attributes: { customerPrice: string }; relationships: Json }[] };
  for (const p of equal.data) {
    const t = (p.relationships.territory as { data: { id: string } }).data.id;
    console.log(`equalized price ${t}: ${p.attributes.customerPrice}`);
  }

  const availability = await fetch(
    `${api}/v2/inAppPurchases/${iapId}/inAppPurchaseAvailability`,
    { headers: { authorization: `Bearer ${await token()}` } },
  );
  await availability.body?.cancel();
  if (availability.status === 404) {
    const territories = await call('GET', '/v1/territories?limit=200') as {
      data: { id: string }[];
    };
    await write(
      `make it available in ${territories.data.length} territories`,
      'POST',
      '/v1/inAppPurchaseAvailabilities',
      availabilityBody(iapId, territories.data.map((t) => t.id)),
    );
  } else console.log('availability exists');
  console.log('not submitted for review (never by this script)');
}

if (import.meta.main) await main();
