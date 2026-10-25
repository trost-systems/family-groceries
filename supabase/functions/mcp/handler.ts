// HTTP face of the MCP server: CORS, Protected Resource Metadata (RFC 9728), Origin checks,
// bearer authentication, then MCP over streamable HTTP for both protocol eras.
import {
  createMcpHandler,
  localhostAllowedOrigins,
  originValidationResponse,
} from '@modelcontextprotocol/server';
import { type Auth, authenticate, AuthError, discoverIssuer } from '../_shared/auth.ts';
import { buildServer } from './tools.ts';

const PRM_SUFFIXES = ['/.well-known/oauth-protected-resource', '/oauth-protected-resource'];

/** Scopes Supabase's OAuth server knows; it rejects any other. The tools need none of them. */
const SCOPES = ['openid', 'email'];

const cors: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers':
    'authorization, content-type, accept, mcp-protocol-version, mcp-method, mcp-name, ' +
    'mcp-session-id, last-event-id',
  'access-control-expose-headers': 'www-authenticate, mcp-session-id',
};

export type Endpoints = {
  /** The canonical MCP endpoint, e.g. https://<ref>.supabase.co/functions/v1/mcp. */
  resource: string;
  metadata: string;
  authorizationServer: string;
};

export type Deps = {
  endpoints: () => Promise<Endpoints>;
  authenticate: (req: Request) => Promise<Auth>;
  serve: (req: Request, auth: Auth) => Promise<Response>;
  allowedOriginHosts: () => string[];
};

export async function handle(req: Request, deps: Deps = defaultDeps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const endpoints = await deps.endpoints();
  const path = new URL(req.url).pathname;

  if (PRM_SUFFIXES.some((suffix) => path.endsWith(suffix))) {
    if (req.method !== 'GET') return withCors(new Response(null, { status: 405 }));
    return withCors(Response.json({
      resource: endpoints.resource,
      authorization_servers: [endpoints.authorizationServer],
      scopes_supported: SCOPES,
      bearer_methods_supported: ['header'],
      resource_name: 'Einkaufsliste (family-groceries)',
      resource_documentation:
        'https://github.com/trost-systems/family-groceries/blob/main/docs/MCP.md',
    }));
  }

  const rejected = originValidationResponse(req, [
    ...localhostAllowedOrigins(),
    new URL(endpoints.resource).hostname,
    ...deps.allowedOriginHosts(),
  ]);
  if (rejected) return withCors(rejected);

  let auth: Auth;
  try {
    auth = await deps.authenticate(req);
    if (auth.via === 'session') {
      throw new AuthError(
        'invalid_token',
        'App-Sitzungen gelten hier nicht: per OAuth verbinden oder einen Zugriffstoken nutzen.',
      );
    }
  } catch (e) {
    if (!(e instanceof AuthError)) throw e;
    return withCors(challenge(e, endpoints));
  }
  return withCors(await deps.serve(req, auth));
}

/** 401 (or 403 without a household) pointing the client at the Protected Resource Metadata. */
function challenge(error: AuthError, endpoints: Endpoints): Response {
  const params = [
    `resource_metadata="${endpoints.metadata}"`,
    `scope="${SCOPES.join(' ')}"`,
    ...(error.reason === 'missing_token' ? [] : [
      `error="${error.reason === 'no_household' ? 'insufficient_scope' : 'invalid_token'}"`,
      `error_description="${headerSafe(error.message)}"`,
    ]),
  ];
  return Response.json(
    { error: error.reason, error_description: error.message },
    { status: error.status, headers: { 'www-authenticate': `Bearer ${params.join(', ')}` } },
  );
}

const UMLAUTS: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  Ä: 'Ae',
  Ö: 'Oe',
  Ü: 'Ue',
  ß: 'ss',
  '"': "'",
};

/** RFC 6750 error_description charset; the hosted gateway drops a header with other bytes. */
function headerSafe(text: string): string {
  return text.replace(/[äöüÄÖÜß"]/g, (c) => UMLAUTS[c]).replace(
    /[^\x20-\x21\x23-\x5b\x5d-\x7e]/g,
    '',
  );
}

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [key, value] of Object.entries(cors)) headers.set(key, value);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

async function publicEndpoints(): Promise<Endpoints> {
  const { issuer } = await discoverIssuer();
  const resource = `${issuer.replace(/\/auth\/v1\/?$/, '')}/functions/v1/mcp`;
  return {
    resource,
    metadata: `${resource}${PRM_SUFFIXES[0]}`,
    authorizationServer: issuer,
  };
}

const defaultDeps: Deps = {
  endpoints: publicEndpoints,
  authenticate,
  serve: (req, auth) => createMcpHandler(() => buildServer(auth)).fetch(req),
  allowedOriginHosts: () =>
    (Deno.env.get('MCP_ALLOWED_ORIGIN_HOSTS') ?? '').split(',').map((h) => h.trim()).filter(
      Boolean,
    ),
};
