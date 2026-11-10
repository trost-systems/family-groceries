import { expect, test, type Page } from './fixtures';
import { screenshot } from './helpers';

// Job 33b (legal review H-07): Impressum and Datenschutz are reachable before anyone signs in,
// below the sign-in form and without scrolling. Both open snacklist.app in a new tab. The guided
// start's first screen (job 168b), where a signed-out `/` lands, has them too.

const pages = {
  de: {
    locale: 'de-DE',
    links: [
      ['Impressum', 'https://snacklist.app/impressum'],
      ['Datenschutz', 'https://snacklist.app/datenschutz'],
    ],
  },
  en: {
    locale: 'en-US',
    links: [
      ['Imprint', 'https://snacklist.app/en/imprint'],
      ['Privacy', 'https://snacklist.app/en/privacy'],
    ],
  },
} as const;

/** Answers snacklist.app inside [page]'s context, so following a link never leaves the machine. */
async function stubSite(page: Page): Promise<void> {
  await page.context().route('https://snacklist.app/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>snacklist.app</title>' }));
}

for (const [lang, { locale, links }] of Object.entries(pages)) {
  test.describe(lang, () => {
    test.use({ locale });

    const screens = [['login screen', '/login', /\/login/], ['first screen', '/', /\/start$/]] as const;
    const viewports = [{ width: 360, height: 640 }, { width: 1280, height: 720 }];
    for (const [screen, path, url] of screens) for (const viewport of viewports) {
      test(`the ${screen} links the imprint and the privacy policy (${viewport.width} px)`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await stubSite(page);
        await page.goto(path);
        await expect(page).toHaveURL(url);
        for (const [name, href] of links) {
          const link = page.getByRole('link', { name, exact: true });
          await expect(link, `${name} without scrolling`).toBeInViewport();
          await expect(link).toHaveAttribute('href', href);
        }
        await screenshot(page, `legal-01-${path === '/' ? 'start' : 'login'}-footer-${lang}-${viewport.width}`);

        for (const [name, href] of links) {
          const popup = page.waitForEvent('popup');
          await page.getByRole('link', { name, exact: true }).click();
          const tab = await popup;
          expect(tab.url(), `${name} opens in a new tab`).toBe(href);
          await tab.close();
          await expect(page, `the app stays on the ${screen}`).toHaveURL(url);
        }
      });
    }
  });
}
