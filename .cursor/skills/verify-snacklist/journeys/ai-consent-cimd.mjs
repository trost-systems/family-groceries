// Feature ai-assistants, sub-feature ai-consent for an assistant on MCP 2026-07-28 (job 94): it
// signs in with a Client ID Metadata Document URL as client_id. The local mcp function's front
// fetches Claude's real document over the internet, maps it to a Supabase client, and Supabase
// sends the browser to the app's consent page, which must name the document's client. Erlauben
// leads to the document's redirect URI (stubbed) with a code; Zugänge then lists the app.
// --seed-document skips the fetch: it registers the client from the repo's copy of Claude's
// document (mcp/testdata/cimd-claude.json) as the front would, for a box whose DNS answers
// claude.ai with a non-public address, which the front refuses („… is not a public host“).
//
//   node journeys/ai-consent-cimd.mjs <evidence dir> [--lang de|en] [--seed-document]
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { capture, instance, logger, member, openApp, openTab, repo, signIn } from '../helpers/lib.mjs';

const [dir, ...rest] = process.argv.slice(2);
const lang = rest.includes('--lang') ? rest[rest.indexOf('--lang') + 1] : 'de';
const seedDocument = rest.includes('--seed-document');
if (!dir) throw new Error('usage: ai-consent-cimd.mjs <evidence dir> [--lang de|en] [--seed-document]');

const DOCUMENT = 'https://claude.ai/oauth/mcp-oauth-client-metadata';
const CALLBACK = 'https://claude.ai/api/mcp/auth_callback';

const log = logger(dir);
const inst = instance();
const user = member(inst);
const project = /^project_id = "(.*)"$/m.exec(readFileSync(join(repo, 'supabase/config.toml'), 'utf8'))[1];
const sql = (query) =>
  execFileSync('docker', ['exec', '-i', `supabase_db_${project}`, 'psql', '-q', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-tA'], {
    input: query,
    encoding: 'utf8',
  }).trim();

const cleanUp = () => {
  const mapped = sql(`delete from public.oauth_cimd_clients where client_id = '${DOCUMENT}' returning auth_client_id`);
  if (mapped) {
    sql(`delete from auth.oauth_consents where client_id = '${mapped}'; delete from auth.sessions where oauth_client_id = '${mapped}'; delete from auth.oauth_clients where id = '${mapped}';`);
  }
};
// A crashed earlier run may have left its client mapped.
cleanUp();

const mcp = `${inst.apiUrl}/functions/v1/mcp`;
const challenge = await fetch(mcp, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'mcp-protocol-version': '2026-07-28', 'mcp-method': 'server/discover' },
  body: '{}',
});
const metadataUrl = /resource_metadata="([^"]*)"/.exec(challenge.headers.get('www-authenticate') ?? '')?.[1];
log(`2026 request without a token: ${challenge.status}, resource_metadata ${metadataUrl}`);
const issuer = (await (await fetch(metadataUrl)).json()).authorization_servers[0];
const asMetadata = await (await fetch(`${issuer}/.well-known/oauth-authorization-server`)).json();
if (asMetadata.client_id_metadata_document_supported !== true) throw new Error(`${issuer} does not advertise CIMD`);
log(`authorization server ${issuer}: client_id_metadata_document_supported, authorize ${asMetadata.authorization_endpoint}`);

const { browser, page, L, errors } = await openApp(inst, { lang, videoDir: dir });
let failed = null;
try {
  if (seedDocument) {
    const doc = JSON.parse(readFileSync(join(repo, 'supabase/functions/mcp/testdata/cimd-claude.json'), 'utf8'));
    const secret = /^SECRET_KEY="(.*)"$/m.exec(execFileSync('supabase', ['status', '-o', 'env'], { cwd: repo, encoding: 'utf8' }))[1];
    const created = await fetch(`${inst.apiUrl}/auth/v1/admin/oauth/clients`, {
      method: 'POST',
      headers: { apikey: secret, authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        client_name: doc.client_name,
        redirect_uris: doc.redirect_uris,
        client_uri: doc.client_uri,
        client_type: 'public',
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
      }),
    });
    const { client_id: authClientId } = await created.json();
    if (!created.ok || !authClientId) throw new Error(`seeding the client: ${created.status}`);
    sql(`insert into public.oauth_cimd_clients (client_id, auth_client_id, client_name, redirect_uris, client_uri, fresh_until)
      values ('${DOCUMENT}', '${authClientId}', '${doc.client_name}', array[${doc.redirect_uris.map((u) => `'${u}'`).join(', ')}], '${doc.client_uri}', now() + interval '1 hour')
      on conflict (client_id) do update set auth_client_id = excluded.auth_client_id, fresh_until = excluded.fresh_until`);
    log(`--seed-document: client ${authClientId} mapped from testdata/cimd-claude.json, fresh for 1 h (no fetch)`);
  }

  const authorize = new URL(asMetadata.authorization_endpoint);
  for (const [key, value] of Object.entries({
    response_type: 'code',
    client_id: DOCUMENT,
    redirect_uri: CALLBACK,
    code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    code_challenge_method: 'S256',
    state: 'verify-snacklist',
    scope: 'openid email',
  })) authorize.searchParams.set(key, value);
  const front = await fetch(authorize, { redirect: 'manual' });
  if (front.status !== 302) throw new Error(`front authorize: ${front.status} ${await front.text()}`);
  const upstream = new URL(front.headers.get('location'));
  log(`front: 302 to Supabase authorize as client ${upstream.searchParams.get('client_id')}`);
  const supabase = await fetch(upstream, { redirect: 'manual' });
  const consent = new URL(supabase.headers.get('location'));
  const page_ = new URL(`/oauth/consent${consent.search}`, inst.webUrl);
  log(`Supabase: ${supabase.status} to the consent page, authorization_id ${consent.searchParams.get('authorization_id')}`);
  log(`mapping: ${sql(`select client_id || ' -> ' || auth_client_id || ' (' || client_name || ')' from public.oauth_cimd_clients where client_id = '${DOCUMENT}'`)}`);

  await signIn(page, L, user);
  await page.route(`${CALLBACK}**`, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<h1>Claude (stub): signed in</h1>' }));
  await page.goto(page_.toString());
  const allow = page.getByRole('button', { name: L('consentAllow') });
  await allow.waitFor({ timeout: 30_000 });
  await page.getByText(/^Claude/).first().waitFor();
  log('consent page names „Claude“ from the document');
  await capture(page, dir, '01-consent-claude-cimd');
  const [callback] = await Promise.all([
    page.waitForURL(`${CALLBACK}**`, { timeout: 30_000 }).then(() => new URL(page.url())),
    allow.click(),
  ]);
  if (!callback.searchParams.get('code') || callback.searchParams.get('state') !== 'verify-snacklist') {
    throw new Error(`callback without code or state: ${callback}`);
  }
  log(`Erlauben: back at the document's redirect URI with a code, state verify-snacklist, iss ${callback.searchParams.get('iss')}`);
  await page.goto('/');
  await openTab(page, L, 'tabMore');
  await page.getByRole('button', { name: new RegExp(`^${L('accessTitle')}`) }).first().click();
  const row = page.getByRole('button', { name: new RegExp(`^Claude\\s.*${L('connectedOn', { date: '' }).trim()}`) });
  await row.waitFor({ timeout: 15_000 });
  log(`Zugänge row: „${await row.getAttribute('aria-label') ?? await row.textContent()}“`);
  await page.mouse.wheel(0, 600);
  await capture(page, dir, '02-access-claude-connected');
  if (errors.length) throw new Error(`page errors: ${errors.join('; ')}`);
} catch (error) {
  failed = error;
  await capture(page, dir, '99-failure').catch(() => {});
} finally {
  await page.context().close();
  await browser.close();
  cleanUp();
}
if (failed) {
  log(`FAIL: ${failed.message}`);
  process.exit(1);
}
log(`PASS ai-consent-cimd (evidence: ${dir})`);
