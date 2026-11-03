#!/usr/bin/env node
// Turns the raw app frames (capture.spec.mjs) into the store files:
//
//   node compose.mjs [--locales de-DE,en-US] [--stores play,appstore] [--devices play-phone,...]
//
// out/<locale>/<device>/<n>-<scene>.png   the P2 frame (frame.mjs) around the capture, at the store size
// out/<locale>/play/feature-graphic.png   1024 x 500
// out/<locale>/play/icon-512.png          the app icon, from design/app-icon's 1024 px asset
// out/<locale>/contact-sheet.png          every file of the locale on one sheet
// out/manifest.json                       size, pixel format, bytes and sha256 per file, caption status
// out/summary.md                          the same as a table (the workflow's job summary)
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
import { featurePage, framePage, HEAD, settleAndMeasure } from './frame.mjs';
import { DEVICES, FEATURE_GRAPHIC, ICON, LOCALES, STORES, deviceProblems, shots } from './sets.mjs';

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
const devices = opt('devices', Object.keys(DEVICES));
const captions = parse(readFileSync(join(here, 'captions.yaml'), 'utf8'));
const ruleProblems = Object.keys(DEVICES).flatMap(deviceProblems);
if (ruleProblems.length) throw new Error(`sets.mjs breaks a store rule:\n${ruleProblems.join('\n')}`);

const url = (p) => pathToFileURL(p).href;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Legal N-23: no retailer names in a store frame (nor logos or colours, which the frame never draws).
const RETAILERS = /(?<![\p{L}])(edeka|rewe|lidl|aldi|kaufland|netto|penny|dm|rossmann|müller|norma|globus)(?![\p{L}])/iu;

function caption(locale, id) {
  const c = captions[locale]?.[id];
  const lines = id === 'feature' ? [c?.title, c?.accent] : [...(c?.title ?? []), c?.sub];
  if (lines.length !== (id === 'feature' ? 2 : 3) || lines.some((l) => typeof l !== 'string' || !l)) {
    throw new Error(`captions.yaml: ${locale} ${id} needs ${id === 'feature' ? 'a title and an accent' : 'a title of two lines and a sub'}`);
  }
  const text = lines.join(' ');
  if (/humm(?!list)/i.test(text) || /HummList/.test(text)) throw new Error(`${locale} ${id}: write "Hummlist" in full`);
  if (/premium|€|\$|preis|price/i.test(text)) throw new Error(`${locale} ${id}: no Premium or prices in a store frame`);
  if (RETAILERS.test(text)) throw new Error(`${locale} ${id}: no retailer names in a store frame (Legal N-23)`);
  return c;
}

/** A capture and what capture.spec.mjs measured in it. */
function capture(locale, kind, scene) {
  const dir = join(OUT, 'raw', locale, kind);
  const file = join(dir, `${scene}.png`);
  if (!existsSync(file)) throw new Error(`no capture ${relative(OUT, file)}: run capture.spec.mjs first`);
  return { dir, raw: { file, meta: JSON.parse(readFileSync(join(dir, `${scene}.json`), 'utf8')) } };
}

const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');

function probe(file) {
  const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height,pix_fmt', '-of', 'json', file], { encoding: 'utf8' }));
  return j.streams[0];
}

/** Renders a page to PNG at w x h, then flattens it to RGB24. Returns the frame's measurements. */
async function render(page, html, w, h, file) {
  mkdirSync(WORK, { recursive: true });
  const src = join(WORK, 'page.html');
  writeFileSync(src, html);
  await page.setViewportSize({ width: w, height: h });
  await page.goto(url(src));
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  const measured = await page.evaluate(settleAndMeasure);
  const tmp = join(WORK, 'shot.png');
  await page.screenshot({ path: tmp });
  mkdirSync(join(file, '..'), { recursive: true });
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', tmp, '-pix_fmt', 'rgb24', file]);
  return measured;
}

/** Play's guidance: text at most 20 % of a screenshot; and the caption never runs into the card. */
function frameProblems(file, { clear, text }) {
  const problems = [];
  if (!clear) problems.push('the caption runs into the card');
  if (text > 0.2) problems.push(`text covers ${(text * 100).toFixed(1)} % (at most 20 %)`);
  if (problems.length) throw new Error(`${relative(OUT, file)}: ${problems.join('; ')}`);
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
    for (const s of shots({ locales: [locale], stores }).filter((x) => devices.includes(x.device))) {
      const { dir, raw } = capture(locale, s.capture, s.scene);
      const file = join(OUT, locale, s.device, `${s.n}-${s.scene}.png`);
      const { width, height } = DEVICES[s.device];
      const measured = await render(page, framePage({ W: width, H: height, caption: caption(locale, s.scene), raw, dir }), width, height, file);
      frameProblems(file, measured);
      const status = captions[locale][s.scene].status;
      record(file, { width, height }, { locale, device: s.device, scene: s.scene, caption: status, captionPx: measured.size, textShare: Number(measured.text.toFixed(3)) });
      if (status !== 'approved' && !manifest.drafts.includes(`${locale} ${s.scene}`)) manifest.drafts.push(`${locale} ${s.scene}`);
      done.push(file);
    }
    if (stores.includes('play')) {
      const { raw } = capture(locale, DEVICES['play-phone'].capture, 'list');
      const fg = join(OUT, locale, 'play', 'feature-graphic.png');
      const { width: W, height: H } = FEATURE_GRAPHIC;
      frameProblems(fg, await render(page, featurePage({ W, H, caption: caption(locale, 'feature'), raw }), W, H, fg));
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
const summary = [
  '| File | Size | Pixels | Caption |', '| --- | --- | --- | --- |',
  ...manifest.files.map((f) => `| \`${f.file}\` | ${f.width} x ${f.height} | ${f.pixFmt} | ${f.caption ?? ''} |`),
  '', manifest.drafts.length ? `Draft captions: ${manifest.drafts.join(', ')}` : 'Every caption is approved.',
];
writeFileSync(join(OUT, 'summary.md'), `${summary.join('\n')}\n`);
if (manifest.drafts.length) console.log(`draft captions (not approved yet): ${manifest.drafts.join(', ')}`);
