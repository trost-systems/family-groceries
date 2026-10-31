// Usage: node app-icon/shots.mjs <worktree>
// Screenshots of the published app icon page (site/dist, served like Vercel) into
// ../screenshots/45/: full page and the first favourite, mobile and desktop, light and dark.
import { mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { chromium } from 'playwright';
import { serveDist } from '../serve-dist.mjs';

const out = resolve(dirname(new URL(import.meta.url).pathname), '../../screenshots/45');
mkdirSync(out, { recursive: true });
const { origin, close } = await serveDist(process.argv[2]);
const browser = await chromium.launch();
for (const colorScheme of ['light', 'dark']) {
  for (const [name, width] of [['mobile', 390], ['desktop', 1440]]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme, reducedMotion: 'reduce', deviceScaleFactor: name === 'mobile' ? 2 : 1 });
    const page = await ctx.newPage();
    await page.goto(`${origin}/design-prototypes/app-icon`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(out, `app-icon-${name}-${colorScheme}.png`), fullPage: true });
    for (const id of ['top-5', 'top-14', 'top-13']) await page.locator(`#${id}`).screenshot({ path: join(out, `${id}-${name}-${colorScheme}.png`) });
    if (name === 'desktop' && colorScheme === 'light') {
      await page.goto(`${origin}/design-prototypes`, { waitUntil: 'networkidle' });
      await page.screenshot({ path: join(out, 'gallery-desktop-light.png') });
    }
    await ctx.close();
  }
}
await browser.close();
close();
console.log(`screenshots in ${out}`);
