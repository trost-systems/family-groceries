// The handler's dependencies in production: the database, the shared auth and telemetry. Kept out
// of index.ts so the database integration test runs the same wiring.
import { authenticateSession, AuthError } from '../_shared/auth.ts';
import { serviceDb } from '../_shared/db.ts';
import { sendPurchaseEvent } from '../_shared/purchases.ts';
import type { Telemetry } from '../_shared/telemetry.ts';
import { analyticsSubject } from '../alexa/store.ts';
import type { PurchasesConfig } from './config.ts';
import type { Deps, Ledger } from './handler.ts';
import { hmacHex } from './revenuecat.ts';
import { deleteDueCustomers } from './deletions.ts';
import {
  claim,
  deletionDone,
  firstDelivery,
  record,
  reinstate,
  revoke,
  takeCall,
  takeDeletions,
} from './store.ts';

/** The app's own session; the claim names the household it bought for. */
export async function appSession(req: Request) {
  const { userId } = await authenticateSession(req);
  return { userId };
}

export function productionDeps(
  config: PurchasesConfig,
  telemetry: Telemetry,
  options: { authenticate?: Deps['authenticate'] } = {},
): Deps {
  const webhook = config.webhook;
  return {
    webhook,
    local: config.local,
    region: config.region,
    deletionsSecret: config.deletionsSecret,
    authenticate: options.authenticate ?? appSession,
    takeCall: (userId) => takeCall(serviceDb(), userId),
    once: async (event, work) => {
      const result = await serviceDb().begin(async (tx) => {
        if (!await firstDelivery(tx, event.id, event.type)) return { first: false as const };
        const ledger: Ledger = {
          record: async (p) => record(tx, p, await hmacHex(webhook!.tombstoneKey, p.transactionId)),
          revoke: (r) => revoke(tx, r),
          reinstate: (store, transactionId) => reinstate(tx, store, transactionId),
        };
        return { first: true as const, value: await work(ledger) };
      });
      return result.first ? result.value as Awaited<ReturnType<typeof work>> : null;
    },
    claim: async (userId, householdId, store, transactionId) => {
      try {
        return await claim(serviceDb(), userId, householdId, store, transactionId);
      } catch (e) {
        // purchase_claim's not_a_member: no member of that household when buying.
        if ((e as { code?: string }).code === '42501') {
          throw new AuthError(
            'no_household',
            'Dieses Konto gehörte beim Kauf nicht zu diesem Haushalt.',
          );
        }
        throw e;
      }
    },
    subject: async (userId) => {
      if (!telemetry.enabled) return null;
      const s = await analyticsSubject(serviceDb(), userId);
      return s && { installId: s.installId, householdId: s.householdId, internal: s.internal };
    },
    event: async (name, sale, subject) => {
      await sendPurchaseEvent(telemetry, name, {
        store: sale.store,
        productId: sale.productId,
        originalTransactionId: sale.transactionId,
        price: sale.price,
        currency: sale.currency,
        country: sale.country,
        tax: null,
      }, subject);
    },
    deleteDueCustomers: config.revenueCat
      ? () =>
        deleteDueCustomers(
          {
            take: (limit) => takeDeletions(serviceDb(), limit),
            done: (id) => deletionDone(serviceDb(), id),
          },
          config.revenueCat!,
          fetch,
        )
      : null,
    report: (e) => telemetry.exception(e),
    now: () => new Date(),
  };
}
