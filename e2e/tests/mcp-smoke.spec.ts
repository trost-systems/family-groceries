import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from './fixtures';
import { anonClient, apiAs, newEmail, password } from './helpers';
import { mcpUrl } from './mcp-helpers';

const script = fileURLToPath(new URL('../../scripts/mcp-smoke.sh', import.meta.url));

/** A throwaway account with its own household and a personal access token for it. */
async function throwawayToken(): Promise<string> {
  const email = newEmail('mcp-smoke');
  const { error } = await anonClient().auth.signUp({ email, password });
  expect(error).toBeNull();
  const api = await apiAs(email);
  const { error: created } = await api.rpc('create_household', { p_name: 'Smoke' });
  expect(created).toBeNull();
  const { data, error: issued } = await api.rpc('create_personal_access_token', { p_name: 'mcp-smoke' });
  expect(issued).toBeNull();
  return (data as { token: string }[])[0].token;
}

function smoke(token: string, version: string): Promise<{ code: number; out: string }> {
  // 2026-era clients get the authorization server front; its Client ID Metadata Document checks
  // run here, against this branch's server (job 94).
  const cimd = version === '2026-07-28' ? { MCP_SMOKE_CIMD: '1' } : {};
  return new Promise((done) => {
    execFile('bash', [script, mcpUrl.toString()], {
      env: { ...process.env, MCP_SMOKE_TOKEN: token, MCP_PROTOCOL_VERSION: version, ...cimd },
    }, (error, stdout, stderr) => done({ code: error ? Number(error.code) : 0, out: stdout + stderr }));
  });
}

for (const [version, handshake] of [['2025-11-25', 'initialize'], ['2026-07-28', 'server/discover']]) {
  test(`scripts/mcp-smoke.sh passes against the local server in protocol ${version}`, async () => {
    const token = await throwawayToken();
    const { code, out } = await smoke(token, version);
    expect(out).not.toContain(token);
    expect(code, out).toBe(0);
    expect(out).toContain(`PASS ${handshake}: 200, protocol ${version}, server hummlist, tools capability`);
    expect(out).toMatch(/^PASS tools\/list: .*add_items/m);
    expect(out).not.toMatch(/^(FAIL|SKIP) /m);
    if (version === '2026-07-28') {
      for (const check of [
        /^PASS no token: 401, resource_metadata on the same host \(.*\/oauth-protected-resource\/cimd\)$/m,
        /^PASS client ID metadata documents: .*\/functions\/v1\/mcp\/oauth advertises client_id_metadata_document_supported$/m,
        /^PASS rediscovery: /m,
        /^PASS tools\/list: resultType complete, ttlMs 3600000, cacheScope private$/m,
        /^PASS Mcp-Method: /m,
        /^PASS Mcp-Name: /m,
        /^PASS unknown version: /m,
      ]) expect(out).toMatch(check);
    } else {
      expect(out).toContain('PASS notifications/initialized: 202');
      expect(out).toMatch(/^PASS protected resource metadata: .*authorization server .*\/auth\/v1$/m);
    }
  });
}
