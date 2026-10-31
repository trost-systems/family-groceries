// Usage: node normalize-colors.mjs <option-dir>
// Rewrites every colour written as a hex string in tokens.json ("#rrggbb" or "#rrggbbaa",
// as a token $value or a shadow colour) into the DTCG 2025.10 object form.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const toObject = (h) => {
  const n = h.slice(1).toLowerCase();
  const components = [0, 2, 4].map((i) => Math.round((parseInt(n.slice(i, i + 2), 16) / 255) * 10000) / 10000);
  const alpha = n.length === 8 ? Math.round((parseInt(n.slice(6, 8), 16) / 255) * 1000) / 1000 : undefined;
  return { colorSpace: 'srgb', components, ...(alpha !== undefined && alpha < 1 ? { alpha } : {}), hex: `#${n.slice(0, 6)}` };
};
const isHex = (v) => typeof v === 'string' && /^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(v);
function walk(node, type) {
  if (!node || typeof node !== 'object') return;
  const t = node.$type ?? type;
  if ('$value' in node) {
    if (t === 'color' && isHex(node.$value)) node.$value = toObject(node.$value);
    if (t === 'shadow') for (const s of [node.$value].flat()) if (isHex(s.color)) s.color = toObject(s.color);
    return;
  }
  for (const [k, v] of Object.entries(node)) if (!k.startsWith('$')) walk(v, t);
}
export const normalize = (tokens) => { walk(tokens); return tokens; };

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const file = join(resolve(process.argv[2]), 'tokens.json');
  writeFileSync(file, `${JSON.stringify(normalize(JSON.parse(readFileSync(file, 'utf8'))), null, 2)}\n`);
}
