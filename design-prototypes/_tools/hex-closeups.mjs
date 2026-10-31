// Usage: node hex-closeups.mjs <option-dir>... [--out ../screenshots/41]
// Close-ups of a primary button and a chip on the token sheet in rest, hover, pressed
// (mouse held down) and focus-visible (Tab), light and dark, at 2x. Motion is reduced so
// every state is captured as it settles.
import { mkdirSync } from 'node:fs';
import { join, resolve, basename, dirname } from 'node:path';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const out = resolve(outIdx >= 0 ? args[outIdx + 1] : join(import.meta.dirname, '../screenshots/41'));
const dirs = args.filter((a, i) => !a.startsWith("--") && (outIdx < 0 || i !== outIdx + 1)).map((d) => resolve(d));
mkdirSync(out, { recursive: true });

const TARGETS = {
  button: '#form .components a.hex:not(.hex--ink):not(.hex--light)',
  chip: '#form button.hex--chip[aria-pressed="false"]',
};
const PAD = 16;

const root = dirname(dirs[0]);
const server = await serve(root);
const browser = await chromium.launch();
for (const dir of dirs) {
  for (const scheme of ['light', 'dark']) {
    for (const [name, sel] of Object.entries(TARGETS)) {
      for (const state of ['rest', 'hover', 'pressed', 'focus']) {
        const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 2, colorScheme: scheme, reducedMotion: 'reduce' });
        await page.goto(`${server.origin}/${basename(dir)}/tokens-sheet.html`, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        const el = page.locator(sel).first();
        await el.scrollIntoViewIfNeeded();
        const box = await el.boundingBox();
        const cx = box.x + box.width / 2; const cy = box.y + box.height / 2;
        if (state === 'hover') await page.mouse.move(cx, cy);
        if (state === 'pressed') { await page.mouse.move(cx, cy); await page.mouse.down(); }
        await page.waitForTimeout(300);
        if (state === 'focus') {
          // Focus the element just before it in tab order, then Tab, so :focus-visible matches.
          await el.evaluate((e) => { const prev = e.previousElementSibling ?? e.parentElement; if (prev.tabIndex < 0) prev.setAttribute('tabindex', '-1'); prev.focus(); });
          await page.keyboard.press('Tab');
          if (!(await el.evaluate((e) => e === document.activeElement))) throw new Error(`${sel} did not take focus`);
        }
        const file = `${basename(dir)}-${name}-${state}${scheme === 'dark' ? '-dark' : ''}.png`;
        await page.screenshot({ path: join(out, file), clip: { x: box.x - PAD, y: box.y - PAD, width: box.width + 2 * PAD, height: box.height + 2 * PAD } });
        if (state === 'pressed') await page.mouse.up();
        await page.close();
      }
    }
  }
  console.log(`${basename(dir)}: 16 close-ups in ${out}`);
}
await browser.close();
server.close();
