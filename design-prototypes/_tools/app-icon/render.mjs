// Renders a variation (variations.mjs) into the formats each platform takes: SVG layers per
// appearance, the one-colour layer, Android vector drawables, and composited previews.
import polygonClipping from 'polygon-clipping';

const f = (n) => Number(n.toFixed(2));
export const CANVAS = 1024;
// Android: 108 dp canvas, 72 dp visible (= our 1024), 66 dp safe circle.
export const DP = CANVAS / 72;
export const ANDROID_PAD = 18 * DP;
export const SAFE_RADIUS = 33 * DP;
const BLEED = [-ANDROID_PAD, -ANDROID_PAD, CANVAS + 2 * ANDROID_PAD, CANVAS + 2 * ANDROID_PAD];

const paths = (els, colors) => els.filter((e) => e.role).map((e) => `<path fill="${colors[e.role]}" d="${e.shape.d}"/>`).join('');
const svg = (viewBox, body, size = CANVAS) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.join(' ')}" width="${size}" height="${size}">${body}</svg>\n`;
const bgBody = (v, colors) => `<rect x="${BLEED[0]}" y="${BLEED[1]}" width="${BLEED[2]}" height="${BLEED[3]}" fill="${colors.bg}"/>${paths(v.bg, colors)}`;

export const colorsFor = (v, appearance) => ({ ...v.colors.light, ...(appearance === 'dark' ? v.colors.dark : {}) });

// Icon Composer and visionOS layers, 1024 canvas.
export const backgroundSvg = (v, appearance) => svg([0, 0, CANVAS, CANVAS], bgBody(v, colorsFor(v, appearance)));
export const layerSvg = (v, i, appearance) => svg([0, 0, CANVAS, CANVAS], paths(v.layers[i].els, colorsFor(v, appearance)));

// The one-colour shape: elements in order, 'fill' adds, 'cut' removes.
export function monoPolygons(v) {
  let acc = [];
  for (const e of [...v.bg, ...v.layers.flatMap((l) => l.els)]) {
    if (e.mono === 'skip') continue;
    const geom = e.shape.rings.map((r) => [r.map(([x, y]) => [x, y])]);
    acc = e.mono === 'fill' ? polygonClipping.union(acc, ...geom) : polygonClipping.difference(acc, ...geom);
  }
  return acc;
}
export const monoD = (v) => monoPolygons(v).flatMap((poly) => poly.map((ring) => `M${ring.slice(0, -1).map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')} Z`)).join(' ');
export const monoSvg = (v, color = '#ffffff', size = CANVAS) => svg([0, 0, CANVAS, CANVAS], `<path fill="${color}" fill-rule="evenodd" d="${monoD(v)}"/>`, size);

// Android adaptive icon layers on the 108 dp canvas.
const androidBox = BLEED;
export const androidForegroundSvg = (v, size) => svg(androidBox, v.layers.map((l) => paths(l.els, colorsFor(v, 'light'))).join(''), size);
export const androidBackgroundSvg = (v, size) => svg(androidBox, bgBody(v, colorsFor(v, 'light')), size);
export const androidMonoSvg = (v, size) => svg(androidBox, `<path fill="#000000" fill-rule="evenodd" d="${monoD(v)}"/>`, size);

// Vector drawables: viewport in our units, translated so the 108 dp canvas starts at 0.
function vectorDrawable(pathsXml) {
  const vp = f(CANVAS + 2 * ANDROID_PAD);
  return `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="${vp}"
    android:viewportHeight="${vp}">
    <group android:translateX="${f(ANDROID_PAD)}" android:translateY="${f(ANDROID_PAD)}">
${pathsXml}
    </group>
</vector>
`;
}
const vdPath = (fill, d, evenOdd = false) => `        <path android:fillColor="${fill}"${evenOdd ? ' android:fillType="evenOdd"' : ''} android:pathData="${d}"/>`;
const vdPaths = (els, colors) => els.filter((e) => e.role).map((e) => vdPath(colors[e.role], e.shape.d)).join('\n');
export const androidForegroundXml = (v) => vectorDrawable(v.layers.map((l) => vdPaths(l.els, colorsFor(v, 'light'))).join('\n'));
export const androidBackgroundXml = (v) => {
  const c = colorsFor(v, 'light');
  const full = `M${BLEED[0]} ${BLEED[1]} L${BLEED[0] + BLEED[2]} ${BLEED[1]} L${BLEED[0] + BLEED[2]} ${BLEED[1] + BLEED[3]} L${BLEED[0]} ${BLEED[1] + BLEED[3]} Z`;
  return vectorDrawable([vdPath(c.bg, full), vdPaths(v.bg, c)].filter(Boolean).join('\n'));
};
export const androidMonoXml = (v) => vectorDrawable(vdPath('#FF000000', monoD(v), true));
export const adaptiveIconXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
    <monochrome android:drawable="@drawable/ic_launcher_monochrome"/>
</adaptive-icon>
`;

// Masks, in the 1024 icon space.
function superellipse(n, r = CANVAS / 2, steps = 256) {
  const pts = Array.from({ length: steps }, (_, i) => {
    const t = (i / steps) * 2 * Math.PI;
    const c = Math.cos(t), s = Math.sin(t);
    return [r + r * Math.sign(c) * Math.abs(c) ** (2 / n), r + r * Math.sign(s) * Math.abs(s) ** (2 / n)];
  });
  return `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')} Z`;
}
function cookie(lobes, depth) {
  const pts = Array.from({ length: 360 }, (_, i) => {
    const t = (i / 360) * 2 * Math.PI;
    const r = (CANVAS / 2) * (1 - depth + depth * Math.cos(lobes * t));
    return [CANVAS / 2 + r * Math.cos(t), CANVAS / 2 + r * Math.sin(t)];
  });
  return `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')} Z`;
}
const roundSquare = (r) => `M${r} 0 L${CANVAS - r} 0 A${r} ${r} 0 0 1 ${CANVAS} ${r} L${CANVAS} ${CANVAS - r} A${r} ${r} 0 0 1 ${CANVAS - r} ${CANVAS} L${r} ${CANVAS} A${r} ${r} 0 0 1 0 ${CANVAS - r} L0 ${r} A${r} ${r} 0 0 1 ${r} 0 Z`;
export const MASKS = {
  apple: superellipse(5),
  circle: `M0 512 A512 512 0 1 0 1024 512 A512 512 0 1 0 0 512 Z`,
  squircle: superellipse(4),
  rounded: roundSquare(184),
  cookie: cookie(9, 0.06),
  none: 'M0 0 L1024 0 L1024 1024 L0 1024 Z',
};

const clipped = (mask, body, size) => svg([0, 0, CANVAS, CANVAS], `<defs><clipPath id="m"><path d="${MASKS[mask]}"/></clipPath></defs><g clip-path="url(#m)">${body}</g>`, size);
const fullArt = (v, appearance) => {
  const c = colorsFor(v, appearance);
  return bgBody(v, c) + v.layers.map((l) => paths(l.els, c)).join('');
};

// Previews. Clear and tinted are approximations: the system derives them from the layers, we
// show the one-colour shape the way Icon Composer's mono previews read.
export const TINT = '#ffb84a';
export function preview(v, mode, { mask = 'apple', size = CANVAS } = {}) {
  const mono = `<path fill-rule="evenodd" d="${monoD(v)}"`;
  switch (mode) {
    case 'light':
    case 'dark':
      return clipped(mask, fullArt(v, mode), size);
    case 'clear':
      return clipped(mask, `<rect width="1024" height="1024" fill="#ffffff" fill-opacity="0.16"/>${mono} fill="#ffffff" fill-opacity="0.9"/>`, size);
    case 'tinted':
      return clipped(mask, `<rect width="1024" height="1024" fill="#1d160b"/>${mono} fill="${TINT}"/>`, size);
    case 'themed-light':
      return clipped(mask, `<rect width="1024" height="1024" fill="#d7e8cd"/>${mono} fill="#102000"/>`, size);
    case 'themed-dark':
      return clipped(mask, `<rect width="1024" height="1024" fill="#253420"/>${mono} fill="#bcecaa"/>`, size);
    default:
      throw new Error(`unknown preview mode ${mode}`);
  }
}

// Android masks see the 72 dp middle of the 108 dp canvas; our art space is exactly that.
export const androidPreview = (v, mask, size) => preview(v, 'light', { mask, size });

// The art goes inside a group so the sprite sheet can place it.
export const artGroup = (v, appearance, mask = 'apple') => {
  const id = `m${v.n}${appearance}${mask}`;
  return { defs: `<clipPath id="${id}"><path d="${MASKS[mask]}"/></clipPath>`, body: `<g clip-path="url(#${id})">${fullArt(v, appearance)}</g>` };
};

// Guards over the data: Android's safe zone, and the brief's "not Lidl" rule.
export function checkVariation(v) {
  const problems = [];
  if (v.layers.length > 2) problems.push('more than two foreground groups (visionOS takes three layers in all)');
  for (const l of v.layers) {
    for (const e of l.els) {
      for (const ring of e.shape.rings) {
        const far = Math.max(...ring.map(([x, y]) => Math.hypot(x - CANVAS / 2, y - CANVAS / 2)));
        if (far > SAFE_RADIUS + 0.5 && e.mono !== 'cut') problems.push(`layer "${l.name}" reaches ${f(far / DP)} dp from the centre, past the 33 dp safe circle`);
      }
    }
  }
  for (const appearance of ['light', 'dark']) {
    const c = colorsFor(v, appearance);
    const kinds = new Set(Object.values(c).map(hueKind));
    if (kinds.has('blue') && kinds.has('yellow') && kinds.has('red')) problems.push(`${appearance}: blue, yellow and red together (Lidl)`);
    if (hueKind(c.bg) === 'blue' && [...Object.entries(c)].some(([k, col]) => k !== 'bg' && hueKind(col) === 'yellow')) problems.push(`${appearance}: yellow on a blue field (Lidl)`);
  }
  if (/\bHumm\b/.test(JSON.stringify([v.name, v.why]))) problems.push('"Humm" alone');
  return problems;
}

function hueKind(hexColor) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hexColor.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  if (s < 0.45 || l < 0.2 || l > 0.85) return 'neutral';
  let h = 0;
  if (max === r) h = ((g - b) / (max - min)) % 6;
  else if (max === g) h = (b - r) / (max - min) + 2;
  else h = (r - g) / (max - min) + 4;
  h = (h * 60 + 360) % 360;
  if (h < 18 || h >= 340) return 'red';
  if (h >= 40 && h < 65) return 'yellow';
  if (h >= 200 && h < 245) return 'blue';
  return 'other';
}
