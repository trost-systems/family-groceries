// Writes mark.svg, motif.svg, block-hex.svg, comb-light.svg, comb-dark.svg for option-6b-hex-frische-original5.
// Usage: node make-assets.mjs (writes assets/ next to this script)
import { writeFileSync } from 'node:fs';
const out = new URL('assets', import.meta.url).pathname;
const f = (n) => +n.toFixed(2);
// Soft-cornered regular hexagon. pointy: vertex at top. R: circumradius, rc: corner radius.
function hex(cx, cy, R, rc, pointy = true) {
  const v = [...Array(6)].map((_, i) => {
    const a = (Math.PI / 180) * (60 * i + (pointy ? -90 : 0));
    return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
  });
  const t = rc / Math.tan(Math.PI / 3);
  const pt = (p, q, d) => { const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy); return [p[0] + (dx / L) * d, p[1] + (dy / L) * d]; };
  let d = '';
  v.forEach((p, i) => {
    const prev = v[(i + 5) % 6], next = v[(i + 1) % 6];
    const a = pt(p, prev, t), b = pt(p, next, t);
    d += `${i ? 'L' : 'M'}${f(a[0])} ${f(a[1])}A${rc} ${rc} 0 0 1 ${f(b[0])} ${f(b[1])}`;
  });
  return d + 'Z';
}
const NAVY = '#0f1530', LEMON = '#ffe24a', MINT = '#7fe3b8', COBALT = '#1b3fae', TOMATO = '#ff5b3a', NIGHT_BRAND = '#9fb6ff';
const svg = (vb, body, title) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${title ? `<title>${title}</title>` : ''}${body}</svg>\n`;

// Mark: option 5's mark in hex form, a cobalt soft hex with a white check and a lemon hex where 5 has its sun.
writeFileSync(`${out}/mark.svg`, svg('0 0 64 64', [
  `<path d="${hex(30, 34, 27, 7)}" fill="${COBALT}" stroke="${NAVY}" stroke-width="3" stroke-linejoin="round"/>`,
  `<path d="M18.5 35l7.5 7.5 14-15" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`,
  `<path d="${hex(50, 14, 11, 3)}" fill="${LEMON}" stroke="${NAVY}" stroke-width="3"/>`,
].join(''), 'Hummlist'));

// Motif: a honeycomb cluster in lemon, tomato and mint, so it reads on cobalt and on white; one hex carries the check.
const r = 22, w = r * Math.sqrt(3);
const cells = [
  [0, 0, TOMATO], [w, 0, LEMON], [w / 2, r * 1.5, MINT], [-w / 2, r * 1.5, '#ffffff'], [w * 1.5, r * 1.5, '#ffffff'],
];
const ox = 40, oy = 28;
writeFileSync(`${out}/motif.svg`, svg('-1 3 120 84', [
  ...cells.map(([x, y, c], i) => (i > 2 ? `<path d="${hex(ox + x, oy + y, r - 4, 5)}" fill="none" stroke="#8fa3e8" stroke-width="3" stroke-dasharray="1 6" stroke-linecap="round"/>` : `<path d="${hex(ox + x, oy + y, r - 2, 5)}" fill="${c}" stroke="${NAVY}" stroke-width="3"/>`)),
  `<path d="M${ox + w - 8} ${oy + 1}l5 5 10-11" fill="none" stroke="${NAVY}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
  `<path d="M${ox - 7} ${oy}h14M${ox} ${oy - 7}v14" stroke="${NAVY}" stroke-width="4" stroke-linecap="round"/>`,
  `<path d="M${ox + w / 2 - 8} ${oy + r * 1.5 - 4}h16M${ox + w / 2 - 8} ${oy + r * 1.5 + 4}h10" stroke="${NAVY}" stroke-width="3.5" stroke-linecap="round"/>`,
].join('')));

// Block decoration: a three-hex cluster in white, drawn see-through over a colour block.
const big = 100, bw = big * Math.sqrt(3), gap = 10;
const cx = bw / 2 + gap, cy = big + gap;
for (const [name, fill, k] of [['block-hex', '#ffffff', 1], ['block-hex-dark', '#ffffff', 0.6]]) writeFileSync(`${out}/${name}.svg`, svg(`0 0 ${f(bw * 2 + gap * 3)} ${f(big * 3.5 + gap * 2)}`, [
  `<g fill="${fill}">`,
  `<path d="${hex(cx, cy, big - gap, 22)}" opacity="${f(0.34 * k)}"/>`,
  `<path d="${hex(cx + bw, cy, big - gap, 22)}" opacity="${f(0.2 * k)}"/>`,
  `<path d="${hex(cx + bw / 2, cy + big * 1.5, big - gap, 22)}" opacity="${f(0.26 * k)}"/>`,
  `</g>`,
].join('')));

// Page comb: sparse outlined hexes for quiet backdrops.
for (const [name, c, o] of [['comb-light', NAVY, 0.07], ['comb-dark', NIGHT_BRAND, 0.1]]) {
  const R = 30, W = R * Math.sqrt(3);
  const p = [[W / 2, R], [W, R * 2.5], [0, R * 2.5]].map(([x, y]) => `<path d="${hex(x, y, R - 6, 6)}"/>`).join('');
  writeFileSync(`${out}/${name}.svg`, svg(`0 0 ${f(W)} ${R * 3}`, `<g fill="none" stroke="${c}" stroke-width="2" opacity="${o}">${p}</g>`));
}
