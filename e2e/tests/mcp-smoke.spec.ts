import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { expect, test } from './fixtures';
import { anonClient, apiAs, firstOf, newEmail, password } from './helpers';
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
  return firstOf(data as { token: string }[], 'token').token;
}

function smoke(token: string, version: string): Promise<{ code: number; out: string }> {
  return new Promise((done) => {
    execFile('bash', [script, mcpUrl.toString()], {
      env: { ...process.env, MCP_SMOKE_TOKEN: token, MCP_PROTOCOL_VERSION: version },
    }, (error, stdout, stderr) => done({ code: error ? Number(error.code) : 0, out: stdout + stderr }));
  });
}

for (const [version, handshake] of [['2025-11-25', 'initialize'], ['2026-07-28', 'server/discover']] as const) {
  test(`scripts/mcp-smoke.sh passes against the local server in protocol ${version}`, async () => {
    const token = await throwawayToken();
    const { code, out } = await smoke(token, version);
    expect(out).not.toContain(token);
    expect(code, out).toBe(0);
    expect(out).toContain(`PASS ${handshake}: 200, protocol ${version}, server snacklist, tools capability`);
    expect(out).toMatch(/^PASS tools\/list: .*add_items/m);
    expect(out).not.toMatch(/^(FAIL|SKIP) /m);
  });
}
