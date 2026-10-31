// Usage: node make-assets.mjs
// Writes assets/mark.svg, assets/motif.svg and assets/motif-dark.svg for the Raster style:
// pointy-top hexagons with 120° corners, each corner rounded (the 3b soft hexagon), drawn flat.
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

const out = join(dirname(new URL(import.meta.url).pathname), 'assets');
const f = (n) => Number(n.toFixed(3));

// Pointy-top hexagon centred on (cx, cy), height h, corner radius r at h = 48 scaled with h.
function hex(cx, cy, h, r48 = 8) {
  const R = h / 2;
  const r = (r48 * h) / 48;
  const pts = [-90, -30, 30, 90, 150, 210].map((a) => [cx + R * Math.cos((a * Math.PI) / 180), cy + R * Math.sin((a * Math.PI) / 180)]);
  // A 120° corner rounded by r starts and ends r / tan 60° from the corner along each side.
  const t = r / Math.tan(Math.PI / 3);
  const along = (p, q, d) => {
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    return [p[0] + ((q[0] - p[0]) * d) / len, p[1] + ((q[1] - p[1]) * d) / len];
  };
  let d = '';
  pts.forEach((p, i) => {
    const prev = pts[(i + 5) % 6];
    const next = pts[(i + 1) % 6];
    const a = along(p, prev, t);
    const b = along(p, next, t);
    d += `${i ? 'L' : 'M'}${f(a[0])} ${f(a[1])}A${f(r)} ${f(r)} 0 0 1 ${f(b[0])} ${f(b[1])}`;
  });
  return `${d}Z`;
}

const rect = (x, y, w, h) => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`;

// Mark: a honey hexagon with a geometric H cut out, so the page shows through in both modes.
const H = 48;
const W = H * 0.866;
const cx = 24;
const bar = 6.4;
const gap = 7.2;
const top = 13;
const bottom = 35;
const mark = [
  hex(cx, 24, H),
  rect(cx - gap / 2 - bar, top, bar, bottom - top),
  rect(cx + gap / 2, top, bar, bottom - top),
  rect(cx - gap / 2, 21.2, gap, 5.6),
].join('');
const markSvg = (fill) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="${fill}" fill-rule="evenodd" d="${mark}"/></svg>\n`;
writeFileSync(join(out, 'mark.svg'), markSvg('#ffc72c'));
writeFileSync(join(out, 'mark-on-honey.svg'), markSvg('#0b0b0b'));

// Motif: three hexagons packed as a honeycomb, the top one honey, the two below ink outlines.
function motif(line) {
  const h = 40;
  const w = h * 0.866;
  const g = 4;
  const sw = 2;
  const stepX = w + g;
  const stepY = 0.75 * h + g * 0.866;
  const x0 = sw + w / 2;
  const yBottom = sw + h / 2 + stepY;
  const cells = [
    [x0 + stepX / 2, sw + h / 2, 'fill="#ffc72c"'],
    [x0, yBottom, `fill="none" stroke="${line}" stroke-width="${sw}"`],
    [x0 + stepX, yBottom, `fill="none" stroke="${line}" stroke-width="${sw}"`],
  ];
  const vw = f(x0 + stepX + w / 2 + sw);
  const vh = f(yBottom + h / 2 + sw);
  const body = cells.map(([x, y, paint]) => `<path ${paint} d="${hex(x, y, h - (paint.startsWith('fill="none"') ? sw : 0))}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}">${body}</svg>\n`;
}
writeFileSync(join(out, 'motif.svg'), motif('#0b0b0b'));
writeFileSync(join(out, 'motif-dark.svg'), motif('#f4f2ec'));
writeFileSync(join(out, 'motif-on-honey.svg'), motif('#0b0b0b').replace('fill="#ffc72c"', 'fill="#0b0b0b"'));
console.log('assets written');
