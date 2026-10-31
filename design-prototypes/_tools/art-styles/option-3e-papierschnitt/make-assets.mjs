// Usage: node make-assets.mjs
// Writes this style's SVGs into assets/: the mark, the motif, the hero's paper landscape
// (light and dark) and the paper-fibre textures. Every hexagon is the brand shape: 120°
// corners, tips 0.2887 × height, rounded corners. Light comes from the top left, so every
// layer casts its shadow down and to the right.
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

const out = join(dirname(new URL(import.meta.url).pathname), 'assets');
const f = (n) => Number(n.toFixed(2));

// Rounded polygon: each corner is cut back by r / tan(θ/2) and joined with an arc of radius r.
function rounded(pts, r) {
  const n = pts.length;
  const seg = pts.map((p, i) => {
    const a = pts[(i + n - 1) % n]; const b = pts[(i + 1) % n];
    const u = [a[0] - p[0], a[1] - p[1]]; const v = [b[0] - p[0], b[1] - p[1]];
    const lu = Math.hypot(...u); const lv = Math.hypot(...v);
    const ang = Math.acos((u[0] * v[0] + u[1] * v[1]) / (lu * lv));
    const d = Math.min(r / Math.tan(ang / 2), lu / 2, lv / 2);
    return { s: [p[0] + (u[0] / lu) * d, p[1] + (u[1] / lu) * d], e: [p[0] + (v[0] / lv) * d, p[1] + (v[1] / lv) * d] };
  });
  return `M${seg.map(({ s, e }) => `${f(s[0])} ${f(s[1])}A${f(r)} ${f(r)} 0 0 1 ${f(e[0])} ${f(e[1])}`).join('L')}Z`;
}

// The brand hexagon lying flat (tips left and right), centred on cx, cy, h high.
function hex(cx, cy, h, r = h / 6) {
  const w = h * 1.1547; const t = h * 0.2887;
  const x = cx - w / 2; const y = cy - h / 2;
  return rounded([[x, y + h / 2], [x + t, y], [x + w - t, y], [x + w, y + h / 2], [x + w - t, y + h], [x + t, y + h]], r);
}

const shadow = (id, color, layers) => `<filter id="${id}" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">${
  layers.map(([dx, dy, sd, op], i) => `<feDropShadow in="SourceGraphic" dx="${dx}" dy="${dy}" stdDeviation="${sd}" flood-color="${color}" flood-opacity="${op}" result="s${i}"/>`).join('')
}<feMerge>${layers.map((_, i) => `<feMergeNode in="s${i}"/>`).join('')}<feMergeNode in="SourceGraphic"/></feMerge></filter>`;

const svg = (w, h, body, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"${extra}>${body}</svg>\n`;
const write = (name, s) => { writeFileSync(join(out, name), s); console.log(`${name} ${s.length} B`); };

const PAPER = { honey: '#f4b942', apricot: '#f2a77f', sage: '#a9c49a', lavender: '#c9b8e6', cream: '#fffaf0', ink: '#3a2a1d' };

// Mark: three stacked paper hexagons, the top one with a check cut out of it.
{
  const h = 42; const c = [29, 28];
  const check = 'M17.5 29.5l7.5 7.5 13.5-14';
  const body = `<defs>${shadow('sh', PAPER.ink, [[0.8, 1.4, 1.1, 0.32], [1.6, 3, 2.6, 0.16]])}
<mask id="cut" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/><path d="${check}" fill="none" stroke="#000" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/></mask></defs>
<g filter="url(#sh)"><path d="${hex(c[0] + 5.5, c[1] + 6, h)}" fill="${PAPER.sage}"/></g>
<g filter="url(#sh)"><path d="${hex(c[0] + 2.75, c[1] + 3, h)}" fill="${PAPER.apricot}"/></g>
<g filter="url(#sh)"><path d="${hex(c[0], c[1], h)}" fill="${PAPER.honey}" mask="url(#cut)"/></g>`;
  write('mark.svg', svg(64, 64, body));
}

// Motif: a small stack of paper hexagons, each turned a little; the top one carries list slits.
{
  const h = 46;
  const slits = [[-12, -9, 22], [-12, 0, 16], [-12, 9, 19]];
  const top = [46, 34];
  const body = `<defs>${shadow('sh', PAPER.ink, [[1, 1.8, 1.4, 0.3], [2.5, 4.5, 3.5, 0.16]])}
<mask id="cut" maskUnits="userSpaceOnUse" x="0" y="0" width="96" height="80"><rect width="96" height="80" fill="#fff"/>${
  slits.map(([dx, dy, len]) => `<path d="M${top[0] + dx} ${top[1] + dy}h${len}" stroke="#000" stroke-width="4.5" stroke-linecap="round"/>`).join('')
}</mask></defs>
<g filter="url(#sh)"><path d="${hex(top[0] + 9, top[1] + 12, h)}" fill="${PAPER.lavender}" transform="rotate(9 ${top[0] + 9} ${top[1] + 12})"/></g>
<g filter="url(#sh)"><path d="${hex(top[0] + 4, top[1] + 6, h)}" fill="${PAPER.sage}" transform="rotate(-7 ${top[0] + 4} ${top[1] + 6})"/></g>
<g filter="url(#sh)"><path d="${hex(top[0], top[1], h)}" fill="${PAPER.honey}" mask="url(#cut)"/></g>`;
  write('motif.svg', svg(96, 80, body));
}

// Hero landscape: four paper layers of soft hexagons that rise to the right, then the page
// itself as the front layer. A fixed pseudo-random sequence keeps reruns identical.
function landscape(colors, shadowColor, op, moon) {
  const W = 1440; const H = 400;
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const layers = [
    { size: 130, from: 110, to: 340, phase: 0.4 },
    { size: 108, from: 80, to: 262, phase: 2.1 },
    { size: 88, from: 58, to: 190, phase: 4.0 },
    { size: 70, from: 40, to: 118, phase: 1.3 },
    { size: 54, from: 16, to: 40, phase: 3.2 },
  ];
  const elev = (L, x) => {
    const t = Math.max(0, Math.min(1, x / W));
    const s = t * t * (3 - 2 * t);
    return L.from + (L.to - L.from) * s + Math.sin(x / 170 + L.phase) * L.size * 0.16;
  };
  const groups = layers.map((L, i) => {
    const shapes = [];
    const pts = [];
    for (let x = -L.size * (0.3 + rnd() * 0.5); x < W + L.size; x += L.size * (0.8 + rnd() * 0.45)) {
      const h = L.size * (0.82 + rnd() * 0.36);
      const cy = H - elev(L, x) + h * 0.5 - h * 0.08 * rnd();
      const rot = (rnd() - 0.5) * 14;
      shapes.push(`<path d="${hex(f(x), f(cy), f(h))}" transform="rotate(${f(rot)} ${f(x)} ${f(cy)})"/>`);
      pts.push([x, cy]);
    }
    const ground = `M-20 ${H + 20}${pts.map(([x, y]) => `L${f(x)} ${f(y)}`).join('')}L${W + 20} ${f(pts.at(-1)[1])}L${W + 20} ${H + 20}Z`;
    return `<g fill="${colors[i]}" filter="url(#sh)">${shapes.join('')}<path d="${ground}"/></g>`;
  });
  const moonSvg = moon ? `<g filter="url(#sh)"><path d="${hex(1350, 64, 54)}" fill="${moon}" transform="rotate(-8 1350 64)"/></g>` : '';
  const body = `<defs>${shadow('sh', shadowColor, [[1.5, 3, 2.5, op], [5, 10, 10, op * 0.5]])}</defs>${moonSvg}${groups.join('')}`;
  return svg(W, H, body, ' preserveAspectRatio="xMaxYMax slice"');
}
write('landscape-light.svg', landscape([PAPER.lavender, PAPER.sage, PAPER.apricot, PAPER.honey, '#f5ecda'], PAPER.ink, 0.26));
write('landscape-dark.svg', landscape(['#2b3560', '#463a72', '#c99434', '#3a2d55', '#1d1a2e'], '#05030a', 0.6, '#f4b942'));

// Paper texture tiles: fine grain plus soft mottling and a few long fibres, stitched so the
// tile repeats without seams. Alpha stays low so text contrast is decided by the paper colour.
function paper(rgb, grain, mottle, fibre) {
  const [r, g, b] = rgb.map((c) => f(c / 255));
  const tint = (a, k) => `0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} ${a} 0 0 0 ${k}`;
  const body = `<filter id="p" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" stitchTiles="stitch" result="n1"/>
<feColorMatrix in="n1" type="matrix" values="${tint(grain[0], grain[1])}" result="grain"/>
<feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="9" stitchTiles="stitch" result="n2"/>
<feColorMatrix in="n2" type="matrix" values="${tint(mottle[0], mottle[1])}" result="mottle"/>
<feTurbulence type="turbulence" baseFrequency="0.018 0.05" numOctaves="2" seed="21" stitchTiles="stitch" result="n3"/>
<feComponentTransfer in="n3" result="n3a"><feFuncA type="discrete" tableValues="${fibre}"/></feComponentTransfer>
<feColorMatrix in="n3a" type="matrix" values="0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 0 0 0 1 0" result="fibres"/>
<feMerge><feMergeNode in="mottle"/><feMergeNode in="fibres"/><feMergeNode in="grain"/></feMerge></filter>
<rect width="100%" height="100%" filter="url(#p)"/>`;
  return svg(360, 360, body);
}
write('paper-light.svg', paper([90, 62, 36], [0.42, -0.16], [0.12, -0.045], '0 0 0 0 0 0 0 0 0.045 0 0 0 0 0 0 0 0 0 0.035 0'));
write('paper-dark.svg', paper([246, 236, 218], [0.3, -0.12], [0.07, -0.026], '0 0 0 0 0 0 0 0 0.04 0 0 0 0 0 0 0 0 0 0.03 0'));
