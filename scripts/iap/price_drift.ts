// Checks that the App Store and Google Play still charge what product.ts expectedPrices says, for
// Hummlist Premium yearly and Lifetime in every listed storefront (job 49). Read-only: it only
// GETs. Fails (exit 1) on a price that drifted, a storefront that stopped selling a plan, or
// Lifetime on sale where it must not be; prints the yearly prices of storefronts whose amount is
// not recorded yet, and the storefronts sold in but not listed.
//
//   ASC_KEY_ID=<key id> ASC_ISSUER_ID=<issuer> ASC_KEY_PATH=<AuthKey .p8> \
//   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON="$(cat <key file>)" \
//     deno run --allow-env --allow-read --allow-net scripts/iap/price_drift.ts [--require]
//
// A store whose secrets are missing is skipped (exit 0); --require makes that exit 2, so the
// scheduled run (.github/workflows/price-drift.yml) shows missing setup. Never prints a key or token.
import { ascTokens } from './apple_product.ts';
import {
  packageName,
  playAccessToken,
  purchaseOptionId,
  type ServiceAccount,
} from './google_product.ts';
import {
  type ExpectedPrice,
  expectedPrices,
  lifetime,
  type Plan,
  type Storefront,
  yearly,
} from './product.ts';

export type Store = 'App Store' | 'Google Play';

/** A plan on sale in a storefront today: ISO alpha-2, or Apple's alpha-3 when not in expectedPrices. */
export interface Offer {
  plan: Plan;
  storefront: string;
  currency: string;
  amount: string;
}

export interface Result {
  failures: string[];
  notes: string[];
}

const plans: readonly Plan[] = ['yearly', 'lifetime'];

const shown = (e: ExpectedPrice, currency: string) =>
  e === 'not sold' ? e : e === null ? `sold (${currency})` : `${e} ${currency}`;

/** Compares the offers of each checked store with the expected prices. */
export function compare(
  expected: Readonly<Record<string, Storefront>>,
  found: Partial<Record<Store, Offer[]>>,
): Result {
  const failures: string[] = [];
  const notes: string[] = [];
  for (const [store, offers] of Object.entries(found) as [Store, Offer[]][]) {
    for (const plan of plans) {
      const byStorefront = new Map(
        offers.filter((o) => o.plan === plan).map((o) => [o.storefront, o]),
      );
      for (const [storefront, want] of Object.entries(expected)) {
        const e = want[plan];
        const offer = byStorefront.get(storefront);
        byStorefront.delete(storefront);
        const what = `${plan} ${storefront} (${store})`;
        const got = offer ? `${offer.amount} ${offer.currency}` : 'not sold';
        if (e === 'not sold') {
          if (offer) failures.push(`${what}: expected not sold, found ${got}`);
        } else if (!offer || offer.currency !== want.currency) {
          failures.push(`${what}: expected ${shown(e, want.currency)}, found ${got}`);
        } else if (e === null) {
          notes.push(`${what}: ${got} (record what the store reports in expectedPrices)`);
        } else if (Number(offer.amount) !== Number(e)) {
          failures.push(`${what}: expected ${e} ${want.currency}, found ${got}`);
        }
      }
      if (byStorefront.size) {
        const rest = [...byStorefront.keys()].sort();
        notes.push(
          `info: ${plan} (${store}) also sold in ${rest.length} storefronts not listed: ${
            rest.join(' ')
          }`,
        );
      }
    }
  }
  return { failures, notes };
}

type Json = Record<string, unknown>;
interface Resource {
  type: string;
  id: string;
  attributes?: Json;
  relationships?: Record<string, { data?: { id: string } | null }>;
}
interface Page {
  data: Resource | Resource[];
  included?: Resource[];
  links?: { next?: string };
}
/** GETs a path (or a full next-page URL); null when the resource doesn't exist (404). */
type Get = (path: string) => Promise<Page | null>;

async function* pages(get: Get, path: string): AsyncGenerator<Page> {
  let next: string | undefined = path;
  while (next) {
    const page: Page | null = await get(next);
    if (!page) return;
    yield page;
    next = page.links?.next;
  }
}

const day = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Today's price per territory from App Store Connect price rows (subscriptionPrices or
 * inAppPurchasePrices with their included price points and territories): the latest row that
 * started and hasn't ended.
 */
async function applePrices(get: Get, path: string, pointType: string, today: string) {
  const pointKey = pointType.slice(0, -1);
  const current = new Map<string, { start: string; currency: string; amount: string }>();
  for await (const page of pages(get, path)) {
    const included = new Map((page.included ?? []).map((r) => [`${r.type}/${r.id}`, r]));
    for (const row of [page.data].flat()) {
      const a = row.attributes ?? {};
      const start = (a.startDate as string | null) ?? '';
      const end = a.endDate as string | null | undefined;
      if (start > today || (end && end <= today) || a.planType === 'MONTHLY') continue;
      const territory = row.relationships?.territory?.data?.id;
      const pointId = row.relationships?.[pointKey]?.data?.id;
      if (!territory || !pointId) continue;
      const amount = included.get(`${pointType}/${pointId}`)?.attributes?.customerPrice as string;
      const currency = included.get(`territories/${territory}`)?.attributes?.currency as string;
      const prev = current.get(territory);
      if (!amount || (prev && prev.start > start)) continue;
      current.set(territory, { start, currency: currency ?? '', amount });
    }
  }
  return current;
}

async function appleTerritories(get: Get, path: string) {
  const ids = new Set<string>();
  for await (const page of pages(get, path)) for (const t of [page.data].flat()) ids.add(t.id);
  return ids;
}

async function appleProductId(get: Get, path: string) {
  const page = await get(path);
  return (page?.data as Resource | undefined)?.attributes?.productId;
}

/** Both plans as App Store Connect sells them today, by their Apple IDs in product.ts. */
export async function appleOffers(get: Get, now: Date): Promise<Offer[]> {
  const today = day(now);
  const alpha2 = new Map(Object.entries(expectedPrices).map(([a2, s]) => [s.apple, a2]));
  const offers: Offer[] = [];
  const add = (
    plan: Plan,
    prices: Map<string, { currency: string; amount: string }>,
    sold: Set<string>,
  ) => {
    for (const [territory, p] of prices) {
      if (!sold.has(territory)) continue;
      offers.push({
        plan,
        storefront: alpha2.get(territory) ?? territory,
        currency: p.currency,
        amount: p.amount,
      });
    }
  };

  const subscription = `/v1/subscriptions/${yearly.appleId}`;
  const yearlyId = await appleProductId(get, subscription);
  if (yearlyId !== yearly.id) {
    throw new Error(
      `App Store: subscription ${yearly.appleId} is ${yearlyId ?? 'missing'}, not ${yearly.id}`,
    );
  }
  const subAvailability = await get(`${subscription}/subscriptionAvailability`);
  const subSold = subAvailability
    ? await appleTerritories(
      get,
      `/v1/subscriptionAvailabilities/${
        (subAvailability.data as Resource).id
      }/availableTerritories?limit=200`,
    )
    : new Set<string>();
  add(
    'yearly',
    await applePrices(
      get,
      `${subscription}/prices?include=subscriptionPricePoint,territory&limit=200`,
      'subscriptionPricePoints',
      today,
    ),
    subSold,
  );

  const iap = `/v2/inAppPurchases/${lifetime.appleId}`;
  const lifetimeId = await appleProductId(get, iap);
  if (lifetimeId !== lifetime.id) {
    throw new Error(
      `App Store: in-app purchase ${lifetime.appleId} is ${
        lifetimeId ?? 'missing'
      }, not ${lifetime.id}`,
    );
  }
  const iapAvailability = await get(`${iap}/inAppPurchaseAvailability`);
  const iapSold = iapAvailability
    ? await appleTerritories(
      get,
      `/v1/inAppPurchaseAvailabilities/${
        (iapAvailability.data as Resource).id
      }/availableTerritories?limit=200`,
    )
    : new Set<string>();
  const schedule = await get(`${iap}/iapPriceSchedule`);
  if (schedule) {
    const id = (schedule.data as Resource).id;
    const prices = new Map<string, { currency: string; amount: string }>();
    for (const kind of ['automaticPrices', 'manualPrices']) {
      const rows = await applePrices(
        get,
        `/v1/inAppPurchasePriceSchedules/${id}/${kind}?include=inAppPurchasePricePoint,territory&limit=200`,
        'inAppPurchasePricePoints',
        today,
      );
      for (const [t, p] of rows) prices.set(t, p);
    }
    add('lifetime', prices, iapSold);
  }
  return offers;
}

interface Money {
  currencyCode: string;
  units?: string;
  nanos?: number;
}
const amountOf = (m: Money) =>
  `${m.units ?? '0'}.${String(m.nanos ?? 0).padStart(9, '0')}`.replace(/\.?0+$/, '');

/** Both plans as Google Play sells them: the yearly base plan and Lifetime's buy option. */
export async function googleOffers(get: (path: string) => Promise<Json | null>): Promise<Offer[]> {
  const offers: Offer[] = [];
  const app = `/applications/${packageName}`;
  const sub = await get(`${app}/subscriptions/${yearly.id}`) as {
    basePlans?: {
      basePlanId: string;
      state?: string;
      regionalConfigs?: { regionCode: string; newSubscriberAvailability?: boolean; price: Money }[];
    }[];
  } | null;
  const plan = sub?.basePlans?.find((p) => p.basePlanId === yearly.playBasePlanId);
  if (plan?.state === 'ACTIVE') {
    for (const c of plan.regionalConfigs ?? []) {
      if (c.newSubscriberAvailability === false) continue;
      offers.push({
        plan: 'yearly',
        storefront: c.regionCode,
        currency: c.price.currencyCode,
        amount: amountOf(c.price),
      });
    }
  }
  const once = await get(`${app}/oneTimeProducts/${lifetime.id}`) as {
    purchaseOptions?: {
      purchaseOptionId: string;
      state?: string;
      regionalPricingAndAvailabilityConfigs?: {
        regionCode: string;
        availability?: string;
        price?: Money;
      }[];
    }[];
  } | null;
  const option = once?.purchaseOptions?.find((o) => o.purchaseOptionId === purchaseOptionId);
  if (option?.state === 'ACTIVE') {
    for (const c of option.regionalPricingAndAvailabilityConfigs ?? []) {
      if (c.availability !== 'AVAILABLE' || !c.price) continue;
      offers.push({
        plan: 'lifetime',
        storefront: c.regionCode,
        currency: c.price.currencyCode,
        amount: amountOf(c.price),
      });
    }
  }
  return offers;
}

export interface Io {
  args: string[];
  env: (name: string) => string | undefined;
  readTextFile: (path: string) => Promise<string>;
  fetch: typeof fetch;
  log: (line: string) => void;
  now: Date;
}

const appleEnv = ['ASC_KEY_ID', 'ASC_ISSUER_ID', 'ASC_KEY_PATH'] as const;
const googleEnv = 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON';

/** A GET through io.fetch that answers null on 404 and throws on other errors (status only). */
function getter(io: Io, base: string, token: () => Promise<string>) {
  return async (path: string) => {
    const url = path.startsWith('https://') ? path : `${base}${path}`;
    const res = await io.fetch(url, { headers: { authorization: `Bearer ${await token()}` } });
    if (res.status === 404) {
      await res.body?.cancel();
      return null;
    }
    if (!res.ok) {
      await res.body?.cancel();
      throw new Error(`GET ${new URL(url).pathname}: ${res.status}`);
    }
    return await res.json();
  };
}

async function apple(io: Io): Promise<Offer[]> {
  const [keyId, issuer, keyPath] = appleEnv.map((k) => io.env(k)!);
  let token: () => Promise<string>;
  try {
    token = await ascTokens(await io.readTextFile(keyPath), keyId, issuer);
  } catch {
    throw new Error('ASC_KEY_PATH is not a readable App Store Connect .p8 key');
  }
  return await appleOffers(getter(io, 'https://api.appstoreconnect.apple.com', token), io.now);
}

async function google(io: Io): Promise<Offer[]> {
  let sa: ServiceAccount;
  try {
    sa = JSON.parse(io.env(googleEnv)!);
    if (!sa.client_email || !sa.private_key || !sa.token_uri) throw new Error();
  } catch {
    // JSON.parse quotes the input in its message: never pass it on.
    throw new Error(`${googleEnv} is not a service account key (JSON)`);
  }
  const accessToken = await playAccessToken(sa, io.fetch);
  return await googleOffers(
    getter(
      io,
      'https://androidpublisher.googleapis.com/androidpublisher/v3',
      () => Promise.resolve(accessToken),
    ),
  );
}

/** Runs the check; the exit code: 0 green, 1 drift or a store error, 2 a store skipped under --require. */
export async function run(io: Io): Promise<number> {
  const stores: { store: Store; missing: string[]; offers: (io: Io) => Promise<Offer[]> }[] = [
    { store: 'App Store', missing: appleEnv.filter((k) => !io.env(k)), offers: apple },
    { store: 'Google Play', missing: io.env(googleEnv) ? [] : [googleEnv], offers: google },
  ];
  const found: Partial<Record<Store, Offer[]>> = {};
  const errors: string[] = [];
  let skipped = false;
  for (const { store, missing, offers } of stores) {
    if (missing.length) {
      for (const k of missing) {
        io.log(`SKIPPED: ${k} missing (NEEDS_LEAD Job 49), ${store} not checked`);
      }
      skipped = true;
      continue;
    }
    try {
      found[store] = await offers(io);
    } catch (e) {
      errors.push(`${store}: ${(e as Error).message}`);
    }
  }
  const { failures, notes } = compare(expectedPrices, found);
  for (const n of notes) io.log(`note: ${n}`);
  for (const f of [...errors, ...failures]) io.log(`FAIL: ${f}`);
  for (const store of Object.keys(found)) io.log(`checked: ${store}`);
  if (errors.length || failures.length) return 1;
  if (skipped && io.args.includes('--require')) return 2;
  io.log(skipped ? 'no drift in the stores checked' : 'no drift');
  return 0;
}

if (import.meta.main) {
  Deno.exit(
    await run({
      args: Deno.args,
      env: (k) => Deno.env.get(k),
      readTextFile: Deno.readTextFile,
      fetch,
      log: console.log,
      now: new Date(),
    }),
  );
}
