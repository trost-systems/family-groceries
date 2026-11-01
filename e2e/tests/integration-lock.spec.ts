// Job 50 (Spec #4): Siri, Alexa and MCP are part of Hummlist Premium once the server's
// integration_lock switch is on. A household without premium is refused in context and nothing is
// added; the integration settings say so for every member, with connections paused, not removed;
// a yearly plan opens all three within one sync with the same credentials; its expiry locks them
// again and deletes nothing. A tester's grant works throughout.
//
// The switch is global, so this spec runs alone after the suite (scripts/gates/e2e.sh,
// FG_E2E_INTEGRATION_LOCK): it turns the switch on and off again.
import type { Client } from '@modelcontextprotocol/client';
import { type Browser, expect, type Page, test } from './fixtures';
import {
  adminClient,
  apiAs,
  functionsUrl,
  itemRow,
  joinWithCode,
  newEmail,
  openMore,
  screenshot,
  signUp,
  signUpWithHousehold,
} from './helpers';
import { linkAccount, registerAlexaClient, say as alexaSay } from './alexa-helpers';
import { householdOf, rcEvent, subscribe, yearlyId } from './iap';
import { connectWithToken } from './mcp-helpers';

test.describe.configure({ mode: 'serial' });

const voicePremium =
  'Sprachbefehle sind Teil von Hummlist Premium. Du kannst es in der App freischalten. Ich habe nichts hinzugefügt.';
const mcpPremium =
  'Dieser Haushalt braucht Hummlist Premium für den Zugang über KI-Assistenten. Schalte es in der Hummlist-App frei. Es wurde nichts gelesen oder geändert.';

async function lockSwitch(enabled: boolean) {
  const { error } = await adminClient().from('app_switches').update({ enabled }).eq('key', 'integration_lock');
  if (error) throw error;
}

test.beforeAll(() => lockSwitch(true));
test.afterAll(() => lockSwitch(false));

/** The Siri Shortcut's request: one sentence, the PAT, the spoken answer as text. */
async function siri(token: string, text: string) {
  const res = await fetch(`${functionsUrl}/voice?format=text`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  return { status: res.status, speech: await res.text() };
}

async function toolText(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args });
  return { isError: result.isError === true, text: (result.content as { text: string }[])[0].text };
}

async function openNames(email: string): Promise<string[]> {
  const { data, error } = await (await apiAs(email)).from('items').select('name').eq('status', 'active')
    .order('created_at');
  expect(error).toBeNull();
  return (data as { name: string }[]).map((r) => r.name);
}

async function pat(email: string, name: string): Promise<string> {
  const { data, error } = await (await apiAs(email)).rpc('create_personal_access_token', { p_name: name });
  expect(error).toBeNull();
  return (Array.isArray(data) ? data[0] : data).token as string;
}

const newPage = async (browser: Browser) => {
  const page = await (await browser.newContext()).newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  return page;
};

const card = (page: Page) => page.getByRole('heading', { name: 'Teil von Hummlist Premium' });
/** A connection's tile: one group named by its texts, "Pausiert: …" last while locked. */
const tile = (page: Page, name: string) => page.getByRole('group', { name: new RegExp(`^${name} `) });
const paused = (page: Page) => page.getByRole('group', { name: /Pausiert: braucht Hummlist Premium$/ });

test('locked household: Siri, Alexa and MCP refuse in context and add nothing; a yearly plan opens '
  + 'all three for every member with the same credentials; its expiry locks again and keeps everything', async ({ browser, baseURL }) => {
  test.setTimeout(240_000);
  const peterEmail = newEmail('lock-peter');
  const leaEmail = newEmail('lock-lea');
  const peter = await newPage(browser);
  await signUpWithHousehold(peter, peterEmail);
  const { data: invite } = await (await apiAs(peterEmail)).rpc('create_invite', {
    p_household: await householdOf(peterEmail),
  });
  const lea = await newPage(browser);
  await signUp(lea, leaEmail);
  await joinWithCode(lea, (Array.isArray(invite) ? invite[0] : invite).code);
  const household = await householdOf(peterEmail);

  // Peter connects all three while locked: linking is allowed, so unlocking needs no relinking.
  const shortcut = await pat(peterEmail, 'Kurzbefehl');
  const alexa = await linkAccount(peter, await registerAlexaClient(), baseURL!);
  await peter.goto('/');
  const mcp = await connectWithToken(shortcut);

  expect(await siri(shortcut, 'Milch, zwei Gurken und Klopapier')).toEqual({ status: 200, speech: voicePremium });
  expect(await alexaSay(alexa.access_token, 'Eier')).toBe(voicePremium);
  const tools = (await mcp.listTools()).tools.map((t) => t.name);
  expect(tools, 'tools/list stays reachable').toContain('add_items');
  expect(await toolText(mcp, 'add_items', { items: [{ name: 'Kaffee' }] })).toEqual({ isError: true, text: mcpPremium });
  expect(await toolText(mcp, 'list_items')).toEqual({ isError: true, text: mcpPremium });
  expect(await openNames(peterEmail), 'nothing was added').toEqual([]);

  // Both members see it in the integration settings; the web sells nothing.
  await openMore(peter, 'Zugänge');
  await openMore(lea, 'Zugänge');
  await expect(card(peter)).toBeVisible();
  await expect(card(lea)).toBeVisible();
  await expect(peter.getByRole('group', { name: /Hummlist Premium kaufst du in der iPhone- oder Android-App\./ }))
    .toBeVisible();
  await expect(peter.getByRole('button', { name: 'Hummlist Premium freischalten' }), 'no Buy on the web')
    .toHaveCount(0);
  await expect(paused(peter).first(), 'the connections stay, paused').toBeVisible();
  await expect(tile(peter, 'Kurzbefehl')).toHaveAccessibleName(/Pausiert: braucht Hummlist Premium$/);
  await expect(tile(peter, 'Amazon Alexa')).toHaveAccessibleName(/Pausiert: braucht Hummlist Premium$/);
  await screenshot(peter, 'job50-web-access-locked-de-390');

  // Peter subscribes on his iPhone: within one sync everything opens, for Lea too, same credentials.
  const tx = `5000${Date.now()}`;
  expect(await subscribe(peterEmail, tx)).toBe('granted');
  await expect(card(lea), 'the partner loses the card live').toHaveCount(0, { timeout: 10_000 });
  await expect(card(peter)).toHaveCount(0, { timeout: 10_000 });
  await expect(paused(peter), 'no connection paused any more').toHaveCount(0);
  await screenshot(peter, 'job50-web-access-unlocked-de-390');
  expect(await siri(shortcut, 'Milch')).toEqual({ status: 200, speech: 'Hinzugefügt: Milch.' });
  expect(await alexaSay(alexa.access_token, 'Eier')).toBe('Ich habe Eier auf die Hummlist gesetzt.');
  expect((await toolText(mcp, 'add_items', { items: [{ name: 'Kaffee' }] })).isError).toBe(false);
  expect(await openNames(peterEmail)).toEqual(['Milch', 'Eier', 'Kaffee']);

  // The plan expires: locked again at read time, nothing deleted or disconnected.
  expect((await rcEvent('EXPIRATION', household, tx, { productId: yearlyId, expiresInDays: -1 })).body)
    .toEqual({ status: 'updated' });
  await expect(card(lea), 'locked again, live').toBeVisible({ timeout: 10_000 });
  expect(await siri(shortcut, 'Brot')).toEqual({ status: 200, speech: voicePremium });
  expect(await alexaSay(alexa.access_token, 'Brot')).toBe(voicePremium);
  expect((await toolText(mcp, 'list_items')).isError).toBe(true);
  expect(await openNames(peterEmail), 'the list stays').toEqual(['Milch', 'Eier', 'Kaffee']);
  const { data: tokens } = await (await apiAs(peterEmail)).from('personal_access_tokens').select('name, revoked_at');
  expect(tokens, 'no token revoked').toEqual([{ name: 'Kurzbefehl', revoked_at: null }]);
  await expect(tile(peter, 'Amazon Alexa'), 'the Alexa link stays, paused')
    .toHaveAccessibleName(/Pausiert: braucht Hummlist Premium$/, { timeout: 10_000 });
  await screenshot(peter, 'job50-web-access-paused-de-390');

  // Renewed: open again, still the same credentials.
  expect((await rcEvent('RENEWAL', household, tx, { productId: yearlyId })).body).toEqual({ status: 'restored' });
  await expect(card(lea)).toHaveCount(0, { timeout: 10_000 });
  expect(await siri(shortcut, 'Brot')).toEqual({ status: 200, speech: 'Hinzugefügt: Brot.' });
  await peter.getByRole('tab', { name: 'Liste' }).click();
  await expect(itemRow(peter, 'Brot')).toBeVisible();
  await mcp.close();
});

test("a tester's household works with the lock on; a beta household without a grant is locked until "
  + 'the Lead grants it', async ({ browser }) => {
  const tessEmail = newEmail('lock-tess');
  const betaEmail = newEmail('lock-beta');
  const tess = await newPage(browser);
  await signUp(tess, tessEmail);
  const { data: user } = await (await apiAs(tessEmail)).auth.getUser();
  const { error } = await adminClient().from('lifetime_testers').insert({ user_id: user.user!.id, grants: 1 });
  expect(error).toBeNull();
  await signUpWithHousehold(await newPage(browser), betaEmail);
  const { error: created } = await (await apiAs(tessEmail)).rpc('create_household', { p_name: 'Tess' });
  expect(created).toBeNull();

  expect(await siri(await pat(tessEmail, 'Kurzbefehl'), 'Milch')).toEqual({ status: 200, speech: 'Hinzugefügt: Milch.' });
  const beta = await pat(betaEmail, 'Kurzbefehl');
  expect(await siri(beta, 'Milch')).toEqual({ status: 200, speech: voicePremium });

  // The cut-over: the Lead grants the beta tester (scripts/iap/testers.ts); the existing
  // household unlocks at once and the same token works.
  const { data: betaUser } = await (await apiAs(betaEmail)).auth.getUser();
  const { error: granted } = await adminClient().from('lifetime_testers').insert({ user_id: betaUser.user!.id, grants: 1 });
  expect(granted).toBeNull();
  expect(await siri(beta, 'Milch')).toEqual({ status: 200, speech: 'Hinzugefügt: Milch.' });
  await tess.goto('/');
  await openMore(tess, 'Zugänge');
  await expect(tile(tess, 'Kurzbefehl')).toBeVisible();
  await expect(card(tess)).toHaveCount(0);
  await expect(paused(tess)).toHaveCount(0);
});

test('English settings, locked', async ({ browser }) => {
  const email = newEmail('lock-en');
  const page = await newPage(browser);
  await signUpWithHousehold(page, email);
  await pat(email, 'Shortcut');
  await page.goto('/more/settings/language');
  await page.getByRole('radio', { name: 'English', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Language' })).toBeVisible();
  await page.goto('/more/access');
  await expect(page.getByRole('heading', { name: 'Part of Hummlist Premium' })).toBeVisible();
  await expect(tile(page, 'Shortcut')).toHaveAccessibleName(/Paused: needs Hummlist Premium$/);
  await screenshot(page, 'job50-web-access-locked-en-390');
});
