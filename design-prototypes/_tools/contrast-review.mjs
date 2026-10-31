// Usage: node contrast-review.mjs <option-dir>...
// axe leaves text over background images, gradients and pseudo-elements "needs review".
// This pass loads each page over a local http server (no CSP; CSS masks need http), removes background images (paper
// textures, gradients), reruns axe's color-contrast rule in light and dark at 390 and
// 1440. Nodes axe still cannot decide (overlapped by a sticky header, backgrounds from
// pseudo-elements) are measured from pixels: the node is scrolled into view, fixed and
// sticky elements are hidden, its text is made transparent, its box is captured, and its
// text colour is compared with the median and the 10th-percentile background pixel.
// Fails on any axe violation or a median below the WCAG AA threshold for the text size.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
import { PNG } from 'pngjs';

const axeSource = readFileSync(new URL('./node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const lum = (rgb) => { const [r, g, b] = rgb.map((c) => c / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const server = await serve(resolve(process.argv[2], '..'));
const browser = await chromium.launch();
let bad = 0;
for (const dir of process.argv.slice(2).map((d) => resolve(d))) {
  for (const page of readdirSync(dir).filter((f) => f.endsWith('.html'))) {
    for (const colorScheme of ['light', 'dark']) {
      for (const width of [390, 1440]) {
        const p = await browser.newPage({ viewport: { width, height: 900 }, colorScheme, reducedMotion: 'reduce' });
        await p.goto(`${server.origin}/${basename(dir)}/${page}`, { waitUntil: 'networkidle' });
        await p.addStyleTag({ content: '*, *::before, *::after { background-image: none !important; }' });
        const r = await p.evaluate(async (src) => {
          (0, eval)(src);
          const res = await window.axe.run(document, { runOnly: { type: 'rule', values: ['color-contrast'] } });
          const msg = (n) => `${n.target.join(' ')} :: ${(n.any[0]?.message ?? '').slice(0, 90)}`;
          const textual = (n) => !/non-text|too short/.test(n.any[0]?.message ?? '');
          return {
            passes: res.passes.reduce((s, v) => s + v.nodes.length, 0),
            violations: res.violations.flatMap((v) => v.nodes.map(msg)),
            incomplete: res.incomplete.flatMap((v) => v.nodes.filter(textual).map((n) => n.target[0])),
          };
        }, axeSource);
        const measured = [];
        for (const sel of r.incomplete) {
          const info = await p.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el || !el.getClientRects().length) return null;
            el.scrollIntoView({ block: 'center' });
            for (const x of document.querySelectorAll('body *')) {
              const pos = getComputedStyle(x).position;
              if ((pos === 'fixed' || pos === 'sticky') && !x.contains(el)) x.setAttribute('data-cr-hidden', x.style.visibility || ' ');
            }
            for (const x of document.querySelectorAll('[data-cr-hidden]')) x.style.visibility = 'hidden';
            const cs = getComputedStyle(el);
            const svg = el instanceof SVGElement;
            const color = svg ? cs.fill : cs.color;
            const size = parseFloat(cs.fontSize); const weight = Number(cs.fontWeight);
            el.setAttribute('data-cr-color', el.style.color || ' ');
            el.style.setProperty('color', 'transparent', 'important');
            el.style.setProperty('-webkit-text-fill-color', 'transparent', 'important');
            el.style.setProperty('text-shadow', 'none', 'important');
            el.style.setProperty('text-decoration-color', 'transparent', 'important');
            if (svg) el.style.setProperty('fill', 'transparent', 'important');
            const r = el.getBoundingClientRect();
            return { color, large: size >= 24 || (size >= 18.66 && weight >= 700), rect: { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.max(1, Math.min(r.width, innerWidth - r.x)), height: Math.max(1, Math.min(r.height, innerHeight - r.y)) } };
          }, sel);
          if (!info) continue;
          const png = PNG.sync.read(await p.screenshot({ clip: info.rect }));
          if (process.env.CR_DEBUG) {
            await p.evaluate((sel) => { const el = document.querySelector(sel); for (const k of ['color', '-webkit-text-fill-color', 'fill']) el.style.removeProperty(k); }, sel);
            const pad = { x: Math.max(0, info.rect.x - 40), y: Math.max(0, info.rect.y - 30) };
            info.debugShot = await p.screenshot({ clip: { ...pad, width: info.rect.width + 80, height: info.rect.height + 60 } });
          }
          await p.evaluate((sel) => {
            const el = document.querySelector(sel);
            for (const k of ['color', '-webkit-text-fill-color', 'text-shadow', 'text-decoration-color', 'fill']) el.style.removeProperty(k);
            for (const x of document.querySelectorAll('[data-cr-hidden]')) { x.style.visibility = ''; x.removeAttribute('data-cr-hidden'); }
          }, sel);
          const [tr, tg, tb, ta = 1] = info.color.match(/[\d.]+/g).map(Number);
          const ratios = [];
          for (let i = 0; i < png.data.length; i += 4) {
            const bg = [png.data[i], png.data[i + 1], png.data[i + 2]];
            const fg = [tr, tg, tb].map((c, k) => c * ta + bg[k] * (1 - ta));
            ratios.push(contrast(fg, bg));
          }
          ratios.sort((a, b) => a - b);
          const median = ratios[Math.floor(ratios.length / 2)]; const p10 = ratios[Math.floor(ratios.length / 10)];
          const min = info.large ? 3 : 4.5;
          measured.push({ sel, median, p10, min });
          if (process.env.CR_DEBUG && median < min) writeFileSync(join(process.env.CR_DEBUG, `${basename(dir)}-${page}-${colorScheme}-${width}-${measured.length}.png`), info.debugShot);
        }
        const failing = measured.filter((m) => m.median < m.min);
        const thin = measured.filter((m) => m.median >= m.min && m.p10 < m.min);
        bad += r.violations.length + failing.length;
        const lowest = measured.reduce((a, m) => (!a || m.median < a.median ? m : a), null);
        console.log(`${basename(dir)}/${page} ${colorScheme} ${width}: axe pass ${r.passes}, FAIL ${r.violations.length}; pixel-measured ${measured.length}, FAIL ${failing.length}, lowest median ${lowest ? lowest.median.toFixed(2) : '-'}`);
        for (const v of r.violations) console.log(`   FAIL axe ${v}`);
        for (const m of failing) console.log(`   FAIL pixels ${m.sel} median ${m.median.toFixed(2)} < ${m.min}`);
        for (const m of thin) console.log(`   note ${m.sel}: median ${m.median.toFixed(2)}, 10th percentile ${m.p10.toFixed(2)} (mixed background)`);
        await p.close();
      }
    }
  }
}
await browser.close();
server.close();
process.exit(bad ? 1 : 0);
