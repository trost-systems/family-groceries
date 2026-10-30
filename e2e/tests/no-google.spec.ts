import { expect, test } from './fixtures';
import {
  addField,
  addSheet,
  answerConsent,
  fakeCollector,
  itemRow,
  newEmail,
  password,
  screenshot,
  supabaseUrl,
  typeInto,
} from './helpers';
import { householdWithItems } from './web-build';

// Job 33c (legal review H-02): the web app sends nothing to Google. The engine (CanvasKit or
// skwasm) and every font, the fallback fonts for emoji and non-Latin scripts included, come
// from our own origin. Runs in Chromium (wasm), Firefox and WebKit (JS and CanvasKit), under
// the production Content-Security-Policy (e2e/serve.mjs --csp).

const items = ['🍎 Äpfel', 'Brötchen für Grüße', '牛奶', 'خبز', 'Молоко', '🧀 Käse'];
const posthog = 'posthog.invalid';
const google = /(^|\.)(gstatic\.com|googleapis\.com|google\.com|google\.[a-z.]+)$/;

test('no request leaves for Google: login, sign-in, a list in many scripts, the add sheet', async ({ page, context, browserName, baseURL }) => {
  const email = newEmail('no-google');
  await householdWithItems(email, items);
  await fakeCollector(context);

  const requests: URL[] = [];
  // WebKit also reports data: and blob: URLs, which never reach the network.
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (/^(https?|wss?):$/.test(url.protocol)) requests.push(url);
  });
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { cspViolations: string[] }).cspViolations = seen;
    document.addEventListener('securitypolicyviolation', (e) => seen.push(`${e.violatedDirective} ${e.blockedURI}`));
  });

  await page.goto('/');
  await typeInto(page.getByRole('textbox', { name: 'E-Mail' }), email);
  await screenshot(page, `33c-${browserName}-login`);
  await typeInto(page.getByRole('textbox', { name: 'Passwort' }), password);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nutzungsdaten' })).toBeVisible();
  expect(requests.filter((url) => url.host === posthog).map(String), 'PostHog before consent').toEqual([]);
  await answerConsent(page, 'accept');

  for (const name of items) await expect(itemRow(page, name)).toBeVisible({ timeout: 30_000 });
  const fonts = () => requests.filter((url) => url.pathname.startsWith('/fonts/')).map((url) => url.pathname);
  // The engine fetched a fallback font for each script Roboto lacks, from us.
  for (const font of [/^\/fonts\/notocoloremoji\//, /^\/fonts\/notosans(sc|tc|hk|jp|kr)\//, /^\/fonts\/notosansarabic\//]) {
    await expect.poll(() => fonts().some((path) => font.test(path)), { message: `fetched ${font}` }).toBe(true);
  }
  await screenshot(page, `33c-${browserName}-list`);

  await addField(page).click();
  await expect(addSheet(page)).toBeVisible();
  await typeInto(addField(page), '🍐 Birne 梨');
  await expect(addSheet(page).getByRole('button', { name: /, Wie getippt(,|$)/ })).toBeVisible();
  await screenshot(page, `33c-${browserName}-add-sheet`);

  const own = new URL(baseURL!).host;
  const allowed = new Set([own, new URL(supabaseUrl).host, posthog]);
  const hosts = [...new Set(requests.map((url) => url.host))].sort();
  console.log(`HOSTS ${browserName} ${hosts.map((h) => `${h}=${requests.filter((url) => url.host === h).length}`).join(' ')}`);
  expect(requests.filter((url) => google.test(url.hostname)).map(String), 'requests to Google').toEqual([]);
  expect(hosts.filter((h) => !allowed.has(h)), 'hosts besides ours, Supabase and PostHog').toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations), 'CSP violations').toEqual([]);
});
