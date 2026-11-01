// Renders every mail to PNG with Playwright's Chromium: 600 px (desktop) and 375 px (mobile),
// light; dark for magic_link and welcome-android-de; one with images blocked; both footers on a
// phone; then a contact sheet. Requests to https://hummlist.com/ are served from site/public, so
// the previews show the assets this branch ships before they are deployed. No other network.
//   npx tsx scripts/preview.tsx [--out <dir>] [--scale 1|2] [<id> ...]
//   npx tsx scripts/preview.tsx --sheet --out <dir>    only the contact sheet, from the PNGs in <dir>
// Local only, one browser: flock /tmp/fg-e2e.lock npm run preview
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';
import { renderEmail } from '../src/render.ts';
import { EMAILS, fillDemo, type Email } from '../src/registry.tsx';

const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const out = outAt >= 0 ? args.splice(outAt, 2)[1] : '/tmp/fg-55-previews';
const sheetOnly = args.includes('--sheet');
if (sheetOnly) args.splice(args.indexOf('--sheet'), 1);
const scaleAt = args.indexOf('--scale');
const scale = scaleAt >= 0 ? Number(args.splice(scaleAt, 2)[1]) : 2;
const only = new Set(args);
const sitePublic = fileURLToPath(new URL('../../site/public/', import.meta.url));

const WIDTHS = { desktop: 600, mobile: 375 } as const;
const DARK = new Set(['magic_link', 'welcome-android-de']);
const BLOCKED = 'welcome-android-de';
const FOOTERS = { 'partner-joined-de': 'transactional-footer-de-mobile', 'welcome-android-de': 'onboarding-footer-de-mobile' } as const;

// DE first, then the rest in registry order.
const emails = [...EMAILS].sort((a, b) => Number(b.lang === 'de') - Number(a.lang === 'de'))
  .filter((e) => only.size === 0 || only.has(e.id));

// <email>-<lang>-<desktop|mobile>[-dark]; ids like welcome-android-de already end in their lang.
const base = (e: Email) => (e.id.endsWith(`-${e.lang}`) ? e.id : `${e.id}-${e.lang}`);

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const shots: string[] = [];

async function shoot(email: Email, html: string, name: string, width: number, opts: { dark?: boolean; blockImages?: boolean; footer?: boolean } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 300 }, deviceScaleFactor: scale, colorScheme: opts.dark ? 'dark' : 'light' });
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === 'data:') return route.continue();
    if (url.origin === 'https://hummlist.com' && !opts.blockImages) {
      const file = join(sitePublic, decodeURIComponent(url.pathname));
      if (existsSync(file)) return route.fulfill({ body: readFileSync(file), contentType: 'image/png' });
    }
    return route.abort();
  });
  const page: Page = await context.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  const path = join(out, `${name}.png`);
  if (opts.footer) await page.locator('[data-hl-text=footer]').screenshot({ path });
  else await page.screenshot({ path, fullPage: true });
  await context.close();
  shots.push(path);
  console.log(`${email.id}: ${path}`);
}

for (const email of sheetOnly ? [] : emails) {
  const { html } = await renderEmail(email.element);
  const shown = fillDemo(html, email.demo);
  for (const [device, width] of Object.entries(WIDTHS)) {
    const name = `${base(email)}-${device}`;
    await shoot(email, shown, name, width);
    if (DARK.has(email.id)) await shoot(email, shown, `${name}-dark`, width, { dark: true });
  }
  if (email.id === BLOCKED) await shoot(email, shown, `${base(email)}-mobile-images-blocked`, WIDTHS.mobile, { blockImages: true });
  const footer = FOOTERS[email.id as keyof typeof FOOTERS];
  if (footer) await shoot(email, shown, footer, WIDTHS.mobile, { footer: true });
}

if (sheetOnly) shots.push(...readdirSync(out).filter((n) => n.endsWith('.png') && n !== 'contact-sheet.png').sort().map((n) => join(out, n)));
if (only.size === 0) {
  const tiles = shots.map((p) => {
    const name = p.split('/').at(-1)!.replace(/\.png$/, '');
    return `<figure><img src="data:image/png;base64,${readFileSync(p).toString('base64')}"><figcaption>${name}</figcaption></figure>`;
  }).join('');
  const sheet = `<!doctype html><style>body{margin:0;padding:16px;background:#ddd;font:12px sans-serif;columns:10 140px;column-gap:12px}
figure{margin:0 0 12px;break-inside:avoid;background:#fff;padding:6px}img{width:100%;display:block}figcaption{padding-top:4px}</style>${tiles}`;
  const context = await browser.newContext({ viewport: { width: 1600, height: 600 } });
  const page = await context.newPage();
  await page.setContent(sheet, { waitUntil: 'load' });
  await page.screenshot({ path: join(out, 'contact-sheet.png'), fullPage: true });
  console.log(`contact sheet: ${join(out, 'contact-sheet.png')}`);
}
await browser.close();
