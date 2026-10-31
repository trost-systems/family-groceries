// Usage: node make-assets.mjs
// Writes assets/mark.svg, motif.svg, comb-light.svg and comb-dark.svg for the Glas style:
// soft-cornered hexagons as stacked glass panes. Corner radii scale with size like 3b's
// shape.hex (8 px at 48 px height).
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

const out = join(dirname(new URL(import.meta.url).pathname), 'assets');
const f = (n) => Math.round(n * 100) / 100;

// Pointy-top hexagon around (cx, cy) with circumradius R and corner radius r.
function hex(cx, cy, R, r = R / 3) {
  const v = [-90, -30, 30, 90, 150, 210].map((a) => [cx + R * Math.cos((a * Math.PI) / 180), cy + R * Math.sin((a * Math.PI) / 180)]);
  const t = r / Math.tan(Math.PI / 3);
  const toward = ([x, y], [px, py]) => { const d = Math.hypot(px - x, py - y); return [x + ((px - x) / d) * t, y + ((py - y) / d) * t]; };
  let d = '';
  v.forEach((p, i) => {
    const a = toward(p, v[(i + 5) % 6]); const b = toward(p, v[(i + 1) % 6]);
    d += `${i ? 'L' : 'M'}${f(a[0])} ${f(a[1])}A${f(r)} ${f(r)} 0 0 1 ${f(b[0])} ${f(b[1])}`;
  });
  return `${d}Z`;
}
const cr = (R) => (2 * R) / 6; // 8 px corner at 48 px height

const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n${body}\n</svg>\n`;
const lin = (id, stops, [x1, y1, x2, y2] = [0, 0, 0, 1]) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`;
const rad = (id, stops, cx = 0.38, cy = 0.28, r = 0.85) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</radialGradient>`;

// One glass pane: tinted body, a hairline outside for light pages, a light rim inside and a
// gloss on the upper third.
function pane(id, cx, cy, R, fill, { hair = 0.3, gloss = 0.45, rim = 1.4 } = {}) {
  const p = hex(cx, cy, R, cr(R));
  const inner = hex(cx, cy, R - rim, cr(R - rim));
  return {
    defs: `<clipPath id="${id}-c"><path d="${p}"/></clipPath>`,
    body: `<path d="${p}" fill="${fill}" stroke="#2b1f66" stroke-opacity="${hair}" stroke-width="1.2"/>
<g clip-path="url(#${id}-c)"><ellipse cx="${f(cx - R * 0.15)}" cy="${f(cy - R * 0.95)}" rx="${f(R * 1.05)}" ry="${f(R * 0.6)}" fill="#ffffff" fill-opacity="${gloss}"/></g>
<path d="${inner}" fill="none" stroke="url(#rim)" stroke-width="${rim}"/>`,
  };
}

const rimGrad = lin('rim', [[0, '#ffffff', 1], [0.45, '#ffffff', 0.35], [1, '#ffffff', 0.7]]);
const honeyCore = rad('honey', [[0, '#ffe792'], [0.5, '#ffc233'], [1, '#e48c00']]);
const check = (x, y, s, w) => {
  const d = `M${f(x - 7 * s)} ${f(y + 0.5 * s)}l${f(4.6 * s)} ${f(4.6 * s)}l${f(9.4 * s)} ${f(-9.6 * s)}`;
  return `<path d="${d}" fill="none" stroke="#6b3f00" stroke-opacity="0.45" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 ${f(0.9 * s)})"/>
<path d="${d}" fill="none" stroke="#ffffff" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
};

// mark.svg: a glass cell with a refracted honey core and a white check.
{
  const shell = pane('shell', 32, 32, 30.5, 'url(#shellFill)', { hair: 0.42, gloss: 0.5, rim: 1.5 });
  const core = hex(33, 34, 19.5, cr(19.5));
  const body = `<defs>${rimGrad}${honeyCore}
${lin('shellFill', [[0, '#ffffff', 0.95], [0.55, '#ebe5ff', 0.86], [1, '#b8a5f7', 0.9]])}
${shell.defs}<clipPath id="core-c"><path d="${core}"/></clipPath></defs>
${shell.body}
<path d="${core}" fill="url(#honey)" stroke="#a86400" stroke-opacity="0.35" stroke-width="0.8"/>
<g clip-path="url(#core-c)"><path d="M10 30 L44 8 L52 8 L14 38 Z" fill="#ffffff" fill-opacity="0.42"/></g>
${check(33, 33.5, 1, 4.4)}`;
  writeFileSync(join(out, 'mark.svg'), svg(64, 64, body));
}

// motif.svg: three overlapping glass cells, the honey one with a check.
{
  const a = pane('a', 46, 55, 36, 'url(#lav)', { hair: 0.28, gloss: 0.38 });
  const b = pane('b', 80, 59, 28, 'url(#hon)', { hair: 0.3, gloss: 0.4 });
  const c = pane('c', 92, 25, 16, 'url(#mint)', { hair: 0.28, gloss: 0.5, rim: 1.2 });
  const body = `<defs>${rimGrad}
${lin('lav', [[0, '#f4f0ff', 0.85], [1, '#a58cff', 0.72]])}
${lin('hon', [[0, '#ffe38a', 0.92], [1, '#f2a000', 0.86]])}
${lin('mint', [[0, '#f2fffa', 0.9], [1, '#7fdcbc', 0.8]])}
${a.defs}${b.defs}${c.defs}</defs>
${a.body}
${c.body}
${b.body}
${check(80, 58, 1.15, 4.6)}`;
  writeFileSync(join(out, 'motif.svg'), svg(120, 100, body));
}

// comb-light.svg / comb-dark.svg: the hero backdrop, large panes overlapping behind the phone.
for (const [name, k] of [['comb-light', { lav: 0.34, hon: 0.4, mint: 0.32, rim: 0.95, hair: 0.12 }], ['comb-dark', { lav: 0.36, hon: 0.3, mint: 0.16, rim: 0.26, hair: 0 }]]) {
  const panes = [
    ['p1', 470, 360, 250, '#a58cff', k.lav],
    ['p2', 255, 520, 160, '#ffc233', k.hon],
    ['p3', 660, 150, 118, '#7fdcbc', k.mint],
    ['p4', 170, 190, 82, '#ffffff', k.mint],
  ];
  const defs = panes.map(([id, , , , c, o]) => lin(`${id}g`, [[0, c, o * 0.55], [1, c, o]])).join('');
  const body = panes.map(([id, cx, cy, R]) => {
    const p = hex(cx, cy, R, cr(R)); const inner = hex(cx, cy, R - 3, cr(R - 3));
    return `<path d="${p}" fill="url(#${id}g)" stroke="#2b1f66" stroke-opacity="${k.hair}" stroke-width="1.5"/>
<path d="${inner}" fill="none" stroke="url(#rim)" stroke-opacity="${k.rim}" stroke-width="2.5"/>`;
  }).join('\n');
  writeFileSync(join(out, `${name}.svg`), svg(800, 720, `<defs>${rimGrad}${defs}</defs>\n${body}`));
}
console.log('assets written');
