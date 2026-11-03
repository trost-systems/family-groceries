// The waitlist variations' preview (job 83, /internal/waitlist): every variant in both languages
// at 390 px (light and dark) and 1440 px. Proves the mock form never touches the network and
// walks through its states, the email field shows on a phone without scrolling, nothing links to
// the web app, axe finds nothing, and V4's rows end sorted. Saves screenshots to --out.
//
//   cd site && npm run build && cd checks && npm ci
//   flock /tmp/fg-e2e.lock node waitlist-variations.mjs ../dist --out /tmp/wv
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { AXE_PATH, parseArgs, serve } from './lib.mjs';

const { dist, port, out } = parseArgs({ port: 55993, out: 'waitlist-variations-out' });
const VARIANTS = ['v1', 'v2', 'v3', 'v4', 'v5'];
const LOCALES = ['de', 'en'];
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const EMAIL = { de: 'lea@beispiel.de', en: 'lea@example.com' };
const THANKS = { v1: { de: 'Bis dahin', en: 'Until then' }, v5: { de: 'Bis bald auf eurer Liste.', en: 'See you on your list soon.' } };

mkdirSync(out, { recursive: true });
const server = await serve(dist, port);
const browser = await chromium.launch();
const problems = [];
const check = (ok, where, what) => {
  if (!ok) problems.push(`${where}: ${what}`);
};

async function open(path, { width, scheme = 'light', reduced = 'reduce' }) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, colorScheme: scheme, reducedMotion: reduced });
  await ctx.addInitScript({ path: AXE_PATH });
  const page = await ctx.newPage();
  const requests = [];
  const errors = [];
  page.on('request', (r) => requests.push(r));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(server.origin + path, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page, requests, errors };
}

async function loadImages(page) {
  await page.evaluate(async () => {
    for (const img of document.images) img.loading = 'eager';
    await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((r) => (img.onload = img.onerror = r)))));
  });
}

async function shoot(page, name, { full = false } = {}) {
  if (full) {
    await loadImages(page);
  }
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: full });
}

const visible = (page, selector) => page.locator(selector).first().isVisible();

for (const id of VARIANTS) {
  for (const locale of LOCALES) {
    const path = `/internal/waitlist/${id}/${locale}`;
    const where = `${path} 390`;
    const { ctx, page, requests, errors } = await open(path, { width: 390 });

    for (const r of requests) check(r.url().startsWith(server.origin) && r.method() === 'GET', where, `request ${r.method()} ${r.url()}`);
    check((await page.locator('a[href*="app.hummlist.com"]').count()) === 0, where, 'links to app.hummlist.com');
    check((await page.locator('meta[name="robots"][content*="noindex"]').count()) === 1, where, 'no noindex meta');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), where, 'scrolls sideways');
    // The fold of the real page: the review strip on top is not part of it.
    const field = await page.locator('#wl-email').boundingBox();
    const bar = await page.locator('.rv-bar').boundingBox();
    const bottom = field.y + field.height - bar.height;
    check(bottom <= 844, where, `email field not above the fold (bottom at ${bottom} px without the review strip)`);
    const axe = await page.evaluate(async (tags) => {
      const res = await window.axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] });
      return res.violations.flatMap((v) => v.nodes.map((n) => `${v.id} ${n.target.join(' ')}`));
    }, AXE_TAGS);
    for (const v of axe) check(false, where, `axe ${v}`);
    await shoot(page, `${id}-${locale}-390-fold`);
    await shoot(page, `${id}-${locale}-390-full`, { full: true });

    // The mock: errors first, then the states. Nothing may be requested from here on.
    const before = requests.length;
    const submit = page.locator('.wl-submit');
    await submit.click();
    check(await visible(page, '#wl-email-error'), where, 'empty email shows no error');
    check((await page.locator('#wl-email').getAttribute('aria-invalid')) === 'true', where, 'empty email not aria-invalid');
    await page.fill('#wl-email', 'kein-at');
    await submit.click();
    const invalid = await page.locator('#wl-email-error').textContent();
    await page.fill('#wl-email', EMAIL[locale]);
    await submit.click();
    check(!(await visible(page, '#wl-email-error')), where, 'valid email still shows an error');
    check(await visible(page, '#wl-platform-error'), where, 'missing phone shows no error');
    await page.locator('.wl-form').scrollIntoViewIfNeeded();
    await shoot(page, `${id}-${locale}-390-errors`);
    check(invalid && invalid.trim() !== '', where, 'invalid email shows no message');
    await page.locator('input[name="platform"][value="ios"]').check();
    await submit.click();
    check((await page.locator('main').getAttribute('data-state')) === 'sending', where, 'no sending state');
    await page.locator('.wl-done').waitFor({ state: 'visible' });
    check((await page.locator('[data-email]').textContent()) === EMAIL[locale], where, 'inbox state does not name the email');
    check(await page.evaluate(() => document.activeElement?.classList.contains('wl-done')), where, 'focus not moved to the inbox state');
    await page.locator('.wl-done').scrollIntoViewIfNeeded();
    await shoot(page, `${id}-${locale}-390-inbox`);
    await page.locator('[data-goto="confirmed"]').click();
    check(await visible(page, '.wv-confirmed'), where, 'mock link shows no confirmed page');
    check(!(await visible(page, '.wv-blocks')), where, 'confirmed page still shows the landing');
    const thanks = THANKS[id]?.[locale];
    if (thanks) check((await page.locator('.wv-confirmed').textContent()).includes(thanks), where, `confirmed page lacks the variant line "${thanks}"`);
    await shoot(page, `${id}-${locale}-390-confirmed`);
    check(requests.length === before, where, `the mock requested ${requests.slice(before).map((r) => r.url()).join(', ')}`);
    check(errors.length === 0, where, `console: ${errors.join(' | ')}`);
    await ctx.close();

    const known = await open(`${path}?s=known`, { width: 390 });
    check(await visible(known.page, '.wl-status [data-when="known"]'), `${path}?s=known`, 'no "already on the list" message');
    await known.ctx.close();

    const dark = await open(path, { width: 390, scheme: 'dark' });
    await shoot(dark.page, `${id}-${locale}-390-dark`);
    await dark.ctx.close();

    const wide = await open(path, { width: 1440 });
    check(await wide.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} 1440`, 'scrolls sideways');
    await shoot(wide.page, `${id}-${locale}-1440-full`, { full: true });
    await wide.ctx.close();
  }
}

// V4: with motion the rows start unsorted and end sorted, Frozen last.
{
  const { ctx, page } = await open('/internal/waitlist/v4/de', { width: 390, reduced: 'no-preference' });
  await page.locator('[data-sort]').scrollIntoViewIfNeeded();
  const order = () =>
    page.$$eval('.wv-sort-chip', (chips) =>
      chips.map((c) => [c.getBoundingClientRect().top, c.textContent.replace(/\p{Extended_Pictographic}/gu, '').trim()]).sort((a, b) => a[0] - b[0]).map(([, t]) => t),
    );
  await page.waitForTimeout(500);
  const start = await order();
  await page.screenshot({ path: join(out, 'v4-de-sort-start.png'), clip: await page.locator('[data-sort]').boundingBox() });
  await page.waitForTimeout(1300);
  await page.screenshot({ path: join(out, 'v4-de-sort-mid.png'), clip: await page.locator('[data-sort]').boundingBox() });
  await page.waitForTimeout(2200);
  const end = await order();
  await page.screenshot({ path: join(out, 'v4-de-sort-end.png'), clip: await page.locator('[data-sort]').boundingBox() });
  check(start[0] === 'Tiefkühl', 'v4 sort', `starts with ${start[0]}, not Tiefkühl`);
  check(end.at(-1) === 'Tiefkühl' && end[0] === 'Obst & Gemüse', 'v4 sort', `ends ${end.join(', ')}`);
  await ctx.close();
}

{
  const { ctx, page } = await open('/internal/waitlist', { width: 390 });
  check((await page.locator('a[href^="/internal/waitlist/v"]').count()) >= 10, '/internal/waitlist', 'index links fewer than 10 pages');
  await shoot(page, 'index-390-full', { full: true });
  await ctx.close();
}

await browser.close();
await server.close();
if (problems.length > 0) {
  console.error(`${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`waitlist variations: all checks passed, screenshots in ${out}`);
