// Serves site/public with the production CSP and cleanUrls, then drives the households prototype:
// node docs/done/169-shots.mjs [outDir]
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(join(process.env.HOME, 'family-groceries/e2e/package.json'));
const { chromium } = require('playwright');
const pub = join(repo, 'site/public');
const out = process.argv[2] || join(repo, 'docs/screenshots/169');
mkdirSync(out, { recursive: true });
const csp = JSON.parse(readFileSync(join(repo, 'site/vercel.json'), 'utf8')).headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value;
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' };

const server = createServer((req, res) => {
  let p = join(pub, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!existsSync(p) || statSync(p).isDirectory()) p += '.html';
  if (!existsSync(p)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream', 'content-security-policy': csp });
  res.end(readFileSync(p));
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const url = `http://127.0.0.1:${server.address().port}/internal/households`;

const b = await chromium.launch();
const errs = [];
const open = async (opts) => {
  const ctx = await b.newContext(opts);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP ${e.violatedDirective} ${e.blockedURI}`)));
  await p.goto(url, { waitUntil: 'networkidle' });
  return p;
};
const control = (p, c, v) => p.click(`[data-control=${c}] [data-value=${v}]`);
const peter = '.phone[data-user=peter]';
const mia = '.phone[data-user=mia]';
const tap = async (p, sel) => { await p.click(sel, sel.endsWith('.scrim') ? { position: { x: 100, y: 120 } } : {}); await p.waitForTimeout(450); };
const shot = (p, name) => p.locator('#frames').screenshot({ path: `${out}/${name}.png` });
const text = (p, sel) => p.locator(sel).innerText();
const assert = (ok, msg) => { if (!ok) { console.error(`FAIL ${msg}`); process.exitCode = 1; } else console.log(`ok   ${msg}`); };

const d = await open({ viewport: { width: 1280, height: 1100 }, deviceScaleFactor: 1 });
await shot(d, 's1-list');
assert((await text(d, `${mia} .screen--wait`)).includes('Noch keine Einladung'), 'Mia waits before any share');

await tap(d, `${peter} .chip`);
await shot(d, 's1-sheet');
assert((await text(d, `${peter} .hhrow:nth-child(2)`)).includes('3 neu'), 'Sommerfest row shows 3 neu');

await tap(d, `${peter} .hhrow:nth-child(2)`);
assert((await text(d, `${peter} .chip`)).includes('TSV Sommerfest'), 'chip switched to Sommerfest');
assert((await text(d, `${peter} .content`)).includes('Grillwürstchen'), 'Sommerfest items shown');

await control(d, 'variant', 's2');
await d.waitForTimeout(300);
await shot(d, 's2-list');
await tap(d, `${peter} .tab--hh`);
await shot(d, 's2-sheet');
await tap(d, `${peter} .scrim`);

await control(d, 'variant', 's3');
await d.waitForTimeout(300);
await d.click(`${peter} .arrow[data-step="1"]`);
await d.waitForTimeout(700);
assert((await text(d, `${peter} [data-chip]`)).includes('Eltern'), 'S3 arrow pages to Eltern');
await shot(d, 's3-pager');
await d.click(`${peter} .arrow[data-step="-1"]`);
await d.waitForTimeout(700);

await control(d, 'variant', 's1');
await d.waitForTimeout(300);
await tap(d, `${peter} .chip`);
await tap(d, `${peter} .sheet__actions .btn:first-child`);
await tap(d, `${peter} .kind:nth-child(3)`);
assert((await d.inputValue(`${peter} .input input`)) === 'Unsere WG', 'WG prefills Unsere WG');
await tap(d, `${peter} .kind:nth-child(2)`);
await shot(d, 'create-household');
await tap(d, `${peter} .create__go`);
assert((await text(d, `${peter} .sheet__title`)).includes('Leute einladen'), 'create goes straight to the invite sheet');
assert((await text(d, `${peter} .sheet__hh`)).includes('Familie'), 'invite sheet is for the new household');
await tap(d, `${peter} .scrim`);

await tap(d, `${peter} .chip`);
await tap(d, `${peter} .sheet__actions .btn:first-child`);
await tap(d, `${peter} .kind:nth-child(5)`);
await tap(d, `${peter} .create__go`);
assert((await d.locator(`${peter} .sheet`).count()) === 0, 'Nur ich skips the invite sheet');
assert((await text(d, `${peter} .chip`)).includes('Meine Liste'), 'Nur ich lands on Meine Liste');

await tap(d, `${peter} .chip`);
await tap(d, `${peter} .hhrow:nth-child(1) .iconbtn`);
await shot(d, 'invite-person');
assert((await text(d, `${peter} .premium`)).includes('Premium'), 'Zuhause invite shows the premium line');
await d.locator(`${peter} .segbtn`).nth(1).click();
await d.waitForTimeout(400);
await shot(d, 'invite-group');
await tap(d, `${peter} .scrim`);

await tap(d, `${peter} .chip`);
await tap(d, `${peter} .hhrow:nth-child(2) .iconbtn`);
assert((await d.locator(`${peter} .premium`).count()) === 0, 'Sommerfest invite has no premium line');
assert((await text(d, `${peter} .codebox__code`)) === 'K7Q2-M9XD', 'Sommerfest person code');
await tap(d, `${peter} .btn--big`);
await tap(d, `${peter} .contact:first-child`);
assert((await text(d, '.frame[data-id=peter] .sent')).includes('Gesendet an Mia (Simulation)'), 'sent note outside the phone');
assert((await d.locator('.phone .snack, .phone [role=alert]').count()) === 0, 'no snackbar in the app');
await shot(d, 'mia-landing');
const landing = await text(d, `${mia} .land`);
assert(!/Grillwürstchen|Brötchen|Senf/.test(landing), 'landing leaks no item names');
assert(!landing.includes('Premium'), 'landing has no premium line for Sommerfest');
assert(landing.includes('24 Mitglieder · 31 Artikel'), 'landing shows counts');

await tap(d, `${mia} .land__stores .btn:first-child`);
await shot(d, 'mia-welcome');
await tap(d, `${mia} .invcard .btn`);
await d.waitForTimeout(500);
await shot(d, 'mia-joined-second-hop');
assert((await text(d, `${mia} .hop`)).includes('Auch eine Liste für zuhause?'), 'second-hop card shows');
assert((await text(d, `${mia} .content`)).includes('Grillwürstchen'), 'Mia sees the Sommerfest list');

await tap(d, `${peter} .scrim`);
await control(d, 'theme', 'dark');
await control(d, 'lang', 'en');
await d.waitForTimeout(300);
await tap(d, `${peter} .chip`);
await shot(d, 'en-dark-sheet');
assert((await text(d, `${peter} .hhrow:nth-child(2)`)).includes('25 members'), 'Sommerfest counts Mia after she joined');
assert((await text(d, '.frame[data-id=peter] .sent')).includes('Sent to Mia'), 'sent note follows the language');

const n = await open({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await n.screenshot({ path: `${out}/narrow-390.png`, fullPage: true });
const overflow = await n.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
assert(overflow <= 0, `no horizontal overflow at 390 px (${overflow})`);

// Text that leaves its hex pill or chip.
const clipped = await d.evaluate(() => [...document.querySelectorAll('.phone .hx')].filter((el) => el.scrollWidth > el.clientWidth + 1 && !el.matches('.pager, .content')).map((el) => el.className.baseVal ?? el.className));
assert(clipped.length === 0, `no clipped hex content ${JSON.stringify(clipped)}`);

assert(errs.length === 0, `0 console errors and CSP violations ${JSON.stringify(errs)}`);
await b.close();
server.close();
