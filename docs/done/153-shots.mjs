// Serves site/public with the production CSP and cleanUrls, then films the sync indicator page:
// node docs/done/153-shots.mjs [outDir]
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(join(process.env.HOME, 'family-groceries/e2e/package.json'));
const { chromium, devices } = require('playwright');
const pub = join(repo, 'site/public');
const out = process.argv[2] || join(repo, 'docs/screenshots/153');
const csp = JSON.parse(readFileSync(join(repo, 'site/vercel.json'), 'utf8')).headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value;
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };

const server = createServer((req, res) => {
  let p = join(pub, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!existsSync(p) || statSync(p).isDirectory()) p += '.html';
  if (!existsSync(p)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream', 'content-security-policy': csp });
  res.end(readFileSync(p));
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const url = `http://127.0.0.1:${server.address().port}/internal/sync-indicator`;

const b = await chromium.launch();
const errs = [];
const page = async (opts) => {
  const ctx = await b.newContext(opts);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(url, { waitUntil: 'networkidle' });
  return p;
};
const click = (p, control, value) => p.click(`[data-control=${control}] [data-value=${value}]`);

const desk = await page({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
for (const [state, wait] of [['online', 0], ['offline', 600], ['failing', 600]]) {
  await click(desk, 'sync', state);
  await desk.waitForTimeout(wait);
  await desk.screenshot({ path: `${out}/desktop-${state}-peek.png`, fullPage: true });
  if (state !== 'online') {
    await desk.waitForTimeout(3600);
    await desk.screenshot({ path: `${out}/desktop-${state}.png`, fullPage: true });
  }
}
await click(desk, 'sync', 'online');
await desk.waitForTimeout(500);
await desk.screenshot({ path: `${out}/desktop-back-online.png`, fullPage: true });
await click(desk, 'theme', 'dark');
await click(desk, 'lang', 'en');
for (const state of ['offline', 'failing']) {
  await click(desk, 'sync', state);
  await desk.waitForTimeout(4000);
  await desk.screenshot({ path: `${out}/desktop-${state}-en-dark.png`, fullPage: true });
}

// Wide enough that "Fit" draws all six phones at 1:1.
const real = await page({ viewport: { width: 2560, height: 1100 }, deviceScaleFactor: 1 });
await click(real, 'sync', 'failing');
await real.waitForTimeout(600);
for (const id of ['current', 's1', 's2', 's3', 's4', 's5']) await real.locator(`.frame[data-id=${id}] .phone`).screenshot({ path: `${out}/frame-${id}-failing-peek.png` });
await click(real, 'sync', 'offline');
await real.waitForTimeout(4000);
for (const id of ['current', 's1', 's2', 's3', 's4', 's5']) await real.locator(`.frame[data-id=${id}] .phone`).screenshot({ path: `${out}/frame-${id}-offline.png` });
const s3 = await real.$eval('.frame[data-id=s3] .phone', (ph) => {
  const o = ph.getBoundingClientRect();
  const box = (sel) => { const r = ph.querySelector(sel).getBoundingClientRect(); return { top: Math.round(r.top - o.top), bottom: Math.round(r.bottom - o.top), left: Math.round(r.left - o.left), right: Math.round(r.right - o.left) }; };
  return { island: box('.island'), topbar: box('.topbar'), edit: box('.edit') };
});
await click(real, 'sync', 'failing');
await real.waitForTimeout(4000);
for (const id of ['s3', 's4']) await real.locator(`.frame[data-id=${id}] .phone`).screenshot({ path: `${out}/frame-${id}-failing.png` });

const phone = await page({ ...devices['iPhone 13'] });
await click(phone, 'sync', 'offline');
await phone.waitForTimeout(4000);
await phone.screenshot({ path: `${out}/phone-offline.png` });
const startSize = await phone.$eval('[data-control=size] [aria-pressed=true]', (b) => b.dataset.value);
await click(phone, 'size', 'fit');
await phone.screenshot({ path: `${out}/phone-offline-fit.png`, fullPage: true });
const frames = await phone.$$eval('.frame', (els) => els.map((e) => { const r = e.querySelector('.phone').getBoundingClientRect(); return { id: e.dataset.id, w: Math.round(r.width), right: Math.round(r.right) }; }));
const vw = await phone.evaluate(() => document.documentElement.clientWidth);
const overflow = await phone.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

console.log(JSON.stringify({ url, s3, frames, vw, startSize, overflow, errors: errs }, null, 1));
await b.close();
server.close();
