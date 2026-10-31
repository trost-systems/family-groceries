// Usage: node build-art-styles.mjs [option-folder ...]
// Job 46: option 3b (Hex Weich) in other art styles. Each folder in art-styles/ is one style:
//   style.json  label, idea and the token sheet's prose
//   tokens.json partial DTCG tokens merged over option-3b-hex-soft/tokens.json
//   style.css   the art style, appended to 3b's styles.css (same markup, same selectors)
//   assets/     mark.svg and motif.svg (required; they replace 3b's bee), textures
//   fonts/      the woff2 files named by tokens.json font.family.*, with their licences
// The output folder (../<name>) gets 3b's pages and hex masks, the merged tokens.json and
// tokens.css, and a token sheet whose swatches, contrast pairs, fonts and type ramp come from
// the merged tokens. 3b's bee never ships: its art is pointed at the style's motif.svg.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { buildCss } from './build-css.mjs';
import { hexOf, ratio, render } from './hex-render.mjs';
import { normalize } from './normalize-colors.mjs';

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const tools = join(root, '_tools');
const BASE = 'option-3b-hex-soft';
const base = JSON.parse(readFileSync(join(root, BASE, 'tokens.json'), 'utf8'));
const PAIRS = [
  ['text', 'surface', 4.5], ['text', 'surface-raised', 4.5], ['text-muted', 'surface', 4.5], ['text-muted', 'surface-raised', 4.5],
  ['on-brand', 'brand', 4.5], ['on-accent', 'accent', 4.5], ['on-success', 'success', 4.5], ['on-warning', 'warning', 4.5],
  ['on-error', 'error', 4.5], ['brand', 'surface', 3],
];

const isGroup = (v) => v && typeof v === 'object' && !Array.isArray(v) && !('$value' in v);
function merge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = isGroup(v) && isGroup(a[k]) ? merge(a[k], v) : v;
  return out;
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const de = (n, d = 1) => n.toFixed(d).replace('.', ',');

function replaceOnce(html, from, to, what) {
  if (!html.includes(from)) throw new Error(`token sheet: ${what} not found in hex-src/tokens-sheet.html`);
  return html.replace(from, () => to);
}
function replaceBlock(html, re, to, what) {
  if (!re.test(html)) throw new Error(`token sheet: ${what} not found in hex-src/tokens-sheet.html`);
  return html.replace(re, typeof to === 'function' ? to : () => to);
}

function swatches(tokens, notes) {
  const L = tokens.color.light; const D = tokens.color.dark;
  const keys = Object.keys(L).filter((k) => !k.startsWith('$'));
  const items = keys.map((k) => {
    const on = keys.includes(`on-${k}`) ? ` fg-on-${k}` : '';
    const sample = on ? 'Aa' : '';
    const desc = notes[k] ? `<p class="swatch-desc">${notes[k]}</p>` : '';
    return `          <li class="swatch"><span class="swatch-chip bg-${k}${on}">${sample}</span><div><p class="swatch-name">${k}</p><p class="swatch-hex"><span>hell ${hexOf(L[k])}</span> <span>dunkel ${hexOf(D[k])}</span></p>${desc}</div></li>`;
  });
  const pairs = [...PAIRS, ...(tokens.$extensions['com.hummlist'].contrastPairs ?? [])].map(([fg, bg, min]) => {
    const r = (m) => de(ratio(hexOf(tokens.color[m][fg]), hexOf(tokens.color[m][bg])));
    return `            <tr><td><span class="pair-sample bg-${bg} fg-${fg}">Aa</span></td><td>${fg}</td><td>${bg}</td><td>${r('light')} : 1</td><td>${r('dark')} : 1</td><td>${de(min)} : 1</td></tr>`;
  });
  return `<!-- BEGIN swatches -->
        <ul class="swatches">
${items.join('\n')}
        </ul>
        <div class="table-wrap" tabindex="0" role="region" aria-label="Kontrastpaare">
        <table class="pairs">
          <caption>Kontrastpaare (vom Checker geprüft)</caption>
          <thead><tr><th scope="col">Probe</th><th scope="col">Vordergrund</th><th scope="col">Hintergrund</th><th scope="col">Hell</th><th scope="col">Dunkel</th><th scope="col">Mindestens</th></tr></thead>
          <tbody>
${pairs.join('\n')}
          </tbody>
        </table>
        </div>
<!-- END swatches -->`;
}

const families = (tokens) => Object.entries(tokens.font.family).filter(([k]) => !k.startsWith('$'));
const famName = (tok) => tok.$value[0];
const famOf = (tokens, ref) => famName(ref.split('.').reduce((o, k) => o[k], tokens));

function fontCards(tokens) {
  const cards = families(tokens).map(([k, t], i) => {
    const x = t.$extensions['com.hummlist'];
    return `          <div class="font-card">
            <p class="font-name${i === 0 ? ' font-name--display' : ''}">${esc(famName(t))}</p>
            <p>${esc(x.role)}. Variabel ${x.weight.replace(' ', '–')}. SIL Open Font License 1.1; ${esc(x.source)}.</p>
          </div>`;
  });
  return `<div class="fonts">\n${cards.join('\n')}\n        </div>`;
}

const RAMP = [
  ['display', 'Was brauchst du?'], ['headline-l', 'Eine Liste für alle'], ['headline', 'Sortiert nach Laufweg'],
  ['title', '2× Gurken, Vollkornbrot, Hafermilch'], ['body-l', 'Einer tippt „Milch“, alle sehen es sofort.'],
  ['body', 'Verschiebst du „Hafermilch“ einmal ins Kühlregal, bleibt sie dort. Größe, Füße, Äpfel: Umlaute und ß sind dabei.'],
  ['label', 'Einladung annehmen'], ['caption', 'Obst &amp; Gemüse'],
];
function ramp(tokens) {
  const rows = RAMP.map(([k, sample]) => {
    const v = tokens.type[k].$value;
    const size = v.fontSize.value * (v.fontSize.unit === 'rem' ? 16 : 1);
    const line = Math.round(size * v.lineHeight);
    const track = v.letterSpacing?.value ? ` · ${v.letterSpacing.value > 0 ? '+' : '−'}${de(Math.abs(v.letterSpacing.value * 100), 1).replace(',0', '')} %` : '';
    return `          <div><dt>${k} · ${esc(famOf(tokens, v.fontFamily.slice(1, -1)))} ${v.fontWeight} · ${de(size, 0)}/${line}${track}</dt><dd class="r-${k}">${sample}</dd></div>`;
  });
  return `<dl class="ramp">\n${rows.join('\n')}\n        </dl>`;
}

function radii(tokens) {
  const rows = Object.entries(tokens.radius).filter(([k]) => !k.startsWith('$')).map(([k, t]) => {
    const v = t.$value.value;
    return `              <li><span class="rbox r-${k}"></span>${k}${v >= 999 ? '' : ` · ${v}`}</li>`;
  });
  return `<ul class="radii">\n${rows.join('\n')}\n            </ul>`;
}

function fontFaces(tokens) {
  return families(tokens).map(([, t]) => {
    const x = t.$extensions['com.hummlist'];
    return `@font-face {\n  font-family: "${famName(t)}";\n  src: url("${x.files}") format("woff2");\n  font-weight: ${x.weight};\n  font-display: swap;\n}\n`;
  }).join('\n');
}

// .bg-<key>/.fg-<key> for colour keys 3b's styles.css does not have, so every swatch paints.
function colorUtilities(tokens, css) {
  return Object.keys(tokens.color.light).filter((k) => !k.startsWith('$') && !css.includes(`.bg-${k} {`))
    .map((k) => `.bg-${k} {\n  background: var(--hl-color-${k});\n}\n\n.fg-${k} {\n  color: var(--hl-color-${k});\n}\n`).join('\n');
}

function build(name) {
  const src = join(tools, 'art-styles', name);
  const style = JSON.parse(readFileSync(join(src, 'style.json'), 'utf8'));
  const override = JSON.parse(readFileSync(join(src, 'tokens.json'), 'utf8'));
  const { $extensions: ext = {}, ...rest } = override;
  const tokens = merge(base, normalize(rest));
  tokens.$description = `Hummlist design tokens, ${name}: ${BASE}/tokens.json plus _tools/art-styles/${name}/tokens.json. Generated by _tools/build-art-styles.mjs. Do not edit.`;
  tokens.$extensions = { 'com.hummlist': { ...base.$extensions['com.hummlist'], ...(ext['com.hummlist'] ?? {}), option: name, variant: 'soft', artStyle: style.label } };
  if (ext['com.hummlist']?.contrastPairs) tokens.$extensions['com.hummlist'].contrastPairs = [...base.$extensions['com.hummlist'].contrastPairs, ...ext['com.hummlist'].contrastPairs];
  for (const mode of ['light', 'dark']) {
    const missing = Object.keys(tokens.color.light).filter((k) => !k.startsWith('$') && !tokens.color[mode][k]);
    if (missing.length) throw new Error(`${name}: color.${mode} lacks ${missing.join(', ')}`);
  }

  const dir = join(root, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'assets'), { recursive: true });
  writeFileSync(join(dir, 'tokens.json'), `${JSON.stringify(tokens, null, 2)}\n`);
  for (const f of ['hex-cap-l.svg', 'hex-cap-r.svg', 'hex-pointy.svg', 'comb-light.svg', 'comb-dark.svg']) cpSync(join(root, BASE, 'assets', f), join(dir, 'assets', f));
  cpSync(join(src, 'assets'), join(dir, 'assets'), { recursive: true });
  for (const f of ['mark.svg', 'motif.svg']) if (!existsSync(join(src, 'assets', f))) throw new Error(`${name}: assets/${f} missing`);
  cpSync(join(src, 'fonts'), join(dir, 'fonts'), { recursive: true });
  for (const [k, t] of families(tokens)) {
    const x = t.$extensions?.['com.hummlist'];
    if (!x?.files || !x.weight || !x.role) throw new Error(`${name}: font.family.${k} needs $extensions["com.hummlist"].files, weight and role`);
    if (!existsSync(join(dir, x.files))) throw new Error(`${name}: ${x.files} missing`);
  }

  const vars = {
    label: style.label,
    idea: style.idea,
    folder: name,
    'other-label': 'Hex Weich (3b)',
    'other-folder': BASE,
    radius: `${tokens.shape.hex['corner-radius'].$value.value} px`,
    tip: String(tokens.shape.hex.tip.$value).replace('.', ','),
    'ref-height': `${tokens.shape.hex['reference-height'].$value.value} px`,
    'edge-swatches': '',
  };
  const hexSrc = join(tools, 'hex-src');
  const baseCss = render(join(hexSrc, 'styles.css'), tokens, vars)
    .replace(/^(@font-face \{[^}]*\}\n\n)+/, '')
    .replaceAll('url("assets/bee.svg")', 'url("assets/motif.svg")');
  if (baseCss.includes('bee.svg') || baseCss.startsWith('@font-face')) throw new Error('hex-src/styles.css: bee or font-face left over');
  const css = `${fontFaces(tokens)}\n${baseCss}\n${colorUtilities(tokens, baseCss)}\n/* Art style ${style.label} (_tools/art-styles/${name}/style.css) */\n\n${readFileSync(join(src, 'style.css'), 'utf8')}`;
  writeFileSync(join(dir, 'styles.css'), css);

  const index = render(join(hexSrc, 'index.html'), tokens, vars)
    .replace(`Entwurf Hummel ${style.label}: ${style.idea}.`, `Entwurf ${style.label}: Hex Weich (3b) ${style.idea}.`);
  writeFileSync(join(dir, 'index.html'), index);

  const s = style.sheet;
  let sheet = render(join(hexSrc, 'tokens-sheet.html'), tokens, vars);
  sheet = replaceOnce(sheet, `Hummlist Token-Sheet – Hummel ${style.label}`, `Hummlist Token-Sheet – ${style.label}`, 'title');
  sheet = replaceOnce(sheet, `Hummel ${style.label}: ein Token-Satz für alles, was summt`, `${style.label}: ein Token-Satz für alles, was summt`, 'h1');
  sheet = replaceBlock(sheet, /(<div class="sheet-intro">[\s\S]*?<p class="lead">)[^<]*/, (m, h) => `${h}${s.lead}`, 'intro lead');
  sheet = replaceBlock(sheet, /<p class="muted">Quelle:[\s\S]*?<\/p>/, `<p class="muted">Quelle: <code>tokens.json</code> (DTCG 2025.10), die Tokens von Hex Weich (3b) plus <code>_tools/art-styles/${name}/tokens.json</code>; daraus erzeugt <code>tokens.css</code>. Form, Maße und Bewegung sind die von 3b, nur der Kunststil wechselt.</p>`, 'source note');
  sheet = replaceBlock(sheet, /(<h2 class="headline" id="farben-t">Farben<\/h2>\s*)<p class="sheet-note">[\s\S]*?<\/p>/, (m, h) => `${h}<p class="sheet-note">${s.colorNote}</p>`, 'colour note');
  sheet = replaceBlock(sheet, /<!-- BEGIN swatches -->[\s\S]*?<!-- END swatches -->/, swatches(tokens, s.colorNotes ?? {}), 'swatches');
  sheet = replaceBlock(sheet, /<div class="fonts">[\s\S]*?<\/div>\s*<\/div>\s*<dl class="ramp">[\s\S]*?<\/dl>/, `${fontCards(tokens)}\n        ${ramp(tokens)}`, 'fonts and ramp');
  sheet = replaceBlock(sheet, /<ul class="radii">[\s\S]*?<\/ul>/, radii(tokens), 'radii');
  sheet = replaceBlock(sheet, /<ul class="shadows">[\s\S]*?<\/ul>\s*<p class="sheet-note">[^<]*<\/p>/, `<ul class="shadows">
              <li><span class="sbox sh-s"></span>${s.shadows[0]}</li>
              <li><span class="sbox sh-m"></span>${s.shadows[1]}</li>
              <li><span class="sbox sh-l"></span>${s.shadows[2]}</li>
            </ul>
            <p class="sheet-note">${s.shadowNote}</p>`, 'shadows');
  sheet = replaceBlock(sheet, /<figcaption>App: [\s\S]*?<\/figcaption>/, `<figcaption>${s.captions.app}</figcaption>`, 'app caption');
  sheet = replaceBlock(sheet, /<figcaption>E-Mail: [\s\S]*?<\/figcaption>/, `<figcaption>${s.captions.email}</figcaption>`, 'email caption');
  sheet = replaceBlock(sheet, /<figcaption>Store-Bild: [\s\S]*?<\/figcaption>/, `<figcaption>${s.captions.store}</figcaption>`, 'store caption');
  sheet = replaceBlock(sheet, /aria-label="App-Liste im Hummel-Stil:/, `aria-label="App-Liste im Stil ${esc(style.label)}:`, 'app label');
  const fams = families(tokens).map(([, t]) => famName(t));
  sheet = replaceBlock(sheet, /<small>Option 3, Hummel [^<]*<\/small>/, `<small>${esc(style.label)}: Hex Weich (3b) ${esc(style.idea)}. Schriften: ${fams.join(' und ')}, SIL OFL 1.1.</small>`, 'footer');
  writeFileSync(join(dir, 'tokens-sheet.html'), sheet);

  writeFileSync(join(dir, 'tokens.css'), '');
  return buildCss(dir).then((out) => { writeFileSync(join(dir, 'tokens.css'), out); console.log(`${name}: ${style.label}`); });
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(join(tools, 'art-styles')).filter((f) => f.startsWith('option-')).sort();
for (const n of names) await build(n);
