// Usage: node preview-check.mjs <worktree>
// Serves <worktree>/site/dist the way Vercel serves it (vercel.json: cleanUrls,
// trailingSlash false, the CSP header) and crawls every page under /design-prototypes
// in Chromium, following links: each page must load with no 404, failed or off-origin
// request and no CSP violation, and axe (WCAG 2.1 A/AA) finds nothing in light and dark at
// 390 and 1440 px.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { chromium } from 'playwright';

const dist = join(resolve(process.argv[2]), 'site/dist');
const vercel = JSON.parse(readFileSync(join(resolve(process.argv[2]), 'site/vercel.json'), 'utf8'));
const CSP = vercel.headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.txt': 'text/plain' };

const isFile = (f) => existsSync(f) && statSync(f).isFile();
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.length > 1 && path.endsWith('/')) { res.writeHead(308, { Location: path.slice(0, -1) }); res.end(); return; }
  if (path.endsWith('.html')) { res.writeHead(308, { Location: path.slice(0, -5).replace(/\/index$/, '') }); res.end(); return; }
  const f = [join(dist, path), join(dist, `${path}.html`), join(dist, path, 'index.html')].find(isFile);
  if (!f || !f.startsWith(dist)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(f)] ?? 'application/octet-stream', 'Content-Security-Policy': CSP });
  res.end(readFileSync(f));
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const axeSource = readFileSync(new URL('./node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const browser = await chromium.launch();
const seen = new Set();
const queue = ['/design-prototypes'];
const problems = [];
while (queue.length) {
  const path = queue.shift();
  if (seen.has(path)) continue;
  seen.add(path);
  const page = await browser.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('requestfailed', (r) => errs.push(`failed ${r.url()}`));
  page.on('request', (r) => { if (!r.url().startsWith(origin)) errs.push(`off-origin ${r.url()}`); });
  page.on('response', (r) => { if (r.status() >= 400) errs.push(`HTTP ${r.status()} ${r.url()}`); });
  const resp = await page.goto(origin + path, { waitUntil: 'networkidle' });
  if (resp.status() !== 200) errs.push(`page HTTP ${resp.status()}`);
  await page.evaluate(() => document.fonts.ready);
  const fontErrors = await page.evaluate(() => [...document.fonts].filter((x) => x.status === 'error').map((x) => x.family));
  for (const f of fontErrors) errs.push(`font failed ${f}`);
  const links = await page.$$eval('a[href]', (as) => as.map((a) => a.href));
  for (const l of links) {
    const u = new URL(l);
    if (u.origin === origin && u.pathname.startsWith('/design-prototypes')) queue.push(u.pathname);
  }
  for (const colorScheme of ['light', 'dark']) {
    for (const width of [390, 1440]) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme, reducedMotion: 'reduce' });
      const ap = await ctx.newPage();
      await ap.goto(origin + path, { waitUntil: 'networkidle' });
      await ap.evaluate(() => document.fonts.ready);
      const violations = await ap.evaluate(async (src) => {
        (0, eval)(src);
        const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
        return r.violations.map((v) => `${v.id} x${v.nodes.length}: ${v.nodes[0].target.join(' ')}`);
      }, axeSource);
      for (const v of violations) errs.push(`axe ${colorScheme} ${width}: ${v}`);
      await ctx.close();
    }
  }
  console.log(`${errs.length ? 'FAIL' : 'ok  '} ${path}`);
  for (const e of errs) problems.push(`${path}: ${e}`);
  await page.close();
}
await browser.close();
server.close();
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`${seen.size} pages under /design-prototypes load cleanly behind the CSP, axe clean in light and dark at 390 and 1440`);
