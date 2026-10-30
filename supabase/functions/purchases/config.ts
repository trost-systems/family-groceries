// The purchases function's settings from the environment (docs/PURCHASES.md, "Configuration").
// Every value is a Supabase function secret the Lead sets (NEEDS_LEAD Job 25); none is in the repo.
//   PURCHASES_ENVIRONMENTS: which store environments may unlock, comma-separated: "Sandbox"
//     (TestFlight, Apple sandbox testers, Play license testers) or "Production,Sandbox". Unset, the
//     function is inert: every route answers 503 not_configured. "Production" without "Sandbox"
//     leaves it inert too: App Review buys in the sandbox, and a refusal is final for the app
//     (DECISIONS 25b.2), while a 503 keeps the purchase queued until the list is fixed.
//   APPLE_IAP_KEY_ID, APPLE_IAP_ISSUER_ID, APPLE_IAP_PRIVATE_KEY: an App Store Connect In-App
//     Purchase key (not the App Store Connect API key). Optional: without it Apple transactions are
//     verified from their signature alone; with it the App Store Server API is asked too.
//   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: the Play service account's JSON key. Without it Google
//     purchases answer 503 not_configured.
//   PURCHASES_CRON_SECRET: the bearer token of the daily voided-purchases poll (GitHub schedule).
//   PURCHASES_TEST_ROOT_PEM (base64 of PEM), PURCHASES_TEST_X5C, PURCHASES_TEST_KEY: a test CA
//     standing in for Apple's and its signing leaf, written by scripts/iap-test-ca.sh for the local
//     stack. Honoured only inside a local stack (and only then is /purchases/test/sign served).
import * as x509 from '@peculiar/x509';
import type { Env } from '../_shared/telemetry.ts';
import { localStackUrl } from '../alexa/config.ts';
import { appleAnchors, type AppleTrust, type InAppPurchaseKey } from './apple.ts';
import type { TestSigner } from './test_signer.ts';
import { appId, type StoreEnvironment } from './types.ts';

export interface PurchasesConfig {
  /** Empty: not configured, the function answers 503. */
  environments: StoreEnvironment[];
  apple: AppleTrust;
  appleKey: InAppPurchaseKey | null;
  googleServiceAccount: string | null;
  cronSecret: string | null;
  /** The test CA's signer, local stack only: /purchases/test/sign is served. */
  testSigner: TestSigner | null;
}

const fromBase64 = (text: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(text.trim()), (c) => c.charCodeAt(0)));

export function configFrom(env: Env): PurchasesConfig {
  const value = (key: string) => env.get(key)?.trim() || null;
  const environments = (value('PURCHASES_ENVIRONMENTS') ?? '').split(',').map((s) => s.trim())
    .filter((s): s is StoreEnvironment => s === 'Production' || s === 'Sandbox');
  const keyId = value('APPLE_IAP_KEY_ID');
  const issuerId = value('APPLE_IAP_ISSUER_ID');
  const privateKey = value('APPLE_IAP_PRIVATE_KEY');
  let anchors = appleAnchors();
  let testSigner: TestSigner | null = null;
  const testRoot = value('PURCHASES_TEST_ROOT_PEM');
  if (testRoot) {
    if (env.get('SUPABASE_URL') === localStackUrl) {
      anchors = x509.PemConverter.decode(fromBase64(testRoot)).map((der) =>
        new x509.X509Certificate(der)
      );
      const key = value('PURCHASES_TEST_KEY');
      const x5c = value('PURCHASES_TEST_X5C')?.split(',');
      testSigner = key && x5c?.length === 3 ? { key: fromBase64(key), x5c } : null;
    } else {
      console.error('purchases: PURCHASES_TEST_ROOT_PEM ignored outside the local stack');
    }
  }
  const productionOnly = environments.includes('Production') && !environments.includes('Sandbox');
  if (productionOnly) {
    console.error('purchases: PURCHASES_ENVIRONMENTS=Production needs Sandbox too; inert');
  }
  return {
    environments: productionOnly ? [] : [...new Set(environments)],
    apple: { anchors, bundleId: appId, now: () => new Date() },
    appleKey: keyId && issuerId && privateKey
      ? { keyId, issuerId, privateKey: privateKey.replaceAll('\\n', '\n') }
      : null,
    googleServiceAccount: value('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON'),
    cronSecret: value('PURCHASES_CRON_SECRET'),
    testSigner,
  };
}
