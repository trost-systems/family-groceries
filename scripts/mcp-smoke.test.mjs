// scripts/mcp-smoke.sh against a fake MCP server (mcp-smoke-fixture.mjs): all checks pass on a
// server that behaves like ours, and each check fails on the one breakage it exists to catch.
// Run: npx -y -p node@22 node --test scripts/mcp-smoke.test.mjs
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { startFake, token } from './mcp-smoke-fixture.mjs';

const script = fileURLToPath(new URL('mcp-smoke.sh', import.meta.url));

/** Runs the smoke test against a fake with `breaks`; resolves with its exit code and output. */
async function smoke(breaks = [], env = {}) {
  const fake = await startFake(new Set(breaks));
  try {
    return await new Promise((done) => {
      execFile('bash', [script, fake.url], {
        env: { ...process.env, MCP_SMOKE_TOKEN: token, MCP_PROTOCOL_VERSION: '', ...env },
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

test('protocol 2026-07-28: server/discover and tools/list pass, without initialize', async () => {
  const { code, out } = await smoke([], { MCP_PROTOCOL_VERSION: '2026-07-28' });
  assert.equal(code, 0, out);
  assert.match(out, /^PASS server\/discover: 200, protocol 2026-07-28, server fixture, tools capability$/m);
  assert.match(out, /^PASS tools\/list: list_items,add_items$/m);
  assert.doesNotMatch(out, /initialize/);
});

test('protocol 2026-07-28: a server that does not list the version fails', async () => {
  const { code, out } = await smoke(['protocol-version'], { MCP_PROTOCOL_VERSION: '2026-07-28' });
  assert.equal(code, 1, out);
  assert.match(out, /^FAIL server\/discover: want 200 with protocol 2026-07-28/m);
});

test('the token never reaches the output, even when the server echoes it in an error', async () => {
  const { code, out } = await smoke(['tools-error']);
  assert.equal(code, 1, out);
  assert.match(out, /^FAIL tools\/list: want 200 and a tool list; got HTTP 403 .*no tools for Bearer <token>/m);
  assert.ok(!out.includes(token), out);
  assert.ok(!out.includes(token.slice(4, 20)), out);
});

test('an unknown MCP_PROTOCOL_VERSION is a usage error', async () => {
  const { code, out } = await smoke([], { MCP_PROTOCOL_VERSION: '2024-11-05' });
  assert.equal(code, 2, out);
  assert.match(out, /MCP_PROTOCOL_VERSION=2024-11-05: unknown/);
});
