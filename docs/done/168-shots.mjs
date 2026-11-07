// Serves site/public with the production CSP and cleanUrls, clicks through the onboarding prototype
// and shoots every step and hint: node docs/done/168-shots.mjs [outDir]
import { createRequire } from 'node:module';
import process from 'node:process';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(join(process.env.HOME, 'family-groceries/e2e/package.json'));
const { chromium } = require('playwright');
const pub = join(repo, 'site/public');
const out = process.argv[2] || join(repo, 'docs/screenshots/168');
mkdirSync(out, { recursive: true });
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
const url = `http://127.0.0.1:${server.address().port}/internal/onboarding`;

const b = await chromium.launch();
const errs = [];
const open = async (opts) => {
  const ctx = await b.newContext(opts);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(url, { waitUntil: 'networkidle' });
  return p;
};
const assert = (ok, msg) => { if (!ok) { errs.push(`assert: ${msg}`); console.log(`FAIL ${msg}`); } else console.log(`ok   ${msg}`); };
const flow = (p) => p.locator('#flow');
const shot = async (p, name) => {
  await p.waitForTimeout(450);
  await flow(p).screenshot({ path: `${out}/${name}.png` });
};
const act = (p, sel) => flow(p).locator(sel).first().click();

async function walk(p, prefix, kind) {
  await p.click('#steps [data-to=login]');
  await shot(p, `${prefix}-1-login`);
  await act(p, '[data-to=consent]');
  await shot(p, `${prefix}-2-consent`);
  await act(p, '[data-to=welcome]');
  await shot(p, `${prefix}-3-welcome`);
  await act(p, '[data-to=kind]');
  assert(await flow(p).locator('[data-to=create]').isDisabled(), `${prefix}: Weiter disabled before a pick`);
  await act(p, `[data-kind=${kind}]`);
  await shot(p, `${prefix}-4-kind`);
  await act(p, '[data-to=create]');
  for (const s of ['REWE', 'dm']) await act(p, `[data-store="${s}"]`);
  await shot(p, `${prefix}-5-create`);
  await act(p, '[data-to=starter]');
  await shot(p, `${prefix}-6-starter-empty`);
  for (const id of ['milk', 'bread', 'bananas', 'eggs']) await act(p, `[data-id=${id}]`);
  await shot(p, `${prefix}-6-starter`);
  assert((await flow(p).locator('.mini .row').count()) === 4, `${prefix}: 4 starter rows in the mini list`);
  await act(p, '[data-act=starter-next]');
  if (kind !== 'solo') {
    await shot(p, `${prefix}-7-invite`);
    await act(p, '[data-act=invite]');
    assert(await flow(p).getByText('K7QM2XPD').isVisible(), `${prefix}: invite card shows the code`);
    await shot(p, `${prefix}-7-invited`);
    await act(p, '[data-to=list]');
  }
  await shot(p, `${prefix}-8-list`);
  assert(await flow(p).locator('#checklist').isVisible(), `${prefix}: checklist on the list`);
}

const desk = await open({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
await desk.screenshot({ path: `${out}/page-desktop.png` });
await walk(desk, 'de-partner', 'partner');
const rows = await flow(desk).locator('.row').count();
for (let i = 0; i < rows; i++) {
  await flow(desk).locator('.row').first().click();
  await desk.waitForTimeout(350);
}
await desk.waitForTimeout(1200);
assert(!(await flow(desk).locator('#checklist').count()), 'de-partner: checklist leaves once every item is done');
await shot(desk, 'de-partner-9-list-done');

await walk(desk, 'de-club', 'club');
await walk(desk, 'de-solo', 'solo');
assert(!(await flow(desk).getByText('Partner einladen').count()), 'de-solo: no invite item for "Nur ich"');

await desk.click('[data-control=lang] [data-value=en]');
await desk.click('[data-control=theme] [data-value=dark]');
await walk(desk, 'en-dark-partner', 'partner');

await desk.click('[data-control=lang] [data-value=de]');
await desk.click('[data-control=theme] [data-value=light]');
for (const id of ['edit-long-press', 'dictation', 'store-order', 'invite-partner', 'ai-assistant']) {
  await desk.click(`#picker [data-id=${id}]`);
  await desk.waitForTimeout(400);
  await desk.locator('#hints').screenshot({ path: `${out}/hint-${id}.png` });
}
await desk.locator('#hints [data-act=hint-x]').click();
await desk.waitForTimeout(500);
assert(await desk.locator('#hints .dismissed').isVisible(), 'hint ✕ hides it');
await desk.locator('section.stage').nth(1).screenshot({ path: `${out}/hints-stage.png` });

const phone = await open({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
assert(overflow <= 0, `no horizontal overflow on a 390 px phone (${overflow})`);
await phone.screenshot({ path: `${out}/page-phone.png` });

await b.close();
server.close();
console.log(errs.length ? `ERRORS:\n${errs.join('\n')}` : 'no console or page errors');
process.exit(errs.length ? 1 : 0);
