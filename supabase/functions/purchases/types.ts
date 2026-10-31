// What the purchases function knows about a purchase (docs/PURCHASES.md). RevenueCat checks it with
// the store; its webhook (revenuecat.ts) turns each event into one of these.
import type { AppStore } from '../_shared/purchases.ts';

/**
 * RevenueCat's webhook, below /functions/v1 (ADDENDUM 6). Registered with
 * `?forceFunctionRegion=eu-central-1`; scripts/iap/webhook_url_test.ts checks every place that
 * documents the URL.
 */
export const webhookPath = '/purchases/revenuecat/webhook';

/** Hummlist Lifetime, a non-consumable, same id on both stores (scripts/iap/product.ts). */
export const lifetimeProductId = 'com.hummlist.app.lifetime';

/**
 * What an unlock grants (`entitlements.kind`). A later subscription adds its own kind next to
 * lifetime, never instead of it (docs/PURCHASES.md, "A second entitlement").
 */
export type EntitlementKind = 'lifetime';

/** Every product this function records and the kind it unlocks. Events for others are ignored. */
const productKinds: Readonly<Record<string, EntitlementKind>> = {
  [lifetimeProductId]: 'lifetime',
};

export const kindOf = (productId: string): EntitlementKind | null =>
  Object.hasOwn(productKinds, productId) ? productKinds[productId] : null;

/**
 * Where a transaction happened. Sandbox is Apple's sandbox and TestFlight, and Google Play's
 * license-test purchases; Production is a real sale.
 */
export type StoreEnvironment = 'Production' | 'Sandbox';

/** What analytics says about a purchase (purchase_completed, purchase_refunded). */
export interface Sale {
  store: AppStore;
  /** The original transaction: Apple's originalTransactionId, Google's order id (GPA.…). */
  transactionId: string;
  productId: string;
  environment: StoreEnvironment;
  /** What the customer paid in major units, VAT included; null when unknown. */
  price: number | null;
  /** ISO 4217, e.g. EUR. */
  currency: string | null;
  /** ISO 3166-1 alpha-2, e.g. DE. */
  country: string | null;
  householdId: string | null;
}

/** A purchase RevenueCat reports for a household (its App User ID). */
export interface StorePurchase extends Sale {
  householdId: string;
  /** The event's own transaction; the app's claim may name it instead of the original. */
  latestTransactionId: string;
  kind: EntitlementKind;
  purchasedAt: Date;
}

/** A refund: the store took [transactionId] back at [revokedAt]. */
export interface Refund {
  store: AppStore;
  transactionId: string;
  productId: string;
  environment: StoreEnvironment;
  purchasedAt: Date | null;
  revokedAt: Date;
}
