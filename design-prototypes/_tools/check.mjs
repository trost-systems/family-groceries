// Usage: node check.mjs <option-dir> [--shots]
// Proves one prototype folder against the brief: tokens.json shape and contrast, tokens.css
// generated from it, no inline style/script or external assets, noindex, size, and in Chromium
// behind the hummlist-site CSP: no CSP violations, no failed or off-origin requests, fonts load,
// no horizontal scroll at 390 px, axe WCAG 2 AA clean in light and dark.
// --shots also writes the screenshots to ../screenshots/.
import { createServer } from 'node:http';
import { readFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, basename, extname, relative, dirname } from 'node:path';
import { chromium } from 'playwright';
import { buildCss } from './build-css.mjs';

const CSP = "default-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'";
const REQUIRED_COLORS = ['brand', 'on-brand', 'accent', 'on-accent', 'surface', 'surface-raised', 'text', 'text-muted',
  'border', 'success', 'on-success', 'warning', 'on-warning', 'error', 'on-error'];
const PAIRS = [
  ['text', 'surface', 4.5], ['text', 'surface-raised', 4.5], ['text-muted', 'surface', 4.5], ['text-muted', 'surface-raised', 4.5],
  ['on-brand', 'brand', 4.5], ['on-accent', 'accent', 4.5], ['on-success', 'success', 4.5], ['on-warning', 'warning', 4.5],
  ['on-error', 'error', 4.5], ['brand', 'surface', 3],
];
const REQUIRED_GROUPS = ['font.family', 'type', 'space', 'radius', 'shadow', 'motion.duration', 'motion.easing'];

const dir = resolve(process.argv[2]);
const option = basename(dir);
const root = dirname(dir);
const shots = process.argv.includes('--shots');
const problems = [];
const fail = (msg) => problems.push(msg);

const files = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? files(join(d, f)) : [join(d, f)]));
const all = files(dir);

const hexOf = (v) => (typeof v === 'string' ? v : v?.hex);
function lum(hex) {
  const n = hex.replace('#', '').slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const get = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);

// tokens.json
const tokens = JSON.parse(readFileSync(join(dir, 'tokens.json'), 'utf8'));
const contrast = [];
for (const mode of ['light', 'dark']) {
  const colors = tokens.color?.[mode] ?? {};
  for (const k of REQUIRED_COLORS) if (!hexOf(colors[k]?.$value)) fail(`tokens.json: color.${mode}.${k} missing`);
  const extra = tokens.$extensions?.['com.hummlist']?.contrastPairs ?? [];
  for (const [fg, bg, min] of [...PAIRS, ...extra]) {
    const a = hexOf(colors[fg]?.$value); const b = hexOf(colors[bg]?.$value);
    if (!a || !b) { fail(`tokens.json: pair ${fg}/${bg} (${mode}) missing`); continue; }
    const r = ratio(a, b);
    contrast.push({ mode, fg, bg, ratio: Math.round(r * 100) / 100, min });
    if (r < min) fail(`contrast ${mode} ${fg} ${a} on ${bg} ${b} = ${r.toFixed(2)} < ${min}`);
  }
}
for (const g of REQUIRED_GROUPS) if (!get(tokens, g) || !Object.keys(get(tokens, g)).some((k) => !k.startsWith('$'))) fail(`tokens.json: group ${g} empty`);
const fams = get(tokens, 'font.family') ?? {};
for (const [k, t] of Object.entries(fams)) {
  if (k.startsWith('$')) continue;
  const lic = t.$extensions?.['com.hummlist']?.license;
  if (!lic) fail(`tokens.json: font.family.${k} has no $extensions["com.hummlist"].license`);
}

// tokens.css generated from tokens.json
if (!existsSync(join(dir, 'tokens.css'))) fail('tokens.css missing');
else if (readFileSync(join(dir, 'tokens.css'), 'utf8') !== await buildCss(dir)) fail('tokens.css differs from build-css.mjs output: regenerate it');

// static rules
const htmls = all.filter((f) => f.endsWith('.html'));
for (const need of ['index.html', 'tokens-sheet.html', 'styles.css']) if (!all.includes(join(dir, need))) fail(`${need} missing`);
for (const f of htmls) {
  const s = readFileSync(f, 'utf8'); const rel = relative(dir, f);
  if (/<style[\s>]/i.test(s)) fail(`${rel}: inline <style>`);
  if (/\sstyle\s*=/i.test(s)) fail(`${rel}: style="" attribute`);
  if (/<script[\s>]/i.test(s)) fail(`${rel}: <script>`);
  if (/\son[a-z]+\s*=/i.test(s)) fail(`${rel}: inline event handler`);
  if (!/<meta name="robots" content="noindex">/.test(s)) fail(`${rel}: no <meta name="robots" content="noindex">`);
  if (!/<html lang="de"/.test(s)) fail(`${rel}: <html lang="de"> missing`);
  for (const m of s.matchAll(/(?:src|href|srcset|action|poster)\s*=\s*"([^"]*)"/gi)) if (/^(https?:)?\/\//i.test(m[1]) || /^data:/i.test(m[1])) fail(`${rel}: external or data URL ${m[1]}`);
  // site/build.mjs checkHtml runs over every HTML file the site deploys, these pages included.
  const heads = [...s.matchAll(/<h([1-6])[\s>]/gi)].map((m) => Number(m[1]));
  if (heads.filter((l) => l === 1).length !== 1) fail(`${rel}: expected exactly one <h1> (site build rule)`);
  heads.reduce((prev, l) => { if (l > prev + 1) fail(`${rel}: heading level skipped: <h${l}> after <h${prev}> (site build rule)`); return l; }, 0);
  for (const m of s.matchAll(/<img\b[^>]*>/gi)) if (!/\salt="[^"]*\S[^"]*"/.test(m[0])) fail(`${rel}: <img> without non-empty alt (site build rule; put decorative art in CSS background-image or an inline aria-hidden <svg>): ${m[0].slice(0, 80)}`);
  const text = s.replace(/<[^>]+>/g, ' ');
  if (/\bHumm\b|Humlist/i.test(text) || /HummList/.test(text)) fail(`${rel}: brand misspelt (must be "Hummlist")`);
}
for (const f of all.filter((f) => f.endsWith('.css') || f.endsWith('.svg'))) {
  const s = readFileSync(f, 'utf8'); const rel = relative(dir, f);
  for (const m of s.matchAll(/url\(\s*['"]?([^'")]+)/g)) if (/^(https?:)?\/\//i.test(m[1]) || (f.endsWith('.css') && /^data:/i.test(m[1]))) fail(`${rel}: external url(${m[1]})`);
  if (/@import/.test(s) && f.endsWith('.css')) fail(`${rel}: @import (link the files instead)`);
  if (f.endsWith('.svg') && /<script|href="https?:/i.test(s)) fail(`${rel}: script or external href in svg`);
}
const size = all.reduce((n, f) => n + statSync(f).size, 0);
if (size > 1.5 * 1024 * 1024) fail(`folder is ${(size / 1048576).toFixed(2)} MB > 1.5 MB`);
const fontFiles = all.filter((f) => /\.(woff2?|ttf|otf)$/.test(f));
if (fontFiles.length && !all.some((f) => /fonts\/.*(OFL|LICEN[CS]E)/i.test(f))) fail('fonts/ has no OFL.txt / LICENSE file');

// Interaction gates for options whose tokens declare size.target (the Hummel Hex variants):
// every control at least size.target in both axes (links inside running text excepted), a
// visible focus-visible indicator on every tab stop that no mask, clip-path or overflow
// clips, tactile .hex controls whose .face sinks by their edge (--d) on press, and no
// running animation or transition under prefers-reduced-motion (the runs below use reduce).
const target = tokens.size?.target?.$value?.value;
async function interactionProblems(page, min) {
  const out = await page.evaluate((min) => {
    const errs = [];
    const name = (e) => `${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ''}${e.className && typeof e.className === 'string' ? `.${e.className.trim().split(/\s+/).join('.')}` : ''} "${(e.getAttribute('aria-label') ?? e.textContent).trim().replace(/\s+/g, ' ').slice(0, 30)}"`;
    const running = document.getAnimations().filter((a) => a.playState === 'running' && Number(a.effect?.getTiming().duration) > 0);
    for (const a of running) errs.push(`animation running under reduced motion: ${a.animationName ?? a.transitionProperty ?? 'web animation'} on ${name(a.effect.target)}`);
    const inRunningText = (e) => getComputedStyle(e).display === 'inline'
      && [...e.parentElement.childNodes].some((n) => n !== e && n.textContent.trim());
    for (const e of document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')) {
      const r = e.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1 || inRunningText(e)) continue;
      if (r.width < min - 0.5 || r.height < min - 0.5) errs.push(`target ${Math.round(r.width)}x${Math.round(r.height)} < ${min}px: ${name(e)}`);
      const t = getComputedStyle(e).transitionDuration.split(',').map(parseFloat);
      if (t.some((d) => d > 0.001)) errs.push(`transition ${getComputedStyle(e).transitionDuration} under reduced motion: ${name(e)}`);
    }
    return errs;
  }, min);

  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  const seen = new Set();
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press('Tab');
    const r = await page.evaluate(() => {
      const e = document.activeElement;
      if (!e || e === document.body) return null;
      const s = getComputedStyle(e);
      const key = e.outerHTML.slice(0, 120) + e.getBoundingClientRect().top + scrollY;
      const visible = (c) => !/^(transparent|rgba\(\d+, \d+, \d+, 0\))$/.test(c);
      const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2 && visible(s.outlineColor))
        || /drop-shadow/.test(s.filter) || (s.boxShadow !== 'none' && visible(s.boxShadow));
      const problems = [];
      if (!e.matches(':focus-visible')) problems.push('not :focus-visible after Tab');
      if (!ring) problems.push('no visible focus indicator');
      if (s.clipPath !== 'none' || s.maskImage !== 'none') problems.push('focused control is itself masked or clipped, its ring would be too');
      const box = e.getBoundingClientRect(); const pad = 4;
      for (let a = e.parentElement; a && a !== document.documentElement; a = a.parentElement) {
        const as = getComputedStyle(a);
        if (as.clipPath !== 'none' || as.maskImage !== 'none') problems.push(`ancestor ${a.tagName.toLowerCase()}.${a.className} masks the ring`);
        const ar = a.getBoundingClientRect();
        const clipsX = as.overflowX !== 'visible' && (box.left - pad < ar.left || box.right + pad > ar.right);
        const clipsY = as.overflowY !== 'visible' && (box.top - pad < ar.top || box.bottom + pad > ar.bottom);
        if (clipsX || clipsY) problems.push(`ancestor ${a.tagName.toLowerCase()}.${a.className} (overflow ${as.overflow}) clips the ring at ${JSON.stringify([box.left, box.top, box.right, box.bottom].map(Math.round))}`);
      }
      return { key, label: `${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') ?? e.textContent).trim().replace(/\s+/g, ' ').slice(0, 30)}"`, problems };
    });
    if (!r || seen.has(r.key)) break;
    seen.add(r.key);
    for (const p of r.problems) out.push(`focus ${r.label}: ${p}`);
  }
  if (seen.size === 0) out.push('Tab reached no control');
  await page.evaluate(() => document.activeElement?.blur());

  const hexes = page.locator('.hex:has(> .face)');
  for (let i = 0, n = Math.min(await hexes.count(), 4); i < n; i++) {
    const el = hexes.nth(i);
    if (!(await el.isVisible())) continue;
    await el.scrollIntoViewIfNeeded();
    const face = el.locator('> .face');
    const before = (await face.boundingBox()).y;
    const box = await el.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(150);
    const after = (await face.boundingBox()).y;
    const d = await el.evaluate((e) => parseFloat(getComputedStyle(e).getPropertyValue('--d')));
    await page.mouse.move(0, 0);
    await page.mouse.up();
    if (Math.abs(after - before - d) > 0.5) out.push(`press: face of .hex #${i} moved ${(after - before).toFixed(1)}px, expected its edge ${d}px`);
  }
  return out;
}

// runtime behind the CSP
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.json': 'application/json', '.txt': 'text/plain' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = join(root, p);
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!f.startsWith(root) || !existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(f)] ?? 'application/octet-stream', 'Content-Security-Policy': CSP });
  res.end(readFileSync(f));
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const axeSource = readFileSync(new URL('./node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');

const browser = await chromium.launch();
const results = [];
const VIEWPORTS = { mobile: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
const shotDir = join(root, 'screenshots');
mkdirSync(shotDir, { recursive: true });
for (const f of htmls) {
  const rel = relative(dir, f);
  for (const scheme of ['light', 'dark']) {
    for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
      const ctx = await browser.newContext({ viewport, colorScheme: scheme, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      const errs = [];
      page.on('console', (m) => { if (m.type() === 'error' || /Content Security Policy/i.test(m.text())) errs.push(m.text()); });
      page.on('pageerror', (e) => errs.push(String(e)));
      page.on('requestfailed', (r) => errs.push(`request failed ${r.url()}`));
      page.on('request', (r) => { if (!r.url().startsWith(origin)) errs.push(`off-origin request ${r.url()}`); });
      page.on('response', (r) => { if (r.status() >= 400) errs.push(`HTTP ${r.status()} ${r.url()}`); });
      await page.goto(`${origin}/${option}/${rel}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const fontState = await page.evaluate(() => [...document.fonts].map((x) => `${x.family} ${x.weight} ${x.status}`));
      for (const s of fontState) if (/ error$/.test(s)) errs.push(`font failed: ${s}`);
      if (vpName === 'mobile') {
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (over > 0) errs.push(`horizontal overflow ${over}px at 390`);
      }
      const axe = await page.evaluate(async (src) => {
        // eslint-disable-next-line no-eval
        (0, eval)(src);
        const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
        return {
          violations: r.violations.map((v) => ({ id: v.id, n: v.nodes.length, sample: v.nodes.slice(0, 3).map((n) => `${n.target.join(' ')} ${n.any?.[0]?.message ?? ''}`) })),
          incomplete: r.incomplete.filter((v) => v.id === 'color-contrast').reduce((n, v) => n + v.nodes.length, 0),
        };
      }, axeSource);
      for (const v of axe.violations) errs.push(`axe ${v.id} x${v.n}: ${v.sample.join(' | ')}`);
      if (target) errs.push(...await interactionProblems(page, target));
      results.push({ page: rel, scheme, vp: vpName, fonts: fontState.length, contrastNeedsReview: axe.incomplete, errors: errs });
      for (const e of errs) fail(`${rel} [${scheme} ${vpName}] ${e}`);
      if (shots) {
        const name = `${option}${rel === 'index.html' ? '' : '-' + rel.replace(/\.html$/, '').replace(/\//g, '-')}-${vpName}${scheme === 'dark' ? '-dark' : ''}.png`;
        await page.screenshot({ path: join(shotDir, name), fullPage: true });
      }
      await ctx.close();
    }
  }
}
await browser.close();
server.close();

console.log(JSON.stringify({ option, sizeKB: Math.round(size / 1024), contrast, runs: results.map(({ errors, ...r }) => ({ ...r, errors: errors.length })) }, null, 1));
if (problems.length) { console.error(`\n${problems.length} problem(s):\n- ${[...new Set(problems)].join('\n- ')}`); process.exit(1); }
console.error(`\n${option}: all checks passed`);
