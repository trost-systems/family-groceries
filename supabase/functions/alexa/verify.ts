// Checks that a request really comes from Alexa for our skill, as Amazon requires of a skill
// hosted outside AWS Lambda (docs/ALEXA.md, "Request verification"):
//   1. SignatureCertChainUrl: https, host s3.amazonaws.com, path under /echo.api/, port 443;
//   2. the certificate chain at that URL: the leaf is valid now, names echo-api.amazon.com, and
//      chains to a pinned root (anchors.ts) through certificates that are valid now;
//   3. Signature-256: the leaf's RSA SHA-256 signature over the raw body;
//   4. request.timestamp at most 150 s away from now (an hour for skill events, see below);
//   5. the applicationId is our skill's.
// A failure answers 400 before anything is read from or written to the database.
import * as x509 from '@peculiar/x509';

x509.cryptoProvider.set(crypto);

export type Rejection =
  | 'missing_signature'
  | 'bad_cert_url'
  | 'cert_unavailable'
  | 'cert_expired'
  | 'cert_wrong_host'
  | 'cert_untrusted'
  | 'bad_signature'
  | 'bad_body'
  | 'stale_timestamp'
  | 'wrong_skill';

export class VerificationError extends Error {
  constructor(readonly reason: Rejection) {
    super(`alexa request refused: ${reason}`);
  }
}

export interface VerifyDeps {
  /** Roots a chain must end in. */
  anchors: readonly x509.X509Certificate[];
  /** The PEM chain behind a SignatureCertChainUrl that passed the URL rules. */
  fetchChain(url: URL): Promise<string>;
  /** Our skill ids; empty refuses every request. */
  skillIds: readonly string[];
  now(): Date;
}

/** The certificate Alexa signs with names this host (SAN). */
export const signerHost = 'echo-api.amazon.com';

/** Amazon: a request's timestamp may be at most 150 s off. */
export const maxSkewMs = 150_000;

/**
 * Skill events (AlexaSkillEvent.*) are delivered asynchronously and may be retried; the ASK SDK's
 * verifier allows them an hour.
 */
export const maxEventSkewMs = 3_600_000;

/** The Alexa request envelope, as far as this function reads it. */
export interface Envelope {
  version: string;
  session?: {
    new?: boolean;
    sessionId?: string;
    application?: { applicationId?: string };
    attributes?: Record<string, unknown>;
    user?: { userId?: string; accessToken?: string };
  };
  context?: {
    System?: {
      application?: { applicationId?: string };
      user?: { userId?: string; accessToken?: string };
    };
  };
  request: {
    type: string;
    requestId?: string;
    timestamp: string;
    locale?: string;
    intent?: {
      name: string;
      confirmationStatus?: string;
      slots?: Record<string, { name: string; value?: string }>;
    };
    dialogState?: string;
    reason?: string;
    body?: Record<string, unknown>;
  };
}

/** Rule 1. Normalized by URL first, so "/echo.api/../echo.api/x.pem" passes and "/x/../y" not. */
export function certUrlAllowed(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const ok = url.protocol === 'https:' &&
    url.hostname === 's3.amazonaws.com' &&
    (url.port === '' || url.port === '443') &&
    url.username === '' && url.password === '' &&
    url.pathname.startsWith('/echo.api/');
  return ok ? url : null;
}

const validAt = (cert: x509.X509Certificate, at: Date) =>
  cert.notBefore.getTime() <= at.getTime() && at.getTime() <= cert.notAfter.getTime();

const signedBy = (cert: x509.X509Certificate, issuer: x509.X509Certificate) =>
  cert.issuer === issuer.subject &&
  cert.verify({ publicKey: issuer.publicKey, signatureOnly: true }).catch(() => false);

const isCa = (cert: x509.X509Certificate) =>
  cert.getExtension(x509.BasicConstraintsExtension)?.ca === true;

/** Rule 2. Returns the leaf (the signer) of a chain that passes. */
export async function checkChain(
  pem: string,
  anchors: readonly x509.X509Certificate[],
  at: Date,
): Promise<x509.X509Certificate> {
  let chain: x509.X509Certificate[];
  try {
    chain = x509.PemConverter.decode(pem).map((der) => new x509.X509Certificate(der));
  } catch {
    throw new VerificationError('cert_unavailable');
  }
  const leaf = chain[0];
  if (!leaf) throw new VerificationError('cert_unavailable');
  if (!validAt(leaf, at)) throw new VerificationError('cert_expired');
  const names = leaf.getExtension(x509.SubjectAlternativeNameExtension)?.names.items ?? [];
  if (!names.some((n) => n.type === 'dns' && n.value.toLowerCase() === signerHost)) {
    throw new VerificationError('cert_wrong_host');
  }
  // Walk up: each certificate is signed by a pinned root, or by the next one in the chain,
  // which must be a CA valid now. The chain may go on past a pinned root (a cross-signature).
  for (let i = 0; i < chain.length && i < 6; i++) {
    const cert = chain[i];
    for (const anchor of anchors) {
      if (await signedBy(cert, anchor)) return leaf;
    }
    const next = chain[i + 1];
    if (!next || !isCa(next) || !validAt(next, at) || !await signedBy(cert, next)) break;
  }
  throw new VerificationError('cert_untrusted');
}

function base64Bytes(text: string): Uint8Array<ArrayBuffer> | null {
  try {
    return Uint8Array.from(atob(text.trim()), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** Rule 3. */
export async function signatureMatches(
  leaf: x509.X509Certificate,
  signature: string,
  body: Uint8Array<ArrayBuffer>,
): Promise<boolean> {
  const bytes = base64Bytes(signature);
  if (!bytes || bytes.length === 0) return false;
  try {
    const key = await leaf.publicKey.export(
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      ['verify'],
    );
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, bytes, body);
  } catch {
    return false;
  }
}

/** The skill id a request is for (context first; older requests only had it in the session). */
export const applicationIdOf = (envelope: Envelope) =>
  envelope.context?.System?.application?.applicationId ??
    envelope.session?.application?.applicationId;

/** Rules 4 and 5, on the parsed body. */
export function checkEnvelope(envelope: Envelope, deps: Pick<VerifyDeps, 'skillIds' | 'now'>) {
  const at = Date.parse(envelope.request.timestamp);
  const skew = envelope.request.type.startsWith('AlexaSkillEvent.') ? maxEventSkewMs : maxSkewMs;
  if (!Number.isFinite(at) || Math.abs(deps.now().getTime() - at) > skew) {
    throw new VerificationError('stale_timestamp');
  }
  const id = applicationIdOf(envelope);
  if (!id || !deps.skillIds.includes(id)) throw new VerificationError('wrong_skill');
}

function parseEnvelope(body: Uint8Array<ArrayBuffer>): Envelope {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(body)) as Envelope;
    if (
      typeof parsed?.request?.type !== 'string' || typeof parsed.request.timestamp !== 'string'
    ) {
      throw new Error('not an Alexa request');
    }
    return parsed;
  } catch {
    throw new VerificationError('bad_body');
  }
}

/** All five rules on a request; returns the parsed envelope or throws a VerificationError. */
export async function verifyRequest(
  headers: Headers,
  body: Uint8Array<ArrayBuffer>,
  deps: VerifyDeps,
): Promise<Envelope> {
  const certUrl = headers.get('signaturecertchainurl');
  const signature = headers.get('signature-256');
  if (!certUrl || !signature) throw new VerificationError('missing_signature');
  const url = certUrlAllowed(certUrl);
  if (!url) throw new VerificationError('bad_cert_url');
  let pem: string;
  try {
    pem = await deps.fetchChain(url);
  } catch {
    throw new VerificationError('cert_unavailable');
  }
  const leaf = await checkChain(pem, deps.anchors, deps.now());
  if (!await signatureMatches(leaf, signature, body)) {
    throw new VerificationError('bad_signature');
  }
  const envelope = parseEnvelope(body);
  checkEnvelope(envelope, deps);
  return envelope;
}

/**
 * Fetches a chain over https, at most 64 KiB, within 3 s, and keeps it for this worker's life
 * (Amazon rotates the URL, not the content behind it). A failed fetch is not kept.
 */
export function cachingFetcher(fetchImpl: typeof fetch = fetch): (url: URL) => Promise<string> {
  const cache = new Map<string, Promise<string>>();
  return (url) => {
    const key = url.toString();
    let hit = cache.get(key);
    if (!hit) {
      hit = (async () => {
        const res = await fetchImpl(url, { signal: AbortSignal.timeout(3_000) });
        if (!res.ok) throw new Error(`certificate chain: ${res.status}`);
        const text = await res.text();
        if (text.length > 65_536) throw new Error('certificate chain too large');
        return text;
      })();
      cache.set(key, hit);
      hit.catch(() => cache.delete(key));
    }
    return hit;
  };
}

export const parseCertificates = (pem: string) =>
  x509.PemConverter.decode(pem).map((der) => new x509.X509Certificate(der));
