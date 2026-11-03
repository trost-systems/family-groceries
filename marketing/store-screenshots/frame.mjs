// The store frame P2 „Großschrift“ (job 77's proposal, picked by Peter on 2026-11-02): a two-line
// Bricolage caption and a subline in ink on honey, under it the real app as a card with an ink
// edge and a hard shadow, standing on the foot of the frame (its bottom bleeds). The card shows
// the part of the capture the caption points at, cut only between rows. The sync shot lifts the
// partner's confirmation out of his phone as a tilted sticker on the card's top edge.
//
// All sizes are those of job 77's 1080 px wide Play shot, scaled by the frame's width (`u`).
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const repo = join(new URL('.', import.meta.url).pathname, '../..');
const url = (p) => pathToFileURL(p).href;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const C = { honey: '#ffe24a', cobalt: '#1b3fae', ink: '#0f1530', surface: '#f7f7f2' };

/** The card is this share of the frame's width. */
const CARD = 0.86;
/** The sticker's width as a share of the frame's width (job 77: 990 capture px at 0.7). */
const STICKER = 0.64;
const GUTTER = 80;
const CARD_TOP = 540;

export const HEAD = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<link rel="stylesheet" href="${url(join(repo, 'site/public/tokens.css'))}">
<style>
@font-face{font-family:"Bricolage Grotesque";src:url("${url(join(repo, 'site/public/fonts/bricolage-grotesque-latin-standard-normal.woff2'))}") format("woff2");font-weight:200 800}
@font-face{font-family:Inter;src:url("${url(join(repo, 'site/public/fonts/inter-latin-wght-normal.woff2'))}") format("woff2");font-weight:100 900}
*{box-sizing:border-box;margin:0}
html,body{overflow:hidden;color-scheme:light}
body{position:relative;font-family:Inter,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased}
.abs{position:absolute}
.display{font-family:"Bricolage Grotesque",sans-serif;font-weight:800;letter-spacing:-0.035em;line-height:0.98}
.display span{display:block;white-space:nowrap}
.display em{font-style:normal;color:${C.cobalt}}
.sub{font-weight:600;line-height:1.28;text-wrap:balance}
.crop{position:relative;overflow:hidden;background:${C.surface};box-sizing:content-box}
.crop>img{position:absolute;display:block}
</style>`;

/**
 * Where a capture can be cut without slicing anything: the middle of every run of at least
 * `min` pixel rows (8 CSS pixels: more than the gap between two lines of text) that are one background colour (surface, sheet, scrim) across the full width,
 * so the gaps between rows and sections and never the inside of a honey or mint row, plus the
 * capture's top and bottom. Nothing inside the tab bar (the bottom `tabBar` rows) counts.
 */
const BACKGROUNDS = new Set(['f7f7f2', 'ffffff', '949491']);
const cutCache = new Map();
function cuts(file, tabBar, min) {
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
    if (end - y + 1 >= min && BACKGROUNDS.has(colour) && mid < h - tabBar) out.push(mid);
    y = end + 1;
  }
  out.push(h);
  const result = { width: w, height: h, cuts: out };
  cutCache.set(file, result);
  return result;
}

/**
 * The window of whole rows, at most `span` capture pixels tall, that holds the band `keep`
 * ([top, bottom]): of the windows within 10 % of the tallest, the one that centres the band best.
 */
function windowFor(c, span, keep) {
  const fits = c.flatMap((top) => c.filter((bottom) => top <= keep[0] && bottom >= keep[1] && bottom - top <= span).map((bottom) => ({ top, bottom })));
  if (!fits.length) throw new Error(`no clean window of ${span} px around rows ${keep}`);
  const tallest = Math.max(...fits.map((w) => w.bottom - w.top));
  const off = (w) => Math.abs((w.top + w.bottom) / 2 - (keep[0] + keep[1]) / 2);
  return fits.filter((w) => w.bottom - w.top >= 0.9 * tallest).sort((a, b) => off(a) - off(b))[0];
}

/** Rows `top`..`bottom` and columns `x` of a capture `rawW` wide, drawn `scale` times as large. */
function crop({ src, top, bottom, x, rawW, scale, cls, style = '' }) {
  const w = Math.round((x[1] - x[0]) * scale);
  const h = Math.round((bottom - top) * scale);
  const html = `<div class="crop ${cls}" style="width:${w}px;height:${h}px;${style}"><img src="${url(src)}" style="top:${-Math.round(top * scale)}px;left:${-Math.round(x[0] * scale)}px;width:${Math.round(rawW * scale)}px"></div>`;
  return { html, w, h };
}

/**
 * Throws unless the band's outermost rows and columns are one colour: a sticker shows the lifted
 * line on its own, with no divider, neighbouring row or scrim at its edges.
 */
function plainEdges(file, { x, y }) {
  const w = x[1] - x[0];
  const h = y[1] - y[0];
  const px = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', `crop=${w}:${h}:${x[0]}:${y[0]}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: w * h * 3 + 1024 });
  const at = (i, j) => px.subarray((j * w + i) * 3, (j * w + i) * 3 + 3).join(',');
  const edge = [];
  for (let i = 0; i < w; i++) edge.push(at(i, 0), at(i, h - 1));
  for (let j = 0; j < h; j++) edge.push(at(0, j), at(w - 1, j));
  const colours = new Set(edge);
  if (colours.size > 1) throw new Error(`${file}: the sticker band ${JSON.stringify({ x, y })} has ${colours.size} colours on its edges, so it cuts into something`);
}

/** The rows a capture's caption points at, as one band [top, bottom]. */
const band = (lift) => [Math.min(...lift.map((b) => b.y[0])), Math.max(...lift.map((b) => b.y[1]))];

/**
 * One store frame: `W` x `H`, the caption `{ title: [line, line], sub }`, the capture `raw` (its
 * file, its `meta` from capture.spec.mjs: lift, dpr, sender) and the folder it lies in.
 */
export function framePage({ W, H, caption, raw, dir }) {
  const u = W / 1080;
  const px = (n) => Math.round(n * u);
  const { meta } = raw;
  const shape = cuts(raw.file, Math.round(64 * meta.dpr), 8 * meta.dpr);
  const scale = (CARD * W) / shape.width;
  const win = windowFor(shape.cuts, Math.floor((H - px(CARD_TOP)) / scale), band(meta.lift));
  const card = crop({ src: raw.file, top: win.top, bottom: win.bottom, x: [0, shape.width], rawW: shape.width, scale, cls: 'card' });
  const cardTop = H - card.h;
  let sticker = '';
  if (meta.sender) {
    const s = meta.sender;
    plainEdges(join(dir, s.raw), s);
    const sScale = (STICKER * W) / (s.x[1] - s.x[0]);
    const st = crop({ src: join(dir, s.raw), top: s.y[0], bottom: s.y[1], x: s.x, rawW: shape.width, scale: sScale, cls: 'sticker' });
    sticker = `<div class="abs" style="left:${px(GUTTER)}px;top:${cardTop - st.h / 2}px;transform:rotate(-2deg)">${st.html}</div>`;
  }
  const [h1, h2] = caption.title;
  return `${HEAD}
<style>
body{width:${W}px;height:${H}px;background:${C.honey}}
.head{left:${px(GUTTER)}px;right:${px(GUTTER)}px;top:${px(96)}px;display:flex;flex-direction:column;gap:${px(26)}px}
.head .display{font-size:${px(132)}px}
.head .sub{font-size:${px(40)}px;max-width:${px(900)}px}
.card{border:${px(5)}px solid ${C.ink};border-bottom:0;border-radius:${px(44)}px ${px(44)}px 0 0;box-shadow:${px(16)}px ${px(16)}px 0 0 ${C.ink}}
.sticker{border:${px(4)}px solid ${C.ink};border-radius:${px(26)}px;box-shadow:0 ${px(12)}px 0 0 ${C.ink}}
</style><body>
<div class="abs head"><div class="display"><span>${esc(h1)}</span><span>${esc(h2)}</span></div><div class="sub">${esc(caption.sub)}</div></div>
<div class="abs" style="left:${Math.round((W - card.w) / 2)}px;top:${cardTop}px" data-card>${card.html}</div>${sticker}
</body>`;
}

/**
 * The Play feature graphic: the tagline on honey, its last words in cobalt, and the top of the
 * list as a card in the bottom-right corner, cut right of the item names and between two rows.
 */
export function featurePage({ W, H, caption, raw }) {
  const { meta } = raw;
  const shape = cuts(raw.file, Math.round(64 * meta.dpr), 8 * meta.dpr);
  const scale = 0.5 * (1080 / shape.width);
  const bottom = Math.max(...shape.cuts.filter((y) => y * scale <= H - 40));
  const fg = crop({ src: raw.file, top: 0, bottom, x: [0, Math.round(shape.width * 0.7)], rawW: shape.width, scale, cls: 'card' });
  return `${HEAD}
<style>
body{width:${W}px;height:${H}px;background:${C.honey}}
.t{left:72px;width:420px;top:0;bottom:0;display:flex;align-items:center}
.t .display{font-size:52px;text-wrap:balance}
.card{border:3px solid ${C.ink};border-right:0;border-bottom:0;border-radius:24px 0 0 0;box-shadow:-9px 9px 0 0 ${C.ink}}
</style><body>
<div class="abs t"><div class="display">${esc(caption.title)} <em>${esc(caption.accent)}</em></div></div>
<div class="abs" style="left:${W - fg.w}px;top:${H - fg.h}px">${fg.html}</div>
</body>`;
}

/**
 * Runs in the rendered frame: makes each caption line fit its width (smaller type, never a third
 * line) and measures what the store rules ask. Returns the caption's type size, whether the
 * caption ends above the card, and the share of the frame covered by the frame's own text (the
 * app's capture is an image and doesn't count), for Play's guidance of at most 20 %.
 */
export function settleAndMeasure() {
  const head = document.querySelector('.head');
  const display = document.querySelector('.head .display');
  let size = null;
  if (display) {
    size = parseFloat(getComputedStyle(display).fontSize);
    while ([...display.children].some((l) => l.scrollWidth > display.clientWidth) && size > 40) {
      size -= 2;
      display.style.fontSize = `${size}px`;
    }
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const rects = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    rects.push(...range.getClientRects());
  }
  const { innerWidth: w, innerHeight: h } = window;
  const text = rects.reduce((sum, r) => sum + Math.max(0, Math.min(r.right, w) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, h) - Math.max(r.top, 0)), 0) / (w * h);
  const card = document.querySelector('[data-card]');
  const clear = !head || !card || head.getBoundingClientRect().bottom <= card.getBoundingClientRect().top - 24;
  return { size, clear, text };
}
