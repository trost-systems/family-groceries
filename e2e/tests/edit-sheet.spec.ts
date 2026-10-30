import { devices, expect, test, type Locator, type Page } from './fixtures';
import {
  actionSnackBar, addItem, apiAs, editField, editSheet, expectFieldValue, finger, itemRow, newEmail, nextFrames, openEdit, pickInSheet,
  saveEdit, screenshot, signUpWithHousehold, swipeLeft, typeInto,
} from './helpers';
import { householdWithItems, signIn } from './web-build';

type Row = Record<string, unknown>;

async function rowOf(email: string, name: string): Promise<Row> {
  const { data, error } = await (await apiAs(email)).from('items').select('*').eq('name', name).single();
  if (error) throw error;
  return data;
}

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error('not on screen');
  return { top: b.y, bottom: b.y + b.height, height: b.height };
}

/**
 * The sheet hugs its content: its top sits just above the header, its bottom just below the hint under Fertig.
 * Measured once the sheet holds still: it slides in and grows as a chip folds out, and boxes read a frame apart
 * during that disagree by up to the distance it moved.
 */
async function expectHugsContent(page: Page, why: string): Promise<void> {
  await expect.poll(async () => {
    const a = await box(editSheet(page));
    await nextFrames(page);
    const b = await box(editSheet(page));
    return Math.abs(a.top - b.top) + Math.abs(a.height - b.height);
  }, { message: `${why}: the sheet stops moving` }).toBeLessThan(0.5);
  const sheet = await box(editSheet(page));
  const cancel = await box(editSheet(page).getByRole('button', { name: 'Abbrechen' }));
  const done = await box(editSheet(page).getByRole('button', { name: 'Fertig' }));
  const viewport = page.viewportSize()!;
  expect(cancel.top - sheet.top, `${why}: no dead area above the header`).toBeLessThanOrEqual(24);
  expect(cancel.top - sheet.top).toBeGreaterThanOrEqual(0);
  // Below Fertig: 10 px, the one-line hint (13 px) and 16 px.
  expect(sheet.bottom - done.bottom, `${why}: no dead area below the buttons`).toBeLessThanOrEqual(56);
  expect(sheet.bottom - done.bottom).toBeGreaterThanOrEqual(20);
  expect(Math.abs(sheet.bottom - viewport.height), `${why}: the sheet sits on the bottom edge`).toBeLessThanOrEqual(2);
}

test('edit: right click opens prefilled fields; Fertig writes only what changed', async ({ page }) => {
  const email = newEmail('edit');
  await signUpWithHousehold(page, email);
  await addItem(page, 'Milch');
  await expect(page.getByText('Wird einsortiert')).toHaveCount(0);
  const before = await rowOf(email, 'Milch');

  await openEdit(page, 'Milch');
  await expectFieldValue(editField(page, 'Bezeichnung'), 'Milch');
  await expectFieldValue(editField(page, 'Marke'), '');
  await expectFieldValue(editField(page, 'Menge'), '');
  await expectFieldValue(editField(page, 'Eigenschaften'), '');
  await expect(editSheet(page).getByRole('button', { name: 'Laden: Ohne Laden' })).toBeVisible();
  await expect(editSheet(page).getByRole('button', { name: 'Kategorie: Kühlregal' })).toBeVisible();
  await expectHugsContent(page, 'opened');

  await typeInto(editField(page, 'Marke'), 'Weihenstephan');
  await editSheet(page).getByRole('button', { name: 'Eins mehr' }).click();
  await expectFieldValue(editField(page, 'Menge'), '2');
  await editSheet(page).getByRole('button', { name: 'Eins mehr' }).click();
  await editSheet(page).getByRole('button', { name: 'Eins weniger' }).click();
  await expectFieldValue(editField(page, 'Menge'), '2');
  await screenshot(page, 'edit-01-sheet');
  await saveEdit(page);

  await expect(itemRow(page, 'Milch'), 'the row shows brand and quantity').toHaveAccessibleName('Milch Weihenstephan 2');
  await page.reload();
  await expect(itemRow(page, 'Milch'), 'after a reload too').toHaveAccessibleName('Milch Weihenstephan 2');

  const after = await rowOf(email, 'Milch');
  const changed = Object.keys(after).filter((k) => JSON.stringify(after[k]) !== JSON.stringify(before[k])).sort();
  expect(changed, 'only Marke, Menge and the timestamp changed').toEqual(['brand', 'quantity', 'updated_at']);
  expect(after.brand).toBe('Weihenstephan');
  expect(after.quantity).toBe('2');
});

test('edit: the sheet is as tall as its content, also with a chip folded out', async ({ page }) => {
  await signUpWithHousehold(page, newEmail('edit-size'));
  await addItem(page, 'Glutenfreie Dinkel-Vollkorn-Toastbrötchen mit Sonnenblumenkernen');
  await openEdit(page, 'Glutenfreie Dinkel-Vollkorn-Toastbrötchen mit Sonnenblumenkernen');
  await expectHugsContent(page, 'closed chips');
  for (const name of [/^Laden: /, /^Kategorie: /, /^Abbrechen$/, /^Löschen$/, /^Eins mehr$/]) {
    expect((await box(editSheet(page).getByRole('button', { name }))).height, `${name} is a 44 px target`)
      .toBeGreaterThanOrEqual(44);
  }
  expect((await box(editSheet(page).getByRole('button', { name: 'Fertig' }))).height).toBeGreaterThanOrEqual(52);
  const closed = await box(editSheet(page));
  expect(closed.height, 'well under the screen: no fixed fraction').toBeLessThan(page.viewportSize()!.height * 0.7);

  await editSheet(page).getByRole('button', { name: /^Kategorie: / }).click();
  const option = editSheet(page).getByRole('button', { name: 'Getränke', exact: true });
  await expect(option).toBeVisible();
  await expect.poll(async () => (await box(editSheet(page))).height, { message: 'it grows by the options' })
    .toBeGreaterThan(closed.height + 40);
  await expectHugsContent(page, 'category chip open');
  await screenshot(page, 'edit-02-category-open');
  await option.click();
  await expect(editSheet(page).getByRole('button', { name: 'Kategorie: Getränke' })).toBeVisible();
  await expect.poll(async () => (await box(editSheet(page))).height, { message: 'and shrinks back' })
    .toBeLessThan(closed.height + 2);
  await saveEdit(page);
});

test('edit: a swipe to the left opens the sheet and the row stays; so does a hold that stays put; Löschen deletes with Undo', async ({ page }) => {
  await signUpWithHousehold(page, newEmail('edit-delete'));
  await addItem(page, 'Zahnpasta');
  await expect(page.getByText('Wird einsortiert')).toHaveCount(0);
  await expect(itemRow(page, 'Zahnpasta')).toBeVisible();
  const row = (await itemRow(page, 'Zahnpasta').boundingBox())!;

  // Job 29c: the swipe that used to delete now edits.
  await page.mouse.move(row.x + row.width - 30, row.y + row.height / 2);
  await page.mouse.down();
  // At a hand's pace: a press and release on a row within 200 ms is a click to the engine, which
  // ticks the item instead of sending the drag (DECISIONS 29c, 7).
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(row.x + row.width - 30 - ((row.width - 60) * i) / 12, row.y + row.height / 2);
    await page.waitForTimeout(25);
  }
  await page.mouse.up();
  await expect(editSheet(page), 'a swipe to the left opens edit').toBeVisible();
  await expectFieldValue(editField(page, 'Bezeichnung'), 'Zahnpasta');
  await editSheet(page).getByRole('button', { name: 'Abbrechen' }).click();
  await expect(editSheet(page)).toHaveCount(0);
  await expect(itemRow(page, 'Zahnpasta'), 'the swipe deleted nothing').toBeVisible();
  await expect.poll(async () => (await itemRow(page, 'Zahnpasta').boundingBox())?.x, { message: 'the row sprang back' }).toBe(row.x);

  await page.mouse.move(row.x + 120, row.y + row.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(450);
  await page.mouse.up();
  await expect(editSheet(page), 'hold and release opens edit').toBeVisible();
  await expectFieldValue(editField(page, 'Bezeichnung'), 'Zahnpasta');

  await pickInSheet(page, 'Laden', 'dm');
  await editSheet(page).getByRole('button', { name: 'Löschen' }).click();
  await expect(editSheet(page)).toHaveCount(0);
  await expect(itemRow(page, 'Zahnpasta')).toHaveCount(0);
  await actionSnackBar(page, 'Zahnpasta gelöscht').getByRole('button', { name: 'Rückgängig' }).click();
  await expect(itemRow(page, 'Zahnpasta')).toBeVisible();
  await page.reload();
  await expect(itemRow(page, 'Zahnpasta'), 'the undo re-created it on the server').toBeVisible();
});

test('edit: Abbrechen and an unchanged Fertig write nothing', async ({ page }) => {
  const email = newEmail('edit-nochange');
  await signUpWithHousehold(page, email);
  await addItem(page, 'Brot');
  await expect(page.getByText('Wird einsortiert')).toHaveCount(0);
  const before = await rowOf(email, 'Brot');
  await openEdit(page, 'Brot');
  await typeInto(editField(page, 'Marke'), 'Harry');
  await editSheet(page).getByRole('button', { name: 'Abbrechen' }).click();
  await expect(editSheet(page)).toHaveCount(0);
  await openEdit(page, 'Brot');
  await expectFieldValue(editField(page, 'Marke'), '');
  await saveEdit(page);
  await page.waitForTimeout(1_000);
  expect(await rowOf(email, 'Brot'), 'nothing was written').toEqual(before);
});

// Job 29c, Peter: on a phone's browser a hold "always triggers the move action", so a swipe to the
// left edits instead of deleting, and no item action needs a hold. Chrome on Android, real touch
// events (CDP); the iPhone case is in iphone.spec.ts.
test.describe('on a phone browser', () => {
  const { viewport, deviceScaleFactor, userAgent } = devices['Pixel 7'];
  test.use({ viewport, deviceScaleFactor, userAgent, isMobile: true, hasTouch: true });

  test('edit: a finger swipe opens the sheet, a hold that wobbles a little too; tick, edit and delete need no hold', async ({ page }) => {
    const email = newEmail('swipe-phone');
    await householdWithItems(email, ['Zahnpasta', 'Milch', 'Brot']);
    await page.goto('/');
    await signIn(page, email);
    const row = itemRow(page, 'Zahnpasta');
    const before = (await row.boundingBox())!;

    await swipeLeft(page, row, { onMove: () => screenshot(page, '29c-phone-swipe-mid') });
    await expect(editSheet(page), 'a finger swipe to the left opens edit').toBeVisible();
    await expectFieldValue(editField(page, 'Bezeichnung'), 'Zahnpasta');
    await screenshot(page, '29c-phone-swipe-sheet');
    await editSheet(page).getByRole('button', { name: 'Abbrechen' }).tap();
    await expect(editSheet(page)).toHaveCount(0);
    await expect.poll(async () => (await row.boundingBox())?.x, { message: 'the row sprang back' }).toBe(before.x);

    // A finger held still drifts: 12 px is still a hold, which edits, not a move.
    const mid = { x: before.x + before.width / 2, y: before.y + before.height / 2 };
    await finger(page, [mid, { x: mid.x + 7, y: mid.y + 10 }], { hold: 700, steps: 4, pause: 300 });
    await expect(editSheet(page), 'a hold that wobbles opens edit').toBeVisible();
    await editSheet(page).getByRole('button', { name: 'Abbrechen' }).tap();
    await expect(editSheet(page)).toHaveCount(0);

    // Move: the sheet's chips; delete: its Löschen; tick: a tap. No hold anywhere.
    await swipeLeft(page, itemRow(page, 'Milch'));
    await editSheet(page).getByRole('button', { name: /^Laden: / }).tap();
    await editSheet(page).getByRole('button', { name: 'Lidl', exact: true }).tap();
    await editSheet(page).getByRole('button', { name: 'Fertig' }).tap();
    await expect(editSheet(page)).toHaveCount(0);
    await expect.poll(async () => (await rowOf(email, 'Milch')).store_id, { message: 'moved to Lidl' }).not.toBeNull();

    await swipeLeft(page, itemRow(page, 'Zahnpasta'));
    await editSheet(page).getByRole('button', { name: 'Löschen' }).tap();
    await expect(actionSnackBar(page, 'Zahnpasta gelöscht')).toBeVisible();
    await expect(itemRow(page, 'Zahnpasta')).toHaveCount(0);

    await itemRow(page, 'Brot').tap();
    await expect(itemRow(page, 'Brot'), 'ticked').toHaveCount(0);
    await page.reload();
    await expect(itemRow(page, 'Milch'), 'the list loaded').toBeVisible({ timeout: 30_000 });
    await expect(itemRow(page, 'Zahnpasta'), 'deleted on the server').toHaveCount(0);
    await expect(itemRow(page, 'Brot'), 'ticked on the server').toHaveCount(0);
  });
});
