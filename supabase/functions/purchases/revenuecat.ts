// RevenueCat's webhook (https://www.revenuecat.com/docs/integrations/webhooks): its signature, and
// its events as what they mean for a household's unlock. Unknown types and fields are ignored, so a
// newer RevenueCat payload never fails.
import type { AppStore } from '../_shared/purchases.ts';
import { premiumEntitlement } from './promotional.ts';
import {
  lifetimeProductId,
  type Plan,
  playBasePlanId,
  productOf,
  type Refund,
  type StoreEnvironment,
  type StorePurchase,
  type SubscriptionState,
  yearlyProductId,
} from './types.ts';

/** Why an event unlocks nothing; logged as is (no ids). */
export type Refusal =
  | 'store'
  | 'product'
  | 'family_share'
  | 'app_user_id'
  | 'malformed'
  | 'entitlement';

/** A yearly subscription's new state from a lifecycle event, for a transaction we may know. */
export interface Lifecycle {
  store: AppStore;
  transactionId: string;
  eventAt: Date;
  state: SubscriptionState;
}

export type Action =
  /** INITIAL_PURCHASE, NON_RENEWING_PURCHASE, RENEWAL: bind (H-56) and grant, or update. */
  | { do: 'record'; purchase: StorePurchase }
  /** A yearly plan's state changed; never creates a row or grants anything. */
  | { do: 'lifecycle'; change: Lifecycle }
  | { do: 'revoke'; refund: Refund }
  | { do: 'reinstate'; store: AppStore; transactionId: string }
  /**
   * A promotional grant of premium changed (store PROMOTIONAL: granted, extended, revoked or
   * expired). The event is only the trigger: the household's promotional premium is read from
   * RevenueCat's API and stored as it is now (promotional.ts).
   */
  | { do: 'promotional'; householdId: string }
  /** No write. [refused] is logged; TRANSFER and PRODUCT_CHANGE are logged by type. */
  | { do: 'ignore'; refused?: Refusal };

export interface WebhookEvent {
  id: string;
  type: string;
  action: Action;
}

const stores: Record<string, AppStore> = { APP_STORE: 'apple', PLAY_STORE: 'google' };
const environments: Record<string, StoreEnvironment> = {
  SANDBOX: 'Sandbox',
  PRODUCTION: 'Production',
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const text = (v: unknown, max: number) =>
  typeof v === 'string' && v.length > 0 && v.length <= max ? v : null;
const millis = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? new Date(v) : null;

/** The event types that grant: a purchase, or a renewal of one. */
const recordTypes = new Set(['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE', 'RENEWAL']);

/**
 * The event types that change a yearly plan's state and the state they report (docs/PURCHASES.md,
 * "Subscription lifecycle"). CANCELLATION is here for everything but a refund (A2-1, H-81): a
 * cancelled plan stays premium until it expires; only EXPIRATION ends it.
 */
const lifecycleStates: Record<string, (f: Fields) => SubscriptionState> = {
  CANCELLATION: (f) => ({ expiresAt: f.expiresAt, autoRenew: false, billingIssue: null }),
  UNCANCELLATION: (f) => ({ expiresAt: f.expiresAt, autoRenew: true, billingIssue: null }),
  // Premium through the grace period when the store grants one, else to the period's end. On
  // Google an account hold follows the grace period; RevenueCat reports it as EXPIRATION.
  BILLING_ISSUE: (f) => ({
    expiresAt: f.graceEndsAt ?? f.expiresAt,
    autoRenew: null,
    billingIssue: true,
  }),
  // Ends at the reported end, never later than the event (a missed EXPIRATION is harmless: premium
  // is computed from the stored end at read time).
  EXPIRATION: (f) => ({
    expiresAt: f.expiresAt && f.expiresAt < f.eventAt ? f.expiresAt : f.eventAt,
    autoRenew: false,
    billingIssue: false,
  }),
  SUBSCRIPTION_EXTENDED: (f) => ({ expiresAt: f.expiresAt, autoRenew: null, billingIssue: null }),
  // A Play pause starts at the period's end: premium runs until then, EXPIRATION ends it, a
  // resume arrives as RENEWAL.
  SUBSCRIPTION_PAUSED: (f) => ({ expiresAt: f.expiresAt, autoRenew: false, billingIssue: null }),
};

/** What an event says about a transaction, read once. */
interface Fields {
  store: AppStore;
  productId: string;
  plan: Plan;
  transactionId: string;
  latestTransactionId: string;
  environment: StoreEnvironment;
  eventAt: Date;
  purchasedAt: Date | null;
  expiresAt: Date | null;
  graceEndsAt: Date | null;
}

/** The webhook body, or null when it is no RevenueCat event at all (400). */
export function parseWebhook(body: unknown, now: Date): WebhookEvent | null {
  const e = (body as { event?: unknown } | null)?.event;
  if (typeof e !== 'object' || e === null) return null;
  const f = e as Record<string, unknown>;
  const id = text(f.id, 200);
  const type = text(f.type, 64);
  if (!id || !type) return null;
  return { id, type, action: actionOf(type, f, now) };
}

/**
 * A refund: RevenueCat has no REFUND event; it sends CANCELLATION with cancel_reason
 * CUSTOMER_SUPPORT, and a negative price for the refunded amount. Any cancellation of the one-time
 * purchase is one too (as job 43). cancel_reason is read here and never stored (H-87).
 */
const isRefund = (f: Record<string, unknown>, plan: Plan) =>
  plan === 'lifetime' || f.cancel_reason === 'CUSTOMER_SUPPORT' ||
  (typeof f.price === 'number' && f.price < 0) ||
  (typeof f.price_in_purchased_currency === 'number' && f.price_in_purchased_currency < 0);

/** The household id, or null for RevenueCat's own ids ($RCAnonymousID:…) and anything else. */
const householdOf = (f: Record<string, unknown>) =>
  typeof f.app_user_id === 'string' && uuid.test(f.app_user_id)
    ? f.app_user_id.toLowerCase()
    : null;

/**
 * Grants from the RevenueCat dashboard or API v2 grant_entitlement: NON_RENEWING_PURCHASE when
 * granted or extended, CANCELLATION (DEVELOPER_INITIATED) when revoked, EXPIRATION when it ends.
 * Every one of them, whatever its type, makes us read the household's current state: deliveries
 * may come late, twice or out of order, and the API answers what is true now.
 */
function promotionalAction(type: string, f: Record<string, unknown>): Action {
  if (type === 'TRANSFER' || type === 'TEST') return { do: 'ignore' };
  const ids = Array.isArray(f.entitlement_ids)
    ? f.entitlement_ids
    : typeof f.entitlement_id === 'string'
    ? [f.entitlement_id]
    : null;
  // Another entitlement's grant: nothing of ours changed. Without ids we look anyway.
  if (ids && !ids.includes(premiumEntitlement)) return { do: 'ignore', refused: 'entitlement' };
  const householdId = householdOf(f);
  if (!householdId) return { do: 'ignore', refused: 'app_user_id' };
  return { do: 'promotional', householdId };
}

function actionOf(type: string, f: Record<string, unknown>, now: Date): Action {
  if (f.store === 'PROMOTIONAL') return promotionalAction(type, f);
  const relevant = recordTypes.has(type) || Object.hasOwn(lifecycleStates, type) ||
    type === 'REFUND_REVERSED';
  if (!relevant) return { do: 'ignore' };
  const store = typeof f.store === 'string' && Object.hasOwn(stores, f.store)
    ? stores[f.store]
    : null;
  if (!store) return { do: 'ignore', refused: 'store' };
  const reported = text(f.product_id, 128);
  const product = reported && productOf(reported);
  if (!product) return { do: 'ignore', refused: 'product' };
  const latest = text(f.transaction_id, 200);
  const transactionId = text(f.original_transaction_id, 200) ?? latest;
  const environment =
    typeof f.environment === 'string' && Object.hasOwn(environments, f.environment)
      ? environments[f.environment]
      : null;
  if (!transactionId || !environment) return { do: 'ignore', refused: 'malformed' };
  const fields: Fields = {
    store,
    productId: product.id,
    plan: product.plan,
    transactionId,
    latestTransactionId: latest ?? transactionId,
    environment,
    eventAt: millis(f.event_timestamp_ms) ?? now,
    purchasedAt: millis(f.purchased_at_ms),
    expiresAt: millis(f.expiration_at_ms),
    graceEndsAt: millis(f.grace_period_expiration_at_ms),
  };

  if (type === 'REFUND_REVERSED') return { do: 'reinstate', store, transactionId };
  if (type === 'CANCELLATION' && isRefund(f, product.plan)) {
    return {
      do: 'revoke',
      refund: {
        store,
        transactionId,
        productId: product.id,
        plan: product.plan,
        environment,
        purchasedAt: fields.purchasedAt,
        revokedAt: fields.eventAt,
      },
    };
  }
  if (!recordTypes.has(type)) {
    // The one-time purchase has no lifecycle: nothing but a refund changes it.
    if (product.plan === 'lifetime') return { do: 'ignore' };
    return {
      do: 'lifecycle',
      change: {
        store,
        transactionId,
        eventAt: fields.eventAt,
        state: lifecycleStates[type](fields),
      },
    };
  }
  // Family Sharing is off for both products (scripts/iap/product.ts); a shared copy is no sale.
  if (f.is_family_share === true) return { do: 'ignore', refused: 'family_share' };
  // The household id, or RevenueCat's own ($RCAnonymousID:…) when the app never logged in.
  const householdId = householdOf(f);
  if (!householdId) return { do: 'ignore', refused: 'app_user_id' };
  // A yearly plan without its end is no state we could keep.
  if (product.plan === 'yearly' && !fields.expiresAt) return { do: 'ignore', refused: 'malformed' };
  const price = typeof f.price_in_purchased_currency === 'number' &&
      f.price_in_purchased_currency >= 0 && f.price_in_purchased_currency < 1e8
    ? Math.round(f.price_in_purchased_currency * 100) / 100
    : null;
  const code = (v: unknown, pattern: RegExp) => typeof v === 'string' && pattern.test(v) ? v : null;
  return {
    do: 'record',
    purchase: {
      store,
      transactionId,
      latestTransactionId: fields.latestTransactionId,
      productId: product.id,
      plan: product.plan,
      kind: product.kind,
      environment,
      purchasedAt: fields.purchasedAt ?? fields.eventAt,
      eventAt: fields.eventAt,
      subscription: product.plan === 'yearly'
        ? { expiresAt: fields.expiresAt, autoRenew: true, billingIssue: false }
        : null,
      price,
      currency: code(f.currency, /^[A-Z]{3}$/),
      country: code(f.country_code, /^[A-Z]{2}$/),
      householdId,
    },
  };
}

/** Tolerated clock difference for a signed delivery (RevenueCat's own recommendation). */
export const signatureToleranceSeconds = 300;

/**
 * Whether [header] (`t=<unix seconds>,v1=<hex>`) signs [raw], the body's bytes as received:
 * HMAC-SHA256 under [secret] of `<t>.<raw>`, within [signatureToleranceSeconds] of [now].
 */
export async function signedBy(
  secret: string,
  header: string | null,
  raw: Uint8Array,
  now: Date,
): Promise<boolean> {
  const parts = (header ?? '').split(',').map((p) => p.trim().split('='));
  const t = parts.find(([k]) => k === 't')?.[1] ?? '';
  const given = parts.filter(([k, v]) => k === 'v1' && v).map(([, v]) => v.toLowerCase());
  if (!/^\d{1,12}$/.test(t) || given.length === 0) return false;
  if (Math.abs(now.getTime() / 1000 - Number(t)) > signatureToleranceSeconds) return false;
  const prefix = new TextEncoder().encode(`${t}.`);
  const signed = new Uint8Array(prefix.length + raw.length);
  signed.set(prefix);
  signed.set(raw, prefix.length);
  const want = await hmacHex(secret, signed);
  let ok = false;
  for (const v of given) ok = await sameSecret(v, want) || ok;
  return ok;
}

export async function hmacHex(key: string, data: Uint8Array | string): Promise<string> {
  const k = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', k, bytes as BufferSource));
  return Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time comparison: hashed first, so neither content nor length leaks. */
export async function sameSecret(a: string, b: string): Promise<boolean> {
  const digest = async (s: string) =>
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  const [x, y] = await Promise.all([digest(a), digest(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

const testTypes = [
  'INITIAL_PURCHASE',
  'NON_RENEWING_PURCHASE',
  'RENEWAL',
  'CANCELLATION',
  'UNCANCELLATION',
  'BILLING_ISSUE',
  'EXPIRATION',
  'SUBSCRIPTION_EXTENDED',
  'SUBSCRIPTION_PAUSED',
  'PRODUCT_CHANGE',
  'REFUND_REVERSED',
  'TRANSFER',
];
const cancelReasons = [
  'UNSUBSCRIBE',
  'BILLING_ERROR',
  'DEVELOPER_INITIATED',
  'PRICE_INCREASE',
  'CUSTOMER_SUPPORT',
  'UNKNOWN',
];
const day = 86_400_000;

/**
 * POST /purchases/test/event (local stack only): a RevenueCat-shaped webhook body for the app's
 * fake store, fg and the e2e specs. Null for a request it cannot build one from. Optional:
 * `productId` (Lifetime by default; `com.hummlist.app.yearly` or Play's `…:yearly`), `type`
 * (NON_RENEWING_PURCHASE for Lifetime, INITIAL_PURCHASE for yearly by default), `expiresInDays`
 * (yearly: the period's end from now, 365 by default; negative for the past), `graceDays`
 * (BILLING_ISSUE), `cancelReason` (CANCELLATION: CUSTOMER_SUPPORT by default, a refund),
 * `eventAgoMs` (the event's age, for out-of-order deliveries), `transferTo` (TRANSFER's target).
 */
export function testEvent(body: unknown, now: Date): { api_version: string; event: object } | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  const productId = b.productId ?? lifetimeProductId;
  const yearly = typeof productId === 'string' && productId.startsWith(yearlyProductId);
  const type = b.type ?? (yearly ? 'INITIAL_PURCHASE' : 'NON_RENEWING_PURCHASE');
  const store = b.store ??
    (typeof productId === 'string' && productId.includes(':') ? 'PLAY_STORE' : 'APP_STORE');
  const environment = b.environment ?? 'SANDBOX';
  const appUserId = text(b.appUserId, 200);
  const transactionId = text(b.transactionId, 200);
  const number = (v: unknown) => v === undefined || (typeof v === 'number' && Number.isFinite(v));
  const cancelReason = b.cancelReason ?? 'CUSTOMER_SUPPORT';
  if (
    typeof type !== 'string' || !testTypes.includes(type) ||
    (store !== 'APP_STORE' && store !== 'PLAY_STORE') ||
    (environment !== 'SANDBOX' && environment !== 'PRODUCTION') ||
    !text(productId, 128) || !appUserId || !transactionId ||
    (b.isFamilyShare !== undefined && typeof b.isFamilyShare !== 'boolean') ||
    !number(b.expiresInDays) || !number(b.graceDays) || !number(b.eventAgoMs) ||
    typeof cancelReason !== 'string' || !cancelReasons.includes(cancelReason)
  ) {
    return null;
  }
  const ms = now.getTime();
  const at = ms - ((b.eventAgoMs as number | undefined) ?? 0);
  const expires = yearly ? ms + ((b.expiresInDays as number | undefined) ?? 365) * day : null;
  return {
    api_version: '1.0',
    event: {
      id: crypto.randomUUID().toUpperCase(),
      type,
      app_id: 'app_local_test',
      app_user_id: appUserId,
      original_app_user_id: appUserId,
      aliases: [appUserId],
      store,
      environment,
      product_id: productId,
      entitlement_ids: ['premium'],
      period_type: 'NORMAL',
      transaction_id: transactionId,
      original_transaction_id: transactionId,
      purchased_at_ms: at,
      event_timestamp_ms: at,
      expiration_at_ms: expires,
      price: yearly ? 10.49 : 31.49,
      price_in_purchased_currency: yearly ? 9.99 : 29.99,
      currency: 'EUR',
      country_code: 'DE',
      takehome_percentage: 0.85,
      is_family_share: b.isFamilyShare === true,
      ...(type === 'CANCELLATION' ? { cancel_reason: cancelReason } : {}),
      ...(type === 'EXPIRATION' ? { expiration_reason: 'UNSUBSCRIBE' } : {}),
      ...(type === 'BILLING_ISSUE' && b.graceDays !== undefined
        ? { grace_period_expiration_at_ms: ms + (b.graceDays as number) * day }
        : {}),
      ...(type === 'PRODUCT_CHANGE'
        ? { new_product_id: `${yearlyProductId}:${playBasePlanId}` }
        : {}),
      ...(type === 'TRANSFER'
        ? {
          transferred_from: [appUserId],
          transferred_to: [text(b.transferTo, 200) ?? crypto.randomUUID()],
        }
        : {}),
    },
  };
}
