// Usage: node thumbs.mjs: writes ../thumbs/<option>.jpg, the top 390x600 of each option's
// homepage in light mode, for the gallery page, served over http (CSS masks fail on file://).
import { readdirSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
mkdirSync(join(root, 'thumbs'), { recursive: true });
const server = await serve(root);
const browser = await chromium.launch();
for (const opt of readdirSync(root).filter((f) => /^option-\d[a-z]?-/.test(f)).sort()) {
  const page = await browser.newPage({ viewport: { width: 390, height: 600 }, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto(`${server.origin}/${opt}/index.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(root, 'thumbs', `${opt}.jpg`), type: 'jpeg', quality: 78 });
  await page.close();
  console.log(`thumbs/${opt}.jpg`);
}
await browser.close();
server.close();
