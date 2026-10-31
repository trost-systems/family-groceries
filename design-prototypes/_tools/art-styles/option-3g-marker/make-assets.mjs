// Usage: node make-assets.mjs
// Draws the Marker style's hand-made assets into ./assets: fineliner outlines with a seeded
// wobble, marker strokes as alpha masks, the mark and the motif. Same seed, same files.
// Outlines and fills that CSS colours from tokens are masks (black on transparent); the rest
// switch ink and paper with prefers-color-scheme inside the SVG.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

const out = join(dirname(new URL(import.meta.url).pathname), 'assets');
mkdirSync(out, { recursive: true });

let seed = 46;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const between = (a, b) => a + (b - a) * rnd();
const f = (n) => Math.round(n * 100) / 100;

const PEN = { light: '#1d1b1a', dark: '#f3efe6' };
const MARK = {
  honey: { light: '#ffc83d', dark: '#ffd24d' },
  mint: { light: '#8fdcb4', dark: '#5fe0a0' },
  lavender: { light: '#c3b1ff', dark: '#b49cff' },
};
const modes = (rules) => `<style>${rules('light')}@media (prefers-color-scheme: dark){${rules('dark')}}</style>`;
const svg = (viewBox, body, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${extra}>${body}</svg>\n`;
const write = (name, s) => { writeFileSync(join(out, name), s); console.log(`${name} ${s.length} B`); };

// A polyline with rounded interior corners, sampled every `step` units, with normals.
function sample(verts, { r = 8, step = 1.2, closed = false } = {}) {
  const pts = [];
  const n = verts.length;
  const corner = (i) => {
    const V = verts[i]; const P = verts[(i - 1 + n) % n]; const N = verts[(i + 1) % n];
    const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const t = Math.min(r, len(P, V) / 2, len(N, V) / 2);
    const A = [V[0] + ((P[0] - V[0]) * t) / len(P, V), V[1] + ((P[1] - V[1]) * t) / len(P, V)];
    const B = [V[0] + ((N[0] - V[0]) * t) / len(N, V), V[1] + ((N[1] - V[1]) * t) / len(N, V)];
    return [A, V, B];
  };
  const segs = [];
  const idx = closed ? [...Array(n).keys()] : [...Array(n).keys()].slice(1, -1);
  let cur = closed ? corner(0)[2] : verts[0];
  for (const i of closed ? [...idx.slice(1), 0] : idx) {
    const [A, V, B] = corner(i);
    segs.push({ line: [cur, A] }, { quad: [A, V, B] });
    cur = B;
  }
  if (!closed) segs.push({ line: [cur, verts[n - 1]] });
  for (const s of segs) {
    const at = s.line
      ? (u) => [s.line[0][0] + (s.line[1][0] - s.line[0][0]) * u, s.line[0][1] + (s.line[1][1] - s.line[0][1]) * u]
      : (u) => { const [a, v, b] = s.quad; const w = 1 - u; return [w * w * a[0] + 2 * w * u * v[0] + u * u * b[0], w * w * a[1] + 2 * w * u * v[1] + u * u * b[1]]; };
    const p0 = at(0); const p1 = at(1);
    const k = Math.max(2, Math.ceil(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / step) + (s.quad ? 4 : 0));
    for (let j = pts.length ? 1 : 0; j <= k; j++) pts.push(at(j / k));
  }
  let s = 0;
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)]; const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0]; const dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1;
    if (i) s += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    return { x: p[0], y: p[1], nx: dy / l, ny: -dx / l, s };
  });
}

// Moves each point along its normal: a constant c plus a slow hand tremor that fades to 0 at
// the ends, so pieces drawn separately still meet.
function wobble(pts, { amp = 0.7, c = 0, from = 0, to = 1 } = {}) {
  const L = pts.at(-1).s || 1;
  const waves = [0, 1, 2].map((i) => ({ a: amp * [1, 0.5, 0.25][i] * between(0.6, 1), k: between(1, 2.5) * (i + 1), p: between(0, 6.28) }));
  return pts.filter((p) => p.s / L >= from && p.s / L <= to).map((p) => {
    const u = p.s / L;
    const env = Math.sin(Math.PI * u);
    const o = c + env * waves.reduce((sum, w) => sum + w.a * Math.sin(w.k * Math.PI * 2 * u + w.p), 0);
    return [p.x + p.nx * o, p.y + p.ny * o];
  });
}

// Catmull-Rom through every 3rd point.
function smooth(p) {
  const q = p.filter((_, i) => i % 3 === 0 || i === p.length - 1);
  let d = `M${f(q[0][0])} ${f(q[0][1])}`;
  for (let i = 0; i < q.length - 1; i++) {
    const a = q[i - 1] ?? q[i]; const b = q[i]; const c = q[i + 1]; const e = q[i + 2] ?? c;
    d += `C${f(b[0] + (c[0] - a[0]) / 6)} ${f(b[1] + (c[1] - a[1]) / 6)} ${f(c[0] - (e[0] - b[0]) / 6)} ${f(c[1] - (e[1] - b[1]) / 6)} ${f(c[0])} ${f(c[1])}`;
  }
  return d;
}
const stroke = (d, w, extra = '') => `<path d="${d}" fill="none" stroke="#000" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
const pen = (d, w, extra = '') => `<path class="pen" d="${d}" fill="none" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
const penRules = modes((m) => `.pen{stroke:${PEN[m]}}.penf{fill:${PEN[m]}}${Object.entries(MARK).map(([k, v]) => `.${k}{fill:${v[m]}}.${k}s{stroke:${v[m]}}`).join('')}`);

// Horizontal soft hexagon outline, three pieces like 3b's mask (hex-cap-l, middle, hex-cap-r):
// a 48-unit-tall hexagon drawn in a frame padded by 3 units, so the stroke can leave the face.
// CSS stretches the middle piece; the caps keep their shape at every width.
const H = 48; const TIP = 13.856; const PAD = 3; const W = 2.1;
function outlineCaps() {
  const left = (mirror) => {
    const X = (x) => (mirror ? 24 - x : x);
    const base = sample([[24.6, 0], [TIP, 0], [0, H / 2], [TIP, H], [24.6, H]].map(([x, y]) => [X(x), y]), { r: 8 });
    const main = smooth(wobble(base, { amp: 0.8, c: 0 }));
    const second = smooth(wobble(base, { amp: 0.6, c: mirror ? 0.9 : -0.9, from: mirror ? 0.45 : 0.08, to: mirror ? 0.95 : 0.55 }));
    const tick = mirror ? '' : stroke(`M${f(17)} ${f(-1.6)}Q${f(21)} ${f(-0.4)} ${f(25)} ${f(0.3)}`, 1.2);
    return svg(`${mirror ? 0 : -PAD} ${-PAD} 27 54`, stroke(main, W) + stroke(second, 1.1, ' opacity=".8"') + tick, ' preserveAspectRatio="none"');
  };
  write('ink-cap-l.svg', left(false));
  write('ink-cap-r.svg', left(true));
  const top = sample([[-1, 0], [97, 0]], { step: 2 });
  const bottom = sample([[-1, H], [97, H]], { step: 2 });
  const lines = [top, bottom].map((b) => stroke(smooth(wobble(b, { amp: 0.9 })), W)).join('');
  const second = stroke(smooth(wobble(top, { amp: 0.5, c: 1, from: 0.25, to: 0.62 })), 1.1, ' opacity=".8"')
    + stroke(smooth(wobble(bottom, { amp: 0.5, c: -1, from: 0.55, to: 0.9 })), 1.1, ' opacity=".8"');
  write('ink-mid.svg', svg(`0 ${-PAD} 96 54`, lines + second, ' preserveAspectRatio="none"'));
}

// A closed hexagon drawn as one open stroke that starts on the upper-left side and runs a
// little past its start, the way a pen closes a shape.
const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
const loop = (v) => [lerp(v[5], v[0], 0.12), ...v, lerp(v[5], v[0], 0.38)];

// Pointy-top soft hexagon (avatars, ticks, check boxes), same frame logic as hex-pointy.svg.
const PW = 41.569;
const pointyVerts = [[PW / 2, 0], [PW, 12], [PW, 36], [PW / 2, H], [0, 36], [0, 12]];
function outlinePointy() {
  const base = sample(loop(pointyVerts), { r: 7 });
  const main = smooth(wobble(base, { amp: 0.8 }));
  const second = smooth(wobble(base, { amp: 0.5, c: 0.9, from: 0.1, to: 0.45 }));
  write('ink-pointy.svg', svg(`${-PAD} ${-PAD} ${f(PW + 2 * PAD)} 54`, stroke(main, W) + stroke(second, 1.1, ' opacity=".8"'), ' preserveAspectRatio="none"'));
}

// Marker strokes as an alpha mask: each stroke .7 opaque, overlaps darker, so the stroke
// direction shows. Horizontal back-and-forth for wide shapes, diagonal for pointy ones.
function markerStrokes(name, vb, lines, width, opacity) {
  const body = lines.map(([x1, y1, x2, y2]) => `<path d="M${f(x1)} ${f(y1)}Q${f((x1 + x2) / 2 + between(-6, 6))} ${f((y1 + y2) / 2 + between(-1.5, 1.5))} ${f(x2)} ${f(y2)}" fill="none" stroke="#000" stroke-width="${width}" stroke-linecap="round" opacity="${opacity}"/>`).join('');
  write(name, svg(vb, body, ' preserveAspectRatio="none"'));
}
function markers() {
  markerStrokes('mk-h.svg', '0 0 200 48', [6, 17, 28, 39].map((y, i) => (i % 2
    ? [between(196, 206), y + between(-1, 1), between(-8, 2), y + between(1, 3)]
    : [between(-8, 2), y + between(-1, 1), between(196, 206), y - between(0, 2)])), 15, 0.74);
  markerStrokes('mk-p.svg', `0 0 ${PW} 48`, [-14, -2, 10, 22, 34, 46].map((o) => [o - 6, 46 + between(0, 6), o + 22, -2 - between(0, 6)]), 13, 0.76);
  markerStrokes('mk-wash.svg', '0 0 600 400', [36, 77, 118, 159, 200, 241, 282, 323, 364].map((y, i) => (i % 2
    ? [between(530, 572), y + between(-4, 4), between(28, 70), y + between(2, 8)]
    : [between(28, 70), y + between(-4, 4), between(530, 572), y - between(0, 8)])), 62, 0.6);
  markerStrokes('mk-band.svg', '0 0 1000 400', [46, 98, 150, 202, 254, 306, 354].map((y, i) => (i % 2
    ? [1060, y + between(-5, 5), -60, y + between(2, 9)]
    : [-60, y + between(-5, 5), 1060, y - between(0, 9)])), 84, 0.86);
}

// Hand-drawn card frame for border-image (slice 30): a rounded box, the ink coloured per mode.
function box(name) {
  const S = 120; const i = 4;
  const base = sample([[i, i], [S - i, i], [S - i, S - i], [i, S - i]], { r: 14, closed: true, step: 1.5 });
  const main = smooth(wobble(base, { amp: 0.7 }));
  const second = smooth(wobble(base, { amp: 0.5, c: 1.1, from: 0.05, to: 0.3 })) + smooth(wobble(base, { amp: 0.5, c: -1, from: 0.55, to: 0.72 }));
  write(name, svg(`0 0 ${S} ${S}`, penRules + pen(main, 2.2) + pen(second, 1.1, ' opacity=".75"'), ` width="${S}" height="${S}"`));
}

// Wavy pen underline and a honey marker swipe; both stretch.
function underlines() {
  const wave = []; for (let x = 2; x <= 238; x += 3) wave.push([x, 8 + Math.sin(x / 11) * 2.2 + between(-0.4, 0.4)]);
  write('pen-wave.svg', svg('0 0 240 16', penRules + pen(smooth(wave), 2.4, ' vector-effect="non-scaling-stroke"'), ' preserveAspectRatio="none"'));
  const swipe = (y, w, o) => `<path class="honeys" d="M${f(between(2, 8))} ${f(y + between(-1, 1))}Q${f(150)} ${f(y - between(2, 5))} ${f(between(290, 298))} ${f(y - between(0, 3))}" fill="none" stroke-width="${w}" stroke-linecap="round" opacity="${o}"/>`;
  write('swipe.svg', svg('0 0 300 30', penRules + swipe(16, 14, 0.85) + swipe(19, 10, 0.6), ' preserveAspectRatio="none"'));
  const ring = sample([[50, 4], [96, 10], [96, 30], [50, 36], [4, 30], [4, 10]], { r: 22, closed: true, step: 1.5 });
  write('ring.svg', svg('-2 -2 104 44', penRules + pen(smooth(wobble(ring, { amp: 1.2 }).concat([[60, 3]])), 2, ' vector-effect="non-scaling-stroke"'), ' preserveAspectRatio="none"'));
}

// Arrow head for the dashed pen paths: a quick open V, pointing right.
function arrow() {
  write('arrow-head.svg', svg('0 0 24 24', penRules + pen('M5 4.5Q12 9 20 12.4Q12.5 15 6.5 20.5', 2.4)));
}

// A sketched hexagon with a marker fill offset from its outline. Used by the mark and motif.
function sketchHex({ cx, cy, s, fill, check, lines, tilt = 0, w = 2.4 }) {
  const k = s / 48;
  const verts = pointyVerts.map(([x, y]) => {
    const px = (x - PW / 2) * k; const py = (y - H / 2) * k;
    const c = Math.cos(tilt); const sn = Math.sin(tilt);
    return [cx + px * c - py * sn, cy + px * sn + py * c];
  });
  const base = sample(loop(verts), { r: 7 * k, step: 1 });
  const main = smooth(wobble(base, { amp: 0.7 * k }));
  const second = smooth(wobble(base, { amp: 0.5 * k, c: 1.1 * k, from: 0.12, to: 0.48 }));
  const fillPts = verts.map(([x, y]) => [x + 2.4 * k + (x - cx) * 0.02, y - 1.8 * k + (y - cy) * 0.02]);
  const clip = `M${fillPts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`;
  const id = `c${Math.floor(rnd() * 1e6)}`;
  const strokes = [];
  for (let o = -s; o < s; o += 9 * k) strokes.push(`M${f(cx + o - 10 * k)} ${f(cy + s * 0.7)}L${f(cx + o + 14 * k)} ${f(cy - s * 0.7)}`);
  let body = `<clipPath id="${id}"><path d="${clip}"/></clipPath><g clip-path="url(#${id})"><path class="${fill}" d="${clip}" opacity=".5"/><path class="${fill}s" d="${strokes.join('')}" stroke-width="${f(11 * k)}" stroke-linecap="round" fill="none" opacity=".75"/></g>`;
  body += pen(main, f(w)) + pen(second, f(w * 0.5), ' opacity=".8"');
  if (check) body += pen(`M${f(cx - 9 * k)} ${f(cy + 1 * k)}Q${f(cx - 5 * k)} ${f(cy + 4 * k)} ${f(cx - 2.5 * k)} ${f(cy + 8.5 * k)}Q${f(cx + 3 * k)} ${f(cy - 4 * k)} ${f(cx + 11 * k)} ${f(cy - 10 * k)}`, f(w * 1.5));
  if (lines) for (const [dy, len] of [[-6, 14], [0, 10], [6, 12]]) body += pen(`M${f(cx - 7 * k)} ${f(cy + dy * k)}Q${f(cx - 7 * k + len * k / 2)} ${f(cy + (dy + between(-0.8, 0.8)) * k)} ${f(cx - 7 * k + len * k)} ${f(cy + (dy + between(-0.6, 0.6)) * k)}`, f(w * 0.75));
  return body;
}

function brand() {
  write('mark.svg', svg('0 0 64 64', penRules + sketchHex({ cx: 32, cy: 32.5, s: 56, fill: 'honey', check: true, w: 3 }), ' width="64" height="64"'));
  const motif = penRules
    + sketchHex({ cx: 30, cy: 66, s: 34, fill: 'lavender', lines: true, tilt: -0.12, w: 2.2 })
    + sketchHex({ cx: 52, cy: 82, s: 26, fill: 'mint', lines: true, tilt: 0.1, w: 2 })
    + sketchHex({ cx: 80, cy: 44, s: 62, fill: 'honey', check: true, tilt: 0.08, w: 2.8 });
  write('motif.svg', svg('0 0 120 100', motif, ' width="120" height="100"'));
}

// Sketchbook backdrop for the hero: a few loose doodled hexagons on a tile that repeats
// without seams (nothing crosses the tile edge). Faint, so text over it keeps its contrast.
function comb() {
  const hexes = [[60, 70, 40, 0.1], [210, 40, 26, -0.2], [300, 150, 34, 0.25], [120, 220, 30, -0.05], [250, 290, 44, 0.15], [50, 320, 22, 0.3]];
  for (const [mode, col] of [['light', '#d8cfbd'], ['dark', '#3c3f47']]) {
    const body = hexes.map(([cx, cy, s, t]) => {
      const k = s / 48;
      const verts = pointyVerts.map(([x, y]) => { const px = (x - PW / 2) * k; const py = (y - H / 2) * k; return [cx + px * Math.cos(t) - py * Math.sin(t), cy + px * Math.sin(t) + py * Math.cos(t)]; });
      const base = sample(loop(verts), { r: 6 * k, step: 1.5 });
      return `<path d="${smooth(wobble(base, { amp: 0.8 }))}" fill="none" stroke="${col}" stroke-width="1.6" stroke-linecap="round"/>`;
    }).join('');
    write(`comb-${mode}.svg`, svg('0 0 360 360', body, ' width="360" height="360"'));
  }
}

outlineCaps();
outlinePointy();
markers();
box('box.svg');
box('box-b.svg');
underlines();
arrow();
brand();
comb();
