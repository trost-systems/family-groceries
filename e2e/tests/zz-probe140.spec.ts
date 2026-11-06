import { expect, test } from './fixtures';
import { addField, addItem, addSheet, newEmail, signUpWithHousehold } from './helpers';

test.beforeEach(async ({ page }) => {
  await signUpWithHousehold(page, newEmail('probe140'));
});

test('probe140 focus: after a close, a DOM focus on the field opens the sheet', async ({ page }) => {
  await addItem(page, 'Brot');
  await expect(addSheet(page)).toHaveCount(0);
  await addField(page).focus();
  await expect(addSheet(page)).toBeVisible({ timeout: 5_000 });
});

test('probe140 click event: after a close, a DOM click on the field opens the sheet', async ({ page }) => {
  await addItem(page, 'Brot');
  await expect(addSheet(page)).toHaveCount(0);
  await addField(page).dispatchEvent('click');
  await expect(addSheet(page)).toBeVisible({ timeout: 5_000 });
});
