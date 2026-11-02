import { expect, type Page, test } from './fixtures';
import {
  addField, addSheet, answerConsent, apiAs, itemRow, newEmail, password, screenshot, signUp, signUpWithHousehold,
  storeDivider, typeInto,
} from './helpers';

// Job 66 (docs/DEEP_LINKS.md): app.hummlist.com links. Where the app is not installed they open the
// web app, which routes them as the apps do.

async function signIn(page: Page, email: string): Promise<void> {
  await typeInto(page.getByRole('textbox', { name: 'E-Mail' }), email);
  await typeInto(page.getByRole('textbox', { name: 'Passwort' }), password);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
}

test('a signed-out /more/invites link goes through sign-in and opens Einladungen', async ({ page, browser }) => {
  const email = newEmail('link-invites');
  await signUpWithHousehold(page, email);

  const fresh = await (await browser.newContext()).newPage();
  await fresh.goto('/more/invites');
  await expect(fresh).toHaveURL(/\/login\?next=(%2F|\/)more(%2F|\/)invites$/);
  await screenshot(fresh, 'deep-links-01-login-with-next');
  await signIn(fresh, email);
  // A new install asks about analytics first, then continues to the link.
  await answerConsent(fresh);
  await expect(fresh).toHaveURL(/\/more\/invites$/);
  await expect(fresh.getByRole('button', { name: 'Neue Einladung' })).toBeVisible();
  await screenshot(fresh, 'deep-links-02-invites-after-sign-in');
});

test('a signed-out link survives onboarding for a new account', async ({ page }) => {
  await signUp(page, newEmail('link-onboarding'), '/more/settings');
  await expect(page).toHaveURL(/\/welcome\?next=(%2F|\/)more(%2F|\/)settings$/);
  await page.getByRole('button', { name: /^Haushalt erstellen/ }).click();
  await page.getByRole('button', { name: 'Überspringen', exact: true }).click();
  await expect(page).toHaveURL(/\/more\/settings$/);
});

test('/add opens the list with the add sheet; /list and unknown paths open the list', async ({ page }) => {
  await signUpWithHousehold(page, newEmail('link-add'));

  await page.goto('/add');
  await expect(page).toHaveURL(/\/$/);
  await expect(addSheet(page)).toBeVisible();
  await expect(addField(page)).toBeFocused();
  await screenshot(page, 'deep-links-03-add-sheet');

  for (const path of ['/list', '/does/not/exist']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/$/);
    await expect(addField(page)).toBeVisible();
    await expect(addSheet(page)).toHaveCount(0);
  }
});

test('/stores/<id> opens the list at that store, unfolded', async ({ page }) => {
  const email = newEmail('link-store');
  await signUpWithHousehold(page, email);
  const api = await apiAs(email);
  const { data: stores } = await api.from('stores').select('id, name, household_id');
  const { data: categories } = await api.from('categories').select('id, name');
  const store = (name: string) => stores!.find((s) => s.name === name)!;
  const category = categories!.find((c) => c.name === 'Vorrat & Konserven')!.id;
  // Enough rows above Edeka that its section starts below the window.
  const rows = [
    ...Array.from({ length: 14 }, (_, i) => ({ name: `Dose ${i + 1}`, store: 'dm' })),
    ...Array.from({ length: 14 }, (_, i) => ({ name: `Glas ${i + 1}`, store: 'Lidl' })),
    { name: 'Nudeln', store: 'Edeka' },
  ];
  const { error } = await api.from('items').insert(rows.map((r, i) => ({
    household_id: stores![0].household_id, name: r.name, store_id: store(r.store).id, category_id: category, sort_key: i,
  })));
  if (error) throw error;
  await page.reload();
  await expect(itemRow(page, 'Dose 1')).toBeVisible();
  await expect(storeDivider(page, 'Edeka')).not.toBeInViewport();

  await page.goto(`/stores/${store('Edeka').id}`);
  await expect(page).toHaveURL(/\/$/);
  await expect(storeDivider(page, 'Edeka')).toBeInViewport();
  await expect(itemRow(page, 'Nudeln')).toBeInViewport();
  await screenshot(page, 'deep-links-04-store');

  // A folded store unfolds for its link.
  await storeDivider(page, 'Edeka').click();
  await expect(itemRow(page, 'Nudeln')).toHaveCount(0);
  await page.goto('/');
  await page.goto(`/stores/${store('Edeka').id}`);
  await expect(itemRow(page, 'Nudeln')).toBeInViewport();

  // Another household's or a deleted store: just the list.
  await page.goto('/stores/00000000-0000-4000-8000-000000000000');
  await expect(page).toHaveURL(/\/$/);
  await expect(addField(page)).toBeVisible();
});
