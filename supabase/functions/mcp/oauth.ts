// The authorization server 2026-era clients are pointed at (job 94): Supabase Auth behind a thin
// front at <resource>/oauth that adds Client ID Metadata Documents. Supabase does everything else
// (consent, codes, tokens, dynamic registration); the front only maps a client_id URL to the
// Supabase client registered for it (cimd_clients.ts). Other client ids pass through unchanged.
import { CimdError, type ClientIdUrl, parseClientIdUrl } from './cimd.ts';
import type { MappedClient } from './cimd_clients.ts';

export type OAuthDeps = {
  /** Supabase Auth's Authorization Server Metadata (RFC 8414). */
  authServerMetadata: () => Promise<Record<string, unknown>>;
  /** For an authorization request: fetches the document when stale, registers its client. */
  resolveClient: (url: ClientIdUrl) => Promise<MappedClient>;
  /** For a token request: the client a document URL already maps to. */
  lookupClient: (url: ClientIdUrl) => Promise<string | null>;
  /** POSTs a token request to Supabase Auth's token endpoint. */
  forwardToken: (body: URLSearchParams, authorization: string | null) => Promise<Response>;
  /**
   * Whether the caller's address may send another token request this hour. Supabase sees every
   * forwarded request from the function's address, so one caller must not use up its limit.
   */
  allowTokenRequest: (req: Request) => Promise<boolean>;
};

/** The front's paths below the function root, by what they serve. */
export const OAUTH_PATHS = {
  metadata: [
    '/oauth/.well-known/oauth-authorization-server',
    '/oauth/.well-known/openid-configuration',
    // RFC 8414 and OIDC put the well-known part before the issuer path; through the proxy the
    // issuer is https://mcp.hummlist.com/oauth, so these arrive at the function too.
    '/.well-known/oauth-authorization-server/oauth',
    '/.well-known/openid-configuration/oauth',
  ],
  authorize: '/oauth/authorize',
  token: '/oauth/token',
} as const;

/** Query parameters the proxy adds (mcp-proxy/vercel.json); never forwarded. */
const PROXY_PARAMS = ['via'];

/** The front's answer for `subpath`, or null when it is not one of its paths. */
export async function oauthRoute(
  req: Request,
  subpath: string,
  issuer: string,
  deps: OAuthDeps,
): Promise<Response | null> {
  if ((OAUTH_PATHS.metadata as readonly string[]).includes(subpath)) {
    if (req.method !== 'GET') return new Response(null, { status: 405 });
    return Response.json(await metadata(issuer, deps));
  }
  if (subpath === OAUTH_PATHS.authorize) {
    if (req.method !== 'GET') return new Response(null, { status: 405 });
    return await authorize(new URL(req.url), deps);
  }
  if (subpath === OAUTH_PATHS.token) {
    if (req.method !== 'POST') return new Response(null, { status: 405 });
    return await token(req, deps);
  }
  return null;
}

/** Supabase's metadata with this front as issuer, its two endpoints and CIMD on. */
async function metadata(issuer: string, deps: OAuthDeps): Promise<Record<string, unknown>> {
  return {
    ...await deps.authServerMetadata(),
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    // OAuth 2.1 and MCP require S256; the front holds document clients to it.
    code_challenge_methods_supported: ['S256'],
    client_id_metadata_document_supported: true,
  };
}

async function authorize(url: URL, deps: OAuthDeps): Promise<Response> {
  const params = new URLSearchParams(url.search);
  for (const p of PROXY_PARAMS) params.delete(p);
  const clientId = params.get('client_id');
  const documentUrl = parseClientIdUrl(clientId);
  if (!documentUrl && /^https?:/i.test(clientId ?? '')) {
    return oauthError(400, 'invalid_client', 'client_id URL: https with a path, no fragment');
  }
  if (documentUrl) {
    let client: MappedClient;
    try {
      client = await deps.resolveClient(documentUrl);
    } catch (e) {
      if (e instanceof CimdError) {
        return oauthError(e.error === 'temporarily_unavailable' ? 503 : 400, e.error, e.message);
      }
      throw e;
    }
    // RFC 6749 4.1.2.1: with a bad redirect_uri the error is shown, never redirected.
    const redirect = params.get('redirect_uri');
    if (!redirect || !client.redirectUris.includes(redirect)) {
      return oauthError(400, 'invalid_request', 'redirect_uri is not in the client metadata');
    }
    if (!params.get('code_challenge') || params.get('code_challenge_method') !== 'S256') {
      return oauthError(400, 'invalid_request', 'PKCE with code_challenge_method S256 is required');
    }
    params.set('client_id', client.authClientId);
  }
  const upstream = (await deps.authServerMetadata()).authorization_endpoint;
  if (typeof upstream !== 'string') throw new Error('auth server metadata: no authorization');
  return new Response(null, {
    status: 302,
    headers: { location: `${upstream}?${params}`, 'cache-control': 'no-store' },
  });
}

async function token(req: Request, deps: OAuthDeps): Promise<Response> {
  if (!await deps.allowTokenRequest(req)) {
    return oauthError(429, 'temporarily_unavailable', 'too many token requests, try again later');
  }
  const body = new URLSearchParams(await req.text());
  const authorization = req.headers.get('authorization');
  const documentUrl = parseClientIdUrl(body.get('client_id'));
  if (documentUrl) {
    if (authorization) {
      return oauthError(400, 'invalid_client', 'a metadata document client authenticates by PKCE');
    }
    const authClientId = await deps.lookupClient(documentUrl);
    if (!authClientId) return oauthError(401, 'invalid_client', 'unknown client_id');
    body.set('client_id', authClientId);
  }
  const res = await deps.forwardToken(body, authorization);
  return new Response(res.body, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-store',
    },
  });
}

function oauthError(status: number, error: string, description: string): Response {
  return Response.json({ error, error_description: description }, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}
