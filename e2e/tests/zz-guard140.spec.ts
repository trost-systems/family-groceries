import { expect, test } from './fixtures';
import { addField, addSheet as sheet, newEmail, signUpWithHousehold, typeInto } from './helpers';

test('after a close, a focus or click that skips pointer events opens the sheet', async ({ page }) => {
  await signUpWithHousehold(page, newEmail('sheet-no-pointer'));
  await typeInto(addField(page), 'Butter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toHaveCount(0);
  await addField(page).focus();
  await expect(sheet(page), 'a DOM focus opens it').toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toHaveCount(0);
  await addField(page).dispatchEvent('click');
  await expect(sheet(page), 'a click event without pointer events opens it').toBeVisible();
});
