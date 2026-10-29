import { expect, test, type Page } from './fixtures';
import {
  addedNote, addField, addItem, addSheet, adminClient, apiAs, closeSheet, cutOff, itemRow, newEmail, screenshot,
  signUpWithHousehold, tick, typeInto,
} from './helpers';

const daysAgo = (days: number, hours = 0) => new Date(Date.now() - (days * 24 + hours) * 3_600_000).toISOString();

/** A row of the add sheet by its line and source: "2 l Milch, Schon mal gekauft, …", "6× Eier, Wieder fällig". */
const suggestion = (page: Page, line: string, source: string) =>
  addSheet(page).getByRole('button', { name: new RegExp(`^${line}, ${source}(,|$)`) });

test('typing offers what the household bought before; a tap adds it with its last quantity', async ({ page }) => {
  await signUpWithHousehold(page, newEmail('usuals'));
  await addItem(page, '2 l Milch');
  await addItem(page, 'Mineralwasser');
  await expect(itemRow(page, 'Milch')).toHaveAccessibleName(/^Milch 2 l/);
  await tick(page, 'Milch');
  await expect(itemRow(page, 'Milch')).toHaveCount(0);

  await typeInto(addField(page), 'Mi');
  const row = suggestion(page, '2 l Milch', 'Schon mal gekauft');
  await expect(row, 'a bought item is offered while typing').toBeVisible();
  await expect(
    addSheet(page).getByRole('button', { name: /^Mineralwasser,/ }),
    'an item already on the list is not offered',
  ).toHaveCount(0);
  await screenshot(page, '10-suggestion-chips');

  await row.click();
  await expect(addedNote(page, /^✓ Hinzugefügt: Milch\b/), 'a tap adds the row').toBeVisible();
  await expect(addField(page), 'the row leaves focus in the add field').toBeFocused();
  await expect(addField(page)).toHaveValue('');
  await expect(row).toHaveCount(0);

  await page.keyboard.insertText('Brot');
  await page.keyboard.press('Enter');
  await expect(addedNote(page, /^✓ Hinzugefügt: Brot\b/), 'Enter adds the next item').toBeVisible();
  await expect(addField(page)).toBeFocused();
  await closeSheet(page);
  await expect(itemRow(page, 'Milch'), 'added with the quantity it was bought in').toHaveAccessibleName(/^Milch 2 l/);
  await expect(itemRow(page, 'Brot')).toBeVisible();
});

test('suggestions come from the device cache when Supabase is unreachable', async ({ page }) => {
  await signUpWithHousehold(page, newEmail('usuals-offline'));
  await addItem(page, '6 Eier');
  await tick(page, 'Eier');
  await typeInto(addField(page), 'Ei');
  await expect(suggestion(page, '6× Eier', 'Schon mal gekauft')).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /\blist\./.test(k));
    let value = key && JSON.parse(localStorage.getItem(key)!);
    if (typeof value === 'string') value = JSON.parse(value);
    return value?.usuals?.length ?? 0;
  }), { message: 'the usuals are in the list snapshot' }).toBe(1);

  await cutOff(page);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Zuletzt gekauft' }), 'the cached list is back').toBeVisible();
  await typeInto(addField(page), 'ei');
  await suggestion(page, '6× Eier', 'Schon mal gekauft').click();
  await expect(addField(page)).toBeFocused();
  await closeSheet(page);
  await expect(itemRow(page, 'Eier'), 'added offline from a cached suggestion').toHaveAccessibleName(/^Eier 6/);
});

test('with the field empty, what is due again is offered; a tap adds it and typing goes on', async ({ page }) => {
  const email = newEmail('usuals-due');
  await signUpWithHousehold(page, email);
  await addItem(page, '4 Brötchen');
  await expect(itemRow(page, 'Brötchen')).toHaveAccessibleName(/^Brötchen 4/);
  await tick(page, 'Brötchen');
  await expect(itemRow(page, 'Brötchen')).toHaveCount(0);
  // What is due shows in the sheet while the field is empty; a tap on the field opens it.
  await addField(page).click();
  await expect(addSheet(page)).toBeVisible();
  await expect(suggestion(page, '4× Brötchen', 'Wieder fällig'), 'one purchase is not a usual interval yet').toHaveCount(0);
  await closeSheet(page);

  // Two purchases a week apart, the last a week ago: history only the server writes.
  const api = await apiAs(email);
  const { data: item } = await api.from('items').select('id, household_id').eq('name', 'Brötchen').single();
  const events = adminClient().from('item_events');
  expect((await events.update({ created_at: daysAgo(7) }).eq('item_id', item!.id).eq('action', 'bought')).error).toBeNull();
  expect((await events.update({ created_at: daysAgo(7, 1) }).eq('item_id', item!.id).eq('action', 'added')).error).toBeNull();
  expect((await events.insert([
    { household_id: item!.household_id, item_id: item!.id, action: 'added', item_name: 'Brötchen', created_at: daysAgo(14, 1) },
    { household_id: item!.household_id, item_id: item!.id, action: 'bought', item_name: 'Brötchen', created_at: daysAgo(14) },
  ])).error).toBeNull();

  await page.reload();
  await expect(addField(page)).toBeFocused();
  await addField(page).click();
  const due = suggestion(page, '4× Brötchen', 'Wieder fällig');
  await expect(due, 'the usual week has passed').toBeVisible();
  await screenshot(page, '11-due-suggestions');

  await due.click();
  await expect(addedNote(page, /^✓ Hinzugefügt: Brötchen\b/), 'a tap adds it').toBeVisible();
  await expect(addSheet(page).getByRole('button', { name: /, Wieder fällig(,|$)/ }), 'nothing else is due').toHaveCount(0);
  await expect(addField(page), 'the row leaves focus in the add field').toBeFocused();
  await page.keyboard.insertText('Butter');
  await page.keyboard.press('Enter');
  await expect(addedNote(page, /^✓ Hinzugefügt: Butter\b/), 'Enter adds the next item').toBeVisible();
  await expect(addField(page)).toBeFocused();
  await closeSheet(page);
  await expect(itemRow(page, 'Brötchen'), 'added with its usual quantity').toHaveAccessibleName(/^Brötchen 4/);
  await expect(itemRow(page, 'Butter')).toBeVisible();
});
