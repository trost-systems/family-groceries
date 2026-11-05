import { expect, type Page, test } from './fixtures';
import { openStoreDetails, openStores, storeOf, storeRow } from './catalog';
import {
  addedNote, addField, addSheet, closeSheet, createInviteCode, joinWithCode, newEmail, openTab, screenshot, signUp,
  signUpWithHousehold, typeInto,
} from './helpers';

/** Adds a store with Liste → Anpassen's button. */
async function addStore(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Laden hinzufügen' }).click();
  await typeInto(page.getByRole('textbox', { name: 'Name des Ladens' }), name);
  await page.keyboard.press('Enter');
}

test('OWN STORE: made in the add sheet and picked at once, then renamed and deleted under Liste → Anpassen', async ({ page }) => {
  await signUpWithHousehold(page, newEmail('own-store'));
  await addField(page).click();
  await expect(addSheet(page)).toBeVisible();
  await typeInto(addField(page), 'Milch');
  await expect(addSheet(page).getByRole('button', { name: /, Wie getippt(,|$)/ })).toBeVisible();
  await page.getByRole('button', { name: /^Laden: / }).click();
  await page.getByRole('button', { name: 'Neuen Laden anlegen' }).click();
  const field = page.getByRole('textbox', { name: 'Name des Ladens' });
  await expect(field, 'focus moves into the new store\'s field').toBeFocused();
  await typeInto(field, 'Rewe');
  await screenshot(page, '58-01-picker-inline-field');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Laden: Rewe' }), 'created and picked').toBeVisible();
  await expect(field).toHaveCount(0);
  await expect(addField(page), 'focus is back in the add field').toBeFocused();
  await screenshot(page, '58-02-picker-created-selected');
  await page.keyboard.press('Enter');
  await expect(addedNote(page).first()).toBeVisible();
  await closeSheet(page);
  await expect.poll(() => storeOf(page, 'Milch'), { message: 'the item is under the Rewe divider' }).toBe('Rewe');

  await openStoreDetails(page, 'Rewe');
  await expect(page.getByText(/ verschieben$/), 'every category, like a preset store\'s layout').toHaveCount(11);

  // Job 78: the store is renamed at the top of its details.
  await page.getByRole('button', { name: 'Rewe umbenennen' }).click();
  const rename = page.getByRole('textbox', { name: 'Name des Ladens' });
  await expect(rename).toBeFocused();
  await typeInto(rename, 'Rewe Markt');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Rewe Markt', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Zurück' }).click();
  await expect(storeRow(page, 'Rewe Markt')).toBeVisible();
  await screenshot(page, '58-03-stores-renamed');

  await page.getByRole('button', { name: 'Rewe Markt löschen' }).click();
  await expect(page.getByText('1 offener Artikel kommt zu „Ohne Laden“. Sein Laufweg geht mit.')).toBeVisible();
  await screenshot(page, '58-04-stores-delete-confirm');
  await page.getByRole('button', { name: 'Löschen', exact: true }).click();
  await expect(storeRow(page, 'Rewe Markt')).toHaveCount(0);

  await openTab(page, 'Liste');
  await expect.poll(() => storeOf(page, 'Milch'), { message: 'the item has no store now' }).toBe('Ohne Laden');
});

test('OWN STORE: a store one member adds shows for the other at once, with its layout', async ({ browser }) => {
  const peter = await (await browser.newContext()).newPage();
  await signUpWithHousehold(peter, newEmail('peter-store'), { stores: ['Supermarkt'] });
  const code = await createInviteCode(peter);
  const lea = await (await browser.newContext()).newPage();
  await signUp(lea, newEmail('lea-store'));
  await joinWithCode(lea, code);
  await openStores(lea);
  await expect(storeRow(lea, 'Supermarkt')).toBeVisible();

  await openStores(peter);
  await addStore(peter, 'Kaufland');
  await expect(storeRow(peter, 'Kaufland')).toBeVisible();

  await expect(storeRow(lea, 'Kaufland'), 'live on the other phone, no reload').toBeVisible();
  await storeRow(lea, 'Kaufland').click();
  await expect(lea.getByRole('heading', { name: 'Kaufland', exact: true })).toBeVisible();
  await expect(lea.getByText(/ verschieben$/)).toHaveCount(11);
});

test('REFUSED STORE: the message shows above the open dialog, and goes with it (job 116)', async ({ page }) => {
  await signUpWithHousehold(page, newEmail('store-refused'));
  await openStores(page);
  await page.route('**/rest/v1/rpc/add_store', (route) => route.fulfill({ status: 500, json: { message: 'refused' } }));
  await addStore(page, 'Biomarkt');
  const field = page.getByRole('textbox', { name: 'Name des Ladens' });
  const message = page.getByText('Die Änderung konnte nicht gespeichert werden.', { exact: true }).last();
  await expect(message, 'above the barrier, in the semantics tree').toBeVisible();
  await expect(field, 'the dialog stays open to try again').toBeVisible();
  const box = await message.boundingBox();
  if (box === null) throw new Error('the message is not laid out');
  const hit = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.textContent ?? '',
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );
  expect(hit, 'nothing covers it').toContain('Die Änderung konnte nicht gespeichert werden.');
  await screenshot(page, '116-01-refusal-above-dialog');

  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(field).toHaveCount(0);
  // A message left above the routes would cover the tabs for its 4 s and take this click.
  await page.getByRole('tab', { name: 'Mehr', exact: true }).or(page.getByRole('button', { name: 'Mehr Tab ' }))
    .click({ timeout: 1500 });
  await expect(page).toHaveURL(/\/more/);
});
