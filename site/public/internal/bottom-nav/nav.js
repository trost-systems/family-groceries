'use strict';

const PHONE = { w: 390, h: 844 };

const VARIANTS = [
  {
    id: 'current',
    name: 'Current',
    note: { de: 'Heute: Material-NavigationBar, 62 pt plus Home-Indicator-Abstand.', en: 'Today: Material NavigationBar, 62 pt plus the home-indicator inset.' },
  },
  {
    id: 'compact',
    name: 'V1 Compact',
    note: { de: 'Gleiche Leiste, randlos, 40 pt. Icon und Label in einer Zeile. Spart Höhe, indem die Tabs 20 pt in den 34-pt-Home-Indicator-Abstand rücken; die Tippflächen sind nur 35 pt hoch (Richtwert 44 pt). Mit vollem Abstand und 44 pt wären es 78 pt statt 60.', en: 'Same edge-to-edge bar at 40 pt. Icon and label on one line. It saves height by moving the tabs 20 pt into the 34 pt home-indicator inset; the tap targets are only 35 pt tall (guideline 44 pt). With the full inset and 44 pt targets it would be 78 pt, not 60.' },
  },
  {
    id: 'pill',
    name: 'V2 Floating pill',
    note: { de: 'Freistehende Hex-Kapsel über dem Home-Indicator; die Liste läuft dahinter und daneben weiter.', en: 'A detached hex capsule above the home indicator; the list runs on behind and beside it.' },
  },
  {
    id: 'island',
    name: 'V3 Island',
    note: { de: 'Kleine dunkle Kapsel, nur Icons; der aktive Tab zeigt sein Label.', en: 'A small dark capsule, icons only; the active tab shows its label.' },
  },
  {
    id: 'inline',
    name: 'Extra: one row',
    note: { de: 'Vorschlag: keine Tab-Leiste. "Mehr" sitzt als Hex-Knopf neben dem Eingabefeld.', en: 'Proposal: no tab bar. "More" is a hex button next to the add field.' },
  },
];

const TEXT = {
  de: { list: 'Liste', more: 'Mehr', field: 'Was brauchst du?', edit: 'Anpassen', items: 'Artikel', moreTitle: 'Mehr', nav: 'Nav', navField: 'Nav + Feld', rows: 'Zeilen sichtbar' },
  en: { list: 'List', more: 'More', field: 'What do you need?', edit: 'Customize', items: 'items', moreTitle: 'More', nav: 'Nav', navField: 'Nav + field', rows: 'rows visible' },
};

const STORES = [
  {
    name: 'dm',
    sections: [
      { de: 'Sonstiges', en: 'Other', items: [['🪥', '', 'Zahnpasta', 'Toothpaste'], ['🧻', '', 'Küchenrolle', 'Paper towels']] },
    ],
  },
  {
    name: 'Lidl',
    sections: [
      { de: 'Kühlregal', en: 'Chilled', items: [['🥛', '2 l', 'Vollmilch', 'Whole milk'], ['🧈', '', 'Butter', 'Butter'], ['🥚', '10×', 'Eier', 'Eggs']] },
      { de: 'Obst & Gemüse', en: 'Produce', items: [['🍌', '6×', 'Bananen', 'Bananas'], ['🍎', '', 'Äpfel', 'Apples'], ['🥒', '', 'Gurke', 'Cucumber'], ['🍅', '500 g', 'Tomaten', 'Tomatoes']] },
      { de: 'Backwaren', en: 'Bakery', items: [['🍞', '', 'Vollkornbrot', 'Wholegrain bread'], ['🥐', '4×', 'Croissants', 'Croissants']] },
    ],
  },
  {
    name: 'Edeka',
    sections: [
      { de: 'Getränke', en: 'Drinks', items: [['☕', '', 'Kaffee', 'Coffee'], ['🧃', '', 'Apfelsaft', 'Apple juice']] },
    ],
  },
];

const MORE_ROWS = [
  ['Haushalt', 'Household'],
  ['Läden', 'Stores'],
  ['Premium', 'Premium'],
  ['Einstellungen', 'Settings'],
  ['Hilfe & Feedback', 'Help & feedback'],
];

// Material icons (24 px grid), the glyphs the app's shell uses.
const ICON = {
  cart: 'M15.55 13c.75 0 1.41-.41 1.75-1.03l3.58-6.49A.996.996 0 0 0 20.01 4H5.21l-.94-2H1v2h2l3.6 7.59-1.35 2.44C4.52 15.37 5.48 17 7 17h12v-2H7l1.1-2h7.45zM6.16 6h12.15l-2.76 5H8.53L6.16 6zM7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z',
  cartFilled: 'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z',
  menu: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
  mic: 'M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z',
  expand: 'M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z',
  chevron: 'M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',
};

const state = { lang: 'de', theme: 'light', field: 'floating', size: 'fit', tabs: {} };

const icon = (name, cls = 'ic') =>
  `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON[name]}"/></svg>`;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function listPage(t, lang) {
  const stores = STORES.map((store) => {
    const count = store.sections.reduce((n, s) => n + s.items.length, 0);
    const sections = store.sections.map((s) => {
      const rows = s.items.map(([emoji, qty, de, en]) =>
        `<div class="row"><span class="row__emoji">${emoji}</span><span class="row__name">${qty ? `<b>${esc(qty)}</b> ` : ''}${esc(lang === 'de' ? de : en)}</span></div>`).join('');
      return `<div class="section"><span>${esc(s[lang])}</span></div>${rows}`;
    }).join('');
    return `<div class="store"><span class="store__badge hx">${esc(store.name)}</span><span class="store__line"></span><span class="store__count"><b>${count}</b> ${t.items}</span>${icon('expand', 'ic ic--s')}</div>${sections}`;
  }).join('');
  return `<div class="page page--list"><div class="appbar"><span>${t.edit}</span></div>${stores}<div class="tail"></div></div>`;
}

function morePage(t, lang) {
  const rows = MORE_ROWS.map(([de, en]) => `<div class="more-row"><span>${esc(lang === 'de' ? de : en)}</span>${icon('chevron', 'ic ic--s')}</div>`).join('');
  return `<div class="page page--more"><div class="more-title">${t.moreTitle}</div><div class="more-card">${rows}</div></div>`;
}

function tabButton(id, t, tab) {
  const selected = tab === id;
  const glyph = id === 'list' ? (selected ? 'cartFilled' : 'cart') : 'menu';
  return `<button type="button" class="tab" data-tab="${id}" aria-pressed="${selected}"><span class="tab__ind hx">${icon(glyph)}<span class="tab__label tab__label--in">${t[id]}</span></span><span class="tab__label tab__label--out">${t[id]}</span></button>`;
}

function nav(v, t, tab) {
  if (v.id === 'inline') {
    const target = tab === 'list' ? 'more' : 'list';
    return `<button type="button" class="nav nav--inline hx" data-tab="${target}" aria-label="${t[target]}">${icon(target === 'more' ? 'menu' : 'cart')}</button>`;
  }
  return `<nav class="nav nav--${v.id}${v.id === 'pill' || v.id === 'island' ? ' hx-host' : ''}"><div class="nav__body${v.id === 'pill' ? ' hx' : ''}">${tabButton('list', t, tab)}${tabButton('more', t, tab)}</div></nav>`;
}

function phone(v) {
  const t = TEXT[state.lang];
  const tab = state.tabs[v.id] || 'list';
  return `<div class="phone" data-variant="${v.id}" data-tab="${tab}" data-field="${state.field}">
    <div class="status"><span>9:41</span><span class="status__icons"><i></i><i></i><i></i></span></div>
    <div class="content">${listPage(t, state.lang)}${morePage(t, state.lang)}</div>
    <div class="fade"></div>
    <div class="band"></div>
    <div class="field hx"><span>${t.field}</span>${icon('mic')}</div>
    ${nav(v, t, tab)}
    <div class="home"></div>
  </div>`;
}

function render() {
  const root = document.getElementById('frames');
  const t = TEXT[state.lang];
  root.innerHTML = VARIANTS.map((v) => `<figure class="frame" data-id="${v.id}">
    <figcaption><strong>${v.name}</strong></figcaption>
    <div class="viewport">${phone(v)}</div>
    <p class="frame__metric" data-metric></p>
    <p class="frame__note">${v.note[state.lang]}</p>
  </figure>`).join('');
  document.documentElement.lang = state.lang;
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.dataset.size = state.size;
  layout();
  root.querySelectorAll('.hx').forEach((el) => hexObserver.observe(el));
  requestAnimationFrame(() => measure(t));
}

// Scale so that two frames fit side by side on a phone and all five in a row on a wide screen.
function layout() {
  const vw = document.documentElement.clientWidth;
  if (state.size === 'real') {
    document.documentElement.style.setProperty('--s', '1');
    return;
  }
  const cols = vw < 720 ? 2 : vw < 1200 ? 3 : 5;
  const gap = vw < 720 ? 12 : 24;
  const col = (vw - 2 * gap - (cols - 1) * gap) / cols;
  document.documentElement.style.setProperty('--s', String(Math.min(1, col / PHONE.w)));
}

// The numbers describe each phone's list page at the top of the list, whatever it shows now:
// a phone on More is flipped to its list for the synchronous reads and back before the next paint.
function measure(t) {
  document.querySelectorAll('.frame').forEach((frame) => {
    const ph = frame.querySelector('.phone');
    const shown = ph.dataset.tab;
    ph.dataset.tab = 'list';
    const box = ph.getBoundingClientRect();
    const s = box.height / PHONE.h;
    const scrolled = ph.querySelector('.content').scrollTop * s;
    const navTop = ph.querySelector('.nav').getBoundingClientRect().top;
    const fieldTop = ph.querySelector('.field').getBoundingClientRect().top;
    const chromeTop = Math.min(navTop, fieldTop - (state.field === 'docked' ? 12 * s : 0));
    const rows = [...ph.querySelectorAll('.page--list .row')].filter((r) => r.getBoundingClientRect().bottom + scrolled <= chromeTop).length;
    ph.dataset.tab = shown;
    const pt = (px) => Math.round(px / s);
    const navPt = ph.dataset.variant === 'inline' ? 0 : pt(box.bottom - navTop);
    frame.querySelector('[data-metric]').textContent = `${t.nav}: ${navPt} pt · ${t.navField}: ${pt(box.bottom - chromeTop)} pt · ${rows} ${t.rows}`;
  });
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
    state[seg.parentElement.dataset.control] = seg.dataset.value;
    seg.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === seg)));
    render();
    return;
  }
  const tabEl = ev.target.closest('[data-tab]:not(.phone)');
  if (tabEl) {
    const ph = tabEl.closest('.phone');
    const v = VARIANTS.find((x) => x.id === ph.dataset.variant);
    state.tabs[v.id] = tabEl.dataset.tab;
    // Swap only the nav and the page flag so selection changes animate instead of re-rendering the phone.
    ph.dataset.tab = state.tabs[v.id];
    const fresh = document.createElement('div');
    fresh.innerHTML = nav(v, TEXT[state.lang], state.tabs[v.id]);
    if (v.id === 'inline') {
      ph.querySelector('.nav').replaceWith(fresh.firstElementChild);
    } else {
      ph.querySelectorAll('.nav .tab').forEach((b) => {
        const on = b.dataset.tab === state.tabs[v.id];
        b.setAttribute('aria-pressed', String(on));
        b.querySelector('.ic path').setAttribute('d', ICON[b.dataset.tab === 'list' ? (on ? 'cartFilled' : 'cart') : 'menu']);
      });
    }
    ph.querySelectorAll('.hx').forEach((el) => hexObserver.observe(el));
  }
});

window.addEventListener('resize', () => { layout(); measure(TEXT[state.lang]); });
render();
