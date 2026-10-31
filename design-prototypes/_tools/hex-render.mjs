// Shared by build-hex-assets.mjs (the 3a/3b variants) and build-art-styles.mjs (job 46):
// hexagon mask geometry, contrast maths and the {{placeholder}} renderer for hex-src/ pages.
import { readFileSync } from 'node:fs';

export const num = (n) => Number(n.toFixed(3)).toString();
export const px = (t) => t.$value.value;

// A closed polygon as an SVG path; every vertex with r > 0 gets a circular fillet
// tangent to both edges (tangent distance r / tan(angle / 2)).
export function filletPath(points) {
  const n = points.length;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const unit = (v) => { const l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l]; };
  const parts = [];
  for (let i = 0; i < n; i++) {
    const { x, y, r } = points[i];
    const p = [x, y];
    if (!r) { parts.push(`${parts.length ? 'L' : 'M'}${num(x)} ${num(y)}`); continue; }
    const prev = points[(i + n - 1) % n]; const next = points[(i + 1) % n];
    const u1 = unit(sub([prev.x, prev.y], p)); const u2 = unit(sub([next.x, next.y], p));
    const angle = Math.acos(u1[0] * u2[0] + u1[1] * u2[1]);
    const t = r / Math.tan(angle / 2);
    const a = [x + u1[0] * t, y + u1[1] * t]; const b = [x + u2[0] * t, y + u2[1] * t];
    const sweep = (x - prev.x) * (next.y - y) - (y - prev.y) * (next.x - x) > 0 ? 1 : 0;
    parts.push(`${parts.length ? 'L' : 'M'}${num(a[0])} ${num(a[1])}`, `A${num(r)} ${num(r)} 0 0 ${sweep} ${num(b[0])} ${num(b[1])}`);
  }
  return `${parts.join(' ')} Z`;
}

const svg = (w, h, d) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(w)} ${num(h)}" width="${num(w)}" height="${num(h)}" preserveAspectRatio="none"><path d="${d}" fill="#000"/></svg>\n`;

// Horizontal hexagon, pointed left and right, drawn at the reference height. The caps are
// half a height wide: the pointed end plus enough flat edge for the corner fillet; CSS
// stretches a plain rectangle between them (mask-size: var(--cw) 100%, --cw = height / 2).
export function shapes({ tip, h, r }) {
  const t = tip * h; const cw = h / 2;
  const capL = [{ x: cw, y: 0 }, { x: cw, y: h }, { x: t, y: h, r }, { x: 0, y: h / 2, r }, { x: t, y: 0, r }];
  const capR = capL.map((p) => ({ ...p, x: cw - p.x })).reverse();
  const w = h * Math.sqrt(3) / 2;
  const pointy = [[w / 2, 0], [w, h / 4], [w, 3 * h / 4], [w / 2, h], [0, 3 * h / 4], [0, h / 4]].map(([x, y]) => ({ x, y, r }));
  return {
    'hex-cap-l.svg': svg(cw, h, filletPath(capL)),
    'hex-cap-r.svg': svg(cw, h, filletPath(capR)),
    'hex-pointy.svg': svg(w, h, filletPath(pointy)),
  };
}

export const hexOf = (tok) => tok.$value.hex;
function lum(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
export function edgeSwatches(tokens) {
  const rows = [
    ['edge', 'Unterkante: die sichtbare Tiefe unter Knöpfen und Chips'],
    ['honey-edge', 'Seitenwand zwischen Fläche und Unterkante, unter Honig- und Tinten-Knöpfen'],
    ['surface-edge', 'Seitenwand unter hellen Chips'],
  ];
  return rows.map(([k, desc]) => {
    const l = hexOf(tokens.color.light[k]); const d = hexOf(tokens.color.dark[k]);
    const cr = (hex, mode) => ratio(hex, hexOf(tokens.color[mode].surface)).toFixed(1).replace('.', ',');
    return `          <li class="swatch"><span class="swatch-chip bg-${k}"></span><div><p class="swatch-name">${k}</p><p class="swatch-hex"><span>hell ${l}</span> <span>dunkel ${d}</span></p><p class="swatch-desc">${desc}</p><p class="swatch-on">Gegen surface: ${cr(l, 'light')} : 1 hell · ${cr(d, 'dark')} : 1 dunkel</p></div></li>`;
  }).join('\n');
}

// {{t:depth.edge}} in a page: the token's value as the sheet prints it ("6 px", "0,2887").
export function tokenText(tokens, path) {
  const tok = path.split('.').reduce((o, k) => o?.[k], tokens);
  if (!tok || !('$value' in tok)) throw new Error(`unknown token ${path}`);
  const v = tok.$value;
  if (typeof v === 'string' && v.startsWith('{')) return tokenText(tokens, v.slice(1, -1));
  if (typeof v === 'number') return String(v).replace('.', ',');
  if (Array.isArray(v)) return `cubic-bezier(${v.join(', ')})`;
  return `${v.value} ${v.unit}`;
}

// A hex-src page with {{name}} from vars and {{t:path}} from the token file.
export function render(file, tokens, vars) {
  return readFileSync(file, 'utf8').replace(/\{\{([a-z-]+|t:[a-z.-]+)\}\}/g, (m, k) => {
    if (k.startsWith('t:')) return tokenText(tokens, k.slice(2));
    if (!(k in vars)) throw new Error(`${file}: unknown placeholder ${m}`);
    return vars[k];
  });
}
