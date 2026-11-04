// The purchases function's settings from the environment (docs/PURCHASES.md, "Configuration").
// Supabase function secrets the Lead sets; none is in the repo (scripts/iap-local-env.sh writes
// fake ones for the local stack).
//   REVENUECAT_WEBHOOK_AUTH: the Authorization header value configured for RevenueCat's webhook,
//     compared whole.
//   REVENUECAT_WEBHOOK_HMAC_SECRET: optional; when set, X-RevenueCat-Webhook-Signature must sign
//     every delivery too.
//   REVENUECAT_TOMBSTONE_HMAC_KEY: the key of the transactions' HMAC that outlives a purged
//     purchase (purchase_tombstones).
//   REVENUECAT_SECRET_KEY, REVENUECAT_PROJECT_ID: a v2 secret key and the project, for deleting
//     the customers of deleted households (deletions.ts); without them that route does nothing.
//   REVENUECAT_DELETIONS_SECRET: what the daily workflow sends as x-deletions-secret; without it
//     the deletion route answers 503 and deletes nothing (fail closed). The beta grant route
//     (job 43b) takes the same secret.
//   BETA_PROMO_ENDS_AT: optional, the end of the free beta unlock (ISO 8601); default
//     2027-12-31 midnight in Berlin. Unreadable or past: the beta grant route answers 503.
// Without the first or the last the webhook answers 503 not_configured; the app's claim works.
import type { Env } from '../_shared/telemetry.ts';
import { localStackUrl } from '../alexa/config.ts';
import { defaultBetaEnd } from './beta_promo.ts';
import type { RevenueCatKey } from './deletions.ts';

export interface WebhookSecrets {
  authorization: string;
  signingSecret: string | null;
  tombstoneKey: string;
}

export interface PurchasesConfig {
  /** Null: not configured, the webhook answers 503. */
  webhook: WebhookSecrets | null;
  /** Inside a local stack: /purchases/test/event is served. */
  local: boolean;
  /** Supabase's SB_REGION, logged per request: the webhook must run in Frankfurt (H-54). */
  region: string | null;
  /** Null: the deletion route skips. */
  revenueCat: RevenueCatKey | null;
  /** Null: the deletion route refuses every call (503). */
  deletionsSecret: string | null;
  /** Null: BETA_PROMO_ENDS_AT is unreadable or past; the beta grant route answers 503. */
  betaPromoEndsAt: Date | null;
}

export function configFrom(env: Env): PurchasesConfig {
  const value = (key: string) => env.get(key)?.trim() || null;
  const authorization = value('REVENUECAT_WEBHOOK_AUTH');
  const tombstoneKey = value('REVENUECAT_TOMBSTONE_HMAC_KEY');
  const secretKey = value('REVENUECAT_SECRET_KEY');
  const projectId = value('REVENUECAT_PROJECT_ID');
  return {
    webhook: authorization && tombstoneKey
      ? { authorization, signingSecret: value('REVENUECAT_WEBHOOK_HMAC_SECRET'), tombstoneKey }
      : null,
    local: env.get('SUPABASE_URL') === localStackUrl,
    region: value('SB_REGION'),
    revenueCat: secretKey && projectId ? { secretKey, projectId } : null,
    deletionsSecret: value('REVENUECAT_DELETIONS_SECRET'),
    betaPromoEndsAt: betaEnd(value('BETA_PROMO_ENDS_AT'), new Date()),
  };
}

/** [raw] as the beta's end; the default without it; null when unreadable or not in the future. */
export function betaEnd(raw: string | null, now: Date): Date | null {
  const end = raw === null ? defaultBetaEnd : new Date(raw);
  return Number.isNaN(end.getTime()) || end <= now ? null : end;
}
