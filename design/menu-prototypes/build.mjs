// Job 79: the review page of the More prototypes, /internal/menu-prototypes on the site's preview
// deployments. Takes the screenshots of app/test/more/menu_prototypes_screenshots_test.dart,
// encodes them as WebP (Chromium's encoder, through e2e/'s Playwright) and writes the page.
//
//   (cd app && SCREENSHOT_DIR=/tmp/menu79 flutter test --update-goldens \
//     test/more/menu_prototypes_screenshots_test.dart)
//   node design/menu-prototypes/build.mjs /tmp/menu79
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const repo = new URL('../..', import.meta.url).pathname;
const shots = process.argv[2];
if (!shots) throw new Error('usage: node design/menu-prototypes/build.mjs <screenshot dir>');
const out = join(repo, 'site/public/internal/menu-prototypes');
const { chromium } = createRequire(join(repo, 'e2e/package.json'))('playwright');

const PROTOTYPES = [
  {
    id: 'p1',
    name: 'M-P1 Klar gegliedert',
    direction: 'Das heutige Menü, aufgeräumt',
    why: 'Gleiche Optik wie heute (kleine Großbuchstaben mit Linie, Symbole, Hinweiszeilen), aber fünf klare Gruppen: Haushalt, Verbindungen, Konto, Hilfe, Über Hummlist. Der Schalter für Nutzungsdaten ist auf die Seite Datenschutz gewandert; Abmelden steht am Ende von Konto.',
    tradeoff: 'Am wenigsten Umgewöhnung. Mit Hinweiszeilen bleibt es lang: das Rechtliche liegt unterhalb des ersten Bildschirms.',
  },
  {
    id: 'p2',
    name: 'M-P2 Gruppen',
    direction: 'Eingerückte Gruppen ohne Überschriften',
    why: 'Wie die iOS-Einstellungen: Zeilen in umrandeten Gruppen (2 px Kontur, Sticker-Schatten), Gruppierung nur über Abstand, Symbole auf getönten Waben. Konto steht oben, Rechtliches ist eine Unterseite, Abmelden eine eigene Gruppe in Fehlerfarbe.',
    tradeoff: 'Am kürzesten mit Symbolen, passt fast auf einen Bildschirm. Ohne Überschriften erklärt sich jede Gruppe nur über ihre Zeilen; die Gruppenflächen sind keine Karten, wirken aber kräftiger.',
  },
  {
    id: 'p3',
    name: 'M-P3 Luftig',
    direction: 'Deutlich mehr Abstand zwischen den Gruppen',
    why: '48 px zwischen den Gruppen (heute 20), Überschriften in Bricolage, 64 px hohe Zeilen mit Hinweis. Jede Gruppe steht für sich; Konto und Abmelden rücken nach unten, das Rechtliche wird eine Zeile. Abmelden steht hier in normaler Schrift in der Gruppe Konto; M-P2 und M-P4 zeigen es dagegen abgesetzt in Fehlerfarbe.',
    tradeoff: 'Am ruhigsten und am leichtesten zu überfliegen, aber am längsten: nur drei Gruppen auf dem ersten Bildschirm.',
  },
  {
    id: 'p4',
    name: 'M-P4 Kompakt',
    direction: 'Dicht, nur Text, Werte am Zeilenende',
    why: 'Keine Symbole, keine Hinweise, 48 px Zeilen, drei Gruppen. Einstellungen zeigt den aktuellen Stand („Hell · Deutsch“). Rechtliches ist eine Unterseite, Abmelden steht allein am Ende in Fehlerfarbe.',
    tradeoff: 'Alles auf einem Bildschirm, ohne Scrollen. Wirkt am nüchternsten; ohne Hinweise muss man wissen, was hinter „Zugänge“ steckt.',
  },
  {
    id: 'p5',
    name: 'M-P5 Nach Aufgaben',
    direction: 'Überschriften sagen, was man tun will',
    why: 'Gruppen nach Aufgaben: Gemeinsam einkaufen, Mit Siri, Alexa und KI, Hilfe und Feedback, Du und deine Daten. Symbole auf Waben in Gruppenfarbe. Das Rechtliche steht als leiser Fußbereich in kleinerer Schrift über der Version.',
    tradeoff: 'Am freundlichsten und am meisten nach Hummlist. Die Aufgaben-Überschriften sind länger und müssen gepflegt werden, wenn neue Zeilen dazukommen.',
  },
];

const VIEWS = [
  { suffix: 'de-light', label: 'Hell' },
  { suffix: 'de-dark', label: 'Dunkel' },
  { suffix: 'de-light-update', label: 'Mit Update-Karte, hell' },
  { suffix: 'de-dark-update', label: 'Mit Update-Karte, dunkel' },
  { suffix: 'de-light-privacy', label: 'Unterseite Datenschutz' },
  { suffix: 'en-light-update', label: 'Englisch, mit Update-Karte' },
];

const pngSize = (file) => {
  const b = readFileSync(file);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
};

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const sizes = {};
const browser = await chromium.launch();
const page = await browser.newPage();
for (const file of readdirSync(shots).filter((f) => f.endsWith('.png')).sort()) {
  const name = file.slice(0, -4);
  sizes[name] = pngSize(join(shots, file));
  const data = readFileSync(join(shots, file)).toString('base64');
  const webp = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    return canvas.toDataURL('image/webp', 0.9).split(',')[1];
  }, `data:image/png;base64,${data}`);
  writeFileSync(join(out, `${name}.webp`), Buffer.from(webp, 'base64'));
}
await browser.close();

const img = (name, alt) => {
  const { width, height } = sizes[name];
  return `<img src="/internal/menu-prototypes/${name}.webp" alt="${alt}" width="${width / 2}" height="${height / 2}" loading="lazy">`;
};
const figure = (name, caption, alt) =>
  `<figure>${img(name, alt)}<figcaption>${caption}</figcaption></figure>`;

const today = new Date().toISOString().slice(0, 10);

const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Mehr-Menü: fünf Prototypen (intern)</title>
<link rel="stylesheet" href="/tokens.css">
<link rel="stylesheet" href="/internal/menu-prototypes/review.css">
</head>
<body>
<main>
<p class="internal">Intern · nur in Vorschau-Deployments · nicht indexiert</p>
<h1>Mehr-Menü: fünf Prototypen</h1>
<p class="lead">Fünf Varianten des Tabs „Mehr“, gebaut in der echten Flutter-App (Debug-Builds: Labor-Symbol oben rechts in „Mehr“ schaltet zwischen heutigem Menü, M-P1 bis M-P5 und der Update-Karte um). Aufnahmen 390 pt breit und so lang wie das Menü, Design 6b Hex Frische. Erzeugt mit <code>app/test/more/menu_prototypes_screenshots_test.dart</code> und <code>node design/menu-prototypes/build.mjs</code>, Stand ${today}, Code in PR #206.</p>
<p class="note">Für alle gilt: nur Menüzeilen und unten die Version. Der Schalter für Nutzungsdaten liegt auf der Unterseite Datenschutz. Ganz oben ist Platz für genau eine Karte, wenn ein Update bereitliegt (Shorebird-Patch: „Neu starten“, neue Store-Version: „Aktualisieren“). Läden und Kategorien fehlen, weil sie mit Job 78 in „Anpassen“ auf der Liste wandern. „Archivierte Haushalte“ und „Hilfe &amp; Kontakt“ erscheinen wie heute nur, wenn sie freigeschaltet sind; Premium nur, solange es angeboten wird. In der Übersicht markiert die gestrichelte Linie, wie weit man ohne Scrollen sieht (iPhone 13/14: 844 pt minus Statusleiste und Tab-Leiste, also 714 pt). Die Update-Karte ist eine Attrappe: ihre Knöpfe schließen sie nur, und „1.4.0“ ist ein Beispiel. Noch prüft nichts, ob ein Patch oder eine neue Store-Version bereitliegt.</p>
<nav class="toc"><a href="#heute">Heute</a>${PROTOTYPES.map((p) => `<a href="#${p.id}">${p.name}</a>`).join('')}<a href="#recherche">Recherche</a></nav>

<h2>Auf einen Blick</h2>
<p class="note">Hell, ohne Update-Karte, nebeneinander. Ganz links das heutige Menü.</p>
<div class="compare">
<div class="compare-col"><p class="compare-label"><a href="#heute">Heute</a></p><div class="fold">${img('now-de-light', 'Heutiges Mehr-Menü, hell')}</div></div>
${PROTOTYPES.map((p) => `<div class="compare-col"><p class="compare-label"><a href="#${p.id}">${p.name}</a></p><div class="fold">${img(`${p.id}-de-light`, `${p.name}, hell`)}</div></div>`).join('\n')}
</div>

<h2>Die Vorschläge</h2>
<table class="summary"><thead><tr><th>Prototyp</th><th>Richtung</th><th>Abwägung</th></tr></thead><tbody>
${PROTOTYPES.map((p) => `<tr><td><a href="#${p.id}">${p.name}</a></td><td>${p.direction}</td><td>${p.tradeoff}</td></tr>`).join('\n')}
</tbody></table>

<section id="heute" class="proposal">
<h2>Heute <span class="direction">Zum Vergleich</span></h2>
<p class="rationale">Das Menü auf main: sieben Gruppen, Läden und Kategorien noch drin, der Schalter für Nutzungsdaten mitten in der Liste.</p>
<div class="shots">${figure('now-de-light', 'Hell', 'Heutiges Mehr-Menü, hell')}${figure('now-de-dark', 'Dunkel', 'Heutiges Mehr-Menü, dunkel')}</div>
</section>
${PROTOTYPES.map((p) => `<section id="${p.id}" class="proposal">
<h2>${p.name} <span class="direction">${p.direction}</span></h2>
<p class="rationale">${p.why}</p>
<p class="rationale"><strong>Abwägung:</strong> ${p.tradeoff}</p>
<div class="shots">${VIEWS.map((v) => figure(`${p.id}-${v.suffix}`, v.label, `${p.name}: ${v.label}`)).join('')}</div>
</section>`).join('\n')}

<section id="recherche">
<h2>Recherche</h2>
<p class="rationale">Die Recherche (iOS-Einstellungen, Things, Todoist, Bring!, AnyList, Revolut, Spotify, Duolingo, Material 3, Apple HIG) mit Quellen und Folgerungen steht im Repository unter <code>docs/design/menu-research.md</code>. Kurz: nach Häufigkeit ordnen, Überschriften nur wo die Gruppe nicht selbsterklärend ist, eine Symbolsprache, Konto löschen eine Ebene tiefer, Schalter auf Unterseiten, Update-Hinweis oben und nur wenn nötig, Version klein am Ende.</p>
</section>
</main>
</body>
</html>
`;
writeFileSync(join(repo, 'site/public/internal/menu-prototypes.html'), html);
writeFileSync(join(out, 'review.css'), readFileSync(new URL('./review.css', import.meta.url)));
console.log(`menu-prototypes: ${Object.keys(sizes).length} shots, page written`);
