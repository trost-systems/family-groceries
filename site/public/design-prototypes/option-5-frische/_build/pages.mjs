// Usage: node _build/pages.mjs   (from anywhere)
// Writes index.html, tokens-sheet.html and swatches.css from tokens.json and the list data below,
// so the phone mock and the token sheet never drift from the token set.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..');
const tokens = JSON.parse(readFileSync(join(dir, 'tokens.json'), 'utf8'));

const STORES = {
  edeka: { name: 'Edeka', label: 'E' },
  lidl: { name: 'Lidl', label: 'L' },
  dm: { name: 'dm', label: 'dm' },
};
const CATEGORIES = {
  obst: 'Obst & Gemüse', brot: 'Brot & Backwaren', kuehl: 'Kühlregal', fleisch: 'Fleisch, Wurst & Fisch',
  vorrat: 'Vorrat & Konserven', suess: 'Süßes & Snacks', getraenke: 'Getränke', tiefkuehl: 'Tiefkühl',
  haushalt: 'Haushalt', drogerie: 'Drogerie',
};
const LIST = [
  { store: 'edeka', count: 6, groups: [
    { cat: 'obst', items: [['🍌', 6, 'Bananen', 'Bio'], ['🥒', 2, 'Gurken'], ['🍎', 1, 'Äpfel', 'Elstar · 1 kg']] },
    { cat: 'brot', items: [['🍞', 1, 'Vollkornbrot']] },
    { cat: 'kuehl', items: [['🥛', 1, 'Hafermilch', 'Barista'], ['🧈', 1, 'Butter']] },
  ] },
  { store: 'lidl', count: 5, folded: true, groups: [] },
  { store: 'dm', count: 4, groups: [
    { cat: 'drogerie', items: [['🧷', 1, 'Windeln', 'Pampers · Größe 3'], ['🪥', 1, 'Zahnpasta', 'elmex · Kinder']] },
    { cat: 'haushalt', items: [['🧽', 1, 'Spülmittel'], ['🧻', 1, 'Küchenrolle']] },
  ] },
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const MARK = `<svg class="mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><rect class="mark-tile" width="64" height="64" rx="18"/><circle class="mark-sun" cx="49" cy="15" r="7"/><path class="mark-basket" d="M21.5 26.5 27 15.2a2.4 2.4 0 0 1 4.3 2.1L26.9 26.5h10.2l-4.4-9.2a2.4 2.4 0 0 1 4.3-2.1l5.5 11.3H48a3 3 0 0 1 2.9 3.8l-5.3 18.6A4 4 0 0 1 41.8 52H22.2a4 4 0 0 1-3.8-2.9l-5.3-18.6A3 3 0 0 1 16 26.5Z"/><rect class="mark-tile" x="21" y="33.5" width="22" height="4" rx="2"/><rect class="mark-tile" x="23" y="41.5" width="14" height="4" rx="2"/></svg>`;

const badge = (key, size = '') => `<span class="badge badge-${key}${size ? ` badge-${size}` : ''}">${STORES[key].label}</span>`;

function phone({ snackbar = false, variant = '' } = {}) {
  const total = LIST.reduce((n, s) => n + s.count, 0);
  const rows = LIST.map((s) => {
    const head = `<div class="ph-store${s.folded ? ' is-folded' : ''}">${badge(s.store)}<span class="ph-store-name">${STORES[s.store].name}</span><span class="ph-rule ph-rule-${s.store}"></span><span class="ph-count"><b>${s.count}</b> Artikel</span><span class="ph-caret"></span></div>`;
    const groups = s.groups.map((g) => `<div class="ph-cat"><span class="cat-dot cat-${g.cat}"></span>${CATEGORIES[g.cat]}<span class="ph-hair"></span></div>${g.items
      .map(([emoji, qty, name, sub]) => `<div class="ph-item"><span class="ph-emoji">${emoji}</span><span class="ph-text"><span class="ph-name">${qty > 1 ? `<span class="ph-qty">${qty}×</span>` : ''}${esc(name)}</span>${sub ? `<span class="ph-sub">${esc(sub)}</span>` : ''}</span></div>`)
      .join('')}`).join('');
    return head + groups;
  }).join('');
  const label = `Die Hummlist-App: Liste „Familieneinkauf“ mit ${total} Artikeln, gruppiert nach Edeka, Lidl und dm, darin nach Kategorien wie Obst & Gemüse und Kühlregal. Unten das Eingabefeld „Was brauchst du?“.`;
  return `<div class="phone${variant ? ` ${variant}` : ''}" role="img" aria-label="${esc(label)}">
  <div class="ph-screen">
    <div class="ph-status"><span>9:41</span><span class="ph-island"></span><span class="ph-batt"></span></div>
    <div class="ph-head"><span class="ph-title">Familieneinkauf</span><span class="ph-total">${total} Artikel</span></div>
    <div class="ph-list">${rows}</div>
    ${snackbar ? '<div class="ph-snack"><span>Butter abgehakt</span><span class="ph-snack-action">Rückgängig</span></div>' : ''}
    <div class="ph-band">
      <div class="ph-input"><span class="ph-disc">+</span><span class="ph-placeholder">Was brauchst du?</span></div>
      <div class="ph-tabs"><span class="ph-tab is-active"><span class="ph-tab-pill">🛒</span>Liste</span><span class="ph-tab"><span class="ph-tab-pill">☰</span>Mehr</span></div>
    </div>
  </div>
</div>`;
}

const head = (title, desc) => `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
<meta name="description" content="${esc(desc)}">
<link rel="icon" href="assets/mark.svg" type="image/svg+xml">
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="styles.css">
<link rel="stylesheet" href="swatches.css">
</head>`;

const siteHeader = (current) => `<header class="top">
  <div class="wrap top-in">
    <a class="brand" href="index.html"${current === 'index' ? ' aria-current="page"' : ''}>${MARK}<span class="brand-word">Hummlist</span></a>
    <nav class="top-nav" aria-label="Hauptmenü">
      <ul>
        <li class="hide-s"><a href="index.html#funktionen">Funktionen</a></li>
        <li class="hide-s"><a href="index.html#privat">Datenschutz</a></li>
        <li><a class="btn btn-small" href="#">Im Browser öffnen</a></li>
      </ul>
    </nav>
  </div>
</header>`;

const siteFooter = `<footer class="foot">
  <div class="wrap foot-in">
    <p class="foot-brand">${MARK}<span>Hummlist</span></p>
    <nav aria-label="Rechtliches und Hilfe">
      <ul class="foot-links">
        <li><a href="#">Hilfe</a></li>
        <li><a href="#">Impressum</a></li>
        <li><a href="#">Datenschutz</a></li>
        <li><a href="tokens-sheet.html">Token-Sheet</a></li>
      </ul>
    </nav>
    <p class="foot-note">Keine Cookies. Nichts von fremden Servern.</p>
  </div>
</footer>`;

const storeButtons = `<ul class="stores-cta">
  <li><a class="store-badge" href="#"><span class="store-badge-small">Bald im</span><span class="store-badge-big">App Store</span></a></li>
  <li><a class="store-badge" href="#"><span class="store-badge-small">Bald bei</span><span class="store-badge-big">Google Play</span></a></li>
</ul>`;

const index = `${head('Hummlist: die gemeinsame Einkaufsliste', 'Eine Einkaufsliste für den ganzen Haushalt, live geteilt und sortiert nach deinem Weg durch den Laden.')}
<body>
<a class="skip" href="#main">Zum Inhalt</a>
${siteHeader('index')}
<main id="main">
  <section class="hero" aria-labelledby="hero-title">
    <div class="wrap"><div class="hero-grid">
      <div class="hero-copy">
        <h1 id="hero-title" class="hero-title">Was fehlt, <span class="nowrap">steht drauf.</span></h1>
        <p class="hero-sub">Eine Liste für alle zu Hause. Live geteilt und sortiert nach deinem Weg durch den Laden.</p>
        <div class="hero-cta">
          ${storeButtons}
          <a class="btn btn-onfield" href="#">Im Browser öffnen</a>
        </div>
      </div>
      <div class="hero-visual">
        <p class="sticker"><span>Jetzt im Test mit Familie und Freunden</span></p>
        ${phone({ variant: 'phone-hero' })}
      </div>
    </div></div>
  </section>

  <section class="band" aria-labelledby="band-title">
    <div class="wrap"><div class="band-in">
      <h2 id="band-title" class="band-title">Tippe ein, was&nbsp;fehlt.</h2>
      <p class="band-text">App auf, das Eingabefeld ist schon bereit. Vorschläge kommen aus dem, was ihr schon mal gekauft habt. Ein Tipp hakt ab, und „Rückgängig“ holt es zurück.</p>
    </div></div>
  </section>

  <div class="wrap grid" id="funktionen">
    <section class="block block-mint block-wide block-split" aria-labelledby="f-zusammen">
      <div class="split-text">
      <span class="block-num" aria-hidden="true">1</span>
      <h2 id="f-zusammen" class="block-title block-title-xl">Eine Liste. Alle&nbsp;Handys.</h2>
      <p>Lea trägt Hafermilch ein, Peter sieht sie im selben Moment. Was einer abhakt, ist bei allen weg.</p>
      <p>Kein Netz im Laden? Hummlist arbeitet offline weiter und holt alles nach.</p>
      <p class="block-foot">Partner einladen: per Link oder Code, sieben Tage gültig.</p>
      </div>
      <div class="sync" aria-hidden="true">
        <div class="sync-card"><span class="sync-who">Lea</span><span class="sync-row">🥛 Hafermilch</span></div>
        <span class="sync-arrow">⇄</span>
        <div class="sync-card"><span class="sync-who">Peter</span><span class="sync-row">🥛 Hafermilch</span></div>
      </div>
    </section>

    <section class="block block-lavender block-narrow" aria-labelledby="f-laufweg">
      <span class="block-num" aria-hidden="true">2</span>
      <h2 id="f-laufweg" class="block-title">Sortiert, wie du&nbsp;gehst.</h2>
      <p>Jeder Artikel landet von selbst in seiner Kategorie. dm, Lidl und Edeka sind schon eingerichtet, jeder mit eigenem Laufweg.</p>
      <ol class="aisle" aria-label="Laufweg bei Edeka">
        <li class="aisle-store">${badge('edeka', 's')} Edeka</li>
        ${['obst', 'brot', 'kuehl', 'tiefkuehl', 'getraenke'].map((c, i) => `<li><span class="aisle-n">${i + 1}</span><span class="cat-dot cat-${c}"></span>${CATEGORIES[c]}</li>`).join('\n        ')}
      </ol>
      <p>Hummlist lernt mit: Schieb die Hafermilch einmal ins Kühlregal, dann bleibt sie da. Und es merkt sich, wo du was meistens kaufst.</p>
      <p class="block-foot">Eigene Läden anlegen und Kategorien umsortieren geht auch.</p>
    </section>

    <section class="block block-tomato" aria-labelledby="f-stimme">
      <div class="voice-head">
        <span class="block-num" aria-hidden="true">3</span>
        <h2 id="f-stimme" class="block-title">Sag’s einfach.</h2>
        <p>Mit dem Alexa-Skill „Hummlist“, einem Kurzbefehl für Siri oder per Diktat direkt in der App.</p>
      </div>
      <ul class="quotes">
        <li><span class="quote-who">Alexa</span><q>Alexa, sag Hummlist, füg Milch und Eier hinzu.</q></li>
        <li><span class="quote-who">Alexa</span><q>Alexa, frag Hummlist, was auf der Liste steht.</q></li>
        <li><span class="quote-who">Siri</span><q>Hey Siri, Einkaufsliste.</q><span class="quote-then">Dann: „Milch, zwei Gurken und Klopapier.“</span></li>
      </ul>
      <p class="block-foot">Auch Claude oder ChatGPT können über MCP auf eure Liste schreiben, wenn du das willst.</p>
    </section>

    <section class="block block-indigo block-wide" id="privat" aria-labelledby="f-privat">
      <div class="privacy-head">
        <span class="block-num" aria-hidden="true">4</span>
        <h2 id="f-privat" class="block-title block-title-xl">Eure Liste gehört&nbsp;euch.</h2>
      </div>
      <ul class="facts">
        <li><b>Keine Werbung.</b> Hummlist zeigt keine Werbung und verkauft keine Daten.</li>
        <li><b>Frankfurt am Main.</b> Dort steht die Datenbank.</li>
        <li><b>Nur mit deinem Ja.</b> Nutzungsdaten nur, wenn du zustimmst. Jederzeit abschaltbar.</li>
        <li><b>Alles mitnehmen.</b> Exportiere deine Daten als JSON.</li>
        <li><b>Alles löschen.</b> Dein Konto löschst du direkt in der App.</li>
        <li><b>Diese Seite auch.</b> Keine Cookies, nichts von fremden Servern.</li>
      </ul>
    </section>
  </div>

  <section class="get" aria-labelledby="get-title">
    <div class="wrap">
      <div class="get-in">
        <h2 id="get-title" class="get-title">Bald in deinem&nbsp;Store.</h2>
        <p class="get-text">Hummlist ist gerade im geschlossenen Test mit Familie und Freunden. Für iPhone, Android und im Browser.</p>
        <div class="get-cta">
          ${storeButtons}
          <a class="btn btn-brand" href="#">Im Browser öffnen</a>
        </div>
      </div>
    </div>
  </section>
</main>
${siteFooter}
</body>
</html>
`;

// Token sheet
const hexOf = (v) => v.hex;
function lum(hex) {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const L = tokens.color.light; const D = tokens.color.dark;
const colorKeys = Object.keys(L).filter((k) => !k.startsWith('$'));
const isCat = (k) => k.startsWith('cat-');
const PAIRS = [['text', 'surface'], ['text-muted', 'surface'], ['text', 'surface-raised'], ['text-muted', 'surface-raised'], ['text', 'surface-sunken'],
  ['brand', 'surface'], ['on-brand', 'brand'], ['on-brand-field', 'brand-field'], ['on-brand-container', 'brand-container'],
  ['on-accent', 'accent'], ['on-mint', 'mint'], ['on-lemon', 'lemon'], ['inverse-text', 'inverse-surface'], ['inverse-brand', 'inverse-surface'],
  ['on-success', 'success'], ['on-warning', 'warning'], ['on-error', 'error']];
const onFor = (k) => (L[`on-${k}`] ? `on-${k}` : null);
const fmt = (r) => r.toFixed(2);

const swatch = (k) => {
  const on = onFor(k);
  const ratios = on ? `<span class="sw-ratio">${on}: ${fmt(ratio(hexOf(L[on].$value), hexOf(L[k].$value)))} / ${fmt(ratio(hexOf(D[on].$value), hexOf(D[k].$value)))}</span>` : '';
  return `<li class="sw"><span class="sw-chip sw-${k}">${on ? `<span class="sw-on sw-on-${on}">Aa</span>` : ''}</span><span class="sw-name">${k}</span><span class="sw-hex"><span class="sw-mode">hell</span> ${hexOf(L[k].$value)} <span class="sw-mode">dunkel</span> ${hexOf(D[k].$value)}</span>${L[k].$description ? `<span class="sw-desc">${esc(L[k].$description)}</span>` : ''}${ratios}</li>`;
};
const pairRow = ([fg, bg]) => `<tr><td><span class="pair sw-${bg}"><span class="sw-on-${fg}">Aa</span></span></td><td><code>${fg}</code> auf <code>${bg}</code></td><td>${fmt(ratio(hexOf(L[fg].$value), hexOf(L[bg].$value)))}</td><td>${fmt(ratio(hexOf(D[fg].$value), hexOf(D[bg].$value)))}</td></tr>`;

const typeRows = Object.entries(tokens.type).filter(([k]) => !k.startsWith('$')).map(([k, t]) => {
  const v = t.$value; const fam = v.fontFamily.includes('display') ? 'Bricolage Grotesque' : 'Inter';
  const sample = k.startsWith('app-') ? { 'app-store': 'Edeka', 'app-item': '2× Gurken', 'app-meta': 'Pampers · Größe 3', 'app-category': 'Obst & Gemüse' }[k] : { mega: 'Steht drauf.', display: 'Was fehlt?', headline: 'Sortiert, wie du gehst.', title: 'Eine Liste. Alle Handys.', 'body-lg': 'Eine Liste für alle zu Hause.', body: 'Kein Netz im Laden? Hummlist holt alles nach.', label: 'Im Browser öffnen', caption: 'Gültig für sieben Tage.' }[k];
  return `<li class="ramp-row"><span class="ramp-spec"><b>${k}</b> ${fam} · ${v.fontSize.value * 16}px / ${v.lineHeight} · ${v.fontWeight} · ${v.letterSpacing.value}em</span><span class="ramp-sample t-${k}">${esc(sample)}</span></li>`;
}).join('\n');

const dimRows = (group, cls) => Object.entries(tokens[group]).filter(([k]) => !k.startsWith('$')).map(([k, t]) => `<li><span class="${cls} ${cls}-${k}"></span><code>${group}-${k}</code> ${t.$value.value}${t.$value.unit}${t.$description ? ` · ${esc(t.$description)}` : ''}</li>`).join('\n');
const motionRows = [
  ...Object.entries(tokens.motion.duration).filter(([k]) => !k.startsWith('$')).map(([k, t]) => `<li><code>duration-${k}</code> ${t.$value.value}ms · ${esc(t.$description ?? '')}</li>`),
  ...Object.entries(tokens.motion.easing).filter(([k]) => !k.startsWith('$')).map(([k, t]) => `<li><code>easing-${k}</code> cubic-bezier(${t.$value.join(', ')})${t.$description ? ` · ${esc(t.$description)}` : ''}</li>`),
].join('\n');

const sheet = `${head('Hummlist Frische: Token-Sheet', 'Farben, Schrift, Abstände, Radien, Schatten und Bewegung der Richtung Frische.')}
<body>
<a class="skip" href="#main">Zum Inhalt</a>
${siteHeader('sheet')}
<main id="main" class="sheet">
  <div class="wrap">
    <section class="sheet-hero" aria-labelledby="sheet-title">
      <p class="sheet-kicker">Option 5: Frische</p>
      <h1 id="sheet-title" class="sheet-title">Ein Token-Set. App, Seite, Mail, Store, Alexa.</h1>
      <p class="hero-sub">Plakativ wie eine frische Lebensmittelmarke: Blaubeer-Kobalt mit Minze, Tomate und Zitrone als große Farbflächen, Titel in Bricolage Grotesque auf strengem Raster. Die Swatches folgen dem Systemmodus: hell und dunkel stehen als Hex daneben, Kontraste als „hell / dunkel“.</p>
    </section>

    <section class="sheet-sec" aria-labelledby="s-farben">
      <h2 id="s-farben" class="sec-title">Farben</h2>
      <h3 class="sub-title">Rollen</h3>
      <ul class="swatches">${colorKeys.filter((k) => !isCat(k) && !k.startsWith('on-')).map(swatch).join('')}</ul>
      <h3 class="sub-title">Kategorien</h3>
      <p class="note">Nur als kleine Marke neben dem Kategorienamen, nie als Textfarbe.</p>
      <ul class="swatches swatches-cats">${colorKeys.filter(isCat).map(swatch).join('')}</ul>
      <h3 class="sub-title">Kontrastpaare</h3>
      <div class="table-scroll" role="region" aria-label="Kontrastpaare" tabindex="0">
        <table class="pairs"><thead><tr><th scope="col">Probe</th><th scope="col">Paar</th><th scope="col">hell</th><th scope="col">dunkel</th></tr></thead>
        <tbody>${PAIRS.map(pairRow).join('')}</tbody></table>
      </div>
    </section>

    <section class="sheet-sec" aria-labelledby="s-schrift">
      <h2 id="s-schrift" class="sec-title">Schrift</h2>
      <p class="note"><b>Bricolage Grotesque</b> (Titel, Ladennamen, Zahlen; Achsen wght, wdth, opsz) und <b>Inter</b> (Text und UI). Beide SIL OFL 1.1, selbst gehostet von Fontsource. In Mails: Helvetica Neue, Arial. In Flutter beide als Asset gebündelt.</p>
      <ul class="ramp">${typeRows}</ul>
    </section>

    <section class="sheet-sec sheet-cols" aria-labelledby="s-masse">
      <h2 id="s-masse" class="sec-title">Abstände, Radien, Schatten, Bewegung</h2>
      <div>
        <h3 class="sub-title">Abstände</h3>
        <ul class="dims">${dimRows('space', 'bar')}</ul>
      </div>
      <div>
        <h3 class="sub-title">Radien</h3>
        <ul class="dims dims-radius">${dimRows('radius', 'rad')}</ul>
      </div>
      <div>
        <h3 class="sub-title">Schatten</h3>
        <p class="note">Farbflächen tragen die Hierarchie, Schatten bleiben selten.</p>
        <div class="elev"><span class="elev-1">shadow-1 · Eingabe, Chips</span><span class="elev-2">shadow-2 · Telefon, Snackbar</span></div>
      </div>
      <div>
        <h3 class="sub-title">Bewegung</h3>
        <ul class="dims">${motionRows}</ul>
        <p class="note">Fahr mit der Maus über die Felder oder fokussiere sie. Bei „Bewegung reduzieren“ springt alles ohne Animation.</p>
        <div class="motion-demo"><a href="#" class="md md-fast">fast · out</a><a href="#" class="md md-base">base · out</a><a href="#" class="md md-slow">slow · out</a></div>
      </div>
    </section>

    <section class="sheet-sec" aria-labelledby="s-flaechen">
      <h2 id="s-flaechen" class="sec-title">Ein Set, fünf Flächen</h2>
      <div class="surfaces">
        <div class="surface-card">
          <h3 class="sub-title">App: Liste</h3>
          ${phone({ snackbar: true })}
        </div>
        <div class="surface-card">
          <h3 class="sub-title">Store-Screenshot</h3>
          <div class="store-shot" role="img" aria-label="Store-Screenshot: gelbe Fläche mit dem Titel „Sortiert nach deinem Laufweg.“ über der App.">
            <p class="store-shot-title">Sortiert nach deinem Laufweg.</p>
            <div class="store-shot-phone">${phone({ variant: 'phone-mini' }).replace(/ role="img" aria-label="[^"]*"/, ' aria-hidden="true"')}</div>
          </div>
        </div>
        <div class="surface-card">
          <h3 class="sub-title">Mail: Einladung</h3>
          <div class="mail">
            <div class="mail-meta"><span><b>Von</b> Hummlist</span><span><b>Betreff</b> Lea hat dich zu Hummlist eingeladen</span></div>
            <div class="mail-head">${MARK}<span>Hummlist</span></div>
            <div class="mail-body">
              <p class="mail-title">Lea hat dich zu Hummlist eingeladen.</p>
              <p>Ihr teilt dann eine Einkaufsliste. Was einer einträgt, sieht der andere sofort.</p>
              <a class="btn btn-brand" href="#">Einladung annehmen</a>
              <p class="mail-code">Oder gib den Code ein: <b>K7P-4QZ</b><br>Gültig für sieben Tage.</p>
            </div>
            <p class="mail-foot">Hummlist zeigt keine Werbung und verkauft keine Daten.</p>
          </div>
        </div>
        <div class="surface-card">
          <h3 class="sub-title">Alexa: Bildschirm</h3>
          <div class="alexa" role="img" aria-label="Alexa-Karte: Auf der Hummlist stehen 15 Sachen, darunter 6× Bananen, Hafermilch und Vollkornbrot.">
            <div class="alexa-top">${MARK}<span>Hummlist</span></div>
            <p class="alexa-big">15 Artikel auf der Liste.</p>
            <ul class="alexa-list"><li><span class="cat-dot cat-obst"></span>6× Bananen</li><li><span class="cat-dot cat-kuehl"></span>Hafermilch</li><li><span class="cat-dot cat-brot"></span>Vollkornbrot</li></ul>
            <p class="alexa-hint">„Alexa, sag Hummlist, füg Milch hinzu.“</p>
          </div>
        </div>
      </div>
    </section>
  </div>
</main>
${siteFooter}
</body>
</html>
`;

const swatchCss = [
  '/* Generated by _build/pages.mjs from tokens.json. Do not edit. */',
  ...colorKeys.map((k) => `.sw-${k} { background: var(--hl-color-${k}); }`),
  ...colorKeys.filter((k) => k.startsWith('on-') || ['text', 'text-muted', 'brand', 'inverse-text', 'inverse-brand'].includes(k)).map((k) => `.sw-on-${k} { color: var(--hl-color-${k}); }`),
  ...Object.keys(CATEGORIES).map((c) => `.cat-${c} { background: var(--hl-color-cat-${c}); }`),
  ...Object.keys(tokens.type).filter((k) => !k.startsWith('$')).map((k) => `.t-${k} { font-family: var(--hl-type-${k}-family); font-size: var(--hl-type-${k}-size); font-weight: var(--hl-type-${k}-weight); line-height: var(--hl-type-${k}-line); letter-spacing: var(--hl-type-${k}-tracking); }`),
  ...Object.keys(tokens.space).filter((k) => !k.startsWith('$')).map((k) => `.bar-${k} { width: var(--hl-space-${k}); }`),
  ...Object.keys(tokens.radius).filter((k) => !k.startsWith('$')).map((k) => `.rad-${k} { border-radius: var(--hl-radius-${k}); }`),
  '',
].join('\n');

writeFileSync(join(dir, 'index.html'), index);
writeFileSync(join(dir, 'tokens-sheet.html'), sheet);
writeFileSync(join(dir, 'swatches.css'), swatchCss);
