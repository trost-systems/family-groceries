// The app icon variations (job 45). One record per icon:
//   bg:     elements behind everything, drawn over a full-bleed `bg` fill (Icon Composer's
//           background fill, visionOS's back layer, Android's background layer)
//   layers: up to two foreground groups (Icon Composer groups, visionOS middle and front,
//           merged into Android's foreground)
// An element is { shape, role, mono } (shape from geom.mjs). `role` names a colour in `colors.light`/`colors.dark`
// (null = monochrome-only helper). `mono` builds the one-colour layer (Android monochrome,
// Apple tinted and clear previews) in element order: 'fill' adds the shape, 'cut' removes it
// from everything so far, 'skip' leaves it out.
// Coordinates are a 1024 canvas = Android's 72 dp visible area; Android's 108 dp canvas adds
// 256 units on every side, so backgrounds are drawn from -256 to 1280.
import { merge, intersect, hex, check, letterH, roundRect, circle, bar, rotatePoints, roundedPolygon } from './geom.mjs';

export const PALETTES = {
  hex: { honey: '#ffc72c', ink: '#1c1a17', cream: '#fff8e6', honeySoft: '#fde7a6', violet: '#5a3fae', violetSoft: '#e5dcff', night: '#16131f', nightRaised: '#221e2e', white: '#ffffff', brand: '#8a5800' },
  frische: { cobalt: '#1b3fae', cobaltField: '#2448c0', cobaltLight: '#9fb6ff', lemon: '#ffe24a', mint: '#7fe3b8', mintDark: '#62c99d', lemonDark: '#e8cb3c', navy: '#0f1530', deep: '#0b1024', paper: '#f7f7f2', white: '#ffffff', tomato: '#ff5b3a' },
};
const H = PALETTES.hex;
const F = PALETTES.frische;

const C = 512;
const fill = (shape, role) => ({ shape, role, mono: 'fill' });
const cut = (shape, role) => ({ shape, role, mono: 'cut' });
const skip = (shape, role) => ({ shape, role, mono: 'skip' });

// Honeycomb background: soft hex cells over the whole 108 dp canvas.
function comb(R, gap) {
  const out = [];
  const w = Math.sqrt(3) * R;
  for (let row = -4; row <= 9; row++) {
    for (let col = -3; col <= 8; col++) {
      const x = col * w + (row % 2 ? w / 2 : 0);
      const y = row * 1.5 * R;
      out.push(hex(x, y, R - gap, 1 / 6));
    }
  }
  return merge(...out);
}

const tileStack = rotatePoints([[300, 330], [770, 330], [770, 800], [300, 800]], 9);
const tileGap = rotatePoints([[278, 308], [792, 308], [792, 822], [278, 822]], 9);

export const VARIATIONS = [
  {
    n: 1, slug: 'wabe-haken', name: 'Wabe mit Haken', family: 'hex',
    why: 'Die 3b-Wabe als Fläche, ein Haken für die erledigte Liste.',
    colors: { light: { bg: H.honey, hex: H.ink, mark: H.honey }, dark: { bg: H.night, hex: H.honey, mark: H.night } },
    bg: [],
    layers: [
      { name: 'Wabe', els: [fill(hex(C, C, 360), 'hex')] },
      { name: 'Haken', els: [cut(check(330, 400, 360, 96), 'mark')] },
    ],
  },
  {
    n: 2, slug: 'waben-h', name: 'Waben-H', family: 'hex',
    why: 'Das H von Hummlist in einer Honigwabe auf Wabenmuster.',
    colors: { light: { bg: H.cream, comb: H.honeySoft, hex: H.honey, mark: H.ink }, dark: { bg: H.night, comb: H.nightRaised, hex: H.honey, mark: H.night } },
    bg: [skip(comb(120, 14), 'comb')],
    layers: [
      { name: 'Wabe', els: [fill(hex(C, C, 380), 'hex')] },
      { name: 'H', els: [cut(letterH(C, C, 330, 360, 104, 92, 18), 'mark')] },
    ],
  },
  {
    n: 3, slug: 'wabenliste', name: 'Wabenliste', family: 'hex',
    why: 'Die Einkaufsliste in der Wabe: ein Haken, zwei offene Zeilen.',
    colors: { light: { bg: H.ink, hex: H.honey, mark: H.ink }, dark: { bg: H.night, hex: H.honey, mark: H.night } },
    bg: [],
    layers: [
      { name: 'Wabe', els: [fill(hex(C, C, 390), 'hex')] },
      { name: 'Liste', els: [
        cut(check(318, 330, 120, 46), 'mark'), cut(bar(500, 392, 700, 58), 'mark'),
        cut(bar(330, 512, 700, 58), 'mark'), cut(bar(330, 632, 610, 58), 'mark'),
      ] },
    ],
  },
  {
    n: 4, slug: 'streifenwabe', name: 'Streifenwabe', family: 'hex',
    why: 'Zwei Honigstreifen auf Tinte: Hummel ohne Figur.',
    colors: { light: { bg: H.honey, hex: H.ink, mark: H.honey }, dark: { bg: H.night, hex: H.honey, mark: H.night } },
    bg: [],
    layers: [
      { name: 'Wabe', els: [fill(hex(C, C, 370), 'hex')] },
      { name: 'Streifen', els: [cut(intersect(bar(100, 420, 924, 92, -24), hex(C, C, 369)), 'mark'), cut(intersect(bar(100, 600, 924, 92, -24), hex(C, C, 369)), 'mark')] },
    ],
  },
  {
    n: 5, slug: 'wabenstapel', name: 'Wabenstapel', family: 'hex',
    why: 'Drei Ebenen ineinander: gemacht für Glas und visionOS-Tiefe.',
    colors: { light: { bg: H.violet, outer: H.honey, inner: H.cream, mark: H.ink }, dark: { bg: H.night, outer: H.honey, inner: H.nightRaised, mark: H.honey } },
    bg: [],
    layers: [
      { name: 'Wabe außen', els: [fill(hex(C, C, 380), 'outer'), cut(hex(C, C, 250), null)] },
      { name: 'Wabe innen', els: [skip(hex(C, C, 230), 'inner'), fill(check(406, 452, 212, 66), 'mark')] },
    ],
  },
  {
    n: 6, slug: 'sprechwabe', name: 'Sprechwabe', family: 'hex',
    why: 'Wabe als Sprechblase: Siri und Alexa schreiben mit.',
    colors: { light: { bg: H.honey, hex: H.ink, mark: H.honey }, dark: { bg: H.night, hex: H.honey, mark: H.night } },
    bg: [],
    layers: [
      { name: 'Sprechwabe', els: [fill(roundedPolygon([[300, 690], [250, 880], [470, 760]], 30), 'hex'), fill(hex(C, 470, 360), 'hex')] },
      { name: 'Stimme', els: [[350, 240], [290, 360], [370, 200]].map(([y, h], i) => cut(roundRect(398 + i * 92, y, 64, h, 32), 'mark')) },
    ],
  },
  {
    n: 7, slug: 'drei-waben', name: 'Drei Waben', family: 'hex',
    why: 'Ein kleiner Wabenverbund, eine Zelle ist abgehakt.',
    colors: { light: { bg: H.cream, hex: H.honey, top: H.ink, mark: H.honey }, dark: { bg: H.night, hex: H.honey, top: H.white, mark: H.night } },
    bg: [],
    layers: [
      { name: 'Waben', els: [fill(hex(C - 160, 620, 170), 'hex'), fill(hex(C + 160, 620, 170), 'hex')] },
      { name: 'Haken-Wabe', els: [fill(hex(C, 345, 170), 'top'), cut(check(C - 92, 290, 184, 52), 'mark')] },
    ],
  },
  {
    n: 8, slug: 'flugbahn', name: 'Flugbahn', family: 'hex',
    why: 'Die gepunktete Flugbahn aus 3b landet in der Wabe.',
    colors: { light: { bg: H.ink, dots: H.honeySoft, hex: H.honey, mark: H.ink }, dark: { bg: H.night, dots: H.violetSoft, hex: H.honey, mark: H.night } },
    bg: [],
    layers: [
      { name: 'Flugbahn', els: [[170, 330, 30], [230, 245, 32], [318, 190, 34], [420, 175, 36], [520, 200, 38]].map(([x, y, r]) => fill(circle(x, y, r), 'dots')) },
      { name: 'Wabe', els: [fill(hex(590, 590, 290), 'hex'), cut(check(470, 520, 240, 74), 'mark')] },
    ],
  },
  {
    n: 9, slug: 'mint-block', name: 'Mint-Block', family: 'frische',
    why: 'Frische auf das Nötigste: ein Farbblock, ein Haken.',
    colors: { light: { bg: F.cobalt, block: F.mint, mark: F.navy }, dark: { bg: F.deep, block: F.mint, mark: F.deep } },
    bg: [],
    layers: [
      { name: 'Block', els: [fill(roundRect(242, 242, 540, 540, 120), 'block')] },
      { name: 'Haken', els: [cut(check(360, 400, 300, 92), 'mark')] },
    ],
  },
  {
    n: 10, slug: 'zettel', name: 'Zettel', family: 'frische',
    why: 'Der Einkaufszettel, schräg auf Mint, mit Kobalt-Haken.',
    colors: { light: { bg: F.mint, note: F.white, mark: F.cobalt, line: F.navy }, dark: { bg: F.deep, note: F.mintDark, mark: F.deep, line: F.deep } },
    bg: [],
    layers: [
      { name: 'Zettel', els: [fill(roundedPolygon(rotatePoints([[280, 220], [744, 220], [744, 804], [280, 804]], -6), 64), 'note')] },
      { name: 'Zeilen', els: [
        cut(check(370, 352, 110, 44, -6), 'mark'),
        ...[[408, 520, 650], [528, 380, 650], [648, 380, 590]].map(([y, a, b]) => cut(bar(a, y, b, 50, -6), 'line')),
      ] },
    ],
  },
  {
    n: 11, slug: 'block-h', name: 'Block-H', family: 'frische',
    why: 'Das H aus zwei Farbblöcken, wie die Kacheln von Frische.',
    colors: { light: { bg: F.navy, left: F.mint, right: F.lemon, cross: F.white }, dark: { bg: F.deep, left: F.mintDark, right: F.lemon, cross: F.paper } },
    bg: [],
    layers: [
      { name: 'Blöcke', els: [fill(roundRect(250, 232, 190, 560, 56), 'left'), fill(roundRect(584, 232, 190, 560, 56), 'right')] },
      { name: 'Steg', els: [fill(roundRect(330, 452, 364, 120, 40), 'cross')] },
    ],
  },
  {
    n: 12, slug: 'sprechblase', name: 'Sprechblase', family: 'frische',
    why: 'Kobalt-Blase auf Mint: Sag es, es steht auf der Liste.',
    colors: { light: { bg: F.mint, bubble: F.cobalt, mark: F.white }, dark: { bg: F.deep, bubble: F.mint, mark: F.deep } },
    bg: [],
    layers: [
      { name: 'Blase', els: [fill(roundedPolygon([[330, 640], [290, 850], [520, 700]], 34), 'bubble'), fill(roundRect(222, 230, 580, 470, 150), 'bubble')] },
      { name: 'Haken', els: [cut(check(372, 330, 280, 88), 'mark')] },
    ],
  },
  {
    n: 13, slug: 'kachelstapel', name: 'Kachelstapel', family: 'frische',
    why: 'Zwei gekippte Kacheln übereinander: zwei Leute, eine Liste.',
    colors: { light: { bg: F.navy, back: F.mint, front: F.white, mark: F.cobalt }, dark: { bg: F.deep, back: F.mintDark, front: F.paper, mark: F.cobalt } },
    bg: [],
    layers: [
      { name: 'Kachel hinten', els: [fill(roundRect(250, 210, 470, 470, 100, -10), 'back'), cut(roundedPolygon(tileGap, 116), null)] },
      { name: 'Kachel vorn', els: [fill(roundedPolygon(tileStack, 100), 'front'), cut(check(415, 490, 240, 76), 'mark')] },
    ],
  },
  {
    n: 14, slug: 'frische-wabe', name: 'Frische Wabe', family: 'merge',
    why: 'Die Verbindung von 3b und 5: Kobalt-Wabe auf Mint, der Haken ausgestanzt.',
    colors: { light: { bg: F.mint, hex: F.cobalt, mark: F.mint }, dark: { bg: F.deep, hex: F.mint, mark: F.deep } },
    bg: [],
    layers: [
      { name: 'Wabe', els: [fill(hex(C, C, 370), 'hex')] },
      { name: 'Haken', els: [cut(check(336, 404, 352, 96), 'mark')] },
    ],
  },
  {
    n: 15, slug: 'doppelhaken', name: 'Doppelhaken', family: 'frische',
    why: 'Zwei Haken versetzt: ihr hakt gemeinsam ab.',
    colors: { light: { bg: F.paper, back: F.mint, front: F.cobalt }, dark: { bg: F.deep, back: F.mintDark, front: F.cobaltLight } },
    bg: [],
    layers: [
      { name: 'Haken hinten', els: [fill(check(300, 300, 400, 100), 'back')] },
      { name: 'Haken vorn', els: [fill(check(330, 470, 400, 100), 'front')] },
    ],
  },
  {
    n: 16, slug: 'frische-h', name: 'Frische H-Wabe', family: 'merge',
    why: 'Mint-Wabe mit Navy-H auf Kobalt: die Verbindung, als Monogramm.',
    colors: { light: { bg: F.cobalt, hex: F.mint, mark: F.navy }, dark: { bg: F.deep, hex: F.mint, mark: F.deep } },
    bg: [],
    layers: [
      { name: 'Wabe', els: [fill(hex(C, C, 380), 'hex')] },
      { name: 'H', els: [cut(letterH(C, C, 330, 360, 104, 92, 18), 'mark')] },
    ],
  },
];


export const FAMILIES = { hex: '3b Hex Weich', frische: '5 Frische', merge: '3b × 5' };

// The three picks with real layered assets: why each, and what it looks like (alt text).
export const TOP = [
  {
    n: 5,
    reason: 'Die einzige Variante, deren Ebenen schon die Idee sind: außen die Honigwabe, innen die helle Wabe mit dem Haken. Auf Liquid Glass und in visionOS bekommt jede Ebene ihre eigene Tiefe. Das Violett aus 3b macht sie im Raster unverwechselbar, und bei 16 px bleibt ein Ring mit Punkt in der Mitte.',
    look: 'honiggelber Wabenring auf Violett, darin eine cremefarbene Wabe mit dunklem Haken',
  },
  {
    n: 14,
    reason: 'Die Verbindung von 3b und 5 in ihrer klarsten Form: die Wabe als Marke, die Frische-Farben als Stimmung. Kobalt auf Mint ist hell und freundlich und weit weg vom Discounter-Blau-Gelb-Rot. Zwei Ebenen, ein ausgestanzter Haken, bei 16 px noch eindeutig.',
    look: 'kobaltblaue Wabe mit ausgestanztem mintfarbenem Haken auf Mint',
  },
  {
    n: 13,
    reason: 'Der stärkste reine Frische-Entwurf: zwei gekippte Kacheln erzählen „ihr teilt eine Liste“, ohne Wort und ohne Figur. Die vordere Kachel schwebt über der hinteren, das trägt die Tiefe von Glas und visionOS. Navy hält Mint und Weiß ruhig.',
    look: 'eine mintfarbene und eine weiße Kachel übereinander, gekippt, auf Navy, mit kobaltblauem Haken',
  },
];

// Job 48: the three favourites in option 5's original colours (cobalt field, lemon, white,
// like 5's own mark), at Peter's request. Same records, so the same shapes and layers by
// reference; only `colors` changes. `allowLidlLike` lifts the "not Lidl" colour guard in
// render.mjs for these records only: Peter said the Lidl likeness is fine (2026-10-31).
// `pairs` are the colour roles that touch in the art, for the contrast table.
const original = (n) => VARIATIONS.find((v) => v.n === n);
export const ORIGINAL5 = [
  {
    ...original(5), n: '5o', basedOn: 5, slug: 'wabenstapel-original5', allowLidlLike: true,
    colors: { light: { bg: F.cobalt, outer: F.lemon, inner: F.white, mark: F.cobalt }, dark: { bg: F.deep, outer: F.lemonDark, inner: F.cobaltLight, mark: F.deep } },
    pairs: [['bg', 'outer'], ['bg', 'inner'], ['inner', 'mark']],
    small: 'Bei 29 pt und 48 dp liest sich der Haken klar. Bei 16 px bleibt ein Zitronenring mit weißem Kern und blauem Punkt, heller und lauter als das Original auf Violett.',
    reason: 'Zitronenring auf Kobalt, darin die weiße Wabe mit dem Kobalt-Haken: genau die drei Farben der Frische-Marke. Die Ebenen bleiben die Idee: Ring, Wabe und Haken bekommen in Glas und visionOS je ihre eigene Tiefe.',
    look: 'zitronengelber Wabenring auf Kobalt, darin eine weiße Wabe mit kobaltblauem Haken',
  },
  {
    ...original(13), n: '13o', basedOn: 13, slug: 'kachelstapel-original5', allowLidlLike: true,
    colors: { light: { bg: F.cobalt, back: F.lemon, front: F.white, mark: F.cobalt }, dark: { bg: F.deep, back: F.lemonDark, front: F.paper, mark: F.cobaltField } },
    pairs: [['bg', 'back'], ['bg', 'front'], ['front', 'mark']],
    small: 'Bei 29 pt und 48 dp sind beide Kacheln und der Haken da. Bei 16 px bleibt eine weiße Kachel mit gelber Ecke auf Kobalt, der Haken wird zum Strich; die gelbe Ecke trägt mehr als die Mint-Ecke des Originals.',
    reason: 'Die Zitronenkachel hinten, die weiße vorn, beide auf dem Kobaltblock der Frische-Startseite. Auf Kobalt statt Navy wird das Icon lauter und eindeutig Frische.',
    look: 'eine zitronengelbe und eine weiße Kachel übereinander, gekippt, auf Kobalt, mit kobaltblauem Haken',
  },
  {
    ...original(14), n: '14o', basedOn: 14, slug: 'frische-wabe-original5', allowLidlLike: true,
    colors: { light: { bg: F.cobalt, hex: F.lemon, mark: F.cobalt }, dark: { bg: F.deep, hex: F.lemonDark, mark: F.deep } },
    pairs: [['bg', 'hex'], ['hex', 'mark']],
    small: 'Das klarste der drei: der ausgestanzte Haken bleibt bei 29 pt, 48 dp und sogar 16 px lesbar, Zitrone auf Kobalt trägt mehr als Kobalt auf Mint.',
    reason: 'Die Zitronenwabe auf Kobalt, der Haken ausgestanzt: die einfachste Form der Frische-Marke. Nur zwei Farben, darum bei 16 px das klarste der drei.',
    why: 'Die Verbindung von 3b und 5 in den Originalfarben von 5: Zitronenwabe auf Kobalt, der Haken ausgestanzt.',
    look: 'zitronengelbe Wabe mit ausgestanztem kobaltblauem Haken auf Kobalt',
  },
];
