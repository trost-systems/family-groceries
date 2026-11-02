// Job 81: the review page of the paywall prototypes, /internal/paywall-prototypes on the site's
// preview deployments. Takes the screenshots of
// app/test/purchases/paywall_prototypes_screenshots_test.dart, encodes them as WebP (Chromium's
// encoder, through e2e/'s Playwright) and writes the page.
//
//   (cd app && SCREENSHOT_DIR=/tmp/paywall81 flutter test --update-goldens \
//     test/purchases/paywall_prototypes_screenshots_test.dart)
//   node design/paywall-prototypes/build.mjs /tmp/paywall81
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const repo = new URL('../..', import.meta.url).pathname;
const shots = process.argv[2];
if (!shots) throw new Error('usage: node design/paywall-prototypes/build.mjs <screenshot dir>');
const out = join(repo, 'site/public/internal/paywall-prototypes');
const { chromium } = createRequire(join(repo, 'e2e/package.json'))('playwright');

const RESEARCH =
  'https://github.com/trost-systems/family-groceries/blob/job/81-paywall-prototypes/docs/design/paywall-research.md';

const PROTOTYPES = [
  {
    id: 'p1',
    name: 'PW-P1 Klassisch',
    direction: 'Nutzen vorn, ein Knopf',
    why: 'Gelber Kopfbereich mit dem Nutzen („Eure Liste hört mit“), darunter vier Zeilen, was Premium bringt. Beide Tarife als Auswahl in einer Karte, Jährlich vorausgewählt, ein Knopf „Weiter“. Darunter stehen die Bedingungen des gewählten Tarifs. Die Form, die die meisten RevenueCat-Vorlagen haben.',
    insights: 'R12: das Ergebnis verkaufen, nicht die Funktion. R13 und S1: eine Seite, zwei Tarife, ein Knopf. R10: Jahrestarif als Vorauswahl hob bei Mojo den Jahresanteil um 15 bis 20 %. R16: hell und ruhig.',
    tradeoff: 'Am vertrautesten und kürzesten bis zum Kauf. Die Vorauswahl ist eine Frage für Legal Review (Q1). Lifetime ist nur eine Zeile unter Jährlich.',
  },
  {
    id: 'p2',
    name: 'PW-P2 Einmal zahlen',
    direction: 'Lifetime zuerst',
    why: 'Lifetime ist der Held: „Einmal zahlen. Für immer.“, der Preis als die eine große Zahl, die Vorteile in seiner Karte. Jährlich steht darunter als ruhigere zweite Wahl mit eigenem Knopf und den Abo-Bedingungen.',
    insights: 'Abschnitt 6: in Deutschland wird oft lieber einmal gezahlt (Annahme, keine Studie gefunden). R7 und R8: Lifetime klar zeigen, ohne Scheinrabatt. Lifetime kostet hier das 3-Fache des Jahrespreises, am unteren Ende der Beispiele bei RevenueCat (2,1- bis 11,5-fach).',
    tradeoff: 'Spricht Abo-Müde direkt an. R5 zeigt aber: Jahresabos bringen pro Installation mehr. Diese Variante setzt bewusst auf das Gegenteil von R7 (Lifetime ist dort selten die Hauptsache). „Für immer“ braucht Legal Review (Q3).',
  },
  {
    id: 'p3',
    name: 'PW-P3 Vergleich',
    direction: 'Kostenlos neben Premium',
    why: 'Eine Tabelle zeigt, was kostenlos bleibt (Liste, Sync, Alexa) und was Premium dazugibt (Siri, KI-Assistenten, Hummlist API). Darunter ein Umschalter Jährlich/Lifetime, der Preis groß, ein Knopf mit dem Tarif im Namen.',
    insights: 'S5: Bring! musste 2014 bezahlte geteilte Listen zurücknehmen; das kostenlose Versprechen sichtbar halten. R15: zeigen, was der Haushalt bekommt. Abschnitt 5: Switch ist eine Paywalls-Komponente (anders als der Trial-Umschalter, den Apple seit Februar 2026 ablehnt, R13).',
    tradeoff: 'Am ehrlichsten über Kostenlos und Premium und am besten für Leute, die vergleichen. Der zweite Tarif ist hinter dem Umschalter versteckt; beide Preise sieht man nur nacheinander.',
  },
  {
    id: 'p4',
    name: 'PW-P4 Haushalt',
    direction: 'Einer kauft, alle haben es',
    why: 'Waben für die Mitglieder des Haushalts und ein Plus, dazu „Einer kauft. Alle haben es.“ und dass es auch für später Dazukommende gilt. Drei Vorteile, die Tarife als zwei Kacheln nebeneinander (die gewählte gelb), dann „Weiter“.',
    insights: 'S4: AnyList verkauft einen eigenen Haushaltstarif; bei Hummlist ist es der einzige. Folgerung aus Abschnitt 8: das Haushaltsmodell offen sagen. R13 (Food-App): Tarife nebeneinander hoben Install-zu-Trial um 72 %.',
    tradeoff: 'Am meisten Hummlist: der Haushalt ist das Produkt. Ob die Bindung an den Haushalt vor dem Kauf so stehen muss, ist Q6. Die Kacheln sind schmal; längere Preise (andere Länder) brechen um.',
  },
  {
    id: 'p5',
    name: 'PW-P5 Aus der Sperre',
    direction: 'Blatt aus der Integrationssperre',
    why: 'Öffnet sich als Blatt über „Zugänge“, wenn ein Haushalt ohne Premium auf „Hummlist Premium freischalten“ tippt. Sagt, was gerade pausiert ist und dass es wiederkommt, dass Alexa kostenlos bleibt, dann die Tarife, Kaufen und ein schlichtes „Später“. Als Seite (aus Mehr) ohne „Später“.',
    insights: 'R14 und R15: Paywall am gesperrten Feature, Text nach Einstieg (Duolingo). S1: eine klare Empfehlung. L9: „Später“ ohne Beschämung. Der Einstieg ist schon als paywall_viewed entry_point „integrations“ messbar.',
    tradeoff: 'Kommt genau dann, wenn der Wert klar ist, und lässt den Kontext sichtbar. Wenig Platz für Vorteile; aus Mehr heraus wirkt der Text („pausiert“) fremd und bräuchte dort eine eigene Überschrift. Q9.',
  },
];

const VIEWS = [
  { suffix: 'de-light', label: 'Deutsch, hell' },
  { suffix: 'de-dark', label: 'Deutsch, dunkel' },
  { suffix: 'en-light', label: 'Englisch, hell' },
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
  return `<img src="/internal/paywall-prototypes/${name}.webp" alt="${alt}" width="${width / 2}" height="${height / 2}" loading="lazy">`;
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
<title>Hummlist Premium: fünf Paywall-Prototypen (intern)</title>
<link rel="stylesheet" href="/tokens.css">
<link rel="stylesheet" href="/internal/paywall-prototypes/review.css">
</head>
<body>
<main>
<p class="internal">Intern · nur in Vorschau-Deployments · nicht indexiert</p>
<h1>Hummlist Premium: fünf Paywall-Prototypen</h1>
<p class="lead">Fünf Varianten der Premium-Seite, gebaut in der echten Flutter-App (Debug-Builds: oben auf der Seite Mehr → Hummlist Premium schaltet „Paywall-Prototyp“ zwischen heute und PW-P1 bis PW-P5 um; mit PW-P5 öffnet der Knopf der Integrationssperre in „Zugänge“ das Blatt). Aufnahmen 390 pt breit und so lang wie die Seite, Design 6b Hex Frische. Erzeugt mit <code>app/test/purchases/paywall_prototypes_screenshots_test.dart</code> und <code>node design/paywall-prototypes/build.mjs</code>, Stand ${today}, Code in PR #${process.env.PR ?? "?"}.</p>
<p class="note">Für alle gilt: die Preise sind die konfigurierten Startpreise (9,99 € im Jahr, 29,99 € einmalig; <code>scripts/iap/product.ts</code>), in der App später immer der Preis, den der Store liefert. „inkl. MwSt.“ nur nach einem Euro-Preis. Die Abo-Bedingungen, „Kauf wiederherstellen“, Nutzungsbedingungen und Datenschutzerklärung sind die von heute, unverändert (Platzhaltertexte aus Job 49, Legal Review K.13). Kein Probezeitraum (keiner eingerichtet), kein Countdown, kein durchgestrichener Preis, kein Monatspreis, keine erfundenen Bewertungen, kein Maskottchen. Die Knöpfe kaufen nichts: sie zeigen nur „Prototyp: Hier wird nichts gekauft.“ Keine Flag und kein Schalter wurde geändert.</p>
<nav class="toc"><a href="#heute">Heute</a>${PROTOTYPES.map((p) => `<a href="#${p.id}">${p.name}</a>`).join('')}<a href="#recherche">Recherche</a><a href="#legal">Fragen an Legal Review</a></nav>

<h2>Auf einen Blick</h2>
<p class="note">Deutsch, hell, nebeneinander; ganz links die Seite von heute. PW-P5 als Blatt über „Zugänge“. Die gestrichelte Linie zeigt, wie weit man ohne Scrollen sieht (iPhone 13/14: 714 pt).</p>
<div class="compare">
<div class="compare-col"><p class="compare-label"><a href="#heute">Heute</a></p><div class="fold">${img('now-de-light', 'Heutige Premium-Seite, hell')}</div></div>
${PROTOTYPES.map((p) => {
  const shot = p.id === 'p5' ? 'p5-sheet-de-light' : `${p.id}-de-light`;
  return `<div class="compare-col"><p class="compare-label"><a href="#${p.id}">${p.name}</a></p><div class="fold">${img(shot, `${p.name}, hell`)}</div></div>`;
}).join('\n')}
</div>

<h2>Die Vorschläge</h2>
<table class="summary"><thead><tr><th>Prototyp</th><th>Richtung</th><th>RevenueCat und andere Quellen</th><th>Abwägung</th></tr></thead><tbody>
${PROTOTYPES.map((p) => `<tr><td><a href="#${p.id}">${p.name}</a></td><td>${p.direction}</td><td>${p.insights}</td><td>${p.tradeoff}</td></tr>`).join('\n')}
</tbody></table>

<section id="heute" class="proposal">
<h2>Heute <span class="direction">Zum Vergleich</span></h2>
<p class="rationale">Die Premium-Seite auf main: Funktionskarte, dann je Tarif eine Karte mit Preis, Bedingungen und eigenem Knopf, darunter Wiederherstellen und die Links.</p>
<div class="shots">${VIEWS.map((v) => figure(`now-${v.suffix}`, v.label, `Heute: ${v.label}`)).join('')}</div>
</section>
${PROTOTYPES.map((p) => `<section id="${p.id}" class="proposal">
<h2>${p.name} <span class="direction">${p.direction}</span></h2>
<p class="rationale">${p.why}</p>
<p class="rationale"><strong>Woher:</strong> ${p.insights}</p>
<p class="rationale"><strong>Abwägung:</strong> ${p.tradeoff}</p>
<div class="shots">${[
  ...(p.id === 'p5' ? VIEWS.map((v) => figure(`p5-sheet-${v.suffix}`, `Blatt, ${v.label}`, `${p.name} als Blatt: ${v.label}`)) : []),
  ...VIEWS.map((v) => figure(`${p.id}-${v.suffix}`, p.id === 'p5' ? `Seite, ${v.label}` : v.label, `${p.name}: ${v.label}`)),
].join('')}</div>
</section>`).join('\n')}

<section id="recherche">
<h2>Recherche</h2>
<p class="rationale">Die Recherche mit Quellen steht unter <a href="${RESEARCH}"><code>docs/design/paywall-research.md</code></a>, RevenueCat als Hauptquelle (State of Subscription Apps 2025 und 2026, Paywall-Tests, Redesign-Fallstudien, Platzierung, Paywalls-v2-Komponenten), dazu Superwall, Adapty, AnyList, Bring!, Todoist und Things. Kurz: Hummlist ist Freemium, also eher 2 % als 10 % zahlende Downloads (R1, R4). Eine ruhige Seite mit zwei Tarifen und einer klaren Empfehlung (R13, S1). Jahresabos bringen mehr pro Installation (R5), Lifetime klar zeigen, ohne Scheinrabatt (R7, R8). Der Text richtet sich nach dem Einstieg (R14, R15). Nur echte Bewertungen (R12). Alle fünf Prototypen nutzen nur Bausteine, die RevenueCat Paywalls v2 auch kann (Stack, Text, Image, Icon, Feature list, Package, Purchase button, Button, Switch). Die App bleibt trotzdem nativ: DECISIONS „Job 43“ Punkt 22 schließt RevenueCat Paywalls aus.</p>
</section>

<section id="legal">
<h2>Fragen an Legal Review</h2>
<ul class="findings">
<li>Q1: Ist ein vorausgewählter Jahrestarif (PW-P1, P3, P4, P5) eine Voreinstellung im Sinne von UGP-Richtlinie oder DSA Art. 25, wenn beide Preise voll sichtbar sind?</li>
<li>Q3: Darf „für immer“ (PW-P2, und heute schon „Einmal zahlen, für immer“) stehen, oder braucht „Lifetime“ eine Erklärung („solange Hummlist angeboten wird“)?</li>
<li>Q6: Muss die Bindung an den Haushalt („bleibt bei dem Haushalt, in dem gekauft wurde“) vor dem Kauf auf der Seite stehen (PW-P4 sagt nur „auch für alle, die später dazukommen“)?</li>
<li>Q9: Ist ein Blatt mit Kaufknopf direkt an der gesperrten Verbindung (PW-P5) zulässig, mit „Später“ als gleichwertigem Ausgang?</li>
<li>Neu: Die Nutzentexte („Per Siri auf die Liste, ohne die App zu öffnen“, „ChatGPT oder Claude schreiben mit“, „Kein Abo, keine Verlängerung“) sind Werbeaussagen; dürfen Marken wie ChatGPT und Claude so genannt werden?</li>
</ul>
</section>
</main>
</body>
</html>
`;
writeFileSync(join(repo, 'site/public/internal/paywall-prototypes.html'), html);
writeFileSync(join(out, 'review.css'), readFileSync(new URL('./review.css', import.meta.url)));
console.log(`paywall-prototypes: ${Object.keys(sizes).length} shots, page written`);
