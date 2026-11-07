// Hand-rolled SVG marks (dataviz specs: bars at most 24 px with a 4 px rounded data end, 2 px
// surface gap between stacked segments, 2 px lines, end dots with a surface ring, hairline
// baseline). Each chart is drawn at its container's measured width so text stays at 1:1.
import { s } from './dom.ts';

export interface Series {
  name: string;
  /** A CSS class that colours the marks (`mark-ok`, `mark-bad`, `mark-accent`, ...). */
  mark: string;
  values: number[];
}

const font = 11;

/** A bar from the baseline up to y, rounded only at its data end. */
function bar(x: number, y: number, w: number, h: number, round: boolean): string {
  if (h <= 0) return '';
  const r = round ? Math.min(4, w / 2, h) : 0;
  return `M${x} ${y + h}V${y + r}${r > 0 ? `A${r} ${r} 0 0 1 ${x + r} ${y}` : ''}H${x + w - r}${
    r > 0 ? `A${r} ${r} 0 0 1 ${x + w} ${y + r}` : ''
  }V${y + h}Z`;
}

/** The same bar hanging down from the baseline at y. */
function barDown(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return `M${x} ${y}V${y + h - r}A${r} ${r} 0 0 0 ${x + r} ${y + h}H${x + w - r}A${r} ${r} 0 0 0 ${x + w} ${
    y + h - r
  }V${y}Z`;
}

function niceMax(max: number): number {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((m) => m * pow >= max) ?? 10;
  return step * pow;
}

/**
 * Drops tick labels, newest kept, until the widest fits between two shown ones. Label width is
 * estimated at 0.6 em a character, as the chart is drawn before its text can be measured.
 */
export function thinTicks(ticks: readonly string[], slot: number): string[] {
  const shown = ticks.flatMap((t, i) => (t === '' ? [] : [i]));
  const [first, second] = shown;
  if (first === undefined || second === undefined) return [...ticks];
  const widest = Math.max(...shown.map((i) => ticks[i]?.length ?? 0)) * font * 0.6 + 6;
  const every = Math.ceil(widest / ((second - first) * slot));
  return ticks.map((t, i) => {
    const k = shown.indexOf(i);
    return k >= 0 && (shown.length - 1 - k) % every === 0 ? t : '';
  });
}

export interface ColumnsSpec {
  labels: string[];
  /** Short tick labels under the axis; empty strings are skipped. */
  ticks: string[];
  series: Series[];
  height: number;
  /** Columns before this index are drawn quieter (outside the window the takeaway talks about). */
  quietBefore?: number;
  /** Text for the tooltip of column i. */
  tip: (i: number) => string;
}

/** Columns, stacked when there is more than one series, bottom series first. */
export function columns(width: number, spec: ColumnsSpec): SVGElement {
  const { labels, series, height } = spec;
  const top = font + 6;
  const bottom = font + 8;
  const left = 30;
  const plotH = height - top - bottom;
  const n = labels.length;
  const slot = (width - left) / Math.max(n, 1);
  const w = Math.min(24, Math.max(4, slot - 6));
  const ticks = thinTicks(spec.ticks, slot);
  const totals = labels.map((_, i) => series.reduce((sum, ser) => sum + (ser.values[i] ?? 0), 0));
  const max = niceMax(Math.max(...totals, 0));
  const y = (v: number): number => top + plotH - (v / max) * plotH;
  const svg = s('svg', { class: 'chart', width, height, viewBox: `0 0 ${width} ${height}`, role: 'img' });
  svg.append(
    s('line', { class: 'grid', x1: left, x2: width, y1: y(max), y2: y(max) }),
    s('text', { class: 'tick', x: left - 6, y: y(max) + 4, 'text-anchor': 'end' }, String(max)),
    s('text', { class: 'tick', x: left - 6, y: y(0) + 4, 'text-anchor': 'end' }, '0'),
  );
  labels.forEach((_, i) => {
    const x = left + i * slot + (slot - w) / 2;
    const g = s('g', {
      class: `col${spec.quietBefore !== undefined && i < spec.quietBefore ? ' quiet' : ''}`,
    });
    g.append(s('rect', { class: 'hit', x: left + i * slot, y: top, width: slot, height: plotH }));
    let base = 0;
    const filled = series.map((ser) => ser.values[i] ?? 0);
    const lastFilled = filled.findLastIndex((v) => v > 0);
    series.forEach((ser, k) => {
      const v = ser.values[i] ?? 0;
      if (v <= 0) return;
      const y0 = y(base + v);
      const gap = k > 0 && base > 0 ? 2 : 0;
      const hgt = y(base) - y0 - gap;
      g.append(s('path', { class: ser.mark, d: bar(x, y0, w, hgt, k === lastFilled) }));
      base += v;
    });
    g.append(s('title', {}, spec.tip(i)));
    svg.append(g);
    const tick = ticks[i];
    if (tick) {
      svg.append(s('text', { class: 'tick', x: x + w / 2, y: height - 4, 'text-anchor': 'middle' }, tick));
    }
  });
  svg.append(s('line', { class: 'axis', x1: left, x2: width, y1: y(0), y2: y(0) }));
  return svg;
}

/** Up for one series, down for the other, around one baseline (opened above, closed below). */
export function mirrored(
  width: number,
  spec: {
    labels: string[];
    ticks: string[];
    up: Series;
    down: Series;
    height: number;
    tip: (i: number) => string;
  },
): SVGElement {
  const { labels, height } = spec;
  const left = 30;
  const top = 6;
  const bottom = font + 8;
  const plotH = height - top - bottom;
  const n = labels.length;
  const slot = (width - left) / Math.max(n, 1);
  const w = Math.min(24, Math.max(4, slot - 8));
  const ticks = thinTicks(spec.ticks, slot);
  const max = niceMax(Math.max(...spec.up.values, ...spec.down.values, 0));
  const mid = top + plotH / 2;
  const scale = (v: number): number => (v / max) * (plotH / 2 - 1);
  const svg = s('svg', { class: 'chart', width, height, viewBox: `0 0 ${width} ${height}`, role: 'img' });
  svg.append(
    s('text', { class: 'tick', x: left - 6, y: top + 8, 'text-anchor': 'end' }, `+${max}`),
    s('text', { class: 'tick', x: left - 6, y: top + plotH, 'text-anchor': 'end' }, `−${max}`),
  );
  labels.forEach((_, i) => {
    const x = left + i * slot + (slot - w) / 2;
    const g = s('g', { class: 'col' });
    g.append(s('rect', { class: 'hit', x: left + i * slot, y: top, width: slot, height: plotH }));
    const up = scale(spec.up.values[i] ?? 0);
    const down = scale(spec.down.values[i] ?? 0);
    if (up > 0) g.append(s('path', { class: spec.up.mark, d: bar(x, mid - 1 - up, w, up, true) }));
    if (down > 0) g.append(s('path', { class: spec.down.mark, d: barDown(x, mid + 1, w, down) }));
    g.append(s('title', {}, spec.tip(i)));
    svg.append(g);
    const tick = ticks[i];
    if (tick) {
      svg.append(s('text', { class: 'tick', x: x + w / 2, y: height - 4, 'text-anchor': 'middle' }, tick));
    }
  });
  svg.append(s('line', { class: 'axis', x1: left, x2: width, y1: mid, y2: mid }));
  return svg;
}

/** A word-sized trend: grey line, the last point in the accent with a surface ring. */
export function sparkline(
  values: readonly number[],
  width: number,
  height: number,
  label: string,
): SVGElement {
  const svg = s('svg', {
    class: 'spark',
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    'aria-label': label,
  });
  if (values.length === 0) return svg;
  const pad = 5;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const x = (i: number): number =>
    values.length === 1 ? width - pad : pad + (i / (values.length - 1)) * (width - 2 * pad);
  const y = (v: number): number =>
    hi === lo ? height / 2 : pad + (1 - (v - lo) / (hi - lo)) * (height - 2 * pad);
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  const last = values.length - 1;
  svg.append(
    s('path', { class: 'spark-line', d }),
    s('circle', { class: 'spark-end', cx: x(last), cy: y(values[last] ?? 0), r: 4 }),
  );
  return svg;
}

/** A horizontal meter: fill for the value, an optional tick for a reference (pace, cores). */
export function meter(
  width: number,
  spec: { value: number; max: number; mark: string; tick?: number; label: string },
): SVGElement {
  const height = 12;
  const svg = s('svg', {
    class: 'meter',
    width,
    height: height + 6,
    viewBox: `0 0 ${width} ${height + 6}`,
    role: 'img',
    'aria-label': spec.label,
  });
  const fx = (v: number): number => Math.max(0, Math.min(1, v / spec.max)) * width;
  svg.append(s('rect', { class: 'track', x: 0, y: 3, width, height, rx: 6 }));
  const fw = fx(spec.value);
  if (fw > 0) svg.append(s('rect', { class: spec.mark, x: 0, y: 3, width: Math.max(fw, 6), height, rx: 6 }));
  if (spec.tick !== undefined) {
    const tx = Math.min(Math.max(fx(spec.tick), 1.5), width - 1.5);
    svg.append(s('line', { class: 'meter-tick', x1: tx, x2: tx, y1: 0, y2: height + 6 }));
  }
  return svg;
}
