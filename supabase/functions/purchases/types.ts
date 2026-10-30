// What the purchases function's store verifiers return (docs/PURCHASES.md). Apple (apple.ts) and
// Google (google.ts) each turn what their store signed or answered into a [StorePurchase]; the
// handler grants, restores or revokes the household's unlock from it.
import type { AppStore } from '../_shared/purchases.ts';

/** The one product: Hummlist Lifetime, a non-consumable, same id on both stores. */
export const lifetimeProductId = 'com.hummlist.app.lifetime';

/** The iOS bundle id and the Android application id. */
export const appId = 'com.hummlist.app';

/**
 * Where a transaction happened. Sandbox is Apple's sandbox and TestFlight, and Google Play's
 * license-test purchases; Production is a real sale. Apple's local "Xcode" StoreKit testing never
 * verifies (its chain is not Apple's).
 */
export type StoreEnvironment = 'Production' | 'Sandbox';

/** A purchase as its store confirmed it. */
export interface StorePurchase {
  store: AppStore;
  productId: string;
  /**
   * The store's id of the original purchase, stable across restores and refunds: Apple's
   * originalTransactionId, Google's orderId (GPA.…).
   */
  transactionId: string;
  environment: StoreEnvironment;
  purchasedAt: Date;
  /** The store took it back (refund, revoke, chargeback); null while it stands. */
  revokedAt: Date | null;
  /** Paid but not complete yet (Google pending payment); never granted. */
  pending: boolean;
  /** What the customer paid in major units, VAT included; null when the store did not say. */
  price: number | null;
  /** ISO 4217, e.g. EUR. */
  currency: string | null;
  /** ISO 3166-1 alpha-2, e.g. DE. */
  country: string | null;
  /** VAT in [price], when the store reports it (Google's Orders API). */
  tax: number | null;
}

/** Why a payload was refused; logged as is (no ids, no personal data). */
export type Refusal =
  | 'malformed'
  | 'bad_signature'
  | 'untrusted_chain'
  | 'wrong_app'
  | 'wrong_product'
  | 'wrong_environment'
  | 'unknown_purchase';

export class Refused extends Error {
  constructor(readonly reason: Refusal) {
    super(`purchase refused: ${reason}`);
  }
}

/** The store could not be asked right now (network, 5xx, quota): the app retries later. */
export class StoreUnavailable extends Error {}
