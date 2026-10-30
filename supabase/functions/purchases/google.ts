// Google Play's side of the purchases function (docs/PURCHASES.md): asks the Play Developer API
// about a purchase token the app sent, with our service account, and turns the answer into a
// [StorePurchase]. Four calls, all under applications/com.hummlist.app:
//   - purchases.products.get: is the token ours, bought, pending or voided, test or real;
//   - purchases.products.acknowledge: Google refunds a purchase not acknowledged within 3 days;
//   - orders.get (Orders API, 2025): what the buyer paid, its tax and country;
//   - purchases.voidedpurchases.list: refunds and chargebacks since a time (at most 30 days back).
// The service account authenticates with an OAuth2 JWT-bearer assertion (RFC 7523), RS256 with
// its private key; the access token is cached until a minute before it expires.
//
// Response shapes follow Google's reference (developers.google.com/android-publisher/api-ref/
// rest/v3: purchases.products, orders, purchases.voidedpurchases), not a live API: the test
// fixtures in testdata/google/ are built from those documented shapes.
import { importPKCS8, SignJWT } from 'jose';
import { major, Money } from '../_shared/purchases.ts';
import { appId, lifetimeProductId, Refused, StorePurchase, StoreUnavailable } from './types.ts';

/**
 * Our Google credentials or their permissions are wrong (malformed service-account JSON, a
 * refused token request, 401/403 from the API): an operator has to fix it, retrying won't.
 */
export class GoogleConfigError extends Error {}

export const androidPublisherScope = 'https://www.googleapis.com/auth/androidpublisher';

const apiBase = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';

/** The fields of a service-account key file this needs. */
export interface ServiceAccount {
  clientEmail: string;
  privateKey: string;
  tokenUri: string;
}

/** Parses the key file (GOOGLE_PLAY_SERVICE_ACCOUNT_JSON); never echoes its content. */
export function parseServiceAccount(json: string): ServiceAccount {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new GoogleConfigError('service account: not JSON');
  }
  const { client_email, private_key, token_uri } = raw ?? {};
  if (typeof client_email !== 'string' || !client_email.includes('@')) {
    throw new GoogleConfigError('service account: no client_email');
  }
  if (typeof private_key !== 'string' || !private_key.includes('-----BEGIN PRIVATE KEY-----')) {
    throw new GoogleConfigError('service account: no PKCS#8 private_key');
  }
  if (typeof token_uri !== 'string' || !token_uri.startsWith('https://')) {
    throw new GoogleConfigError('service account: no https token_uri');
  }
  return { clientEmail: client_email, privateKey: private_key, tokenUri: token_uri };
}

/** purchases.products.get: a ProductPurchase, as far as this reads it. */
export interface ProductPurchase {
  productId?: string;
  purchaseToken?: string;
  /** Milliseconds since the epoch, as a string (int64). */
  purchaseTimeMillis: string;
  /** 0 purchased, 1 canceled, 2 pending. */
  purchaseState: number;
  /** 0 yet to be acknowledged, 1 acknowledged. */
  acknowledgementState: number;
  /** Absent for a normal purchase; 0 license test, 1 promo code, 2 rewarded. */
  purchaseType?: number;
  /** GPA.…; absent on some test purchases. */
  orderId?: string;
  /** Alpha-2 billing region when the product was granted. */
  regionCode?: string;
}

/** orders.get: an Order, as far as this reads it. */
export interface Order {
  orderId: string;
  purchaseToken?: string;
  /** PENDING, PROCESSED, CANCELED, PENDING_REFUND, PARTIALLY_REFUNDED, REFUNDED. */
  state?: string;
  /** The final amount the buyer paid, after discounts, taxes included. */
  total?: Money;
  /** The total tax in [total]. */
  tax?: Money;
  buyerAddress?: { buyerCountry?: string };
}

export type VoidedSource = 'user' | 'developer' | 'google' | 'unknown';
export type VoidedReason =
  | 'other'
  | 'remorse'
  | 'not_received'
  | 'defective'
  | 'accidental_purchase'
  | 'fraud'
  | 'friendly_fraud'
  | 'chargeback'
  | 'unacknowledged_purchase'
  | 'unknown';

const voidedSources: VoidedSource[] = ['user', 'developer', 'google'];
const voidedReasons: VoidedReason[] = [
  'other',
  'remorse',
  'not_received',
  'defective',
  'accidental_purchase',
  'fraud',
  'friendly_fraud',
  'chargeback',
  'unacknowledged_purchase',
];

export interface VoidedPurchase {
  purchaseToken: string;
  orderId: string | null;
  voidedAt: Date;
  source: VoidedSource;
  reason: VoidedReason;
}

/** What [GooglePlay.verify] found; the handler acknowledges after granting when asked to. */
export interface GoogleVerification {
  purchase: StorePurchase;
  /** Bought, not pending or voided, and not yet acknowledged with Google. */
  needsAcknowledge: boolean;
}

export interface GooglePlayDeps {
  /** The key file's JSON (GOOGLE_PLAY_SERVICE_ACCOUNT_JSON). */
  serviceAccount: string;
  fetch: typeof fetch;
  now(): Date;
}

/**
 * voidedpurchases.list looks at most 30 days back (an older startTime is an error); a minute less
 * leaves room for clock skew.
 */
export const voidedWindowMs = 30 * 24 * 3_600_000 - 60_000;

/** Refresh the access token this long before Google says it expires. */
const tokenMarginMs = 60_000;

const alpha2 = (s: unknown) => typeof s === 'string' && /^[A-Z]{2}$/.test(s) ? s : null;
const alpha3 = (s: unknown) => typeof s === 'string' && /^[A-Z]{3}$/.test(s) ? s : null;

/**
 * The transaction id of a purchase without an orderId (some license-test purchases): "token:"
 * and the first 32 hex digits of the token's SHA-256, stable for that token, not the raw token.
 */
export async function tokenTransactionId(purchaseToken: string): Promise<string> {
  const data = new TextEncoder().encode(purchaseToken);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return 'token:' + Array.from(hash.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
}

export class GooglePlay {
  readonly packageName = appId;
  private readonly account: ServiceAccount;
  private readonly fetch: typeof fetch;
  private readonly now: () => Date;
  private key: Promise<CryptoKey> | null = null;
  private token: { value: string; until: number } | null = null;
  private pending: Promise<string> | null = null;

  /** Throws [GoogleConfigError] for a malformed key file. */
  constructor(deps: GooglePlayDeps) {
    this.account = parseServiceAccount(deps.serviceAccount);
    this.fetch = deps.fetch;
    this.now = deps.now;
  }

  /**
   * Checks [purchaseToken] for [productId] with Google, then fills in price, tax and country
   * from the Orders API when the purchase has an orderId and the order answers. Throws
   * [Refused] (wrong product, unknown token), [StoreUnavailable] or [GoogleConfigError].
   */
  async verify(productId: string, purchaseToken: string): Promise<GoogleVerification> {
    if (productId !== lifetimeProductId) throw new Refused('wrong_product');
    if (typeof purchaseToken !== 'string' || purchaseToken.length === 0) {
      throw new Refused('malformed');
    }
    const p = await this.getProductPurchase(productId, purchaseToken);
    if (p.productId !== undefined && p.productId !== productId) throw new Refused('wrong_product');
    const purchasedAt = new Date(Number(p.purchaseTimeMillis));
    if (Number.isNaN(purchasedAt.getTime())) throw new Refused('malformed');
    const purchased = p.purchaseState === 0;
    const order = p.orderId ? await this.getOrder(p.orderId) : null;
    const paid = order && (!order.purchaseToken || order.purchaseToken === purchaseToken)
      ? order
      : null;
    const currency = alpha3(paid?.total?.currencyCode);
    const purchase: StorePurchase = {
      store: 'google',
      productId,
      transactionId: p.orderId || await tokenTransactionId(purchaseToken),
      // Only a license tester's purchase is a test; promo-code and rewarded ones are real
      // grants on a real account (just not paid in money).
      environment: p.purchaseType === 0 ? 'Sandbox' : 'Production',
      purchasedAt,
      // Canceled is Google's state for a voided purchase (refund, chargeback, revoke).
      // products.get does not say when: now, the voided list (voidedPurchases) has the time.
      revokedAt: p.purchaseState === 1 ? this.now() : null,
      pending: p.purchaseState === 2,
      price: currency && paid?.total ? major(paid.total) : null,
      currency,
      country: alpha2(paid?.buyerAddress?.buyerCountry) ?? alpha2(p.regionCode),
      tax: currency && paid?.tax?.currencyCode === currency ? major(paid.tax) : null,
    };
    return { purchase, needsAcknowledge: purchased && p.acknowledgementState === 0 };
  }

  /** purchases.products.get. */
  async getProductPurchase(productId: string, purchaseToken: string): Promise<ProductPurchase> {
    const res = await this.call('GET', this.productPath(productId, purchaseToken));
    if (res.ok) return await res.json();
    await res.body?.cancel();
    if ([400, 404, 410].includes(res.status)) throw new Refused('unknown_purchase');
    throw this.failure(res.status, 'products.get');
  }

  /**
   * purchases.products.acknowledge. Google does not document what acknowledging twice answers,
   * so the handler calls this only when [GoogleVerification.needsAcknowledge]; should it lose a
   * race anyway (a 400 or 409), the purchase is read again and an acknowledged one counts as
   * done.
   */
  async acknowledge(productId: string, purchaseToken: string): Promise<void> {
    const res = await this.call(
      'POST',
      `${this.productPath(productId, purchaseToken)}:acknowledge`,
      {},
    );
    await res.body?.cancel();
    if (res.ok) return;
    if (res.status === 400 || res.status === 409) {
      const p = await this.getProductPurchase(productId, purchaseToken);
      if (p.acknowledgementState === 1) return;
      throw new StoreUnavailable(`acknowledge: ${res.status}`);
    }
    if (res.status === 404 || res.status === 410) throw new Refused('unknown_purchase');
    throw this.failure(res.status, 'acknowledge');
  }

  /**
   * orders.get. Null for any answer but an order (404, missing permission for financial data,
   * 5xx): the purchase verifies without a price then. A network failure still throws.
   */
  async getOrder(orderId: string): Promise<Order | null> {
    const res = await this.call('GET', `/orders/${encodeURIComponent(orderId)}`);
    if (!res.ok) {
      await res.body?.cancel();
      return null;
    }
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  /** purchases.voidedpurchases.list for one-time products, all pages, voided since [since]. */
  async voidedPurchases(since: Date): Promise<VoidedPurchase[]> {
    const start = Math.max(since.getTime(), this.now().getTime() - voidedWindowMs);
    const out: VoidedPurchase[] = [];
    let page: string | undefined;
    for (let i = 0; i < 100; i++) {
      const query = new URLSearchParams({ type: '0', maxResults: '1000' });
      // Google ignores startTime once a page token is set.
      if (page) query.set('token', page);
      else query.set('startTime', String(start));
      const res = await this.call('GET', `/purchases/voidedpurchases?${query}`);
      if (!res.ok) {
        await res.body?.cancel();
        throw this.failure(res.status, 'voidedpurchases.list');
      }
      const body: {
        voidedPurchases?: {
          purchaseToken?: string;
          orderId?: string;
          voidedTimeMillis?: string;
          voidedSource?: number;
          voidedReason?: number;
        }[];
        tokenPagination?: { nextPageToken?: string };
      } = await res.json();
      for (const v of body.voidedPurchases ?? []) {
        const voidedAt = new Date(Number(v.voidedTimeMillis));
        if (!v.purchaseToken || Number.isNaN(voidedAt.getTime())) continue;
        out.push({
          purchaseToken: v.purchaseToken,
          orderId: v.orderId ?? null,
          voidedAt,
          source: voidedSources[v.voidedSource ?? -1] ?? 'unknown',
          reason: voidedReasons[v.voidedReason ?? -1] ?? 'unknown',
        });
      }
      page = body.tokenPagination?.nextPageToken;
      if (!page) return out;
    }
    throw new StoreUnavailable('voidedpurchases.list: too many pages');
  }

  private productPath(productId: string, purchaseToken: string) {
    return `/purchases/products/${encodeURIComponent(productId)}/tokens/${
      encodeURIComponent(purchaseToken)
    }`;
  }

  /** 401/403 are our credentials; anything else unexpected is worth a retry later. */
  private failure(status: number, call: string): Error {
    return status === 401 || status === 403
      ? new GoogleConfigError(`${call}: ${status}`)
      : new StoreUnavailable(`${call}: ${status}`);
  }

  /**
   * One authorized request under our package. A 401 drops the cached token and tries once more
   * (it may have been revoked early); the second answer is returned as is.
   */
  private async call(method: string, path: string, body?: unknown): Promise<Response> {
    const url = `${apiBase}/${encodeURIComponent(this.packageName)}${path}`;
    for (let attempt = 0;; attempt++) {
      const token = await this.accessToken();
      const res = await this.send(url, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (res.status !== 401 || attempt > 0) return res;
      await res.body?.cancel();
      this.token = null;
    }
  }

  private async send(url: string, init: RequestInit): Promise<Response> {
    try {
      return await this.fetch(url, init);
    } catch {
      throw new StoreUnavailable('google: network');
    }
  }

  /** The cached access token, or a new one; concurrent callers share one token request. */
  private accessToken(): Promise<string> {
    if (this.token && this.now().getTime() < this.token.until) {
      return Promise.resolve(this.token.value);
    }
    this.pending ??= this.requestToken().finally(() => this.pending = null);
    return this.pending;
  }

  private async requestToken(): Promise<string> {
    const res = await this.send(this.account.tokenUri, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: await this.assertion(),
      }),
    });
    if (!res.ok) {
      await res.body?.cancel();
      // 400 invalid_grant / 401 invalid_client: a wrong or deleted key.
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        throw new GoogleConfigError(`token: ${res.status}`);
      }
      throw new StoreUnavailable(`token: ${res.status}`);
    }
    const t: { access_token?: unknown; expires_in?: unknown } = await res.json();
    if (typeof t.access_token !== 'string' || typeof t.expires_in !== 'number') {
      throw new StoreUnavailable('token: unexpected answer');
    }
    this.token = {
      value: t.access_token,
      until: this.now().getTime() + t.expires_in * 1000 - tokenMarginMs,
    };
    return t.access_token;
  }

  /** The signed JWT-bearer assertion: our account asks for the androidpublisher scope, 1 h. */
  private async assertion(): Promise<string> {
    this.key ??= importPKCS8(this.account.privateKey, 'RS256').catch(() => {
      this.key = null;
      throw new GoogleConfigError('service account: unreadable private_key');
    });
    const iat = Math.floor(this.now().getTime() / 1000);
    return await new SignJWT({ scope: androidPublisherScope })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(this.account.clientEmail)
      .setAudience(this.account.tokenUri)
      .setIssuedAt(iat)
      .setExpirationTime(iat + 3600)
      .sign(await this.key);
  }
}
