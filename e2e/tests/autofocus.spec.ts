import { expect, test } from './fixtures';
import { addedNote, addField, addItem, closeSheet, itemRow, newEmail, screenshot, signUpWithHousehold } from './helpers';

test('on open the add field is focused and the list is visible above it', async ({ page }) => {
  await signUpWithHousehold(page, newEmail('focus'));
  await addItem(page, 'Bananen');
  await expect(itemRow(page, 'Bananen')).toBeVisible();

  await page.reload();

  await expect(addField(page)).toBeFocused();
  await expect(page.getByText('Obst & Gemüse')).toBeVisible();
  await expect(itemRow(page, 'Bananen')).toBeVisible();
  const field = (await addField(page).boundingBox())!;
  const item = (await itemRow(page, 'Bananen').boundingBox())!;
  expect(item.y + item.height, 'the list sits above the add field (design H: the field is at the bottom), on the same screen')
    .toBeLessThanOrEqual(field.y);

  await page.keyboard.type('Milch');
  await page.keyboard.press('Enter');
  await expect(addedNote(page, /^✓ Hinzugefügt: Milch\b/), 'Enter adds what was typed').toBeVisible();
  await expect(addField(page), 'Enter keeps focus for the next item').toBeFocused();
  await expect(addField(page)).toHaveValue('');
  await screenshot(page, '01-autofocus');
  await closeSheet(page);
  await expect(itemRow(page, 'Milch')).toBeVisible();
});
