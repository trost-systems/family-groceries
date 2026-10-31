// The preview page design-prototypes/app-icon/index.html, built from the same data as the
// assets so names, files and alt texts can't drift. No scripts: the site CSP forbids them.
import { colorsFor, contrast, glassColors } from './render.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// [preview file, label, wallpaper class]; job 45's clear and tinted are the dark variants.
const APPLE = [
  ['light', 'Hell', 'light'],
  ['dark', 'Dunkel', 'dark'],
  ['clear-dark', 'Klar', 'clear'],
  ['tinted-dark', 'Getönt', 'tinted'],
];
const ANDROID = [
  ['circle', 'Kreis'],
  ['squircle', 'Squircle'],
  ['rounded', 'Abgerundetes Quadrat'],
  ['cookie', 'Keks (Beispiel einer Form zum Auswählen)'],
];

const figure = (src, alt, caption, cls) => `<li><figure class="mode ${cls}"><span class="wall"><img src="${src}" width="120" height="120" alt="${esc(alt)}"></span><figcaption>${caption}</figcaption></figure></li>`;

function top(v, i) {
  const dir = `top/${v.n}-${v.slug}`;
  const id = `top-${v.n}`;
  return `<section class="top" id="${id}" aria-labelledby="h-${id}">
  <h2 id="h-${id}">Favorit ${i + 1}: ${v.n} · ${esc(v.name)}</h2>
  <p class="why">${esc(v.why)}</p>
  <p>${esc(v.reason)}</p>

  <h3>iPhone, iPad und Mac: Liquid Glass</h3>
  <p class="note">Hell und dunkel zeigen die flachen Ebenen, auf die das System Glas, Licht und Schatten legt. Klar und getönt rechnet das System aus der Mono-Fassung; hier siehst du unsere Vorlage dafür.</p>
  <ul class="modes">
    ${APPLE.map(([m, label, wall]) => figure(`${dir}/previews/apple-${m}.svg`, `App-Icon ${v.name}, Darstellung ${label}: ${m === 'light' || m === 'dark' ? v.look : 'die Form in einer Farbe'}`, label, `apple apple-${wall}`)).join('\n    ')}
  </ul>

  <h3>Apple Vision Pro: drei Ebenen</h3>
  <p class="note">visionOS nimmt einen Hintergrund und zwei Ebenen davor, je 1024 × 1024 px, und schneidet sie rund zu. Der Stapel kippt langsam (bei reduzierter Bewegung steht er still), daneben liegen die Ebenen einzeln.</p>
  <div class="vision">
    <div class="stack" role="img" aria-label="${esc(`App-Icon ${v.name} als Stapel aus drei Ebenen, leicht gekippt: ${v.look}`)}">
      <div class="rig stack-${v.n}"><span class="l0"></span><span class="l1"></span><span class="l2"></span></div>
    </div>
    <ol class="exploded">
      <li><img src="${dir}/visionos/back.svg" width="96" height="96" alt="Hintergrund-Ebene: volle Fläche"><span>Hintergrund</span></li>
      <li><img src="${dir}/visionos/middle.svg" width="96" height="96" alt="${esc(`Mittlere Ebene: ${v.layers[0].name}`)}"><span>Mitte: ${esc(v.layers[0].name)}</span></li>
      <li><img src="${dir}/visionos/front.svg" width="96" height="96" alt="${esc(`Vordere Ebene: ${v.layers[1].name}`)}"><span>Vorn: ${esc(v.layers[1].name)}</span></li>
    </ol>
  </div>

  <h3>Android: die Maske bestimmt der Launcher</h3>
  <p class="note">Dieselben zwei Ebenen unter vier Masken. Ab Android 16 QPR2 wählen Nutzer die Form selbst, darum bleibt das Motiv im sicheren Kreis von 66 dp.</p>
  <ul class="modes">
    ${ANDROID.map(([m, label]) => figure(`${dir}/previews/android-${m}.svg`, `App-Icon ${v.name} unter der Maske ${label}`, label, `android android-${m}`)).join('\n    ')}
  </ul>

  <h3>Material You: thematisches Symbol</h3>
  <p class="note">Die Monochrom-Ebene, eingefärbt aus dem Hintergrundbild, hier mit einem grünen Beispiel-Farbschema.</p>
  <ul class="modes">
    ${figure(`${dir}/previews/themed-light.svg`, `App-Icon ${v.name} als thematisches Symbol, hell`, 'Thema hell', 'themed')}
    ${figure(`${dir}/previews/themed-dark.svg`, `App-Icon ${v.name} als thematisches Symbol, dunkel`, 'Thema dunkel', 'themed')}
  </ul>

  <h3>Dateien</h3>
  <ul class="files">
    <li><a href="${dir}/icon-composer/README.md">Icon Composer: Anleitung und Farben je Ebene</a>, Gruppen als SVG im Ordner <code>icon-composer/</code></li>
    <li>visionOS: <a href="${dir}/visionos/back.png">Hintergrund</a>, <a href="${dir}/visionos/middle.png">Mitte</a>, <a href="${dir}/visionos/front.png">Vorn</a> (PNG, 1024 px)</li>
    <li>Android, Vector Drawables: <a href="${dir}/android/res/drawable/ic_launcher_foreground.xml">Vordergrund</a>, <a href="${dir}/android/res/drawable/ic_launcher_background.xml">Hintergrund</a>, <a href="${dir}/android/res/drawable/ic_launcher_monochrome.xml">Monochrom</a>, <a href="${dir}/android/res/mipmap-anydpi-v26/ic_launcher.xml">adaptive-icon</a></li>
    <li>Android als PNG (432 px = 108 dp bei xxxhdpi): <a href="${dir}/android/png/foreground-432.png">Vordergrund</a>, <a href="${dir}/android/png/background-432.png">Hintergrund</a>, <a href="${dir}/android/png/monochrome-432.png">Monochrom</a>; <a href="${dir}/android/play-store-512.png">Play Store, 512 px</a></li>
  </ul>
</section>`;
}

// Job 48: Peter's favourites in option 5's original colours, each next to its job 45 original.
// The appearance switch is CSS only (radio inputs, :has()), since the site CSP allows no script.
const MODES = [
  ['light', 'Standard'],
  ['dark', 'Dunkel'],
  ['clear-light', 'Klar hell'],
  ['clear-dark', 'Klar dunkel'],
  ['tinted-light', 'Getönt hell'],
  ['tinted-dark', 'Getönt dunkel'],
];
const ROLE = { bg: 'Hintergrund', outer: 'Ring', inner: 'innere Wabe', mark: 'Haken', back: 'Kachel hinten', front: 'Kachel vorn', hex: 'Wabe' };
const ratio = (r) => `${r.toFixed(2).replace('.', ',')}:1`;
const verdict = (r) => (r >= 3 ? 'ja' : '<strong>nein</strong>');
const dirOf = (v) => `top/${v.n}-${v.slug}`;
const lookAt = (v, mode) => (mode === 'light' || mode === 'dark' ? v.look : 'die Form in einer Farbe');

// Rows for the contrast table: the touching colour pairs in light and dark, then glyph on tile
// for the derived glass modes (the same for both, since they come from the one-colour shape).
export function contrastRows(v, orig) {
  const rows = [];
  for (const [mode, label] of [['light', 'Standard'], ['dark', 'Dunkel']]) {
    const c = colorsFor(v, mode), o = colorsFor(orig, mode);
    for (const [a, b] of v.pairs) rows.push({ mode: label, pair: `${ROLE[a]} / ${ROLE[b]}`, now: contrast(c[a], c[b]), was: contrast(o[a], o[b]) });
  }
  for (const [mode, label] of MODES.slice(2)) {
    const g = glassColors(mode);
    const r = contrast(g.glyph, g.tile);
    rows.push({ mode: label, pair: 'Form / Fläche (angenähert)', now: r, was: r });
  }
  return rows;
}

function side(v, kind, caption) {
  const dir = dirOf(v);
  return `<div class="side side-${kind}">
        <h4>${caption}</h4>
        <div class="shots">
          ${MODES.map(([m, label]) => `<figure class="shot shot-${m} wall-${m}"><img src="${dir}/previews/apple-${m}.svg" width="160" height="160" alt="${esc(`App-Icon ${v.name}, ${caption}, Darstellung ${label}: ${lookAt(v, m)}`)}"><figcaption>${label}</figcaption></figure>`).join('\n          ')}
        </div>
        <div class="stack" role="img" aria-label="${esc(`visionOS: ${v.name}, ${caption}, als Stapel aus drei Ebenen, leicht gekippt: ${v.look}`)}">
          <div class="rig stack-${v.n}"><span class="l0"></span><span class="l1"></span><span class="l2"></span></div>
        </div>
        <ul class="minis" aria-label="${esc(`Android: ${v.name}, ${caption}`)}">
          ${ANDROID.map(([m, label]) => `<li><img src="${dir}/previews/android-${m}.svg" width="64" height="64" alt="${esc(`Maske ${label}`)}"></li>`).join('\n          ')}
          <li class="themed"><img src="${dir}/previews/themed-light.svg" width="64" height="64" alt="Material You, thematisch hell"></li>
          <li class="themed themed-dark"><img src="${dir}/previews/themed-dark.svg" width="64" height="64" alt="Material You, thematisch dunkel"></li>
        </ul>
      </div>`;
}

const SMALL = [['apple-29', 29, '29 pt (1x)'], ['apple-87', 87, '29 pt (3x)'], ['android-48', 48, '48 dp (mdpi)'], ['apple-16', 16, '16 px']];
const smallRow = (v, caption) => `<tr><th scope="row">${caption}</th>${['light', 'dark'].flatMap((mode) => SMALL.map(([f, px, label]) => `<td><img class="px" src="${dirOf(v)}/previews/small/${f}-${mode}.png" width="${px}" height="${px}" alt="${esc(`${v.name}, ${caption}, ${mode === 'light' ? 'hell' : 'dunkel'}, ${label}`)}"></td>`)).join('')}</tr>`;

function pair(v, orig) {
  const id = `o-${v.n}`;
  const dir = dirOf(v);
  return `<article class="pair" id="${id}" aria-labelledby="h-${id}">
    <h3 id="h-${id}">${v.basedOn} · ${esc(v.name)} in den Originalfarben von 5</h3>
    <p>${esc(v.reason)}</p>
    <fieldset class="appear">
      <legend>Darstellung auf iPhone, iPad und Mac</legend>
      ${MODES.map(([m, label], i) => `<input type="radio" id="${id}-${m}" name="${id}" value="${m}"${i === 0 ? ' checked' : ''}><label for="${id}-${m}">${label}</label>`).join('\n      ')}
    </fieldset>
    <div class="compare">
      ${side(v, 'new', 'Neu: Originalfarben von 5')}
      ${side(orig, 'old', `Job 45: das Original ${orig.n}`)}
    </div>
    <h4>Kleine Größen, echte Pixel</h4>
    <div class="table-wrap" role="region" aria-label="${esc(`${v.name}: kleine Größen`)}" tabindex="0">
    <table class="small">
      <thead><tr><td></td><th scope="col" colspan="4">hell: 29 pt (1x, 3x), 48 dp, 16 px</th><th scope="col" colspan="4">dunkel: 29 pt (1x, 3x), 48 dp, 16 px</th></tr></thead>
      <tbody>${smallRow(v, 'Neu')}${smallRow(orig, 'Original')}</tbody>
    </table>
    </div>
    <p class="note">${esc(v.small)}</p>
    <h4>Kontrast der Ebenen</h4>
    <div class="table-wrap" role="region" aria-label="${esc(`${v.name}: Kontrast der Ebenen`)}" tabindex="0">
    <table>
      <thead><tr><th scope="col">Darstellung</th><th scope="col">Ebenen, die sich berühren</th><th scope="col">Neu</th><th scope="col">≥ 3:1</th><th scope="col">Original (Job 45)</th></tr></thead>
      <tbody>
        ${contrastRows(v, orig).map((r) => `<tr><td>${r.mode}</td><td>${r.pair}</td><td>${ratio(r.now)}</td><td>${verdict(r.now)}</td><td>${ratio(r.was)}</td></tr>`).join('\n        ')}
      </tbody>
    </table>
    </div>
    <p class="files-line">Dateien: <a href="${dir}/icon-composer/README.md">Icon Composer (Anleitung, Farben je Ebene)</a>, visionOS <a href="${dir}/visionos/back.png">Hintergrund</a> <a href="${dir}/visionos/middle.png">Mitte</a> <a href="${dir}/visionos/front.png">Vorn</a>, Android <a href="${dir}/android/res/drawable/ic_launcher_foreground.xml">Vordergrund</a> <a href="${dir}/android/res/drawable/ic_launcher_background.xml">Hintergrund</a> <a href="${dir}/android/res/drawable/ic_launcher_monochrome.xml">Monochrom</a> <a href="${dir}/android/res/mipmap-anydpi-v26/ic_launcher.xml">adaptive-icon</a>, <a href="${dir}/android/play-store-512.png">Play Store 512 px</a>.</p>
  </article>`;
}

function originals(list, tops) {
  return `<section id="original5" class="original5" aria-labelledby="h-original5">
      <h2 id="h-original5" lang="en">Peter's favorites in original 5 colors</h2>
      <p class="sub">Peters Favoriten in den Originalfarben von 5</p>
      <p>Die drei Favoriten in derselben Form, Ebene für Ebene, nur in den Farben, mit denen Frische (5) gestartet ist: Kobalt <code>#1b3fae</code> als Fläche, Zitrone <code>#ffe24a</code> und Weiß darauf, wie die Frische-Marke. Nachts tiefes Navy <code>#0b1024</code> mit Zitrone <code>#e8cb3c</code>. Die Nähe zu Lidl ist ausdrücklich in Ordnung. Tomate bleibt draußen: neben Kobalt und Zitrone kommt sie nicht auf 3:1.</p>
      <p class="note">Wähle oben in jeder Zeile die Darstellung, beide Icons wechseln mit. Klar und getönt rechnet das System aus der einfarbigen Form, darum sehen Neu und Original dort gleich aus. Daneben der visionOS-Stapel, die vier Android-Masken und das thematische Symbol.</p>
      ${list.map((v) => pair(v, tops.find((t) => t.n === v.basedOn))).join('\n      ')}
    </section>`;
}

export function page({ variations, tops, originals: o5, families, spriteSize: [sw, sh] }) {
  const count = variations.length;
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Hummlist App-Icon: ${count} Varianten, drei Favoriten</title>
  <link rel="stylesheet" href="app-icon.css">
</head>
<body>
  <header>
    <p class="back"><a href="../index.html">Alle Design-Entwürfe</a></p>
    <h1>Hummlist App-Icon: ${count} Varianten, drei Favoriten</h1>
    <p class="lede">Hier siehst du ${count} Ideen für das App-Icon, halb aus Hex Weich (3b), halb aus Frische (5), zwei verbinden beide. Die drei Favoriten gibt es als echte Ebenen: für Icon Composer (Liquid Glass auf iPhone, iPad und Mac), für die Apple Vision Pro und als adaptives Android-Icon mit Monochrom-Ebene.</p>
    <nav aria-label="Auf dieser Seite">
      <ul>
        <li><a href="#original5" lang="en">Peter's favorites in original 5 colors</a></li>
        <li><a href="#alle">Alle ${count} Varianten</a></li>
        ${tops.map((v, i) => `<li><a href="#top-${v.n}">Favorit ${i + 1}: ${esc(v.name)}</a></li>`).join('\n        ')}
        <li><a href="#plattformen">Was Apple und Google verlangen</a></li>
      </ul>
    </nav>
  </header>
  <main>
    ${originals(o5, tops)}
    <section id="alle" aria-labelledby="h-alle">
      <h2 id="h-alle">Alle ${count} Varianten</h2>
      <p>Jede Kachel zeigt das Icon groß in hell, klein in dunkel und in echten 29 und 16 Pixeln. Bei 16 px entscheidet sich, ob man es auf dem Home-Bildschirm und in den Einstellungen noch erkennt.</p>
      <figure class="sheet">
        <img src="sprite-sheet.png" width="${sw}" height="${sh}" alt="${esc(`Spritesheet mit ${count} App-Icon-Varianten in einem Raster: ${variations.map((v) => `${v.n} ${v.name}`).join(', ')}`)}">
        <figcaption>Das Spritesheet als <a href="sprite-sheet.png">PNG</a> und als <a href="sprite-sheet.svg">SVG</a>.</figcaption>
      </figure>
      <ol class="variants">
        ${variations.map((v) => `<li value="${v.n}"><strong>${esc(v.name)}</strong> <span class="fam">${esc(families[v.family])}</span> ${esc(v.why)}</li>`).join('\n        ')}
      </ol>
    </section>
    ${tops.map(top).join('\n    ')}
    <section id="plattformen" aria-labelledby="h-plattformen">
      <h2 id="h-plattformen">Was Apple und Google verlangen (Stand Oktober 2026)</h2>
      <p>Kurzfassung der Recherche aus offiziellen Quellen. Die ganze Fassung mit allen Belegen steht in <code>research/app-icon.md</code>.</p>
      <div class="table-wrap" role="region" aria-labelledby="h-plattformen" tabindex="0">
      <table>
        <thead><tr><th scope="col">Plattform</th><th scope="col">Ebenen</th><th scope="col">Fläche</th><th scope="col">Sicher</th><th scope="col">Format</th><th scope="col">Darstellungen</th></tr></thead>
        <tbody>
          <tr><th scope="row">iPhone, iPad, Mac</th><td>Hintergrund-Füllung plus Ebenen in höchstens 4 Gruppen</td><td>1024 × 1024 px, eine Quelle</td><td>Motiv mittig, Raster der Vorlage</td><td>.icon aus Icon Composer, Ebenen als SVG (PNG für Pixel-Grafik)</td><td>Standard, Dunkel, Klar und Getönt (je hell und dunkel)</td></tr>
          <tr><th scope="row">Apple Watch</th><td>Dieselbe .icon-Datei</td><td>1088 × 1088 px, rund</td><td>Wie oben, Kreis</td><td>.icon</td><td>keine</td></tr>
          <tr><th scope="row">Apple Vision Pro</th><td>Hintergrund plus 1 oder 2 Ebenen (höchstens 3)</td><td>1024 × 1024 px je Ebene, rund</td><td>Motiv mittig</td><td>Bildstapel im Asset-Katalog</td><td>keine</td></tr>
          <tr><th scope="row">Android</th><td>Vordergrund, Hintergrund, Monochrom (optional)</td><td>108 × 108 dp, 72 dp sichtbar</td><td>Kreis von 66 dp</td><td>Vector Drawable (bevorzugt) oder PNG</td><td>Vollfarbe, thematisch ab Android 13</td></tr>
          <tr><th scope="row">Google Play</th><td>ein Bild</td><td>512 × 512 px</td><td>Play rundet mit 30 % ab</td><td>PNG, 32 Bit, sRGB</td><td>keine</td></tr>
        </tbody>
      </table>
      </div>
      <h3>Was daraus folgt</h3>
      <ul>
        <li>Flache, deckende Ebenen ohne Schatten, Glanz oder Maske: Glas, Licht und Tiefe legt das System selbst darauf (<a href="https://developer.apple.com/design/human-interface-guidelines/app-icons">Apple HIG, App icons</a>, <a href="https://developer.apple.com/documentation/xcode/creating-your-app-icon-using-icon-composer">Icon Composer</a>).</li>
        <li>Eine Mono-Fassung, in der das wichtigste Element weiß ist: daraus entstehen Klar und Getönt (<a href="https://developer.apple.com/videos/play/wwdc2025/361/">WWDC25: Create icons with Icon Composer</a>).</li>
        <li>visionOS: Hintergrund und zwei Ebenen davor, je 1024 px, rund beschnitten, Motiv mittig (<a href="https://developer.apple.com/documentation/xcode/configuring-your-app-icon">Configuring your app icon</a>, <a href="https://developer.apple.com/videos/play/wwdc2023/10076/">WWDC23</a>).</li>
        <li>Android: Motiv im Kreis von 66 dp, die äußeren 18 dp gehören Maske und Bewegung (<a href="https://developer.android.com/develop/ui/views/launch/icon_design_adaptive">Adaptive icons</a>, <a href="https://developer.android.com/reference/android/graphics/drawable/AdaptiveIconDrawable">AdaptiveIconDrawable</a>).</li>
        <li>Ohne eigene Monochrom-Ebene färbt Android 16 QPR2 das Icon selbst um, und Nutzer wählen die Icon-Form; eine eigene Ebene gibt uns die Kontrolle zurück (<a href="https://developer.android.com/about/versions/16/qpr2/release-notes">Android 16 QPR2</a>).</li>
        <li>Play Store: 512 px als volles Quadrat, Play rundet und schattiert selbst (<a href="https://developer.android.com/distribute/google-play/resources/icon-design-specifications">Play icon specification</a>).</li>
      </ul>
    </section>
  </main>
  <footer>
    <p>Entwurf für Hummlist, nur Vorschau. Klar, getönt und thematisch sind Annäherungen; das echte Ergebnis zeigt Icon Composer auf dem Mac und ein Android-Gerät.</p>
  </footer>
</body>
</html>
`;
}

// The tilting stack draws its layers as backgrounds: the stack carries the alt text once.
export const stackCss = (tops) => tops.map((v) => ['back', 'middle', 'front'].map((l, i) => `.stack-${v.n} .l${i} { background-image: url("top/${v.n}-${v.slug}/visionos/${l}.svg"); }`).join('\n')).join('\n');
