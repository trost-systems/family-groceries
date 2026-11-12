import { icons } from './icons.js';
import * as m from './model.js';

const approaches = [
  {
    slug: 'trip-journal-by-date',
    title: '1 Journal nach Datum',
    pitch: 'Alle Einkäufe untereinander, der neueste oben, gruppiert nach Woche und Monat.',
    steps: [
      'Eintragen: „Einkauf eintragen“, Rewe, Heute, Milch und Brot tippen, Speichern.',
      'Früheren Einkauf finden: runterscrollen bis „Oktober 2026“ und den Einkauf antippen.',
      'Bearbeiten: im Einkauf „Bearbeiten“, Menge oder Laden ändern, Speichern.',
      'Leerer Verlauf: oben „Leerer Verlauf“ wählen.',
    ],
    plus: 'Vertraut wie ein Tagebuch; nichts zu lernen; jeder Einkauf genau einmal sichtbar.',
    minus: '„Was hatten wir zuletzt bei Aldi?“ heißt scrollen und lesen.',
  },
  {
    slug: 'store-timeline',
    title: '2 Nach Laden',
    pitch: 'Ein Abschnitt je Laden, darin die Einkäufe nach Datum. Läden ohne Einkauf bleiben sichtbar.',
    steps: [
      'Eintragen: bei Rewe „Einkauf bei Rewe eintragen“ (Laden ist schon gesetzt), Milch und Brot, Speichern.',
      'Früheren Einkauf finden: einen Laden aufklappen und ein Datum antippen.',
      'Bearbeiten: im Einkauf „Bearbeiten“, ändern, Speichern.',
      'Leerer Verlauf: oben „Leerer Verlauf“; die Läden stehen trotzdem da.',
    ],
    plus: 'Beantwortet „was kaufen wir bei Aldi?“ direkt; passt zu den Laden-Abschnitten der Liste.',
    minus: 'Ein Wochenüberblick über alle Läden fehlt; viele Läden heißt viele Abschnitte.',
  },
  {
    slug: 'post-shop-entry-sheet',
    title: '3 Eintragen nach dem Einkauf',
    pitch: 'Startet auf der Liste: wer abhakt, bekommt das Eintragen angeboten, schon ausgefüllt. Vergessene Einkäufe lassen sich nachtragen.',
    steps: [
      'Eintragen: auf der Liste Milch und Brot abhaken (damit ist Rewe erledigt), dann „Eintragen“ in der Karte, Speichern.',
      'Früheren Einkauf finden: Tab „Verlauf“ und einen Einkauf antippen.',
      'Bearbeiten: im Einkauf „Bearbeiten“, ändern, Speichern.',
      'Leerer Verlauf: oben „Leerer Verlauf“, dann Tab „Verlauf“.',
    ],
    plus: 'Fast kein Tippen: der Verlauf füllt sich aus dem, was ohnehin abgehakt wird.',
    minus: 'Der Verlauf selbst ist schlicht; wer ohne Liste einkauft, muss nachtragen.',
  },
  {
    slug: 'calendar-trip-browse',
    title: '4 Kalender',
    pitch: 'Ein Monatskalender mit einer Wabe je Einkauf; ein Tag zeigt seine Einkäufe darunter.',
    steps: [
      'Eintragen: „Einkauf von heute eintragen“, Rewe, Milch und Brot, Speichern.',
      'Früheren Einkauf finden: „Vorheriger Monat“, einen markierten Tag und den Einkauf antippen.',
      'Bearbeiten: im Einkauf „Bearbeiten“, ändern, Speichern.',
      'Leerer Verlauf: oben „Leerer Verlauf“; der Kalender bleibt, ohne Waben.',
    ],
    plus: 'Gut für „wann waren wir zuletzt auf dem Markt?“ und zum Nachtragen an einem bestimmten Tag.',
    minus: 'Auf dem Handy eng; die Inhalte sieht man erst nach einem Tipp.',
  },
  {
    slug: 'relist-from-past-trip',
    title: '5 Nochmal einkaufen',
    pitch: 'Ein Einkauf aus dem Verlauf wird zur Vorlage: Artikel wählen und auf die aktuelle Liste setzen.',
    steps: [
      'Eintragen: „Einkauf eintragen“, Rewe, Heute, Milch und Brot, Speichern.',
      'Früheren Einkauf finden: einen Einkauf antippen, Artikel wählen, „… auf die Liste“; der Tab „Liste“ zeigt sie.',
      'Bearbeiten: im Einkauf „Bearbeiten“, ändern, Speichern.',
      'Leerer Verlauf: oben „Leerer Verlauf“.',
    ],
    plus: 'Der Verlauf spart beim nächsten Mal Tipparbeit; was schon auf der Liste steht, wird nicht doppelt gesetzt.',
    minus: 'Überschneidet sich mit „Zuletzt verwendet“ im Hinzufügen; braucht einen Verlauf, um nützlich zu sein.',
  },
];

const params = new URLSearchParams(location.hash.slice(1));
const ui = {
  a: approaches.find((x) => x.slug === params.get('a'))?.slug ?? approaches[0].slug,
  scenario: params.get('s') === 'empty' ? 'empty' : 'history',
};
let s;
function reset() {
  s = m.seed(ui.scenario);
  Object.assign(ui, {
    tab: ui.a === 'post-shop-entry-sheet' ? 'list' : 'log',
    view: null,
    sheet: null,
    toast: null,
    month: m.TODAY.slice(0, 7),
    day: m.TODAY,
    open: new Set(['rewe']),
    pick: null,
    later: new Set(),
  });
  history.replaceState(null, '', `#a=${ui.a}&s=${ui.scenario}`);
}

const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const icon = (n) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[n]}"/></svg>`;
const btn = (act, label, { cls = '', arg = '', aria = '', disabled = false } = {}) =>
  `<button class="${cls}" data-act="${act}" data-arg="${esc(arg)}"${aria ? ` aria-label="${esc(aria)}"` : ''}${disabled ? ' disabled' : ''}>${label}</button>`;
const primary = (act, label, arg = '', disabled = false) =>
  `<span class="hexbtn${disabled ? ' off' : ''}">${btn(act, label, { arg, disabled })}</span>`;

function tripCard(t, { showStore = true, showDate = true } = {}) {
  const head = [showDate ? m.dayLabel(t.date) : '', showStore ? m.storeName(t.store) : ''].filter(Boolean).join(' · ');
  return btn('trip', `
    <span class="card-head"><span class="store-mark">${icon('storefront_outlined')}</span><span class="card-title">${esc(head)}</span>
    <span class="count">${m.countLabel(t.items.length, 'Artikel', 'Artikel')}</span></span>
    <span class="card-sub">${esc(m.summary(t.items))}</span>`, { cls: 'card', arg: t.id, aria: `${m.longDay(t.date)}, ${m.storeName(t.store)}, ${m.summary(t.items, 9)}` });
}

const fab = (label = 'Einkauf eintragen', arg = '') => `<div class="fab">${primary('new', `${icon('add')}<span>${label}</span>`, arg)}</div>`;

function empty(title, body, action = '') {
  return `<div class="empty"><div class="empty-hex">${icon('shopping_basket_outlined')}</div><p class="empty-title">${title}</p><p class="empty-body">${body}</p>${action}</div>`;
}
const freeLine = 'Eintragen und Nachschauen sind kostenlos.';

function journal() {
  const trips = m.tripsByDate(s);
  if (!trips.length) {
    return empty('Noch keine Einkäufe', `Trag nach dem Einkauf ein, was du gekauft hast. So findet ihr später, wann ihr wo was geholt habt. ${freeLine}`) + fab();
  }
  let out = '';
  let last = '';
  for (const t of trips) {
    const p = m.periodLabel(t.date);
    if (p !== last) out += `<p class="section">${p}</p>`;
    last = p;
    out += tripCard(t);
  }
  return out + fab();
}

function storeTimeline() {
  const lastDate = (id) => m.tripsAt(s, id)[0]?.date ?? '';
  const order = [...m.stores].sort((x, y) => lastDate(y.id).localeCompare(lastDate(x.id)));
  let out = s.trips.length ? '' : `<p class="hint">Noch keine Einkäufe eingetragen. Wähl einen Laden und trag ein, was du dort gekauft hast. ${freeLine}</p>`;
  for (const st of order) {
    const trips = m.tripsAt(s, st.id);
    const open = ui.open.has(st.id);
    const meta = trips.length ? `${m.countLabel(trips.length, 'Einkauf', 'Einkäufe')} · zuletzt ${m.inline(trips[0].date)}` : 'Noch nichts eingetragen';
    out += `<div class="store-block">${btn('toggle', `
      <span class="store-mark big">${icon('storefront_outlined')}</span>
      <span class="store-text"><span class="card-title">${esc(st.name)}</span><span class="card-sub">${meta}</span></span>
      ${icon(open ? 'expand_less' : 'expand_more')}`, { cls: 'store-head', arg: st.id, aria: `${st.name}, ${meta}` }).replace('<button', `<button aria-expanded="${open}"`)}`;
    if (open) {
      out += '<div class="store-trips">';
      for (const t of trips) {
        out += btn('trip', `<span class="date">${m.dayLabel(t.date)}</span><span class="card-sub">${esc(m.summary(t.items, 2))}</span>${icon('chevron_right')}`, {
          cls: 'row',
          arg: t.id,
          aria: `${m.longDay(t.date)}, ${m.summary(t.items, 9)}`,
        });
      }
      out += btn('new', `${icon('add')}<span>Einkauf bei ${esc(st.name)} eintragen</span>`, { cls: 'row add', arg: `store=${st.id}` });
      out += '</div>';
    }
    out += '</div>';
  }
  return out + fab();
}

function plainHistory() {
  const trips = m.tripsByDate(s);
  const body = trips.length
    ? trips.map((t) => tripCard(t)).join('')
    : empty('Noch keine Einkäufe', `Hak auf der Liste ab, was du gekauft hast. Danach kannst du den Einkauf mit einem Tipp eintragen. ${freeLine}`);
  return body + fab(trips.length ? 'Einkauf nachtragen' : 'Einkauf eintragen');
}

function calendar() {
  const [y, mo] = ui.month.split('-').map(Number);
  const first = `${ui.month}-01`;
  const lead = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  let cells = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => `<span class="dow">${d}</span>`).join('');
  cells += '<span></span>'.repeat(lead);
  for (let d = 1; d <= days; d++) {
    const date = `${ui.month}-${String(d).padStart(2, '0')}`;
    const n = m.tripsOn(s, date).length;
    const future = date > m.TODAY;
    const cls = ['day', date === m.TODAY ? 'today' : '', date === ui.day ? 'sel' : '', future ? 'future' : ''].join(' ');
    const dots = '<span class="dot"></span>'.repeat(Math.min(n, 3));
    cells += btn('day', `<span class="num">${d}</span><span class="dots">${dots}</span>`, {
      cls,
      arg: date,
      disabled: future,
      aria: `${m.longDay(date)}${n ? `, ${m.countLabel(n, 'Einkauf', 'Einkäufe')}` : ''}`,
    });
  }
  const atEnd = ui.month === m.TODAY.slice(0, 7);
  const dayTrips = m.tripsOn(s, ui.day);
  const panel = dayTrips.length
    ? dayTrips.map((t) => tripCard(t, { showDate: false })).join('')
    : `<p class="hint">${s.trips.length ? 'An diesem Tag ist nichts eingetragen.' : `Noch keine Einkäufe eingetragen. Wähl einen Tag und trag ein, was du gekauft hast. ${freeLine}`}</p>`;
  return `<div class="cal-head">${btn('month', icon('chevron_left'), { cls: 'icon-btn', arg: '-1', aria: 'Vorheriger Monat' })}
    <span class="card-title">${m.monthLabel(ui.month)}</span>
    ${btn('month', icon('chevron_right'), { cls: 'icon-btn', arg: '1', aria: 'Nächster Monat', disabled: atEnd })}</div>
    <div class="grid">${cells}</div>
    <p class="section">${m.longDay(ui.day)}</p>${panel}
    ${fab(`Einkauf ${ui.day === m.TODAY ? 'von heute' : `vom ${m.shortDay(ui.day)}`} eintragen`, `date=${ui.day}`)}`;
}

function relistHome() {
  const trips = m.tripsByDate(s);
  if (!trips.length) {
    return empty('Noch keine Einkäufe', `Trag ein, was du gekauft hast. Beim nächsten Mal setzt du einen alten Einkauf mit zwei Tipps wieder auf die Liste. ${freeLine}`) + fab();
  }
  return `<p class="hint">Tipp einen Einkauf an, um Artikel daraus wieder auf die Liste zu setzen.</p>${trips.map((t) => tripCard(t)).join('')}${fab()}`;
}

function tripView(t) {
  const relisting = ui.a === 'relist-from-past-trip';
  if (relisting && !ui.pick) ui.pick = new Set(t.items.filter((x) => !m.onList(s, x.name)).map((x) => x.name));
  const rows = t.items.map((x) => {
    const already = m.onList(s, x.name);
    const label = `<span class="item-name">${esc(x.name)}</span>${x.qty ? `<span class="qty">${esc(x.qty)}</span>` : ''}`;
    if (!relisting) return `<li class="item">${label}</li>`;
    if (already) return `<li class="item muted">${label}<span class="tag">steht schon drauf</span></li>`;
    const on = ui.pick.has(x.name);
    return `<li class="item">${btn('pick', `<span class="hex-tick${on ? ' on' : ''}">${on ? icon('check') : ''}</span>${label}`, { cls: 'pick', arg: x.name, aria: `${x.name} auswählen` }).replace('<button', `<button aria-pressed="${on}"`)}</li>`;
  }).join('');
  const n = relisting ? ui.pick.size : 0;
  return `<div class="trip-head"><p class="trip-store">${esc(m.storeName(t.store))}</p><p class="card-sub">${m.longDay(t.date)} · eingetragen von ${esc(t.by)}</p></div>
    <ul class="items">${rows}</ul>
    <div class="actions">${btn('edit', `${icon('edit_outlined')}<span>Bearbeiten</span>`, { cls: 'ghost', arg: t.id })}</div>
    ${relisting ? `<div class="fab">${primary('relist', `${icon('playlist_add')}<span>${n ? `${m.countLabel(n, 'Artikel', 'Artikel')} auf die Liste` : 'Nichts ausgewählt'}</span>`, t.id, !n)}</div>` : ''}`;
}

function listView() {
  const open = s.list.filter((x) => !x.done);
  const done = s.list.filter((x) => x.done);
  let out = '';
  if (ui.a === 'post-shop-entry-sheet') {
    for (const st of m.stores) {
      const ticked = done.filter((x) => x.store === st.id);
      if (!ticked.length || open.some((x) => x.store === st.id) || ui.later.has(st.id)) continue;
      out += `<div class="prompt"><p class="card-title">Einkauf bei ${esc(st.name)} eintragen?</p>
        <p class="card-sub">${m.countLabel(ticked.length, 'Artikel', 'Artikel')} heute abgehakt: ${esc(m.summary(ticked, 4))}</p>
        <div class="prompt-actions">${btn('later', 'Später', { cls: 'ghost', arg: st.id })}${primary('new', 'Eintragen', `store=${st.id}&from=ticks`)}</div></div>`;
    }
  }
  for (const st of m.stores) {
    const rows = open.filter((x) => x.store === st.id);
    if (!rows.length) continue;
    out += `<p class="section">${esc(st.name)}</p>`;
    out += rows.map((x) => `<div class="list-row">${btn('tick', '<span class="hex-tick"></span>', { cls: 'tick', arg: x.id, aria: `${x.name} abhaken` })}<span class="item-name">${esc(x.name)}</span>${x.qty ? `<span class="qty">${esc(x.qty)}</span>` : ''}</div>`).join('');
  }
  if (!open.length) out += '<p class="hint">Alles erledigt.</p>';
  if (done.length) {
    out += '<p class="section">Abgehakt</p>';
    out += done.map((x) => `<div class="list-row done">${btn('untick', `<span class="hex-tick on">${icon('check')}</span>`, { cls: 'tick', arg: x.id, aria: `${x.name} zurückholen` })}<span class="item-name">${esc(x.name)}</span></div>`).join('');
  }
  return out;
}

const canSave = () => Boolean(ui.sheet.draft.store && (ui.sheet.pending.trim() || ui.sheet.draft.items.some((x) => x.name.trim())));

function sheet() {
  const d = ui.sheet.draft;
  const storeChips = m.stores.map((st) => btn('dstore', esc(st.name), { cls: `chip${d.store === st.id ? ' on' : ''}`, arg: st.id }).replace('<button', `<button aria-pressed="${d.store === st.id}"`)).join('');
  const yesterday = m.addDays(m.TODAY, -1);
  const other = d.date !== m.TODAY && d.date !== yesterday;
  const dateChip = (date, label) => btn('ddate', label, { cls: `chip${d.date === date ? ' on' : ''}`, arg: date }).replace('<button', `<button aria-pressed="${d.date === date}"`);
  const items = d.items.map((x, n) => `<div class="edit-row">
    <input class="field name" data-field="name" data-n="${n}" value="${esc(x.name)}" aria-label="Artikel ${n + 1}">
    <input class="field qty" data-field="qty" data-n="${n}" value="${esc(x.qty)}" placeholder="Menge" aria-label="Menge ${n + 1}">
    ${btn('drm', icon('close'), { cls: 'icon-btn', arg: String(n), aria: `${x.name || 'Artikel'} entfernen` })}</div>`).join('');
  return `<div class="scrim" data-act="close"></div><div class="sheet" role="dialog" aria-label="${ui.sheet.edit ? 'Einkauf bearbeiten' : 'Einkauf eintragen'}">
    <div class="sheet-head"><p class="sheet-title">${ui.sheet.edit ? 'Einkauf bearbeiten' : 'Einkauf eintragen'}</p>${btn('close', icon('close'), { cls: 'icon-btn', aria: 'Schließen' })}</div>
    ${ui.sheet.ticksFrom ? '<p class="card-sub">Aus deinen Häkchen von heute. Ergänz, was nicht auf der Liste stand.</p>' : ''}
    <p class="label">Laden</p><div class="chips">${storeChips}</div>
    <p class="label">Wann</p><div class="chips">${dateChip(m.TODAY, 'Heute')}${dateChip(yesterday, 'Gestern')}
      <label class="chip date${other ? ' on' : ''}">${icon('event_outlined')}<span>${other ? m.dayLabel(d.date) : 'Anderer Tag'}</span><input type="date" data-field="date" max="${m.TODAY}" value="${d.date}" aria-label="Anderer Tag"></label></div>
    <p class="label">Gekauft</p>${items}
    <div class="edit-row"><input class="field name" id="add-field" data-field="pending" value="${esc(ui.sheet.pending)}" placeholder="Artikel hinzufügen" aria-label="Artikel hinzufügen" enterkeyhint="done">
      ${btn('dadd', icon('add'), { cls: 'icon-btn', aria: 'Hinzufügen' })}</div>
    <div class="sheet-foot">${ui.sheet.edit ? btn('delete', `${icon('delete_outline')}<span>Löschen</span>`, { cls: 'ghost', arg: d.id }) : '<span></span>'}
      ${primary('save', 'Speichern', '', !canSave())}</div></div>`;
}

const screen = document.getElementById('screen');
const title = document.getElementById('appbar-title');
const lead = document.getElementById('appbar-lead');

function render(focusAdd = false) {
  const t = ui.view && m.trip(s, ui.view);
  if (ui.view && !t) ui.view = null;
  lead.innerHTML = t ? btn('back', icon('arrow_back'), { cls: 'icon-btn', aria: 'Zurück' }) : '';
  title.textContent = t ? 'Einkauf' : ui.tab === 'list' ? 'Einkaufsliste' : 'Verlauf';
  let body;
  if (t) body = tripView(t);
  else if (ui.tab === 'list') body = listView();
  else {
    body = {
      'trip-journal-by-date': journal,
      'store-timeline': storeTimeline,
      'post-shop-entry-sheet': plainHistory,
      'calendar-trip-browse': calendar,
      'relist-from-past-trip': relistHome,
    }[ui.a]();
  }
  const openCount = s.list.filter((x) => !x.done).length;
  const nav = `<nav class="nav">${btn('tab', `${icon('checklist')}<span>Liste${openCount ? ` (${openCount})` : ''}</span>`, { cls: ui.tab === 'list' ? 'on' : '', arg: 'list' })}
    ${btn('tab', `${icon('history')}<span>Verlauf</span>`, { cls: ui.tab === 'log' ? 'on' : '', arg: 'log' })}</nav>`;
  const toast = ui.toast ? `<div class="toast" role="status"><span>${esc(ui.toast.text)}</span>${ui.toast.undo ? btn('undo', 'Rückgängig') : ''}</div>` : '';
  screen.innerHTML = `<div class="body">${body}</div>${toast}${nav}${ui.sheet ? sheet() : ''}`;
  if (focusAdd) document.getElementById('add-field')?.focus();
  renderPanel();
}

let toastTimer;
function toast(text, undo) {
  ui.toast = { text, undo };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    ui.toast = null;
    document.querySelector('.toast')?.remove();
  }, 6000);
}

function draftFrom(arg) {
  const p = new URLSearchParams(arg);
  const store = p.get('store') ?? '';
  const fromTicks = p.get('from') === 'ticks';
  const items = fromTicks ? s.list.filter((x) => x.done && x.store === store).map((x) => ({ name: x.name, qty: x.qty })) : [];
  return { draft: { store, date: p.get('date') ?? m.TODAY, items }, ticksFrom: fromTicks ? store : null, edit: false, pending: '' };
}

function addFromField() {
  const name = ui.sheet.pending.trim();
  if (!name) return;
  ui.sheet.draft.items.push({ name, qty: '' });
  ui.sheet.pending = '';
  render(true);
}

const actions = {
  tab: (a) => Object.assign(ui, { tab: a, view: null, pick: null, toast: null }),
  trip: (a) => Object.assign(ui, { view: a, pick: null, toast: null }),
  back: () => Object.assign(ui, { view: null, pick: null, toast: null }),
  toggle: (a) => (ui.open.has(a) ? ui.open.delete(a) : ui.open.add(a)),
  day: (a) => Object.assign(ui, { day: a, toast: null }),
  month: (a) => {
    const [y, mo] = ui.month.split('-').map(Number);
    ui.month = m.iso(new Date(Date.UTC(y, mo - 1 + Number(a), 1))).slice(0, 7);
    ui.day = ui.month === m.TODAY.slice(0, 7) ? m.TODAY : (m.tripsByDate(s).find((t) => t.date.startsWith(ui.month))?.date ?? `${ui.month}-01`);
    ui.toast = null;
  },
  new: (a) => (ui.sheet = draftFrom(a)),
  edit: (a) => {
    const t = m.trip(s, a);
    ui.sheet = { draft: structuredClone(t), edit: true, ticksFrom: null, pending: '' };
  },
  close: () => (ui.sheet = null),
  dstore: (a) => (ui.sheet.draft.store = a),
  ddate: (a) => (ui.sheet.draft.date = a),
  drm: (a) => ui.sheet.draft.items.splice(Number(a), 1),
  dadd: () => addFromField(),
  save: () => {
    addFromField();
    const { draft, edit, ticksFrom } = ui.sheet;
    const id = m.saveTrip(s, draft);
    if (ticksFrom) s.list = s.list.filter((x) => !(x.done && x.store === ticksFrom));
    Object.assign(ui, { sheet: null, pick: null });
    if (edit) toast('Änderungen gespeichert');
    else {
      toast(`Einkauf bei ${m.storeName(draft.store)} eingetragen`);
      if (ui.a === 'calendar-trip-browse') Object.assign(ui, { day: draft.date, month: draft.date.slice(0, 7) });
      if (ui.a === 'store-timeline') ui.open.add(draft.store);
    }
    return id;
  },
  delete: (a) => {
    const gone = m.deleteTrip(s, a);
    Object.assign(ui, { sheet: null, view: null });
    toast('Einkauf gelöscht', () => s.trips.push(gone));
  },
  undo: () => {
    ui.toast?.undo?.();
    ui.toast = null;
  },
  pick: (a) => (ui.pick.has(a) ? ui.pick.delete(a) : ui.pick.add(a)),
  relist: (a) => {
    const t = m.trip(s, a);
    const added = m.relist(s, t.items.filter((x) => ui.pick.has(x.name)), t.store);
    ui.pick = null;
    toast(`${m.countLabel(added.length, 'Artikel', 'Artikel')} auf die Liste gesetzt`);
  },
  tick: (a) => (s.list.find((x) => x.id === a).done = true),
  untick: (a) => (s.list.find((x) => x.id === a).done = false),
  later: (a) => ui.later.add(a),
};

screen.addEventListener('click', (e) => {
  if (e.target.matches('input[type="date"]')) return e.target.showPicker?.();
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const act = el.dataset.act;
  actions[act](el.dataset.arg ?? '');
  render(act === 'dadd');
});
document.getElementById('appbar-lead').addEventListener('click', (e) => {
  if (e.target.closest('[data-act="back"]')) {
    actions.back();
    render();
  }
});
screen.addEventListener('input', (e) => {
  const f = e.target.dataset.field;
  if (!f || !ui.sheet) return;
  if (f === 'date') {
    if (e.target.value) ui.sheet.draft.date = e.target.value;
    return render();
  }
  if (f === 'pending') ui.sheet.pending = e.target.value;
  else ui.sheet.draft.items[Number(e.target.dataset.n)][f] = e.target.value;
  const ok = canSave();
  const save = screen.querySelector('[data-act="save"]');
  save.disabled = !ok;
  save.parentElement.classList.toggle('off', !ok);
});
screen.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'add-field') addFromField();
});

const tabs = document.getElementById('tabs');
const scen = document.getElementById('scenarios');
function renderPanel() {
  const a = approaches.find((x) => x.slug === ui.a);
  tabs.innerHTML = approaches.map((x) => `<button data-a="${x.slug}" aria-pressed="${x.slug === ui.a}"><span>${x.title}</span><code>${x.slug}</code></button>`).join('');
  scen.innerHTML = [['history', 'Mit Verlauf'], ['empty', 'Leerer Verlauf']].map(([k, l]) => `<button data-s="${k}" aria-pressed="${k === ui.scenario}">${l}</button>`).join('');
  document.getElementById('pitch').textContent = a.pitch;
  document.getElementById('steps').innerHTML = a.steps.map((x) => `<li>${esc(x)}</li>`).join('');
  document.getElementById('plus').textContent = a.plus;
  document.getElementById('minus').textContent = a.minus;
}
const pickApproach = (slug) => {
  ui.a = slug;
  reset();
  render();
};
tabs.addEventListener('click', (e) => {
  const b = e.target.closest('[data-a]');
  if (b) pickApproach(b.dataset.a);
});
scen.addEventListener('click', (e) => {
  const b = e.target.closest('[data-s]');
  if (!b) return;
  ui.scenario = b.dataset.s;
  reset();
  render();
});
document.getElementById('reset').addEventListener('click', () => {
  reset();
  render();
});
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input') || !/^[1-5]$/.test(e.key)) return;
  pickApproach(approaches[Number(e.key) - 1].slug);
});

reset();
render();
