// The purchases function (docs/PURCHASES.md): RevenueCat tells it about Hummlist Lifetime
// purchases and refunds, and it unlocks the household (RevenueCat's App User ID) or takes the
// unlock away. It never talks to Apple or Google itself.
//   GET  /purchases                       whether the webhook is configured (smoke checks)
//   POST /purchases/revenuecat/webhook    RevenueCat's webhook (Authorization:
//                                         REVENUECAT_WEBHOOK_AUTH, compared whole)
//   POST /purchases/revenuecat/deletions  deletes due RevenueCat customers (deletions.ts); the
//                                         daily workflow, with x-deletions-secret:
//                                         REVENUECAT_DELETIONS_SECRET (compared whole; 503 unset)
//   POST /purchases/claim       the app, signed in (its own session, not a PAT or OAuth app): "I
//                               bought this transaction for this household" (H-55)
// Routes match exactly, after the gateway's /functions/v1 prefix.
//   POST /purchases/test/event  local stack only: a RevenueCat event, processed like the webhook's
// Refusals are logged by reason and event type only: never a transaction id, user or household.
import { AuthError } from '../_shared/auth.ts';
import { json, preflight } from '../_shared/http.ts';
import type { AppStore, PurchaseEvent } from '../_shared/purchases.ts';
import type { Subject } from '../_shared/telemetry.ts';
import { parseWebhook, sameSecret, signedBy, testEvent, type WebhookEvent } from './revenuecat.ts';
import type { Claim, Recorded, Revoked } from './store.ts';
import { type Refund, type Sale, type StorePurchase, webhookPath } from './types.ts';
import type { DeletionOutcome } from './deletions.ts';

/** The writes one event may make, all in the transaction that records its id. */
export interface Ledger {
  record(p: StorePurchase): Promise<Recorded>;
  revoke(r: Refund): Promise<Revoked | null>;
  reinstate(store: AppStore, transactionId: string): Promise<boolean>;
}

export interface Deps {
  /** Null: not configured, the webhook answers 503. */
  webhook: { authorization: string; signingSecret: string | null } | null;
  /** Inside a local stack: /purchases/test/event is served. */
  local: boolean;
  region: string | null;
  /** Null: REVENUECAT_DELETIONS_SECRET is unset, the deletion route answers 503. */
  deletionsSecret: string | null;
  /** The app's own session; throws AuthError. */
  authenticate(req: Request): Promise<{ userId: string }>;
  /** Takes one claim from the user's allowance; false when it is used up. */
  takeCall(userId: string): Promise<boolean>;
  /**
   * Runs [work] in one transaction with recording [event]'s id: null when the id was recorded
   * before. A failure rolls the id back, so RevenueCat's retry runs it again.
   */
  once<T>(
    event: { id: string; type: string },
    work: (ledger: Ledger) => Promise<T>,
  ): Promise<T | null>;
  /**
   * purchase_claim for [householdId], the household the app bought for; throws AuthError when the
   * user was no member of it at the time of buying.
   */
  claim(
    userId: string,
    householdId: string,
    store: AppStore,
    transactionId: string,
  ): Promise<Claim>;
  /** Null without REVENUECAT_SECRET_KEY and REVENUECAT_PROJECT_ID: the route skips. */
  deleteDueCustomers: (() => Promise<DeletionOutcome>) | null;
  /** Whom analytics events for [userId] go to: null unless their latest answer in the app was yes. */
  subject(userId: string): Promise<Subject | null>;
  event(name: PurchaseEvent, sale: Sale, subject: Subject): Promise<void>;
  report(error: unknown): void;
  now(): Date;
}

/** Larger than any RevenueCat event; anything bigger is not one. */
export const maxBodyBytes = 65_536;

/** An analytics event due once the event's transaction committed. */
interface Due {
  name: PurchaseEvent;
  sale: Sale;
  userId: string;
  internal: boolean;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The routes, as the function sees its path (without the gateway's /functions/v1). */
export const routes = {
  status: '/purchases',
  webhook: webhookPath,
  deletions: '/purchases/revenuecat/deletions',
  claim: '/purchases/claim',
  testEvent: '/purchases/test/event',
} as const;

const log = (fields: Record<string, string | null>) =>
  console.log(JSON.stringify({ fn: 'purchases', ...fields }));

export function createHandler(deps: Deps): (req: Request) => Promise<Response> {
  const notConfigured = () => json({ error: 'not_configured' }, { status: 503 });
  const badRequest = () => json({ error: 'bad_request' }, { status: 400 });

  async function send(due: Due | null) {
    if (!due) return;
    try {
      const subject = await deps.subject(due.userId);
      if (!subject) return;
      await deps.event(due.name, due.sale, {
        installId: subject.installId,
        householdId: due.sale.householdId ?? subject.householdId,
        // A sandbox purchase is never revenue, nor is a tester's: internal (docs/ANALYTICS.md).
        internal: subject.internal === true || due.sale.environment === 'Sandbox' || due.internal,
      });
    } catch (e) {
      // Analytics never fails a purchase.
      deps.report(e);
    }
  }

  async function process(e: WebhookEvent): Promise<Response> {
    const { action } = e;
    if (e.type === 'TRANSFER') log({ event: e.type });
    if (action.do === 'ignore' && action.refused) log({ event: e.type, refused: action.refused });
    const done = await deps.once(
      e,
      async (ledger): Promise<{ status: string; due: Due | null }> => {
        switch (action.do) {
          case 'ignore':
            return { status: 'ignored', due: null };
          case 'record': {
            const p = action.purchase;
            const r = await ledger.record(p);
            if (r.outcome !== 'granted' && r.outcome !== 'restored') {
              log({ event: e.type, refused: r.outcome });
            }
            const due = r.sendCompleted && r.buyer
              ? {
                name: 'purchase_completed' as const,
                sale: p,
                userId: r.buyer,
                internal: r.internal,
              }
              : null;
            return { status: r.outcome, due };
          }
          case 'revoke': {
            const row = await ledger.revoke(action.refund);
            const due = row?.userId
              ? {
                name: 'purchase_refunded' as const,
                sale: row,
                userId: row.userId,
                internal: row.internal,
              }
              : null;
            return { status: row ? 'revoked' : 'unchanged', due };
          }
          case 'reinstate':
            return {
              status: await ledger.reinstate(action.store, action.transactionId)
                ? 'reinstated'
                : 'unchanged',
              due: null,
            };
        }
      },
    );
    if (!done) return json({ status: 'duplicate' });
    await send(done.due);
    return json({ status: done.status });
  }

  async function webhook(req: Request): Promise<Response> {
    const secrets = deps.webhook;
    if (!secrets) return notConfigured();
    if (!await sameSecret(req.headers.get('authorization') ?? '', secrets.authorization)) {
      return json({ error: 'invalid_token' }, { status: 401 });
    }
    if (Number(req.headers.get('content-length') ?? 0) > maxBodyBytes) return badRequest();
    const raw = new Uint8Array(await req.arrayBuffer());
    if (raw.length > maxBodyBytes) return badRequest();
    if (
      secrets.signingSecret &&
      !await signedBy(
        secrets.signingSecret,
        req.headers.get('x-revenuecat-webhook-signature'),
        raw,
        deps.now(),
      )
    ) {
      return json({ error: 'bad_signature' }, { status: 401 });
    }
    let body: unknown;
    try {
      body = JSON.parse(new TextDecoder().decode(raw));
    } catch {
      return badRequest();
    }
    const event = parseWebhook(body, deps.now());
    return event ? await process(event) : badRequest();
  }

  async function claimRoute(req: Request): Promise<Response> {
    let who: { userId: string };
    try {
      who = await deps.authenticate(req);
    } catch (e) {
      if (e instanceof AuthError) return json({ error: e.reason }, { status: e.status });
      throw e;
    }
    const b = await req.json().catch(() => null) as Record<string, unknown> | null;
    const store = b?.store === 'apple' || b?.store === 'google' ? b.store : null;
    const transactionId = typeof b?.transactionId === 'string' && b.transactionId.length > 0 &&
        b.transactionId.length <= 200
      ? b.transactionId
      : null;
    const householdId = typeof b?.householdId === 'string' && uuid.test(b.householdId)
      ? b.householdId
      : null;
    if (!store || !transactionId || !householdId) return badRequest();
    if (!await deps.takeCall(who.userId)) return json({ error: 'rate_limited' }, { status: 429 });
    let c: Claim;
    try {
      c = await deps.claim(who.userId, householdId, store, transactionId);
    } catch (e) {
      // No member of that household when buying.
      if (e instanceof AuthError) return json({ error: e.reason }, { status: e.status });
      throw e;
    }
    if (c.completed) {
      await send({
        name: 'purchase_completed',
        sale: c.completed,
        userId: who.userId,
        internal: c.completed.internal,
      });
    }
    return json({ status: c.status });
  }

  async function localEvent(req: Request): Promise<Response> {
    if (!deps.webhook) return notConfigured();
    const body = testEvent(await req.json().catch(() => null), deps.now());
    const event = body && parseWebhook(body, deps.now());
    return event ? await process(event) : badRequest();
  }

  async function deletions(req: Request): Promise<Response> {
    if (!deps.deletionsSecret) return notConfigured();
    if (!await sameSecret(req.headers.get('x-deletions-secret') ?? '', deps.deletionsSecret)) {
      return json({ error: 'invalid_token' }, { status: 401 });
    }
    if (!deps.deleteDueCustomers) return json({ status: 'not_configured' });
    const outcome = await deps.deleteDueCustomers();
    log({ deletions: JSON.stringify(outcome) });
    return json(outcome, { status: outcome.failed > 0 ? 502 : 200 });
  }

  return async (req) => {
    const pre = preflight(req);
    if (pre) return pre;
    log({ region: deps.region });
    const path = new URL(req.url).pathname.replace(/\/+$/, '').replace(
      /^\/functions\/v1(?=\/)/,
      '',
    );
    if (req.method === 'GET' && path === routes.status) {
      return json({ configured: deps.webhook !== null });
    }
    if (req.method === 'POST') {
      if (path === routes.webhook) return await webhook(req);
      if (path === routes.deletions) return await deletions(req);
      if (path === routes.claim) return await claimRoute(req);
      if (path === routes.testEvent && deps.local) return await localEvent(req);
    }
    return json({ error: 'not_found' }, { status: 404 });
  };
}
