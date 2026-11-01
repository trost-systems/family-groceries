// What the purchases function knows about a purchase (docs/PURCHASES.md). RevenueCat checks it with
// the store; its webhook (revenuecat.ts) turns each event into one of these.
import type { AppStore } from '../_shared/purchases.ts';

/**
 * RevenueCat's webhook, below /functions/v1 (ADDENDUM 6). Registered with
 * `?forceFunctionRegion=eu-central-1`; scripts/iap/webhook_url_test.ts checks every place that
 * documents the URL.
 */
export const webhookPath = '/purchases/revenuecat/webhook';

/** Hummlist Premium yearly: an auto-renewing subscription (scripts/iap/product.ts). */
export const yearlyProductId = 'com.hummlist.app.yearly';

/** Hummlist Premium Lifetime: a non-consumable, same id on both stores (scripts/iap/product.ts). */
export const lifetimeProductId = 'com.hummlist.app.lifetime';

/**
 * The Play subscription's base plan (Hummlist Ops, 2026-10-31). RevenueCat names a Play
 * subscription `<subscription id>:<base plan id>` in webhooks and the SDK.
 */
export const playBasePlanId = 'yearly';

/**
 * What an unlock grants (`entitlements.kind`). Both products grant premium; a later running-cost
 * entitlement adds its own kind next to it (docs/PURCHASES.md, "A second entitlement").
 */
export type EntitlementKind = 'premium';

/** How a purchase grants it: a yearly subscription or a one-time Lifetime purchase. */
export type Plan = 'yearly' | 'lifetime';

export interface Product {
  /** The id as stored and reported: the bare subscription id, also for Play. */
  id: string;
  kind: EntitlementKind;
  plan: Plan;
}

/** Every product this function records, by every id RevenueCat may send. Others are ignored. */
const products: Readonly<Record<string, Product>> = {
  [yearlyProductId]: { id: yearlyProductId, kind: 'premium', plan: 'yearly' },
  [`${yearlyProductId}:${playBasePlanId}`]: {
    id: yearlyProductId,
    kind: 'premium',
    plan: 'yearly',
  },
  [lifetimeProductId]: { id: lifetimeProductId, kind: 'premium', plan: 'lifetime' },
};

export const productOf = (productId: string): Product | null =>
  Object.hasOwn(products, productId) ? products[productId] : null;

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
  plan: Plan;
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
  /** When RevenueCat produced the event: an older event never overwrites newer state. */
  eventAt: Date;
  /** Yearly only; null for Lifetime. */
  subscription: SubscriptionState | null;
}

/**
 * A yearly subscription's state as one event reports it. Null fields: the event says nothing
 * about them, the stored value stays.
 */
export interface SubscriptionState {
  /** Premium from it ends here: the paid period's end, or the grace period's during a billing issue. */
  expiresAt: Date | null;
  autoRenew: boolean | null;
  billingIssue: boolean | null;
}

/** A refund: the store took [transactionId] back at [revokedAt]. */
export interface Refund {
  store: AppStore;
  transactionId: string;
  productId: string;
  plan: Plan;
  environment: StoreEnvironment;
  purchasedAt: Date | null;
  revokedAt: Date;
}
