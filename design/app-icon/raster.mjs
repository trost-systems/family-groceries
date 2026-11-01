// A small polygon rasterizer and PNG encoder, so the icon PNGs need nothing but Node.
// Coverage: 16 sub-scanlines per pixel row, each crossing span added with its exact horizontal
// extent, so edges get 16 vertical and continuous horizontal anti-aliasing levels.
import { deflateSync, constants } from 'node:zlib';

const SUB = 16;

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

// Coverage (0..1 per pixel) of polygons `rings` mapped by x' = x*s + tx, y' = y*s + ty.
export function coverage(width, height, rings, [s, tx, ty], rule = 'nonzero') {
  const edges = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const y0 = a[1] * s + ty, y1 = b[1] * s + ty;
      if (y0 === y1) continue;
      const x0 = a[0] * s + tx, x1 = b[0] * s + tx;
      edges.push(y0 < y1 ? { top: y0, bottom: y1, x: x0, dx: (x1 - x0) / (y1 - y0), dir: 1 } : { top: y1, bottom: y0, x: x1, dx: (x0 - x1) / (y0 - y1), dir: -1 });
    }
  }
  edges.sort((p, q) => p.top - q.top);
  const out = new Float32Array(width * height);
  const crossings = [];
  for (let row = 0; row < height; row++) {
    const active = edges.filter((e) => e.top < row + 1 && e.bottom > row);
    if (!active.length) continue;
    const acc = out.subarray(row * width, (row + 1) * width);
    for (let k = 0; k < SUB; k++) {
      const y = row + (k + 0.5) / SUB;
      crossings.length = 0;
      for (const e of active) if (e.top <= y && e.bottom > y) crossings.push([e.x + (y - e.top) * e.dx, e.dir]);
      crossings.sort((p, q) => p[0] - q[0]);
      let wind = 0;
      for (let i = 0; i < crossings.length - 1; i++) {
        wind += crossings[i][1];
        const inside = rule === 'evenodd' ? wind % 2 !== 0 : wind !== 0;
        if (inside) span(acc, crossings[i][0], crossings[i + 1][0], width);
      }
    }
  }
  return out;
}

function span(acc, xa, xb, width) {
  const a = Math.max(0, xa), b = Math.min(width, xb);
  if (b <= a) return;
  const ia = Math.floor(a), ib = Math.floor(b);
  if (ia === ib) { acc[ia] += (b - a) / SUB; return; }
  acc[ia] += (ia + 1 - a) / SUB;
  for (let i = ia + 1; i < ib; i++) acc[i] += 1 / SUB;
  if (ib < width) acc[ib] += (b - ib) / SUB;
}

// Premultiplied RGBA in 0..1.
export class Canvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.px = new Float32Array(width * height * 4);
  }

  // Paints `color` (#rrggbb) through a coverage buffer, `opacity` on top.
  paint(cov, color, opacity = 1) {
    const [r, g, b] = rgb(color);
    for (let i = 0; i < cov.length; i++) {
      const a = Math.min(1, cov[i]) * opacity;
      if (a <= 0) continue;
      const o = i * 4, k = 1 - a;
      this.px[o] = r * a + this.px[o] * k;
      this.px[o + 1] = g * a + this.px[o + 1] * k;
      this.px[o + 2] = b * a + this.px[o + 2] * k;
      this.px[o + 3] = a + this.px[o + 3] * k;
    }
  }

  // Keeps only what lies inside the coverage buffer (an icon mask).
  clip(cov) {
    for (let i = 0; i < cov.length; i++) {
      const a = Math.min(1, cov[i]);
      for (let c = 0; c < 4; c++) this.px[i * 4 + c] *= a;
    }
  }

  // Straight 8-bit RGBA.
  bytes() {
    const out = Buffer.alloc(this.width * this.height * 4);
    for (let i = 0; i < this.width * this.height; i++) {
      const a = this.px[i * 4 + 3];
      const a8 = Math.round(Math.min(1, a) * 255);
      out[i * 4 + 3] = a8;
      if (a8 === 0) continue;
      for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.round(Math.min(1, this.px[i * 4 + c] / a) * 255);
    }
    return out;
  }
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, tail]);
}

// PNG from straight RGBA bytes: RGB when every pixel is opaque (App Store icons must not carry
// alpha), RGBA otherwise. Filter Up for every row, and deflate with the RLE strategy: it finds
// matches without the hash table that differs between zlib builds, so the bytes are the same
// on every machine.
export function png(width, height, rgba) {
  const opaque = rgba.every((v, i) => i % 4 !== 3 || v === 255);
  const channels = opaque ? 3 : 4;
  const stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const line = Buffer.alloc(stride);
    for (let x = 0; x < width; x++) for (let c = 0; c < channels; c++) line[x * channels + c] = rgba[(y * width + x) * 4 + c];
    const o = y * (stride + 1);
    raw[o] = 2;
    for (let i = 0; i < stride; i++) raw[o + 1 + i] = (line[i] - prev[i]) & 0xff;
    prev = line;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = opaque ? 2 : 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9, memLevel: 9, strategy: constants.Z_RLE })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
