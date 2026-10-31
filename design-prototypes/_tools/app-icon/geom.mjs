// Shapes for the app icon art. A shape is { d, rings }: exact SVG path data (M, L, A, Z only,
// which Android vector drawables also read) and the same outline flattened to polygons, which
// the monochrome boolean ops and the safe-zone check use. Strokes become outlines here, so
// everything is a fill.
import polygonClipping from 'polygon-clipping';

const f = (n) => Number(n.toFixed(2));
const P = ([x, y]) => `${f(x)} ${f(y)}`;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const len = (a) => Math.hypot(a[0], a[1]);
const unit = (a) => mul(a, 1 / len(a));
const normal = (a) => [a[1], -a[0]];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];

// Points along the arc around `c` from p1 to p2, the short way round (or clockwise when `cw`).
function arcPoints(c, p1, p2, cw) {
  const a1 = Math.atan2(p1[1] - c[1], p1[0] - c[0]);
  let a2 = Math.atan2(p2[1] - c[1], p2[0] - c[0]);
  if (cw === undefined) {
    while (a2 - a1 > Math.PI) a2 -= 2 * Math.PI;
    while (a1 - a2 > Math.PI) a2 += 2 * Math.PI;
  } else if (cw) {
    while (a2 < a1) a2 += 2 * Math.PI;
  } else {
    while (a2 > a1) a2 -= 2 * Math.PI;
  }
  const r = len(sub(p1, c));
  const steps = Math.max(2, Math.ceil(Math.abs(a2 - a1) / (Math.PI / 48)));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = a1 + ((a2 - a1) * i) / steps;
    return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
  });
}

export function rotatePoints(points, deg, [cx, cy] = [512, 512]) {
  const r = (deg * Math.PI) / 180;
  return points.map(([x, y]) => [cx + (x - cx) * Math.cos(r) - (y - cy) * Math.sin(r), cy + (x - cx) * Math.sin(r) + (y - cy) * Math.cos(r)]);
}

export const merge = (...shapes) => ({ d: shapes.map((s) => s.d).join(' '), rings: shapes.flatMap((s) => s.rings) });

// A polygon with every corner rounded by `radius` (tangent arcs, like the 3b hex buttons).
export function roundedPolygon(points, radius) {
  const n = points.length;
  let d = '';
  const ring = [];
  for (let i = 0; i < n; i++) {
    const prev = points[(i + n - 1) % n];
    const cur = points[i];
    const next = points[(i + 1) % n];
    const a = unit(sub(prev, cur));
    const b = unit(sub(next, cur));
    const angle = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1])));
    const t = Math.min(radius / Math.tan(angle / 2), len(sub(prev, cur)) / 2, len(sub(next, cur)) / 2);
    const r = t * Math.tan(angle / 2);
    const p1 = add(cur, mul(a, t));
    const p2 = add(cur, mul(b, t));
    if (r < 0.01) {
      d += `${i === 0 ? 'M' : 'L'}${P(cur)} `;
      ring.push(cur);
      continue;
    }
    const sweep = cross(a, b) < 0 ? 1 : 0;
    d += `${i === 0 ? 'M' : 'L'}${P(p1)} A${f(r)} ${f(r)} 0 0 ${sweep} ${P(p2)} `;
    const c = add(cur, mul(unit(add(a, b)), r / Math.sin(angle / 2)));
    ring.push(...arcPoints(c, p1, p2));
  }
  return { d: `${d}Z`, rings: [ring] };
}

export const polygon = (points) => roundedPolygon(points, 0);

// Pointy-top hexagon with circumradius R; `soft` is the corner radius as a fraction of the
// height, and 1/6 matches 3b Hex Soft (8 px at 48 px).
export function hexPoints(cx, cy, R, rotation = 0) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = ((-90 + 60 * i + rotation) * Math.PI) / 180;
    return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
  });
}
export const hex = (cx, cy, R, soft = 1 / 6) => roundedPolygon(hexPoints(cx, cy, R), 2 * R * soft);

export const roundRect = (x, y, w, h, r, rotation = 0) => {
  const pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  return roundedPolygon(rotation ? rotatePoints(pts, rotation, [x + w / 2, y + h / 2]) : pts, r);
};

export function circle(cx, cy, r) {
  const a = [cx - r, cy];
  const b = [cx + r, cy];
  return {
    d: `M${P(a)} A${f(r)} ${f(r)} 0 1 0 ${P(b)} A${f(r)} ${f(r)} 0 1 0 ${P(a)} Z`,
    rings: [Array.from({ length: 96 }, (_, i) => [cx + r * Math.cos((i * Math.PI) / 48), cy + r * Math.sin((i * Math.PI) / 48)])],
  };
}

// The outline of a stroked polyline (round caps, mitred joins).
export function strokeOutline(pts, width) {
  const h = width / 2;
  const segs = pts.slice(1).map((p, i) => unit(sub(p, pts[i])));
  const side = (sign) => pts.map((p, i) => {
    if (i === 0) return add(p, mul(normal(segs[0]), sign * h));
    if (i === pts.length - 1) return add(p, mul(normal(segs[i - 1]), sign * h));
    const n1 = normal(segs[i - 1]);
    const m = unit(add(n1, normal(segs[i])));
    return add(p, mul(m, (sign * h) / (m[0] * n1[0] + m[1] * n1[1])));
  });
  const left = side(1);
  const right = side(-1).reverse();
  const end = pts.at(-1);
  const start = pts[0];
  return {
    d: `M${left.map(P).join(' L')} A${f(h)} ${f(h)} 0 0 1 ${P(right[0])} L${right.slice(1).map(P).join(' L')} A${f(h)} ${f(h)} 0 0 1 ${P(left[0])} Z`,
    rings: [[...left, ...arcPoints(end, left.at(-1), right[0], true).slice(1, -1), ...right, ...arcPoints(start, right.at(-1), left[0], true).slice(1, -1)]],
  };
}

export const checkPoints = (x, y, s) => [[x, y + 0.5 * s], [x + 0.36 * s, y + 0.86 * s], [x + s, y]];
export const check = (x, y, s, width, rotation = 0) => strokeOutline(rotation ? rotatePoints(checkPoints(x, y, s), rotation) : checkPoints(x, y, s), width);
export const bar = (x1, y, x2, width, rotation = 0) => strokeOutline(rotation ? rotatePoints([[x1, y], [x2, y]], rotation) : [[x1, y], [x2, y]], width);

// An H as one 12-corner outline.
export function letterH(cx, cy, w, h, stem, bar, radius = 0) {
  const x0 = cx - w / 2, x1 = cx - w / 2 + stem, x2 = cx + w / 2 - stem, x3 = cx + w / 2;
  const y0 = cy - h / 2, y3 = cy + h / 2, yb0 = cy - bar / 2, yb1 = cy + bar / 2;
  return roundedPolygon([[x0, y0], [x1, y0], [x1, yb0], [x2, yb0], [x2, y0], [x3, y0], [x3, y3], [x2, y3], [x2, yb1], [x1, yb1], [x1, y3], [x0, y3]], radius);
}

// The part of `a` inside `b`, e.g. stripes clipped to a hexagon (flattened outline).
export function intersect(a, b) {
  const rings = polygonClipping.intersection(a.rings.map((r) => [r]), b.rings.map((r) => [r])).flat().map((r) => r.slice(0, -1));
  return { d: rings.map((r) => `M${r.map(P).join(' L')} Z`).join(' '), rings };
}
