#!/usr/bin/env node
// Turns the raw app frames (capture.spec.mjs) into the store files:
//
//   node compose.mjs [--locales de-DE,en-US] [--stores play,appstore]
//
// out/<locale>/<device>/<n>-<scene>.png   caption band + device + app frame, at the store size
// out/<locale>/play/feature-graphic.png   1024 x 500
// out/<locale>/play/icon-512.png          the app icon, from design/app-icon's 1024 px asset
// out/<locale>/contact-sheet.png          every file of the locale on one sheet
// out/manifest.json                       size, pixel format, bytes and sha256 per file, caption status
//
// Each frame is an HTML page rendered by Chromium at its exact pixel size, then flattened by
// ffmpeg to 24-bit RGB without alpha (both stores refuse alpha). Fails when a file breaks a rule.

import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';
import { DEVICES, FEATURE_GRAPHIC, ICON, LOCALES, STORES, layout, shots } from './sets.mjs';

const here = new URL('.', import.meta.url).pathname;
const repo = join(here, '../..');
const OUT = process.env.STORE_SHOTS_OUT ?? join(here, 'out');
const WORK = join(OUT, 'work');
const args = process.argv.slice(2);
const opt = (name, all) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1].split(',') : all;
};
const locales = opt('locales', Object.keys(LOCALES));
const stores = opt('stores', STORES);
const captions = parse(readFileSync(join(here, 'captions.yaml'), 'utf8'));

const url = (p) => pathToFileURL(p).href;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function caption(locale, id) {
  const c = captions[locale]?.[id];
  if (!c?.title || !c?.sub) throw new Error(`captions.yaml has no ${locale} title and sub for ${id}`);
  if (/humm(?!list)|HummList/i.test(`${c.title} ${c.sub}`)) throw new Error(`${locale} ${id}: write "Hummlist" in full`);
  if (/premium|€|\$|preis|price/i.test(`${c.title} ${c.sub}`)) throw new Error(`${locale} ${id}: no Premium or prices in a store frame`);
  return c;
}

const HEAD = `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="${url(join(repo, 'site/public/tokens.css'))}">
<style>
@font-face { font-family: "Bricolage Grotesque"; src: url("${url(join(repo, 'site/public/fonts/bricolage-grotesque-latin-standard-normal.woff2'))}") format("woff2"); font-weight: 200 800; }
@font-face { font-family: "Inter"; src: url("${url(join(repo, 'site/public/fonts/inter-latin-wght-normal.woff2'))}") format("woff2"); font-weight: 100 900; }
* { margin: 0; box-sizing: border-box; }
html, body { overflow: hidden; }
body { background: var(--hl-color-cobalt); color: var(--hl-color-on-cobalt); }
.title { font-family: "Bricolage Grotesque"; font-weight: 800; letter-spacing: -0.01em; line-height: 1.08; text-wrap: balance; }
.sub { font-family: "Inter"; font-weight: 500; color: var(--hl-color-accent-soft); line-height: 1.3; text-wrap: balance; }
.body { position: absolute; background: var(--hl-color-ink); }
.screen { position: absolute; overflow: hidden; background: var(--hl-color-surface); }
.screen img { display: block; width: 100%; }
</style>`;

/** One store frame: the caption centred in the band, the device below with its foot off the edge. */
function framePage(locale, device, scene, raw) {
  const { width: W, height: H } = DEVICES[device];
  const g = layout(device);
  const c = caption(locale, scene);
  const u = g.unit;
  return `${HEAD}<body style="width:${W}px;height:${H}px">
<div style="position:absolute;left:${Math.round(70 * u)}px;right:${Math.round(70 * u)}px;top:0;height:${g.band}px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:${Math.round(18 * u)}px">
  <p class="title" style="font-size:${Math.round(66 * u)}px">${esc(c.title)}</p>
  <p class="sub" style="font-size:${Math.round(34 * u)}px">${esc(c.sub)}</p>
</div>
<div class="body" style="left:${g.body.x}px;top:${g.body.y}px;width:${g.body.width}px;height:${H - g.body.y + g.body.radius}px;border-radius:${g.body.radius}px"></div>
<div class="screen" style="left:${g.screen.x}px;top:${g.screen.y}px;width:${g.screen.width}px;height:${g.screen.height + g.screen.radius}px;border-radius:${g.screen.radius}px ${g.screen.radius}px 0 0">
  <img src="${url(raw)}">
</div>
</body>`;
}

/** The Play feature graphic: icon and the approved line on cobalt, the list on a phone at the right. */
function featurePage(locale, raw) {
  const { width: W, height: H } = FEATURE_GRAPHIC;
  const c = caption(locale, 'feature');
  const icon = join(repo, 'app/ios/Runner/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png');
  return `${HEAD}<body style="width:${W}px;height:${H}px">
<div style="position:absolute;left:64px;top:0;width:560px;height:${H}px;display:flex;flex-direction:column;justify-content:center;gap:20px">
  <div style="display:flex;align-items:center;gap:18px">
    <img src="${url(icon)}" style="width:72px;height:72px;border-radius:16px;box-shadow:0 0 0 2px var(--hl-color-ink)">
    <span class="title" style="font-size:40px">Hummlist</span>
  </div>
  <p class="title" style="font-size:50px">${esc(c.title)}</p>
  <p class="sub" style="font-size:24px">${esc(c.sub)}</p>
</div>
<div class="body" style="left:680px;top:56px;width:290px;height:500px;border-radius:30px"></div>
<div class="screen" style="left:690px;top:66px;width:270px;height:470px;border-radius:22px 22px 0 0"><img src="${url(raw)}"></div>
</body>`;
}

const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');

function probe(file) {
  const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height,pix_fmt', '-of', 'json', file], { encoding: 'utf8' }));
  return j.streams[0];
}

/** Renders a page to PNG at w x h, then flattens it to RGB24. */
async function render(page, html, w, h, file) {
  mkdirSync(WORK, { recursive: true });
  const src = join(WORK, 'page.html');
  writeFileSync(src, html);
  await page.setViewportSize({ width: w, height: h });
  await page.goto(url(src));
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  const tmp = join(WORK, 'shot.png');
  await page.screenshot({ path: tmp });
  mkdirSync(join(file, '..'), { recursive: true });
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', tmp, '-pix_fmt', 'rgb24', file]);
}

const manifest = { files: [], drafts: [] };

function record(file, want, extra = {}) {
  const p = probe(file);
  const problems = [];
  if (p.width !== want.width || p.height !== want.height) problems.push(`${p.width}x${p.height}, want ${want.width}x${want.height}`);
  if (p.pix_fmt !== 'rgb24') problems.push(`pixel format ${p.pix_fmt}, want rgb24 (no alpha)`);
  const bytes = readFileSync(file).length;
  if (bytes > 8_000_000) problems.push(`${bytes} bytes, Play takes at most 8 MB`);
  if (problems.length) throw new Error(`${relative(OUT, file)}: ${problems.join('; ')}`);
  manifest.files.push({ file: relative(OUT, file), width: p.width, height: p.height, pixFmt: p.pix_fmt, bytes, sha256: sha(file), ...extra });
}

const browser = await chromium.launch();
const page = await (await browser.newContext({ colorScheme: 'light', deviceScaleFactor: 1 })).newPage();
try {
  for (const locale of locales) {
    const done = [];
    for (const s of shots({ locales: [locale], stores })) {
      const raw = join(OUT, 'raw', locale, s.device, `${s.scene}.png`);
      if (!existsSync(raw)) throw new Error(`no capture ${relative(OUT, raw)}: run capture.spec.mjs first`);
      const file = join(OUT, locale, s.device, `${s.n}-${s.scene}.png`);
      const { width, height } = DEVICES[s.device];
      await render(page, framePage(locale, s.device, s.scene, raw), width, height, file);
      const status = captions[locale][s.scene].status;
      record(file, { width, height }, { locale, device: s.device, scene: s.scene, caption: status });
      if (status !== 'approved') manifest.drafts.push(`${locale} ${s.scene}`);
      done.push(file);
    }
    if (stores.includes('play')) {
      const raw = join(OUT, 'raw', locale, 'play-phone', 'list.png');
      const fg = join(OUT, locale, 'play', 'feature-graphic.png');
      await render(page, featurePage(locale, raw), FEATURE_GRAPHIC.width, FEATURE_GRAPHIC.height, fg);
      record(fg, FEATURE_GRAPHIC, { locale, device: 'play-feature-graphic', caption: captions[locale].feature.status });
      if (captions[locale].feature.status !== 'approved') manifest.drafts.push(`${locale} feature`);
      const icon = join(OUT, locale, 'play', 'icon-512.png');
      execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', join(repo, 'app/ios/Runner/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png'),
        '-vf', 'scale=512:512:flags=lanczos', '-pix_fmt', 'rgb24', icon]);
      record(icon, ICON, { locale, device: 'play-icon' });
      done.push(fg, icon);
    }
    const sheet = join(OUT, locale, 'contact-sheet.png');
    const tiles = done.map((f) => `<figure><img src="${url(f)}"><figcaption>${esc(relative(join(OUT, locale), f))}</figcaption></figure>`).join('');
    const html = `${HEAD}<style>body{background:#e9ecf3;color:#0f1530;padding:24px;width:2400px;display:flex;flex-wrap:wrap;gap:24px;align-items:flex-end}
figure{display:flex;flex-direction:column;gap:8px}figure img{height:520px;box-shadow:0 0 0 1px #0f1530}figcaption{font:500 16px Inter}</style><body>${tiles}</body>`;
    mkdirSync(WORK, { recursive: true });
    writeFileSync(join(WORK, 'sheet.html'), html);
    await page.setViewportSize({ width: 2448, height: 600 });
    await page.goto(url(join(WORK, 'sheet.html')));
    await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
    await page.screenshot({ path: join(WORK, 'sheet.png'), fullPage: true });
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', join(WORK, 'sheet.png'), '-pix_fmt', 'rgb24', sheet]);
    console.log(`${locale}: ${done.length} files, contact sheet ${relative(repo, sheet)}`);
  }
} finally {
  await browser.close();
}
rmSync(WORK, { recursive: true, force: true });
writeFileSync(join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`);
if (manifest.drafts.length) console.log(`draft captions (not approved yet): ${manifest.drafts.join(', ')}`);
