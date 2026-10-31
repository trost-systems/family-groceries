// Usage: node widgetbook-shots.mjs <worktree>
// Screenshots of the published Widgetbook (site/dist, served with its CSP) into
// design-prototypes/screenshots/41/widgetbook/. Each shot opens the catalog at a story or
// scenario with the Theme, Viewport and Text Scale addons set through the URL, the way the
// catalog writes them itself; every request must stay on the origin and succeed.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { serveDist, settleFlutter } from './serve-dist.mjs';

const out = new URL('../screenshots/41/widgetbook/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const button = 'Hummel Hex/HexButton/Primary';
const shots = [
  { name: 'home', ui: 'light', query: {} },
  { name: 'button-sharp-light', ui: 'light', query: { path: button, theme: '{name:Sharp · Light}' } },
  { name: 'button-sharp-dark', ui: 'dark', query: { path: button, theme: '{name:Sharp · Dark}' } },
  { name: 'button-soft-light', ui: 'light', query: { path: button, theme: '{name:Soft · Light}' } },
  { name: 'button-soft-dark', ui: 'dark', query: { path: button, theme: '{name:Soft · Dark}' } },
  { name: 'button-pressed-soft-dark', ui: 'dark', query: { path: `${button}/Pressed • Soft · Dark` } },
  { name: 'button-focus-sharp-light', ui: 'light', query: { path: `${button}/Focus • Sharp · Light` } },
  { name: 'button-icon-iphone-soft-light', ui: 'light', query: { path: `${button}/With icon • Soft · Light`, viewport: '{name:iPhone 13}' } },
  { name: 'listrow-galaxy-sharp-dark', ui: 'dark', query: { path: 'Hummel Hex/ListRow/Unchecked', theme: '{name:Sharp · Dark}', viewport: '{name:Samsung Galaxy S20}' } },
  { name: 'chip-soft-light', ui: 'light', query: { path: 'Hummel Hex/HexChip/Selected', theme: '{name:Soft · Light}' } },
  { name: 'listrow-subtitle-soft-light', ui: 'light', query: { path: 'Hummel Hex/ListRow/Unchecked/With subtitle • Soft · Light' } },
  { name: 'button-text-x2-sharp-light', ui: 'light', query: { path: button, theme: '{name:Sharp · Light}', 'text-scale': '{factor:2.0}' } },
  { name: 'gallery', ui: 'light', query: { path: 'Hummel Hex/Gallery/All variants' } },
];

const { origin, close } = await serveDist(process.argv[2]);
const browser = await chromium.launch();
const problems = [];
for (const shot of shots) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: shot.ui });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`${shot.name}: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`${shot.name}: page error ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`${shot.name}: failed ${r.url()}`));
  page.on('request', (r) => { if (!r.url().startsWith(origin)) problems.push(`${shot.name}: off-origin ${r.url()}`); });
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`${shot.name}: HTTP ${r.status()} ${r.url()}`); });
  const query = new URLSearchParams(shot.query).toString();
  await page.goto(`${origin}/design-prototypes/widgetbook${query ? `#/?${query}` : ''}`, { waitUntil: 'networkidle' });
  await settleFlutter(page);
  if (!(await page.$('flutter-view'))) problems.push(`${shot.name}: no flutter-view`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(out, `${shot.name}.png`) });
  console.log(`${shot.name}: ${decodeURIComponent(page.url().replace(origin, ''))}`);
  await ctx.close();
}
await browser.close();
close();
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`${shots.length} screenshots in ${out}, no failed or off-origin request`);
