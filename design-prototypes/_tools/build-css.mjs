// Usage: node build-css.mjs <option-dir> [--stdout]
// Reads <option-dir>/tokens.json (DTCG 2025.10) through Style Dictionary and writes
// <option-dir>/tokens.css: light colours and every other token on :root, dark colours
// under prefers-color-scheme. Colour tokens live under color.light.* and color.dark.*
// with the same keys; the mode segment is dropped from the variable name.
import StyleDictionary from 'style-dictionary';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PREFIX = 'hl';

const hex = (v) => (typeof v === 'string' ? v : (v.alpha ?? 1) < 1 ? rgbHex(v.components, v.alpha) : v.hex ?? rgbHex(v.components));
function rgbHex(components, alpha = 1) {
  const h = components.map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('');
  return alpha < 1 ? `#${h}${Math.round(alpha * 255).toString(16).padStart(2, '0')}` : `#${h}`;
}
const dim = (v) => (typeof v === 'object' ? `${v.value}${v.unit}` : String(v));
const fontList = (v) => (Array.isArray(v) ? v : [v]).map((f) => (/[\s\d]/.test(f) && !/^(ui-|system-ui|sans-serif|serif|monospace)/.test(f) ? `"${f}"` : f)).join(', ');
const shadow = (v) => (Array.isArray(v) ? v : [v])
  .map((s) => `${s.inset ? 'inset ' : ''}${dim(s.offsetX)} ${dim(s.offsetY)} ${dim(s.blur)} ${dim(s.spread)} ${hex(s.color)}`)
  .join(', ');

export function cssDeclarations(token) {
  const name = `--${PREFIX}-${token.path.filter((p) => p !== 'light' && p !== 'dark').join('-')}`;
  const v = token.$value;
  switch (token.$type) {
    case 'color': return [[name, hex(v)]];
    case 'dimension': return [[name, dim(v)]];
    case 'duration': return [[name, dim(v)]];
    case 'cubicBezier': return [[name, `cubic-bezier(${v.join(', ')})`]];
    case 'fontFamily': return [[name, fontList(v)]];
    case 'fontWeight': return [[name, String(v)]];
    case 'number': return [[name, String(v)]];
    case 'shadow': return [[name, shadow(v)]];
    case 'typography': return [
      [`${name}-family`, fontList(v.fontFamily)],
      [`${name}-size`, dim(v.fontSize)],
      [`${name}-weight`, String(v.fontWeight)],
      [`${name}-line`, String(v.lineHeight)],
      [`${name}-tracking`, dim(v.letterSpacing ?? { value: 0, unit: 'em' })],
    ];
    default: return [];
  }
}

const mode = (t) => (t.path[0] === 'color' ? t.path[1] : 'all');

StyleDictionary.registerFormat({
  name: 'hummlist/css-modes',
  format: ({ dictionary }) => {
    const block = (tokens) => tokens.flatMap(cssDeclarations).map(([k, v]) => `  ${k}: ${v};`).join('\n');
    const base = dictionary.allTokens.filter((t) => mode(t) !== 'dark');
    const dark = dictionary.allTokens.filter((t) => mode(t) === 'dark');
    return [
      '/* Generated from tokens.json by _tools/build-css.mjs (Style Dictionary). Do not edit. */',
      `:root {\n  color-scheme: light dark;\n${block(base)}\n}`,
      `@media (prefers-color-scheme: dark) {\n  :root {\n${block(dark).replace(/^/gm, '  ')}\n  }\n}`,
      '',
    ].join('\n\n');
  },
});

export async function buildCss(dir) {
  const tokens = JSON.parse(readFileSync(join(dir, 'tokens.json'), 'utf8'));
  const sd = new StyleDictionary({
    tokens,
    usesDtcg: true,
    log: { verbosity: 'silent', warnings: 'disabled' },
    platforms: { css: { files: [{ destination: 'tokens.css', format: 'hummlist/css-modes' }] } },
  });
  const [out] = await sd.formatPlatform('css');
  return out.output;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = resolve(process.argv[2]);
  const css = await buildCss(dir);
  if (process.argv.includes('--stdout')) process.stdout.write(css);
  else writeFileSync(join(dir, 'tokens.css'), css);
}
