// App Store purchases (docs/PURCHASES.md, "Apple"). StoreKit 2 hands the app each transaction as a
// JWS signed by Apple; App Store Server Notifications V2 arrive as one too. Both are checked here
// without asking Apple, the way Apple's App Store Server Library does it:
//   1. the header is ES256 with an x5c chain of three certificates (leaf, intermediate, root);
//   2. the root is byte for byte a pinned Apple root (apple_roots.ts), the intermediate is a CA
//      signed by it, the leaf is signed by the intermediate, and both are valid at the payload's
//      signedDate (an old transaction stays verifiable after Apple rotates its leaf);
//   3. the leaf carries Apple's App Store receipt-signing OID 1.2.840.113635.100.6.11.1, the
//      intermediate the Apple WWDR OID 1.2.840.113635.100.6.2.1;
//   4. the JWS signature verifies with the leaf's key;
//   5. bundleId is ours, then (applePurchase) productId and environment; a notification's
//      transaction is from the notification's own environment.
// With an In-App Purchase key (NEEDS_LEAD Job 25) the handler also asks the App Store Server API
// for the transaction's current state ([AppStoreServerApi]), which reports refunds and revocations
// the app's copy cannot know about. OCSP revocation of Apple's certificates is not checked: the
// server API covers that once the key exists (DECISIONS 25.6).
import * as x509 from '@peculiar/x509';
import { compactVerify, decodeJwt, decodeProtectedHeader, importPKCS8, SignJWT } from 'jose';
import { appleRootG3Pem } from './apple_roots.ts';
import {
  appId,
  lifetimeProductId,
  Refused,
  type StoreEnvironment,
  type StorePurchase,
  StoreUnavailable,
} from './types.ts';

x509.cryptoProvider.set(crypto);

/** Apple's marker extensions (Apple's App Store Server Library, ChainVerifier). */
export const leafOid = '1.2.840.113635.100.6.11.1';
export const intermediateOid = '1.2.840.113635.100.6.2.1';

/** A signedDate this far ahead of our clock is refused. */
const maxFutureMs = 5 * 60_000;

export interface AppleTrust {
  /** Roots the chain's third certificate must equal. */
  anchors: readonly x509.X509Certificate[];
  /** The bundle id the payload must name. */
  bundleId: string;
  now(): Date;
}

export const appleAnchors = (): x509.X509Certificate[] => [
  new x509.X509Certificate(appleRootG3Pem),
];

export const appleTrust = (): AppleTrust => ({
  anchors: appleAnchors(),
  bundleId: appId,
  now: () => new Date(),
});

/** The fields of Apple's JWSTransactionDecodedPayload this function reads. */
export interface AppleTransaction {
  transactionId: string;
  originalTransactionId: string;
  bundleId: string;
  productId: string;
  /** Milliseconds since the epoch. */
  purchaseDate: number;
  signedDate: number;
  /** "Production", "Sandbox", "Xcode" or "LocalTesting". */
  environment: string;
  type?: string;
  /** Alpha-3 storefront, e.g. DEU. */
  storefront?: string;
  /** Milliunits: 9990 is 9.99. */
  price?: number;
  currency?: string;
  revocationDate?: number;
  revocationReason?: number;
  appAccountToken?: string;
}

/** The fields of ResponseBodyV2DecodedPayload this function reads. */
export interface AppleNotification {
  notificationType: string;
  subtype?: string;
  notificationUUID: string;
  signedDate: number;
  data?: {
    bundleId?: string;
    environment?: string;
    signedTransactionInfo?: string;
  };
  /** The notification's decoded and verified signedTransactionInfo, if it carried one. */
  transaction: AppleTransaction | null;
}

const validAt = (cert: x509.X509Certificate, at: Date) =>
  cert.notBefore.getTime() <= at.getTime() && at.getTime() <= cert.notAfter.getTime();

const signedBy = (cert: x509.X509Certificate, issuer: x509.X509Certificate) =>
  cert.issuer === issuer.subject &&
  cert.verify({ publicKey: issuer.publicKey, signatureOnly: true }).catch(() => false);

const sameCert = (a: x509.X509Certificate, b: x509.X509Certificate) => {
  const x = new Uint8Array(a.rawData);
  const y = new Uint8Array(b.rawData);
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

/** Steps 1 to 4: returns the verified payload of [jws]; throws [Refused] otherwise. */
export async function verifyAppleJws<T extends { signedDate?: number }>(
  jws: string,
  trust: Pick<AppleTrust, 'anchors' | 'now'>,
): Promise<T> {
  let header: ReturnType<typeof decodeProtectedHeader>;
  let claimed: T;
  try {
    header = decodeProtectedHeader(jws);
    claimed = decodeJwt(jws) as unknown as T;
  } catch {
    throw new Refused('malformed');
  }
  if (header.alg !== 'ES256') throw new Refused('bad_signature');
  const x5c = header.x5c;
  if (!Array.isArray(x5c) || x5c.length !== 3) throw new Refused('untrusted_chain');
  let leaf: x509.X509Certificate, intermediate: x509.X509Certificate, root: x509.X509Certificate;
  try {
    [leaf, intermediate, root] = x5c.map((b64) => new x509.X509Certificate(b64));
  } catch {
    throw new Refused('untrusted_chain');
  }
  const signedDate = typeof claimed.signedDate === 'number' ? claimed.signedDate : NaN;
  const now = trust.now();
  if (!Number.isFinite(signedDate) || signedDate > now.getTime() + maxFutureMs) {
    throw new Refused('malformed');
  }
  const at = new Date(signedDate);
  const trusted = trust.anchors.some((anchor) => sameCert(root, anchor)) &&
    validAt(root, at) && validAt(intermediate, at) && validAt(leaf, at) &&
    intermediate.getExtension(x509.BasicConstraintsExtension)?.ca === true &&
    intermediate.getExtension(intermediateOid) !== null &&
    leaf.getExtension(leafOid) !== null &&
    await signedBy(intermediate, root) && await signedBy(leaf, intermediate);
  if (!trusted) throw new Refused('untrusted_chain');
  try {
    const key = await leaf.publicKey.export({ name: 'ECDSA', namedCurve: 'P-256' }, ['verify']);
    const { payload } = await compactVerify(jws, key, { algorithms: ['ES256'] });
    return JSON.parse(new TextDecoder().decode(payload)) as T;
  } catch {
    throw new Refused('bad_signature');
  }
}

/** A StoreKit 2 transaction JWS for our app; product and environment are not checked yet. */
export async function appleTransaction(jws: string, trust: AppleTrust): Promise<AppleTransaction> {
  const t = await verifyAppleJws<AppleTransaction>(jws, trust);
  if (
    typeof t.transactionId !== 'string' || typeof t.originalTransactionId !== 'string' ||
    typeof t.productId !== 'string' || typeof t.purchaseDate !== 'number'
  ) {
    throw new Refused('malformed');
  }
  if (t.bundleId !== trust.bundleId) throw new Refused('wrong_app');
  return t;
}

/** A signed App Store Server Notification V2 body's `signedPayload`, and its transaction. */
export async function appleNotification(
  signedPayload: string,
  trust: AppleTrust,
): Promise<AppleNotification> {
  const n = await verifyAppleJws<Omit<AppleNotification, 'transaction'>>(signedPayload, trust);
  if (typeof n.notificationType !== 'string' || typeof n.notificationUUID !== 'string') {
    throw new Refused('malformed');
  }
  // A TEST notification names the bundle too; any other app's is not ours.
  if (n.data?.bundleId !== trust.bundleId) throw new Refused('wrong_app');
  const signed = n.data?.signedTransactionInfo;
  const transaction = signed ? await appleTransaction(signed, trust) : null;
  // The handler decides on the outer environment; the transaction it acts on must be from it.
  if (transaction && transaction.environment !== n.data?.environment) {
    throw new Refused('environment_mismatch');
  }
  return { ...n, transaction };
}

const alpha2: Record<string, string> = {
  DEU: 'DE',
  AUT: 'AT',
  CHE: 'CH',
  LIE: 'LI',
  LUX: 'LU',
  BEL: 'BE',
  NLD: 'NL',
  FRA: 'FR',
  ITA: 'IT',
  ESP: 'ES',
  USA: 'US',
  GBR: 'GB',
};

export function appleEnvironment(environment: string): StoreEnvironment {
  if (environment === 'Production' || environment === 'Sandbox') return environment;
  // Xcode and LocalTesting transactions are signed by a local certificate and never get here;
  // a payload that says so anyway is not one we sell.
  throw new Refused('wrong_environment');
}

/** Step 5: the verified transaction as a purchase of Hummlist Lifetime. */
export function applePurchase(t: AppleTransaction): StorePurchase {
  if (t.productId !== lifetimeProductId) throw new Refused('wrong_product');
  return {
    store: 'apple',
    productId: t.productId,
    transactionId: t.originalTransactionId,
    environment: appleEnvironment(t.environment),
    purchasedAt: new Date(t.purchaseDate),
    revokedAt: typeof t.revocationDate === 'number' ? new Date(t.revocationDate) : null,
    pending: false,
    price: typeof t.price === 'number' ? t.price / 1000 : null,
    currency: typeof t.currency === 'string' && /^[A-Z]{3}$/.test(t.currency) ? t.currency : null,
    country: (t.storefront && alpha2[t.storefront]) ?? null,
    tax: null,
  };
}

/** An App Store Connect In-App Purchase key (Users and Access > Integrations > In-App Purchase). */
export interface InAppPurchaseKey {
  keyId: string;
  issuerId: string;
  /** The .p8 file's PEM (PKCS #8, P-256). */
  privateKey: string;
}

export class AppleConfigError extends Error {}

type Fetch = typeof fetch;

const apiHost: Record<StoreEnvironment, string> = {
  Production: 'https://api.storekit.itunes.apple.com',
  Sandbox: 'https://api.storekit-sandbox.itunes.apple.com',
};

/**
 * The App Store Server API's Get Transaction Info: the transaction as Apple has it now (a refund
 * sets revocationDate). Answers with a signed JWS, verified like the app's.
 */
export class AppStoreServerApi {
  constructor(
    private readonly key: InAppPurchaseKey,
    private readonly deps: { fetch: Fetch; trust: AppleTrust },
  ) {}

  private async token(): Promise<string> {
    let signingKey: CryptoKey;
    try {
      signingKey = await importPKCS8(this.key.privateKey, 'ES256');
    } catch {
      throw new AppleConfigError('APPLE_IAP_PRIVATE_KEY is not a PKCS #8 P-256 key');
    }
    const iat = Math.floor(this.deps.trust.now().getTime() / 1000);
    return await new SignJWT({ bid: this.deps.trust.bundleId })
      .setProtectedHeader({ alg: 'ES256', kid: this.key.keyId, typ: 'JWT' })
      .setIssuer(this.key.issuerId)
      .setIssuedAt(iat)
      .setExpirationTime(iat + 300)
      .setAudience('appstoreconnect-v1')
      .sign(signingKey);
  }

  async transaction(transactionId: string, environment: StoreEnvironment) {
    const url = `${apiHost[environment]}/inApps/v1/transactions/${
      encodeURIComponent(transactionId)
    }`;
    let res: Response;
    try {
      res = await this.deps.fetch(url, {
        headers: { authorization: `Bearer ${await this.token()}` },
      });
    } catch (e) {
      if (e instanceof AppleConfigError) throw e;
      throw new StoreUnavailable('App Store Server API unreachable');
    }
    if (res.status === 401) {
      await res.body?.cancel();
      throw new AppleConfigError('App Store Server API refused the In-App Purchase key');
    }
    if (res.status === 404 || res.status === 400) {
      await res.body?.cancel();
      throw new Refused('unknown_purchase');
    }
    if (!res.ok) {
      await res.body?.cancel();
      throw new StoreUnavailable(`App Store Server API ${res.status}`);
    }
    const body = await res.json() as { signedTransactionInfo?: unknown };
    if (typeof body.signedTransactionInfo !== 'string') throw new StoreUnavailable('no payload');
    return await appleTransaction(body.signedTransactionInfo, this.deps.trust);
  }
}
