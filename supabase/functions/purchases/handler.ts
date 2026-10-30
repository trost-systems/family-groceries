// The purchases function (docs/PURCHASES.md): verifies Hummlist Lifetime with its store before the
// household is unlocked, and takes the unlock away when the store refunds it.
//   POST /purchases/verify               the app, signed in (its own session, not a PAT or OAuth
//                                        app), in a household: a StoreKit 2 transaction JWS or a
//                                        Play purchase token, from a purchase or a restore
//   POST /purchases/apple/notifications  App Store Server Notifications V2 (signed by Apple)
//   POST /purchases/google/voided        the daily poll of Play's voided purchases (cron secret)
//   GET  /purchases                      whether it is configured (smoke checks)
//   POST /purchases/test/sign            local stack only: the App Store's part (test_signer.ts)
// Unconfigured (no PURCHASES_ENVIRONMENTS), every route but GET answers 503 not_configured, so a
// deploy before the store setup unlocks nothing. Refusals are logged by reason and store only:
// never a transaction id, token, user or household.
import { AuthError } from '../_shared/auth.ts';
import { json, preflight } from '../_shared/http.ts';
import type { AppStore, PurchaseEvent, Revenue } from '../_shared/purchases.ts';
import type { Subject } from '../_shared/telemetry.ts';
import type { AppleNotification } from './apple.ts';
import type { GoogleVerification, VoidedPurchase } from './google.ts';
import type { Outcome, Revoked, RevokedFacts } from './store.ts';
import { parseSignRequest, signTest, type TestSigner } from './test_signer.ts';
import {
  lifetimeProductId,
  Refused,
  type StoreEnvironment,
  type StorePurchase,
  StoreUnavailable,
} from './types.ts';

/** The configuration is incomplete or a credential is refused (a 503 that reaches error tracking). */
export class NotConfigured extends Error {}

export interface Deps {
  environments: readonly StoreEnvironment[];
  /** The app's own session and its household; throws AuthError. */
  authenticate(req: Request): Promise<{ userId: string; householdId: string }>;
  /** Takes one verification from the user's allowance; false when it is used up. */
  takeCall(userId: string): Promise<boolean>;
  apple: {
    /** A StoreKit 2 transaction JWS, verified (and checked with Apple when a key is set). */
    transaction(jws: string): Promise<StorePurchase>;
    notification(signedPayload: string): Promise<AppleNotification>;
  };
  /** Null without a service account. */
  google: {
    verify(productId: string, purchaseToken: string): Promise<GoogleVerification>;
    acknowledge(productId: string, purchaseToken: string): Promise<void>;
    voided(since: Date): Promise<VoidedPurchase[]>;
    transactionId(v: VoidedPurchase): Promise<string>;
  } | null;
  cronSecret: string | null;
  /** Local stack only (config.ts); null everywhere else, where the route is 404. */
  testSigner: TestSigner | null;
  grant(p: StorePurchase, userId: string, householdId: string): Promise<Outcome>;
  /** [facts] are recorded if the transaction was never verified, so it never unlocks later. */
  revoke(
    store: AppStore,
    transactionId: string,
    at: Date,
    facts: RevokedFacts,
  ): Promise<Revoked | null>;
  reinstate(store: AppStore, transactionId: string): Promise<boolean>;
  /** Whom analytics events for [userId] go to: null unless their latest answer in the app was yes. */
  subject(userId: string): Promise<Subject | null>;
  event(name: PurchaseEvent, revenue: Revenue, subject: Subject): Promise<void>;
  report(error: unknown): void;
  now(): Date;
}

/** How far back the daily poll asks Play for voided purchases; overlapping days are harmless. */
export const voidedLookbackMs = 7 * 24 * 3_600_000;

type Source = 'purchase' | 'restore';

interface VerifyBody {
  store: AppStore;
  source: Source;
  jws?: string;
  productId?: string;
  purchaseToken?: string;
}

function parseVerify(body: unknown): VerifyBody | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  const source = b.source === 'restore' ? 'restore' : b.source === 'purchase' ? 'purchase' : null;
  if (!source) return null;
  const short = (v: unknown, max: number) =>
    typeof v === 'string' && v.length > 0 && v.length <= max ? v : undefined;
  if (b.store === 'apple') {
    const jws = short(b.jws, 16_384);
    return jws ? { store: 'apple', source, jws } : null;
  }
  if (b.store === 'google') {
    const productId = short(b.productId, 64);
    const purchaseToken = short(b.purchaseToken, 4_096);
    return productId && purchaseToken
      ? { store: 'google', source, productId, purchaseToken }
      : null;
  }
  return null;
}

const logRefusal = (route: string, store: AppStore, reason: string) =>
  console.warn(JSON.stringify({ fn: 'purchases', route, store, refused: reason }));

const revenueOf = (p: StorePurchase): Revenue => ({
  store: p.store,
  productId: p.productId,
  originalTransactionId: p.transactionId,
  price: p.price,
  currency: p.currency,
  country: p.country,
  tax: p.tax,
});

export function createHandler(deps: Deps): (req: Request) => Promise<Response> {
  const configured = deps.environments.length > 0;
  const notConfigured = () => json({ error: 'not_configured' }, { status: 503 });

  async function send(
    name: PurchaseEvent,
    revenue: Revenue,
    userId: string | null,
    householdId: string | null,
    environment: StoreEnvironment,
  ) {
    if (!userId) return;
    try {
      const subject = await deps.subject(userId);
      if (!subject) return;
      await deps.event(name, revenue, {
        installId: subject.installId,
        householdId: householdId ?? subject.householdId,
        // A sandbox purchase is never revenue: it counts as internal (docs/ANALYTICS.md).
        internal: subject.internal === true || environment === 'Sandbox',
      });
    } catch (e) {
      // Analytics never fails a purchase.
      deps.report(e);
    }
  }

  async function verify(req: Request): Promise<Response> {
    if (!configured) return notConfigured();
    let who: { userId: string; householdId: string };
    try {
      who = await deps.authenticate(req);
    } catch (e) {
      if (e instanceof AuthError) return json({ error: e.reason }, { status: e.status });
      throw e;
    }
    const body = parseVerify(await req.json().catch(() => null));
    if (!body) return json({ error: 'bad_request' }, { status: 400 });
    if (body.store === 'google' && !deps.google) return notConfigured();
    if (!await deps.takeCall(who.userId)) return json({ error: 'rate_limited' }, { status: 429 });

    let purchase: StorePurchase;
    let acknowledge = false;
    try {
      if (body.store === 'apple') {
        purchase = await deps.apple.transaction(body.jws!);
      } else {
        // Checked before Google is asked: a token for anything else is not ours to look up.
        if (body.productId !== lifetimeProductId) throw new Refused('wrong_product');
        const v = await deps.google!.verify(body.productId!, body.purchaseToken!);
        purchase = v.purchase;
        acknowledge = v.needsAcknowledge;
      }
      if (!deps.environments.includes(purchase.environment)) throw new Refused('wrong_environment');
    } catch (e) {
      if (e instanceof Refused) {
        logRefusal('verify', body.store, e.reason);
        return json({ error: 'refused', reason: e.reason }, { status: 422 });
      }
      if (e instanceof StoreUnavailable) {
        return json({ error: 'store_unavailable' }, { status: 502 });
      }
      throw e;
    }
    // Google: paid later (cash, bank transfer). The app keeps it pending and asks again.
    if (purchase.pending) return json({ status: 'pending', unlocked: false }, { status: 202 });

    let outcome: Outcome;
    try {
      outcome = await deps.grant(purchase, who.userId, who.householdId);
    } catch (e) {
      // Left the household since the session was checked.
      if (e instanceof AuthError) return json({ error: e.reason }, { status: e.status });
      throw e;
    }
    const unlocked = outcome === 'granted' || outcome === 'restored';
    if (acknowledge && unlocked) {
      // Unacknowledged after three days, Play refunds it. A failure here is retried: the app's
      // completePurchase acknowledges too, and the next verification asks again.
      await deps.google!.acknowledge(purchase.productId, body.purchaseToken!).catch(deps.report);
    }
    const revenue = revenueOf(purchase);
    if (outcome === 'granted') {
      await send('purchase_completed', revenue, who.userId, who.householdId, purchase.environment);
    } else if (outcome === 'restored' && body.source === 'restore') {
      await send('purchase_restored', revenue, who.userId, who.householdId, purchase.environment);
    } else if (outcome === 'refunded') {
      await send('purchase_refunded', revenue, who.userId, who.householdId, purchase.environment);
    }
    if (outcome === 'used_elsewhere' || outcome === 'revoked' || outcome === 'refunded') {
      logRefusal('verify', purchase.store, outcome);
    }
    return json({ status: outcome, unlocked });
  }

  async function revoked(
    store: AppStore,
    transactionId: string,
    at: Date,
    facts: RevokedFacts,
  ): Promise<boolean> {
    const row = await deps.revoke(store, transactionId, at, facts);
    if (!row) return false;
    await send(
      'purchase_refunded',
      {
        store,
        productId: row.productId,
        originalTransactionId: transactionId,
        price: row.price,
        currency: row.currency,
        country: row.country,
        tax: null,
      },
      row.userId,
      row.householdId,
      row.environment,
    );
    return true;
  }

  async function appleNotification(req: Request): Promise<Response> {
    if (!configured) return notConfigured();
    const body = await req.json().catch(() => null) as { signedPayload?: unknown } | null;
    if (typeof body?.signedPayload !== 'string' || body.signedPayload.length > 65_536) {
      return json({ error: 'bad_request' }, { status: 400 });
    }
    let n: AppleNotification;
    try {
      n = await deps.apple.notification(body.signedPayload);
    } catch (e) {
      if (e instanceof Refused) {
        logRefusal('apple/notifications', 'apple', e.reason);
        return json({ error: 'refused', reason: e.reason }, { status: 400 });
      }
      throw e;
    }
    // Answered 200 so Apple stops retrying: a TEST, another product, another environment
    // (sandbox and production may share this URL) or a type we don't act on.
    const t = n.transaction;
    const environment = n.data?.environment;
    if (
      !t || t.productId !== lifetimeProductId ||
      !deps.environments.includes(environment as StoreEnvironment)
    ) {
      return json({ status: 'ignored' });
    }
    if (n.notificationType === 'REFUND' || n.notificationType === 'REVOKE') {
      const at = new Date(t.revocationDate ?? n.signedDate);
      const changed = await revoked('apple', t.originalTransactionId, at, {
        productId: t.productId,
        environment: environment as StoreEnvironment,
        purchasedAt: new Date(t.purchaseDate),
      });
      return json({ status: changed ? 'revoked' : 'unchanged' });
    }
    if (n.notificationType === 'REFUND_REVERSED') {
      const changed = await deps.reinstate('apple', t.originalTransactionId);
      return json({ status: changed ? 'reinstated' : 'unchanged' });
    }
    return json({ status: 'ignored' });
  }

  async function googleVoided(req: Request): Promise<Response> {
    if (!configured || !deps.google || !deps.cronSecret) return notConfigured();
    const header = req.headers.get('authorization') ?? '';
    if (!await sameSecret(header, `Bearer ${deps.cronSecret}`)) {
      return json({ error: 'invalid_token' }, { status: 401 });
    }
    let voided: VoidedPurchase[];
    try {
      voided = await deps.google.voided(new Date(deps.now().getTime() - voidedLookbackMs));
    } catch (e) {
      if (e instanceof StoreUnavailable) {
        return json({ error: 'store_unavailable' }, { status: 502 });
      }
      throw e;
    }
    let count = 0;
    for (const v of voided) {
      // The voided list names no product or environment: ours is the only product, and an
      // unknown Play purchase recorded as Production only blocks that one receipt.
      const facts = {
        productId: lifetimeProductId,
        environment: 'Production' as const,
        purchasedAt: null,
      };
      if (await revoked('google', await deps.google.transactionId(v), v.voidedAt, facts)) count++;
    }
    return json({ checked: voided.length, revoked: count });
  }

  return async (req) => {
    const pre = preflight(req);
    if (pre) return pre;
    const path = new URL(req.url).pathname.replace(/\/+$/, '');
    try {
      if (req.method === 'GET' && /\/purchases$/.test(path)) {
        return json({ configured, environments: deps.environments });
      }
      if (req.method !== 'POST') return json({ error: 'not_found' }, { status: 404 });
      if (path.endsWith('/purchases/verify')) return await verify(req);
      if (path.endsWith('/purchases/apple/notifications')) return await appleNotification(req);
      if (path.endsWith('/purchases/google/voided')) return await googleVoided(req);
      if (path.endsWith('/purchases/test/sign') && deps.testSigner) {
        const r = parseSignRequest(await req.json().catch(() => null));
        if (!r) return json({ error: 'bad_request' }, { status: 400 });
        return json(await signTest(deps.testSigner, r));
      }
      return json({ error: 'not_found' }, { status: 404 });
    } catch (e) {
      if (e instanceof NotConfigured) {
        deps.report(e);
        return notConfigured();
      }
      throw e;
    }
  };
}

/** Constant-time comparison of two header values. */
async function sameSecret(a: string, b: string): Promise<boolean> {
  const digest = async (s: string) =>
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  const [x, y] = await Promise.all([digest(a), digest(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
