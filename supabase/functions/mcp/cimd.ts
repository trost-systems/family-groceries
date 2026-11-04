// OAuth Client ID Metadata Documents (draft-ietf-oauth-client-id-metadata-document-00, MCP
// 2026-07-28 client registration): a client_id that is an HTTPS URL of the client's own metadata.
// Supabase Auth cannot resolve such a client_id, so each document URL is mapped to one Supabase
// OAuth client (public, PKCE) that carries the document's name and redirect URIs.

/** Why a client_id URL or its document was refused; the message is safe to show the user. */
export class CimdError extends Error {
  constructor(
    readonly error: 'invalid_client' | 'invalid_request' | 'temporarily_unavailable',
    message: string,
  ) {
    super(message);
  }
}

/** A client_id that names a metadata document: https, a path, nothing ambiguous. */
export type ClientIdUrl = string & { readonly __brand: 'ClientIdUrl' };

/**
 * What a client_id URL's document says that Supabase's client needs. `clientUri` is the origin
 * of the document URL, the one host the fetch proved, not the document's own `client_uri`: the
 * consent page shows it under the name, so a document naming itself "Claude" from another host
 * still shows that host (draft section 6.4).
 */
export type ClientMetadata = {
  clientId: ClientIdUrl;
  clientName: string;
  redirectUris: string[];
  clientUri: string;
};

/** The URL itself when `raw` is a client_id URL (draft section 3), else null. */
export function parseClientIdUrl(raw: string | null): ClientIdUrl | null {
  if (!raw?.startsWith('https://')) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const segments = url.pathname.split('/');
  if (
    url.href !== raw || url.pathname === '/' || url.hash || url.username || url.password ||
    segments.includes('.') || segments.includes('..') || raw.includes('#')
  ) return null;
  return raw as ClientIdUrl;
}

const MAX_NAME = 200;

/** Validates a fetched document against the URL it came from (draft section 4.1). */
export function parseClientMetadata(url: ClientIdUrl, doc: unknown): ClientMetadata {
  const invalid = (why: string) => new CimdError('invalid_client', `client metadata: ${why}`);
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    throw invalid('not a JSON object');
  }
  const d = doc as Record<string, unknown>;
  if (d.client_id !== url) throw invalid('client_id does not equal the document URL');
  if (typeof d.client_name !== 'string' || !d.client_name.trim()) {
    throw invalid('client_name missing');
  }
  if (d.client_name.length > MAX_NAME) throw invalid('client_name too long');
  if (
    !Array.isArray(d.redirect_uris) || d.redirect_uris.length === 0 ||
    !d.redirect_uris.every(isRedirectUri)
  ) throw invalid('redirect_uris must be absolute URIs without a fragment');
  if ('client_secret' in d || 'client_secret_expires_at' in d) {
    throw invalid('a metadata document must not carry a client secret');
  }
  const method = d.token_endpoint_auth_method ?? 'none';
  if (method !== 'none') {
    throw invalid(`token_endpoint_auth_method ${String(method)} unsupported, only none (PKCE)`);
  }
  if (Array.isArray(d.grant_types) && !d.grant_types.includes('authorization_code')) {
    throw invalid('grant_types without authorization_code');
  }
  if (Array.isArray(d.response_types) && !d.response_types.includes('code')) {
    throw invalid('response_types without code');
  }
  return {
    clientId: url,
    clientName: d.client_name.trim(),
    redirectUris: d.redirect_uris as string[],
    clientUri: new URL(url).origin,
  };
}

const LOOPBACK = new Set(['127.0.0.1', '[::1]', 'localhost']);

/**
 * An absolute URI without a fragment a code may go to: https, http on the loopback interface
 * (native apps, RFC 8252 7.3), or a private-use scheme with a dot (RFC 8252 7.1). Never
 * javascript:, data: or the like.
 */
function isRedirectUri(value: unknown): value is string {
  if (typeof value !== 'string' || value.includes('#')) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const scheme = url.protocol.slice(0, -1);
  return scheme === 'https' || (scheme === 'http' && LOOPBACK.has(url.hostname)) ||
    (scheme.includes('.') && /^[a-z][a-z0-9+.-]*$/.test(scheme));
}

/** Document size limit; the draft recommends 5 KB. */
export const MAX_DOCUMENT_BYTES = 5 * 1024;
const FETCH_TIMEOUT_MS = 5_000;
const RESOLVE_TIMEOUT_MS = 3_000;

export type FetchDeps = {
  fetch: typeof fetch;
  /** The host's addresses (A and AAAA); an empty list means it does not resolve. */
  resolve: (host: string) => Promise<string[]>;
};

/**
 * Fetches and validates the document behind a client_id URL. Server-side request forgery: only
 * hosts whose every address is public, no redirects, a size limit and a timeout. The body never
 * reaches the caller, only the validated fields.
 */
export async function fetchClientMetadata(
  url: ClientIdUrl,
  deps: FetchDeps,
): Promise<{ metadata: ClientMetadata; maxAgeSeconds: number | null }> {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
  const addresses = isIpLiteral(host) ? [host] : await Promise.race([
    deps.resolve(host),
    new Promise<string[]>((done) => setTimeout(() => done([]), RESOLVE_TIMEOUT_MS)),
  ]).catch(() => []);
  if (addresses.length === 0) {
    throw new CimdError('invalid_client', `client metadata: ${host} does not resolve`);
  }
  if (!addresses.every(isPublicAddress)) {
    throw new CimdError('invalid_client', `client metadata: ${host} is not a public host`);
  }
  // One message for every way the fetch fails, so the answer tells nothing about the host.
  const unreachable = () =>
    new CimdError('invalid_client', 'client metadata: the document could not be fetched');
  let res: Response;
  try {
    res = await deps.fetch(url, {
      headers: { accept: 'application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    throw unreachable();
  }
  if (res.status !== 200) {
    await res.body?.cancel();
    throw unreachable();
  }
  const text = await readLimited(res, MAX_DOCUMENT_BYTES);
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new CimdError('invalid_client', 'client metadata: not valid JSON');
  }
  return {
    metadata: parseClientMetadata(url, doc),
    maxAgeSeconds: maxAge(res.headers.get('cache-control')),
  };
}

async function readLimited(res: Response, limit: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new CimdError('invalid_client', `client metadata: larger than ${limit} bytes`);
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(concat(chunks));
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

/** max-age from Cache-Control; null when absent, 0 for no-store/no-cache. */
export function maxAge(cacheControl: string | null): number | null {
  if (!cacheControl) return null;
  const directives = cacheControl.toLowerCase().split(',').map((d) => d.trim());
  if (directives.some((d) => d === 'no-store' || d === 'no-cache')) return 0;
  const age = directives.find((d) => d.startsWith('max-age='));
  const seconds = age ? Number(age.slice(8)) : NaN;
  return Number.isInteger(seconds) && seconds >= 0 ? seconds : null;
}

/** How long a fetched document stays valid: its max-age, bounded to 5 minutes .. 1 day. */
export function freshForSeconds(maxAgeSeconds: number | null): number {
  return Math.min(Math.max(maxAgeSeconds ?? 3600, 300), 86_400);
}

function isIpLiteral(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':');
}

/** False for loopback, private, link-local, CGNAT, multicast, reserved and mapped addresses. */
export function isPublicAddress(address: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(address)) {
    const [a, b] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)));
  }
  const ip = address.toLowerCase();
  if (ip === '::' || ip === '::1') return false;
  const mapped = ip.match(/^::ffff:(\d{1,3}(\.\d{1,3}){3})$/);
  if (mapped) return isPublicAddress(mapped[1]);
  if (ip.startsWith('::ffff:') || ip.startsWith('64:ff9b:')) return false;
  const [first, second] = ip.split(':').map((part) => parseInt(part || '0', 16));
  // Global unicast only, without documentation (2001:db8::/32), Teredo (2001::/32) and 6to4
  // (2002::/16), which embed IPv4 addresses.
  return (first & 0xe000) === 0x2000 && !(first === 0x2001 && (second === 0 || second === 0xdb8)) &&
    first !== 0x2002;
}
