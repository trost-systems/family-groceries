// Usage: node app-icon/check.mjs
// Checks the built design-prototypes/app-icon/ files themselves: sizes, opacity, Android's
// safe zone on the rendered foreground, the vector drawables against the PNGs, the brand name.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { PNG } from 'pngjs';
import { chromium } from 'playwright';
import { VARIATIONS, TOP } from './variations.mjs';

const root = resolve(dirname(new URL(import.meta.url).pathname), '../../app-icon');
const problems = [];
const fail = (m) => problems.push(m);
const png = (rel) => PNG.sync.read(readFileSync(join(root, rel)));
const alphaAt = (img, x, y) => img.data[(y * img.width + x) * 4 + 3];

if (VARIATIONS.length < 10 || VARIATIONS.length > 20) fail(`${VARIATIONS.length} variations, the brief asks for 10 to 20`);
const sheet = png('sprite-sheet.png');
if (sheet.width < 1000) fail(`sprite sheet only ${sheet.width} px wide`);

const browser = await chromium.launch();
const tab = await browser.newPage();

// A vector drawable read back into SVG: only the subset build.mjs writes.
function vdToSvg(xml, size) {
  const vp = Number(xml.match(/android:viewportWidth="([^"]+)"/)[1]);
  const tx = Number(xml.match(/android:translateX="([^"]+)"/)[1]);
  const ty = Number(xml.match(/android:translateY="([^"]+)"/)[1]);
  const paths = [...xml.matchAll(/<path android:fillColor="([^"]+)"( android:fillType="evenOdd")? android:pathData="([^"]+)"\/>/g)];
  if (!paths.length) throw new Error('no paths');
  const body = paths.map(([, c, eo, d]) => `<path fill="${c.length === 9 ? `#${c.slice(3)}` : c}"${eo ? ' fill-rule="evenodd"' : ''} d="${d}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vp} ${vp}" width="${size}" height="${size}"><g transform="translate(${tx} ${ty})">${body}</g></svg>`;
}
async function renderPng(svg, size) {
  await tab.setViewportSize({ width: size, height: size });
  await tab.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`);
  return PNG.sync.read(await tab.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } }));
}
function diff(a, b) {
  let bad = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    if ([0, 1, 2, 3].some((k) => Math.abs(a.data[i + k] - b.data[i + k]) > 24)) bad++;
  }
  return bad / (a.width * a.height);
}

for (const { n } of TOP) {
  const v = VARIATIONS.find((x) => x.n === n);
  const dir = `top/${v.n}-${v.slug}`;
  const size = (rel, w) => {
    if (!existsSync(join(root, rel))) return fail(`missing ${rel}`);
    const img = png(rel);
    if (img.width !== w || img.height !== w) fail(`${rel} is ${img.width}x${img.height}, expected ${w}`);
    return img;
  };
  // visionOS: an opaque back, transparent foregrounds.
  const back = size(`${dir}/visionos/back.png`, 1024);
  if (back && [...Array(back.width * back.height).keys()].some((i) => back.data[i * 4 + 3] !== 255)) fail(`${dir}/visionos/back.png is not fully opaque`);
  for (const l of ['middle', 'front']) {
    const img = size(`${dir}/visionos/${l}.png`, 1024);
    if (img && alphaAt(img, 0, 0) !== 0) fail(`${dir}/visionos/${l}.png has no transparent corner`);
  }
  for (const m of ['light', 'dark', 'clear', 'tinted']) size(`${dir}/previews/apple-${m}.png`, 1024);
  const play = size(`${dir}/android/play-store-512.png`, 512);
  if (play && alphaAt(play, 0, 0) !== 255) fail(`${dir}/android/play-store-512.png must be a full opaque square`);
  for (const [d, s] of Object.entries({ mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 })) size(`${dir}/android/res/mipmap-${d}/ic_launcher.png`, s);

  // Android: the foreground stays inside the 66 dp circle (432 px = 108 dp, so 4 px per dp).
  const fg = size(`${dir}/android/png/foreground-432.png`, 432);
  if (fg) {
    let outside = 0;
    for (let y = 0; y < 432; y++) for (let x = 0; x < 432; x++) if (Math.hypot(x + 0.5 - 216, y + 0.5 - 216) > 33 * 4 + 1 && alphaAt(fg, x, y) > 8) outside++;
    if (outside) fail(`${dir} foreground has ${outside} px outside the 66 dp safe circle`);
  }
  // Each vector drawable renders like its PNG.
  for (const layer of ['foreground', 'background', 'monochrome']) {
    const xml = readFileSync(join(root, `${dir}/android/res/drawable/ic_launcher_${layer}.xml`), 'utf8');
    if (!xml.includes('android:width="108dp"')) fail(`${layer}.xml is not 108 dp`);
    const ref = png(`${dir}/android/png/${layer}-432.png`);
    const off = diff(await renderPng(vdToSvg(xml, 432), 432), ref);
    if (off > 0.002) fail(`${dir} ${layer}.xml differs from its PNG on ${(off * 100).toFixed(2)} % of pixels`);
  }
  const adaptive = readFileSync(join(root, `${dir}/android/res/mipmap-anydpi-v26/ic_launcher.xml`), 'utf8');
  for (const l of ['background', 'foreground', 'monochrome']) if (!adaptive.includes(`<${l} android:drawable="@drawable/ic_launcher_${l}"/>`)) fail(`ic_launcher.xml lacks ${l}`);
  // Monochrome: one colour, the shape lives in alpha only.
  const mono = png(`${dir}/android/png/monochrome-432.png`);
  for (let i = 0; i < mono.data.length; i += 4) if (mono.data[i + 3] > 0 && (mono.data[i] > 8 || mono.data[i + 1] > 8 || mono.data[i + 2] > 8)) { fail(`${dir} monochrome has a second colour`); break; }
  // Icon Composer: at most 4 groups.
  const groups = readdirSync(join(root, dir, 'icon-composer')).filter((f) => statSync(join(root, dir, 'icon-composer', f)).isDirectory());
  if (groups.length < 1 || groups.length > 4) fail(`${dir} has ${groups.length} Icon Composer groups`);
}
await browser.close();

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
for (const f of walk(root).filter((f) => /\.(html|svg|md|xml|css)$/.test(f))) {
  if (/\bHumm\b/.test(readFileSync(f, 'utf8'))) fail(`${f}: "Humm" without "list"`);
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`app-icon ok: ${VARIATIONS.length} variations, top ${TOP.map((t) => t.n).join(', ')}`);
