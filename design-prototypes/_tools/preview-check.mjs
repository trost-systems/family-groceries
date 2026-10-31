// Usage: node preview-check.mjs <worktree>
// Serves <worktree>/site/dist the way Vercel serves it (vercel.json: cleanUrls,
// trailingSlash false, each path's CSP header) and crawls every page under /design-prototypes
// in Chromium, following links: each page must load with no 404, failed or off-origin
// request and no CSP violation, and axe (WCAG 2.1 A/AA) finds nothing in light and dark at
// 390 and 1440 px. A Flutter app page (the Widgetbook) must also draw its first frame with
// CanvasKit from its own folder.
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { serveDist, settleFlutter } from './serve-dist.mjs';

const { origin, close } = await serveDist(process.argv[2]);

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
  page.on('pageerror', (e) => errs.push(`page error ${e.message}`));
  page.on('requestfailed', (r) => errs.push(`failed ${r.url()}`));
  const requests = [];
  page.on('request', (r) => { requests.push(r.url()); if (!r.url().startsWith(origin)) errs.push(`off-origin ${r.url()}`); });
  page.on('response', (r) => { if (r.status() >= 400) errs.push(`HTTP ${r.status()} ${r.url()}`); });
  const resp = await page.goto(origin + path, { waitUntil: 'networkidle' });
  if (resp.status() !== 200) errs.push(`page HTTP ${resp.status()}`);
  const flutter = await settleFlutter(page);
  if (flutter) {
    const base = await page.evaluate(() => document.baseURI);
    const engine = requests.filter((u) => u.startsWith(`${base}canvaskit/`) && u.endsWith('.wasm'));
    if (!engine.length) errs.push('Flutter app loaded no CanvasKit wasm from its own folder');
    if (!(await page.$('flutter-view'))) errs.push('Flutter app drew no flutter-view');
  }
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
      await settleFlutter(ap);
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
close();
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`${seen.size} pages under /design-prototypes load cleanly behind the CSP, axe clean in light and dark at 390 and 1440`);
