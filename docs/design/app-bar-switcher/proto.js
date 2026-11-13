import { icons } from './icons.js';
import { scenarios, initialState, householdOf, listOf, defaultOf, showList } from './model.js';
import { variants, recommendation } from './variants.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[name]}"/></svg>`;

const view = { route: 'alle', scenario: 'many-households', width: 390, offline: false, big: false };
const phones = new Map();

function phoneState(variantId) {
  const key = `${variantId}/${view.scenario}`;
  if (!phones.has(key)) phones.set(key, initialState(scenarios.find((s) => s.id === view.scenario)));
  return phones.get(key);
}

// Bar pieces shared by every variant.

const anpassen = `<button class="tact" data-act="noop:Anpassen öffnet die Bearbeitung wie heute."><span>Anpassen</span></button>`;

function syncPill(withLabel) {
  if (!view.offline) return '';
  return withLabel
    ? `<button class="pill" data-act="noop:Offline: Änderungen werden synchronisiert, sobald du wieder online bist.">${icon('cloud_off_outlined')}<span>Offline</span></button>`
    : `<button class="pill icon-only" aria-label="Offline" data-act="noop:Offline: Änderungen werden synchronisiert, sobald du wieder online bist.">${icon('cloud_off_outlined')}</button>`;
}

const bars = {
  current(s) {
    const h = householdOf(s);
    const lists = h.lists;
    const tabs =
      lists.length > 1
        ? `<div class="tabs-row"><div class="track-wrap"><div class="track">${lists
            .map(
              (l) =>
                `<button class="tab ${l.id === listOf(s).id ? 'on' : ''}" data-act="list:${h.id}:${l.id}">${esc(l.name)}</button>`,
            )
            .join('')}<button class="tab plus" aria-label="Neue Liste" data-act="noop:Neue Liste">${icon('add')}</button></div></div></div>`
        : '';
    return `<div class="bar">
      <button class="tact hh-chip" data-act="open:current"><span><b class="ell">${esc(h.name)}</b>${icon('expand_more', 'sm')}</span></button>
      ${syncPill(true)}${anpassen}</div>${tabs}`;
  },

  'breadcrumb-in-bar'(s) {
    const h = householdOf(s);
    const l = listOf(s);
    return `<div class="bar">
      <div class="crumb-wrap"><div class="crumb">
        <button class="crumb-hh" data-act="open:combined:households"><span class="ell">${esc(h.name)}</span></button>
        <span class="crumb-sep">${icon('chevron_right', 'sm')}</span>
        <button class="crumb-list" data-act="open:combined:lists"><span class="ell">${esc(l.name)}</span></button>
      </div></div>
      ${syncPill(false)}${anpassen}</div>`;
  },

  'stacked-two-line'(s) {
    const h = householdOf(s);
    const l = listOf(s);
    return `<div class="bar">
      <button class="tact stacked" data-act="open:browse">
        <span><span class="lines"><small class="ell">${icon('home_outlined', 'xs')}${esc(h.name)}</small><b class="ell">${esc(l.name)}</b></span>${icon('unfold_more', 'sm')}</span>
      </button>
      ${syncPill(false)}${anpassen}</div>`;
  },

  'single-chip-truncate'(s) {
    const h = householdOf(s);
    const l = listOf(s);
    return `<div class="bar">
      <button class="one-chip" data-act="open:grouped" aria-label="${esc(l.name)}, ${esc(h.name)}">
        <span class="mid list" data-full="${esc(l.name)}">${esc(l.name)}</span><span class="dot">·</span><span class="mid hh" data-full="${esc(h.name)}">${esc(h.name)}</span>${icon('expand_more', 'sm')}
      </button>
      ${syncPill(false)}${anpassen}</div>`;
  },

  'list-first-chip'(s) {
    const h = householdOf(s);
    const l = listOf(s);
    return `<div class="bar">
      <div class="title-group">
        <button class="hh-tag" data-act="open:drill:households"><span class="ell">${esc(h.name)}</span></button>
        <button class="list-title" data-act="open:drill:lists"><span class="fit">${esc(l.name)}</span>${icon('expand_more', 'sm')}</button>
      </div>
      ${syncPill(false)}${anpassen}</div>`;
  },

  'hide-household-when-solo'(s) {
    const l = listOf(s);
    if (s.scenario.households.length > 1) {
      return bars['stacked-two-line'](s).replace('open:browse', 'open:segmented');
    }
    return `<div class="bar">
      <button class="tact list-only" data-act="open:segmented"><span><b class="ell">${esc(l.name)}</b>${icon('expand_more', 'sm')}</span></button>
      ${syncPill(false)}${anpassen}</div>`;
  },
};

// Sheets.

const hex = (name, cls = '') => `<span class="hexmark ${cls}">${icon(name)}</span>`;

function row({ act, lead, leadCls = '', title, sub = '', on = false, trail = '' }) {
  return `<button class="row ${on ? 'on' : ''}" data-act="${act}">${hex(lead, on ? 'honey' : leadCls)}<span class="row-text"><span class="row-title">${esc(title)}</span>${
    sub ? `<span class="row-sub">${esc(sub)}</span>` : ''
  }</span>${on ? icon('check') : ''}${trail}</button>`;
}

const members = (h) => `${h.members} Mitglieder`;
const openCount = (h) => `${h.lists.reduce((n, l) => n + l.items.length, 0)} offen`;

function listRows(s, h) {
  return (
    h.lists
      .map((l) =>
        row({
          act: `list:${h.id}:${l.id}`,
          lead: 'checklist',
          title: l.name,
          sub: `${l.items.length} offen`,
          on: h.id === s.household && l.id === listOf(s).id,
        }),
      )
      .join('') + row({ act: 'noop:Neue Liste anlegen, wie heute das + bei den Listen.', lead: 'add', title: 'Neue Liste' })
  );
}

function householdRows(s, act = (h) => `hh:${h.id}`) {
  return s.scenario.households
    .map((h) =>
      row({
        act: act(h),
        lead: 'home_outlined',
        title: h.name,
        sub: `${members(h)} · ${openCount(h)}`,
        on: h.id === s.household,
        trail: `<span class="invite" data-act="noop:Leute einladen in ${esc(h.name)}">${icon('person_add_outlined')}</span>`,
      }),
    )
    .join('');
}

function householdActions(s) {
  return `<hr>${row({ act: 'noop:Neuer Haushalt', lead: 'add', title: 'Neuer Haushalt' })}${row({
    act: 'noop:Mit Code beitreten',
    lead: 'group_add_outlined',
    title: 'Mit Code beitreten',
  })}<hr>${row({
    act: 'noop:Öffnet die Auswahl für Siri, Alexa & KI wie heute. Wechseln oben ändert sie nicht.',
    lead: 'record_voice_over_outlined',
    leadCls: 'accent',
    title: `Siri, Alexa & KI nutzen: ${defaultOf(s).name}`,
    trail: icon('chevron_right'),
  })}`;
}

const heading = (text, extra = '') => `<h3 class="sheet-h">${esc(text)}${extra}</h3>`;

const sheets = {
  current(s) {
    return heading('Deine Haushalte') + householdRows(s) + householdActions(s);
  },

  combined(s) {
    const h = householdOf(s);
    const l = listOf(s);
    const lists = `<section data-part="lists">${heading(`Listen in ${h.name}`)}${listRows(s, h)}</section>`;
    const hhs = `<section data-part="households">${heading('Deine Haushalte')}${householdRows(s)}${householdActions(s)}</section>`;
    return `<p class="full-path"><span>${esc(h.name)}</span>${icon('chevron_right', 'sm')}<b>${esc(l.name)}</b></p>${lists}${hhs}`;
  },

  browse(s) {
    const browsing = s.sheet.arg ?? s.household;
    const h = s.scenario.households.find((x) => x.id === browsing);
    const chips = s.scenario.households
      .map(
        (x) =>
          `<span class="pick-wrap ${x.id === browsing ? 'on' : ''}"><button class="hh-pick ${x.id === browsing ? 'on' : ''}" data-act="${x.id === browsing && x.id !== s.household ? 'hh' : 'browse'}:${x.id}">${icon('home_outlined', 'xs')}<span class="hh-name">${esc(x.name)}</span></button></span>`,
      )
      .join('');
    const note =
      browsing === s.household
        ? ''
        : `<p class="sheet-note">Tippe eine Liste, um zu ${esc(h.name)} zu wechseln.</p>`;
    return `${heading('Haushalt')}<div class="hh-picks">${chips}</div>
      ${heading(`Listen in ${h.name}`)}${note}${listRows(s, h)}${householdActions(s)}`;
  },

  grouped(s) {
    return (
      s.scenario.households
        .map(
          (h) =>
            `<section>${heading(h.name, h.id === s.household ? ' <span class="badge">angezeigt</span>' : '')}${listRows(s, h)}</section>`,
        )
        .join('') + householdActions(s)
    );
  },

  drill(s) {
    const h = householdOf(s);
    if (s.sheet.arg === 'households') {
      return `<button class="back" data-act="page:lists">${icon('chevron_right', 'flip')}Listen in ${esc(h.name)}</button>${heading('Deine Haushalte')}${householdRows(s)}${householdActions(s)}`;
    }
    return `${heading(`Listen in ${h.name}`)}${listRows(s, h)}<hr>${row({
      act: 'page:households',
      lead: 'home_outlined',
      title: `Haushalt: ${h.name}`,
      sub: s.scenario.households.length > 1 ? `wechseln (${s.scenario.households.length} Haushalte)` : 'wechseln, neu anlegen oder beitreten',
      trail: icon('chevron_right'),
    })}`;
  },

  segmented(s) {
    const tab = s.sheet.arg ?? 'lists';
    const h = householdOf(s);
    const seg = `<div class="seg"><button class="${tab === 'lists' ? 'on' : ''}" data-act="seg:lists">Listen</button><button class="${tab === 'households' ? 'on' : ''}" data-act="seg:households">Haushalte</button></div>`;
    const body =
      tab === 'lists'
        ? `${heading(s.scenario.households.length > 1 ? `Listen in ${h.name}` : 'Listen')}${listRows(s, h)}`
        : `${heading('Deine Haushalte')}${householdRows(s)}${householdActions(s)}`;
    return seg + body;
  },
};

// One phone.

function phone(variantId, interactive) {
  const s = phoneState(variantId);
  const l = listOf(s);
  const v = variants.find((x) => x.id === variantId);
  const sheet = s.sheet
    ? `<div class="scrim" data-act="close"></div><div class="sheet" role="dialog"><span class="handle"></span><div class="sheet-body">${sheets[s.sheet.kind](s)}</div></div>`
    : '';
  const toast = s.toast
    ? `<div class="toast">${s.toast.text ?? `Angezeigt: ${esc(s.toast.household)}. Siri, Alexa & KI bleiben bei ${esc(s.toast.voice)}.`}</div>`
    : '';
  return `<figure class="device ${interactive ? 'solo' : ''}" data-variant="${variantId}">
    <figcaption><b>${v.n}</b> ${esc(v.title)} <code>${v.id}</code> <span class="measure"></span></figcaption>
    <div class="phone" style="--w:${view.width}px;--ts:${view.big ? 1.3 : 1}">
      <div class="statusbar"><span>9:41</span></div>
      <header class="hdr">${bars[variantId](s)}</header>
      <div class="content">${l.items
        .map((name) => `<div class="item"><span class="box"></span>${esc(name)}</div>`)
        .join('')}</div>
      <div class="addbar"><span>Was brauchst du?</span></div>
      <nav class="nav"><span class="on">${icon('checklist')}Liste</span><span>${icon('shopping_basket_outlined')}Verlauf</span><span>${icon('more_horiz')}Mehr</span></nav>
      ${sheet}${toast}
    </div>
  </figure>`;
}

// Long names: middle ellipsis where a variant asks for it, shrink-to-fit
// for the list-first title.

const canvas = document.createElement('canvas').getContext('2d');
function width(text, el) {
  const cs = getComputedStyle(el);
  canvas.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  return canvas.measureText(text).width;
}
function middle(text, el, room) {
  if (width(text, el) <= room) return text;
  let lo = 1;
  let hi = text.length;
  let best = text.slice(0, 1) + '…';
  while (lo <= hi) {
    const keep = (lo + hi) >> 1;
    const head = Math.ceil(keep * 0.6);
    const cand = `${text.slice(0, head).trimEnd()}…${text.slice(text.length - (keep - head)).trimStart()}`;
    if (width(cand, el) <= room) {
      best = cand;
      lo = keep + 1;
    } else hi = keep - 1;
  }
  return best;
}

// The household never shrinks below two letters and an ellipsis.
const stubOf = (name, el, letters = 2) => Math.min(width(name, el), width(`${name.slice(0, letters)}…`, el)) + 2;
const padX = (el) => parseFloat(getComputedStyle(el).paddingLeft) + parseFloat(getComputedStyle(el).paddingRight);

// The list comes first: the household shrinks to a stub before the list loses a letter.
function fitOneChip(chip) {
  const list = chip.querySelector('.list');
  const hh = chip.querySelector('.hh');
  list.textContent = list.dataset.full;
  hh.textContent = hh.dataset.full;
  chip.style.minWidth = '';
  const fixed = chip.scrollWidth - list.offsetWidth - hh.offsetWidth;
  const wl = width(list.dataset.full, list);
  const wh = width(hh.dataset.full, hh);
  const stub = stubOf(hh.dataset.full, hh);
  chip.style.minWidth = `${fixed + Math.min(wl, width(`${list.dataset.full.slice(0, 1)}…`, list) + 2) + stub}px`;
  const room = chip.clientWidth - fixed;
  if (wl + wh <= room) return;
  const forList = room - Math.min(wh, stub);
  list.textContent = middle(list.dataset.full, list, Math.min(wl, forList));
  const rest = room - width(list.textContent, list) - 1;
  hh.textContent = middle(hh.dataset.full, hh, list.textContent === list.dataset.full ? rest : Math.min(rest, stub));
}

// A switcher whose name floors would overflow it or push Anpassen out of the bar drops its chevron.
function tightenIfOver(button, fit, inner = button) {
  const over = (e) => e.scrollWidth > e.clientWidth + 0.5;
  button.classList.remove('tight');
  fit();
  if (!over(button.closest('.bar')) && !over(inner)) return;
  button.classList.add('tight');
  fit();
}

function afterLayout(root) {
  for (const wrap of root.querySelectorAll('.crumb-wrap')) {
    const hh = wrap.querySelector('.crumb-hh');
    const list = wrap.querySelector('.crumb-list');
    tightenIfOver(
      wrap,
      () => {
        hh.style.minWidth = `${stubOf(hh.textContent, hh.firstElementChild) + padX(hh)}px`;
        list.style.minWidth = wrap.classList.contains('tight') ? `${stubOf(list.textContent, list.firstElementChild, 1) + padX(list)}px` : '';
      },
      wrap.querySelector('.crumb'),
    );
  }
  for (const button of root.querySelectorAll('.stacked')) {
    tightenIfOver(button, () => {
      const small = button.querySelector('small');
      button.style.minWidth = '';
      const icon = small.querySelector('.icon');
      const iconW = icon.getBoundingClientRect().width + parseFloat(getComputedStyle(icon).marginRight);
      const fixed = button.offsetWidth - small.getBoundingClientRect().width;
      button.style.minWidth = `${fixed + iconW + stubOf(small.textContent, small)}px`;
    });
  }
  for (const chip of root.querySelectorAll('.one-chip')) tightenIfOver(chip, () => fitOneChip(chip));
  // Today's chip follows HouseholdChip.widest: at most 55 % of the row and what Anpassen, the
  // pill and three gaps leave; under 96 px (tips, padding, icon, a letter) it steps aside.
  for (const chip of root.querySelectorAll('.hh-chip')) {
    chip.style.display = '';
    chip.style.maxWidth = '';
    const bar = chip.closest('.bar');
    const anpassenW = bar.lastElementChild.offsetWidth;
    const pill = bar.querySelector('.pill') ? 48 : 0;
    const room = Math.min(bar.clientWidth * 0.55, bar.clientWidth - anpassenW - pill - 24);
    if (room < 2 * (0.2887 * 48 + 12) + 44) chip.style.display = 'none';
    else chip.style.maxWidth = `${room}px`;
    // The pill keeps its word only while the chip shows its name whole (SyncPillSpace).
    const word = bar.querySelector('.pill span');
    if (word) word.style.display = '';
    const name = chip.querySelector('b');
    if (word && chip.style.display !== 'none' && name.scrollWidth > name.clientWidth) word.style.display = 'none';
  }
  for (const group of root.querySelectorAll('.title-group')) {
    const hh = group.querySelector('.hh-tag');
    const title = group.querySelector('.list-title');
    const fit = title.querySelector('.fit');
    tightenIfOver(group, () => {
      hh.style.minWidth = `${stubOf(hh.textContent, hh.firstElementChild) + padX(hh)}px`;
      title.style.minWidth = '';
      let size = 22;
      fit.style.fontSize = `calc(${size}px * var(--ts))`;
      while (fit.scrollWidth > fit.clientWidth && size > 16) {
        size -= 1;
        fit.style.fontSize = `calc(${size}px * var(--ts))`;
      }
      title.style.minWidth = `${title.scrollWidth - fit.offsetWidth + stubOf(fit.textContent, fit, 1)}px`;
    });
  }
  for (const dev of root.querySelectorAll('.device')) {
    const hdr = dev.querySelector('.hdr');
    dev.querySelector('.measure').textContent = `Kopf ${hdr.offsetHeight} px`;
  }
  if (root.querySelector('.sheet [data-part]')) {
    for (const dev of root.querySelectorAll('.device')) {
      const s = phoneState(dev.dataset.variant);
      const part = s.sheet?.arg === 'households' && dev.querySelector(`.sheet [data-part="${s.sheet.arg}"]`);
      if (part && !s.sheet.scrolled) {
        s.sheet.scrolled = true;
        part.scrollIntoView({ block: 'start' });
      }
    }
  }
}

// Interaction.

function act(variantId, action) {
  const s = phoneState(variantId);
  const [verb, a, b] = action.split(':');
  s.toast = null;
  if (verb === 'open') s.sheet = { kind: a, arg: b };
  else if (verb === 'close') s.sheet = null;
  else if (verb === 'list') showList(s, a, b);
  else if (verb === 'hh') showList(s, a, null);
  else if (verb === 'browse' || verb === 'page' || verb === 'seg') s.sheet = { ...s.sheet, arg: a };
  else if (verb === 'noop') s.toast = { text: `Prototyp: ${esc(action.slice(5))}` };
}

// Page.

const app = document.getElementById('app');

function controls() {
  const btn = (on, act, label) => `<button aria-pressed="${on}" data-page="${act}">${label}</button>`;
  return `<div class="controls">
    <div class="group">${btn(view.route === 'alle', 'route:alle', 'Alle nebeneinander')}${variants
      .map((v) => btn(view.route === v.id, `route:${v.id}`, `${v.n} ${v.short}`))
      .join('')}${btn(view.route === 'empfehlung', 'route:empfehlung', 'Empfehlung')}</div>
    ${
      view.route === 'empfehlung'
        ? ''
        : `<div class="group">${scenarios.map((sc) => btn(view.scenario === sc.id, `scenario:${sc.id}`, esc(sc.label))).join('')}</div>
    <div class="group">${[390, 360, 320].map((w) => btn(view.width === w, `width:${w}`, `${w} px`)).join('')}${btn(view.offline, 'offline', 'Offline')}${btn(view.big, 'big', 'Große Schrift')}${btn(false, 'reset', 'Von vorn')}</div>`
    }
  </div>`;
}

function notes(v) {
  return `<aside class="notes"><h2>${v.n}. ${esc(v.title)}</h2><p class="slug"><code>${v.id}</code></p>${v.notes}</aside>`;
}

function render() {
  const head = `<header class="page-head"><h1>Haushalt und Liste in der Kopfzeile</h1><p class="note">Wegwerf-Prototypen, Job 205. Erfundene Daten, kein Backend, keine App-Änderung. Tippe in den Telefonen: der Umschalter öffnet das Blatt, dort wechselst du Liste und Haushalt.</p>${controls()}</header>`;
  let body;
  if (view.route === 'empfehlung') body = `<article class="rec">${recommendation}</article>`;
  else if (view.route === 'alle') body = `<div class="grid">${variants.map((v) => phone(v.id, false)).join('')}</div>`;
  else {
    const v = variants.find((x) => x.id === view.route);
    body = `<div class="single">${phone(v.id, true)}${notes(v)}</div>`;
  }
  const keep = globalThis.scrollY;
  app.innerHTML = head + body;
  globalThis.scrollTo(0, keep);
  document.fonts.ready.then(() => afterLayout(app));
}

app.addEventListener('click', (e) => {
  const page = e.target.closest('[data-page]');
  if (page) {
    const [k, val] = page.dataset.page.split(':');
    if (k === 'route') location.hash = `#/${val}`;
    else if (k === 'scenario') view.scenario = val;
    else if (k === 'width') view.width = Number(val);
    else if (k === 'offline') view.offline = !view.offline;
    else if (k === 'big') view.big = !view.big;
    else if (k === 'reset') phones.clear();
    render();
    return;
  }
  const target = e.target.closest('[data-act]');
  const dev = e.target.closest('.device');
  if (!target || !dev) return;
  e.stopPropagation();
  act(dev.dataset.variant, target.dataset.act);
  render();
});

function route() {
  const r = location.hash.replace(/^#\/?/, '') || 'alle';
  view.route = r === 'empfehlung' || variants.some((v) => v.id === r) ? r : 'alle';
  render();
}
globalThis.addEventListener('hashchange', route);
globalThis.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  for (const s of phones.values()) s.sheet = null;
  render();
});
globalThis.addEventListener('resize', () => afterLayout(app));
route();
