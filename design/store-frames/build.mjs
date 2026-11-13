#!/usr/bin/env node
// Renders the store-screenshot frame proposals FR1 to FR5 (job 77, redone for Snacklist in job 214): for each proposal six phone shots at
// 1080 x 1920 and a 1024 x 500 feature graphic, as 24-bit PNG without alpha (Play's format), from
// the app captures in raw/ (capture.mjs) and the proposals in proposals/. Each proposal draws one 6480 x 1920
// strip, cut into the six shots, so a panoramic frame and a framed one go through the same code.
// Needs `npm ci` in e2e/ once (Playwright's Chromium) and ffmpeg.
//
//   node design/store-frames/build.mjs [FR1,FR3...]   render all proposals, or the named ones
//     --out <dir>   full-size PNGs (default /tmp/store-frames)
//     --site        also write the review page (site/public/internal/store-frames.html), its
//                   stylesheet and WebP images (site/public/internal/store-frames/)
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEATURE, PHONE, SHOT_COUNT, STRIP, page, raw, rawPath } from './kit.mjs';
import { LOCALE, SHOTS } from './shots.mjs';
import { PROPOSALS } from './proposals/index.mjs';
import { ASSETS, PAGE, REVIEW_CSS, reviewPage } from './review.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const { chromium } = createRequire(join(root, 'e2e/package.json'))('@playwright/test');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const out = value('--out', '/tmp/store-frames');
const only = args.find((a) => /^FR\d/.test(a))?.split(',');
const sitePublic = join(root, 'site/public');
const siteDir = join(sitePublic, ASSETS);

const flatten = (src, dest) => execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-pix_fmt', 'rgb24', dest]);
const webp = (src, dest, width) =>
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf', `scale=${width}:-1:flags=lanczos`, '-c:v', 'libwebp', '-quality', '86', dest]);

const browser = await chromium.launch();
async function shoot(html, { w, h }, file, clips) {
  const tmp = `${file}.html`;
  writeFileSync(tmp, html);
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.goto(`file://${tmp}`);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  for (const { path, clip } of clips) await p.screenshot({ path, clip });
  const coverage = await p.evaluate(textCoverage, clips.map((c) => c.clip ?? { x: 0, y: 0, width: w, height: h }));
  await p.close();
  rmSync(tmp);
  return coverage;
}

// Share of each clip covered by the frame's own text (captions, labels, bubbles; the app's
// captures are images and don't count), for Play's guidance of at most 20 %.
function textCoverage(clips) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const rects = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    rects.push(...range.getClientRects());
  }
  return clips.map((c) => {
    const area = rects.reduce((sum, r) => {
      const w = Math.min(r.right, c.x + c.width) - Math.max(r.left, c.x);
      const h = Math.min(r.bottom, c.y + c.height) - Math.max(r.top, c.y);
      return sum + (w > 0 && h > 0 ? w * h : 0);
    }, 0);
    return area / (c.width * c.height);
  });
}

for (const proposal of PROPOSALS) {
  if (only && !only.includes(proposal.id)) continue;
  const dir = join(out, proposal.id);
  mkdirSync(dir, { recursive: true });
  const shots = proposal.order.map((key, i) => ({
    key,
    index: i,
    ...SHOTS[key],
    src: raw(LOCALE, SHOTS[key].raw),
    path: rawPath(LOCALE, SHOTS[key].raw),
    senderSrc: SHOTS[key].sender && raw(LOCALE, SHOTS[key].sender.raw),
    caption: proposal.captions[key],
  }));
  if (shots.length !== SHOT_COUNT) throw new Error(`${proposal.id}: ${shots.length} shots, expected ${SHOT_COUNT}`);

  const strip = proposal.strip(shots);
  const tmpShots = shots.map((_, i) => ({ path: join(dir, `.shot-${i + 1}.png`), clip: { x: i * PHONE.w, y: 0, width: PHONE.w, height: PHONE.h } }));
  const coverage = await shoot(page({ ...STRIP, ...strip }), STRIP, join(dir, 'strip'), tmpShots);
  const feature = proposal.feature(shots);
  const tmpFeature = join(dir, '.feature.png');
  await shoot(page({ ...FEATURE, ...feature }), FEATURE, join(dir, 'feature'), [{ path: tmpFeature }]);

  const files = [];
  tmpShots.forEach(({ path }, i) => {
    const name = `phone-${i + 1}.png`;
    flatten(path, join(dir, name));
    files.push([path, name, 720]);
  });
  flatten(tmpFeature, join(dir, 'feature-graphic.png'));
  files.push([tmpFeature, 'feature-graphic.png', 1024]);
  if (flag('--site')) {
    mkdirSync(siteDir, { recursive: true });
    for (const [src, name, width] of files) webp(src, join(siteDir, `${proposal.id.toLowerCase()}-${name.replace('.png', '.webp')}`), width);
  }
  for (const [src] of files) rmSync(src);
  const text = coverage.map((c) => `${(c * 100).toFixed(1)} %`).join(', ');
  console.log(`${proposal.id} ${proposal.name}: ${dir} (text per shot: ${text})`);
  if (coverage.some((c) => c > 0.2)) throw new Error(`${proposal.id}: a shot has more than 20 % text`);
}
await browser.close();

if (flag('--site')) {
  const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const date = new Date().toISOString().slice(0, 10);
  writeFileSync(join(sitePublic, PAGE), reviewPage(PROPOSALS, { commit, date }));
  writeFileSync(join(siteDir, 'review.css'), REVIEW_CSS);
  console.log(`review page: site/public/${PAGE}`);
}
