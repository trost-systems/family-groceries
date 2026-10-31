// Usage: node build-hex-assets.mjs (after build-hex-variants.mjs)
// For each Hummel Hex variant folder: writes the hexagon mask SVGs from its tokens.json
// (shape.hex.*), copies the fonts and the unchanged option-3 art (bee, mark, comb), and
// renders the shared pages in hex-src/ with the variant's labels and token values. Both
// variants get the same styles.css and the same markup; they differ only in tokens.css
// and in these generated shapes.
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { edgeSwatches, px, render, shapes } from './hex-render.mjs';

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const src = join(root, '_tools/hex-src');
const hexTokens = JSON.parse(readFileSync(join(root, '_tokens/hummel-hex.tokens.json'), 'utf8'));
const meta = hexTokens.$extensions['com.hummlist'];

const LABELS = {
  sharp: { label: 'Hex Scharf', idea: 'spitze Wabenecken' },
  soft: { label: 'Hex Weich', idea: 'abgerundete Wabenecken' },
};

const folders = meta.variants;
for (const [name, folder] of Object.entries(folders)) {
  const dir = join(root, folder);
  const tokens = JSON.parse(readFileSync(join(dir, 'tokens.json'), 'utf8'));
  const hex = tokens.shape.hex;
  const geo = { tip: hex.tip.$value, h: px(hex['reference-height']), r: px(hex['corner-radius']) };
  mkdirSync(join(dir, 'assets'), { recursive: true });
  for (const [file, content] of Object.entries(shapes(geo))) writeFileSync(join(dir, 'assets', file), content);
  for (const file of ['bee.svg', 'mark.svg', 'comb-light.svg', 'comb-dark.svg']) cpSync(join(root, meta.base, 'assets', file), join(dir, 'assets', file));
  cpSync(join(root, meta.base, 'fonts'), join(dir, 'fonts'), { recursive: true });

  const [otherName, otherFolder] = Object.entries(folders).find(([n]) => n !== name);
  const vars = {
    label: LABELS[name].label,
    idea: LABELS[name].idea,
    folder,
    'other-label': LABELS[otherName].label,
    'other-folder': otherFolder,
    radius: `${geo.r} px`,
    tip: String(geo.tip).replace('.', ','),
    'ref-height': `${geo.h} px`,
    'edge-swatches': edgeSwatches(tokens),
  };
  for (const file of ['index.html', 'tokens-sheet.html', 'styles.css']) writeFileSync(join(dir, file), render(join(src, file), tokens, vars));
  console.log(`${folder}: ${Object.keys(shapes(geo)).join(', ')}, pages (r = ${geo.r} px)`);
}
