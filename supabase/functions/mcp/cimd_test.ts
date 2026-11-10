import { assertEquals, assertExists, assertRejects, assertThrows } from '@std/assert';
import {
  CimdError,
  type ClientIdUrl,
  fetchClientMetadata,
  freshForSeconds,
  isPublicAddress,
  MAX_DOCUMENT_BYTES,
  maxAge,
  parseClientIdUrl,
  parseClientMetadata,
} from './cimd.ts';
import claude from './testdata/cimd-claude.json' with { type: 'json' };
import mcpjam from './testdata/cimd-mcpjam.json' with { type: 'json' };
import vscode from './testdata/cimd-vscode.json' with { type: 'json' };

const URL_ = 'https://client.example/oauth/metadata.json' as ClientIdUrl;
const DOC = {
  'client_id': URL_,
  'client_name': 'Example MCP Client',
  'client_uri': 'https://client.example',
  'redirect_uris': ['http://127.0.0.1:3000/callback', 'http://localhost:3000/callback'],
  'grant_types': ['authorization_code'],
  'response_types': ['code'],
  'token_endpoint_auth_method': 'none',
};

Deno.test('client_id URLs: https with a path, nothing ambiguous', () => {
  assertEquals(parseClientIdUrl(URL_), URL_);
  assertEquals(parseClientIdUrl('https://client.example/m?v=1'), 'https://client.example/m?v=1');
  for (
    const raw of [
      null,
      '',
      '4f7c2c4e-0000-4000-8000-000000000000',
      'http://client.example/metadata.json',
      'https://client.example',
      'https://client.example/',
      'https://client.example/a#b',
      'https://user:pw@client.example/a',
      'https://client.example/a/../b',
      'https://client.example/./b',
      'https://CLIENT.example/a',
      'https://client.example:443/a',
      'https:// client.example/a',
    ]
  ) {
    assertEquals(parseClientIdUrl(raw), null, String(raw));
  }
});

Deno.test('a valid document gives name, redirect URIs and https client_uri', () => {
  assertEquals(parseClientMetadata(URL_, DOC), {
    clientId: URL_,
    clientName: 'Example MCP Client',
    redirectUris: DOC.redirect_uris,
    clientUri: 'https://client.example',
  });
  const minimal = { 'client_id': URL_, 'client_name': ' X ', 'redirect_uris': ['app.example:/cb'] };
  assertEquals(parseClientMetadata(URL_, minimal), {
    clientId: URL_,
    clientName: 'X',
    redirectUris: ['app.example:/cb'],
    clientUri: 'https://client.example',
  });
});

Deno.test('the consent page gets the host the document came from, whatever it claims', () => {
  const impostor = 'https://evil.example/c.json' as ClientIdUrl;
  const claimed = parseClientMetadata(impostor, {
    client_id: impostor,
    client_name: 'Claude',
    client_uri: 'https://claude.ai',
    redirect_uris: ['https://evil.example/cb'],
  });
  assertEquals(claimed.clientUri, 'https://evil.example');
});

Deno.test('redirect URIs: https, loopback http, private-use schemes only', () => {
  for (
    const uri of [
      'https://client.example/cb',
      'http://127.0.0.1:3000/cb',
      'http://localhost/cb',
      'http://[::1]:8976/',
      'com.example.app:/oauth',
    ]
  ) {
    assertEquals(parseClientMetadata(URL_, { ...DOC, redirect_uris: [uri] }).redirectUris, [uri]);
  }
  for (
    const uri of [
      'javascript:alert(1)//x',
      'data:text/html,hi',
      'http://client.example/cb',
      'http://10.0.0.1/cb',
      'myapp:/cb',
      'ftp://client.example/cb',
    ]
  ) {
    assertThrows(() => parseClientMetadata(URL_, { ...DOC, redirect_uris: [uri] }), CimdError);
  }
});

Deno.test('a broken document is refused with invalid_client and the reason', () => {
  const cases: [unknown, RegExp][] = [
    [null, /not a JSON object/],
    [[DOC], /not a JSON object/],
    [{ ...DOC, client_id: 'https://client.example/other.json' }, /client_id does not equal/],
    [{ ...DOC, client_id: undefined }, /client_id does not equal/],
    [{ ...DOC, client_name: '' }, /client_name missing/],
    [{ ...DOC, client_name: 7 }, /client_name missing/],
    [{ ...DOC, client_name: 'x'.repeat(201) }, /client_name too long/],
    [{ ...DOC, redirect_uris: [] }, /redirect_uris/],
    [{ ...DOC, redirect_uris: 'http://127.0.0.1/cb' }, /redirect_uris/],
    [{ ...DOC, redirect_uris: ['/relative'] }, /redirect_uris/],
    [{ ...DOC, redirect_uris: ['https://client.example/cb#x'] }, /redirect_uris/],
    [{ ...DOC, client_secret: 's' }, /client secret/],
    [{ ...DOC, token_endpoint_auth_method: 'private_key_jwt' }, /private_key_jwt unsupported/],
    [{ ...DOC, grant_types: ['client_credentials'] }, /authorization_code/],
    [{ ...DOC, response_types: ['token'] }, /without code/],
  ];
  for (const [doc, reason] of cases) {
    const e = assertThrows(() => parseClientMetadata(URL_, doc), CimdError, undefined);
    assertEquals(e.error, 'invalid_client');
    if (!reason.test(e.message)) throw new Error(`${JSON.stringify(doc)}: ${e.message}`);
  }
});

Deno.test('public addresses only', () => {
  for (
    const ip of [
      '93.184.216.34',
      '8.8.8.8',
      '2606:4700::1111',
      '2a00:1450:4001::200e',
      '2001:4860::8888',
    ]
  ) {
    assertEquals(isPublicAddress(ip), true, ip);
  }
  for (
    const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '224.0.0.1',
      '255.255.255.255',
      '198.18.0.1',
      '::1',
      '::',
      'fc00::1',
      'fd12::1',
      'fe80::1',
      '::ffff:127.0.0.1',
      '::ffff:7f00:1',
      '64:ff9b::7f00:1',
      '2001:db8::1',
      '2001:0:4136:e378::1',
      '2002:7f00:1::1',
      'ff02::1',
    ]
  ) {
    assertEquals(isPublicAddress(ip), false, ip);
  }
});

Deno.test('Cache-Control bounds how long a document stays fresh', () => {
  assertEquals(maxAge(null), null);
  assertEquals(maxAge('public, max-age=600'), 600);
  assertEquals(maxAge('no-store'), 0);
  assertEquals(maxAge('max-age=abc'), null);
  assertEquals(freshForSeconds(null), 3600);
  assertEquals(freshForSeconds(0), 300);
  assertEquals(freshForSeconds(600), 600);
  assertEquals(freshForSeconds(10_000_000), 86_400);
});

type Served = { status?: number; body?: string; headers?: Record<string, string> };

function host(addresses: string[], served: Served = {}) {
  const asked: RequestInit[] = [];
  return {
    asked,
    deps: {
      resolve: () => Promise.resolve(addresses),
      fetch: ((_: string, init: RequestInit) => {
        asked.push(init);
        return Promise.resolve(
          new Response(served.body ?? JSON.stringify(DOC), {
            status: served.status ?? 200,
            ...(served.headers ? { headers: served.headers } : {}),
          }),
        );
      }) as typeof fetch,
    },
  };
}

Deno.test('fetches the document without following redirects, with its max-age', async () => {
  const h = host(['93.184.216.34'], { headers: { 'cache-control': 'max-age=900' } });
  const { metadata, maxAgeSeconds } = await fetchClientMetadata(URL_, h.deps);
  assertEquals(metadata.clientName, 'Example MCP Client');
  assertEquals(maxAgeSeconds, 900);
  assertEquals(h.asked[0]?.redirect, 'manual');
});

Deno.test('refuses private hosts before fetching, and broken answers', async () => {
  const cases: [string[], Served, RegExp, ClientIdUrl?][] = [
    [['10.0.0.5'], {}, /not a public host/],
    [['93.184.216.34', '127.0.0.1'], {}, /not a public host/],
    [[], {}, /does not resolve/],
    [[], {}, /not a public host/, 'https://169.254.169.254/latest' as ClientIdUrl],
    [[], {}, /not a public host/, 'https://[::1]/m.json' as ClientIdUrl],
    [
      ['93.184.216.34'],
      { status: 302, headers: { location: 'http://10.0.0.1/' } },
      /could not be fetched/,
    ],
    [['93.184.216.34'], { status: 404 }, /could not be fetched/],
    [['93.184.216.34'], { body: '{not json' }, /not valid JSON/],
    [['93.184.216.34'], { body: ' '.repeat(MAX_DOCUMENT_BYTES + 1) }, /larger than/],
    [['93.184.216.34'], { body: JSON.stringify({ ...DOC, client_id: 'x' }) }, /client_id/],
  ];
  for (const [addresses, served, reason, url] of cases) {
    const h = host(addresses, served);
    const e = await assertRejects(
      () => fetchClientMetadata(url ?? URL_, h.deps),
      CimdError,
    );
    if (!reason.test(e.message)) throw new Error(`${reason}: ${e.message}`);
    if (/public host|resolve/.test(reason.source)) assertEquals(h.asked.length, 0);
  }
});

Deno.test('real clients documents parse (Claude, VS Code, MCPJam, fetched 2026-11-04)', () => {
  for (
    const [doc, url, client, redirect] of <[unknown, string, string, string][]> [
      [
        claude,
        'https://claude.ai/oauth/mcp-oauth-client-metadata',
        'Claude',
        'https://claude.ai/api/mcp/auth_callback',
      ],
      [
        vscode,
        'https://vscode.dev/oauth/client-metadata.json',
        'Visual Studio Code',
        'http://127.0.0.1:33418/',
      ],
      [
        mcpjam,
        'https://www.mcpjam.com/.well-known/oauth/client-metadata.json',
        'MCPJam',
        'http://127.0.0.1:6274/oauth/callback',
      ],
    ]
  ) {
    const clientId = parseClientIdUrl(url);
    assertEquals(clientId, url);
    assertExists(clientId);
    const metadata = parseClientMetadata(clientId, doc);
    assertEquals(metadata.clientName, client);
    assertEquals(metadata.redirectUris.includes(redirect), true, url);
  }
});
