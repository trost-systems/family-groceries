// Screenshots and a press clip of a served Widgetbook build (scripts/widgetbook.sh) into
// docs/screenshots/52/widgetbook/. Each shot opens the catalogue at a story with the addons set
// through the URL, as the catalogue writes them itself; every request must stay on the origin
// and succeed. Uses e2e/'s Playwright.
//
//   node scripts/widgetbook-shots.mjs [origin, default http://127.0.0.1:57590]
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const repo = new URL('..', import.meta.url).pathname;
const { chromium } = createRequire(join(repo, 'e2e/package.json'))('playwright');
const origin = process.argv[2] ?? 'http://127.0.0.1:57590';
const out = join(repo, 'docs/screenshots/52/widgetbook');
mkdirSync(out, { recursive: true });

const states = 'Material/Buttons/FilledButton/Alle Zustände';
const shots = [
  { name: 'home', ui: 'light', query: {} },
  { name: 'button-states-light', ui: 'light', query: { path: states, theme: '{name:Hell}' } },
  { name: 'button-states-dark', ui: 'dark', query: { path: states, theme: '{name:Dunkel}' } },
  { name: 'colour-tokens', ui: 'light', query: { path: 'Tokens/Farben/Palette', theme: '{name:Hell}' } },
  { name: 'contrast-pairs', ui: 'dark', query: { path: 'Tokens/Farben/Kontrastpaare', theme: '{name:Dunkel}' } },
  { name: 'list-iphone-dark', ui: 'dark', query: { path: 'Hummlist/Liste/Ausschnitt', theme: '{name:Dunkel}', viewport: '{name:iPhone 13}' } },
];

const url = (query) => {
  const q = new URLSearchParams(query).toString();
  return `${origin}/${q ? `#/?${q}` : ''}`;
};

const problems = [];
function watch(page, name) {
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`${name}: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`${name}: page error ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`${name}: failed ${r.url()}`));
  page.on('request', (r) => { if (!r.url().startsWith(origin)) problems.push(`${name}: off-origin ${r.url()}`); });
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`${name}: HTTP ${r.status()} ${r.url()}`); });
}

async function open(page, query) {
  await page.goto(url(query), { waitUntil: 'networkidle' });
  await page.waitForSelector('flutter-view');
  await page.waitForTimeout(2500);
}

const browser = await chromium.launch();
for (const shot of shots) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: shot.ui });
  const page = await ctx.newPage();
  watch(page, shot.name);
  await open(page, shot.query);
  await page.screenshot({ path: join(out, `${shot.name}.png`) });
  console.log(`${shot.name}: ${decodeURIComponent(page.url().replace(origin, ''))}`);
  await ctx.close();
}

// The playground at time dilation 4: three presses, each sinking and bouncing back. The clip
// is the preview area only; the button sits at its centre.
const clip = { width: 640, height: 360 };
const ctx = await browser.newContext({
  viewport: clip,
  colorScheme: 'light',
  recordVideo: { dir: join(out, 'tmp-video'), size: clip },
});
const recordingStart = Date.now();
const page = await ctx.newPage();
watch(page, 'press');
await open(page, {
  path: 'Material/Buttons/FilledButton/Spielwiese',
  theme: '{name:Hell}',
  'time-dilation': '{value:4.00}',
  // Preview mode: the story without the catalogue's panels.
  preview: '',
});
const { width, height } = clip;
const target = { x: width / 2, y: height / 2 - 18 };
await page.mouse.move(target.x, target.y);
const firstPress = (Date.now() - recordingStart + 400) / 1000;
for (let i = 0; i < 3; i++) {
  await page.waitForTimeout(700);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
}
await page.waitForTimeout(1200);
await page.screenshot({ path: join(out, 'press-end.png') });
await ctx.close();
const videos = join(out, 'tmp-video');
const [video] = readdirSync(videos);
// The clip starts shortly before the first press, without the catalogue loading.
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(firstPress), '-i', join(videos, video),
  '-c:v', 'libvpx', '-b:v', '400k', '-an', join(out, 'press-bounce.webm')]);
rmSync(videos, { recursive: true });

await browser.close();
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`${shots.length} screenshots and press-bounce.webm in ${out}, no failed or off-origin request`);
