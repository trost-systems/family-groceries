import { expect, type Page, test } from './fixtures';
import { dragHandle, dragItemToStore, groupHeadings, openStoreLayout, sectionHeadings, storeOf } from './catalog';
import {
  addedNote, addField, addItem, addSheet, closeSheet, createInviteCode, enterItem, itemRow, joinWithCode, newEmail, openEdit, openMore,
  openTab, pickInSheet, saveEdit, screenshot, signUp, signUpWithHousehold, storeDivider, tick, typeInto, within,
} from './helpers';

/** The route order of the categories the test's items land in under "Ohne Laden" (Zahnpasta's 👶 Drogerie goes to dm). */
const route = [
  'Obst & Gemüse', 'Brot & Backwaren', 'Kühlregal', 'Fleisch/Wurst/Fisch', 'Süßes & Snacks', 'Tiefkühl', 'Haushalt',
];

async function setStore(page: Page, item: string, store: string): Promise<void> {
  await openEdit(page, item);
  await pickInSheet(page, 'Laden', store);
  await saveEdit(page);
}

test('STORE ORDERING: each store section walks its own order, editable on its layout screen, with item->store memory', async ({ page }) => {
  // The longest journey (eight adds, a dozen drags, a reload): it took 46-55 s of the default 60 s
  // on main, and the add sheet's open and close add a few seconds.
  test.setTimeout(120_000);
  await signUpWithHousehold(page, newEmail('stores'));
  for (const item of ['Brot', 'Äpfel', 'Milch', 'Hack', 'Zahnpasta', 'Klopapier', 'Chips', 'Pizza']) {
    await enterItem(page, item);
  }
  await expect(addField(page), 'the list does not take focus from the add field').toBeFocused();
  await closeSheet(page);
  await expect(itemRow(page, 'Pizza')).toBeVisible();
  await expect.poll(() => sectionHeadings(page, 'Ohne Laden'), { message: 'no store: route order' }).toEqual(route);
  await expect.poll(() => storeOf(page, 'Zahnpasta'), { message: 'the add sheet\'s store guess puts a drugstore item in dm' })
    .toBe('dm');
  await expect(page.getByRole('checkbox', { name: 'Alle' }), 'no store filter chips').toHaveCount(0);

  for (const item of ['Brot', 'Äpfel', 'Milch', 'Hack', 'Pizza']) {
    await dragItemToStore(page, item, 'Lidl');
    await expect.poll(() => storeOf(page, item)).toBe('Lidl');
  }
  await setStore(page, 'Chips', 'Lidl');
  await expect.poll(() => sectionHeadings(page, 'Lidl'), { message: 'Lidl: bake station first' }).toEqual([
    'Brot & Backwaren', 'Obst & Gemüse', 'Kühlregal', 'Fleisch/Wurst/Fisch', 'Süßes & Snacks', 'Tiefkühl',
  ]);
  await page.mouse.move(0, 899);
  await screenshot(page, '05-store-lidl');

  for (const item of ['Äpfel', 'Brot', 'Hack', 'Milch']) {
    await dragItemToStore(page, item, 'Edeka');
    await expect.poll(() => storeOf(page, item)).toBe('Edeka');
  }
  await expect.poll(() => sectionHeadings(page, 'Edeka'), { message: 'Edeka: counters before the chilled aisle' })
    .toEqual(['Obst & Gemüse', 'Brot & Backwaren', 'Fleisch/Wurst/Fisch', 'Kühlregal']);

  for (const item of ['Klopapier', 'Chips']) {
    await dragItemToStore(page, item, 'dm');
    await expect.poll(() => storeOf(page, item)).toBe('dm');
  }
  await expect.poll(() => sectionHeadings(page, 'dm'), { message: 'dm: drugstore first' }).toEqual([
    '👶 Drogerie', 'Süßes & Snacks', 'Haushalt',
  ]);
  await expect(storeDivider(page, 'Ohne Laden'), 'no store section once it is empty').toHaveCount(0);
  await page.mouse.move(0, 899);
  await screenshot(page, '06-store-dm');

  await openStoreLayout(page, 'Edeka');
  await dragHandle(page, 'Kühlregal verschieben', 'Obst & Gemüse verschieben');
  await screenshot(page, '07-store-layout-editor');
  await page.getByRole('button', { name: 'Zurück' }).click();
  await expect.poll(() => sectionHeadings(page, 'Edeka'), { message: 'the reorder applies to the Edeka section' })
    .toEqual(['Kühlregal', 'Obst & Gemüse', 'Brot & Backwaren', 'Fleisch/Wurst/Fisch']);
  await page.reload();
  await expect(addField(page)).toBeFocused();
  await expect.poll(() => sectionHeadings(page, 'Edeka'), { message: 'the Edeka order was saved' })
    .toEqual(['Kühlregal', 'Obst & Gemüse', 'Brot & Backwaren', 'Fleisch/Wurst/Fisch']);

  await tick(page, 'Hack');
  await expect(itemRow(page, 'Hack')).toHaveCount(0);
  await addItem(page, 'Hack');
  await expect.poll(() => storeOf(page, 'Hack'), { message: 'bought at Edeka last time, so added there' })
    .toBe('Edeka');
  await enterItem(page, 'Zahnpasta');
  await expect(addedNote(page, 'Zahnpasta steht schon auf der Liste')).toBeVisible();
  await closeSheet(page);
  await tick(page, 'Zahnpasta');
  await addItem(page, 'Zahnpasta');
  await expect.poll(() => storeOf(page, 'Zahnpasta'), { message: 're-added, it is still a dm item' }).toBe('dm');
  await page.mouse.move(0, 899);
  await screenshot(page, '08-store-memory');
});

test('category and store layout changes sync live to the other member', async ({ browser }) => {
  const peter = await (await browser.newContext()).newPage();
  const lea = await (await browser.newContext()).newPage();
  await signUpWithHousehold(peter, newEmail('peter-cat'));
  await addItem(peter, 'Spülmittel');
  await addItem(peter, 'Brot');
  await expect(itemRow(peter, 'Brot')).toBeVisible();
  await dragItemToStore(peter, 'Spülmittel', 'Lidl');
  await dragItemToStore(peter, 'Brot', 'Lidl');
  await expect.poll(() => storeOf(peter, 'Brot')).toBe('Lidl');
  const code = await createInviteCode(peter);
  await signUp(lea, newEmail('lea-cat'));
  await joinWithCode(lea, code);
  await expect(itemRow(lea, 'Spülmittel')).toBeVisible();
  await expect.poll(() => sectionHeadings(lea, 'Lidl')).toEqual(['Brot & Backwaren', 'Haushalt']);

  await openStoreLayout(peter, 'Lidl');
  await dragHandle(peter, 'Haushalt verschieben', 'Brot & Backwaren verschieben');
  await within(3_000, (timeout) => expect.poll(() => sectionHeadings(lea, 'Lidl'), { message: 'a store reorder in A reaches B', timeout })
    .toEqual(['Haushalt', 'Brot & Backwaren']));
  await peter.getByRole('button', { name: 'Zurück' }).click();

  await openMore(peter, 'Kategorien verwalten');
  await peter.getByRole('button', { name: 'Haushalt', exact: true }).click();
  await typeInto(peter.getByRole('textbox', { name: 'Name' }), 'Putzzeug');
  await peter.getByRole('button', { name: 'Speichern' }).click();
  await within(3_000, (timeout) => expect.poll(() => sectionHeadings(lea, 'Lidl'), { message: 'a rename in A reaches B', timeout })
    .toEqual(['Putzzeug', 'Brot & Backwaren']));
  await screenshot(lea, '09-live-catalog-sync');
});

test('categories: add, move an item there, rename, reorder, delete with reassignment', async ({ page }) => {
  await signUpWithHousehold(page, newEmail('categories'));
  // The sheet would put Windeln in dm, its store guess; both items stay without a store, so the
  // headings below follow the route order alone.
  await addField(page).click();
  await typeInto(addField(page), 'Windeln');
  await addSheet(page).getByRole('button', { name: /^Laden: / }).click();
  await addSheet(page).getByRole('button', { name: 'Ohne Laden', exact: true }).click();
  await expect(addField(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(addedNote(page, /^✓ Hinzugefügt: Windeln$/)).toBeVisible();
  await closeSheet(page);
  await addItem(page, 'Bier');
  await openMore(page, 'Kategorien verwalten');

  await page.getByRole('button', { name: 'Kategorie hinzufügen' }).click();
  await typeInto(page.getByRole('textbox', { name: 'Name' }), 'Baby');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('button', { name: 'Baby', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Kategorie hinzufügen' }).click();
  await typeInto(page.getByRole('textbox', { name: 'Name' }), 'Baby');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Eine Kategorie „Baby“ gibt es schon.').first()).toBeVisible();

  await dragHandle(page, 'Getränke verschieben', 'Obst & Gemüse verschieben');
  await screenshot(page, '10-categories-screen');
  await page.getByRole('button', { name: 'Zurück' }).click();
  await openTab(page, 'Liste');
  await expect.poll(() => groupHeadings(page), { message: 'the route order changed' })
    .toEqual(['Getränke', '👶 Drogerie']);

  await openEdit(page, 'Windeln');
  await pickInSheet(page, 'Kategorie', 'Baby');
  await saveEdit(page);
  await expect.poll(() => groupHeadings(page)).toEqual(['Getränke', 'Baby']);

  await openMore(page, 'Kategorien verwalten');
  await page.getByRole('button', { name: 'Baby', exact: true }).click();
  await typeInto(page.getByRole('textbox', { name: 'Name' }), 'Babysachen');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('button', { name: 'Sonstiges löschen' }), 'the fallback cannot be deleted').toHaveCount(0);
  await page.getByRole('button', { name: 'Babysachen löschen' }).click();
  await page.getByRole('button', { name: /Artikel verschieben nach/ }).click();
  await page.getByRole('menuitem', { name: '👶 Drogerie' }).click();
  await page.getByRole('button', { name: 'Löschen', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Babysachen', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Zurück' }).click();
  await openTab(page, 'Liste');
  await expect.poll(() => groupHeadings(page), { message: 'the items moved to the chosen category' })
    .toEqual(['Getränke', '👶 Drogerie']);

  await page.reload();
  await expect(addField(page)).toBeFocused();
  await expect.poll(() => groupHeadings(page)).toEqual(['Getränke', '👶 Drogerie']);
});
