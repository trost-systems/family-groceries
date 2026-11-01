// Purchase events for the lifetime unlock (docs/ANALYTICS.md, "Purchases"). Revenue reaches
// PostHog only from here, after the store verified the transaction; the app never reports a
// price. The purchases function (RevenueCat's webhook, job 43) sends its events through
// [sendPurchaseEvent]; [recordPurchase] and the fake verifier are job 19's harness for the same
// mapping.
import { Subject, Telemetry } from './telemetry.ts';

export type AppStore = 'apple' | 'google';

/** A new purchase, the store taking it back, or the app restoring one bought before. */
export type PurchaseKind = 'purchase' | 'refund' | 'restore';

/** A transaction the store confirmed; amounts in major units (4.99), prices incl. VAT. */
export interface VerifiedTransaction {
  store: AppStore;
  kind: PurchaseKind;
  productId: string;
  /** The store's id of the original purchase: refunds and restores point at it. */
  originalTransactionId: string;
  /** What the customer paid, VAT included. */
  price: number;
  currency: string;
  /** ISO 3166-1 alpha-2, e.g. DE; null when the store did not say. */
  country: string | null;
  /** VAT (or sales tax) in [price], when the store reports it (Google's Orders API). */
  tax: number | null;
}

export class UnverifiedPurchase extends Error {}

/** Checks a purchase with its store and returns what the store confirms, or throws. */
export interface PurchaseVerifier {
  verify(payload: unknown): Promise<VerifiedTransaction>;
}

/**
 * Accepts only payloads marked `{fake: true}` and maps their decoded store data like the real
 * verifiers will: `apple` is a decoded JWSTransactionDecodedPayload, `google` an Orders API
 * order. For tests and local proofs; never deployed.
 */
export class FakePurchaseVerifier implements PurchaseVerifier {
  verify(payload: unknown): Promise<VerifiedTransaction> {
    const p = payload as {
      fake?: boolean;
      kind?: PurchaseKind;
      apple?: AppleTransaction;
      google?: GoogleOrder;
    } | null;
    if (!p?.fake || !p.kind) return Promise.reject(new UnverifiedPurchase('not verified'));
    if (p.apple) return Promise.resolve(fromApple(p.apple, p.kind));
    if (p.google) return Promise.resolve(fromGoogle(p.google, p.kind));
    return Promise.reject(new UnverifiedPurchase('no store data'));
  }
}

/** The fields of Apple's JWSTransactionDecodedPayload this needs. */
export interface AppleTransaction {
  originalTransactionId: string;
  productId: string;
  /** Milliunits: 4990 is 4.99. */
  price: number;
  currency: string;
  /** Alpha-3 storefront, e.g. DEU. */
  storefront: string;
}

/** The fields of a Google Play Orders API order this needs. */
export interface GoogleOrder {
  orderId: string;
  productId: string;
  total: Money;
  tax?: Money;
  /** Where the buyer is: alpha-2, e.g. DE (the Orders API's buyerAddress). */
  buyerAddress?: { buyerCountry?: string };
  /** Older stand-in for the buyer's country; products.get's regionCode. */
  regionCode?: string;
}

export interface Money {
  currencyCode: string;
  units: string;
  nanos?: number;
}

const alpha2: Record<string, string> = { DEU: 'DE', AUT: 'AT', CHE: 'CH', LIE: 'LI', LUX: 'LU' };

export function fromApple(t: AppleTransaction, kind: PurchaseKind): VerifiedTransaction {
  return {
    store: 'apple',
    kind,
    productId: t.productId,
    originalTransactionId: t.originalTransactionId,
    price: t.price / 1000,
    currency: t.currency,
    country: alpha2[t.storefront] ?? null,
    tax: null,
  };
}

/** A Money amount in major units: units 4, nanos 990000000 is 4.99. */
export const major = (m: Money) => Number(m.units) + (m.nanos ?? 0) / 1e9;

export function fromGoogle(o: GoogleOrder, kind: PurchaseKind): VerifiedTransaction {
  return {
    store: 'google',
    kind,
    productId: o.productId,
    originalTransactionId: o.orderId,
    price: major(o.total),
    currency: o.total.currencyCode,
    country: [o.buyerAddress?.buyerCountry, o.regionCode].find((c) => c && /^[A-Z]{2}$/.test(c)) ??
      null,
    tax: o.tax ? major(o.tax) : null,
  };
}

/** Standard VAT rates for digital services where the app sells first (DACH). */
export const vatRates: Record<string, number> = { DE: 0.19, AT: 0.2, CH: 0.081, LI: 0.081 };

/** Both stores' reduced fee (Small Business Program / first $1M); 30 % above that. */
export const defaultStoreFee = 0.15;

/**
 * What stays after VAT and the store's fee, rounded to cents: the store-reported tax if any,
 * else the country's VAT rate. Null when neither is known. Estimated: the stores' monthly
 * financial reports are the real proceeds (docs/ANALYTICS.md).
 */
export function netAmount(
  t: Pick<Revenue, 'price' | 'country' | 'tax'>,
  storeFee = defaultStoreFee,
): number | null {
  if (t.price === null) return null;
  const price = t.price;
  const rate = t.country ? vatRates[t.country] : undefined;
  const tax = t.tax ?? (rate === undefined ? null : price - price / (1 + rate));
  if (tax === null) return null;
  return Math.round((price - tax) * (1 - storeFee) * 100) / 100;
}

/** A stable pseudonymous reference to the original transaction (no raw store id). */
export async function transactionRef(
  t: Pick<VerifiedTransaction, 'store' | 'originalTransactionId'>,
): Promise<string> {
  const data = new TextEncoder().encode(`${t.store}:${t.originalTransactionId}`);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return Array.from(hash.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** What the app says about the buyer: its install, if it agreed to analytics. */
export interface Buyer {
  consent: boolean;
  installId: string | null;
  householdId: string | null;
}

/**
 * Verifies [payload] and, for a buyer who agreed to analytics, queues the matching event:
 * purchase_completed or purchase_refunded with price, currency and net amount,
 * purchase_restored without revenue. Throws [UnverifiedPurchase] for a payload the store did
 * not confirm: nothing is sent then. Returns the event's name, or null when none was queued.
 */
export async function recordPurchase(
  payload: unknown,
  buyer: Buyer,
  deps: { verifier: PurchaseVerifier; telemetry: Telemetry },
): Promise<string | null> {
  const t = await deps.verifier.verify(payload);
  if (!buyer.consent || !buyer.installId) return null;
  const subject: Subject = { installId: buyer.installId, householdId: buyer.householdId };
  const name = t.kind === 'purchase'
    ? 'purchase_completed'
    : t.kind === 'refund'
    ? 'purchase_refunded'
    : 'purchase_restored';
  return await sendPurchaseEvent(deps.telemetry, name, t, subject) ? name : null;
}

export type PurchaseEvent = 'purchase_completed' | 'purchase_refunded' | 'purchase_restored';

/** What a purchase event says about the money; price and currency may be unknown (Google). */
export type Revenue = Omit<VerifiedTransaction, 'kind' | 'price' | 'currency'> & {
  price: number | null;
  currency: string | null;
  /** Job 49: the Hummlist Premium product's plan; job 19's harness has none. */
  premiumSource?: 'yearly' | 'lifetime';
};

/**
 * Queues [name] for [subject]: purchase_completed and purchase_refunded with price, currency and
 * net amount when known, country and the hashed transaction_ref; purchase_restored with the
 * product and store only. False when nothing was queued (telemetry off, refused by the catalog).
 */
export async function sendPurchaseEvent(
  telemetry: Telemetry,
  name: PurchaseEvent,
  t: Revenue,
  subject: Subject,
): Promise<boolean> {
  const net = netAmount(t);
  const properties: Record<string, unknown> = name === 'purchase_restored'
    ? { product_id: t.productId, app_store: t.store }
    : {
      product_id: t.productId,
      app_store: t.store,
      ...(t.price === null || t.currency === null ? {} : { price: t.price, currency: t.currency }),
      ...(t.country ? { country: t.country } : {}),
      ...(net === null || t.currency === null ? {} : { net_amount: net }),
      transaction_ref: await transactionRef(t),
      ...(t.premiumSource ? { premium_source: t.premiumSource } : {}),
    };
  return telemetry.event(name, subject, properties);
}
