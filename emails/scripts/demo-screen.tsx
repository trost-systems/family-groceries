// Writes site/public/email/demo-list-de.png, the demo screen in the component catalog's
// PhoneScreenshot: the homepage's add-tick scene (the fictional Brandt household), its screen
// only, at 2x. The app has no row checkbox, so the crop hides the scene's (job 57 removes it
// from the scenes too). site/ is served through request routing, no port is opened.
//   flock /tmp/fg-e2e.lock npx tsx scripts/demo-screen.tsx    (needs flutter on PATH for the icons)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const site = fileURLToPath(new URL('../../site/', import.meta.url));
const flutter = realpathSync(execFileSync('which', ['flutter'], { encoding: 'utf8' }).trim());
const iconFont = resolve(dirname(flutter), 'cache/artifacts/material_fonts/MaterialIcons-Regular.otf');
const types: Record<string, string> = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.otf': 'font/otf', '.png': 'image/png' };
const [WIDTH, HEIGHT] = [240, 300];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 358, height: 448 }, deviceScaleFactor: 2 });
await page.route('http://site.local/**', (route) => {
  const path = new URL(route.request().url()).pathname;
  const file = path === '/scenes/material-icons.otf' ? iconFont : join(site, path);
  if (!existsSync(file)) return route.fulfill({ status: 404 });
  return route.fulfill({ body: readFileSync(file), contentType: types[extname(file)] ?? 'application/octet-stream' });
});
await page.goto('http://site.local/scenes/add-tick.html?lang=de');
await page.evaluate(() => document.fonts.ready);
await page.addStyleTag({ content: `.cb, .sticker, .item.filler { display: none !important; }
  .phone { transform: none !important; } .screen { width: ${WIDTH}px !important; height: ${HEIGHT}px !important; overflow: hidden !important; }` });
const out = join(site, 'public/email/demo-list-de.png');
await page.locator('.screen').screenshot({ path: out });
await browser.close();
console.log(`wrote ${out}`);
