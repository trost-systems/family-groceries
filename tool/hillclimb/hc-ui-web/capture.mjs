// Captures the fixed hc-ui-web page set from a built site/dist, served locally by
// site/scripts/preview.mjs (never a production host), into <out>/<name>.png plus shots.txt.
// Usage: node capture.mjs <dist> <out>
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const { chromium } = createRequire(join(repo, 'site/checks/package.json'))('playwright');
const { serve } = await import(join(repo, 'site/checks/lib.mjs'));

const [dist, out] = process.argv.slice(2).map((p) => resolve(p));
mkdirSync(out, { recursive: true });

const HEIGHT = { 390: 844, 1440: 900 };
// tiles: how many viewport-high slices from the top; 'all' covers the full page.
const SET = [
  { name: 'home-de', path: '/de', width: 1440, scheme: 'light', tiles: 'all' },
  { name: 'home-de', path: '/de', width: 1440, scheme: 'dark', tiles: 'all' },
  { name: 'home-de', path: '/de', width: 390, scheme: 'light', tiles: 'all' },
  { name: 'home-de', path: '/de', width: 390, scheme: 'dark', tiles: 2 },
  { name: 'home-de-focus', path: '/de', width: 1440, scheme: 'light', tiles: 1, tabs: 3 },
  { name: 'home-en', path: '/en', width: 1440, scheme: 'light', tiles: 1 },
  { name: 'home-en', path: '/en', width: 390, scheme: 'dark', tiles: 1 },
  { name: 'guides', path: '/de/anleitungen', width: 1440, scheme: 'light', tiles: 1 },
  { name: 'guides', path: '/de/anleitungen', width: 390, scheme: 'dark', tiles: 2 },
  { name: 'guide-siri', path: '/de/anleitungen/siri-kurzbefehl', width: 1440, scheme: 'light', tiles: 2 },
  { name: 'guide-siri', path: '/de/anleitungen/siri-kurzbefehl', width: 1440, scheme: 'dark', tiles: 1 },
  { name: 'guide-siri', path: '/de/anleitungen/siri-kurzbefehl', width: 390, scheme: 'light', tiles: 2 },
  { name: 'changelog', path: '/de/changelog', width: 1440, scheme: 'light', tiles: 1 },
  { name: 'changelog', path: '/de/changelog', width: 390, scheme: 'dark', tiles: 1 },
  { name: 'privacy', path: '/datenschutz', width: 1440, scheme: 'light', tiles: 1 },
  { name: 'privacy', path: '/datenschutz', width: 390, scheme: 'dark', tiles: 1 },
  { name: 'support', path: '/support', width: 1440, scheme: 'light', tiles: 1 },
  { name: 'notfound', path: '/404', width: 390, scheme: 'light', tiles: 1 },
];

const server = await serve(dist);
const browser = await chromium.launch();
const shots = [];
try {
  for (const s of SET) {
    const height = HEIGHT[s.width];
    const page = await browser.newPage({
      viewport: { width: s.width, height }, deviceScaleFactor: 1, colorScheme: s.scheme, reducedMotion: 'reduce',
    });
    await page.goto(server.origin + s.path, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      const imgs = [...document.images];
      for (const img of imgs) img.loading = 'eager';
      await Promise.all(imgs.map((img) => img.decode().catch(() => {})));
      await document.fonts.ready;
    });
    for (let i = 0; i < (s.tabs ?? 0); i++) await page.keyboard.press('Tab');
    const full = await page.evaluate(() => document.documentElement.scrollHeight);
    const count = s.tiles === 'all' ? Math.ceil(full / height) : s.tiles;
    for (let t = 0; t < count; t++) {
      const y = t * height;
      if (y >= full) break;
      const name = `${s.name}-${s.width}-${s.scheme}-${t + 1}.png`;
      await page.screenshot({
        path: join(out, name), fullPage: true, animations: 'disabled', caret: 'hide',
        clip: { x: 0, y, width: s.width, height: Math.min(height, full - y) },
      });
      shots.push(name);
    }
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
writeFileSync(join(out, 'shots.txt'), shots.join('\n') + '\n');
console.error(`captured ${shots.length} shots`);
