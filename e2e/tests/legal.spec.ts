import { expect, test, type Page } from './fixtures';
import { screenshot } from './helpers';

// Job 33b (legal review H-07): Impressum and Datenschutz are reachable before anyone signs in,
// below the sign-in form and without scrolling. Both open hummlist.com in a new tab.

const pages = {
  de: {
    locale: 'de-DE',
    links: [
      ['Impressum', 'https://hummlist.com/impressum'],
      ['Datenschutz', 'https://hummlist.com/datenschutz'],
    ],
  },
  en: {
    locale: 'en-US',
    links: [
      ['Imprint', 'https://hummlist.com/en/imprint'],
      ['Privacy', 'https://hummlist.com/en/privacy'],
    ],
  },
} as const;

/** Answers hummlist.com inside [page]'s context, so following a link never leaves the machine. */
async function stubSite(page: Page): Promise<void> {
  await page.context().route('https://hummlist.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>hummlist.com</title>' }));
}

for (const [lang, { locale, links }] of Object.entries(pages)) {
  test.describe(lang, () => {
    test.use({ locale });

    for (const viewport of [{ width: 360, height: 640 }, { width: 1280, height: 720 }]) {
      test(`the login screen links the imprint and the privacy policy (${viewport.width} px)`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await stubSite(page);
        await page.goto('/');
        await expect(page).toHaveURL(/\/login/);
        for (const [name, href] of links) {
          const link = page.getByRole('link', { name, exact: true });
          await expect(link, `${name} without scrolling`).toBeInViewport();
          await expect(link).toHaveAttribute('href', href);
        }
        await screenshot(page, `legal-01-login-footer-${lang}-${viewport.width}`);

        for (const [name, href] of links) {
          const popup = page.waitForEvent('popup');
          await page.getByRole('link', { name, exact: true }).click();
          const tab = await popup;
          expect(tab.url(), `${name} opens in a new tab`).toBe(href);
          await tab.close();
          await expect(page, 'the app stays on the login').toHaveURL(/\/login/);
        }
      });
    }
  });
}
