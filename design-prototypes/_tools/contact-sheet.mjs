// Usage: node contact-sheet.mjs [--title <text>] [--job <n>] <out.png> <option-folder>...
// One labelled PNG comparing the same screen across pages: the top of each homepage on a
// phone (390x844) in light and dark, and on desktop (1440x900, scaled into the column).
// Columns follow the argument order. Served over http (CSS masks fail on file://).
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args.splice(i, 2)[1]; };
const heading = flag('--title', 'Hummlist: Hex Weich (3b) in Kunststilen, dazu Frische (5)');
const job = flag('--job', '46');
const [out, ...pages] = args;
if (!out || !pages.length) throw new Error('usage: node contact-sheet.mjs <out.png> <option-folder>...');

const label = (f) => {
  const html = readFileSync(join(root, f, 'index.html'), 'utf8');
  const [id, ...slug] = f.replace(/^option-/, '').split('-');
  const title = html.match(/<title>[^(]*\((.+)\)<\/title>/)?.[1] ?? slug.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
  return { id, title };
};

const tmp = mkdtempSync(join(tmpdir(), 'contact-'));
const server = await serve(root);
const browser = await chromium.launch();
const SHOTS = [
  { key: 'light', viewport: { width: 390, height: 844 }, colorScheme: 'light' },
  { key: 'dark', viewport: { width: 390, height: 844 }, colorScheme: 'dark' },
  { key: 'desktop', viewport: { width: 1440, height: 900 }, colorScheme: 'light' },
];
for (const f of pages) {
  for (const s of SHOTS) {
    const page = await browser.newPage({ viewport: s.viewport, deviceScaleFactor: 1, colorScheme: s.colorScheme, reducedMotion: 'reduce' });
    await page.goto(`${server.origin}/${f}/index.html`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(tmp, `${f}-${s.key}.png`) });
    await page.close();
  }
}

const cols = pages.map((f) => {
  const { id, title } = label(f);
  return `<figure><figcaption><b>${id}</b> ${title}</figcaption>${SHOTS.map((s) => `<img src="${f}-${s.key}.png" alt="">`).join('')}</figure>`;
}).join('');
writeFileSync(join(tmp, 'sheet.html'), `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:32px;background:#e9e7e1;font:16px/1.3 system-ui,sans-serif;color:#1b1c1a}
h1{margin:0 0 8px;font-size:28px}p{margin:0 0 24px;color:#4e514b}
.row{display:flex;gap:24px;align-items:flex-start}figure{margin:0;width:390px}
figcaption{height:44px;font-size:18px}figcaption b{display:inline-block;min-width:2.2em;padding:2px 6px;margin-right:6px;background:#1b1c1a;color:#fff;border-radius:6px;text-align:center}
img{display:block;width:390px;margin-bottom:16px;border-radius:10px;box-shadow:0 1px 4px #0003}
</style><h1>${heading}</h1>
<p>Je Spalte dieselbe Ansicht: Startseite oben auf dem Handy hell und dunkel (390 × 844), darunter Desktop hell (1440 × 900, verkleinert). Job ${job}, ${new Date().toISOString().slice(0, 10)}.</p>
<div class="row">${cols}</div>`);
const page = await browser.newPage({ viewport: { width: 64 + pages.length * 414, height: 800 }, deviceScaleFactor: 1 });
await page.goto(`file://${join(tmp, 'sheet.html')}`);
await page.waitForLoadState('load');
await page.screenshot({ path: resolve(out), fullPage: true });
await browser.close();
server.close();
rmSync(tmp, { recursive: true, force: true });
console.log(`${out}: ${pages.length} columns`);
