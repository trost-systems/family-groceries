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
//     the deletion route answers 503 and deletes nothing (fail closed).
// Without the first or the last the webhook answers 503 not_configured; the app's claim works.
import type { Env } from '../_shared/telemetry.ts';
import { localStackUrl } from '../alexa/config.ts';
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
  };
}
