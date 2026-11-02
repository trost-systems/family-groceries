// Building blocks the proposals share: the page shell (self-hosted fonts and the design tokens),
// a cropped app capture, hexagons and the sticker look of 6b Hex Frische.
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const url = (path) => pathToFileURL(join(root, path)).href;

export const PHONE = { w: 1080, h: 1920 };
export const SHOT_COUNT = 6;
export const STRIP = { w: PHONE.w * SHOT_COUNT, h: PHONE.h };
export const FEATURE = { w: 1024, h: 500 };
export const RAW_W = 1080;

export const C = {
  cobalt: '#1b3fae',
  cobaltField: '#2448c0',
  honey: '#ffe24a',
  honeySoft: '#fff2a8',
  honeyEdge: '#d4b20f',
  mint: '#7fe3b8',
  mintSoft: '#d6f5e7',
  ink: '#0f1530',
  muted: '#4b536c',
  mist: '#e1e8ff',
  surface: '#f7f7f2',
  white: '#ffffff',
};

export const raw = (locale, file) => url(`design/store-frames/raw/${locale}/${file}`);
export const rawPath = (locale, file) => join(root, `design/store-frames/raw/${locale}/${file}`);
export const appIcon = url('app/web/icons/Icon-512.png');

export function page({ w, h, css, body }) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<link rel="stylesheet" href="${url('site/public/tokens.css')}">
<style>
@font-face{font-family:"Bricolage Grotesque";src:url("${url('site/public/fonts/bricolage-grotesque-latin-standard-normal.woff2')}") format("woff2");font-weight:200 800}
@font-face{font-family:Inter;src:url("${url('site/public/fonts/inter-latin-wght-normal.woff2')}") format("woff2");font-weight:100 900}
*{box-sizing:border-box}
html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;color-scheme:light}
body{position:relative;font-family:Inter,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased}
.abs{position:absolute}
.display{font-family:"Bricolage Grotesque",sans-serif;font-weight:800;letter-spacing:-0.035em;line-height:0.98;text-wrap:balance}
.sub{font-weight:600;line-height:1.28;text-wrap:balance}
.panel{position:absolute;top:0;width:${PHONE.w}px;height:${PHONE.h}px;overflow:hidden}
.crop{position:relative;overflow:hidden;background:${C.surface}}
.crop>img{position:absolute;left:0;display:block}
.sticker{border:4px solid ${C.ink};box-shadow:0 12px 0 0 ${C.ink}}
${css}
</style></head><body>${body}</body></html>`;
}

// A window onto one capture: rows `top`..`bottom` and columns `x` in capture pixels, drawn
// `scale` times as large. Returns the markup and the drawn size, so callers place it without
// repeating the arithmetic.
export function crop({ src, top = 0, bottom = 2400, x = [0, RAW_W], scale, cls = '', style = '' }) {
  const w = Math.round((x[1] - x[0]) * scale);
  const h = Math.round((bottom - top) * scale);
  const html = `<div class="crop ${cls}" style="width:${w}px;height:${h}px;${style}"><img src="${src}" style="top:${-Math.round(top * scale)}px;left:${-Math.round(x[0] * scale)}px;width:${Math.round(RAW_W * scale)}px"></div>`;
  return { html, w, h };
}

// Where a capture can be cut without slicing anything: the middle of every run of at least
// `min` pixel rows that are one background colour (surface, sheet, scrim) across the full width,
// so the gaps between rows and sections and never the inside of a honey or mint row, plus the
// capture's top and bottom. Lines inside the tab bar (from TAB_BAR down) don't count.
const BACKGROUNDS = new Set(['f7f7f2', 'ffffff', '949491']);
export const TAB_BAR = 2214;
const cutCache = new Map();
export function cuts(file, min = 16) {
  if (cutCache.has(file)) return cutCache.get(file);
  const [w, h] = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim().split(',').map(Number);
  const px = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: w * h * 3 + 1024 });
  // The row's one colour as hex, or null when the row has more than one.
  const colourOf = (y) => {
    const row = px.subarray(y * w * 3, (y + 1) * w * 3);
    for (let i = 3; i < row.length; i += 3) if (row[i] !== row[0] || row[i + 1] !== row[1] || row[i + 2] !== row[2]) return null;
    return [...row.subarray(0, 3)].map((n) => n.toString(16).padStart(2, '0')).join('');
  };
  const out = [0];
  for (let y = 0; y < h; ) {
    const colour = colourOf(y);
    let end = y;
    while (colour && end + 1 < h && colourOf(end + 1) === colour) end++;
    const mid = Math.round((y + end) / 2);
    if (end - y + 1 >= min && BACKGROUNDS.has(colour) && mid < TAB_BAR) out.push(mid);
    y = end + 1;
  }
  out.push(h);
  cutCache.set(file, out);
  return out;
}

// A window of whole rows, at most `span` capture pixels, that holds the band `keep` ([top,
// bottom]): of the windows within 10 % of the tallest, the one that centres the band best.
export function windowFor(file, span, keep) {
  const c = cuts(file);
  const fits = c.flatMap((top) => c.filter((bottom) => top <= keep[0] && bottom >= keep[1] && bottom - top <= span).map((bottom) => ({ top, bottom })));
  if (!fits.length) throw new Error(`${file}: no clean window of ${span} px around ${keep}`);
  const tallest = Math.max(...fits.map((w) => w.bottom - w.top));
  const off = (w) => Math.abs((w.top + w.bottom) / 2 - (keep[0] + keep[1]) / 2);
  return fits.filter((w) => w.bottom - w.top >= 0.9 * tallest).sort((a, b) => off(a) - off(b))[0];
}

// A window of exactly `span` capture pixels for a full-bleed screen that holds `keep`: the bottom
// at a clean cut, the top near one (it slides under a header there), `keep` near the middle.
export function windowExact(file, span, keep) {
  const c = cuts(file);
  const near = (y) => Math.min(...c.map((k) => Math.abs(k - y)));
  const fits = c.filter((bottom) => bottom >= keep[1] && bottom - span >= 0 && bottom - span <= keep[0]);
  if (!fits.length) throw new Error(`${file}: no window of ${span} px around ${keep}`);
  const score = (bottom) => near(bottom - span) + Math.abs(bottom - span / 2 - (keep[0] + keep[1]) / 2) / 4;
  const bottom = fits.sort((a, b) => score(a) - score(b))[0];
  return { top: bottom - span, bottom };
}

// A card of the capture as large as fits between `minTop` and the canvas foot at `scale`,
// cropped at clean cuts around the shot's lifted row, standing on the foot (its bottom edge
// bleeds). Returns the crop and the card's top.
export function footCard(shot, { scale, minTop, cls = '' }) {
  const { top, bottom } = windowFor(shot.path, Math.floor((PHONE.h - minTop) / scale), shot.lift.y);
  const card = crop({ src: shot.src, top, bottom, scale, cls });
  return { ...card, top: PHONE.h - card.h };
}

// One band of a capture, `{ y: [top, bottom], x? }`, as a crop.
export const band = (src, { y, x }, scale, cls = '') => crop({ src, top: y[0], bottom: y[1], x, scale, cls });

// Pointy-top hexagon around (cx, cy) with circumradius r, corners rounded by `round`.
export function hexPath(cx, cy, r, round = 0) {
  const pts = [...Array(6)].map((_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  if (!round) return `M${pts.map((p) => p.map((n) => n.toFixed(1)).join(' ')).join(' L')}Z`;
  const k = round / r;
  let d = '';
  pts.forEach((p, i) => {
    const prev = pts[(i + 5) % 6];
    const next = pts[(i + 1) % 6];
    const a = [p[0] + (prev[0] - p[0]) * k, p[1] + (prev[1] - p[1]) * k];
    const b = [p[0] + (next[0] - p[0]) * k, p[1] + (next[1] - p[1]) * k];
    d += `${i ? 'L' : 'M'}${a[0].toFixed(1)} ${a[1].toFixed(1)} Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)} `;
  });
  return `${d}Z`;
}

// The same hexagon as a CSS clip-path polygon over a box of width w and height h (pointy top).
export const hexClip = 'polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)';

// A honeycomb of hexagon outlines over w x h; `keep(x, y)` picks the cells drawn.
export function comb({ w, h, r, color, opacity, width = 3, keep = () => true }) {
  const dx = Math.sqrt(3) * r;
  let d = '';
  for (let row = -1; row * r * 1.5 < h + r; row++) {
    for (let col = -1; col * dx < w + dx; col++) {
      const x = col * dx + (row % 2 ? dx / 2 : 0);
      const y = row * r * 1.5;
      if (keep(x, y)) d += hexPath(x, y, r - width * 2, r * 0.12);
    }
  }
  return `<svg class="abs" style="left:0;top:0" width="${w}" height="${h}"><path d="${d}" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="${width}"/></svg>`;
}

// A member's hexagon avatar with the initial, in the member's colour.
export function avatar(initial, fill, size = 88) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" style="display:block;overflow:visible"><path d="${hexPath(50, 50, 48, 10)}" fill="${fill}" stroke="${C.ink}" stroke-width="5"/><text x="50" y="52" text-anchor="middle" dominant-baseline="central" font-family="Bricolage Grotesque" font-weight="800" font-size="46" fill="${C.ink}">${initial}</text></svg>`;
}
