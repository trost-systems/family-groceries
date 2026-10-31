// RevenueCat's webhook (https://www.revenuecat.com/docs/integrations/webhooks): its signature, and
// its events as what they mean for a household's unlock. Unknown types and fields are ignored, so a
// newer RevenueCat payload never fails.
import type { AppStore } from '../_shared/purchases.ts';
import {
  kindOf,
  lifetimeProductId,
  type Refund,
  type StoreEnvironment,
  type StorePurchase,
} from './types.ts';

/** Why an event unlocks nothing; logged as is (no ids). */
export type Refusal = 'store' | 'product' | 'family_share' | 'app_user_id' | 'malformed';

export type Action =
  | { do: 'record'; purchase: StorePurchase }
  | { do: 'revoke'; refund: Refund }
  | { do: 'reinstate'; store: AppStore; transactionId: string }
  /** No write. [refused] is logged; TRANSFER is logged by type. */
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

function actionOf(type: string, f: Record<string, unknown>, now: Date): Action {
  const purchase = type === 'NON_RENEWING_PURCHASE' || type === 'INITIAL_PURCHASE';
  if (!purchase && type !== 'CANCELLATION' && type !== 'REFUND_REVERSED') return { do: 'ignore' };
  const store = typeof f.store === 'string' && Object.hasOwn(stores, f.store)
    ? stores[f.store]
    : null;
  if (!store) return { do: 'ignore', refused: 'store' };
  const productId = text(f.product_id, 64);
  const kind = productId && kindOf(productId);
  if (!productId || !kind) return { do: 'ignore', refused: 'product' };
  const latest = text(f.transaction_id, 200);
  const transactionId = text(f.original_transaction_id, 200) ?? latest;
  const environment =
    typeof f.environment === 'string' && Object.hasOwn(environments, f.environment)
      ? environments[f.environment]
      : null;
  if (!transactionId || !environment) return { do: 'ignore', refused: 'malformed' };
  const purchasedAt = millis(f.purchased_at_ms);
  const at = millis(f.event_timestamp_ms) ?? now;

  if (type === 'REFUND_REVERSED') return { do: 'reinstate', store, transactionId };
  if (type === 'CANCELLATION') {
    return {
      do: 'revoke',
      refund: { store, transactionId, productId, environment, purchasedAt, revokedAt: at },
    };
  }
  // Family Sharing is off for Lifetime (scripts/iap/product.ts); a shared copy is no sale.
  if (f.is_family_share === true) return { do: 'ignore', refused: 'family_share' };
  // The household id, or RevenueCat's own ($RCAnonymousID:…) when the app never logged in.
  const householdId = typeof f.app_user_id === 'string' && uuid.test(f.app_user_id)
    ? f.app_user_id.toLowerCase()
    : null;
  if (!householdId) return { do: 'ignore', refused: 'app_user_id' };
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
      latestTransactionId: latest ?? transactionId,
      productId,
      kind,
      environment,
      purchasedAt: purchasedAt ?? at,
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

const testTypes = ['NON_RENEWING_PURCHASE', 'CANCELLATION', 'REFUND_REVERSED', 'TRANSFER'];

/**
 * POST /purchases/test/event (local stack only): a RevenueCat-shaped webhook body for the app's
 * fake store, fg and the e2e specs. Null for a request it cannot build one from.
 */
export function testEvent(body: unknown, now: Date): { api_version: string; event: object } | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  const type = b.type ?? 'NON_RENEWING_PURCHASE';
  const store = b.store ?? 'APP_STORE';
  const environment = b.environment ?? 'SANDBOX';
  const productId = b.productId ?? lifetimeProductId;
  const appUserId = text(b.appUserId, 200);
  const transactionId = text(b.transactionId, 200);
  if (
    typeof type !== 'string' || !testTypes.includes(type) ||
    (store !== 'APP_STORE' && store !== 'PLAY_STORE') ||
    (environment !== 'SANDBOX' && environment !== 'PRODUCTION') ||
    !text(productId, 64) || !appUserId || !transactionId ||
    (b.isFamilyShare !== undefined && typeof b.isFamilyShare !== 'boolean')
  ) {
    return null;
  }
  const ms = now.getTime();
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
      entitlement_ids: ['lifetime'],
      period_type: 'NORMAL',
      transaction_id: transactionId,
      original_transaction_id: transactionId,
      purchased_at_ms: ms,
      event_timestamp_ms: ms,
      expiration_at_ms: null,
      price: 10.49,
      price_in_purchased_currency: 9.99,
      currency: 'EUR',
      country_code: 'DE',
      takehome_percentage: 0.85,
      is_family_share: b.isFamilyShare === true,
      ...(type === 'CANCELLATION' ? { cancel_reason: 'CUSTOMER_SUPPORT' } : {}),
      ...(type === 'TRANSFER'
        ? { transferred_from: [appUserId], transferred_to: [crypto.randomUUID()] }
        : {}),
    },
  };
}
