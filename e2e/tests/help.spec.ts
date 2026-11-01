import { expect, type Locator, test, type Page } from './fixtures';
import { newEmail, screenshot, signUpWithHousehold, wheelTo } from './helpers';

// Job 24: More -> "Hilfe & Kontakt" opens the help page on hummlist.com in a new browser tab, by
// UI language. The page is a draft until Peter approves it, so release builds hide the row; the
// e2e build shows it (LEGAL_DRAFTS in app/config/e2e.json), as debug builds do.

/** Answers hummlist.com locally: the test must not depend on the live site. */
async function stubSite(page: Page): Promise<void> {
  await page.context().route('https://hummlist.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>stub</title>' }));
}

async function opensInNewTab(page: Page, row: Locator, url: string): Promise<void> {
  const before = page.url();
  const popup = page.waitForEvent('popup');
  await row.click();
  const tab = await popup;
  await expect.poll(() => tab.url(), { message: 'the help page opens in its own tab' }).toBe(url);
  expect(page.url(), 'the app stays where it was, not routed inside Flutter').toBe(before);
  await tab.close();
}

test('Hilfe & Kontakt opens the German help page outside the app', async ({ page }) => {
  await stubSite(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await signUpWithHousehold(page, newEmail('help'));
  await page.getByRole('tab', { name: 'Mehr' }).click();
  await expect(page.getByRole('heading', { name: 'Mehr' })).toBeVisible();

  const help = page.getByRole('button', { name: /^Hilfe & Kontakt/ });
  await wheelTo(page, help);
  await expect(help).toContainText('Fragen, Anleitungen und unsere E-Mail-Adresse');
  await screenshot(page, 'job24-more-help-de-390');
  await opensInNewTab(page, help, 'https://hummlist.com/support');
  await page.setViewportSize({ width: 1366, height: 1024 });
  await wheelTo(page, help);
  await screenshot(page, 'job24-more-help-de-1366');
  await opensInNewTab(page, help, 'https://hummlist.com/support');
});

test('Help & contact opens the English help page in an English UI', async ({ page }) => {
  await stubSite(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await signUpWithHousehold(page, newEmail('help-en'));
  await page.getByRole('tab', { name: 'Mehr' }).click();
  await expect(page.getByRole('heading', { name: 'Mehr' })).toBeVisible();

  // Switch the UI to English (Einstellungen -> Sprache), back to More.
  await wheelTo(page, page.getByRole('button', { name: /^Einstellungen/ }));
  await page.getByRole('button', { name: /^Einstellungen/ }).click();
  await page.getByRole('button', { name: /^Sprache/ }).click();
  await page.getByRole('radio', { name: 'English', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Language' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'More' })).toBeVisible();
  const helpEn = page.getByRole('button', { name: /^Help & contact/ });
  await wheelTo(page, helpEn);
  await screenshot(page, 'job24-more-help-en-390');
  await opensInNewTab(page, helpEn, 'https://hummlist.com/en/support');

  // Wide: More's list beside a page, the row in it.
  await page.setViewportSize({ width: 1366, height: 1024 });
  await wheelTo(page, helpEn);
  await screenshot(page, 'job24-more-help-en-1366');
  await opensInNewTab(page, helpEn, 'https://hummlist.com/en/support');
});
