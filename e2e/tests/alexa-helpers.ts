// Job 31: Alexa as the e2e tests play it. Requests are signed like Alexa signs them, with the test
// CA scripts/alexa-test-ca.sh made for this stack (the local `alexa` function trusts it, a hosted
// one never does). Account linking runs the authorization code flow Alexa runs: a confidential
// client (HTTP Basic), PKCE S256 and an Alexa redirect URL.
import { expect, type Page } from '@playwright/test';
import { createHash, createSign, randomBytes, randomUUID } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { functionsUrl, supabaseUrl } from './helpers';
import { callbackParams, openAuthorization } from './mcp-helpers';

export const alexaUrl = `${functionsUrl}/alexa`;
/** scripts/alexa-test-ca.sh's skill id, which the local function is configured with. */
export const skillId = 'amzn1.ask.skill.00000000-0000-4000-8000-00000000e2e0';
const certUrl = 'https://s3.amazonaws.com/echo.api/echo-api-cert-test.pem';
const vendor = 'M2E2ETESTVENDOR';
/** de-DE skills link through layla (EU); all three regions are registered, as for the real skill. */
export const alexaRedirect = `https://layla.amazon.com/api/skill/link/${vendor}`;
const redirects = [
  `https://pitangui.amazon.com/api/skill/link/${vendor}`,
  alexaRedirect,
  `https://alexa.amazon.co.jp/api/skill/link/${vendor}`,
];
export const issuer = `${supabaseUrl}/auth/v1`;

const leafKey = () =>
  readFileSync(fileURLToPath(new URL('../../supabase/.temp/alexa-test/leaf.key', import.meta.url)), 'utf8');

export interface AlexaReply {
  version: string;
  sessionAttributes?: Record<string, unknown>;
  response: {
    outputSpeech?: { type: string; text: string };
    reprompt?: { outputSpeech: { text: string } };
    card?: { type: string; title?: string; content?: string };
    directives?: { type: string }[];
    shouldEndSession?: boolean;
  };
}

export interface Ask {
  token?: string;
  alexaUser?: string;
  attributes?: Record<string, unknown>;
  /** Milliseconds to move the timestamp by (a stale request). */
  skew?: number;
}

export function alexaRequest(request: Record<string, unknown>, ask: Ask = {}) {
  const user = { userId: ask.alexaUser ?? 'amzn1.ask.account.E2E', accessToken: ask.token };
  return {
    version: '1.0',
    session: {
      new: !ask.attributes,
      sessionId: `amzn1.echo-api.session.${randomUUID()}`,
      application: { applicationId: skillId },
      attributes: ask.attributes,
      user,
    },
    context: { System: { application: { applicationId: skillId }, user } },
    request: {
      requestId: `amzn1.echo-api.request.${randomUUID()}`,
      timestamp: new Date(Date.now() + (ask.skew ?? 0)).toISOString(),
      locale: 'de-DE',
      ...request,
    },
  };
}

export const addIntent = (items: string) => ({
  type: 'IntentRequest',
  intent: { name: 'AddItemIntent', confirmationStatus: 'NONE', slots: { items: { name: 'items', value: items } } },
});

export const readIntent = { type: 'IntentRequest', intent: { name: 'ReadListIntent', confirmationStatus: 'NONE' } };

/** Posts [body] to the alexa function, signed like Alexa unless [sign] is false. */
export async function postToAlexa(
  body: unknown,
  { sign = true, tamper }: { sign?: boolean; tamper?: (raw: string) => string } = {},
): Promise<{ status: number; reply: AlexaReply }> {
  const raw = JSON.stringify(body);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (sign) {
    headers.signaturecertchainurl = certUrl;
    headers['signature-256'] = createSign('RSA-SHA256').update(raw).sign(leafKey(), 'base64');
  }
  const res = await fetch(alexaUrl, { method: 'POST', headers, body: tamper ? tamper(raw) : raw });
  const text = await res.text();
  return { status: res.status, reply: text ? JSON.parse(text) : {} };
}

/** "Alexa, sag Hummlist, <phrase>": the speech Alexa would say. */
export async function say(token: string | undefined, items: string, ask: Ask = {}): Promise<string | undefined> {
  const { status, reply } = await postToAlexa(alexaRequest(addIntent(items), { ...ask, token }));
  expect(status).toBe(200);
  return reply.response.outputSpeech?.text;
}

// Account linking ----------------------------------------------------------------------------

export interface AlexaClient {
  clientId: string;
  clientSecret: string;
}

/** What the transcript in the PR shows: each step, its status and the fields, never a token. */
const transcript: string[] = [];
export function note(line: string) {
  transcript.push(line);
  const dir = process.env.SCREENSHOT_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  appendFileSync(`${dir}/alexa-account-linking-transcript.txt`, `${line}\n`);
}

const secretKeys = new Set(['access_token', 'refresh_token', 'id_token', 'client_secret', 'code', 'code_verifier']);
const redact = (body: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(body).map(([k, v]) =>
      [k, secretKeys.has(k) && typeof v === 'string' ? `<${k}, ${v.length} chars>` : v]
    ),
  );

/** Registers the skill's OAuth client the way docs/ALEXA.md does it: confidential, Alexa's URLs. */
export async function registerAlexaClient(): Promise<AlexaClient> {
  const res = await fetch(`${issuer}/oauth/clients/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Amazon Alexa',
      redirect_uris: redirects,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_basic',
    }),
  });
  const body = await res.json();
  note(`POST /auth/v1/oauth/clients/register -> ${res.status} ${JSON.stringify(redact(body))}`);
  expect([200, 201], JSON.stringify(redact(body))).toContain(res.status);
  expect(body.client_type).toBe('confidential');
  expect(body.token_endpoint_auth_method).toBe('client_secret_basic');
  expect(body.client_secret, 'a confidential client gets a secret').toBeTruthy();
  return { clientId: body.client_id, clientSecret: body.client_secret };
}

const basic = (client: AlexaClient) =>
  `Basic ${Buffer.from(`${encodeURIComponent(client.clientId)}:${encodeURIComponent(client.clientSecret)}`).toString('base64')}`;

export interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

/** POST /oauth/token as Alexa sends it: form body, client credentials in HTTP Basic. */
export async function tokenRequest(
  client: AlexaClient,
  form: Record<string, string>,
): Promise<{ status: number; body: Tokens & Record<string, unknown> }> {
  const res = await fetch(`${issuer}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: basic(client) },
    body: new URLSearchParams(form),
  });
  const body = await res.json();
  note(`POST /auth/v1/oauth/token (${form.grant_type}, HTTP Basic) -> ${res.status} ${JSON.stringify(redact(body))}`);
  return { status: res.status, body };
}

/**
 * Links [page]'s signed-in user like the Alexa app does: authorize with PKCE and the layla
 * redirect, the user allows on the app's consent page, then the code is exchanged.
 */
export async function linkAccount(
  page: Page,
  client: AlexaClient,
  appBaseUrl: string,
  { screenshotAs }: { screenshotAs?: (page: Page) => Promise<void> } = {},
): Promise<Tokens> {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const state = randomBytes(16).toString('base64url');
  const authorize = new URL(`${issuer}/oauth/authorize`);
  // What Alexa sends (no scope: the skill configures none, Supabase applies its default).
  authorize.search = new URLSearchParams({
    response_type: 'code',
    client_id: client.clientId,
    redirect_uri: alexaRedirect,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();
  note(`GET /auth/v1/oauth/authorize?response_type=code&client_id=<id>&redirect_uri=${alexaRedirect}&state=<state>&code_challenge=<S256>&code_challenge_method=S256`);
  await openAuthorization(page, authorize, appBaseUrl, alexaRedirect);
  await expect(page.getByText('Amazon Alexa').first()).toBeVisible();
  await screenshotAs?.(page);
  await page.getByRole('button', { name: 'Erlauben' }).click();
  const params = await callbackParams(page, alexaRedirect);
  expect(params.get('state'), 'Alexa gets its state back').toBe(state);
  note(`consent page: Erlauben -> 302 ${alexaRedirect}?code=<code>&state=<state, matches>`);
  const { status, body } = await tokenRequest(client, {
    grant_type: 'authorization_code',
    code: params.get('code')!,
    redirect_uri: alexaRedirect,
    code_verifier: verifier,
  });
  expect(status).toBe(200);
  expect(body.token_type.toLowerCase()).toBe('bearer');
  expect(body.expires_in).toBeGreaterThan(0);
  expect(body.refresh_token, 'Alexa needs a refresh token').toBeTruthy();
  return body;
}
