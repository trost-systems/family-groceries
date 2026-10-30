import { assertEquals, assertMatch, assertStringIncludes } from '@std/assert';
import { type Auth, AuthError } from '../_shared/auth.ts';
import { type Deps, handle, publicOriginFromEnv } from './handler.ts';

const RESOURCE = 'https://ref.supabase.co/functions/v1/mcp';
const METADATA = `${RESOURCE}/.well-known/oauth-protected-resource`;
const ISSUER = 'https://ref.supabase.co/auth/v1';
const PUBLIC = 'https://mcp.hummlist.com';
const PUBLIC_METADATA = `${PUBLIC}/.well-known/oauth-protected-resource`;
const USER = { userId: 'u', householdId: 'h' };

function deps(auth: Auth | AuthError): Deps {
  return {
    endpoints: () =>
      Promise.resolve({
        resource: RESOURCE,
        metadata: METADATA,
        authorizationServer: ISSUER,
      }),
    publicOrigin: () => PUBLIC,
    authenticate: () => auth instanceof AuthError ? Promise.reject(auth) : Promise.resolve(auth),
    serve: (_req, a) => Promise.resolve(Response.json({ served: a.via })),
    allowedOriginHosts: () => ['inspector.example'],
  };
}

type Via = { headers?: Record<string, string>; query?: string };

const post = (headers: Record<string, string> = {}, query = '') =>
  new Request(`http://edge/mcp${query}`, { method: 'POST', headers, body: '{}' });

const prm = ({ headers = {}, query = '' }: Via) =>
  new Request(`http://edge/mcp/.well-known/oauth-protected-resource${query}`, { headers });

/** What mcp-proxy/vercel.json sends, by either signal. */
const PROXIED: Via[] = [
  { query: '?via=mcp-hummlist' },
  { headers: { 'x-forwarded-host': 'mcp.hummlist.com' } },
  { headers: { 'x-forwarded-host': 'MCP.Hummlist.com:443' } },
  { headers: { 'x-forwarded-host': 'mcp.hummlist.com, edge.internal' } },
  { headers: { 'x-forwarded-host': 'ref.supabase.co' }, query: '?via=mcp-hummlist' },
];

/** The resource and metadata URL a client is told to use: from the PRM and from a 401. */
async function advertised(via: Via, d = deps(new AuthError('missing_token', 'fehlt'))) {
  const body = await (await handle(prm(via), d)).json();
  const challenge = (await handle(post(via.headers, via.query), d)).headers.get(
    'www-authenticate',
  )!;
  return {
    resource: body.resource,
    authorizationServers: body.authorization_servers,
    metadata: challenge.match(/resource_metadata="([^"]*)"/)![1],
  };
}

Deno.test('serves Protected Resource Metadata at the well-known suffix', async () => {
  for (
    const path of ['/mcp/.well-known/oauth-protected-resource', '/mcp/oauth-protected-resource']
  ) {
    const res = await handle(new Request(`http://edge${path}`), deps({ ...USER, via: 'pat' }));
    assertEquals(res.status, 200);
    assertEquals(res.headers.get('access-control-allow-origin'), '*');
    const body = await res.json();
    assertEquals(body.resource, RESOURCE);
    assertEquals(body.authorization_servers, [ISSUER]);
  }
});

Deno.test('a request without a token gets 401 pointing at the metadata', async () => {
  const res = await handle(post(), deps(new AuthError('missing_token', 'fehlt')));
  assertEquals(res.status, 401);
  assertEquals(
    res.headers.get('www-authenticate'),
    `Bearer resource_metadata="${METADATA}", scope="openid email"`,
  );
  assertEquals(
    res.headers.get('access-control-expose-headers'),
    'www-authenticate, mcp-session-id',
  );
});

Deno.test('an invalid token gets 401 with error="invalid_token"', async () => {
  const res = await handle(post(), deps(new AuthError('invalid_token', 'abgelaufen')));
  assertEquals(res.status, 401);
  assertMatch(res.headers.get('www-authenticate')!, /error="invalid_token"/);
});

Deno.test('the challenge stays RFC 6750 ASCII when the message is German', async () => {
  // The hosted gateway drops a WWW-Authenticate header with bytes outside printable ASCII.
  const res = await handle(
    post(),
    deps(new AuthError('invalid_token', 'Token ungültig: "kaputt" \\ Größe')),
  );
  const header = res.headers.get('www-authenticate')!;
  assertMatch(header, /^[\x20-\x7e]+$/);
  assertStringIncludes(header, `error_description="Token ungueltig: 'kaputt'  Groesse"`);
});

Deno.test('a user without a household gets 403', async () => {
  const res = await handle(post(), deps(new AuthError('no_household', 'kein Haushalt')));
  assertEquals(res.status, 403);
});

Deno.test('app session tokens are not accepted as MCP credentials', async () => {
  const res = await handle(post(), deps({ ...USER, via: 'session' }));
  assertEquals(res.status, 401);
  assertMatch(res.headers.get('www-authenticate')!, /error="invalid_token"/);
});

Deno.test('OAuth and PAT credentials reach the MCP server', async () => {
  for (
    const auth of [{ ...USER, via: 'oauth', clientId: 'c', sessionId: 's' }, {
      ...USER,
      via: 'pat',
    }] as const
  ) {
    const res = await handle(post(), deps(auth));
    assertEquals(await res.json(), { served: auth.via });
  }
});

Deno.test('browser origins outside the allowlist get 403; listed and absent origins pass', async () => {
  const pat = deps({ ...USER, via: 'pat' });
  assertEquals((await handle(post({ origin: 'https://evil.example' }), pat)).status, 403);
  for (
    const origin of [
      'https://inspector.example',
      'http://localhost:6274',
      'https://ref.supabase.co',
    ]
  ) {
    assertEquals((await handle(post({ origin }), pat)).status, 200, origin);
  }
  assertEquals((await handle(post(), pat)).status, 200);
});

Deno.test('a direct request advertises the project URL', async () => {
  for (const via of [{}, { headers: { 'x-forwarded-host': 'ref.supabase.co' } }]) {
    assertEquals(await advertised(via), {
      resource: RESOURCE,
      authorizationServers: [ISSUER],
      metadata: METADATA,
    });
  }
});

Deno.test('a request through the proxy advertises the public URL, same issuer', async () => {
  for (const via of PROXIED) {
    assertEquals(await advertised(via), {
      resource: PUBLIC,
      authorizationServers: [ISSUER],
      metadata: PUBLIC_METADATA,
    }, JSON.stringify(via));
  }
});

Deno.test('a rejected token through the proxy also points at the public metadata', async () => {
  for (const { headers, query } of PROXIED) {
    for (
      const auth of [new AuthError('invalid_token', 'x'), { ...USER, via: 'session' } as const]
    ) {
      const res = await handle(post(headers, query), deps(auth));
      assertEquals(res.status, 401);
      assertStringIncludes(
        res.headers.get('www-authenticate')!,
        `resource_metadata="${PUBLIC_METADATA}"`,
      );
    }
    const forbidden = await handle(
      post(headers, query),
      deps(new AuthError('no_household', 'kein Haushalt')),
    );
    assertEquals(forbidden.status, 403);
    assertStringIncludes(forbidden.headers.get('www-authenticate')!, PUBLIC_METADATA);
  }
});

Deno.test('any other forwarded host or marker gets the project URL', async () => {
  for (
    const via of [
      { headers: { 'x-forwarded-host': 'evil.example' } },
      { headers: { 'x-forwarded-host': 'mcp.hummlist.com.evil.example' } },
      { headers: { 'x-forwarded-host': 'evil.example, mcp.hummlist.com' } },
      { query: '?via=evil.example' },
      { query: '?mcp-hummlist' },
    ]
  ) {
    assertEquals((await advertised(via)).resource, RESOURCE, JSON.stringify(via));
  }
});

Deno.test('MCP_PUBLIC_URL replaces the public origin', async () => {
  try {
    Deno.env.delete('MCP_PUBLIC_URL');
    assertEquals(publicOriginFromEnv(), PUBLIC);
    Deno.env.set('MCP_PUBLIC_URL', 'https://mcp.example.test/');
    const d = { ...deps(new AuthError('missing_token', 'x')), publicOrigin: publicOriginFromEnv };
    const expected = {
      resource: 'https://mcp.example.test',
      authorizationServers: [ISSUER],
      metadata: 'https://mcp.example.test/.well-known/oauth-protected-resource',
    };
    assertEquals(
      await advertised({ headers: { 'x-forwarded-host': 'mcp.example.test' } }, d),
      expected,
    );
    assertEquals(await advertised({ query: '?via=mcp-hummlist' }, d), expected);
    assertEquals(
      (await advertised({ headers: { 'x-forwarded-host': 'mcp.hummlist.com' } }, d)).resource,
      RESOURCE,
    );
  } finally {
    Deno.env.delete('MCP_PUBLIC_URL');
  }
});

Deno.test('the public origin is an allowed browser origin', async () => {
  const pat = deps({ ...USER, via: 'pat' });
  assertEquals((await handle(post({ origin: PUBLIC }), pat)).status, 200);
  for (const { headers, query } of [{}, ...PROXIED]) {
    assertEquals(
      (await handle(post({ ...headers, origin: 'https://evil.example' }, query), pat)).status,
      403,
    );
  }
});

Deno.test('CORS preflight answers without auth', async () => {
  const res = await handle(
    new Request('http://edge/mcp', { method: 'OPTIONS' }),
    deps(new AuthError('missing_token', 'x')),
  );
  assertEquals(res.status, 204);
  assertMatch(res.headers.get('access-control-allow-headers')!, /mcp-protocol-version/);
});
