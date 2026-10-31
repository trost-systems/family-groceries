// The preview page design-prototypes/app-icon/index.html, built from the same data as the
// assets so names, files and alt texts can't drift. No scripts: the site CSP forbids them.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

const APPLE = [
  ['light', 'Hell'],
  ['dark', 'Dunkel'],
  ['clear', 'Klar'],
  ['tinted', 'Getönt'],
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
    ${APPLE.map(([m, label]) => figure(`${dir}/previews/apple-${m}.svg`, `App-Icon ${v.name}, Darstellung ${label}: ${m === 'light' || m === 'dark' ? v.look : 'die Form in einer Farbe'}`, label, `apple apple-${m}`)).join('\n    ')}
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

export function page({ variations, tops, families, spriteSize: [sw, sh] }) {
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
        <li><a href="#alle">Alle ${count} Varianten</a></li>
        ${tops.map((v, i) => `<li><a href="#top-${v.n}">Favorit ${i + 1}: ${esc(v.name)}</a></li>`).join('\n        ')}
        <li><a href="#plattformen">Was Apple und Google verlangen</a></li>
      </ul>
    </nav>
  </header>
  <main>
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
