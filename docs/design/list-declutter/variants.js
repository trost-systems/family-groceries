// Labels, slugs and the notes shown next to each phone. Layout lives in proto.js.
// `set`: r1 is job 223's round, ss/bb/ld4 are round 2 (job 227); `today` belongs to every set.

export const variants = [
  {
    id: 'today',
    set: 'all',
    slug: 'today',
    name: { de: 'Heute', en: 'Today' },
    notes: {
      de: ['Nachbau des heutigen Listen-Bildschirms als Maßstab: Haushalt-Chip und Anpassen, Listen-Reiter, Erste-Schritte-Karte, Laden-Zeile, „+ Preis“ an jeder Zeile, Einkaufssumme, Eingabefeld, Tab-Leiste.'],
      en: ['Rebuild of today’s list screen as the yardstick: household chip and Edit, list tabs, First steps card, store row, “+ Price” on every row, shopping total, add field, tab bar.'],
    },
  },
  {
    id: 'LD1',
    set: 'r1',
    slug: 'slim-chrome',
    name: { de: 'Schlanke Leisten', en: 'Slim chrome' },
    notes: {
      de: [
        'Gleicher Aufbau, jede Leiste dünner. Die Kopfzeile ist die zweizeilige Taste aus Job 205 (Haushalt klein, Liste fett), die Listen-Reiter entfallen.',
        'Erste Schritte werden ein einzeiliger Hinweis; ein Tipp öffnet die Karte als Blatt, das X blendet aus.',
        'Ohne Preis zeigt die Zeile nur ein leises €-Zeichen (Tippfläche 48 × 48 px wie heute); mit Preis den Betrag.',
        'Die Einkaufssumme ist eine 28-px-Zeile über dem Eingabefeld.',
        'Beim ersten Abhaken fragt LD1 einmal „Kaufst du gerade ein?“ (Job 217). Mit Ja ersetzt die Trip-Leiste die Summen-Zeile. Im Prototyp kommt die Frage nur einmal pro Sitzung.',
      ],
      en: [
        'Same structure, every band thinner. The header is job 205’s two-line button (household small, list bold); the list tabs go.',
        'First steps become a one-line nudge; a tap opens the card as a sheet, the X hides it.',
        'Without a price a row shows only a quiet € mark (48 × 48 px target, as today); with one, the amount.',
        'The shopping total is a 28 px line above the add field.',
        'The first tick asks “Shopping right now?” once (job 217). On yes the trip bar replaces the total line. In the prototype it asks once per session.',
      ],
    },
  },
  {
    id: 'LD2',
    set: 'r1',
    slug: 'collapsing-header',
    name: { de: 'Kopf klappt beim Scrollen ein', en: 'Header collapses on scroll' },
    notes: {
      de: [
        'Oben steht anfangs alles wie gewohnt (Job-205-Taste, Erste Schritte, Summe). Wer scrollt, schiebt es weg; eine 48-px-Leiste bleibt mit Liste, Fortschritt, Summe und Anpassen.',
        'Preise kommen im Moment des Kaufs: nach dem Abhaken bietet ein Hinweis „+ Preis“ an. Ein Chip erscheint nur bei Zeilen mit Preis.',
        'Die Summe steht in der eingeklappten Leiste und am Ende der Liste, nicht als eigener Balken.',
      ],
      en: [
        'At first the top holds everything as usual (job 205 button, First steps, total). Scrolling pushes it away; a 48 px bar stays with list, progress, total and Edit.',
        'Prices come at the moment of buying: after a tick a note offers “+ Price”. A chip shows only on rows with a price.',
        'The total sits in the collapsed bar and at the end of the list, not in a bar of its own.',
      ],
    },
  },
  {
    id: 'LD3',
    set: 'r1',
    slug: 'plan-and-shop-modes',
    name: { de: 'Planen und Einkaufen', en: 'Plan and shop modes' },
    notes: {
      de: [
        'Zwei Zustände. Beim Planen: nur Kopfzeile, Liste, Eingabe. Keine Preis-Chips, keine Summe, kein Fortschritt.',
        'Beim Einkaufen (Einkaufen-Taste oben, oder „Kaufst du gerade ein?“ nach dem ersten Abhaken wie in Job 217) erscheinen Preis-Chips, und die Trip-Leiste aus Job 217 trägt Stoppuhr, Fortschritt und Summe.',
        'Erste Schritte bleiben als Karte, aber nur beim Planen und unter der Kopfzeile eingeklappt auf eine Zeile.',
      ],
      en: [
        'Two states. Planning: header, list, add field only. No price chips, no total, no progress.',
        'Shopping (the Shop button on top, or “Shopping right now?” after the first tick as in job 217) brings the price chips, and job 217’s trip bar carries the stopwatch, progress and total.',
        'First steps stay a card, but only while planning, folded to one line under the header.',
      ],
    },
  },
  {
    id: 'LD4',
    set: 'r1',
    slug: 'bottom-dock',
    name: { de: 'Alles unten im Dock', en: 'Everything in a bottom dock' },
    notes: {
      de: [
        'Oben ist keine feste Leiste mehr. Der Listenname steht groß am Anfang der Liste und scrollt mit.',
        'Unten ein Dock: Eingabefeld mit Mikrofon und Mehr-Taste in einer Zeile statt Eingabe plus Tab-Leiste. Darüber ein Griff mit Liste, Fortschritt und Summe.',
        'Den Griff hochziehen oder antippen öffnet ein Blatt: Liste und Haushalt wechseln, Anpassen, Erste Schritte, Summe je Laden, Verlauf.',
        'Preise im Bearbeiten-Blatt (Halten, wie heute); mit Preis steht der Betrag leise in der Zeile.',
      ],
      en: [
        'No fixed bar on top. The list name sits large at the start of the list and scrolls with it.',
        'At the bottom a dock: add field with mic and a More button in one row instead of add field plus tab bar. Above it a handle with list, progress and total.',
        'Pulling up or tapping the handle opens a sheet: switch list and household, Edit, First steps, total per store, History.',
        'Prices in the edit sheet (hold, as today); with a price the amount sits quietly in the row.',
      ],
    },
  },
  {
    id: 'LD5',
    set: 'r1',
    slug: 'list-owns-the-chrome',
    name: { de: 'Alles in der Liste', en: 'Everything inside the list' },
    notes: {
      de: [
        'Fest bleiben nur Eingabefeld und Tab-Leiste. Kopfzeile, Erste Schritte (eine Zeile), Laden-Fortschritt und Einkaufssumme sind Zeilen der Liste und scrollen mit.',
        'Beim Zurückscrollen nach oben taucht die Kopfzeile sofort wieder auf (wie Safaris Adressleiste).',
        'Preis: Zeile nach links wischen zeigt „Preis“. Mit Preis steht der Betrag als Text, ohne Chip. Teilsumme im Laden-Trenner.',
      ],
      en: [
        'Only the add field and the tab bar stay fixed. Header, First steps (one line), store progress and the shopping total are rows of the list and scroll with it.',
        'Scrolling back up brings the header back at once (like Safari’s address bar).',
        'Price: swipe a row left to show “Price”. With a price the amount is plain text, no chip. Subtotal in the store divider.',
      ],
    },
  },
];

const base = {
  de: 'Basis wie alle Runde-2-Telefone: kombinierter Umschalter (B1) in einer festen, durchscheinenden Kopfzeile (B2), Erste Schritte wie heute (B3), Summe als Zeile am Ende der offenen Artikel (B4), drei Tabs (B5), Einkaufen-Frage und Trip-Leiste aus LD1 (B6).',
  en: 'Base as in every round 2 phone: combined switcher (B1) in a fixed, see-through header (B2), First steps as today (B3), the total as a row after the open items (B4), three tabs (B5), LD1’s shopping prompt and trip bar (B6).',
};

export const round2 = [
  {
    id: 'R2',
    set: 'base',
    slug: 'base',
    name: { de: 'Basis Runde 2', en: 'Round 2 base' },
    notes: {
      de: [base.de, 'Unten wie heute: Eingabefeld (72 px) und Tab-Leiste mit Liste, Verlauf, Mehr (52 px plus 26 px bis zum Rand). Das ist der Maßstab für BB1 bis BB5.', 'Die Zeilen sind die von LD1: leises €, schlanke Laden-Trenner. Der Umschalter öffnet das Blatt aus SS4.'],
      en: [base.en, 'Bottom as today: add field (72 px) and the tab bar with List, History, More (52 px plus 26 px to the edge). It is the yardstick for BB1 to BB5.', 'Rows are LD1’s: quiet €, slim store dividers. The switcher opens SS4’s sheet.'],
    },
  },
  {
    id: 'SS1',
    set: 'ss',
    slug: 'nested-tree',
    name: { de: 'Listen unter dem Haushalt', en: 'Lists under their household' },
    notes: {
      de: ['Das heutige Haushalt-Blatt, Zeile für Zeile. Unter dem angezeigten Haushalt stehen eingerückt seine Listen, mit Haken an der gezeigten, „⋮“ je Liste (Umbenennen, Nach oben, Nach unten, Löschen) und „Neue Liste“.', 'Andere Haushalte zeigen „2 Listen“ mit Pfeil: ein Tipp klappt ihre Listen auf, ein Tipp auf eine Liste wechselt Haushalt und Liste zugleich.', 'Ein Blatt, eine Ebene. Bei vielen Listen wird es lang.'],
      en: ['Today’s household sheet, row for row. Under the shown household its lists are indented, with a check on the shown one, “⋮” per list (Rename, Move up, Move down, Delete) and “New list”.', 'Other households show “2 lists” with an arrow: a tap unfolds their lists, a tap on one switches household and list at once.', 'One sheet, one level. With many lists it gets long.'],
    },
  },
  {
    id: 'SS2',
    set: 'ss',
    slug: 'lists-on-top',
    name: { de: 'Listen oben, Haushalte darunter', en: 'Lists on top, households below' },
    notes: {
      de: ['Oben „Listen in Brandt“: die Listen des angezeigten Haushalts mit „⋮“ und „Neue Liste“. Darunter das heutige Haushalt-Blatt unverändert.', 'Was man am häufigsten will (die Liste wechseln), steht zuerst; alles Heutige bleibt, wo es ist, nur tiefer.'],
      en: ['On top “Lists in Brandt”: the shown household’s lists with “⋮” and “New list”. Below it today’s household sheet, unchanged.', 'What people want most often (switch list) comes first; everything from today stays where it is, just lower.'],
    },
  },
  {
    id: 'SS3',
    set: 'ss',
    slug: 'two-tabs',
    name: { de: 'Zwei Reiter im Blatt', en: 'Two tabs in the sheet' },
    notes: {
      de: ['Oben im Blatt ein Hex-Umschalter „Listen | Haushalte“. „Haushalte“ ist das heutige Blatt, Zeile für Zeile. „Listen“ zeigt die Listen des angezeigten Haushalts mit „⋮“ und „Neue Liste“.', 'Das Blatt öffnet auf „Listen“. Wer nur einen Haushalt hat, sieht trotzdem beide Reiter, damit „Neuer Haushalt“ und „Mit Code beitreten“ zu finden bleiben.'],
      en: ['A hex switch “Lists | Households” on top of the sheet. “Households” is today’s sheet, row for row. “Lists” shows the shown household’s lists with “⋮” and “New list”.', 'The sheet opens on “Lists”. With one household both tabs still show, so “New household” and “Join with a code” stay findable.'],
    },
  },
  {
    id: 'SS4',
    set: 'ss',
    slug: 'chips-in-row',
    name: { de: 'Listen-Reiter in der Haushaltszeile', en: 'List chips in the household row' },
    notes: {
      de: ['Das heutige Blatt; die Zeile des angezeigten Haushalts trägt darunter die heutigen Listen-Reiter (Hex-Spur, gezeigte Liste in Honig, „+“).', 'Ein Tipp auf einen Reiter wechselt die Liste. „Listen verwalten“ öffnet im Blatt eine zweite Seite mit Umbenennen, Reihenfolge und Löschen.', 'Am kompaktesten: das Blatt wird 114 px höher, bei zwei Listen wie bei sieben. Lange Namen kürzt der Reiter ab 184 px, die Spur scrollt seitwärts.'],
      en: ['Today’s sheet; the shown household’s row carries today’s list tabs under it (hex track, shown list in honey, “+”).', 'A tap on a chip switches the list. “Manage lists” opens a second page in the sheet with rename, order and delete.', 'The most compact: the sheet grows by 114 px, with two lists as with seven. Long names are cut at 184 px per chip, and the track scrolls sideways.'],
    },
  },
  {
    id: 'SS5',
    set: 'ss',
    slug: 'drill-in',
    name: { de: 'Seiten zum Hineintippen', en: 'Drill-in pages' },
    notes: {
      de: ['Das Blatt öffnet auf der Seite des angezeigten Haushalts: oben „‹ Haushalte“, dann Name, Mitglieder, Einladen, darunter seine Listen mit „⋮“ und „Neue Liste“.', '„‹ Haushalte“ zeigt das heutige Blatt; ein Tipp auf einen Haushalt öffnet dessen Seite, erst die Wahl einer Liste wechselt.', 'Wie Konten und Postfächer in Mail: nie zu lang, aber ein Tipp mehr bis zum anderen Haushalt.'],
      en: ['The sheet opens on the shown household’s page: “‹ Households” on top, then the name, members and Invite, and its lists with “⋮” and “New list” below.', '“‹ Households” shows today’s sheet; a tap on a household opens its page, picking a list switches.', 'Like accounts and mailboxes in Mail: never too long, but one more tap to another household.'],
    },
  },
  {
    id: 'BB1',
    set: 'bb',
    slug: 'tight-stack',
    name: { de: 'Gleicher Aufbau, enger', en: 'Same stack, tighter' },
    notes: {
      de: ['Eingabefeld und Tab-Leiste bleiben zwei Teile, aber beide 48 px hoch mit 6 px Luft dazwischen, und die Leiste sitzt 20 px statt 26 px über dem Rand.', 'Nichts Neues zu lernen. Spart am wenigsten.'],
      en: ['Add field and tab bar stay two parts, both 48 px tall with 6 px between them, and the bar sits 20 px above the edge instead of 26.', 'Nothing new to learn. Saves the least.'],
    },
  },
  {
    id: 'BB2',
    set: 'bb',
    slug: 'field-and-icon-tabs',
    name: { de: 'Feld und Tab-Symbole in einer Zeile', en: 'Field and tab icons in one row' },
    notes: {
      de: ['Eine Zeile: das Eingabefeld mit Mikrofon, rechts daneben die drei Tabs als Symbole (48 × 48 px), der gezeigte in Honig. Die Namen hören Screenreader.', 'Mit Tastatur weichen die Symbole, das Feld wird breit. Auf Verlauf und Mehr zeigt die Zeile die Tabs mit Namen.', 'Spart am meisten; die Tabs haben aber keine Beschriftung mehr.'],
      en: ['One row: the add field with the mic, and to its right the three tabs as icons (48 × 48 px), the shown one in honey. Screen readers hear their names.', 'With the keyboard up the icons give way and the field goes wide. On History and More the row shows the tabs with names.', 'Saves the most; the tabs lose their labels though.'],
    },
  },
  {
    id: 'BB3',
    set: 'bb',
    slug: 'one-slab',
    name: { de: 'Ein Block aus Feld und Tabs', en: 'One block for field and tabs' },
    notes: {
      de: ['Feld und Tabs in einem gemeinsamen Hex-Block: oben das Feld, darunter die drei Tabs mit Namen, ohne eigene Kontur. Eine Kante statt zwei, weniger Luft.', 'Die Tabs behalten ihre Namen. Mit Tastatur bleibt nur die Feld-Zeile.'],
      en: ['Field and tabs in one hex block: the field on top, the three named tabs below it without a contour of their own. One edge instead of two, less air.', 'The tabs keep their names. With the keyboard up only the field row stays.'],
    },
  },
  {
    id: 'BB4',
    set: 'bb',
    slug: 'field-is-the-list-tab',
    name: { de: 'Das Feld ist der Liste-Tab', en: 'The field is the List tab' },
    notes: {
      de: ['Eine Tab-Leiste, deren Liste-Tab das Eingabefeld ist: „🛒 Was brauchst du? 🎤 | Verlauf | Mehr“. Auf Verlauf oder Mehr schrumpft das Feld zurück zum Tab „Liste“ mit Namen.', 'Eine Kontur, eine Zeile, so niedrig wie BB2. Verlauf und Mehr sind auf der Liste nur Symbole.'],
      en: ['One tab bar whose List tab is the add field: “🛒 What do you need? 🎤 | History | More”. On History or More the field shrinks back to a named “List” tab.', 'One contour, one row, as low as BB2. History and More are icons while on the list.'],
    },
  },
  {
    id: 'BB5',
    set: 'bb',
    slug: 'tabs-hide-on-scroll',
    name: { de: 'Tabs weichen beim Scrollen', en: 'Tabs step aside on scroll' },
    notes: {
      de: ['Im Ruhezustand wie heute. Wer nach unten scrollt, schiebt die Tab-Leiste weg, das Feld rutscht an ihren Platz. Zurückscrollen oder das Listenende holt sie wieder.', 'Spart nur beim Scrollen; oben in der Liste ist alles wie heute.'],
      en: ['At rest as today. Scrolling down slides the tab bar away and the field drops into its place. Scrolling back up or reaching the end brings it back.', 'Saves only while scrolling; at the top of the list it is as today.'],
    },
  },
  {
    id: 'LD4-3T',
    set: 'ld4',
    slug: 'bottom-dock-three-tabs',
    name: { de: 'LD4-Dock mit drei Tabs', en: 'LD4 dock with three tabs' },
    notes: {
      de: ['LD4s Dock als randlose Fläche unten: Eingabefeld mit Mikrofon, darunter die drei Tabs mit Namen, die Fläche reicht bis in den Home-Bereich.', 'Anders als in LD4 bleibt nichts im Griff-Blatt versteckt: Umschalter und Anpassen stehen in der festen Kopfzeile (B1, B2), die Summe als Zeile in der Liste (B4). Darum fällt der Griff weg.'],
      en: ['LD4’s dock as a full-bleed surface at the bottom: the add field with the mic, the three named tabs under it, the surface reaching into the home area.', 'Unlike LD4 nothing hides in the handle sheet: switcher and Edit sit in the fixed header (B1, B2), the total is a list row (B4). So the handle goes.'],
    },
  },
];

const stBase = {
  de: 'Peters Stil: das R2-Telefon (feste, durchscheinende Kopfzeile, Erste Schritte wie heute, Summe als Zeile über „Zuletzt verwendet“, unten wie heute, drei Tabs), der Umschalter öffnet SS5. Ohne Einkaufen-Frage (Job 217 ist nicht auf main). Eine Teilsumme zählt die Artikel mit Preis des Ladens, offen oder abgehakt (wie die Summe aus Job 190); „2 ohne Preis“ zählt seine offenen Artikel ohne Preis. Gewogenes zeigt den Zeilenbetrag. Bei nur einem Laden gibt es keine Teilsumme, nur die Summe.',
  en: 'Peter’s style: the R2 phone (fixed see-through header, First steps as today, the total as a row above “Recently used”, today’s bottom, three tabs); the switcher opens SS5. No shopping prompt (job 217 is not on main). A subtotal sums the store’s priced items, open or ticked (as job 190’s total); “2 unpriced” counts its open items without a price. Weighed items show the line total. With a single store there is no subtotal, only the total.',
};

export const stores = [
  {
    id: 'ST1',
    set: 'st',
    slug: 'subtotal-on-divider',
    name: { de: 'Teilsumme am Laden-Trenner', en: 'Subtotal on the store divider' },
    notes: {
      de: [stBase.de, 'Jeder Laden-Trenner trägt rechts seine Teilsumme, darüber klein „4 offen · 2 ohne Preis“. Am Ende die Zeile „Gesamt“ mit „3 Läden · 10 mit Preis · 4 ohne Preis“.', 'Ist ein Laden ganz abgehakt, bleibt sein Trenner mit „alles gekauft“ und der Teilsumme stehen, damit die Teilsummen die Gesamtsumme ergeben.', 'Der zweizeilige Trenner ist 44 statt 36 px hoch: bei 100 % oben eine Zeile weniger als R2 (5 statt 6). Die Teilsumme steht oben am Laden, die Gesamtsumme unten.'],
      en: [stBase.en, 'Each store divider carries its subtotal on the right, with “4 open · 2 unpriced” small above it. At the end the “Total” row with “3 stores · 10 priced · 4 unpriced”.', 'A store ticked off in full keeps its divider with “all bought” and the subtotal, so the subtotals add up to the total.', 'The two-line divider is 44 px, not 36: one row fewer than R2 at the top at 100 % (5 against 6). The subtotal sits at the store’s top, the total at the bottom.'],
    },
  },
  {
    id: 'ST2',
    set: 'st',
    slug: 'section-foot',
    name: { de: 'Summenzeile am Ende jedes Ladens', en: 'Sum line closing each store' },
    notes: {
      de: [stBase.de, 'Wie die heutige „Summe dm“-Zeile der App: unter dem letzten Artikel eines Ladens „Summe Lidl 10,05 €“, links „2 ohne Preis“. Der Trenner zeigt nur die Zahl offener Artikel.', 'Eingeklappt wandert die Teilsumme in den Trenner; ein ganz abgehakter Laden behält einen Trenner mit Teilsumme.', 'Liest sich wie ein Kassenbon je Laden. Kostet eine Zeile (32 px) je Laden.'],
      en: [stBase.en, 'Like the app’s “Total dm” line today: under a store’s last item “Total Lidl €10.05”, with “2 unpriced” on the left. The divider shows only the open count.', 'Folded, the subtotal moves into the divider; a store ticked off in full keeps a divider with its subtotal.', 'Reads like a receipt per store. Costs one line (32 px) per store.'],
    },
  },
  {
    id: 'ST3',
    set: 'st',
    slug: 'summary-block',
    name: { de: 'Übersicht über „Zuletzt verwendet“', en: 'Summary block above “Recently used”' },
    notes: {
      de: [stBase.de, 'Die Laden-Trenner bleiben wie in R2, nur mit Zahl. Wo R2 die Summen-Zeile hat, steht ein Block: „Einkaufssumme“, je Laden eine Zeile (Name, „2 ohne Preis“, Teilsumme), darunter „Gesamt“.', 'Ein Tipp auf eine Laden-Zeile springt zu ihrem Abschnitt. Ganz abgehakte Läden bleiben im Block mit „alles gekauft“.', 'Alle Zahlen an einer Stelle, untereinander zum Nachrechnen. Kostet eine Zeile (48 px) je Laden am Ende der Liste.'],
      en: [stBase.en, 'Store dividers stay as in R2, count only. Where R2 has its total row, a block: “Shopping total”, a line per store (name, “2 unpriced”, subtotal), then “Total”.', 'A tap on a store line jumps to its section. Stores ticked off in full stay in the block with “all bought”.', 'All numbers in one place, stacked to check. Costs one line (48 px) per store at the end of the list.'],
    },
  },
  {
    id: 'ST4',
    set: 'st',
    slug: 'expandable-total',
    name: { de: 'Summe zum Aufklappen', en: 'Total that unfolds' },
    notes: {
      de: [stBase.de, 'Eine Zeile wie in R2: „Gesamt 32,08 €“ mit „3 Läden · 10 mit Preis · 4 ohne Preis“ und einem Pfeil. Ein Tipp klappt darunter die Laden-Zeilen aus ST3 auf, ein zweiter wieder zu.', 'Zugeklappt so kompakt wie R2; die Teilsummen kosten einen Tipp.'],
      en: [stBase.en, 'One row as in R2: “Total €32.08” with “3 stores · 10 priced · 4 unpriced” and an arrow. A tap unfolds ST3’s store lines under it, a second tap folds them.', 'Folded, as compact as R2; the subtotals cost a tap.'],
    },
  },
  {
    id: 'ST5',
    set: 'st',
    slug: 'chip-line',
    name: { de: 'Laden-Chips unter der Summe', en: 'Store chips under the total' },
    notes: {
      de: [stBase.de, 'Unter der Summen-Zeile eine Reihe Hex-Chips „Lidl 10,05 €“, „dm 4,90 €“ …, die bei Bedarf umbricht. Ein Chip springt zu seinem Abschnitt. Lange Namen kürzt der Chip.', '„ohne Preis“ steht nur einmal in der Summen-Zeile, nicht je Laden. Kostet ein bis zwei Chip-Reihen (48 px je Reihe); drei Läden mit einem langen Namen brauchen zwei.'],
      en: [stBase.en, 'Under the total row a line of hex chips “Lidl €10.05”, “dm €4.90” …, wrapping when needed. A chip jumps to its section. Long names are cut in the chip.', '“unpriced” appears once in the total row, not per store. Costs one or two chip lines (48 px each); three stores with one long name take two.'],
    },
  },
];

export const allVariants = [...variants, ...round2, ...stores];
