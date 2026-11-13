// The six app captures every proposal frames, and where the point of each sits in it. capture.mjs
// takes them from the Snacklist web release build (1080 x 2400; household „Unser Haushalt“ with
// Anna and Jonas, generic stores only: Legal N-23) and measures the rows each caption points at
// (`lift`), the top of the floating add bar and tab bar (`chrome`) and the sync scene's band out
// of the partner's phone (`sender`), in capture pixels, into raw/<locale>/meta.json.
import { readFileSync } from 'node:fs';
import { cuts, rawPath } from './kit.mjs';

export const LOCALE = 'de-DE';

const meta = JSON.parse(readFileSync(new URL(`raw/${LOCALE}/meta.json`, import.meta.url), 'utf8'));

const ALT = {
  list: 'Gemeinsame Einkaufsliste nach Läden; zwei neue Einträge von Anna sind gelb markiert.',
  sync: 'Jonas trägt Kaffee ein, und auf Annas Liste erscheint er sofort gelb markiert im Supermarkt.',
  tick: 'Ein Eintrag wird mit einem Tipp abgehakt und grün durchgestrichen.',
  order: 'Die Kategorien im Supermarkt werden per Halten und Ziehen in die eigene Reihenfolge gebracht.',
  add: 'Beim Tippen von „3 Jogh“ schlägt Snacklist „Joghurt · 3“ aus früheren Einkäufen vor.',
  invite: 'Einladung mit Link und Code, um Partner, Familie oder WG in den Haushalt zu holen.',
};

// A full-width row keeps no columns, so frames that lift it keep their own gutters.
const rows = ({ x, ...band }) => (x[0] <= 0 && x[1] >= 1080 ? band : { ...band, x });
export const SHOTS = Object.fromEntries(Object.entries(ALT).map(([key, alt]) => [key, { ...meta[key], lift: rows(meta[key].lift), alt }]));

// The top of the list down to the first clean line below Anna's two new, tinted items, for the
// feature graphics.
const listCuts = cuts(rawPath(LOCALE, meta.list.raw), meta.list.chrome);
export const FEATURE_CROP = { raw: meta.list.raw, w: 1080, h: listCuts.find((y) => y > meta.list.lift.y[1]), lift: meta.list.lift };

// FG2, approved by Peter on 2026-11-01 (site/content/landing/copy.yml hero.title).
export const TAGLINE = 'Gemeinsam einkaufen, ohne Werbung.';
