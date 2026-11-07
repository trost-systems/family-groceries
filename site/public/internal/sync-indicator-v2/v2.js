'use strict';

// Approximate device geometry in points. `top` is the status bar / top safe area, `bottom` the home-indicator inset.
const DEVICES = {
  a: { name: 'iPhone 15', sub: 'Dynamic Island', os: 'ios', w: 393, h: 852, top: 59, bottom: 34, radius: 55, cutout: 'island' },
  b: { name: 'iPhone 14', sub: 'Notch', os: 'ios', w: 390, h: 844, top: 47, bottom: 34, radius: 47, cutout: 'notch' },
  c: { name: 'iPhone SE', sub: 'Status bar, no cutout', os: 'se', w: 375, h: 667, top: 20, bottom: 0, radius: 0, cutout: null },
  d: { name: 'Pixel 9', sub: 'Punch-hole camera', os: 'android', w: 412, h: 915, top: 48, bottom: 24, radius: 44, cutout: 'hole' },
  e: { name: 'Android', sub: 'No cutout (centred cutout: see Pixel 9)', os: 'android', w: 360, h: 800, top: 24, bottom: 24, radius: 22, cutout: null },
};

const PEEK_MS = 3000;
const RETRY_MS = 1200;
const BAR_H = 52;
const GAP = 8;

// S3: one entry per shape, geometry from the device. hw/hh: the hidden size it grows from; cw/ch: collapsed; fw/fh: expanded.
// pad: room above the expanded text (camera); push: how far the top bar and the list move down while it shows.
const S3_TYPES = {
  ears: (d) => ({ fill: 'black', layout: 'split', top: 11, hw: 126, hh: 37, cw: 236, ch: 37, cr: 19, fw: d.w - 24, fr: 40, pad: 54, push: 0 }),
  chin: (d) => ({ fill: 'black', layout: 'bottom', top: 11, hw: 126, hh: 37, cw: 156, ch: 64, cr: 24, fw: d.w - 24, fr: 40, pad: 54, push: 20 }),
  notch: (d) => ({ fill: 'black', layout: 'bottom', top: 0, hw: 162, hh: 32, cw: 168, ch: 64, cr: 22, fw: d.w - 24, fr: 36, pad: 44, push: 22, flatTop: true }),
  ring: (d) => ({ fill: 'black', layout: 'split', top: 6, hw: 30, hh: 30, cw: 172, ch: 36, cr: 18, fw: d.w - 24, fr: 36, pad: 46, push: 0 }),
  pseudo: (d) => {
    const inBar = d.os === 'android';
    const top = inBar ? 4 : d.top + 4;
    const push = top + 36 + GAP - (d.top + GAP);
    return { fill: 'black', layout: 'center', top, hw: 60, hh: 30, cw: 136, ch: 36, cr: 18, fw: d.w - 24, fr: 28, pad: 14, push };
  },
  tab: (d) => ({ fill: 'tone', layout: 'center', top: d.top, hw: 136, hh: 0, cw: 148, ch: 34, cr: 0, fw: d.w - 24, fr: 0, pad: 12, push: 34, tab: true }),
  hexcap: (d) => ({ fill: 'tone', layout: 'center', top: d.top + 6, hw: 80, hh: 24, cw: 150, ch: 36, cr: 0, fw: d.w - 24, fr: 0, pad: 0, push: 48, hex: true }),
};

const S3_HEIGHTS = {
  // Expanded height above `pad`, offline and failing (failing adds the retry row).
  black: { offline: 58, failing: 106 },
  tab: { offline: 64, failing: 112 },
  hexcap: { offline: 66, failing: 66 },
};

const L = (de, en) => ({ de, en });

const VARIANTS = [
  { id: 'S3-a1', group: 's3', dev: 'a', type: 'ears', name: L('Ohren an der Island', 'Ears on the island'), note: L('Die Island wird breiter: Icon links, Wort rechts, wie eine Live-Aktivität. Kompakt rückt nichts, die Uhr bleibt sichtbar. Beim Aufklappen wächst sie nach unten, und die Liste macht so lange Platz.', 'The island widens: icon left, word right, like a Live Activity. Collapsed, nothing moves and the clock stays visible. Opening grows it downwards, and the list makes room while it is open.') },
  { id: 'S3-a2', group: 's3', dev: 'a', type: 'chin', name: L('Kinn unter der Island', 'Chin under the island'), note: L('Runde 1: die Island bekommt ein Kinn mit Icon und Wort. Balken und Liste rücken 20 pt.', 'Round 1: the island grows a chin with icon and word. Bar and list move down 20 pt.') },
  { id: 'S3-a3', group: 's3', dev: 'a', type: 'hexcap', name: L('Hex-Kapsel darunter', 'Hex capsule below'), note: L('Eine eigene Hex-Kapsel oben mittig unter der Statusleiste, im App-Look statt Systemschwarz. Rückt 48 pt.', 'Its own hex capsule top centre below the status bar, in the app\'s look instead of system black. Moves the list 48 pt.') },
  { id: 'S3-b1', group: 's3', dev: 'b', type: 'notch', name: L('Notch wächst', 'Notch grows'), note: L('Die Notch zieht sich nach unten und zeigt Icon und Wort. Gleiche Idee wie S3-a2. Rückt 22 pt.', 'The notch extends downwards with icon and word. Same idea as S3-a2. Moves 22 pt.') },
  { id: 'S3-b2', group: 's3', dev: 'b', type: 'hexcap', name: L('Hex-Kapsel darunter', 'Hex capsule below'), note: L('Wie S3-a3: unabhängig von der Notch, auf jedem Gerät gleich.', 'Like S3-a3: independent of the notch, the same on every phone.') },
  { id: 'S3-c1', group: 's3', dev: 'c', type: 'pseudo', name: L('Schwarze Kapsel', 'Black capsule'), note: L('Ohne Cutout: eine schwarze Kapsel unter der 20-pt-Statusleiste, die so wächst wie die Island. Rückt 40 pt.', 'No cutout: a black capsule under the 20 pt status bar that grows like the island. Moves 40 pt.') },
  { id: 'S3-c2', group: 's3', dev: 'c', type: 'hexcap', name: L('Hex-Kapsel darunter', 'Hex capsule below'), note: L('Wie S3-a3.', 'Like S3-a3.') },
  { id: 'S3-c3', group: 's3', dev: 'c', type: 'tab', name: L('Lasche an der Statusleiste', 'Tab off the status bar'), note: L('Die Statusleiste nimmt die Farbe an, eine Lasche mit Hex-Schrägen hängt darunter. Symbole der Leiste hell oder dunkel nach Kontrast. Rückt 34 pt.', 'The status bar takes the colour and a tab with hex bevels hangs below it. Status icons light or dark by contrast. Moves 34 pt.') },
  { id: 'S3-d1', group: 's3', dev: 'd', type: 'ring', name: L('Kapsel um die Kamera', 'Capsule around the camera'), note: L('Eine schwarze Kapsel um das Kameraloch, Icon links, Wort rechts, in der Statusleiste. Kompakt rückt nichts; offen macht die Liste Platz.', 'A black capsule around the camera hole, icon left, word right, inside the status bar. Collapsed, nothing moves; open, the list makes room.') },
  { id: 'S3-d2', group: 's3', dev: 'd', type: 'tab', name: L('Lasche an der Statusleiste', 'Tab off the status bar'), note: L('Wie S3-c3, das Kameraloch sitzt in der gefärbten Leiste.', 'Like S3-c3; the camera hole sits in the coloured bar.') },
  { id: 'S3-d3', group: 's3', dev: 'd', type: 'hexcap', name: L('Hex-Kapsel darunter', 'Hex capsule below'), note: L('Wie S3-a3.', 'Like S3-a3.') },
  { id: 'S3-e1', group: 's3', dev: 'e', type: 'pseudo', name: L('Kapsel in der Statusleiste', 'Capsule in the status bar'), note: L('Die Mitte der Android-Leiste ist frei: eine schwarze Kapsel oben mittig, ragt 16 pt in die App.', 'The middle of the Android bar is free: a black capsule top centre that reaches 16 pt into the app.') },
  { id: 'S3-e2', group: 's3', dev: 'e', type: 'tab', name: L('Lasche an der Statusleiste', 'Tab off the status bar'), note: L('Wie S3-c3.', 'Like S3-c3.') },
  { id: 'S3-e3', group: 's3', dev: 'e', type: 'hexcap', name: L('Hex-Kapsel darunter', 'Hex capsule below'), note: L('Wie S3-a3.', 'Like S3-a3.') },

  ...[['a', 'Dynamic Island'], ['c', 'iPhone SE'], ['d', 'Pixel']].flatMap(([dev]) => [
    { id: `S1-${dev}1`, group: 's1', dev, tone: 't1', name: L('Navy und Gelb', 'Navy and yellow'), note: L('Offline navy, gestört gelb. Navy bekommt helle, Gelb dunkle Statussymbole.', 'Navy offline, yellow failing. Navy gets light status icons, yellow dark ones.') },
    { id: `S1-${dev}2`, group: 's1', dev, tone: 't2', name: L('Zarte Töne', 'Soft tints'), note: L('Helles Blau und helles Gelb, im Dunkelmodus die dunklen Varianten: die Symbole wechseln mit dem Thema.', 'Pale blue and pale yellow, their dark variants in dark mode: the icons flip with the theme.') },
    { id: `S1-${dev}3`, group: 's1', dev, tone: 't3', name: L('Kobalt und Tomate', 'Cobalt and tomato'), note: L('Die kräftigsten Töne. Tomate bekommt dunkle Schrift und dunkle Symbole (weiß hätte nur 3:1).', 'The loudest tones. Tomato gets dark text and dark icons (white would only reach 3:1).') },
  ]),

  { id: 'S2-C1F1', group: 's2', dev: 'a', trigger: 'C1', form: 'F1', name: L('3 s, dann Punkt', '3 s, then a dot'), note: L('Klappt nach 3 s zu einem Hex-Punkt oben links. Am ruhigsten, aber nur Farbe und Icon.', 'Collapses after 3 s into a hex dot top left. The calmest, but only colour and icon.') },
  { id: 'S2-C1F2', group: 's2', dev: 'a', trigger: 'C1', form: 'F2', name: L('3 s, dann Pille', '3 s, then a pill'), note: L('Nach 3 s eine kompakte Hex-Pille mit Icon und Wort oben links, im leeren Platz neben dem Balken.', 'After 3 s a compact hex pill with icon and word top left, in the empty space beside the bar.') },
  { id: 'S2-C3F2', group: 's2', dev: 'a', trigger: 'C3', form: 'F2', top: 2, name: L('3 s oder Scrollen, dann Pille', '3 s or scroll, then a pill'), note: L('Wie S2-C1F2, aber Scrollen oder Wischen nach oben klappt sofort zu: wer weiterliest, wird nicht aufgehalten.', 'Like S2-C1F2, but scrolling or swiping up collapses it at once: reading on is never blocked.') },
  { id: 'S2-C2F3', group: 's2', dev: 'a', trigger: 'C2', form: 'F3', name: L('Bis Scrollen, dann im Balken', 'Until scroll, then in the bar'), note: L('Bleibt offen, bis gescrollt oder nach oben gewischt wird, und zieht dann in den oberen Balken neben Anpassen.', 'Stays open until a scroll or swipe up, then moves into the top bar beside Edit.') },
  { id: 'S2-C3F3', group: 's2', dev: 'a', trigger: 'C3', form: 'F3', top: 1, name: L('3 s oder Scrollen, dann im Balken', '3 s or scroll, then in the bar'), note: L('Zieht nach 3 s oder beim Scrollen in den oberen Balken. Kein neues Objekt auf dem Bildschirm: der Zustand wohnt dort, wo heute die Wolke ist.', 'Moves into the top bar after 3 s or on scroll. No new object on screen: the state lives where the cloud is today.') },
  { id: 'S2-C1F4', group: 's2', dev: 'a', trigger: 'C1', form: 'F4', name: L('3 s, dann am Eingabefeld', '3 s, then on the add field'), note: L('Unten über dem Feld, nach 3 s ein kleiner Chip am Feldrand. Sagt nebenbei: Hinzufügen geht weiter.', 'Above the field, after 3 s a small chip on its edge. It also says: adding still works.') },
  { id: 'S2-C3F4', group: 's2', dev: 'a', trigger: 'C3', form: 'F4', top: 3, name: L('3 s oder Scrollen, dann am Feld', '3 s or scroll, then on the field'), note: L('Wie S2-C1F4 mit Scrollen. Unten ist der Daumen; oben bleibt die Liste frei.', 'Like S2-C1F4 with scroll. The thumb is at the bottom; the top of the list stays clear.') },
  { id: 'S2-C2F1', group: 's2', dev: 'a', trigger: 'C2', form: 'F1', name: L('Bis Scrollen, dann Punkt', 'Until scroll, then a dot'), note: L('Bleibt, bis man scrollt, dann ein Punkt. Deckt so lange die oberen Zeilen ab.', 'Stays until a scroll, then a dot. Covers the top rows until then.') },
];

const GROUPS = [
  { id: 's3', title: 'S3 Island capsule', lead: L('Peters Favorit. Eine Spalte pro Gerät, 2 bis 3 Formen je Gerät. Kapsel erst 3 s offen, dann kompakt; Tippen öffnet (offline) oder versucht erneut (gestört). Solange sie offen ist, macht die Liste Platz: keine offene Kapsel liegt über dem oberen Balken; die pt-Angaben gelten für die kompakte Form.', 'Peter\'s favourite. One column per device, 2 or 3 shapes each. The capsule opens for 3 s, then goes compact; a tap opens it (offline) or retries (failing). While it is open the list makes room, so no open capsule covers the top bar; the pt values are for the compact form.'), cols: ['a', 'b', 'c', 'd', 'e'] },
  { id: 's1', title: 'S1 Slim top banner', lead: L('Der Balken reicht hinter die Statusleiste. Die Symbole der Leiste (Uhr, Akku) werden hell oder dunkel, je nachdem, was auf der Bannerfarbe mehr Kontrast hat; der Wert steht unter jedem Telefon.', 'The banner runs behind the status bar. Its icons (clock, battery) go light or dark, whichever contrasts more with the banner colour; the value shows under each phone.'), cols: ['a', 'c', 'd'] },
  { id: 's2', title: 'S2 Floating hex snackbar', lead: L('Die Hex-Snackbar bleibt nicht groß. C1 = nach 3 s, C2 = beim Scrollen oder Wischen nach oben, C3 = beides. F1 Punkt, F2 Pille, F3 im oberen Balken, F4 Chip am Eingabefeld. Gestört: Tippen versucht erneut, Erfolg = verschwindet.', 'The hex snackbar doesn\'t stay big. C1 = after 3 s, C2 = on scroll or swipe up, C3 = either. F1 dot, F2 pill, F3 in the top bar, F4 chip on the add field. Failing: a tap retries, success = it leaves.'), cols: null },
];

const TEXT = {
  de: {
    list: 'Liste', more: 'Mehr', field: 'Was brauchst du?', edit: 'Anpassen', items: 'Artikel',
    offline: 'Offline', offlineWord: 'Offline',
    offlineLine: 'Änderungen werden synchronisiert, sobald du wieder online bist.',
    offlineShort: 'Offline · Änderungen warten auf Verbindung',
    failing: 'Sync gestört', failingWord: 'Gestört',
    failingLine: 'Deine Änderungen sind auf dem Gerät gespeichert.',
    failingShort: 'Sync gestört',
    retry: 'Erneut versuchen', retrying: 'Wird erneut versucht', details: 'Details anzeigen', hide: 'Ausblenden',
    synced: 'Synchronisiert', stillFailing: 'Immer noch gestört',
    statusLight: 'helle Statussymbole', statusDark: 'dunkle Statussymbole', semantics: 'Semantik',
    top: 'Top', recTitle: 'Empfehlung',
  },
  en: {
    list: 'List', more: 'More', field: 'What do you need?', edit: 'Edit', items: 'items',
    offline: 'Offline', offlineWord: 'Offline',
    offlineLine: 'Your changes will sync once you\'re back online.',
    offlineShort: 'Offline · changes wait for a connection',
    failing: 'Sync failing', failingWord: 'Failing',
    failingLine: 'Your changes are saved on this phone.',
    failingShort: 'Sync failing',
    retry: 'Try again', retrying: 'Trying again', details: 'Show details', hide: 'Hide',
    synced: 'Synced', stillFailing: 'Still failing',
    statusLight: 'light status icons', statusDark: 'dark status icons', semantics: 'Semantics',
    top: 'Top', recTitle: 'Recommendation',
  },
};

const REC = {
  de: [
    '<b>S2-C3F3 (Top 1).</b> Die Hex-Snackbar sagt beim ersten Mal den ganzen Satz und zieht dann in den oberen Balken, an die Stelle der heutigen Wolke. Kein neues Objekt, kein Rücken der Liste, gleich auf iOS, Android und im Web, und der Balken hat schon die Höhe für ein 44-pt-Ziel. Scrollen klappt sofort zu, sonst nach 3 s.',
    '<b>S3: S3-a1 auf dem iPhone mit Island, S3-d1 auf dem Pixel, sonst S3-x3 (Hex-Kapsel).</b> Die Ohren an der Island und die Kapsel um das Kameraloch rücken nichts und sehen nach Gerät aus; beide brauchen aber eine Weiche nach Cutout-Form und Position, die Flutter nur indirekt kennt (padding.top, displayFeatures auf Android). Wo es keinen passenden Cutout gibt, ist die Hex-Kapsel die einheitliche Form; sie kostet 48 pt.',
    '<b>S1 nur als Quick Win: S1-x1 (Navy/Gelb).</b> Am deutlichsten, Symbole hell auf Navy, dunkel auf Gelb, in beiden Themen AA. Kostet eine Zeile, solange offline, und ist das lauteste Signal für einen Zustand, in dem die App weiter funktioniert.',
    'Gegen C2 (S2-C2F3, S2-C2F1): die Karte bleibt offen, bis jemand scrollt, und deckt so lange die Überschrift des ersten Ladens und die erste Gruppe ab. Darum C3: dieselbe Wischgeste, aber nach 3 s geht sie auch von allein.',
    'Für alle: kein „Wieder online“ und kein „Synchronisiert“-Hinweis, der Indikator geht einfach. Screenreader hören „Synchronisiert“ als höfliche Ansage. Offline hat kein Erneut-Versuchen.',
  ],
  en: [
    '<b>S2-C3F3 (top 1).</b> The hex snackbar says the whole sentence once, then moves into the top bar where today\'s cloud sits. No new object, no list shift, the same on iOS, Android and the web, and the bar is already tall enough for a 44 pt target. Scrolling collapses it at once, otherwise after 3 s.',
    '<b>S3: S3-a1 on an iPhone with the island, S3-d1 on a Pixel, otherwise S3-x3 (hex capsule).</b> The island ears and the capsule around the camera hole move nothing and feel native; both need a switch on cutout shape and position that Flutter only knows indirectly (padding.top, displayFeatures on Android). Where no matching cutout exists the hex capsule is the one shape everywhere; it costs 48 pt.',
    '<b>S1 only as the quick win: S1-x1 (navy/yellow).</b> The clearest, light icons on navy, dark on yellow, AA in both themes. Costs a row while offline and is the loudest signal for a state in which the app keeps working.',
    'Against C2 (S2-C2F3, S2-C2F1): the card stays open until someone scrolls and covers the first store\'s header and first section until then. Hence C3: the same swipe, but it also leaves on its own after 3 s.',
    'For all: no "back online" and no "synced" notice, the indicator just leaves. Screen readers hear "Synced" as a polite announcement. Offline has no retry.',
  ],
};

const STORES = [
  { name: 'Lidl', sections: [
    { de: 'Obst & Gemüse', en: 'Produce', items: [['🍌', '6×', 'Bananen', 'Bananas'], ['🍎', '1 kg', 'Äpfel', 'Apples'], ['🥒', '', 'Gurke', 'Cucumber'], ['🍅', '500 g', 'Tomaten', 'Tomatoes']] },
    { de: 'Kühlregal', en: 'Chilled', items: [['🥛', '2×', 'Vollmilch', 'Whole milk'], ['🧈', '', 'Butter', 'Butter'], ['🥚', '10×', 'Eier', 'Eggs'], ['🧀', '', 'Gouda', 'Gouda']] },
    { de: 'Brot & Backwaren', en: 'Bakery', items: [['🥖', '4×', 'Brötchen', 'Rolls'], ['🍞', '', 'Vollkornbrot', 'Wholegrain bread']] },
  ] },
  { name: 'dm', sections: [
    { de: 'Drogerie', en: 'Toiletries', items: [['🪥', '', 'Zahnpasta', 'Toothpaste'], ['🧻', '', 'Küchenrolle', 'Paper towels'], ['🧴', '', 'Duschgel', 'Shower gel']] },
  ] },
];

// Material icons (24 px grid), the glyphs the app uses.
const ICON = {
  cartFilled: 'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z',
  menu: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
  mic: 'M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z',
  expand: 'M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z',
  cloudOff: 'M19.35 10.04C18.67 6.59 15.64 4 12 4c-1.48 0-2.85.43-4.01 1.17l1.46 1.46C10.21 6.23 11.08 6 12 6c3.04 0 5.5 2.46 5.5 5.5v.5H19c1.66 0 3 1.34 3 3 0 1.13-.64 2.11-1.56 2.62l1.45 1.45C23.16 18.16 24 16.68 24 15c0-2.64-2.05-4.78-4.65-4.96zM3 5.27l2.75 2.74C2.56 8.15 0 10.77 0 14c0 3.31 2.69 6 6 6h11.73l2 2L21 20.73 4.27 4 3 5.27zM7.73 10l8 8H6c-2.21 0-4-1.79-4-4s1.79-4 4-4h1.73z',
  syncProblem: 'M3 12c0 2.21.91 4.2 2.36 5.64L3 20h6v-6l-2.24 2.24C5.68 15.15 5 13.66 5 12c0-2.61 1.67-4.83 4-5.65V4.26C5.55 5.15 3 8.27 3 12zm8 5h2v-2h-2v2zM21 4h-6v6l2.24-2.24C18.32 8.85 19 10.34 19 12c0 2.61-1.67 4.83-4 5.65v2.09c3.45-.89 6-4.01 6-7.74 0-2.21-.91-4.2-2.36-5.64L21 4zm-10 9h2V7h-2v6z',
  sync: 'M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z',
  refresh: 'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
};

const state = { sync: 'online', outcome: 'ok', lang: 'de', theme: 'light', motion: 'full', size: 'fit' };
const byId = new Map(VARIANTS.map((v) => [v.id, v]));
const timers = new Map();

const icon = (name, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON[name]}"/></svg>`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// One span per kind; CSS shows the one matching the phone's data-kind.
const byKind = (offline, failing) => `<span class="k k--offline">${offline}</span><span class="k k--failing">${failing}</span>`;
// The state glyph; while a retry runs it turns into the spinning sync arrows.
const stateIcon = (cls = 'ic') => `<span class="si">${icon('cloudOff', `${cls} k k--offline`)}${icon('syncProblem', `${cls} k k--failing si__idle`)}${icon('sync', `${cls} si__busy`)}</span>`;

function geometry(d) {
  const pillBottom = Math.max(12, d.bottom - 10);
  return {
    barTop: d.top + GAP,
    listTop: d.top + GAP + BAR_H + GAP,
    pillBottom,
    fieldBottom: pillBottom + BAR_H + 12,
  };
}

function listPage(t, lang) {
  return STORES.map((store) => {
    const count = store.sections.reduce((n, s) => n + s.items.length, 0);
    const sections = store.sections.map((s) => {
      const rows = s.items.map(([emoji, qty, de, en]) =>
        `<div class="row"><span class="row__emoji">${emoji}</span><span class="row__name">${qty ? `<b>${esc(qty)}</b> ` : ''}${esc(lang === 'de' ? de : en)}</span></div>`).join('');
      return `<div class="section"><span>${esc(s[lang])}</span></div>${rows}`;
    }).join('');
    return `<div class="store"><span class="store__badge hx">${esc(store.name)}</span><span class="store__line"></span><span class="store__count"><b>${count}</b> ${t.items}</span>${icon('expand', 'ic ic--s')}</div>${sections}`;
  }).join('');
}

function statusBar(d) {
  const sig = '<i class="sig"></i>';
  const wifi = '<i class="wifi"></i>';
  const bat = '<i class="bat"></i>';
  if (d.os === 'se') return `<div class="status status--se"><span class="status__icons">${sig}${wifi}</span><span>9:41</span><span class="status__icons">${bat}</span></div>`;
  if (d.os === 'android') return `<div class="status status--android"><span>9:41</span><span class="status__icons">${wifi}${sig}${bat}</span></div>`;
  return `<div class="status status--ios"><span>9:41</span><span class="status__icons">${sig}${wifi}${bat}</span></div>`;
}

function cutout(d) {
  if (d.cutout === 'island') return '<div class="cut cut--island"></div>';
  if (d.cutout === 'notch') return '<div class="cut cut--notch"></div>';
  if (d.cutout === 'hole') return '<div class="cut cut--hole"></div>';
  return '';
}

// A transparent box around a tap target that is at least 44 x 44 pt; the shots script measures it.
const hit = '<span class="hitbox" aria-hidden="true"></span>';

function compactWord(t, short) {
  return short ? byKind(t.offlineWord, t.failingWord) : byKind(t.offline, t.failing);
}

function fullBody(t) {
  return `<span class="body"><strong>${byKind(t.offline, t.failing)}</strong><span>${byKind(esc(t.offlineLine), esc(t.failingLine))}</span></span>`;
}

function s1Indicator(t) {
  return `<div class="banner ind" data-tap>
    <div class="banner__row">${stateIcon('ic ic--m')}<span class="banner__text">${byKind(esc(t.offlineShort), esc(t.failingShort))}</span><span class="banner__act k k--failing">${icon('refresh', 'ic ic--s')}<span>${t.retry}</span></span>${hit}</div>
  </div>`;
}

function s2Indicator(v, t) {
  const small = v.form === 'F1'
    ? `<span class="mini__face hx">${stateIcon('ic ic--m')}</span>`
    : `<span class="mini__face hx">${stateIcon(v.form === 'F4' ? 'ic ic--s' : 'ic ic--m')}<span>${byKind(t.offline, t.failing)}</span></span>`;
  const mini = `<button type="button" class="mini mini--${v.form} ind-mini" data-tap>${small}${hit}</button>`;
  const snack = `<div class="snack hx ind" data-tap data-swipe>
    ${stateIcon()}${fullBody(t)}<span class="snack__retry hx k k--failing">${icon('refresh', 'ic ic--m')}</span>${hit}
  </div>`;
  return { snack, mini };
}

function s3Indicator(v, d, t) {
  const g = S3_TYPES[v.type](d);
  const hk = g.hex ? 'hexcap' : g.tab ? 'tab' : 'black';
  const fhOff = g.pad + S3_HEIGHTS[hk].offline;
  const fhFail = g.pad + S3_HEIGHTS[hk].failing;
  const style = [
    `--cap-top:${g.top}px`, `--hw:${g.hw}px`, `--hh:${g.hh}px`, `--cw:${g.cw}px`, `--ch:${g.ch}px`, `--cr:${g.cr}px`,
    `--fw:${g.fw}px`, `--fh-offline:${fhOff}px`, `--fh-failing:${fhFail}px`, `--fr:${g.fr}px`, `--pad:${g.pad}px`,
  ].join(';');
  const hx = g.hex ? ' hx' : '';
  const retry = g.hex
    ? `<span class="cap__retry hx k k--failing">${icon('refresh', 'ic ic--m')}</span>`
    : `<span class="cap__retry cap__retry--wide hx k k--failing">${icon('refresh', 'ic ic--s')}<span>${t.retry}</span></span>`;
  const short = v.type === 'ears' || v.type === 'ring';
  return `<div class="cap cap--${v.type} cap--${g.fill === 'black' ? 'black' : 'tone'}${g.tab ? ' cap--tab' : ''}${g.hex ? ' cap--hex' : ''} cap--${g.layout} ind" data-vars="${style}" data-tap>
    <div class="cap__bg${hx}"></div>
    <div class="cap__compact${hx}">${stateIcon('ic ic--s')}<span class="cap__word">${compactWord(t, short)}</span>${hit}</div>
    <div class="cap__full${hx}"><div class="cap__main">${stateIcon()}${fullBody(t)}</div>${retry}${hit}</div>
  </div>${g.tab ? '<div class="sbtint"></div>' : ''}`;
}

function phone(v) {
  const t = TEXT[state.lang];
  const d = DEVICES[v.dev];
  const geo = geometry(d);
  let push = 0;
  const pushOpen = { offline: 0, failing: 0 };
  let indicator = '';
  let barSeg = '';
  if (v.group === 's1') {
    push = 44;
    indicator = s1Indicator(t);
  } else if (v.group === 's2') {
    const { snack, mini } = s2Indicator(v, t);
    indicator = snack;
    if (v.form === 'F3') barSeg = mini; else indicator += mini;
  } else {
    const g = S3_TYPES[v.type](d);
    push = g.push;
    // While open, the list makes room for the open card, so it never covers the top bar.
    const hk = g.hex ? 'hexcap' : g.tab ? 'tab' : 'black';
    for (const kind of ['offline', 'failing']) {
      pushOpen[kind] = Math.max(push, g.top + g.pad + S3_HEIGHTS[hk][kind] - d.top);
    }
    indicator = s3Indicator(v, d, t);
  }
  const style = [
    `--w:${d.w}px`, `--h:${d.h}px`, `--top:${d.top}px`, `--bottom:${d.bottom}px`, `--radius:${d.radius}px`,
    `--bar-top:${geo.barTop}px`, `--list-top:${geo.listTop}px`, `--pill-bottom:${geo.pillBottom}px`, `--field-bottom:${geo.fieldBottom}px`, `--push:${push}px`, `--push-open-offline:${pushOpen.offline}px`, `--push-open-failing:${pushOpen.failing}px`,
  ].join(';');
  const attrs = [
    `data-variant="${v.id}"`, `data-group="${v.group}"`, `data-dev="${v.dev}"`, `data-os="${d.os}"`,
    v.tone ? `data-tone="${v.tone}"` : '', v.form ? `data-form="${v.form}"` : '', v.trigger ? `data-trigger="${v.trigger}"` : '',
    v.type ? `data-type="${v.type}"` : '',
  ].join(' ');
  return `<div class="phone" ${attrs} data-phase="hidden" data-kind="offline" data-net="on" data-vars="${style}">
    <div class="shift">
      <div class="content"><div class="page">${listPage(t, state.lang)}<div class="tail"></div></div></div>
      <div class="topbar hx">${barSeg}<span class="edit hx">${t.edit}</span></div>
    </div>
    <div class="sbbg"></div>
    ${indicator}
    ${statusBar(d)}
    ${cutout(d)}
    <div class="fade"></div>
    <div class="field hx"><span class="field__hint">${t.field}</span>${icon('mic')}</div>
    <nav class="pill hx"><span class="tab tab--on hx">${icon('cartFilled', 'ic ic--m')}<span>${t.list}</span></span><span class="tab">${icon('menu', 'ic ic--m')}<span>${t.more}</span></span></nav>
    ${d.os === 'se' ? '' : '<div class="home"></div>'}
    <div class="live" aria-live="polite"></div>
  </div>`;
}

const reduced = () => state.motion === 'reduced';

// ---- The per-phone state machine. Phases: hidden, open (expanded), rest (collapsed), busy (retrying). ----

function canCollapse(v) { return v.group !== 's1'; }
function collapsesOn(v, cause) {
  if (v.group === 's3') return cause === 'timer';
  if (v.group !== 's2') return false;
  if (cause === 'timer') return v.trigger !== 'C2';
  return v.trigger !== 'C1';
}

function next(v, s, ev) {
  switch (ev.type) {
    case 'sync':
      if (ev.sync === 'online') return { phase: 'hidden', kind: s.kind };
      return { phase: canCollapse(v) ? 'open' : 'rest', kind: ev.sync };
    case 'timer':
    case 'scroll':
      return s.phase === 'open' && collapsesOn(v, ev.type) ? { ...s, phase: 'rest' } : s;
    case 'tap':
      if (s.phase === 'busy' || s.phase === 'hidden') return s;
      if (s.kind === 'failing') return { ...s, phase: 'busy' };
      if (!canCollapse(v)) return s;
      return { ...s, phase: s.phase === 'open' ? 'rest' : 'open' };
    case 'done':
      if (s.phase !== 'busy') return s;
      return ev.ok ? { ...s, phase: 'hidden' } : { ...s, phase: 'rest', nudge: true };
    default:
      return s;
  }
}

function later(ph, ms, ev) {
  clearTimeout(timers.get(ph));
  timers.set(ph, setTimeout(() => send(ph, ev), ms));
}

function send(ph, ev) {
  const v = byId.get(ph.dataset.variant);
  const before = { phase: ph.dataset.phase, kind: ph.dataset.kind };
  const after = next(v, before, ev);
  if (after.phase === before.phase && after.kind === before.kind && !after.nudge) return;
  clearTimeout(timers.get(ph));
  const shift = ph.querySelector('.shift');
  const shiftY = () => new DOMMatrixReadOnly(getComputedStyle(shift).transform).m42;
  const shiftBefore = shiftY();
  ph.dataset.phase = after.phase;
  ph.dataset.kind = after.kind;
  ph.dataset.net = ev.type === 'sync' ? (ev.sync === 'offline' ? 'off' : 'on') : ph.dataset.net;
  // Reduced motion: the list can't slide to its new place, so it fades in there instead of jumping.
  if (reduced() && shiftY() !== shiftBefore) ph.dataset.refade = ph.dataset.refade === 'a' ? 'b' : 'a';
  if (after.phase === 'open' && collapsesOn(v, 'timer')) later(ph, PEEK_MS, { type: 'timer' });
  if (after.phase === 'busy') {
    ph.dataset.from = before.phase;
    later(ph, RETRY_MS, { type: 'done', ok: state.outcome === 'ok' });
  }
  if (after.nudge) {
    ph.dataset.nudge = '0';
    requestAnimationFrame(() => { ph.dataset.nudge = '1'; });
  }
  const t = TEXT[state.lang];
  if (ev.type === 'done') ph.querySelector('.live').textContent = ev.ok ? t.synced : t.stillFailing;
  if (ev.type === 'sync') ph.querySelector('.live').textContent = '';
  updateA11y(ph);
  updateStatusIcons(ph);
}

// ---- Semantics: every tappable part gets a label for the state it is in. ----

function labelFor(ph) {
  const t = TEXT[state.lang];
  const { phase, kind } = ph.dataset;
  if (phase === 'busy') return `${t.retrying}`;
  if (kind === 'failing') return `${t.failing}. ${t.failingLine} ${t.retry}`;
  if (phase === 'rest' && canCollapse(byId.get(ph.dataset.variant))) return `${t.offline}. ${t.details}`;
  return `${t.offline}. ${t.offlineLine}`;
}

function updateA11y(ph) {
  const { phase, kind } = ph.dataset;
  const label = labelFor(ph);
  const actionable = kind === 'failing' || (phase !== 'hidden' && canCollapse(byId.get(ph.dataset.variant)));
  ph.querySelectorAll('[data-tap]').forEach((el) => {
    const visible = phase !== 'hidden' && isFormVisible(ph, el);
    el.setAttribute('aria-hidden', String(!visible));
    if (!visible) { el.removeAttribute('role'); el.removeAttribute('aria-label'); el.tabIndex = -1; return; }
    el.setAttribute('role', actionable ? 'button' : 'status');
    el.setAttribute('aria-label', label);
    el.tabIndex = actionable ? 0 : -1;
    if (phase === 'busy') el.setAttribute('aria-busy', 'true'); else el.removeAttribute('aria-busy');
    if (kind === 'offline' && canCollapse(byId.get(ph.dataset.variant))) el.setAttribute('aria-expanded', String(phase === 'open'));
    else el.removeAttribute('aria-expanded');
  });
  const out = ph.closest('.frame').querySelector('.frame__a11y');
  if (out) out.textContent = phase === 'hidden' ? '—' : `"${label}"`;
}

// In S2 the snackbar and the collapsed form are separate elements; only one carries semantics at a time.
function isFormVisible(ph, el) {
  if (ph.dataset.group !== 's2') return true;
  const { phase, from } = ph.dataset;
  const open = phase === 'open' || (phase === 'busy' && from === 'open');
  return el.classList.contains('snack') ? open : !open;
}

// ---- Status bar icon brightness: what SystemUiOverlayStyle the app would set, from the colour behind the bar. ----

function rgb(css) {
  const hex = css.trim().match(/^#([0-9a-f]{6})$/i);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
  const m = css.match(/[\d.]+/g);
  return m ? m.slice(0, 3).map(Number) : [255, 255, 255];
}
function luminance([r, g, b]) {
  const f = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
function overlayFor(bgCss) {
  const bg = rgb(bgCss);
  const light = contrast([255, 255, 255], bg);
  const dark = contrast([0, 0, 0], bg);
  return light >= dark ? { icons: 'light', ratio: light } : { icons: 'dark', ratio: dark };
}

// The target colour, not the painted one: the banner and tint animate their colour.
function behindStatusBar(ph) {
  const shown = ph.dataset.phase !== 'hidden';
  const css = getComputedStyle(ph);
  if (shown && ph.dataset.group === 's1') return css.getPropertyValue('--bn-bg');
  if (shown && ph.querySelector('.sbtint')) return css.getPropertyValue('--tone-bg');
  return css.getPropertyValue('--c-surface');
}

function updateStatusIcons(ph) {
  const o = overlayFor(behindStatusBar(ph));
  ph.dataset.icons = o.icons;
  const out = ph.closest('.frame').querySelector('.frame__status');
  if (out) {
    const t = TEXT[state.lang];
    out.textContent = `${o.icons === 'light' ? t.statusLight : t.statusDark} · SystemUiOverlayStyle.${o.icons} · ${o.ratio.toFixed(1)}:1`;
  }
}

// ---- Rendering ----

function frame(v) {
  const d = DEVICES[v.dev];
  const lang = state.lang;
  const top = v.top ? `<span class="top3">★ ${TEXT[lang].top} ${v.top}</span>` : '';
  const status = v.group === 's1' || v.type === 'tab' ? '<p class="frame__status"></p>' : '';
  return `<figure class="frame" data-id="${v.id}" data-vars="--pw:${d.w}px;--ph:${d.h}px">
    <figcaption><span class="label">${v.id}</span>${top}<span class="fname">${esc(v.name[lang])}</span></figcaption>
    <div class="viewport">${phone(v)}</div>
    <p class="frame__note">${esc(v.note[lang])}</p>
    ${status}
    <p class="frame__a11y-row"><span>${TEXT[lang].semantics}:</span> <span class="frame__a11y">—</span></p>
  </figure>`;
}

function group(g) {
  const lang = state.lang;
  const vs = VARIANTS.filter((v) => v.group === g.id);
  let grid;
  if (g.cols) {
    const head = g.cols.map((c, i) => `<div class="colhead" data-vars="grid-column:${i + 1};grid-row:1"><b>${DEVICES[c].name}</b><span>${DEVICES[c].sub}</span></div>`).join('');
    const cells = vs.map((v) => {
      const col = g.cols.indexOf(v.dev) + 1;
      const row = Number(v.id.slice(-1)) + 1;
      return `<div class="cell" data-vars="grid-column:${col};grid-row:${row}">${frame(v)}</div>`;
    }).join('');
    grid = `<div class="grid" data-vars="--cols:${g.cols.length}">${head}${cells}</div>`;
  } else {
    grid = `<div class="grid grid--flow">${vs.map((v) => `<div class="cell">${frame(v)}</div>`).join('')}</div>`;
  }
  return `<h2>${g.title}</h2><p class="group__lead">${esc(g.lead[lang])}</p>${grid}`;
}

function render() {
  const html = document.documentElement;
  html.lang = state.lang;
  html.dataset.theme = state.theme;
  html.dataset.size = state.size;
  html.dataset.motion = state.motion;
  html.dataset.settled = '0';
  const kept = new Map([...document.querySelectorAll('.phone')].map((ph) => [ph.dataset.variant, { phase: ph.dataset.phase, from: ph.dataset.from }]));
  document.querySelectorAll('.phone').forEach((ph) => { clearTimeout(timers.get(ph)); timers.delete(ph); });
  for (const g of GROUPS) document.getElementById(g.id).innerHTML = group(g);
  document.getElementById('rec-body').innerHTML = REC[state.lang].map((p) => `<p>${p}</p>`).join('');
  // The CSP forbids style attributes; geometry rides in data-vars and goes in through the CSSOM.
  document.querySelectorAll('[data-vars]').forEach((el) => {
    for (const decl of el.dataset.vars.split(';')) {
      const i = decl.indexOf(':');
      el.style.setProperty(decl.slice(0, i), decl.slice(i + 1));
    }
  });
  layout();
  document.querySelectorAll('.phone').forEach((ph) => {
    const before = kept.get(ph.dataset.variant);
    if (state.sync !== 'online') {
      ph.dataset.kind = state.sync;
      ph.dataset.net = state.sync === 'offline' ? 'off' : 'on';
      ph.dataset.phase = before && before.phase !== 'hidden' ? before.phase : 'rest';
      if (before?.from) ph.dataset.from = before.from;
      const v = byId.get(ph.dataset.variant);
      if (ph.dataset.phase === 'busy') later(ph, RETRY_MS, { type: 'done', ok: state.outcome === 'ok' });
      if (ph.dataset.phase === 'open' && collapsesOn(v, 'timer')) later(ph, PEEK_MS, { type: 'timer' });
    }
    updateA11y(ph);
    updateStatusIcons(ph);
    ph.querySelector('.content').addEventListener('scroll', onScroll, { passive: true });
  });
  document.querySelectorAll('.hx').forEach((el) => hexObserver.observe(el));
  requestAnimationFrame(() => requestAnimationFrame(() => { html.dataset.settled = '1'; }));
}

// Fit: the S3 grid's five columns fill the width; every phone uses the same scale so sizes compare.
function layout() {
  const vw = document.documentElement.clientWidth;
  let s = 1;
  if (state.size !== 'real') {
    const pad = vw < 720 ? 12 : 24;
    const cols = vw < 720 ? 2 : 5;
    const gap = vw < 720 ? 12 : 20;
    s = Math.min(1, (vw - 2 * pad - (cols - 1) * gap) / cols / 412);
  }
  document.documentElement.style.setProperty('--s', s.toFixed(4));
}

// Hex shapes: pointed ends with the token tip ratio and rounded corners, redrawn whenever a box resizes.
const TIP = 0.2887;
function hexPath(w, h, inset, r) {
  const tip = Math.min(h * TIP, w / 2);
  const pts = [[tip, 0], [w - tip, 0], [w, h / 2], [w - tip, h], [tip, h], [0, h / 2]]
    .map(([x, y]) => [inset + x * (w - 2 * inset) / w, inset + y * (h - 2 * inset) / h]);
  let dd = '';
  pts.forEach((p, i) => {
    const prev = pts[(i + pts.length - 1) % pts.length];
    const nxt = pts[(i + 1) % pts.length];
    const toward = (a, b, len) => {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l = Math.hypot(dx, dy);
      const k = Math.min(len, l / 2) / l;
      return [a[0] + dx * k, a[1] + dy * k];
    };
    const a = toward(p, prev, r);
    const b = toward(p, nxt, r);
    dd += `${i ? 'L' : 'M'}${a[0].toFixed(2)} ${a[1].toFixed(2)}Q${p[0].toFixed(2)} ${p[1].toFixed(2)} ${b[0].toFixed(2)} ${b[1].toFixed(2)}`;
  });
  return `${dd}Z`;
}

const hexObserver = new ResizeObserver((entries) => {
  for (const e of entries) {
    const el = e.target;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (!w || !h) continue;
    let svg = el.querySelector(':scope > svg.hexbg');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'hexbg');
      svg.setAttribute('aria-hidden', 'true');
      svg.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'path'));
      el.prepend(svg);
    }
    const sw = parseFloat(getComputedStyle(el).getPropertyValue('--hx-sw')) || 0;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.firstChild.setAttribute('d', hexPath(w, h, sw / 2, 8 * Math.min(h, 48) / 48));
  }
});

// ---- Input ----

const lastScroll = new WeakMap();
function onScroll(ev) {
  const content = ev.currentTarget;
  const prev = lastScroll.get(content) ?? 0;
  if (Math.abs(content.scrollTop - prev) < 12) return;
  lastScroll.set(content, content.scrollTop);
  send(content.closest('.phone'), { type: 'scroll' });
}

// A swipe up on the open card collapses it. Pointer capture keeps the gesture on the card when the finger
// or mouse leaves it; touch-action: none on .snack stops the browser taking the pan (pointercancel).
const swipe = new WeakMap();
document.addEventListener('pointerdown', (ev) => {
  const el = ev.target.closest('[data-swipe]');
  if (!el) return;
  el.setPointerCapture(ev.pointerId);
  el.dataset.swiped = '0';
  swipe.set(el, ev.clientY);
});
document.addEventListener('pointermove', (ev) => {
  const el = ev.target.closest('[data-swipe]');
  if (!el || !swipe.has(el) || ev.clientY - swipe.get(el) > -20) return;
  swipe.delete(el);
  el.dataset.swiped = '1';
  send(el.closest('.phone'), { type: 'scroll' });
});
const endSwipe = (ev) => {
  const el = ev.target.closest('[data-swipe]');
  if (el) swipe.delete(el);
};
document.addEventListener('pointerup', endSwipe);
document.addEventListener('pointercancel', endSwipe);

function setControl(control, value) {
  state[control] = value;
  document.querySelectorAll(`[data-control=${control}] button`).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === value)));
}

document.addEventListener('click', (ev) => {
  const seg = ev.target.closest('.seg button');
  if (seg) {
    const control = seg.parentElement.dataset.control;
    setControl(control, seg.dataset.value);
    if (control === 'sync') document.querySelectorAll('.phone').forEach((ph) => send(ph, { type: 'sync', sync: state.sync }));
    else if (control === 'outcome') return;
    else if (control === 'theme') { document.documentElement.dataset.theme = state.theme; document.querySelectorAll('.phone').forEach(updateStatusIcons); }
    else if (control === 'motion') document.documentElement.dataset.motion = state.motion;
    else if (control === 'size') layout();
    else render();
    return;
  }
  const act = ev.target.closest('[data-action]');
  if (act) {
    const phones = document.querySelectorAll('.phone');
    if (act.dataset.action === 'replay') {
      phones.forEach((ph) => send(ph, { type: 'sync', sync: 'online' }));
      if (state.sync !== 'online') requestAnimationFrame(() => requestAnimationFrame(() => phones.forEach((ph) => send(ph, { type: 'sync', sync: state.sync }))));
    } else {
      phones.forEach((ph) => {
        const c = ph.querySelector('.content');
        c.scrollTo({ top: c.scrollTop > 60 ? 0 : 140, behavior: reduced() ? 'auto' : 'smooth' });
      });
    }
    return;
  }
  const tap = ev.target.closest('[data-tap]');
  if (tap) {
    if (tap.dataset.swiped === '1') { tap.dataset.swiped = '0'; return; }
    send(tap.closest('.phone'), { type: 'tap' });
  }
});

document.addEventListener('keydown', (ev) => {
  if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('[data-tap][role=button]')) {
    ev.preventDefault();
    send(ev.target.closest('.phone'), { type: 'tap' });
  }
});

if (document.documentElement.clientWidth < 720) setControl('size', 'real');
if (matchMedia('(prefers-reduced-motion: reduce)').matches) setControl('motion', 'reduced');
if (matchMedia('(prefers-color-scheme: dark)').matches) setControl('theme', 'dark');

addEventListener('resize', layout);
render();
