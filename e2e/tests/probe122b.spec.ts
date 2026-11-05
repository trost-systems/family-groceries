import { expect, test, type Page } from './fixtures';
import { addField, addSheet, newEmail, signUpWithHousehold } from './helpers';

const focused = (page: Page) => addField(page).evaluate((e) => e === document.activeElement).catch(() => false);

test('probe: the add field after its clear button', async ({ page }) => {
  await signUpWithHousehold(page, newEmail('probe-clear'));
  await addField(page).click();
  await expect(addSheet(page)).toBeVisible();
  const lines: string[] = [];
  for (const [label, hoverMs] of [['click X at once', 0], ['hover X 700 ms, then click', 700]] as const) {
    await addField(page).click();
    await page.keyboard.insertText('abc');
    const clear = page.getByRole('button', { name: 'Eingabe leeren' });
    await expect(clear).toBeVisible();
    if (hoverMs) { await clear.hover(); await page.waitForTimeout(hoverMs); }
    await clear.click();
    const trail: string[] = [];
    for (let i = 0; i < 12; i++) { trail.push(String(await focused(page))); await page.waitForTimeout(50); }
    await page.keyboard.insertText('Milch');
    await page.waitForTimeout(300);
    const value = await addField(page).inputValue().catch(() => '?');
    lines.push(`${label}: focus trail=${[...new Set(trail)].join('>')} (${trail.join('')}) typed after → "${value}" focused=${await focused(page)}`);
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
  }
  console.log(lines.join('\n'));
});
