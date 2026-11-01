#!/usr/bin/env node
// Records a short how-to clip of the real Hummlist web build (verify-hummlist's instance) for one
// feature id, per language, and exports an email GIF, MP4 + WebM for the site and a PNG fallback.
//
//   node .cursor/skills/hummlist-howto-clips/clip.mjs <feature-id> [--lang de|en|both] [--out dir]
//        [--dark] [--keep-frames]
//
// Writes <out>/<feature-id>/<lang>.gif|.mp4|.webm|.png and <out>/<feature-id>/meta.json.
// Needs helpers/launch.sh of verify-hummlist to have run (stack, build, web server); each language
// seeds its own demo household (scripts/<feature-id>.mjs names the scenario) and tears it down.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { commit, instance, openApp, repo, signIn } from '../verify-hummlist/helpers/lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, def) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : def);
const feature = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.match(/^--(lang|out)$/));
const scriptFile = join(here, 'scripts', `${feature}.mjs`);
if (!feature || !existsSync(scriptFile)) {
  console.error(`usage: clip.mjs <feature-id> [--lang de|en|both] [--out dir]; scripts: ${execFileSync('ls', [join(here, 'scripts')], { encoding: 'utf8' }).replace(/\.mjs/g, '').split('\n').filter(Boolean).join(', ')}`);
  process.exit(64);
}
const langs = opt('lang', 'both') === 'both' ? ['de', 'en'] : [opt('lang')];
const out = resolve(opt('out', '/workspace/hummlist/research/60-feature-map/clips'), feature);
const story = await import(scriptFile);

// Email budget (job 60): 480-600 px wide, at most 1.5 MB, 10-15 fps. Tried in order until one fits.
const GIF_BUDGET = 1.5 * 1024 * 1024;
const GIF_TRIES = [
  { width: 480, fps: 12, colors: 128 }, { width: 480, fps: 10, colors: 96 },
  { width: 480, fps: 10, colors: 64 }, { width: 480, fps: 10, colors: 48 },
];
const VIEWPORT = { width: 390, height: 844 };
const DPR = 2;
const SITE_FPS = 30;

const ffmpeg = (a) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a]);
const size = (f) => statSync(f).size;
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const gifsicle = spawnSync('gifsicle', ['--version']).status === 0;

mkdirSync(out, { recursive: true });
const inst = instance();
const meta = { feature, commit: commit(), recorded: new Date().toISOString(), source: `Hummlist web build ${inst.commit} on a local test stack`, scenario: {}, clips: {} };
for (const lang of langs) meta.clips[lang] = await record(lang);
writeFileSync(join(out, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
console.log(`meta: ${join(out, 'meta.json')}`);

async function record(lang) {
  const scenario = story.scenario[lang];
  meta.scenario[lang] = scenario;
  const seeded = seed(scenario);
  const work = join(out, `.work-${lang}`);
  rmSync(work, { recursive: true, force: true });
  mkdirSync(join(work, 'frames'), { recursive: true });
  const { browser, page, L, errors } = await openApp(inst, { lang, viewport: VIEWPORT, dpr: DPR, dark: flag('dark') });
  try {
    await signIn(page, L, seeded.user);
    await story.prepare?.({ page, L, lang });
    await page.waitForTimeout(600);
    const frames = await screencast(page, work, () => story.play({ page, L, lang, tap: (locator) => tap(page, locator), pause: (ms) => page.waitForTimeout(ms) }));
    if (errors.length) throw new Error(`page errors while filming: ${errors.join('; ')}`);
    return encode(lang, work, frames);
  } finally {
    await browser.close();
    teardown(seeded.run);
    if (!flag('keep-frames')) rmSync(work, { recursive: true, force: true });
  }
}

// fg seed on the instance's stack, through verify-hummlist's env (port block, state dir).
function fg(...a) {
  const env = join(repo, '.cursor/skills/verify-hummlist/helpers/env.sh');
  return JSON.parse(execFileSync('bash', ['-c', `source "${env}" && "${repo}/scripts/fg" "$@"`, 'fg', ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
}
function seed(scenario) {
  const result = fg('seed', scenario);
  if (!result.ok) throw new Error(`fg seed ${scenario}: ${JSON.stringify(result.error)}`);
  const creds = JSON.parse(readFileSync(result.credentials, 'utf8'));
  return { run: result.run, user: Object.values(creds.users)[0] };
}
function teardown(run) {
  const result = fg('teardown', run);
  if (!result.ok) console.warn(`fg teardown ${run} failed; run it by hand`);
}

// A finger on a phone: a dot where the tap lands (motion.md), drawn over the canvas, then the tap.
async function tap(page, locator) {
  const box = await locator.boundingBox();
  const x = box.x + Math.min(box.width * 0.75, box.width - 24), y = box.y + box.height / 2;
  await page.evaluate(([x, y]) => {
    const dot = document.createElement('div');
    dot.style.cssText = `position:fixed;left:${x - 22}px;top:${y - 22}px;width:44px;height:44px;border-radius:50%;
      background:rgba(15,21,48,.22);border:2px solid rgba(15,21,48,.35);pointer-events:none;z-index:2147483647;
      transform:scale(.6);transition:transform 160ms ease-out,opacity 260ms ease-in 200ms`;
    document.body.append(dot);
    requestAnimationFrame(() => { dot.style.transform = 'scale(1)'; dot.style.opacity = '0'; });
    setTimeout(() => dot.remove(), 600);
  }, [x, y]);
  await page.waitForTimeout(90);
  await page.mouse.click(x, y);
}

// Every painted frame with its timestamp, from Chromium's screencast at device pixels.
async function screencast(page, work, play) {
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    const file = join(work, 'frames', `${String(frames.length).padStart(5, '0')}.jpg`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    frames.push({ file, t: metadata.timestamp });
    await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, everyNthFrame: 1 });
  await page.waitForTimeout(400);
  const start = Date.now() / 1000;
  await play();
  const end = Date.now() / 1000;
  await page.waitForTimeout(200);
  await cdp.send('Page.stopScreencast');
  writeFileSync(join(work, 'poster.png'), await page.screenshot());
  const kept = frames.filter((f) => f.t <= end + 0.05);
  const first = kept.findLast((f) => f.t <= start) ?? kept[0];
  return { frames: kept.slice(kept.indexOf(first)), start, end };
}

function encode(lang, work, { frames, start, end }) {
  // A constant-rate master from the timestamped frames; the end state holds for story.hold ms.
  const list = frames.map((f, i) => {
    const from = Math.max(f.t, start);
    const to = i + 1 < frames.length ? frames[i + 1].t : end + story.hold / 1000;
    return `file '${f.file}'\nduration ${Math.max(to - from, 0.001).toFixed(4)}`;
  });
  writeFileSync(join(work, 'frames.txt'), `${list.join('\n')}\nfile '${frames.at(-1).file}'\n`);
  const master = join(work, 'master.mp4');
  ffmpeg(['-f', 'concat', '-safe', '0', '-i', join(work, 'frames.txt'), '-vf', `fps=${SITE_FPS},scale=trunc(iw/2)*2:trunc(ih/2)*2`, '-c:v', 'libx264', '-crf', '10', '-pix_fmt', 'yuv420p', master]);

  const base = join(out, lang);
  ffmpeg(['-i', master, '-c:v', 'libx264', '-crf', '22', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', `${base}.mp4`]);
  ffmpeg(['-i', master, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '36', '-row-mt', '1', '-pix_fmt', 'yuv420p', '-an', `${base}.webm`]);
  // PNG fallback = GIF frame 1 = the finished result (Outlook desktop shows only frame 1).
  ffmpeg(['-i', join(work, 'poster.png'), '-vf', 'scale=600:-2:flags=lanczos', `${base}.png`]);

  let gif;
  for (const t of GIF_TRIES) {
    // Frame 1 is the poster held for a moment, then the journey plays and ends on the same state.
    const scale = `scale=${t.width}:-2:flags=lanczos,fps=${t.fps},format=rgb24`;
    const filter = `[0:v]${scale},split=2[p][q];[1:v]${scale},trim=duration=${story.posterHold / 1000},setpts=PTS-STARTPTS[poster];` +
      `[poster][p]concat=n=2:v=1:a=0[a];[q]palettegen=max_colors=${t.colors}:stats_mode=diff[pal];` +
      `[a][pal]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`;
    ffmpeg(['-i', master, '-loop', '1', '-i', join(work, 'poster.png'), '-filter_complex', filter, '-loop', '0', `${base}.gif`]);
    if (gifsicle) execFileSync('gifsicle', ['-O3', '--batch', `${base}.gif`]);
    gif = { ...t, bytes: size(`${base}.gif`) };
    if (gif.bytes <= GIF_BUDGET) break;
  }
  const probe = (f) => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height,r_frame_rate:format=duration,size', '-of', 'json', f], { encoding: 'utf8' }));
  const describe = (f) => {
    const p = probe(f);
    return { file: f, bytes: Number(p.format.size), width: p.streams[0].width, height: p.streams[0].height, duration: Number(Number(p.format.duration ?? 0).toFixed(2)) };
  };
  const result = {
    gif: { ...describe(`${base}.gif`), fps: gif.fps, colors: gif.colors, underBudget: gif.bytes <= GIF_BUDGET, gifsicle },
    mp4: { ...describe(`${base}.mp4`), fps: SITE_FPS },
    webm: { ...describe(`${base}.webm`), fps: SITE_FPS },
    png: describe(`${base}.png`),
    alt: story.alt[lang],
  };
  console.log(`${feature}/${lang}: gif ${kb(result.gif.bytes)} ${result.gif.width}x${result.gif.height} ${gif.fps} fps ${result.gif.duration} s` +
    `${result.gif.underBudget ? '' : ' OVER BUDGET'}, mp4 ${kb(result.mp4.bytes)}, webm ${kb(result.webm.bytes)}, png ${kb(result.png.bytes)}`);
  if (!result.gif.underBudget) process.exitCode = 1;
  return result;
}

