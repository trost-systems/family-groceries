import { expect, test, type Locator, type Page } from './fixtures';
import {
  addField, adminClient, apiAs, itemRow, newEmail, nextFrames, screenshot, signUpWithHousehold, typeInto,
} from './helpers';

/** The open add sheet: a group whose rect is the sheet's content. */
const sheet = (page: Page) => page.getByRole('group', { name: 'Hinzufügen', exact: true });
const SOURCES = 'Wie getippt|Schon mal gekauft|Andere Packung|Andere Sorte|Andere Größe|Andere Marke|Aus dem Katalog|Wieder fällig';
/** The sheet's rows, first to last: "<qty> <name>, <source>, <brand>, <details…>, <store>". */
const rows = (page: Page) => sheet(page).getByRole('button', { name: new RegExp(`, (${SOURCES})(,|$)`) });
const listTab = (page: Page) => page.getByRole('tab', { name: 'Liste' });

type Box = { x: number; y: number; width: number; height: number };

/** Bought before: the history behind the measured cases (2, 4, 6 and 8 rows). */
async function seedHistory(email: string): Promise<string> {
  const api = await apiAs(email);
  const { data: household } = await api.from('households').select('id').single();
  for (const row of [
    { name: 'Windeln', brand: 'Pampers', properties: 'Größe 4, Big Pack' },
    { name: 'Windeln', brand: 'Pampers', properties: 'Größe 3, sensitiv' },
    { name: 'Windeln', brand: 'Huggies', properties: 'Größe 3' },
    { name: 'Windeln', brand: 'Babylove', properties: 'Größe 5' },
    { name: 'Butter', brand: null, properties: 'gesalzen' },
  ]) {
    const { error } = await api.from('items').insert({ household_id: household!.id, status: 'bought', ...row });
    if (error) throw error;
  }
  return household!.id as string;
}

/** The sheet's rect once it has held still for a few frames (Flutter animates on its canvas). */
async function settled(page: Page): Promise<Box> {
  let last = '';
  for (let i = 0; i < 60; i++) {
    await nextFrames(page);
    const box = JSON.stringify(await sheet(page).boundingBox());
    if (box === last && box !== 'null') return JSON.parse(box) as Box;
    last = box;
    await page.waitForTimeout(50);
  }
  throw new Error('the sheet kept moving');
}

const bottom = (box: Box) => box.y + box.height;

async function lastRowBottom(list: Locator): Promise<number> {
  const boxes = await list.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().bottom));
  return Math.max(...boxes);
}

async function dbItem(email: string, name: string) {
  const api = await apiAs(email);
  const { data } = await api.from('items')
    .select('name, brand, properties, quantity, status, store:stores(name)')
    .eq('name', name).eq('status', 'active');
  return data ?? [];
}

test('the sheet hugs its suggestions, grows with them up to the top and keeps the input still', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const email = newEmail('sheet');
  await signUpWithHousehold(page, email);
  await seedHistory(email);
  await page.reload();
  await expect(addField(page)).toBeFocused();
  await expect(listTab(page)).toBeVisible();
  const closed = (await addField(page).boundingBox())!;
  await screenshot(page, 'add-01-closed');

  for (const [query, count] of [['Spülmittel Pril', 2], ['Mi', 4], ['Butter', 6]] as const) {
    await typeInto(addField(page), query);
    await expect(rows(page)).toHaveCount(count);
    const box = await settled(page);
    const input = (await addField(page).boundingBox())!;
    expect(Math.abs(input.y - closed.y), `${query}: the input stays put`).toBeLessThanOrEqual(2);
    const band = input.y - (await lastRowBottom(rows(page)));
    expect(band, `${query}: no dead band between the last row and the input`).toBeLessThanOrEqual(24);
    expect(box.y, `${query}: below the top, so it does not scroll yet`).toBeGreaterThan(28 + 2);
    await expect(listTab(page), `${query}: the tabs are away while the sheet is open`).toBeHidden();
    if (count === 2) {
      expect(844 - box.y, 'two rows: at most half the screen, bar and tabs included').toBeLessThanOrEqual(844 / 2);
    }
    await screenshot(page, `add-${count}-${query.replace(/\W+/g, '-')}`);
  }

  await typeInto(addField(page), 'Windeln Pampers Größe 3');
  await expect(rows(page)).toHaveCount(8);
  await expect(rows(page).first()).toHaveAccessibleName('Windeln, Wie getippt, Pampers, Größe 3, dm');
  const eight = await settled(page);
  expect(Math.abs((await addField(page).boundingBox())!.y - closed.y), 'eight rows: the input stays put').toBeLessThanOrEqual(2);
  expect(closed.y - (await lastRowBottom(rows(page))), 'eight rows: no dead band').toBeLessThanOrEqual(24);
  await screenshot(page, 'add-8-Windeln-Pampers-Groesse-3');

  // The app's rows are one line shorter than the prototype's, so eight fit on 844 px; on a
  // 667 px phone (iPhone SE) the same eight reach the top and only then scroll.
  await page.setViewportSize({ width: 390, height: 667 });
  const full = await settled(page);
  expect(full.y, 'on a short screen the sheet reaches the top gap').toBeLessThanOrEqual(28 + 2);
  expect(full.height, 'and is shorter than its content on 844 px').toBeLessThan(eight.height);
  await screenshot(page, 'add-8-full-667');
  const firstBefore = (await rows(page).first().boundingBox())!;
  await page.mouse.move(195, full.y + full.height - 80);
  await page.mouse.wheel(0, 400);
  await expect.poll(async () => (await rows(page).first().boundingBox())?.y ?? -1000, { message: 'only now the rows scroll' })
    .toBeLessThan(firstBefore.y - 20);
  await page.setViewportSize({ width: 390, height: 844 });
  await settled(page);

  await sheet(page).getByRole('button', { name: 'Schließen' }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(listTab(page), 'the tabs come back after closing').toBeVisible();
  await expect(addField(page), 'closing clears what was typed: the field shows its hint again').toBeVisible();
  expect(Math.abs((await addField(page).boundingBox())!.y - closed.y), 'closed again: the input is where it was').toBeLessThanOrEqual(2);
});

test('with reduced motion the sheet changes size without animating', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await signUpWithHousehold(page, newEmail('sheet-still'));
  await typeInto(addField(page), 'Butter');
  await settled(page);
  const before = (await sheet(page).boundingBox())!;
  // From the settled rows to two: the frame that shows the two rows already has the new size.
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText('Spülmittel Pril');
  await expect(rows(page)).toHaveCount(2);
  const a = (await sheet(page).boundingBox())!;
  await nextFrames(page);
  const b = (await sheet(page).boundingBox())!;
  expect(a.height, 'it did change size').not.toBe(before.height);
  expect(b, 'two frames later it is where it was: no animation').toEqual(a);
  await page.keyboard.press('Escape');
  await nextFrames(page);
  await expect(sheet(page), 'and closes at once').toHaveCount(0);
});

test('a tap adds the row with every field; a chip pick applies to the tapped row; Enter takes the first', async ({ page }) => {
  const email = newEmail('sheet-add');
  await signUpWithHousehold(page, email);
  await seedHistory(email);
  await page.reload();
  await expect(addField(page)).toBeFocused();

  await typeInto(addField(page), 'Windeln Pampers Größe 3');
  const first = rows(page).first();
  await expect(first).toHaveAccessibleName('Windeln, Wie getippt, Pampers, Größe 3, dm');
  await first.click();
  await expect.poll(() => sheet(page).ariaSnapshot(), { message: 'the note says what was added where' })
    .toContain('✓ Hinzugefügt: Windeln → dm');
  await expect(addField(page), 'focus stays in the input').toBeFocused();
  await expect(addField(page)).toHaveValue('');
  await expect.poll(() => dbItem(email, 'Windeln')).toEqual([
    { name: 'Windeln', brand: 'Pampers', properties: 'Größe 3', quantity: null, status: 'active', store: { name: 'dm' } },
  ]);

  await typeInto(addField(page), 'Windeln Babylove');
  await expect(rows(page).first()).toHaveAccessibleName(/^Windeln, Wie getippt, Babylove/);
  await sheet(page).getByRole('button', { name: /^Laden: / }).click();
  await sheet(page).getByRole('button', { name: 'Lidl', exact: true }).click();
  await expect(sheet(page).getByRole('button', { name: 'Laden: Lidl' }), 'the chip shows the pick').toBeVisible();
  const alternative = rows(page).nth(1);
  const label = (await alternative.getAttribute('aria-label')) ?? (await alternative.innerText());
  await screenshot(page, 'add-chip-picked');
  await alternative.click();
  await expect.poll(async () => (await dbItem(email, 'Windeln')).length, { message: 'a second Windeln row' }).toBe(2);
  const added = (await dbItem(email, 'Windeln')).find((r) => r.brand !== 'Pampers' || r.properties !== 'Größe 3')!;
  expect(added.store, `the store pick applies to the tapped row (${label})`).toEqual({ name: 'Lidl' });

  await typeInto(addField(page), 'Butter');
  await page.keyboard.press('Enter');
  await expect.poll(() => dbItem(email, 'Butter'), { message: 'Enter adds the first row, as typed' })
    .toEqual([expect.objectContaining({ name: 'Butter', brand: null, properties: null })]);
  await expect(addField(page)).toBeFocused();
  await sheet(page).getByRole('button', { name: 'Rückgängig' }).click();
  await expect.poll(() => dbItem(email, 'Butter'), { message: 'Undo removes it again' }).toEqual([]);

  // Keyboard: Tab goes from the input to the rows (Flutter focus; the rows keep it off the DOM so
  // a tap never takes the input's text connection), and Enter on a row adds that row.
  await typeInto(addField(page), 'Butter');
  await expect(rows(page).nth(1)).toHaveAccessibleName(/^Butter, Schon mal gekauft, gesalzen/);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect.poll(() => dbItem(email, 'Butter'), { message: 'Tab, Tab, Enter adds the second row' })
    .toEqual([expect.objectContaining({ name: 'Butter', properties: 'gesalzen' })]);

  await page.keyboard.press('Escape');
  await expect(sheet(page)).toHaveCount(0);
  await expect(itemRow(page, 'Windeln').first(), 'the added rows are in the list').toBeVisible();
});

test('after a chip pick or Undo, typing goes on in the input without a click', async ({ page }) => {
  await signUpWithHousehold(page, newEmail('sheet-focus'));
  await typeInto(addField(page), 'Butter');
  await sheet(page).getByRole('button', { name: /^Laden: / }).click();
  await sheet(page).getByRole('button', { name: 'Lidl', exact: true }).click();
  // On web the input gets its focus back 50 ms after a tap (list_screen.dart, _refocusAfterTap).
  await page.waitForTimeout(150);
  await expect(addField(page)).toBeFocused();
  await page.keyboard.insertText(' Kerrygold');
  await expect(rows(page).first(), 'the text was kept and extended').toHaveAccessibleName(/^Butter, Wie getippt, Kerrygold/);
  await page.keyboard.press('Enter');
  await sheet(page).getByRole('button', { name: 'Rückgängig' }).click();
  await expect(sheet(page).getByRole('button', { name: 'Rückgängig' })).toHaveCount(0);
  await page.waitForTimeout(150);
  await expect(addField(page)).toBeFocused();
  await page.keyboard.insertText('Milch');
  await expect(rows(page).first(), 'Undo hands the input back').toHaveAccessibleName(/^Milch, Wie getippt/);
});

test('after Schließen, a tap on the field and typing open the sheet again', async ({ page }) => {
  await signUpWithHousehold(page, newEmail('sheet-close'));
  await typeInto(addField(page), 'Butter');
  await page.keyboard.press('Enter');
  await sheet(page).getByRole('button', { name: 'Schließen' }).click();
  await expect(sheet(page)).toHaveCount(0);
  await addField(page).click();
  await page.keyboard.type('Brot', { delay: 120 });
  await expect(rows(page).first(), 'the app gets the keys, not only the DOM input').toHaveAccessibleName(/^Brot, Wie getippt/);
});

test('with nothing typed, the open sheet offers what is due', async ({ page }) => {
  const email = newEmail('sheet-due');
  await signUpWithHousehold(page, email);
  const household = await seedHistory(email);
  const api = await apiAs(email);
  const { data: item } = await api.from('items').select('id').eq('name', 'Butter').single();
  const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
  const events = adminClient().from('item_events');
  expect((await events.insert([
    { household_id: household, item_id: item!.id, action: 'added', item_name: 'Butter', created_at: daysAgo(15) },
    { household_id: household, item_id: item!.id, action: 'bought', item_name: 'Butter', created_at: daysAgo(14) },
    { household_id: household, item_id: item!.id, action: 'added', item_name: 'Butter', created_at: daysAgo(8) },
    { household_id: household, item_id: item!.id, action: 'bought', item_name: 'Butter', created_at: daysAgo(7) },
  ])).error).toBeNull();
  await page.reload();
  await addField(page).click();
  await expect(sheet(page).getByRole('button', { name: /^Butter, Wieder fällig/ })).toBeVisible();
  await screenshot(page, 'add-due');
  await sheet(page).getByRole('button', { name: /^Butter, Wieder fällig/ }).click();
  await expect.poll(async () => (await dbItem(email, 'Butter')).length).toBe(1);
});
