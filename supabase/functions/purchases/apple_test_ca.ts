// Tests only: a throwaway CA standing in for Apple's, made fresh in memory for every run (no key is
// ever written down). Like Apple's chain it is ECDSA P-256: a root, an intermediate with the WWDR
// marker OID and a leaf with the App Store receipt-signing OID. It signs JWS the way the App Store
// does (ES256, x5c = leaf, intermediate, root).
import * as x509 from '@peculiar/x509';
import { CompactSign, exportPKCS8 } from 'jose';
import { type AppleTransaction, type AppleTrust, intermediateOid, leafOid } from './apple.ts';
import { appId, lifetimeProductId } from './types.ts';

x509.cryptoProvider.set(crypto);

const ec = { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' };
const day = 86_400_000;
/** ASN.1 NULL, the value Apple's marker extensions carry. */
const asnNull = new Uint8Array([5, 0]).buffer;

export interface ChainOptions {
  /** Leave Apple's marker OID off the leaf or the intermediate. */
  leafOid?: boolean;
  intermediateOid?: boolean;
  /** The leaf's validity. */
  leafNotBefore?: Date;
  leafNotAfter?: Date;
}

export interface AppleTestCa {
  root: x509.X509Certificate;
  trust(now?: Date): AppleTrust;
  /** Signs [payload] as a JWS with this CA's chain (or [x5c] instead). */
  sign(payload: unknown, x5c?: string[]): Promise<string>;
  x5c: string[];
  /** The leaf's private key, PKCS #8 PEM (for test_signer.ts). */
  leafKeyPem: string;
}

const keys = () =>
  crypto.subtle.generateKey(ec, true, ['sign', 'verify']) as Promise<CryptoKeyPair>;

export async function makeAppleTestCa(options: ChainOptions = {}): Promise<AppleTestCa> {
  const now = Date.now();
  const rootKeys = await keys();
  const root = await x509.X509CertificateGenerator.createSelfSigned({
    serialNumber: '01',
    name: 'CN=Hummlist Test Apple Root',
    notBefore: new Date(now - 365 * day),
    notAfter: new Date(now + 365 * day),
    signingAlgorithm: ec,
    keys: rootKeys,
    extensions: [new x509.BasicConstraintsExtension(true, 2, true)],
  });
  const midKeys = await keys();
  const intermediate = await x509.X509CertificateGenerator.create({
    serialNumber: '02',
    subject: 'CN=Hummlist Test Apple WWDR',
    issuer: root.subject,
    notBefore: new Date(now - 365 * day),
    notAfter: new Date(now + 365 * day),
    signingAlgorithm: ec,
    publicKey: midKeys.publicKey,
    signingKey: rootKeys.privateKey,
    extensions: [
      new x509.BasicConstraintsExtension(true, 0, true),
      ...(options.intermediateOid === false
        ? []
        : [new x509.Extension(intermediateOid, false, asnNull)]),
    ],
  });
  const leafKeys = await keys();
  const leaf = await x509.X509CertificateGenerator.create({
    serialNumber: '03',
    subject: 'CN=Hummlist Test StoreKit Signing',
    issuer: intermediate.subject,
    notBefore: options.leafNotBefore ?? new Date(now - 30 * day),
    notAfter: options.leafNotAfter ?? new Date(now + 30 * day),
    signingAlgorithm: ec,
    publicKey: leafKeys.publicKey,
    signingKey: midKeys.privateKey,
    extensions: options.leafOid === false ? [] : [new x509.Extension(leafOid, false, asnNull)],
  });
  const x5c = [leaf, intermediate, root].map((c) => c.toString('base64'));
  return {
    root,
    x5c,
    leafKeyPem: await exportPKCS8(leafKeys.privateKey),
    trust: (at = new Date()) => ({ anchors: [root], bundleId: appId, now: () => at }),
    sign: (payload, chain = x5c) =>
      new CompactSign(new TextEncoder().encode(JSON.stringify(payload)))
        .setProtectedHeader({ alg: 'ES256', x5c: chain })
        .sign(leafKeys.privateKey),
  };
}

/** A sandbox purchase of Hummlist Lifetime in Germany, shaped like Apple's decoded payload. */
export function sampleTransaction(overrides: Partial<AppleTransaction> = {}): AppleTransaction {
  const now = Date.now();
  return {
    transactionId: '2000000812345678',
    originalTransactionId: '2000000812345678',
    bundleId: appId,
    productId: lifetimeProductId,
    purchaseDate: now - 60_000,
    signedDate: now - 1_000,
    environment: 'Sandbox',
    type: 'Non-Consumable',
    storefront: 'DEU',
    price: 9990,
    currency: 'EUR',
    ...overrides,
  };
}
