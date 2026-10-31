// Usage: node swatches.mjs <option-dir>  -> rewrites the swatch block in tokens-sheet.html and styles.css from tokens.json
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const dir = process.argv[2];
const t = JSON.parse(readFileSync(join(dir, 'tokens.json'), 'utf8'));
const lum = (h) => [0, 2, 4].map((i) => parseInt(h.slice(1 + i, 3 + i), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
// role -> [foreground used on it or against it, label]
const PAIR = {
  brand: ['on-brand'], 'on-brand': ['brand'], 'brand-wash': ['text'], accent: ['on-accent'], 'on-accent': ['accent'],
  surface: ['text'], 'surface-raised': ['text'], 'surface-sunken': ['text'], text: ['surface'], 'text-muted': ['surface'],
  border: ['surface'], 'border-strong': ['surface'], success: ['on-success'], 'on-success': ['success'],
  warning: ['on-warning'], 'on-warning': ['warning'], error: ['on-error'], 'on-error': ['error'],
};
let html = ''; let css = '';
for (const mode of ['light', 'dark']) {
  const c = Object.fromEntries(Object.entries(t.color[mode]).filter(([k]) => !k.startsWith('$')).map(([k, v]) => [k, v.$value.hex]));
  html += `<div class="sw-group sw-group--${mode}">\n<h3 class="sw-group__title">${mode === 'light' ? 'Hell (Thermopapier)' : 'Dunkel (schwarzes Papier)'}</h3>\n<ul class="sw-list">\n`;
  for (const [k, hex] of Object.entries(c)) {
    const [other] = PAIR[k];
    const r = ratio(hex, c[other]);
    const cls = `sw-${mode}-${k}`;
    const fg = ratio(hex, '#000000') >= ratio(hex, '#ffffff') ? '#000000' : '#ffffff';
    css += `.${cls} { background: ${hex}; color: ${fg}; }\n`;
    const pairNote = k.startsWith('border') ? `${r.toFixed(2)}:1 auf ${other}` : `${r.toFixed(2)}:1 mit ${other}`;
    html += `<li class="sw"><span class="sw__chip ${cls}" aria-hidden="true">Aa</span><span class="sw__name">${k}</span><span class="sw__hex">${hex}</span><span class="sw__ratio">${pairNote}</span></li>\n`;
  }
  html += '</ul>\n</div>\n';
}
const swap = (file, a, b, body) => {
  const s = readFileSync(file, 'utf8'); const i = s.indexOf(a); const j = s.indexOf(b);
  if (i < 0 || j < 0) throw new Error(`markers missing in ${file}`);
  writeFileSync(file, s.slice(0, i + a.length) + '\n' + body + s.slice(j));
};
swap(join(dir, 'tokens-sheet.html'), '<!-- swatches:start -->', '<!-- swatches:end -->', html);
swap(join(dir, 'styles.css'), '/* swatches:start (generated from tokens.json; documentation only) */', '/* swatches:end */', css);
