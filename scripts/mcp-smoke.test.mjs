// scripts/mcp-smoke.sh against a fake MCP server (mcp-smoke-fixture.mjs): all checks pass on a
// server that behaves like ours, and each check fails on the one breakage it exists to catch.
// Run: npx -y -p node@22 node --test scripts/mcp-smoke.test.mjs
import process from 'node:process';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { startFake, token } from './mcp-smoke-fixture.mjs';

/** Stands for the fake's own client document URL in a test's env. */
const documentUrl = Symbol('documentUrl');

const script = fileURLToPath(new URL('mcp-smoke.sh', import.meta.url));

/**
 * Runs the smoke test against a fake with `breaks`; resolves with its exit code and output.
 * `env` may name the fake's client document as `{ documentUrl }` in MCP_SMOKE_CIMD_CLIENT.
 */
async function smoke(breaks = [], env = {}) {
  const fake = await startFake(new Set(breaks));
  const resolved = Object.fromEntries(Object.entries(env)
    .map(([key, value]) => [key, value === documentUrl ? fake.documentUrl : value]));
  try {
    return await new Promise((done) => {
      execFile('bash', [script, fake.url], {
        env: {
          ...process.env,
          MCP_SMOKE_TOKEN: token,
          MCP_PROTOCOL_VERSION: '',
          MCP_SMOKE_CIMD: '',
          MCP_SMOKE_CIMD_CLIENT: '',
          ...resolved,
        },
      }, (error, stdout, stderr) => done({ code: error ? error.code : 0, out: stdout + stderr }));
    });
  } finally {
    await fake.close();
  }
}

const failLines = (out) => out.split('\n').filter((line) => line.startsWith('FAIL '));

test('a server that behaves like ours passes every check', async () => {
  const { code, out } = await smoke();
  assert.equal(code, 0, out);
  assert.deepEqual(failLines(out), []);
  for (const check of ['no token: 401', 'bad token: 401 invalid_token', 'protected resource metadata: 200',
    'authorization server metadata:', 'hint-less discovery:', 'initialize: 200, protocol 2025-11-25, server fixture',
    'notifications/initialized: 202', 'tools/list: list_items,add_items']) {
    assert.match(out, new RegExp(`^PASS ${check.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm'));
  }
});

const breakages = [
  ['no-401', /^FAIL no token: want 401/m],
  ['metadata-host', /^FAIL no token: want 401 and WWW-Authenticate: Bearer resource_metadata="http:\/\/127\.0\.0\.1:\d+\//m],
  ['prm-resource', /^FAIL protected resource metadata: want 200 with resource/m],
  ['no-registration', /^FAIL authorization server metadata: want 200 with issuer .* authorization\/token\/registration/m],
  ['no-hintless', /^FAIL hint-less discovery:/m],
  // A 2025 client sent to the front would have to register again (DECISIONS, job 94).
  ['legacy-gets-front', /^FAIL hint-less discovery: want 200 with issuer "http:\/\/127\.0\.0\.1:\d+\/functions\/v1\/mcp\/oauth"/m],
  ['protocol-version', /^FAIL initialize: want 200 with protocol 2025-11-25/m],
  ['no-input-schema', /^FAIL tools\/list: tools without a name, a description or an object inputSchema: list_items$/m],
  ['no-add-items', /^FAIL tools\/list: no add_items among list_items$/m],
];

for (const [breakage, line] of breakages) {
  test(`a server with ${breakage} fails that check`, async () => {
    const { code, out } = await smoke([breakage]);
    assert.equal(code, 1, out);
    assert.match(out, line);
  });
}

const modern = { MCP_PROTOCOL_VERSION: '2026-07-28' };
const cimd = { ...modern, MCP_SMOKE_CIMD: '1', MCP_SMOKE_CIMD_CLIENT: documentUrl };

test('protocol 2026-07-28: every check passes without initialize, server/discover a hard check', async () => {
  const { code, out } = await smoke([], cimd);
  assert.equal(code, 0, out);
  assert.deepEqual(failLines(out), []);
  assert.doesNotMatch(out, /^SKIP /m);
  for (const check of [
    'no token: 401, resource_metadata on the same host (http://127.0.0.1:',
    'protected resource metadata: 200',
    'authorization server metadata:',
    'client ID metadata documents: http://127.0.0.1:',
    'rediscovery:',
    'client ID metadata documents: a non-https client_id URL gets 400 invalid_client, no redirect',
    'client ID metadata documents: http://127.0.0.1:',
    'server/discover: 200, protocol 2026-07-28, server fixture, tools capability',
    'tools/list: list_items,add_items',
    'tools/list: resultType complete, ttlMs 3600000, cacheScope private',
    'Mcp-Method: a header that disagrees with the body gets 400, HeaderMismatch (-32020)',
    'Mcp-Name: tools/call without it gets 400, HeaderMismatch (-32020)',
    'unknown version: UnsupportedProtocolVersion (-32022) naming 2026-07-28',
  ]) {
    assert.match(out, new RegExp(`^PASS ${check.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm'));
  }
  assert.match(out, /^PASS no token: 401, resource_metadata on the same host \(.*\/cimd\)$/m);
  assert.doesNotMatch(out, /initialize|hint-less/);
});

test('protocol 2026-07-28 without a token: server/discover gets the 401, the rest SKIP', async () => {
  const { code, out } = await smoke([], { ...modern, MCP_SMOKE_TOKEN: '' });
  assert.equal(code, 0, out);
  assert.match(out, /^PASS no token: 401/m);
  assert.match(out, /^SKIP server\/discover \+ tools\/list: MCP_SMOKE_TOKEN not set$/m);
});

const modernBreakages = [
  ['protocol-version', /^FAIL server\/discover: want 200 with protocol 2026-07-28/m],
  ['discover-no-server-info', /^FAIL server\/discover: want 200 with protocol 2026-07-28, a server name/m],
  ['no-ttl', /^FAIL tools\/list: want resultType "complete", a whole ttlMs >= 0 .*"ttlMs":null/m],
  ['bad-cache-scope', /^FAIL tools\/list: want .* cacheScope public or private; got .*"cacheScope":"shared"/m],
  ['no-method-check', /^FAIL Mcp-Method: want 400 with error -32020/m],
  ['no-name-check', /^FAIL Mcp-Name: want 400 with error -32020/m],
  ['no-version-error', /^FAIL unknown version: want error -32022/m],
  ['no-cimd-flag', /^FAIL client ID metadata documents: want client_id_metadata_document_supported: true/m],
  ['no-cimd-hint', /^FAIL client ID metadata documents: want client_id_metadata_document_supported: true .*\/auth\/v1;/m],
  ['no-rediscovery', /^FAIL rediscovery: want 200 with authorization_servers \["http:\/\/127\.0\.0\.1:\d+\/functions\/v1\/mcp\/oauth"\]/m],
  ['front-accepts-bad-client', /^FAIL client ID metadata documents: want 400 invalid_client without a redirect/m],
  ['front-keeps-url', /^FAIL client ID metadata documents: want a 302 to the authorization endpoint with the document's client/m],
  ['no-registration', /^FAIL authorization server metadata: want 200 with issuer .*mcp\/oauth.* authorization\/token\/registration/m],
];

for (const [breakage, line] of modernBreakages) {
  test(`protocol 2026-07-28: a server with ${breakage} fails that check`, async () => {
    const { code, out } = await smoke([breakage], cimd);
    assert.equal(code, 1, out);
    assert.match(out, line);
  });
}

test('MCP_SMOKE_CIMD needs protocol 2026-07-28', async () => {
  const { code, out } = await smoke([], { MCP_SMOKE_CIMD: '1' });
  assert.equal(code, 2, out);
  assert.match(out, /MCP_SMOKE_CIMD needs MCP_PROTOCOL_VERSION=2026-07-28/);
});

test('the token never reaches the output, even when the server echoes it in an error', async () => {
  const { code, out } = await smoke(['tools-error']);
  assert.equal(code, 1, out);
  assert.match(out, /^FAIL tools\/list: want 200 and a tool list; got HTTP 403 .*no tools for Bearer <token>/m);
  assert.ok(!out.includes(token), out);
  assert.ok(!out.includes(token.slice(4, 20)), out);
});

test('MCP_SMOKE_PAGE=1: the German and the English page pass next to the MCP checks', async () => {
  const { code, out } = await smoke([], { MCP_SMOKE_PAGE: '1' });
  assert.equal(code, 0, out);
  assert.match(out, /^PASS browser page \(de-DE,de;q=0\.9,en;q=0\.8\): 200 text\/html, lang de, noindex$/m);
  assert.match(out, /^PASS browser page \(en-US,en;q=0\.9,de;q=0\.8\): 200 text\/html, lang en, noindex$/m);
  assert.match(out, /^PASS initialize: 200/m);
});

test('MCP_SMOKE_PAGE=1: no page for browsers fails both, a page in one language fails German', async () => {
  const none = await smoke(['no-page'], { MCP_SMOKE_PAGE: '1' });
  assert.equal(none.code, 1, none.out);
  assert.equal(failLines(none.out).filter((l) => l.startsWith('FAIL browser page')).length, 2, none.out);
  const english = await smoke(['page-language'], { MCP_SMOKE_PAGE: '1' });
  assert.equal(english.code, 1, english.out);
  assert.deepEqual(failLines(english.out).map((l) => l.slice(0, 32)), ['FAIL browser page (de-DE,de;q=0.']);
});

test('without MCP_SMOKE_PAGE the page is not checked', async () => {
  const { code, out } = await smoke(['no-page']);
  assert.equal(code, 0, out);
  assert.doesNotMatch(out, /browser page/);
});

test('an unknown MCP_PROTOCOL_VERSION is a usage error', async () => {
  const { code, out } = await smoke([], { MCP_PROTOCOL_VERSION: '2024-11-05' });
  assert.equal(code, 2, out);
  assert.match(out, /MCP_PROTOCOL_VERSION=2024-11-05: unknown/);
});
