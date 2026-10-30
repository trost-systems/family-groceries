// The handler's dependencies in production: the verifiers built from the configuration, the
// database, the shared auth and telemetry. Kept out of index.ts so the database integration test
// runs the same wiring.
import { authenticateSession, AuthError } from '../_shared/auth.ts';
import { householdOf, serviceDb } from '../_shared/db.ts';
import { sendPurchaseEvent } from '../_shared/purchases.ts';
import type { Telemetry } from '../_shared/telemetry.ts';
import { analyticsSubject } from '../alexa/store.ts';
import {
  AppleConfigError,
  appleNotification,
  applePurchase,
  appleTransaction,
  AppStoreServerApi,
} from './apple.ts';
import type { PurchasesConfig } from './config.ts';
import { GoogleConfigError, GooglePlay, tokenTransactionId } from './google.ts';
import { type Deps, NotConfigured } from './handler.ts';
import { grant, reinstate, revoke, takeCall } from './store.ts';

/** The app's own session, in a household (purchases unlock households). */
export async function sessionInHousehold(req: Request) {
  const { userId } = await authenticateSession(req);
  const householdId = await householdOf(userId);
  if (!householdId) throw new AuthError('no_household', 'Dieses Konto gehört zu keinem Haushalt.');
  return { userId, householdId };
}

/** Configuration errors become NotConfigured: a 503 for the caller, an issue in error tracking. */
async function configured<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (e) {
    if (e instanceof AppleConfigError || e instanceof GoogleConfigError) {
      throw new NotConfigured(e.message);
    }
    throw e;
  }
}

export function productionDeps(
  config: PurchasesConfig,
  telemetry: Telemetry,
  options: {
    fetch?: typeof fetch;
    authenticate?: Deps['authenticate'];
  } = {},
): Deps {
  const fetchImpl = options.fetch ?? fetch;
  const serverApi = config.appleKey
    ? new AppStoreServerApi(config.appleKey, { fetch: fetchImpl, trust: config.apple })
    : null;
  let play: GooglePlay | null = null;
  const google = () =>
    configured(() => {
      play ??= new GooglePlay({
        serviceAccount: config.googleServiceAccount!,
        fetch: fetchImpl,
        now: () => new Date(),
      });
      return Promise.resolve(play);
    });

  return {
    environments: config.environments,
    authenticate: options.authenticate ?? sessionInHousehold,
    takeCall: (userId) => takeCall(serviceDb(), userId),
    apple: {
      transaction: (jws) =>
        configured(async () => {
          const local = await appleTransaction(jws, config.apple);
          const purchase = applePurchase(local);
          if (!serverApi) return purchase;
          // Apple's own record wins: it knows refunds and revocations the app's copy cannot.
          const current = await serverApi.transaction(local.transactionId, purchase.environment);
          return applePurchase(current);
        }),
      notification: (signedPayload) => appleNotification(signedPayload, config.apple),
    },
    google: config.googleServiceAccount
      ? {
        verify: async (productId, token) => (await google()).verify(productId, token),
        acknowledge: async (productId, token) => (await google()).acknowledge(productId, token),
        voided: async (since) => (await google()).voidedPurchases(since),
        transactionId: async (v) => v.orderId ?? await tokenTransactionId(v.purchaseToken),
      }
      : null,
    cronSecret: config.cronSecret,
    testSigner: config.testSigner,
    grant: async (p, userId, householdId) => {
      try {
        return await grant(serviceDb(), p, userId, householdId);
      } catch (e) {
        // purchase_grant's not_a_member: the user left the household since the session check.
        if ((e as { code?: string }).code === '42501') {
          throw new AuthError('no_household', 'Dieses Konto gehört zu keinem Haushalt.');
        }
        throw e;
      }
    },
    revoke: (store, transactionId, at, facts) =>
      revoke(serviceDb(), store, transactionId, at, facts),
    reinstate: (store, transactionId) => reinstate(serviceDb(), store, transactionId),
    subject: async (userId) => {
      if (!telemetry.enabled) return null;
      const s = await analyticsSubject(serviceDb(), userId);
      return s && { installId: s.installId, householdId: s.householdId, internal: s.internal };
    },
    event: async (name, revenue, subject) => {
      await sendPurchaseEvent(telemetry, name, revenue, subject);
    },
    report: (e) => telemetry.exception(e),
    now: () => new Date(),
  };
}
