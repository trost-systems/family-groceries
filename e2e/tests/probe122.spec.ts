import { expect, test, type Page } from './fixtures';
import { addItem, editField, editSheet, newEmail, openEdit, signUpWithHousehold } from './helpers';

const active = (page: Page) => page.evaluate(() => {
  const a = document.activeElement as HTMLElement | null;
  return a ? `${a.tagName} ${a.getAttribute('aria-label') ?? ''} ${a.getAttribute('role') ?? ''}`.trim() : 'none';
});

/** Clicks Menge and reports the focus trail, and whether the clicked <input> is still the one in the DOM. */
async function clickMenge(page: Page, label: string, before?: (page: Page) => Promise<void>): Promise<string> {
  const field = editField(page, 'Menge');
  await field.evaluate((e) => { (window as unknown as { __menge: Element }).__menge = e; });
  if (before) await before(page);
  const t0 = Date.now();
  await field.click();
  const seen: string[] = [];
  for (let i = 0; i < 10; i++) {
    seen.push(`${Date.now() - t0}:${await active(page)}`);
    await page.waitForTimeout(50);
  }
  const same = await page.evaluate(() => {
    const old = (window as unknown as { __menge: Element }).__menge;
    const now = [...document.querySelectorAll('input,textarea')].filter((e) => e.getAttribute('aria-label') === 'Menge');
    return `old connected=${old.isConnected}, inputs named Menge=${now.length}, same=${now[0] === old}`;
  });
  const ok = await field.evaluate((e) => e === document.activeElement).catch(() => false);
  const trail = seen.filter((s, i) => i === 0 || s.split(':')[1] !== seen[i - 1].split(':')[1]);
  return `${label}: focused=${ok} ${same} trail=${trail.join(' | ')}`;
}

test('probe: Menge after a stepper', async ({ page }) => {
  await signUpWithHousehold(page, newEmail('probe'));
  await addItem(page, 'Milch');
  await expect(page.getByText('Wird einsortiert')).toHaveCount(0);
  await openEdit(page, 'Milch');
  const plus = editSheet(page).getByRole('button', { name: 'Eins mehr' });
  const lines: string[] = [];
  lines.push(await clickMenge(page, 'A no stepper yet'));
  await plus.click();
  lines.push(await clickMenge(page, 'B right after Eins mehr'));
  await plus.click();
  lines.push(await clickMenge(page, 'C hover Menge 600 ms first', async (p) => {
    await editField(p, 'Menge').hover();
    await p.waitForTimeout(600);
  }));
  await plus.click();
  lines.push(await clickMenge(page, 'D keyboard focus moved off the stepper first', async (p) => {
    await p.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await p.waitForTimeout(300);
  }));
  await plus.hover();
  await page.waitForTimeout(600);
  lines.push(await clickMenge(page, 'E hover only (no click) on Eins mehr, then Menge'));
  await editField(page, 'Marke').click();
  await page.waitForTimeout(300);
  await editSheet(page).getByRole('button', { name: 'Eins weniger' }).hover();
  await page.waitForTimeout(600);
  lines.push(await clickMenge(page, 'F from Marke, hover Eins weniger, then Menge'));
  console.log(lines.join('\n'));
});
