// The six app captures every proposal frames, and where the point of each sits in it.
// Captures are 1080 x 2400 from the web release build with the play-listing demo household
// (job 65, "Unser Haushalt", Anna and Jonas, generic stores only: Legal N-23). `lift` is the row
// (and columns) a caption points at, in capture pixels measured from the pixels; frames that show
// part of a screen crop around it at clean cuts (kit.mjs windowFor).

export const LOCALE = 'de-DE';

export const SHOTS = {
  list: { raw: 'p1.png', lift: { y: [1608, 1988] }, alt: 'Gemeinsame Einkaufsliste mit Läden; zwei Einträge von Anna sind gelb markiert.' },
  sync: {
    raw: 'p2-anna.png',
   
    lift: { y: [1608, 1751] },
    sender: { raw: 'p2-jonas.png', y: [1724, 1900], x: [40, 1030] },
    alt: 'Links trägt Jonas Butter ein, rechts erscheint sie sofort gelb markiert auf Annas Liste.',
  },
  tick: { raw: 'p3-t1.png', lift: { y: [396, 548] }, alt: 'Ein Eintrag wird mit einem Tipp abgehakt und grün durchgestrichen.' },
  order: { raw: 'p4.png', lift: { y: [706, 890] }, alt: 'Die Kategorien im Supermarkt werden per Halten und Ziehen in die eigene Reihenfolge gebracht.' },
  add: { raw: 'p5.png', lift: { y: [1458, 1634] }, alt: 'Beim Tippen von „3 Jogh“ schlägt Hummlist „3× Joghurt“ aus früheren Einkäufen vor.' },
  invite: { raw: 'p6.png', lift: { y: [780, 1200], x: [60, 1020] }, alt: 'Einladung mit Link und Code, um Partner, Familie oder WG in den Haushalt zu holen.' },
};

export const FEATURE_CROP = { raw: 'fg-crop.png', w: 1080, h: 1090 };

// FG1, approved by Peter on 2026-11-01 ("fine for now").
export const TAGLINE = 'Eine Einkaufsliste, die der ganze Haushalt mitsummt.';
