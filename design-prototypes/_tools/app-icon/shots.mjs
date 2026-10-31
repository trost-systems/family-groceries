// Usage: node app-icon/shots.mjs <worktree> [45|48]
// Screenshots of the published app icon page (site/dist, served like Vercel), mobile and desktop,
// light and dark. 45 (default): the full page and each favourite into ../screenshots/45/.
// 48: the "original 5 colours" section and each of its rows into ../screenshots/48/.
import { mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { chromium } from 'playwright';
import { serveDist } from '../serve-dist.mjs';

const job = process.argv[3] ?? '45';
const out = resolve(dirname(new URL(import.meta.url).pathname), `../../screenshots/${job}`);
const ids = job === '48' ? ['original5', 'o-5o', 'o-13o', 'o-14o'] : ['top-5', 'top-14', 'top-13'];
mkdirSync(out, { recursive: true });
const { origin, close } = await serveDist(process.argv[2]);
const browser = await chromium.launch();
for (const colorScheme of ['light', 'dark']) {
  for (const [name, width] of [['mobile', 390], ['desktop', 1440]]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme, reducedMotion: 'reduce', deviceScaleFactor: name === 'mobile' ? 2 : 1 });
    const page = await ctx.newPage();
    await page.goto(`${origin}/design-prototypes/app-icon`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    if (job === '45') await page.screenshot({ path: join(out, `app-icon-${name}-${colorScheme}.png`), fullPage: true });
    for (const id of ids) await page.locator(`#${id}`).screenshot({ path: join(out, `${id}-${name}-${colorScheme}.png`) });
    if (job === '45' && name === 'desktop' && colorScheme === 'light') {
      await page.goto(`${origin}/design-prototypes`, { waitUntil: 'networkidle' });
      await page.screenshot({ path: join(out, 'gallery-desktop-light.png') });
    }
    await ctx.close();
  }
}
await browser.close();
close();
console.log(`screenshots in ${out}`);
