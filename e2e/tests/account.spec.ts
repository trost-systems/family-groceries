import { readFileSync } from 'node:fs';
import { expect, test, type Page } from './fixtures';
import {
  addItem, adminClient, apiAs, createInviteCode, cutOff, functionsUrl, itemRow, joinWithCode, newEmail, openMore, password, screenshot, signUp, signUpWithHousehold, typeInto,
} from './helpers';

const deletedNotice = (page: Page) => page.getByText('Dein Konto wurde gelöscht.');
const confirmField = (page: Page) => page.getByRole('textbox', { name: 'Zum Bestätigen LÖSCHEN eingeben' });
const confirmButton = (page: Page) => page.getByRole('button', { name: 'Endgültig löschen' });

async function openAccount(page: Page): Promise<void> {
  await openMore(page, 'Konto');
  await expect(page.getByRole('button', { name: 'Konto löschen', exact: true })).toBeVisible();
}

async function openDeleteDialog(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Konto löschen', exact: true }).click();
  await expect(confirmField(page)).toBeVisible();
}

async function confirmDeletion(page: Page): Promise<void> {
  await typeInto(confirmField(page), 'LÖSCHEN');
  await confirmButton(page).click();
  await expect(deletedNotice(page)).toBeVisible();
}

async function userId(email: string): Promise<string> {
  return (await (await apiAs(email)).auth.getUser()).data.user!.id;
}

/** A feedback note as the app sends it (job 21), through the user's own API client. */
async function sendFeedback(email: string, message: string): Promise<void> {
  const { error } = await (await apiAs(email)).from('feedback').insert({
    id: crypto.randomUUID(), message, app_version: '0.1.0', build: '1', platform: 'web',
    os_version: 'Chrome on Linux', locale: 'de', screen: 'list',
  });
  expect(error).toBeNull();
}

async function feedbackOf(userId: string): Promise<{ message: string; household_id: string | null }[]> {
  const { data, error } = await adminClient().from('feedback').select('message, household_id').eq('user_id', userId);
  if (error) throw error;
  return data;
}

async function userExists(id: string): Promise<boolean> {
  const { data, error } = await adminClient().auth.admin.getUserById(id);
  if (error && error.status !== 404) throw error;
  return data.user != null;
}

async function personalAccessToken(email: string): Promise<string> {
  const { data, error } = await (await apiAs(email)).rpc('create_personal_access_token', { p_name: 'Siri' });
  expect(error).toBeNull();
  return (data as { token: string }[])[0].token;
}

async function voiceStatus(token: string): Promise<number> {
  const res = await fetch(`${functionsUrl}/voice`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'Zahnpasta' }),
  });
  await res.body?.cancel();
  return res.status;
}

const householdTables = [
  'households', 'household_members', 'invites', 'categories', 'stores', 'store_category_order', 'items',
  'item_events', 'category_memory', 'item_store_memory', 'personal_access_tokens', 'feedback',
] as const;

async function householdRowCounts(householdId: string): Promise<Record<string, number>> {
  const admin = adminClient();
  const counts: Record<string, number> = {};
  for (const table of householdTables) {
    const column = table === 'households' ? 'id' : 'household_id';
    const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true }).eq(column, householdId);
    if (error) throw error;
    counts[table] = count!;
  }
  return counts;
}

test('a member deletes their account; the household and their items stay for the other member', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  const [emailA, emailB] = [newEmail('acct-a'), newEmail('acct-b')];
  const nameA = emailA.split('@')[0];

  await signUpWithHousehold(a, emailA);
  const code = await createInviteCode(a);
  await signUp(b, emailB);
  await joinWithCode(b, code);
  await addItem(b, 'Hafer');
  await addItem(a, 'Milch');
  await expect(itemRow(b, 'Milch')).toBeVisible();
  const idB = await userId(emailB);
  // Rows carry no added-by initial since job 15; who added an item stays in the database.
  const asA = await apiAs(emailA);
  const addedBy = async (name: string) => {
    const { data, error } = await asA.from('items').select('added_by').eq('name', name).single();
    if (error) throw error;
    return data.added_by;
  };
  expect(await addedBy('Hafer'), 'before: B\'s item records B as its author').toBe(idB);
  const tokenB = await personalAccessToken(emailB);
  expect(await voiceStatus(tokenB), 'B\'s token works before deletion').toBe(200);
  // Job 21 (AC12): both sent feedback; only B's goes with B.
  await sendFeedback(emailA, 'Von A');
  await sendFeedback(emailB, 'Von B');
  const idA = await userId(emailA);
  expect(await feedbackOf(idB)).toHaveLength(1);

  await openAccount(b);
  await screenshot(b, 'account-01-settings-konto');
  await openDeleteDialog(b);
  await expect(b.getByText(new RegExp(`bleibt für ${nameA} mit der ganzen Liste`))).toBeVisible();
  await expect(confirmButton(b), 'disabled until the word is typed').toBeDisabled();
  await typeInto(confirmField(b), 'LÖSCH');
  await expect(confirmButton(b)).toBeDisabled();
  await typeInto(confirmField(b), 'LÖSCHEN');
  await expect(confirmButton(b)).toBeEnabled();
  await screenshot(b, 'account-02-confirm-dialog');
  await confirmButton(b).click();

  await expect(deletedNotice(b)).toBeVisible();
  await expect(b).toHaveURL(/\/login/);
  await screenshot(b, 'account-03-deleted-sign-in');

  await expect(itemRow(a, 'Hafer'), 'live: B\'s item stays').toBeVisible();
  expect(await addedBy('Hafer'), 'its author is gone from the row').toBeNull();
  await expect(itemRow(a, 'Milch')).toBeVisible();
  await screenshot(a, 'account-04-partner-list-after');
  await a.reload();
  await expect(itemRow(a, 'Hafer'), 'after a reload too').toBeVisible();
  await expect(itemRow(a, 'Milch')).toBeVisible();

  await typeInto(b.getByRole('textbox', { name: 'E-Mail' }), emailB);
  await typeInto(b.getByRole('textbox', { name: 'Passwort' }), password);
  await b.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(b.getByText(/Anmeldung fehlgeschlagen/).first(), 'B cannot sign in again').toBeVisible();

  expect(await userExists(idB), 'B is gone from auth').toBe(false);
  expect(await feedbackOf(idB), 'B\'s feedback is gone').toEqual([]);
  const kept = await feedbackOf(idA);
  expect(kept.map((f) => f.message), 'A\'s feedback stays').toEqual(['Von A']);
  expect(kept[0].household_id, 'with the household it was sent from').not.toBeNull();
  expect(await voiceStatus(tokenB), 'B\'s token is dead').toBe(401);
});

test('the last member deletes their account; the household goes with every row in it', async ({ page }) => {
  const email = newEmail('acct-last');
  await signUpWithHousehold(page, email, { stores: ['Supermarkt'] });
  await addItem(page, 'Milch');
  await addItem(page, 'Brot');
  await expect(itemRow(page, 'Brot')).toBeVisible();
  await createInviteCode(page);
  await personalAccessToken(email);
  await sendFeedback(email, 'Bevor ich gehe');

  const api = await apiAs(email);
  const id = (await api.auth.getUser()).data.user!.id;
  // Job 22: a mistyped code is a row of the rate limit's log (invite_attempts), the user's own.
  expect((await api.rpc('accept_invite', { p_code: 'FALSCH22' })).data).toEqual({ status: 'invalid_invite', household_id: null });
  const attempts = async () =>
    (await adminClient().from('invite_attempts').select('*', { count: 'exact', head: true }).eq('user_id', id)).count;
  expect(await attempts(), 'the failed attempt is recorded').toBe(1);
  const { data: member } = await api.from('household_members').select('household_id').single();
  const householdId = (member as { household_id: string }).household_id;
  const { data: categories } = await api.from('categories').select('id, name').order('name');
  const { data: stores } = await api.from('stores').select('id').limit(1);
  await expect.poll(async () => (await api.from('items').select('category_id').eq('name', 'Milch').single()).data)
    .not.toBeNull();
  const milk = (await api.from('items').select('category_id').eq('name', 'Milch').single()).data as { category_id: string };
  const other = (categories as { id: string }[]).find((c) => c.id !== milk.category_id)!;
  const moved = await api.from('items')
    .update({ category_id: other.id, store_id: (stores as { id: string }[])[0].id }).eq('name', 'Milch');
  expect(moved.error).toBeNull();

  const before = await householdRowCounts(householdId);
  for (const table of householdTables) expect(before[table], `${table} has rows before deletion`).toBeGreaterThan(0);

  await openAccount(page);
  await openDeleteDialog(page);
  await expect(page.getByText(/Du bist das letzte Mitglied\. Deshalb wird der Haushalt/)).toBeVisible();
  await confirmDeletion(page);

  const after = await householdRowCounts(householdId);
  expect(after).toEqual(Object.fromEntries(householdTables.map((t) => [t, 0])));
  const { count } = await adminClient().from('profiles').select('*', { count: 'exact', head: true }).eq('id', id);
  expect(count, 'the profile is gone').toBe(0);
  expect(await userExists(id)).toBe(false);
  expect(await feedbackOf(id), 'their feedback is gone').toEqual([]);
  expect(await attempts(), 'their failed invite attempts are gone').toBe(0);
});

test('offline, deletion is refused and the account stays; back online it goes through', async ({ page }) => {
  const email = newEmail('acct-offline');
  await signUpWithHousehold(page, email);
  const id = await userId(email);
  await openAccount(page);
  await openDeleteDialog(page);
  await typeInto(confirmField(page), 'LÖSCHEN');

  const network = await cutOff(page);
  await confirmButton(page).click();
  await expect(page.getByText(/^Keine Internetverbindung\. Dein Konto wurde nicht gelöscht/)).toBeVisible();
  await expect(deletedNotice(page)).toHaveCount(0);
  expect(await userExists(id), 'the account still exists').toBe(true);

  await network.restore();
  await confirmButton(page).click();
  await expect(deletedNotice(page)).toBeVisible();
  expect(await userExists(id)).toBe(false);
});

test('Meine Daten exportieren downloads the user\'s own data as JSON, without token hashes', async ({ page }) => {
  const email = newEmail('acct-export');
  await signUpWithHousehold(page, email);
  await addItem(page, 'Milch');
  await addItem(page, 'Kaffee');
  await expect(itemRow(page, 'Kaffee')).toBeVisible();
  const token = await personalAccessToken(email);
  await sendFeedback(email, 'Meine Rückmeldung');

  await openAccount(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /^Meine Daten exportieren/ }).click(),
  ]);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
  expect(download.suggestedFilename()).toBe(`einkauf-daten-${today}.json`);

  const text = readFileSync((await download.path())!, 'utf8');
  const data = JSON.parse(text) as {
    format: string; account: { email: string }; items_added: { name: string }[]; access_tokens: { name: string }[];
    feedback: { message: string; screen: string }[];
  };
  expect(data.format).toBe('family-groceries-export');
  expect(data.account.email).toBe(email);
  expect(data.items_added.map((i) => i.name).sort()).toEqual(['Kaffee', 'Milch']);
  expect(data.access_tokens.map((t) => t.name)).toEqual(['Siri']);
  expect(data.feedback, 'their own feedback (job 21)').toMatchObject([{ message: 'Meine Rückmeldung', screen: 'list' }]);
  expect(text).not.toContain('token_hash');
  expect(text, 'nor the token itself').not.toContain(token);
});

test('a user without a household deletes their account from the welcome screen', async ({ page }) => {
  const email = newEmail('acct-welcome');
  await signUp(page, email);
  await expect(page.getByRole('button', { name: /^Haushalt erstellen/ })).toBeVisible();
  const id = await userId(email);

  await openDeleteDialog(page);
  await expect(page.getByText('Du bist in keinem Haushalt, geteilte Daten gibt es nicht.')).toBeVisible();
  await confirmDeletion(page);
  expect(await userExists(id)).toBe(false);
});

test('the public deletion page is served', async ({ page }) => {
  const response = await page.goto('/konto-loeschen.html');
  expect(response!.status()).toBe(200);
  await expect(page).toHaveTitle('Hummlist: Konto und Daten löschen');
  await expect(page.getByText('ENTWURF')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'support@hummlist.com' }).first()).toHaveAttribute('href', /^mailto:support@hummlist\.com/);
  await expect(page.locator('#einzelne-daten')).toHaveText('Einzelne Daten löschen, ohne das Konto zu löschen');
  await expect(page.getByRole('link', { name: 'Datenschutzerklärung' })).toHaveAttribute('href', 'https://hummlist.com/datenschutz');
});
