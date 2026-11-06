'use strict';

const PHONE = { w: 390, h: 844 };
const FLASH_MS = 1600;
const PEEK_MS = 3200;

const VARIANTS = [
  {
    id: 'current',
    name: 'Current',
    note: {
      de: 'Heute: eine Wolke im oberen Balken neben Anpassen. Offline durchgestrichen, ausstehende Änderungen mit Pfeil; die Erklärung nur als Tooltip. Ein Fehler, der bleibt, sieht aus wie "wird synchronisiert".',
      en: 'Today: a cloud in the top bar next to Edit. Struck through offline, an arrow while changes are pending; the explanation only as a tooltip. A failure that persists looks like "syncing".',
    },
  },
  {
    id: 's1',
    name: 'S1 Top banner',
    note: {
      de: 'Schmaler Balken direkt unter der Statusleiste, schiebt Balken und Liste 36 pt nach unten. Offline in Navy, Fehler in Gelb mit "Erneut versuchen". Am deutlichsten, kostet eine Zeile.',
      en: 'A slim bar right under the status bar that pushes the top bar and the list down 36 pt. Navy when offline, yellow with "Try again" when failing. The clearest, costs one row.',
    },
  },
  {
    id: 's2',
    name: 'S2 Floating card',
    note: {
      de: 'Karte im Stil der Tipp-Karten, schwebt unter dem oberen Balken über der Liste und bleibt, solange offline. Platz für den ganzen Satz und den Knopf; deckt aber die obersten Zeilen ab.',
      en: 'A card in the tip cards\' style that floats under the top bar over the list and stays while offline. Room for the whole sentence and the button, but it covers the top rows.',
    },
  },
  {
    id: 's3',
    name: 'S3 Island',
    note: {
      de: 'Schwarze Kapsel, die aus der Dynamic Island wächst, 3 s den Satz zeigt und dann als kurzes Kinn mit Icon und Wort unter der Island bleibt; Tippen klappt sie wieder auf. Das Kinn reicht bis unter die Oberkante des oberen Balkens: Balken und Liste rücken dafür 20 pt nach unten (beim Aufklappen deckt die Kapsel den Balken kurz ab). Die App kann nicht in die echte Island zeichnen: das ist eine eigene Kapsel darüber, auf Android und im Web oben mittig.',
      en: 'A black capsule that grows out of the Dynamic Island, shows the sentence for 3 s, then stays as a short chin under the island with an icon and one word; a tap opens it again. The chin reaches below the top bar\'s top edge, so the bar and the list move down 20 pt while it shows (expanded, the capsule briefly covers the bar). The app can\'t draw into the real island: this is its own capsule on top, top centre on Android and the web.',
    },
  },
  {
    id: 's4',
    name: 'S4 Add field',
    note: {
      de: 'Das Eingabefeld zeigt den Zustand: Wolken-Icon vorne, getönte Fläche, der Satz klein über dem Feld. Sagt nebenbei, dass Hinzufügen offline weiter geht. Oben bleibt alles ruhig.',
      en: 'The add field carries the state: a cloud icon in front, a tinted face, the sentence small above the field. It also says that adding still works offline. The top stays calm.',
    },
  },
  {
    id: 's5',
    name: 'S5 Tab pill',
    note: {
      de: 'Die Tab-Pille bekommt ein drittes Segment mit Icon und einem Wort. Der Satz erscheint 3 s als Blase über dem Feld und wieder beim Tippen. Am unauffälligsten; leicht zu übersehen.',
      en: 'The tab pill gets a third segment with an icon and one word. The sentence shows as a bubble above the field for 3 s and again on tap. The quietest; easy to miss.',
    },
  },
];

const TEXT = {
  de: {
    list: 'Liste', more: 'Mehr', field: 'Was brauchst du?', edit: 'Anpassen', items: 'Artikel',
    offline: 'Offline',
    offlineLine: 'Änderungen werden synchronisiert, sobald du wieder online bist.',
    offlineFull: 'Offline – Änderungen werden synchronisiert, sobald du wieder online bist.',
    failing: 'Sync gestört',
    failingLine: 'Deine Änderungen sind auf dem Gerät gespeichert und gehen nicht verloren.',
    failingFull: 'Sync gestört – deine Änderungen sind auf dem Gerät gespeichert.',
    offlineShort: 'Offline · Änderungen warten auf Verbindung',
    failingShort: 'Synchronisierung gestört',
    retry: 'Erneut versuchen',
    back: 'Wieder online',
    backLine: 'Alles synchronisiert.',
    tipOffline: 'Offline: Änderungen werden synchronisiert, sobald die Verbindung zurück ist',
    tipPending: '2 Änderungen werden synchronisiert',
  },
  en: {
    list: 'List', more: 'More', field: 'What do you need?', edit: 'Edit', items: 'items',
    offline: 'Offline',
    offlineLine: 'Your changes will sync once you\'re back online.',
    offlineFull: 'Offline – your changes will sync once you\'re back online.',
    failing: 'Sync failing',
    failingLine: 'Your changes are saved on this phone and won\'t get lost.',
    failingFull: 'Sync failing – your changes are saved on this phone.',
    offlineShort: 'Offline · changes wait for a connection',
    failingShort: 'Sync isn\'t working',
    retry: 'Try again',
    back: 'Back online',
    backLine: 'Everything synced.',
    tipOffline: 'Offline: changes will sync once the connection is back',
    tipPending: 'Syncing 2 changes',
  },
};

const STORES = [
  {
    name: 'Lidl',
    sections: [
      { de: 'Obst & Gemüse', en: 'Produce', items: [['🍌', '6×', 'Bananen', 'Bananas'], ['🍎', '1 kg', 'Äpfel', 'Apples'], ['🥒', '', 'Gurke', 'Cucumber']] },
      { de: 'Kühlregal', en: 'Chilled', items: [['🥛', '2×', 'Vollmilch', 'Whole milk'], ['🧈', '', 'Butter', 'Butter'], ['🥚', '10×', 'Eier', 'Eggs']] },
      { de: 'Brot & Backwaren', en: 'Bakery', items: [['🥖', '4×', 'Brötchen', 'Rolls'], ['🍞', '', 'Vollkornbrot', 'Wholegrain bread']] },
    ],
  },
  {
    name: 'dm',
    sections: [
      { de: 'Drogerie', en: 'Toiletries', items: [['🪥', '', 'Zahnpasta', 'Toothpaste'], ['🧻', '', 'Küchenrolle', 'Paper towels']] },
    ],
  },
];

// Material icons (24 px grid), the glyphs the app uses.
const ICON = {
  cartFilled: 'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z',
  menu: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
  mic: 'M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z',
  expand: 'M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z',
  cloudOff: 'M19.35 10.04C18.67 6.59 15.64 4 12 4c-1.48 0-2.85.43-4.01 1.17l1.46 1.46C10.21 6.23 11.08 6 12 6c3.04 0 5.5 2.46 5.5 5.5v.5H19c1.66 0 3 1.34 3 3 0 1.13-.64 2.11-1.56 2.62l1.45 1.45C23.16 18.16 24 16.68 24 15c0-2.64-2.05-4.78-4.65-4.96zM3 5.27l2.75 2.74C2.56 8.15 0 10.77 0 14c0 3.31 2.69 6 6 6h11.73l2 2L21 20.73 4.27 4 3 5.27zM7.73 10l8 8H6c-2.21 0-4-1.79-4-4s1.79-4 4-4h1.73z',
  cloudUpload: 'M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3zM8 13h2.55v3h2.9v-3H16l-4-4z',
  cloudDone: 'M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3zm-9-3.82-2.09-2.09L6.5 13.5 10 17l6.01-6.01-1.41-1.41z',
  syncProblem: 'M3 12c0 2.21.91 4.2 2.36 5.64L3 20h6v-6l-2.24 2.24C5.68 15.15 5 13.66 5 12c0-2.61 1.67-4.83 4-5.65V4.26C5.55 5.15 3 8.27 3 12zm8 5h2v-2h-2v2zM21 4h-6v6l2.24-2.24C18.32 8.85 19 10.34 19 12c0 2.61-1.67 4.83-4 5.65v2.09c3.45-.89 6-4.01 6-7.74 0-2.21-.91-4.2-2.36-5.64L21 4zm-10 9h2V7h-2v6z',
};

const state = { sync: 'online', lang: 'de', theme: 'light', motion: 'full', size: 'fit' };
const timers = new Map();

const icon = (name, cls = 'ic') =>
  `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON[name]}"/></svg>`;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// One span per kind; CSS shows the one matching the phone's data-kind, so the last
// message stays put while the indicator animates out.
const byKind = (offline, failing, back) =>
  `<span class="k k--offline">${offline}</span><span class="k k--failing">${failing}</span><span class="k k--back">${back}</span>`;

const kindIcon = (cls = 'ic') => byKind(icon('cloudOff', cls), icon('syncProblem', cls), icon('cloudDone', cls));

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

function topBar(v, t) {
  const cloud = v.id === 'current'
    ? `<span class="cloud">${byKind(icon('cloudOff'), icon('cloudUpload'), '')}</span>`
    : '';
  return `<div class="topbar hx">${cloud}<span class="edit hx">${t.edit}</span></div>`;
}

function indicator(v, t) {
  const retry = `<button type="button" class="retry hx k k--failing">${t.retry}</button>`;
  const textRetry = `<button type="button" class="retry k k--failing">${t.retry}</button>`;
  switch (v.id) {
    case 's1':
      return `<div class="banner" role="status">${kindIcon('ic ic--m')}<span class="banner__text">${byKind(esc(t.offlineShort), esc(t.failingShort), esc(t.back))}</span>${textRetry}</div>`;
    case 's2':
      return `<div class="card" role="status"><span class="card__icon">${kindIcon()}</span><span class="card__body"><strong>${byKind(t.offline, t.failing, t.back)}</strong><span>${byKind(esc(t.offlineLine), esc(t.failingLine), esc(t.backLine))}</span></span>${retry}</div>`;
    case 's3':
      return `<div class="island" role="status" data-peek-toggle>
        <span class="island__compact">${kindIcon('ic ic--s')}<span>${byKind(t.offline, t.failing, t.back)}</span></span>
        <span class="island__full"><span class="island__icon">${kindIcon()}</span><span class="island__body"><strong>${byKind(t.offline, t.failing, t.back)}</strong><span>${byKind(esc(t.offlineLine), esc(t.failingLine), esc(t.backLine))}</span></span>${retry}</span>
      </div>`;
    case 's4':
      return `<p class="caption" role="status">${byKind(esc(t.offlineFull), `${esc(t.failingFull)} <button type="button" class="link">${t.retry}</button>`, esc(t.back))}</p>`;
    case 's5':
      return `<div class="bubble" role="status"><span>${byKind(esc(t.offlineFull), esc(t.failingFull), esc(t.back))}</span>${retry}</div>`;
    default:
      return '';
  }
}

function field(v, t) {
  const lead = v.id === 's4' ? `<span class="field__lead">${kindIcon('ic ic--m')}</span>` : '';
  return `<div class="field hx">${lead}<span class="field__hint">${t.field}</span>${icon('mic')}</div>`;
}

function pill(v, t) {
  const seg = v.id === 's5'
    ? `<button type="button" class="seg5" data-peek-toggle><span class="seg5__in hx">${kindIcon('ic ic--m')}<span>${byKind(t.offline, 'Sync', t.back)}</span></span></button>`
    : '';
  return `<nav class="pill hx"><span class="tab tab--on hx">${icon('cartFilled', 'ic ic--m')}<span>${t.list}</span></span><span class="tab">${icon('menu', 'ic ic--m')}<span>${t.more}</span></span>${seg}</nav>`;
}

function phone(v) {
  const t = TEXT[state.lang];
  return `<div class="phone" data-variant="${v.id}" data-show="0" data-kind="offline" data-peek="0">
    <div class="content"><div class="page">${listPage(t, state.lang)}<div class="tail"></div></div></div>
    <div class="status"><span>9:41</span><span class="status__icons"><i class="sig"></i><i class="wifi"></i><i class="bat"></i></span></div>
    <div class="dynisland"></div>
    ${topBar(v, t)}
    <div class="fade"></div>
    ${field(v, t)}
    ${pill(v, t)}
    ${indicator(v, t)}
    <div class="home"></div>
  </div>`;
}

const reduced = () => state.motion === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches;

function later(ph, key, ms, fn) {
  const all = timers.get(ph) || {};
  clearTimeout(all[key]);
  all[key] = setTimeout(fn, ms);
  timers.set(ph, all);
}

function clearTimers(ph) {
  Object.values(timers.get(ph) || {}).forEach(clearTimeout);
  timers.delete(ph);
}

// Moves one phone to a sync state. `animate` false sets the end state at once (first render).
function apply(ph, sync, animate) {
  const variant = ph.dataset.variant;
  const shown = ph.dataset.show === '1';
  ph.dataset.net = sync === 'offline' ? 'off' : 'on';
  clearTimers(ph);
  if (sync === 'online') {
    ph.dataset.peek = '0';
    if (animate && shown && variant !== 'current' && ph.dataset.kind !== 'back') {
      ph.dataset.kind = 'back';
      later(ph, 'hide', FLASH_MS, () => { ph.dataset.show = '0'; });
    } else {
      ph.dataset.show = '0';
    }
    return;
  }
  ph.dataset.kind = sync;
  ph.dataset.show = '1';
  if (variant === 's3' || variant === 's5') {
    const peek = animate && !(variant === 's3' && reduced());
    ph.dataset.peek = peek ? '1' : '0';
    if (peek) later(ph, 'peek', PEEK_MS, () => { ph.dataset.peek = '0'; });
  }
}

function render() {
  const root = document.getElementById('frames');
  root.innerHTML = VARIANTS.map((v) => `<figure class="frame" data-id="${v.id}">
    <figcaption><strong>${v.name}</strong></figcaption>
    <div class="viewport">${phone(v)}</div>
    <p class="frame__note">${v.note[state.lang]}</p>
  </figure>`).join('');
  const html = document.documentElement;
  html.lang = state.lang;
  html.dataset.theme = state.theme;
  html.dataset.size = state.size;
  html.dataset.motion = state.motion;
  html.dataset.settled = '0';
  layout();
  root.querySelectorAll('.phone').forEach((ph) => apply(ph, state.sync, false));
  root.querySelectorAll('.hx').forEach((el) => hexObserver.observe(el));
  requestAnimationFrame(() => requestAnimationFrame(() => { html.dataset.settled = '1'; }));
}

// Two frames side by side on a phone, three on a tablet, all six in a row on a wide screen.
function layout() {
  const vw = document.documentElement.clientWidth;
  if (state.size === 'real') {
    document.documentElement.style.setProperty('--s', '1');
    return;
  }
  const cols = vw < 720 ? 2 : vw < 1500 ? 3 : 6;
  const gap = vw < 720 ? 12 : 24;
  const col = (vw - 2 * gap - (cols - 1) * gap) / cols;
  document.documentElement.style.setProperty('--s', String(Math.min(1, col / PHONE.w)));
}

// Hex pills: pointed ends with the token tip ratio and rounded corners, redrawn whenever a box resizes.
const TIP = 0.2887;
function hexPath(w, h, inset, r) {
  const tip = Math.min(h * TIP, w / 2);
  const pts = [[tip, 0], [w - tip, 0], [w, h / 2], [w - tip, h], [tip, h], [0, h / 2]]
    .map(([x, y]) => [inset + x * (w - 2 * inset) / w, inset + y * (h - 2 * inset) / h]);
  let d = '';
  pts.forEach((p, i) => {
    const prev = pts[(i + pts.length - 1) % pts.length];
    const next = pts[(i + 1) % pts.length];
    const toward = (a, b, len) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
      const k = Math.min(len, l / 2) / l;
      return [a[0] + dx * k, a[1] + dy * k];
    };
    const a = toward(p, prev, r), b = toward(p, next, r);
    d += `${i ? 'L' : 'M'}${a[0].toFixed(2)} ${a[1].toFixed(2)}Q${p[0].toFixed(2)} ${p[1].toFixed(2)} ${b[0].toFixed(2)} ${b[1].toFixed(2)}`;
  });
  return `${d}Z`;
}

const hexObserver = new ResizeObserver((entries) => {
  for (const e of entries) {
    const el = e.target;
    const w = el.offsetWidth, h = el.offsetHeight;
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
    svg.firstChild.setAttribute('d', hexPath(w, h, sw / 2, 8 * h / 48));
  }
});

document.addEventListener('click', (ev) => {
  const seg = ev.target.closest('.seg button');
  if (seg) {
    const control = seg.parentElement.dataset.control;
    state[control] = seg.dataset.value;
    seg.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === seg)));
    if (control === 'sync') {
      document.querySelectorAll('.phone').forEach((ph) => apply(ph, state.sync, true));
    } else {
      render();
    }
    return;
  }
  const toggle = ev.target.closest('[data-peek-toggle]');
  if (toggle && !ev.target.closest('.retry')) {
    const ph = toggle.closest('.phone');
    if (ph.dataset.show !== '1' || ph.dataset.kind === 'back') return;
    ph.dataset.peek = ph.dataset.peek === '1' ? '0' : '1';
    if (ph.dataset.peek === '1') later(ph, 'peek', PEEK_MS * 2, () => { ph.dataset.peek = '0'; });
  }
});

// On a phone, Fit draws each frame at about 0.45; start at 1:1 there so the text is readable.
if (document.documentElement.clientWidth < 720) {
  state.size = 'real';
  document.querySelectorAll('[data-control=size] button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === 'real')));
}

window.addEventListener('resize', layout);
render();
