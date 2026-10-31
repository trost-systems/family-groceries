// Usage: node app-icon/build.mjs
// Writes design-prototypes/app-icon/ from variations.mjs: the sprite sheet (SVG + PNG), the
// layered assets of the TOP picks (Icon Composer groups, visionOS layers, Android adaptive
// icon), the preview images, and the preview page. Run check.mjs afterwards.
import { mkdirSync, rmSync, writeFileSync, readFileSync, cpSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { chromium } from 'playwright';
import { VARIATIONS, FAMILIES, TOP, ORIGINAL5 } from './variations.mjs';
import * as R from './render.mjs';
import { page as previewPage, stackCss } from './page.mjs';

const here = dirname(new URL(import.meta.url).pathname);
const out = resolve(here, '../../app-icon');
const font = (file) => readFileSync(resolve(here, '../../option-3b-hex-soft/fonts', file)).toString('base64');

for (const v of [...VARIATIONS, ...ORIGINAL5]) {
  const problems = R.checkVariation(v);
  if (problems.length) throw new Error(`variation ${v.n} ${v.name}: ${problems.join('; ')}`);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const write = (rel, content) => {
  mkdirSync(dirname(join(out, rel)), { recursive: true });
  writeFileSync(join(out, rel), content);
};

const browser = await chromium.launch();
const tab = await browser.newPage();
const fontFace = `@font-face{font-family:"Nunito";src:url(data:font/woff2;base64,${font('nunito-latin-wght-normal.woff2')}) format("woff2");font-weight:200 1000}`;
async function png(svgText, size, rel) {
  const [w, h] = typeof size === 'number' ? [size, size] : size;
  const sized = svgText.replace(/<svg ([^>]*?)width="[^"]*" height="[^"]*"/, `<svg $1width="${w}" height="${h}"`);
  await tab.setViewportSize({ width: w, height: h });
  await tab.setContent(`<!doctype html><style>${fontFace}html,body{margin:0;background:transparent}svg{display:block}</style>${sized}`);
  await tab.evaluate(() => document.fonts.ready);
  mkdirSync(dirname(join(out, rel)), { recursive: true });
  await tab.screenshot({ path: join(out, rel), omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
}

// Sprite sheet: one cell per variation, the icon at 180 px in light and 72 px in dark, plus
// the real 29 px and 16 px renders as the legibility check.
const COLS = 4;
const CW = 340, CH = 300, PAD = 30, HEAD = 120;
const rows = Math.ceil(VARIATIONS.length / COLS);
const W = PAD * 2 + COLS * CW, H = HEAD + rows * CH + PAD;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
function placed(v, appearance, x, y, size) {
  const { defs, body } = R.artGroup(v, appearance);
  return { defs, body: `<g transform="translate(${x} ${y}) scale(${size / R.CANVAS})">${body}</g>` };
}
const defs = [];
const cells = VARIATIONS.map((v, i) => {
  const x = PAD + (i % COLS) * CW, y = HEAD + Math.floor(i / COLS) * CH;
  const parts = [placed(v, 'light', x + 12, y + 12, 180), placed(v, 'dark', x + 212, y + 12, 72), placed(v, 'light', x + 212, y + 124, 29), placed(v, 'light', x + 262, y + 130, 16)];
  defs.push(...parts.map((p) => p.defs));
  return `<g>
<rect x="${x + 2}" y="${y + 2}" width="${CW - 4}" height="${CH - 4}" rx="18" fill="#ffffff" stroke="#e3dccb"/>
${parts.map((p) => p.body).join('\n')}
<text x="${x + 212}" y="${y + 104}" class="cap">dunkel</text>
<text x="${x + 212}" y="${y + 176}" class="cap">29 px</text>
<text x="${x + 258}" y="${y + 176}" class="cap">16 px</text>
<text x="${x + 14}" y="${y + 236}" class="name">${v.n} · ${esc(v.name)}</text>
<text x="${x + 14}" y="${y + 262}" class="fam">${esc(FAMILIES[v.family])}</text>
</g>`;
});
const spriteSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<title>Hummlist App-Icon: ${VARIATIONS.length} Varianten</title>
<style>text{font-family:Nunito,"Baloo 2",Arial,sans-serif;fill:#1c1a17}.h{font-size:34px;font-weight:800}.sub{font-size:17px;fill:#5e5548}.name{font-size:21px;font-weight:800}.fam,.cap{font-size:14px;fill:#5e5548}</style>
<defs>${defs.join('')}</defs>
<rect width="${W}" height="${H}" fill="#fbf7ec"/>
<text x="${PAD + 4}" y="62" class="h">Hummlist App-Icon: ${VARIATIONS.length} Varianten</text>
<text x="${PAD + 4}" y="94" class="sub">Je Kachel: hell in groß, dunkel, dazu echte 29 px und 16 px. Hex Weich (3b): 1 bis 8, Frische (5): 9 bis 13 und 15, Verbindung 3b × 5: 14 und 16.</text>
${cells.join('\n')}
</svg>
`;
write('sprite-sheet.svg', spriteSvg);
await png(spriteSvg, [W, H], 'sprite-sheet.png');

// The top picks, and (job 48) the same three in option 5's original colours.
const ANDROID_MASKS = ['circle', 'squircle', 'rounded', 'cookie'];
const LEGACY = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const slugOf = (s) => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const tops = TOP.map((t) => ({ ...VARIATIONS.find((v) => v.n === t.n), ...t }));
// Small sizes as real pixels: 29 pt at 1x and 3x, 16 px, Android 48 dp at mdpi and xxhdpi.
const SMALL = [['apple-29', 29, 'apple'], ['apple-87', 87, 'apple'], ['apple-16', 16, 'apple'], ['android-48', 48, 'circle'], ['android-144', 144, 'circle']];
for (const v of [...tops, ...ORIGINAL5]) {
  const dir = `top/${v.n}-${v.slug}`;
  // Icon Composer: one folder per group, one SVG per coloured element (each becomes a layer).
  const fills = [];
  write(`${dir}/icon-composer/background.svg`, R.backgroundSvg(v, 'light'));
  v.layers.forEach((l, gi) => {
    const els = l.els.filter((e) => e.role);
    els.forEach((e, li) => {
      const file = `${dir}/icon-composer/${gi + 1}-${slugOf(l.name)}/${li + 1}-${e.role}.svg`;
      write(file, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><path fill="${R.colorsFor(v, 'light')[e.role]}" d="${e.shape.d}"/></svg>\n`);
      fills.push({ file: file.slice(dir.length + 1), group: l.name, light: R.colorsFor(v, 'light')[e.role], dark: R.colorsFor(v, 'dark')[e.role], mono: e.mono === 'cut' ? 'Schwarz, 60 % Deckkraft' : 'Weiß' });
    });
  });
  write(`${dir}/icon-composer/README.md`, iconComposerReadme(v, fills));
  for (const mode of R.APPLE_MODES) {
    write(`${dir}/previews/apple-${mode}.svg`, R.preview(v, mode, { size: 1024 }));
    await png(R.preview(v, mode), 1024, `${dir}/previews/apple-${mode}.png`);
  }
  for (const [name, size, mask] of SMALL) {
    for (const mode of ['light', 'dark']) await png(R.preview(v, mode, { mask }), size, `${dir}/previews/small/${name}-${mode}.png`);
  }
  // visionOS: back, middle and front layer at 1024, the foreground ones transparent.
  const vision = [['back', R.backgroundSvg(v, 'light')], ['middle', R.layerSvg(v, 0, 'light')], ['front', R.layerSvg(v, 1, 'light')]];
  for (const [name, s] of vision) {
    write(`${dir}/visionos/${name}.svg`, s);
    await png(s, 1024, `${dir}/visionos/${name}.png`);
  }
  // Android adaptive icon.
  write(`${dir}/android/res/drawable/ic_launcher_foreground.xml`, R.androidForegroundXml(v));
  write(`${dir}/android/res/drawable/ic_launcher_background.xml`, R.androidBackgroundXml(v));
  write(`${dir}/android/res/drawable/ic_launcher_monochrome.xml`, R.androidMonoXml(v));
  write(`${dir}/android/res/mipmap-anydpi-v26/ic_launcher.xml`, R.adaptiveIconXml);
  for (const [name, s] of [['foreground', R.androidForegroundSvg(v, 432)], ['background', R.androidBackgroundSvg(v, 432)], ['monochrome', R.androidMonoSvg(v, 432)]]) {
    write(`${dir}/android/svg/${name}.svg`, s);
    await png(s, 432, `${dir}/android/png/${name}-432.png`);
  }
  for (const [density, size] of Object.entries(LEGACY)) await png(R.preview(v, 'light', { mask: 'rounded' }), size, `${dir}/android/res/mipmap-${density}/ic_launcher.png`);
  await png(R.preview(v, 'light', { mask: 'none' }), 512, `${dir}/android/play-store-512.png`);
  for (const mask of ANDROID_MASKS) write(`${dir}/previews/android-${mask}.svg`, R.androidPreview(v, mask, 1024));
  for (const mode of ['themed-light', 'themed-dark']) write(`${dir}/previews/${mode}.svg`, R.preview(v, mode, { mask: 'circle', size: 1024 }));
}

writeFileSync(join(out, 'index.html'), previewPage({ variations: VARIATIONS, tops, originals: ORIGINAL5, families: FAMILIES, spriteSize: [W, H] }));
writeFileSync(join(out, 'app-icon.css'), `${readFileSync(resolve(here, 'app-icon.css'), 'utf8')}\n${stackCss([...tops, ...ORIGINAL5])}\n`);
for (const f of ['nunito-latin-wght-normal.woff2', 'baloo-2-latin-wght-normal.woff2', 'OFL-Nunito.txt', 'OFL-Baloo2.txt']) cpSync(resolve(here, '../../option-3b-hex-soft/fonts', f), join(out, 'fonts', f));
await browser.close();
console.log(`wrote ${out}`);

function iconComposerReadme(v, fills) {
  const c = R.colorsFor(v, 'light'), d = R.colorsFor(v, 'dark');
  return `# ${v.n} · ${v.name}: Icon Composer

Generated by \`design-prototypes/_tools/app-icon/build.mjs\`; edit \`variations.mjs\`, not these files.

1. Open Icon Composer (Xcode 26 or later, or the standalone app on macOS Tahoe 26.4 or later) and create a new icon.
2. Select the icon in the sidebar and set the background fill: Default \`${c.bg}\`, Dark \`${d.bg}\`. \`background.svg\` is the same colour as a file, for tools that want one.
3. Drag the numbered folders into the sidebar in order. Each folder becomes a group (bottom to top), each SVG a layer.
4. Set the fills per appearance from the table (Default comes with the SVG). Mono is our starting point; tune it against the clear and tinted previews in \`../previews/\` (\`apple-clear-light.png\`, \`apple-clear-dark.png\`, \`apple-tinted-light.png\`, \`apple-tinted-dark.png\`).
5. Leave the glass, shadow and specular settings at their defaults first. The art is flat on purpose.
6. Save as \`AppIcon.icon\` and drag it into the Xcode project next to the asset catalog.

| Layer file | Group | Default | Dark | Mono |
| --- | --- | --- | --- | --- |
${fills.map((x) => `| \`${x.file}\` | ${x.group} | \`${x.light}\` | \`${x.dark}\` | ${x.mono} |`).join('\n')}
`;
}
