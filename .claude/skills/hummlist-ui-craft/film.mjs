#!/usr/bin/env node
// Films a Hummlist scene (a standalone HTML page) with the repo's Playwright: a poster still,
// a contact sheet of seeked frames, a loop-seam diff, or a WebM + MP4 loop. Also puts existing
// PNGs (Flutter goldens, ffmpeg stills) on one contact sheet. See references/review.md.
//
//   node film.mjs <file.html|url> --out <prefix> [--width 720 --height 340] [--select css]
//        [--scale 2] [--dark] [--reduced]
//        --still [--at ms]                     -> <prefix>.png (+ .webp with ffmpeg)
//        --every ms --count n [--from ms]      -> <prefix>-sheet.png (+ frames in <prefix>-frames/)
//        --seam ms                             -> diff of frame 0 vs frame <ms>, exit 1 over 0.5 %
//        --video seconds [--fps 30]            -> <prefix>.webm (VP9) + <prefix>.mp4 (H.264), silent
//   node film.mjs sheet <png...> --out <prefix> [--cols 4]
//
// Frames are seeked: every CSS/Web Animation is paused and set to the time, or the page's own
// window.scene.seek(ms) is called when it exists. Needs `npm ci` in e2e/ once.
import { createRequire } from 'node:module';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const { chromium } = createRequire(resolve(root, 'e2e/package.json'))('@playwright/test');

const BOOL = new Set(['still', 'dark', 'reduced']);
const opts = {};
const positional = [];
for (let a = process.argv.slice(2), i = 0; i < a.length; i++) {
  if (!a[i].startsWith('--')) positional.push(a[i]);
  else if (BOOL.has(a[i].slice(2))) opts[a[i].slice(2)] = true;
  else opts[a[i].slice(2)] = a[++i];
}
const flag = (name, def) => opts[name] ?? def;
const num = (name, def) => (opts[name] === undefined ? def : Number(opts[name]));
const out = flag('out');
if (!out || positional.length === 0) {
  console.error('usage: film.mjs <file.html|url> --out <prefix> [...] | film.mjs sheet <png...> --out <prefix>');
  process.exit(2);
}
mkdirSync(dirname(resolve(out)), { recursive: true });
const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
const ffmpeg = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);

const browser = await chromium.launch();
try {
  if (positional[0] === 'sheet') {
    const files = positional.slice(1);
    await sheet(files.map((f) => ({ label: basename(f), png: readFileSync(f) })), `${out}-sheet.png`, num('cols', 4));
  } else {
    await film(positional[0]);
  }
} finally {
  await browser.close();
}

async function film(target) {
  const url = /^[a-z]+:\/\//.test(target) ? target : pathToFileURL(resolve(target)).href;
  const width = num('width', 720);
  const height = num('height', 340);
  const scale = num('scale', 2);
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    colorScheme: flag('dark') ? 'dark' : 'light',
    reducedMotion: flag('reduced') ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  page.on('console', (m) => m.type() === 'error' && console.warn(`[page] ${m.text()}`));
  page.on('pageerror', (e) => console.warn(`[page] ${e.message}`));
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const select = flag('select');
  const shot = async (ms) => {
    await page.evaluate(async (t) => {
      if (window.scene?.seek) return void (await window.scene.seek(t));
      for (const a of document.getAnimations()) { a.pause(); a.currentTime = t; }
    }, ms);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    return select ? page.locator(select).first().screenshot() : page.screenshot();
  };

  if (flag('still')) {
    const png = await shot(num('at', 0));
    writeFileSync(`${out}.png`, png);
    if (hasFfmpeg) ffmpeg(['-i', `${out}.png`, '-quality', '90', `${out}.webp`]);
    console.log(`still: ${out}.png${hasFfmpeg ? ` ${out}.webp` : ''}`);
  }
  if (flag('every')) {
    const every = num('every', 500), count = num('count', 24), from = num('from', 0);
    const dir = `${out}-frames`;
    mkdirSync(dir, { recursive: true });
    const frames = [];
    for (let i = 0; i < count; i++) {
      const t = from + i * every;
      const png = await shot(t);
      writeFileSync(`${dir}/${String(t).padStart(6, '0')}.png`, png);
      frames.push({ label: `${t} ms`, png });
    }
    await sheet(frames, `${out}-sheet.png`, num('cols', width > 500 ? 3 : 5), width);
  }
  if (flag('seam')) {
    const a = await shot(0), b = await shot(num('seam', 0));
    const pct = await diff(a, b);
    console.log(`seam: ${pct.toFixed(2)} % of pixels differ between 0 ms and ${flag('seam')} ms`);
    if (pct > 0.5) process.exitCode = 1;
  }
  if (flag('video')) {
    if (!hasFfmpeg) throw new Error('--video needs ffmpeg on PATH');
    const fps = num('fps', 30), seconds = num('video', 12);
    const dir = `${out}-video-frames`;
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    for (let i = 0; i < Math.round(seconds * fps); i++) {
      writeFileSync(`${dir}/${String(i).padStart(5, '0')}.png`, await shot((i * 1000) / fps));
    }
    const input = ['-framerate', String(fps), '-i', `${dir}/%05d.png`, '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-an'];
    ffmpeg([...input, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', `${out}.mp4`]);
    ffmpeg([...input, '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p', '-b:v', '0', '-crf', '34', '-row-mt', '1', `${out}.webm`]);
    rmSync(dir, { recursive: true, force: true });
    console.log(`video: ${out}.mp4 ${out}.webm (${seconds} s at ${fps} fps, silent)`);
  }
  await context.close();
}

// One page of frames at true size (CSS width = design width), labelled, screenshotted whole.
async function sheet(frames, file, cols, cellWidth) {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const img = (f) => `<figure><img src="data:image/png;base64,${f.png.toString('base64')}"${cellWidth ? ` style="width:${cellWidth}px"` : ''}><figcaption>${f.label}</figcaption></figure>`;
  await page.setContent(`<style>body{margin:16px;background:#d3d8e6;font:12px Inter,system-ui,sans-serif;color:#0f1530}
    main{display:inline-grid;grid-template-columns:repeat(${cols},max-content);gap:12px}figure{margin:0}
    img{display:block;max-width:${cellWidth ? 'none' : '480px'};outline:1px solid #0f153033}figcaption{margin-top:4px}</style>
    <main>${frames.map(img).join('')}</main>`);
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  const w = await page.evaluate(() => document.querySelector('main').scrollWidth + 32);
  await page.setViewportSize({ width: Math.max(w, 320), height: 600 });
  await page.screenshot({ path: file, fullPage: true });
  await page.close();
  console.log(`sheet: ${file} (${frames.length} frames)`);
}

// Share of pixels whose RGB differs by more than 8 on any channel.
async function diff(a, b) {
  const page = await browser.newPage();
  const pct = await page.evaluate(async ([x, y]) => {
    const load = async (s) => createImageBitmap(await (await fetch(`data:image/png;base64,${s}`)).blob());
    const [ia, ib] = await Promise.all([load(x), load(y)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return 100;
    const px = (bm) => { const c = new OffscreenCanvas(bm.width, bm.height).getContext('2d'); c.drawImage(bm, 0, 0); return c.getImageData(0, 0, bm.width, bm.height).data; };
    const da = px(ia), db = px(ib);
    let n = 0;
    for (let i = 0; i < da.length; i += 4) {
      if (Math.abs(da[i] - db[i]) > 8 || Math.abs(da[i + 1] - db[i + 1]) > 8 || Math.abs(da[i + 2] - db[i + 2]) > 8) n++;
    }
    return (n / (da.length / 4)) * 100;
  }, [a.toString('base64'), b.toString('base64')]);
  await page.close();
  return pct;
}
