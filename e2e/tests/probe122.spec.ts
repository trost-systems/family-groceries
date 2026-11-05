import { expect, test, type Page } from './fixtures';
import { addItem, editField, editSheet, newEmail, openEdit, signUpWithHousehold } from './helpers';

const active = (page: Page) => page.evaluate(() => {
  const a = document.activeElement as HTMLElement | null;
  return a ? `${a.tagName} ${a.getAttribute('aria-label') ?? ''} ${a.getAttribute('role') ?? ''}`.trim() : 'none';
});

async function focusedAfterClick(page: Page, label: string, waitMs: number): Promise<string> {
  const field = editField(page, 'Menge');
  if (waitMs) await page.waitForTimeout(waitMs);
  await field.click();
  const seen: string[] = [];
  for (let i = 0; i < 10; i++) {
    seen.push(await active(page));
    await page.waitForTimeout(100);
  }
  const ok = await field.evaluate((e) => e === document.activeElement).catch(() => false);
  return `${label} wait=${waitMs}: focused=${ok} trail=${[...new Set(seen)].join(' | ')}`;
}

for (const waitMs of [0, 2_000]) {
  test(`probe: Menge after a stepper, wait ${waitMs}`, async ({ page }) => {
    await signUpWithHousehold(page, newEmail('probe'));
    await addItem(page, 'Milch');
    await expect(page.getByText('Wird einsortiert')).toHaveCount(0);
    await openEdit(page, 'Milch');
    const lines: string[] = [];
    lines.push(await focusedAfterClick(page, 'no stepper yet', waitMs));
    await editSheet(page).getByRole('button', { name: 'Eins mehr' }).click();
    lines.push(`after Eins mehr click: ${await active(page)}`);
    lines.push(await focusedAfterClick(page, 'after Eins mehr', waitMs));
    lines.push(await focusedAfterClick(page, 'again', 0));
    await editSheet(page).getByRole('button', { name: 'Eins mehr' }).click();
    await page.mouse.move(5, 5);
    lines.push(await focusedAfterClick(page, 'after Eins mehr, mouse moved away', waitMs));
    await editField(page, 'Marke').click();
    lines.push(await focusedAfterClick(page, 'after Marke', waitMs));
    console.log(lines.join('\n'));
  });
}
