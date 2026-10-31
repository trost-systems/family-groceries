import { readFileSync, writeFileSync } from 'node:fs';
const DIR = '/workspace/hummlist/research/design-prototypes/option-2-wochenmarkt';
const tokens = JSON.parse(readFileSync(`${DIR}/tokens.json`, 'utf8'));

const icon = (id, cls = 'ill') => `<svg class="${cls}" aria-hidden="true" focusable="false"><use href="assets/produce.svg#${id}"></use></svg>`;

const head = (title) => `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
<link rel="icon" href="assets/mark.svg" type="image/svg+xml">
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="styles.css">
</head>`;

const header = (current) => `<a class="skip" href="#inhalt">Zum Inhalt</a>
<header class="site-head">
  <a class="brand" href="index.html"${current === 'index' ? ' aria-current="page"' : ''}><span class="mark" aria-hidden="true"></span><span>Hummlist</span></a>
  <nav class="site-nav" aria-label="Hauptnavigation">
    <a href="index.html#liste">Gemeinsam</a>
    <a href="index.html#laufweg">Laufweg</a>
    <a href="index.html#sprache">Alexa &amp; Siri</a>
    <a href="index.html#privat">Privat</a>
    <a class="nav-cta" href="#">Im Browser öffnen</a>
  </nav>
</header>`;

const footer = `<footer class="site-foot">
  <div class="foot-inner">
    <p class="foot-brand"><span class="mark mark-s" aria-hidden="true"></span><span>Hummlist</span></p>
    <p class="foot-line">Eine Einkaufsliste für einen Haushalt. Die Datenbank steht in Frankfurt am Main.</p>
    <nav class="foot-nav" aria-label="Rechtliches und Hilfe">
      <a href="#">Hilfe</a>
      <a href="#">Impressum</a>
      <a href="#">Datenschutz</a>
      <a href="tokens-sheet.html">Token-Blatt</a>
    </nav>
  </div>
</footer>`;

const badges = (cls = '') => `<div class="badges ${cls}">
  <a class="badge" href="#"><span class="badge-small">Bald im</span><span class="badge-big">App Store</span></a>
  <a class="badge" href="#"><span class="badge-small">Bald bei</span><span class="badge-big">Google Play</span></a>
  <a class="badge badge-web" href="#"><span class="badge-small">Schon jetzt</span><span class="badge-big">Im Browser öffnen</span></a>
</div>`;

const row = (ic, name, sub = '', qty = '') => `<li class="app-row">${icon(ic, 'app-ic')}<span class="app-name">${qty ? `<b class="app-qty">${qty}</b> ` : ''}${name}${sub ? `<span class="app-sub">${sub}</span>` : ''}</span></li>`;
const cat = (name) => `<li class="app-cat"><span>${name}</span></li>`;
const store = (key, letter, name, n) => `<div class="app-store app-store-${key}"><span class="store-badge store-${key}">${letter}</span><span class="app-store-name">${name}</span><span class="app-store-rule"></span><span class="app-store-n"><b>${n}</b> Artikel</span></div>`;

const phone = (extra = '', snack = false) => `<div class="phone ${extra}" role="img" aria-label="Hummlist auf dem Handy: die Liste Familieneinkauf mit 15 Artikeln, nach dm, Edeka und Lidl gruppiert und nach Laufweg sortiert.">
  <div class="phone-screen">
    <div class="app-status"><span>9:41</span><span class="app-dots"></span></div>
    <div class="app-head"><span class="app-household">Familieneinkauf</span><span class="app-total">15 Artikel</span></div>
    <div class="app-list">
      ${store('dm', 'dm', 'dm', 4)}
      <ul class="app-items">
        ${cat('Drogerie')}
        ${row('windel', 'Windeln', 'Pampers · Größe 3')}
        ${row('feuchttuecher', 'Feuchttücher', 'Babylove · 4er Pack')}
        ${row('zahnpasta', 'Zahnpasta', 'elmex · Kinder')}
        ${cat('Haushalt')}
        ${row('spuelmittel', 'Spülmittel')}
      </ul>
      ${store('edeka', 'E', 'Edeka', 8)}
      <ul class="app-items">
        ${cat('Obst &amp; Gemüse')}
        ${row('bananen', 'Bananen', 'Bio', '6×')}
        ${row('gurke', 'Gurken', '', '2×')}
        ${row('tomate', 'Rispentomaten')}
        ${cat('Brot &amp; Backwaren')}
        ${row('brot', 'Vollkornbrot', 'geschnitten')}
        ${cat('Kühlregal')}
        ${row('hafermilch', 'Hafermilch', 'Barista', '2×')}
        ${row('milch', 'Frische Milch', '1,5 %')}
        ${row('kaese', 'Bergkäse')}
        ${row('eier', 'Eier', '10er, Freiland')}
      </ul>
      ${store('lidl', 'L', 'Lidl', 3)}
      <ul class="app-items">
        ${cat('Vorrat &amp; Konserven')}
        ${row('tomate', 'Passierte Tomaten', '', '3×')}
      </ul>
    </div>
    ${snack ? '<div class="app-snack"><span>Gurken abgehakt</span><span class="app-snack-action">Rückgängig</span></div>' : ''}
    <div class="app-composer">
      <div class="app-input"><span class="app-plus"></span><span class="app-placeholder">Was brauchst du?</span></div>
      <div class="app-tabs"><span class="app-tab app-tab-on"><span class="tab-pill"></span>Liste</span><span class="app-tab"><span class="tab-lines"></span>Mehr</span></div>
    </div>
  </div>
</div>`;

const stamp = (cls = '') => `<svg class="stamp ${cls}" viewBox="0 0 140 140" aria-hidden="true" focusable="false">
  <defs><path id="stamp-ring${cls}" d="M70 70m-50 0a50 50 0 1 1 100 0a50 50 0 1 1-100 0"/></defs>
  <circle cx="70" cy="70" r="64" fill="none" stroke-width="2.5"/>
  <circle cx="70" cy="70" r="38" fill="none" stroke-width="1.2"/>
  <text class="stamp-ring"><textPath href="#stamp-ring${cls}" textLength="308" lengthAdjust="spacing">DATENBANK · FRANKFURT AM MAIN · OHNE WERBUNG ·</textPath></text>
  <text class="stamp-mid" x="70" y="67" text-anchor="middle">FFM</text>
  <text class="stamp-sub" x="70" y="84" text-anchor="middle">am Main</text>
</svg>`;

const index = `${head('Hummlist: die gemeinsame Einkaufsliste für deinen Haushalt')}
<body>
${header('index')}
<main id="inhalt">
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero-copy">
      <p class="hero-note">Gerade im Test mit Familie und Freunden</p>
      <h1 id="hero-title">Ein Einkaufszettel für den ganzen Haushalt.</h1>
      <p class="lead">Was einer aufschreibt, steht sofort auf allen Handys. Sortiert nach deinem Weg durch den Laden.</p>
      ${badges()}
      <p class="fineprint">Für iPhone, Android und im Browser unter app.hummlist.com.</p>
    </div>
    <div class="hero-art">
      ${icon('brot', 'ill hero-brot')}
      ${icon('bananen', 'ill hero-bananen')}
      ${phone('phone-hero')}
      ${icon('gurke', 'ill hero-gurke')}
      ${icon('milch', 'ill hero-milch')}
      <p class="tag tag-hero" aria-hidden="true">Heute<br><b>15 Artikel</b></p>
    </div>
  </section>

  <section class="story" id="liste" aria-labelledby="t-liste">
    <div class="story-text">
      <h2 id="t-liste">Eine Liste. Alle Handys.</h2>
      <p>Lea schreibt „Hafermilch“ auf, und auf Peters Handy steht sie im selben Moment. Ohne Netz merkt sich Hummlist alles und holt auf, sobald ihr wieder online seid.</p>
      <p>Dein Partner kommt per Link oder Code dazu. Die Einladung gilt sieben Tage.</p>
    </div>
    <div class="story-art sync" aria-hidden="true">
      <div class="slip slip-a"><span class="slip-who">Lea</span><span class="slip-item">${icon('hafermilch', 'slip-ic')}Hafermilch</span><span class="slip-time">gerade eben</span></div>
      <svg class="sync-thread" viewBox="0 0 120 60" preserveAspectRatio="none" focusable="false"><path d="M4 8c30 4 40 44 112 44"/></svg>
      <div class="slip slip-b"><span class="slip-who">Peter</span><span class="slip-item">${icon('hafermilch', 'slip-ic')}Hafermilch</span><span class="slip-time">gerade eben</span></div>
    </div>
  </section>

  <section class="story story-flip" id="laufweg" aria-labelledby="t-laufweg">
    <div class="story-text">
      <h2 id="t-laufweg">Sortiert, wie du durch den Laden gehst.</h2>
      <p>Jeder Artikel landet von selbst in seiner Kategorie. dm, Lidl und Edeka sind schon eingerichtet, jeder mit seinem eigenen Laufweg. Hummlist merkt sich, wo du etwas meistens kaufst.</p>
      <p>Verschiebst du „Hafermilch“ einmal ins Kühlregal, bleibt sie dort. Eigene Läden und die Reihenfolge der Kategorien legst du selbst fest.</p>
    </div>
    <ol class="story-art route" aria-label="Beispiel-Laufweg bei Edeka">
      <li class="route-store"><span class="store-badge store-edeka">E</span><span>Edeka</span></li>
      <li class="stop"><span class="n">1</span><span class="tag">Obst &amp; Gemüse</span></li>
      <li class="stop"><span class="n">2</span><span class="tag">Brot &amp; Backwaren</span></li>
      <li class="stop"><span class="n">3</span><span class="tag">Kühlregal</span></li>
      <li class="stop"><span class="n">4</span><span class="tag">Fleisch, Wurst &amp; Fisch</span></li>
      <li class="stop"><span class="n">5</span><span class="tag">Vorrat &amp; Konserven</span></li>
      <li class="stop"><span class="n">6</span><span class="tag">Getränke</span></li>
      <li class="stop"><span class="n">7</span><span class="tag">Tiefkühl</span></li>
    </ol>
  </section>

  <section class="voice" id="sprache" aria-labelledby="t-sprache">
    <h2 id="t-sprache">Sag einfach, was fehlt.</h2>
    <div class="voice-grid">
      <figure class="quote">
        <blockquote><p>„Alexa, sag Hummlist, füg Milch und Eier hinzu.“</p></blockquote>
        <figcaption>Der Alexa-Skill „Hummlist“ trägt ein und liest vor: „Alexa, frag Hummlist, was auf der Liste steht.“</figcaption>
      </figure>
      <figure class="quote">
        <blockquote><p>„Hey Siri, Einkaufsliste.“ <span class="quote-then">„Milch, zwei Gurken und Klopapier.“</span></p></blockquote>
        <figcaption>Ein iPhone-Kurzbefehl macht drei Einträge aus einem Satz. In der App diktierst du direkt ins Eingabefeld.</figcaption>
      </figure>
    </div>
  </section>

  <section class="story" id="privat" aria-labelledby="t-privat">
    <div class="story-text">
      <h2 id="t-privat">Deine Liste bleibt bei dir.</h2>
      <p class="privacy-lead">Hummlist zeigt keine Werbung und verkauft keine Daten.</p>
      <ul class="ledger">
        <li>Die Datenbank steht in Frankfurt am Main.</li>
        <li>Nutzungsdaten nur, wenn du zustimmst. Abschalten geht jederzeit.</li>
        <li>Alle deine Daten als JSON exportieren.</li>
        <li>Dein Konto löschst du in der App.</li>
        <li>Diese Website setzt keine Cookies und lädt nichts von fremden Servern.</li>
      </ul>
    </div>
    <div class="story-art">${stamp('big')}</div>
  </section>

  <section class="handgriffe" aria-labelledby="t-hand">
    <h2 id="t-hand">Die kleinen Handgriffe</h2>
    <dl class="hand-list">
      <div><dt>App auf, lostippen</dt><dd>Das Eingabefeld unten ist sofort bereit. Vorschläge kommen aus dem, was ihr schon gekauft habt.</dd></div>
      <div><dt>Antippen heißt abgehakt</dt><dd>Mit Rückgängig, falls der Daumen zu schnell war. Zuletzt Gekauftes ist mit einem Tipp wieder drauf.</dd></div>
      <div><dt>Auch für KI-Assistenten</dt><dd>Wer mag, verbindet Claude oder ChatGPT über MCP mit der Liste.</dd></div>
    </dl>
  </section>

  <section class="board" aria-labelledby="t-board">
    <div class="board-inner">
      ${icon('hummel', 'ill board-bee')}
      <h2 id="t-board">Bald für alle. Gerade im kleinen Kreis.</h2>
      <p>Hummlist läuft als geschlossener Test für Familie und Freunde, auf dem iPhone, auf Android und im Browser.</p>
      ${badges('badges-board')}
    </div>
  </section>
</main>
${footer}
</body>
</html>
`;

// tokens sheet
const hexOf = (t) => t.$value.hex;
const lum = (h) => [0, 2, 4].map((i) => parseInt(h.slice(1 + i, 3 + i), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const BASE = [['text', 'surface', 4.5], ['text', 'surface-raised', 4.5], ['text-muted', 'surface', 4.5], ['text-muted', 'surface-raised', 4.5], ['on-brand', 'brand', 4.5], ['on-accent', 'accent', 4.5], ['on-success', 'success', 4.5], ['on-warning', 'warning', 4.5], ['on-error', 'error', 4.5]];
const pairs = [...BASE, ...tokens.$extensions['com.hummlist'].contrastPairs];
const desc = tokens.color.light;
const swatches = (mode) => {
  const c = tokens.color[mode];
  const keys = Object.keys(c).filter((k) => !k.startsWith('$'));
  return `<ul class="swatches">${keys.map((k) => `<li><svg class="chip" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><rect x="0.5" y="0.5" width="47" height="47" rx="6" fill="${hexOf(c[k])}" stroke="${hexOf(c.border)}"/></svg><span class="sw-name">${k}</span><code>${hexOf(c[k])}</code>${mode === 'light' && desc[k].$description ? `<span class="sw-desc">${desc[k].$description}</span>` : ''}</li>`).join('')}</ul>`;
};
const contrastTable = (mode) => {
  const c = tokens.color[mode];
  return `<table class="ctable"><caption>Kontrast ${mode === 'light' ? 'hell' : 'dunkel'}</caption><thead><tr><th scope="col">Probe</th><th scope="col">Vorder- auf Hintergrund</th><th scope="col">Verhältnis</th></tr></thead><tbody>${pairs.map(([fg, bg, min]) => { const r = ratio(hexOf(c[fg]), hexOf(c[bg])); return `<tr><td><svg class="cchip" viewBox="0 0 64 32" aria-hidden="true" focusable="false"><rect width="64" height="32" rx="5" fill="${hexOf(c[bg])}"/><text x="32" y="22" text-anchor="middle" font-family="Figtree Variable, sans-serif" font-size="15" font-weight="600" fill="${hexOf(c[fg])}">Aa</text></svg></td><td>${fg} auf ${bg}</td><td><b>${r.toFixed(2)}</b> : 1 <span class="cmin">(min. ${min})</span></td></tr>`; }).join('')}</tbody></table>`;
};
const px = (v) => `${v.value}${v.unit}`;
const typeRows = Object.entries(tokens.type).filter(([k]) => !k.startsWith('$')).map(([k, t]) => { const v = t.$value; const fam = v.fontFamily.includes('serif') ? 'Fraunces' : 'Figtree'; return `<li class="ramp-row"><span class="ramp-meta"><b>${k}</b> ${fam} ${px(v.fontSize)} / ${v.lineHeight} · ${v.fontWeight} · ${px(v.letterSpacing)}</span><span class="ramp-sample t-${k}">${k === 'overline' ? 'Obst &amp; Gemüse' : k === 'row' ? 'Hafermilch' : k === 'caption' ? 'Pampers · Größe 3' : k === 'label' ? 'Einladung annehmen' : k === 'body' || k === 'lead' ? 'Was einer aufschreibt, steht sofort auf allen Handys.' : 'Frische Brötchen, Äpfel &amp; Öl'}</span></li>`; }).join('');
const spaceRows = Object.entries(tokens.space).filter(([k]) => !k.startsWith('$')).map(([k, t]) => `<li><span class="sp-bar sp-${k}"></span><code>space-${k}</code> ${px(t.$value)}</li>`).join('');
const radiusRows = Object.entries(tokens.radius).filter(([k]) => !k.startsWith('$')).map(([k, t]) => `<li><span class="rd-box rd-${k}"></span><code>radius-${k}</code> ${px(t.$value)}<span class="sw-desc">${t.$description}</span></li>`).join('');
const shadowRows = Object.entries(tokens.shadow).filter(([k]) => !k.startsWith('$')).map(([k, t]) => `<li class="sh-card sh-${k}"><code>shadow-${k}</code><span>${t.$description}</span></li>`).join('');
const dur = Object.entries(tokens.motion.duration).filter(([k]) => !k.startsWith('$')).map(([k, t]) => `<li><code>duration-${k}</code> ${px(t.$value)} · ${t.$description}</li>`).join('');
const eas = Object.entries(tokens.motion.easing).filter(([k]) => !k.startsWith('$')).map(([k, t]) => `<li><code>easing-${k}</code> cubic-bezier(${t.$value.join(', ')}) · ${t.$description}</li>`).join('');

const sheet = `${head('Token-Blatt Wochenmarkt · Hummlist')}
<body class="sheet">
${header('sheet')}
<main id="inhalt" class="sheet-main">
  <div class="sheet-intro">
    <h1>Token-Blatt: Wochenmarkt</h1>
    <p class="lead">Warm und redaktionell, wie ein guter Marktstand und ein schön gemachtes Food-Magazin. Cremepapier, Waldgrün, Rote Bete und Senf; Fraunces mit Figtree.</p>
    <p>Ein Token-Satz für App, Website, E-Mail, Store-Bilder und Alexa. Die Quelle ist <code>tokens.json</code> (DTCG 2025.10), <code>tokens.css</code> wird daraus erzeugt. Diese Seite folgt deinem System: hell oder dunkel.</p>
  </div>

  <section class="sheet-sec" aria-labelledby="s-farben">
    <h2 id="s-farben">Farben</h2>
    <div class="two-col">
      <div><h3>Hell: Papier</h3>${swatches('light')}</div>
      <div><h3>Dunkel: Espresso</h3>${swatches('dark')}</div>
    </div>
    <p class="note">Store-Abzeichen liegen außerhalb des Token-Satzes: dm #ffffff/#d6001c, Edeka #1d4ea3/#ffd400, Lidl #0050aa/#fff000.</p>
    <div class="two-col">${contrastTable('light')}${contrastTable('dark')}</div>
  </section>

  <section class="sheet-sec" aria-labelledby="s-schrift">
    <h2 id="s-schrift">Schrift</h2>
    <p>Fraunces Variable (OFL-1.1, Undercase Type, über @fontsource-variable/fraunces) nur für Überschriften, Haushalts- und Ladennamen, mit weicher Achse SOFT 100. Figtree Variable (OFL-1.1, Erik Kennedy, über @fontsource-variable/figtree) für alles andere. In E-Mails fallen sie auf Georgia und Helvetica/Arial zurück, in Flutter werden beide gebündelt.</p>
    <ul class="ramp">${typeRows}</ul>
  </section>

  <section class="sheet-sec" aria-labelledby="s-raum">
    <h2 id="s-raum">Abstände, Radien, Schatten</h2>
    <div class="three-col">
      <div><h3>Abstände</h3><ul class="spaces">${spaceRows}</ul></div>
      <div><h3>Radien</h3><ul class="radii">${radiusRows}</ul></div>
      <div><h3>Schatten</h3><ul class="shadows">${shadowRows}</ul></div>
    </div>
  </section>

  <section class="sheet-sec" aria-labelledby="s-bewegung">
    <h2 id="s-bewegung">Bewegung</h2>
    <p>Ruhig und weich: nichts federt, nichts springt. Mit „Bewegung reduzieren“ fallen alle Übergänge weg.</p>
    <div class="two-col">
      <div><ul class="motion-list">${dur}</ul><ul class="motion-list">${eas}</ul></div>
      <div class="motion-demo"><a href="#" class="demo-card"><span class="demo-title">Zeig mit der Maus oder Tab hierher.</span><span class="demo-sub">Das Blatt hebt sich in 320 ms mit settle.</span></a></div>
    </div>
  </section>

  <section class="sheet-sec" aria-labelledby="s-flaechen">
    <h2 id="s-flaechen">Ein Satz, viele Flächen</h2>
    <div class="surfaces">
      <figure class="surf surf-app">
        ${phone('', true)}
        <figcaption>App: die Liste im Stil von Design H. Serif nur für Haushalt und Läden.</figcaption>
      </figure>

      <figure class="surf surf-mail">
        <div class="mail" role="img" aria-label="E-Mail-Vorschau: Lea hat dich zu Hummlist eingeladen.">
          <div class="mail-chrome"><span><b>Von</b> Hummlist</span><span><b>Betreff</b> Lea hat dich zu Hummlist eingeladen</span></div>
          <div class="mail-body">
            <div class="mail-top"><img src="assets/mark.svg" alt="Hummlist" width="40" height="40">${icon('bananen', 'ill mail-ill')}</div>
            <p class="mail-title">Lea hat dich zu Hummlist eingeladen.</p>
            <p class="mail-text">Ihr teilt euch dann eine Einkaufsliste: „Familieneinkauf“. Was einer einträgt, sieht der andere sofort.</p>
            <span class="mail-button">Einladung annehmen</span>
            <p class="mail-code">Oder gib in der App diesen Code ein: <b>K7M 4QP</b></p>
            <p class="mail-small">Die Einladung gilt sieben Tage.</p>
          </div>
        </div>
        <figcaption>E-Mail: Hex-Werte inline, Georgia und Arial als Ersatzschrift.</figcaption>
      </figure>

      <figure class="surf surf-store">
        <div class="storeshot" role="img" aria-label="Store-Bild: Sortiert nach deinem Laufweg, darunter die Liste.">
          <p class="storeshot-title">Sortiert nach deinem Laufweg.</p>
          ${phone('phone-store')}
          ${icon('gurke', 'ill storeshot-ill')}
        </div>
        <figcaption>Store-Bild: Papier, eine Zeile Fraunces, das Telefon angeschnitten.</figcaption>
      </figure>

      <figure class="surf surf-alexa">
        <div class="alexa" role="img" aria-label="Alexa-Karte: Milch und Eier sind auf der Hummlist.">
          <p class="alexa-top"><img src="assets/mark.svg" alt="Hummlist" width="28" height="28">Hummlist</p>
          <p class="alexa-said">„füg Milch und Eier hinzu“</p>
          <p class="alexa-title">Milch und Eier sind auf der Hummlist.</p>
          <p class="alexa-meta">15 Artikel · Familieneinkauf</p>
          ${icon('eier', 'ill alexa-ill')}
        </div>
        <figcaption>Alexa (APL): Tafel-Fläche, große Fraunces-Zeile.</figcaption>
      </figure>
    </div>
  </section>
</main>
${footer}
</body>
</html>
`;
writeFileSync(`${DIR}/index.html`, index);
writeFileSync(`${DIR}/tokens-sheet.html`, sheet);
