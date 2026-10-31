// Usage: node make-assets.mjs
// Writes the Riso style's SVG assets (mark, motif, paper and ink grain) into ./assets.
// Every hexagon is a pointy-top hexagon with rounded corners, like 3b's .hxp masks.
// Two inks per mode: light paper takes yellow and Federal Blue multiplied (overlaps go green),
// dark stock takes yellow and a light blue, with the H knocked out to the stock.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const out = join(dirname(new URL(import.meta.url).pathname), 'assets');
mkdirSync(out, { recursive: true });

const INK = {
  light: { yellow: '#ffd23f', blue: '#2852b8', deep: '#1e3a8c', paper: '#f3eee2' },
  dark: { yellow: '#ffd23f', blue: '#93b2ff', deep: '#93b2ff', paper: '#131a33' },
};

const f = (n) => Number(n.toFixed(2));
// Pointy-top hexagon around (cx, cy), circumradius R, corners rounded with radius r.
function hex(cx, cy, R, r = R * 0.22) {
  const v = [...Array(6)].map((_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90);
    return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
  });
  const d = r / Math.tan(Math.PI / 3);
  const toward = (p, q, t) => [p[0] + ((q[0] - p[0]) * t) / R, p[1] + ((q[1] - p[1]) * t) / R];
  let path = '';
  v.forEach((p, i) => {
    const prev = v[(i + 5) % 6];
    const next = v[(i + 1) % 6];
    const a = toward(p, prev, d);
    const b = toward(p, next, d);
    path += `${i ? 'L' : 'M'}${f(a[0])} ${f(a[1])}Q${f(p[0])} ${f(p[1])} ${f(b[0])} ${f(b[1])}`;
  });
  return `${path}Z`;
}

// Specks where the ink did not take: fine noise thresholded into the paper colour.
const inkGrain = (id, freq = 1.1, cut = 0.62) => `<filter id="${id}" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" seed="7" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${f(1 / (1 - cut))} 0 0 0 ${f(-cut / (1 - cut))}" result="holes"/>
    <feComposite in="SourceGraphic" in2="holes" operator="out"/>
  </filter>`;

function mark(mode) {
  const k = INK[mode];
  const H = 'M21.5 19v23M39.5 19v23M21.5 30.5h18';
  const hLayer = mode === 'light'
    ? `<path d="${H}" fill="none" stroke="${k.deep}" stroke-width="6.5" stroke-linecap="round" style="mix-blend-mode:multiply" filter="url(#g)"/>`
    : `<path d="${H}" fill="none" stroke="${k.paper}" stroke-width="6.5" stroke-linecap="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
  ${inkGrain('g', 1.4, 0.7)}
  </defs>
  <g style="isolation:isolate">
  <path d="${hex(34.6, 34.4, 26.5)}" fill="${k.yellow}" filter="url(#g)"/>
  <path d="${hex(30.4, 30.2, 26.5)}" fill="none" stroke="${k.deep}" stroke-width="3.2" style="mix-blend-mode:multiply" filter="url(#g)"/>
  ${hLayer}
  </g>
</svg>
`;
}

function motif(mode) {
  const k = INK[mode];
  const blend = 'mix-blend-mode:multiply';
  const check = 'M80.5 82l6 6 11.5-12.5';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 112" width="128" height="112">
  <defs>
  ${inkGrain('g', 1.2, 0.66)}
  <pattern id="dots" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(15)">
    <circle cx="2.5" cy="2.5" r="1.45" fill="${k.blue}"/>
  </pattern>
  </defs>
  <g style="isolation:isolate">
  <path d="${hex(44, 58, 30)}" fill="${k.yellow}" filter="url(#g)"/>
  <path d="${hex(74, 40, 24)}" fill="url(#dots)" style="${blend}"/>
  <path d="${hex(92, 84, 19)}" fill="${k.yellow}" filter="url(#g)"/>
  <path d="${hex(41, 55, 29)}" fill="none" stroke="${k.deep}" stroke-width="3" style="${blend}" filter="url(#g)"/>
  <path d="${hex(74, 40, 24)}" fill="none" stroke="${k.deep}" stroke-width="3" style="${blend}" filter="url(#g)"/>
  <path d="${hex(89, 81.5, 18.5)}" fill="none" stroke="${k.deep}" stroke-width="3" style="${blend}" filter="url(#g)"/>
  <path d="${check}" fill="none" stroke="${k.deep}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" style="${blend}"/>
  <path d="M30 52h22M30 61h16M30 70h19" fill="none" stroke="${k.deep}" stroke-width="3.6" stroke-linecap="round" style="${blend}"/>
  </g>
</svg>
`;
}

// Paper: fibres and specks over the page colour, drawn as a transparent tile.
function paper(mode) {
  const [r, g, b] = mode === 'light' ? [0.32, 0.27, 0.16] : [0.75, 0.8, 1];
  const a = mode === 'light' ? 0.5 : 0.32;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">
  <filter id="p" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="3" stitchTiles="stitch"/>
    <feColorMatrix type="matrix" values="0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  ${f(a * 3)} 0 0 0 ${f(-a * 1.55)}"/>
  </filter>
  <rect width="240" height="240" filter="url(#p)"/>
</svg>
`;
}

// Ink: uneven coverage over a flat colour, light blotches and specks where the drum ran dry.
function ink(mode) {
  const [r, g, b] = mode === 'light' ? [1, 0.98, 0.93] : [0.07, 0.1, 0.2];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320">
  <filter id="i" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.035 0.05" numOctaves="2" seed="11" stitchTiles="stitch" result="big"/>
    <feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="1" seed="5" stitchTiles="stitch" result="fine"/>
    <feColorMatrix in="big" type="matrix" values="0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  ${mode === 'light' ? '0.5 0 0 0 -0.2' : '0.32 0 0 0 -0.16'}" result="blotch"/>
    <feColorMatrix in="fine" type="matrix" values="0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  2.6 0 0 0 -1.55" result="speck"/>
    <feMerge><feMergeNode in="blotch"/><feMergeNode in="speck"/></feMerge>
  </filter>
  <rect width="320" height="320" filter="url(#i)"/>
</svg>
`;
}

const files = {
  'mark.svg': mark('light'),
  'mark-dark.svg': mark('dark'),
  'motif.svg': motif('light'),
  'motif-dark.svg': motif('dark'),
  'paper-light.svg': paper('light'),
  'paper-dark.svg': paper('dark'),
  'ink-light.svg': ink('light'),
  'ink-dark.svg': ink('dark'),
};
for (const [name, svg] of Object.entries(files)) writeFileSync(join(out, name), svg);
console.log(Object.keys(files).join(' '));
