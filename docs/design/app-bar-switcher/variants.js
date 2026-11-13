// The five approaches plus today's bar, with the notes the single view shows.

export const variants = [
  {
    id: 'current',
    n: 0,
    short: 'Heute',
    title: 'Heute: Haushalts-Chip, darunter die Listen-Reihe',
    notes: `<p>Referenz. Der Haushalts-Chip öffnet das Haushalts-Blatt, die Listen stehen ab zwei Listen in einer eigenen Reihe unter der Kopfzeile. Diese Reihe kostet 52 px Höhe. Wie in der App weicht der Chip, wenn die Zeile zu schmal wird (320 px, große Schrift, offline), und die Sync-Pille zeigt dann nur ihr Symbol.</p>
      <p>Lange Namen: der Chip kürzt den Haushalt am Ende, die Listen-Reihe scrollt seitlich.</p>`,
  },
  {
    id: 'breadcrumb-in-bar',
    n: 1,
    short: 'Brotkrumen',
    title: 'Brotkrumen in der Kopfzeile',
    notes: `<p>Peters Skizze: ein Hex-Pfad „Trost › Geburtstag“ links von Anpassen. Haushalt und Liste sind zwei Ziele. Tippen auf den Haushalt öffnet das Blatt bei den Haushalten, Tippen auf die Liste bei den Listen.</p>
      <p><b>Lange Namen.</b> Der Haushalt bekommt höchstens 40 % des Pfads, die Liste den Rest, beide werden am Ende gekürzt. Der Haushalt behält immer zwei Buchstaben und „…“, die Liste einen. Wird es dafür zu eng (offline bei 320 px, mit großer Schrift und langen Namen schon bei 360 px), fällt der Pfeil zwischen beiden weg. Das Blatt zeigt oben den ganzen Pfad, umbrochen.</p>
      <p><b>Blatt.</b> Ein Blatt mit zwei Teilen: Listen im Haushalt, darunter die Haushalte wie heute.</p>
      <p><b>Sync.</b> Offline wird die Sync-Pille ein Symbol ohne Wort.</p>
      <p><b>Dafür.</b> Am nächsten an der Skizze, liest sich als Ort. <b>Dagegen.</b> Zwei kleine Ziele in 52 px (Haushalt 36 px hoch, Liste 32 px; empfohlen sind 48 px); der Haushalt wird schon früh gekürzt (in 8 von 12 gemessenen Fällen); bei 320 px bleiben von einem kurzen Namen nur zwei Buchstaben, mit großer Schrift und offline auch von der Liste nur einer („Tr… G…“).</p>`,
  },
  {
    id: 'stacked-two-line',
    n: 2,
    short: 'Zwei Zeilen',
    title: 'Zwei Zeilen: Haushalt klein über der Liste',
    notes: `<p>Ein erhabener Hex-Knopf wie Anpassen. Oben klein und leise der Haushalt mit Haus-Symbol, darunter fett die Liste. Ein Ziel, ein Tipp öffnet das Blatt.</p>
      <p><b>Lange Namen.</b> Jede Zeile bekommt die ganze Breite des Knopfs und wird für sich am Ende gekürzt. Die Liste, die man lesen will, verliert nichts an den Haushalt.</p>
      <p><b>Blatt.</b> Oben die Haushalte als Hex-Chips, darunter die Listen des gewählten. Ein anderer Haushalt zeigt erst seine Listen; gewechselt wird mit dem Tipp auf eine Liste (oder den Haushalt nochmal). So landet man direkt in der richtigen Liste.</p>
      <p><b>Sync.</b> Offline ein Symbol zwischen Knopf und Anpassen.</p>
      <p><b>Dafür.</b> Kurze Namen bleiben am längsten ganz (8 von 12 gemessenen Fällen), die Liste ist das Wichtigste, gleiche Höhe wie heute die Kopfzeile allein. <b>Dagegen.</b> Zwei kleine Zeilen in 52 px; bei großer Schrift wird die obere eng (130 % passt noch).</p>`,
  },
  {
    id: 'single-chip-truncate',
    n: 3,
    short: 'Ein Chip',
    title: 'Ein Chip, in der Mitte gekürzt',
    notes: `<p>Ein flacher Hex-Chip auf einer Zeile: „Geburtstag · Trost“. Die Liste fett, der Haushalt leise dahinter.</p>
      <p><b>Lange Namen.</b> Kürzung in der Mitte, damit Anfang und Ende stehen bleiben („Geburtstags…Samstag · Wohnge…links“). Die Liste hat Vorrang: der Haushalt behält nur, was sie übrig lässt, mindestens zwei Buchstaben und „…“. Der Chip bekommt nur die Breite, die Sync-Symbol und Anpassen übrig lassen; darum kürzt er „Geburtstag“ schon bei 390 px mit großer Schrift und offline. Wird es noch enger, fallen Pfeil und Punkt weg.</p>
      <p><b>Blatt.</b> Alle Listen aller Haushalte in einer Liste, nach Haushalt gruppiert. Ein Tipp springt überall hin, auch in einen anderen Haushalt.</p>
      <p><b>Dafür.</b> Am kompaktesten, ein Ziel, kürzester Weg zu jeder Liste. <b>Dagegen.</b> Mittel-Kürzung bei zwei Namen liest sich schwer; der Haushalt wirkt wie ein Anhang.</p>`,
  },
  {
    id: 'list-first-chip',
    n: 4,
    short: 'Liste zuerst',
    title: 'Liste als Titel, Haushalt als Marke davor',
    notes: `<p>Die Liste steht groß wie ein Seitentitel in der Kopfzeile, davor eine kleine Hex-Marke mit dem Haushaltsnamen. Zwei Ziele: Titel öffnet die Listen, die Marke die Haushalte.</p>
      <p><b>Lange Namen.</b> Der Titel schrumpft von 22 auf 16 px und wird dann am Ende gekürzt; die Marke höchstens 34 % breit, am Ende gekürzt. Die Marke behält immer zwei Buchstaben und „…“, der Titel einen; reicht das nicht, fällt sein Pfeil weg.</p>
      <p><b>Blatt.</b> Zwei Seiten: erst die Listen, unten „Haushalt: Trost, wechseln ›“, das zur Haushalts-Seite führt (mit Zurück).</p>
      <p><b>Dafür.</b> Die Liste ist klar die Überschrift der Seite. <b>Dagegen.</b> Ein Titel ohne Knopf-Rahmen sieht weniger tippbar aus; die Haushalts-Marke ist nur 26 px hoch (empfohlen 48 px); Haushalt wechseln braucht zwei Schritte.</p>`,
  },
  {
    id: 'hide-household-when-solo',
    n: 5,
    short: 'Ohne Haushalt bei einem',
    title: 'Haushalt nur bei mehreren Haushalten',
    notes: `<p>Die PM-Idee, zum Vergleich: wer nur einen Haushalt hat, sieht nur die Liste. Ab zwei Haushalten sieht die Kopfzeile aus wie Variante 2.</p>
      <p><b>Lange Namen.</b> Allein bekommt die Liste die ganze Breite; mit mehreren Haushalten wie Variante 2.</p>
      <p><b>Blatt.</b> Zwei Reiter: Listen und Haushalte.</p>
      <p><b>Dafür.</b> Am ruhigsten für die vielen mit einem Haushalt. <b>Dagegen.</b> Die Kopfzeile ändert ihr Aussehen, sobald jemand einer zweiten Gruppe beitritt; der Weg zu „Neuer Haushalt“ und „Mit Code beitreten“ ist versteckter; und wer nur einen Haushalt sieht, lernt nicht, wo Siri und Alexa hinschreiben.</p>`,
  },
];

export const recommendation = `<h2>Empfehlung: Variante 2, zwei Zeilen, Haushalt immer sichtbar</h2>
<p>Haushalt klein und leise oben, die Liste fett darunter, in einem erhabenen Hex-Knopf links von Anpassen. Ein Tipp öffnet ein Blatt mit den Haushalten als Chips oben und den Listen des gewählten Haushalts darunter. Die zweite Listen-Reihe fällt weg. Der Kopf schrumpft von 120 px auf 68 px, sobald es zwei Listen gibt.</p>
<h3>Warum diese</h3>
<p>Sie hält kurze Namen am längsten ganz. Gemessen mit drei Haushalten („Trost“, „Geburtstag“) bei 390, 360 und 320 px, normaler und großer Schrift (130 %), online und offline, also 12 Fälle: Zwei Zeilen zeigt beide Namen in 8 Fällen ganz, Liste zuerst in 7, Brotkrumen und Ein Chip in je 4. Bei 390 px, großer Schrift und offline ist der Zwei-Zeilen-Knopf (Varianten 2 und 5) der einzige, der „Geburtstag“ nicht kürzt. Bei 320 px, großer Schrift und offline kürzt jede Variante beide Namen. Jede Zeile hat die ganze Knopfbreite für sich, die Liste muss also nicht mit dem Haushalt um Platz streiten; der Haushalt bleibt in 11 der 12 Fälle ganz.</p>
<p>Es gibt nur ein Ziel. Ein großer Knopf ist leichter zu treffen als zwei kleine Brotkrumen in 52 px.</p>
<p>Das Blatt führt mit zwei Tipps zur richtigen Liste in einem anderen Haushalt. Den Haushalt antippen zeigt dessen Listen, dann die Liste antippen. Wer nur den Haushalt wechseln will, tippt ihn ein zweites Mal an.</p>
<h3>Immer zeigen statt nur bei mehreren Haushalten</h3>
<p>Immer zeigen. Gründe:</p>
<p>(a) Die Kopfzeile sieht dann gleich aus, egal ob jemand einen oder drei Haushalte hat. Mit Variante 5 springt sie um, sobald man einer zweiten Gruppe beitritt.</p>
<p>(b) Der Haushaltsname ist der sichtbare Weg zu „Neuer Haushalt“ und „Mit Code beitreten“.</p>
<p>(c) Siri, Alexa und KI schreiben in den Standard-Haushalt, nicht in den gerade angezeigten (FINDINGS households-vs-lists). Wer den Namen immer sieht, merkt eher, wo er gerade ist.</p>
<p>Variante 5 spart bei einem Haushalt nur eine kleine Zeile im selben 52-px-Knopf. Höhe spart sie nicht.</p>
<h3>Lange Namen</h3>
<p>In der Kopfzeile wird jede Zeile für sich am Ende gekürzt („Wohngemeinschaft Kastan…“ über „Geburtstagsfeier für O…“). Eine Kürzung in der Mitte (Variante 3) liest sich bei zwei Namen schlecht, also keine.</p>
<p>Lange Namen kürzt jede Variante in der Kopfzeile. Im Blatt stehen alle Namen ganz, so viele Zeilen wie nötig, mit Silbentrennung; auch die Haushalts-Chips und die Überschrift „Listen in …“. Gemessen in allen fünf Blättern, auf jeder Seite, bei 390 und 320 px, normaler und großer Schrift. Ein Tipp auf den Knopf zeigt also immer den vollen Namen.</p>
<h3>Übernehmen aus den anderen</h3>
<p>Aus 1: Das Blatt öffnet sich immer bei den Listen. Aus 3: Wer viele Haushalte hat, könnte alle Listen gruppiert sehen. Das lohnt erst ab drei oder mehr Haushalten, also vorerst nicht.</p>
<p>Wechselt man den Haushalt, erscheint ein kurzer Hinweis: „Angezeigt: WG. Siri, Alexa &amp; KI bleiben bei Trost.“ Der Wechsel ändert den Standard nie. Die Zeile „Siri, Alexa &amp; KI nutzen“ bleibt im Blatt wie heute.</p>
<h3>Sync-Pille</h3>
<p>In allen fünf Varianten zeigt die Pille offline nur noch ihr Symbol zwischen Umschalter und Anpassen. Ein Tipp zeigt die Zeile wie heute. Sonst ist kein Platz für zwei Namen.</p>
<h3>Offen für Peter</h3>
<p>Soll das Blatt die Haushalte als Chips oben zeigen (Variante 2) oder als Zeilen unter den Listen wie heute (Variante 1)? Bei bis zu drei Haushalten sind Chips schneller. Bei vielen langen Namen sind Zeilen ruhiger.</p>
<p class="note">Nur Prototypen. Keine App-Änderung, erfundene Daten.</p>`;
