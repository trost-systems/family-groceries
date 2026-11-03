import { expect, test } from './fixtures';
import { dragHandle, groupHeadings, openStoreDetails, sectionHeadings, setStore, storeOf } from './catalog';
import {
  addedNote, addField, addItem, closeSheet, createInviteCode, enterItem, itemRow, joinWithCode, newEmail, openEdit,
  openTab, pickInSheet, saveEdit, screenshot, signUp, signUpWithHousehold, chainStores, storeDivider, tick, typeInto, within,
} from './helpers';

/** The route order of the categories the test's items land in under "Ohne Laden" (Zahnpasta's 👶 Drogerie goes to dm). */
const route = [
  'Obst & Gemüse', 'Brot & Backwaren', 'Kühlregal', 'Fleisch/Wurst/Fisch', 'Süßes & Snacks', 'Tiefkühl', 'Haushalt',
];

test('STORE ORDERING: each store section walks its own order, editable on its layout screen, with item->store memory', async ({ page }) => {
  // The longest journey (eight adds, a dozen moves in the edit sheet, a reload): it took 46-55 s of the default 60 s
  // on main, and the add sheet's open and close add a few seconds.
  test.setTimeout(120_000);
  await signUpWithHousehold(page, newEmail('stores'), { stores: chainStores });
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
    await setStore(page, item, 'Lidl');
    await expect.poll(() => storeOf(page, item)).toBe('Lidl');
  }
  await setStore(page, 'Chips', 'Lidl');
  await expect.poll(() => sectionHeadings(page, 'Lidl'), { message: 'Lidl: bake station first' }).toEqual([
    'Brot & Backwaren', 'Obst & Gemüse', 'Kühlregal', 'Fleisch/Wurst/Fisch', 'Süßes & Snacks', 'Tiefkühl',
  ]);
  await page.mouse.move(0, 899);
  await screenshot(page, '05-store-lidl');

  for (const item of ['Äpfel', 'Brot', 'Hack', 'Milch']) {
    await setStore(page, item, 'EDEKA');
    await expect.poll(() => storeOf(page, item)).toBe('EDEKA');
  }
  await expect.poll(() => sectionHeadings(page, 'EDEKA'), { message: 'EDEKA: counters before the chilled aisle' })
    .toEqual(['Obst & Gemüse', 'Brot & Backwaren', 'Fleisch/Wurst/Fisch', 'Kühlregal']);

  for (const item of ['Klopapier', 'Chips']) {
    await setStore(page, item, 'dm');
    await expect.poll(() => storeOf(page, item)).toBe('dm');
  }
  await expect.poll(() => sectionHeadings(page, 'dm'), { message: 'dm: drugstore first' }).toEqual([
    '👶 Drogerie', 'Süßes & Snacks', 'Haushalt',
  ]);
  await expect(storeDivider(page, 'Ohne Laden'), 'no store section once it is empty').toHaveCount(0);
  await page.mouse.move(0, 899);
  await screenshot(page, '06-store-dm');

  await openStoreDetails(page, 'EDEKA');
  await dragHandle(page, 'Kühlregal verschieben', 'Obst & Gemüse verschieben');
  await screenshot(page, '07-store-details');
  await openTab(page, 'Liste');
  await expect.poll(() => sectionHeadings(page, 'EDEKA'), { message: 'the reorder applies to the EDEKA section' })
    .toEqual(['Kühlregal', 'Obst & Gemüse', 'Brot & Backwaren', 'Fleisch/Wurst/Fisch']);
  await page.reload();
  await expect(addField(page)).toBeFocused();
  await expect.poll(() => sectionHeadings(page, 'EDEKA'), { message: 'the EDEKA order was saved' })
    .toEqual(['Kühlregal', 'Obst & Gemüse', 'Brot & Backwaren', 'Fleisch/Wurst/Fisch']);

  await tick(page, 'Hack');
  await expect(itemRow(page, 'Hack')).toHaveCount(0);
  await addItem(page, 'Hack');
  await expect.poll(() => storeOf(page, 'Hack'), { message: 'bought at EDEKA last time, so added there' })
    .toBe('EDEKA');
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
  // An own store without a researched layout walks the household's category order.
  await signUpWithHousehold(peter, newEmail('peter-cat'), { stores: ['Supermarkt'] });
  await addItem(peter, 'Spülmittel');
  await addItem(peter, 'Brot');
  await expect(itemRow(peter, 'Brot')).toBeVisible();
  await setStore(peter, 'Spülmittel', 'Supermarkt');
  await setStore(peter, 'Brot', 'Supermarkt');
  await expect.poll(() => storeOf(peter, 'Brot')).toBe('Supermarkt');
  const code = await createInviteCode(peter);
  await signUp(lea, newEmail('lea-cat'));
  await joinWithCode(lea, code);
  await expect(itemRow(lea, 'Spülmittel')).toBeVisible();
  await expect.poll(() => sectionHeadings(lea, 'Supermarkt')).toEqual(['Brot & Backwaren', 'Haushalt']);

  await openStoreDetails(peter, 'Supermarkt');
  await dragHandle(peter, 'Haushalt verschieben', 'Brot & Backwaren verschieben');
  await within(3_000, (timeout) => expect.poll(() => sectionHeadings(lea, 'Supermarkt'), { message: 'a store reorder in A reaches B', timeout })
    .toEqual(['Haushalt', 'Brot & Backwaren']));
  await peter.getByRole('button', { name: 'Zurück' }).click();

  await openStoreDetails(peter, null);
  await peter.getByRole('button', { name: 'Haushalt', exact: true }).click();
  await typeInto(peter.getByRole('textbox', { name: 'Name' }), 'Putzzeug');
  await peter.getByRole('button', { name: 'Speichern' }).click();
  await within(3_000, (timeout) => expect.poll(() => sectionHeadings(lea, 'Supermarkt'), { message: 'a rename in A reaches B', timeout })
    .toEqual(['Putzzeug', 'Brot & Backwaren']));
  await screenshot(lea, '09-live-catalog-sync');
});

test('categories: add, move an item there, rename, reorder, delete with reassignment', async ({ page }) => {
  // No stores: both items are under "Ohne Laden", so the headings below follow the route order alone.
  await signUpWithHousehold(page, newEmail('categories'));
  await addItem(page, 'Windeln');
  await addItem(page, 'Bier');
  await openStoreDetails(page, null);

  await page.getByRole('button', { name: 'Kategorie hinzufügen' }).click();
  await typeInto(page.getByRole('textbox', { name: 'Name' }), 'Baby');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('button', { name: 'Baby', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Kategorie hinzufügen' }).click();
  await typeInto(page.getByRole('textbox', { name: 'Name' }), 'Baby');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Eine Kategorie „Baby“ gibt es schon.').first()).toBeVisible();

  await dragHandle(page, 'Getränke verschieben', 'Obst & Gemüse verschieben');
  await screenshot(page, '10-no-store-details');
  await page.getByRole('button', { name: 'Zurück' }).click();
  await openTab(page, 'Liste');
  await expect.poll(() => groupHeadings(page), { message: 'the route order changed' })
    .toEqual(['Getränke', '👶 Drogerie']);

  await openEdit(page, 'Windeln');
  await pickInSheet(page, 'Kategorie', 'Baby');
  await saveEdit(page);
  await expect.poll(() => groupHeadings(page)).toEqual(['Getränke', 'Baby']);

  await openStoreDetails(page, null);
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
