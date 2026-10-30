// Local stack only: signs StoreKit 2 transactions and App Store Server Notifications with the test
// CA from scripts/iap-test-ca.sh, the way the App Store signs them. POST /purchases/test/sign
// exists only while config.ts accepted the test CA (SUPABASE_URL is the local stack), so a hosted
// project answers 404 and trusts Apple's root alone. The app's fake store (fg), the e2e specs and
// scripts use it to play the App Store's part.
import { CompactSign, importPKCS8 } from 'jose';
import type { AppleTransaction } from './apple.ts';
import { appId, lifetimeProductId } from './types.ts';

export interface TestSigner {
  key: string;
  /** Leaf, intermediate and root, base64 DER. */
  x5c: string[];
}

export interface SignRequest {
  /** A transaction id; the same id is the same purchase (restore, refund). */
  transactionId: string;
  /** Sign a notification of this type (REFUND, REVOKE, REFUND_REVERSED, TEST) instead. */
  notificationType?: string;
  environment?: string;
  productId?: string;
  bundleId?: string;
  revoked?: boolean;
}

export function parseSignRequest(body: unknown): SignRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  const text = (v: unknown) => typeof v === 'string' && v.length <= 200 ? v : undefined;
  const transactionId = text(b.transactionId);
  if (!transactionId) return null;
  return {
    transactionId,
    notificationType: text(b.notificationType),
    environment: text(b.environment),
    productId: text(b.productId),
    bundleId: text(b.bundleId),
    revoked: b.revoked === true,
  };
}

export async function signTest(signer: TestSigner, r: SignRequest, now = Date.now()) {
  const key = await importPKCS8(signer.key, 'ES256');
  const sign = (payload: unknown) =>
    new CompactSign(new TextEncoder().encode(JSON.stringify(payload)))
      .setProtectedHeader({ alg: 'ES256', x5c: signer.x5c })
      .sign(key);
  const revoked = r.revoked || r.notificationType === 'REFUND' || r.notificationType === 'REVOKE';
  const transaction: AppleTransaction = {
    transactionId: r.transactionId,
    originalTransactionId: r.transactionId,
    bundleId: r.bundleId ?? appId,
    productId: r.productId ?? lifetimeProductId,
    purchaseDate: now - 1_000,
    signedDate: now,
    environment: r.environment ?? 'Sandbox',
    type: 'Non-Consumable',
    storefront: 'DEU',
    price: 9990,
    currency: 'EUR',
    ...(revoked ? { revocationDate: now, revocationReason: 0 } : {}),
  };
  if (!r.notificationType) return { jws: await sign(transaction) };
  return {
    signedPayload: await sign({
      notificationType: r.notificationType,
      notificationUUID: crypto.randomUUID(),
      signedDate: now,
      version: '2.0',
      data: {
        bundleId: transaction.bundleId,
        environment: transaction.environment,
        signedTransactionInfo: await sign(transaction),
      },
    }),
  };
}
