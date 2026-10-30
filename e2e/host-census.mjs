// Which hosts a clean browser contacts when it opens the web app, per engine (job 33c, legal
// review H-02: nothing may go to Google before consent).
// Usage: node e2e/host-census.mjs <url> [chromium,firefox,webkit]
// It types emoji and non-Latin text into the login form's e-mail field (never submitted), so the
// engine fetches its fallback fonts too.
// Prints one line per browser and host with the request count, every request to a Google host
// and every Content-Security-Policy violation; exits 1 if there was either.
import { chromium, firefox, webkit } from '@playwright/test';

const [url, names = 'chromium,firefox,webkit'] = process.argv.slice(2);
if (!url) {
  console.error('usage: node e2e/host-census.mjs <url> [chromium,firefox,webkit]');
  process.exit(2);
}
const engines = { chromium, firefox, webkit };
const google = /(^|\.)(gstatic\.com|googleapis\.com|google\.com|fonts\.google[^.]*\.[a-z]+)$/;

let found = false;
for (const name of names.split(',')) {
  const browser = await engines[name].launch();
  const page = await browser.newPage({ locale: 'de-DE' });
  const hosts = new Map();
  const googleUrls = [];
  page.on('request', (request) => {
    const host = new URL(request.url()).host;
    hosts.set(host, (hosts.get(host) ?? 0) + 1);
    if (google.test(host.split(':')[0])) googleUrls.push(request.url());
  });
  await page.addInitScript(() => {
    window.cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => window.cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await page.goto(url);
  await page.locator('flt-semantics-host, flutter-view').first().waitFor({ state: 'attached', timeout: 60_000 });
  const field = page.getByRole('textbox', { name: 'E-Mail' });
  await field.click();
  await page.keyboard.insertText('🍎 Äpfel 牛奶 خبز Молоко');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3_000);
  await page.screenshot({ path: `${process.env.CENSUS_SCREENSHOTS ?? '/tmp'}/census-${name}.png` });
  const violations = await page.evaluate(() => window.cspViolations);
  await browser.close();
  for (const [host, count] of [...hosts].sort()) console.log(`${name}\t${host}\t${count}`);
  for (const request of googleUrls) console.log(`${name}\tGOOGLE\t${request}`);
  for (const violation of violations) console.log(`${name}\tCSP\t${violation}`);
  found ||= googleUrls.length > 0 || violations.length > 0;
}
process.exit(found ? 1 : 0);
