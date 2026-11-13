// The five prototypes and the six scenarios. Steps call the same actions as the phone's taps.
import { MIN, HOUR } from './model.js';

export const TMS = [
  {
    id: 'TM1', slug: 'card-ask-slim-strip', title: 'Karte fragt, schmale Leiste',
    pitch: 'Das erste Abhaken bringt oben eine Karte wie die heutige „Einkauf eintragen?“-Karte. Abhaken geht weiter, die Karte wartet. Während des Einkaufs liegt eine 40 px schmale dunkle Leiste direkt über dem Eingabefeld. Am Ende öffnet sich die Übersicht als eigene Seite.',
    bar: 'Schmale Leiste über dem Feld: Uhr, Pause, Beenden. Bei offener Tastatur verschwindet sie und kommt danach zurück.',
    summary: 'Eigene Seite mit Zurück-Pfeil.',
    gate: 'Free: Die Seite zeigt Dauer und Datum, darunter die Übersicht unscharf mit einer Premium-Karte.',
    plus: 'Vertraut (gleiche Karte wie beim Verlauf), blockiert nichts, die Leiste kostet nur 40 px.',
    minus: 'Die Karte oben sieht nur, wer nach oben schaut; beim Abhaken weit unten steht sie außerhalb des Blicks (darum klebt sie oben).',
  },
  {
    id: 'TM2', slug: 'sheet-ask-floating-timer', title: 'Blatt fragt, schwebende Uhr',
    pitch: 'Das erste Abhaken öffnet ein kleines Blatt von unten: „Kaufst du gerade ein?“ mit „Ja“, „Nein, nur abgehakt“ und „Zurücknehmen“ für ein Versehen. Die Uhr schwebt als Honig-Pille mittig über dem Feld. Die Übersicht kommt als hohes Blatt.',
    bar: 'Schwebende Pille: Uhr, Pause/Weiter, Beenden. Sie bleibt auch bei offener Tastatur über dem Feld.',
    summary: 'Hohes Blatt über der Liste.',
    gate: 'Free: Das Blatt zeigt Dauer und Zahl der abgehakten Artikel, dazu eine ruhige Premium-Karte ohne Inhalt dahinter.',
    plus: 'Eine klare Entscheidung, auch für das versehentliche Abhaken („Zurücknehmen“). Pausiert und beendet von selbst, wenn man es vergisst.',
    minus: 'Unterbricht das erste Abhaken jedes Tages mit einem Blatt; die Pille verdeckt einen Streifen der Liste.',
  },
  {
    id: 'TM3', slug: 'toast-ask-timer-in-tabs', title: 'Hinweis fragt, Uhr in den Tabs',
    pitch: 'Die Frage kommt im Hinweis, der beim Abhaken ohnehin unten erscheint: „Butter abgehakt. Kaufst du gerade ein?“ mit „Starten“. Ohne Antwort verschwindet er. Die Uhr sitzt als Honig-Feld vorne in der Tab-Pille, ein Tipp darauf öffnet Pause und Beenden. Die Übersicht steht danach im Verlauf, aufgeklappt.',
    bar: 'Keine eigene Leiste: die Uhr ist ein Feld in der Tab-Pille, Steuerung im Menü darüber.',
    summary: 'Im Verlauf, als aufgeklappter Eintrag.',
    gate: 'Free: Die erste Übersicht gibt es einmal ganz, danach steht im Verlauf eine Zeile „Geplant und gekauft mit Snacklist Premium“.',
    plus: 'Null zusätzliche Höhe, keine Unterbrechung; die Übersicht wohnt dort, wo Einkäufe ohnehin stehen.',
    minus: 'Leicht zu übersehen; Pause und Beenden brauchen zwei Tipps. Das einmalige Geschenk ist eine Produktentscheidung (TQ8).',
  },
  {
    id: 'TM4', slug: 'store-ask-lap-bar', title: 'Fragt nach dem Laden, Runden pro Laden',
    pitch: 'Die Karte fragt nach dem Laden des abgehakten Artikels: „Bist du gerade bei Lidl?“. Ein Artikel aus einem anderen Laden schaltet die Uhr in eine neue Runde („Lidl 18:20 · Rewe 4:02“). Die Übersicht ist nach Läden gegliedert.',
    bar: 'Breite Leiste über dem Feld mit Laden und Runden, Pause, Beenden. Bei offener Tastatur schrumpft sie auf eine dünne Zeile mit der Uhr.',
    summary: 'Eigene Seite, nach Läden gegliedert, mit der Zeit pro Laden.',
    gate: 'Free: Am Ende nur ein Hinweis „Einkauf beendet · 24 Min.“; im Verlauf steht die Übersicht hinter einer Schloss-Zeile wie die älteren Einkäufe.',
    plus: 'Passt zu zwei Läden auf einer Liste; „Nein“ für Lidl stört Rewe nicht.',
    minus: 'Die Leiste ist die breiteste; Runden sind mehr Begriff als nötig, wenn fast alle in einem Laden einkaufen.',
  },
  {
    id: 'TM5', slug: 'row-ask-trip-replaces-tabs', title: 'Artikel fragt, Einkauf ersetzt die Tabs',
    pitch: 'Das erste Abhaken klappt den Artikel auf: „Gekauft, Einkauf starten“ oder „Nicht mehr nötig“. So beantwortet der Tipp selbst, warum abgehakt wurde. Während des Einkaufs wird die Tab-Pille zur Einkaufs-Pille; die Tabs liegen hinter einem Knopf. Am Ende steht eine Übersichtskarte oben auf der Liste.',
    bar: 'Die Tab-Pille wird zur Einkaufs-Pille (Uhr, Pause, Beenden, Tabs). Bei offener Tastatur geht sie wie heute die Tabs.',
    summary: 'Karte oben auf der Liste mit den Zahlen; ein Tipp öffnet die ganze Seite.',
    gate: 'Free: Die Karte zeigt die Zahlen (5 von 7 geplant, 2 dazu); die Namen dahinter brauchen Premium.',
    plus: 'Unterscheidet „gekauft“ von „weg damit“ beim ersten Tipp; keine zusätzliche Höhe, der Laden-Modus ist eindeutig.',
    minus: 'Jedes erste Abhaken braucht einen zweiten Tipp; die Tabs sind beim Einkaufen einen Tipp weiter weg.',
  },
];

const SHOP_ONE = ['Bananen', 'Äpfel', 'Brötchen', 'Vollmilch', 'Butter', 'Nudeln'];
const SHOP_TWO = ['Bananen', 'Brötchen', 'Butter', 'Nudeln', 'Kaffee', 'Joghurt', 'Basilikum', 'Feta'];

export const SCENARIOS = [
  {
    id: 'S1', title: 'Ein Laden', items: SHOP_ONE,
    steps: [
      { label: 'Bananen abhaken: die Frage kommt', run: (a) => a.tick('Bananen'), shot: 'prompt' },
      { label: 'Ja, Einkauf starten', run: (a) => a.yes() },
      { label: '4 Min. später Brötchen und Butter abhaken', run: (a) => { a.wait(4 * MIN); a.tick('Brötchen'); a.tick('Butter'); } },
      { label: 'Du schreibst Eis dazu und hakst es ab', run: (a) => { a.wait(3 * MIN); a.add('Eis'); a.tick('Eis'); }, shot: 'bar' },
      { label: 'Tastatur auf: die Leiste macht Platz', run: (a) => a.keyboard(true), shot: 'keyboard' },
      { label: '18 Min. später Vollmilch abhaken', run: (a) => { a.keyboard(false); a.wait(18 * MIN); a.tick('Vollmilch'); } },
      { label: 'Einkauf beenden: die Übersicht', run: (a) => a.end(), shot: 'summary' },
      { label: 'Im Verlauf den Einkauf öffnen', run: (a) => a.openHistory(), shot: 'history' },
    ],
  },
  {
    id: 'S2', title: 'Zwei Läden', items: SHOP_TWO,
    steps: [
      { label: 'Bananen (Lidl) abhaken und Ja', run: (a) => { a.tick('Bananen'); a.yes(); } },
      { label: '12 Min. später Brötchen, Butter, Nudeln abhaken', run: (a) => { a.wait(12 * MIN); a.tick('Brötchen'); a.tick('Butter'); a.tick('Nudeln'); } },
      { label: 'Pause für die Fahrt zu Rewe, 15 Min. vergehen', run: (a) => { a.pause(); a.wait(15 * MIN); }, shot: 'paused' },
      { label: 'Weiter, Kaffee, Joghurt und Feta abhaken', run: (a) => { a.resume(); a.tick('Kaffee'); a.wait(6 * MIN); a.tick('Joghurt'); a.tick('Feta'); }, shot: 'second-store' },
      { label: 'Einkauf beenden: die Übersicht', run: (a) => a.end(), shot: 'summary' },
    ],
  },
  {
    id: 'S3', title: 'App beendet', items: SHOP_ONE,
    steps: [
      { label: 'Bananen abhaken, Ja, 7 Min. später Brötchen', run: (a) => { a.tick('Bananen'); a.yes(); a.wait(7 * MIN); a.tick('Brötchen'); } },
      { label: 'App beenden, 10 Min. später wieder öffnen (lädt die Seite neu)', run: (a) => a.reopen(10 * MIN), shot: 'reopened', reload: true },
      { label: 'Butter abhaken und beenden', run: (a) => { a.tick('Butter'); a.end(); }, shot: 'summary' },
    ],
  },
  {
    id: 'S4', title: 'Lea schreibt dazu', items: SHOP_ONE,
    steps: [
      { label: 'Bananen abhaken, Ja, 5 Min. vergehen', run: (a) => { a.tick('Bananen'); a.yes(); a.wait(5 * MIN); } },
      { label: 'Lea schreibt Milch und Eier dazu', run: (a) => { a.lea('Milch'); a.lea('Eier'); }, shot: 'lea-adds' },
      { label: 'Milch und Butter abhaken, beenden', run: (a) => { a.tick('Milch'); a.tick('Butter'); a.wait(3 * MIN); a.end(); }, shot: 'summary' },
      { label: 'Milch: „War geplant“', run: (a) => a.planned('Milch'), shot: 'was-planned' },
    ],
  },
  {
    id: 'S5', title: 'Stunden später', items: SHOP_ONE,
    steps: [
      { label: 'Bananen abhaken, Ja, 6 Min. später Brötchen', run: (a) => { a.tick('Bananen'); a.yes(); a.wait(6 * MIN); a.tick('Brötchen'); } },
      { label: 'Handy in die Tasche: 4 Stunden vergehen', run: (a) => a.wait(4 * HOUR), shot: 'hours-later' },
      { label: 'Beim letzten Abhaken beenden', run: (a) => a.resolveLong(), shot: 'summary' },
    ],
  },
  {
    id: 'S6', title: 'Aus Versehen', items: ['Spülmittel', ...SHOP_TWO],
    steps: [
      { label: 'Spülmittel abhaken (wird nicht mehr gebraucht): die Frage kommt', run: (a) => a.tick('Spülmittel'), shot: 'prompt' },
      { label: 'Nein', run: (a) => a.no(), shot: 'declined' },
      { label: '1 Min. später Nudeln abhaken: keine Frage', run: (a) => { a.wait(MIN); a.tick('Nudeln'); }, shot: 'next-tick' },
      { label: '3 Std. später Bananen abhaken: fragt es wieder?', run: (a) => { a.wait(3 * HOUR); a.tick('Bananen'); }, shot: 'later' },
    ],
  },
];
