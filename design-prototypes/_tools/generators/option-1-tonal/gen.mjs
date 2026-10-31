// Usage: node gen.mjs <option-dir>
// Builds index.html and tokens-sheet.html from src/*.html: fills {{PHONE}}, {{PHONE_MINI}},
// {{ICON:name}} and {{SWATCHES}} (light and dark swatches with contrast, read from tokens.json).
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.argv[2]);
const tokens = JSON.parse(readFileSync(join(out, 'tokens.json'), 'utf8'));

const ICONS = {
  sync: '<path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5"/><path d="M20 4v4.5h-4.5"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15.5"/><path d="M4 20v-4.5h4.5"/>',
  route: '<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8.2 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.8"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/>',
  shield: '<path d="M12 3l7 3v5c0 4.5-3 8.4-7 10-4-1.6-7-5.5-7-10V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
  bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
  devices: '<rect x="2.5" y="5" width="13" height="9.5" rx="1.5"/><path d="M1 18h15"/><rect x="17.5" y="8" width="5" height="11" rx="1.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
  arrow: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
  store: '<path d="M4 9.5V20h16V9.5"/><path d="M3 4h18l-1.2 4.2a2.6 2.6 0 0 1-5 0 2.6 2.6 0 0 1-5.1 0 2.6 2.6 0 0 1-5.1 0z"/><path d="M10 20v-5h4v5"/>',
};
const icon = (name, cls = 'icon') => `<svg class="${cls}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;

const row = (emoji, name, { qty, sub, last, cls = '' } = {}) => `
          <div class="app-row${last ? ' app-row--last' : ''}${cls ? ' ' + cls : ''}"><span class="app-row__emoji">${emoji}</span><span class="app-row__text"><span class="app-row__name">${qty ? `<span class="app-row__qty">${qty}</span>` : ''}${name}</span>${sub ? `<span class="app-row__sub">${sub}</span>` : ''}</span></div>`;
const store = (key, badge, name, n, folded = false) => `
          <div class="app-store${folded ? ' app-store--folded' : ''}"><span class="app-badge app-badge--${key}">${badge}</span><span class="app-store__name">${name}</span><span class="app-store__rule app-store__rule--${key}"></span><span class="app-store__count"><b>${n}</b> Artikel</span><span class="app-caret"></span></div>`;
const cat = (name) => `
          <div class="app-cat"><span>${name}</span></div>`;

const phone = (variant, label) => `<div class="phone phone--${variant}" role="img" aria-label="${label}">
      <div class="phone__screen">
        <div class="app-status"><span>9:41</span><span class="app-status__icons"><i></i><i></i><i></i></span></div>
        <div class="app-header"><span class="app-header__title">Familieneinkauf</span><span class="app-header__count">15 Artikel</span></div>
        <div class="app-scroll">${store('edeka', 'E', 'Edeka', 8)}${cat('Obst &amp; Gemüse')}${row('🍌', 'Bananen', { qty: '6×', sub: 'Bio', cls: 'app-row--ticked' })}${row('🥒', 'Gurken', { qty: '2×' })}${row('🍎', 'Äpfel', { sub: 'Elstar · 1 kg', last: true })}${cat('Brot &amp; Backwaren')}${row('🍞', 'Vollkornbrot', { last: true })}${cat('Kühlregal')}${row('🥛', 'Hafermilch', { sub: 'Barista', cls: 'app-row--new' })}${row('🧈', 'Butter')}${row('🥣', 'Magerquark', { qty: '500 g', last: true })}${cat('Vorrat &amp; Konserven')}${row('🍝', 'Spaghetti', { last: true })}${store('dm', 'dm', 'dm', 4)}${cat('Drogerie')}${row('👶', 'Windeln', { sub: 'Pampers · Größe 3' })}${row('🪥', 'Zahnpasta', { sub: 'elmex · Kinder', last: true })}${cat('Haushalt')}${row('🧽', 'Spülmittel', { last: true })}${store('lidl', 'L', 'Lidl', 3, true)}
        </div>
        <div class="app-snackbar"><span>Bananen abgehakt</span><span class="app-snackbar__action">Rückgängig</span></div>
        <div class="app-band">
          <div class="app-input"><span class="app-input__disc">+</span><span class="app-input__hint">Was brauchst du?</span></div>
          <div class="app-tabs"><span class="app-tab app-tab--active"><span class="app-tab__pill">🛒</span>Liste</span><span class="app-tab"><span class="app-tab__pill app-tab__pill--glyph">☰</span>Mehr</span></div>
        </div>
      </div>
    </div>`;

// Swatches: every colour role, light and dark side by side, with the ratio against its pair.
const light = tokens.color.light; const dark = tokens.color.dark;
const hexOf = (t) => t.$value.hex;
function lum(hex) {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const pairFor = (k) => {
  if (light[`on-${k}`]) return { fg: `on-${k}`, bg: k, min: 4.5 };
  if (k === 'inverse-surface') return { fg: 'inverse-on-surface', bg: k, min: 4.5 };
  if (k === 'mark') return { fg: 'on-success', bg: k, min: 3 };
  if (k.startsWith('surface') || k === 'device-frame') return k === 'device-frame' ? null : { fg: 'text', bg: k, min: 4.5 };
  if (k.startsWith('on-') || k === 'inverse-on-surface') return null;
  if (k === 'inverse-brand') return { fg: k, bg: 'inverse-surface', min: 4.5 };
  if (k === 'border') return { fg: k, bg: 'surface', min: 1 };
  if (k === 'outline') return { fg: k, bg: 'surface', min: 3 };
  if (k === 'brand') return { fg: k, bg: 'surface', min: 3 };
  return { fg: k, bg: 'surface', min: 4.5 };
};
const chip = (mode, k, p) => {
  const bg = hexOf(mode[k]);
  const fg = p ? hexOf(mode[p.fg === k ? 'surface' : p.fg]) : null;
  const sample = p && p.fg !== k ? `<text x="20" y="27" font-family="Roboto Flex, sans-serif" font-size="15" font-weight="600" fill="${hexOf(mode[p.fg])}">Aa</text>` : '';
  return `<svg class="swatch__chip" viewBox="0 0 56 40" width="56" height="40" aria-hidden="true" focusable="false"><rect x="0.5" y="0.5" width="55" height="39" rx="11.5" fill="${bg}" stroke="#72796f" stroke-opacity="0.35"/>${sample}</svg>`;
};
const fmt = (r) => r.toFixed(2).replace('.', ',');
const swatchRows = Object.keys(light).filter((k) => !k.startsWith('$') && !(k.startsWith('on-') && light[k.slice(3)]) && k !== 'inverse-on-surface').map((k) => {
  const p = pairFor(k);
  const desc = (light[k].$description ?? '').replace(/"/g, '&quot;');
  const cell = (mode) => {
    const r = p ? ratio(hexOf(mode[p.fg]), hexOf(mode[p.bg])) : null;
    const ok = r === null || r >= p.min;
    return `<td><span class="swatch">${chip(mode, k, p)}<span class="swatch__meta"><code>${hexOf(mode[k])}</code>${p && p.fg !== k ? `<code>${hexOf(mode[p.fg])}</code>` : ''}${r ? `<span class="swatch__ratio${ok ? '' : ' swatch__ratio--low'}">${fmt(r)}:1</span>` : ''}</span></span></td>`;
  };
  const pairText = p ? (p.fg === k ? `${p.fg} auf ${p.bg}` : `${p.fg} auf ${k}`) : 'Rahmen, kein Text';
  return `
          <tr><th scope="row"><span class="swatch-role">${k}</span><span class="swatch-desc">${desc || '&nbsp;'}</span></th>${cell(light, 'hell')}${cell(dark, 'dunkel')}<td class="swatch-pair">${pairText}${p && p.min > 1 ? ` (min. ${fmt(p.min).replace(',00', '')}:1)` : ''}</td></tr>`;
}).join('');

const fill = (s) => s
  .replaceAll('{{PHONE}}', phone('hero', 'Die Hummlist-App auf einem Handy: die Liste „Familieneinkauf“ mit 15 Artikeln, gruppiert nach Edeka, dm und Lidl und darin nach Kategorien. Unten das Eingabefeld „Was brauchst du?“.'))
  .replaceAll('{{PHONE_MINI}}', phone('mini', 'Die Liste „Familieneinkauf“ in der App, verkleinert für einen Store-Screenshot.'))
  .replaceAll('{{SWATCHES}}', swatchRows)
  .replace(/\{\{ICON:(\w+)(?::([\w-]+))?\}\}/g, (_, n, c) => icon(n, c ? `icon ${c}` : 'icon'));

for (const f of ['index.html', 'tokens-sheet.html']) writeFileSync(join(out, f), fill(readFileSync(join(here, 'src', f), 'utf8')));
