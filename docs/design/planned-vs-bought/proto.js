import {
  scenarios, initialState, start, finish, next, toggle, addDuring, logBought, newId, nextTrip,
  classify, summary, priceSum, euro, pastTrips, ME,
} from './model.js';

export const approaches = [
  { slug: 'snapshot-vs-ticked-list', title: '1 · Liste mit Startstand', render: snapshotList },
  { slug: 'trip-review-unplanned', title: '2 · Rückblick nach dem Einkauf', render: tripReview },
  { slug: 'weekly-plan-kept', title: '3 · Wochenübersicht', render: weekly },
  { slug: 'aisle-plan-badge', title: '4 · Markierung in der Liste', render: badgeList },
  { slug: 'two-column-receipt-optional', title: '5 · Zwei Spalten, Bon optional', render: twoColumn },
];

const params = new URLSearchParams(location.hash.slice(1));
const ui = {
  approach: params.get('a') ?? approaches[0].slug,
  prices: params.get('prices') === '1',
  receiptColumn: false,
  openTrip: null,
  review: params.get('review') === '1',
};
let state = initialState(params.get('s') ?? 'basic', { played: params.get('played') !== '0' });
if (params.get('done') === '1') finish(state);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const price = (r) => (ui.prices && r.price != null ? `<span class="price">${euro(r.price)}</span>` : '');
const who = (r) => (r.origin === 'logged' ? 'nachgetragen' : r.by === ME ? 'von dir' : `von ${esc(r.by)}`);

function row(r, { badge = '', note = '', tick = true } = {}) {
  return `<li class="row ${r.bought ? 'bought' : ''}">
    <button class="check" ${tick ? `data-act="toggle" data-id="${r.id}"` : 'disabled'}
      aria-label="${esc(r.name)} ${r.bought ? 'abhaken rückgängig' : 'abhaken'}" aria-pressed="${r.bought}">
      <span class="box">${r.bought ? '✓' : ''}</span></button>
    <span class="name">${esc(r.name)}</span>${badge}
    <span class="meta">${note}${price(r)}</span>
  </li>`;
}

function sumLine(rows, label) {
  if (!ui.prices || !rows.length) return '';
  const s = priceSum(rows);
  return s.complete
    ? `<p class="sum">${label}: <b>${euro(s.total)}</b></p>`
    : `<p class="sum muted">${label}: Preis fehlt bei ${s.missing} von ${s.of}</p>`;
}

function addBar() {
  if (state.phase === 'done') return '';
  return `<form class="addbar" data-form="add">
    <input name="name" placeholder="Artikel" aria-label="Artikel" autocomplete="off">
    <button class="hex ghost" name="mode" value="add" type="submit">Dazuschreiben</button>
    <button class="hex ghost" name="mode" value="log" type="submit">Schon gekauft</button>
  </form>`;
}

function phaseBar() {
  if (state.phase === 'before') {
    return `<div class="phase"><button class="hex primary" data-act="start">Einkauf starten</button>
      <p class="hint">Beim Start merkt sich Snacklist, was auf der Liste steht.</p></div>`;
  }
  if (state.phase === 'shopping') {
    return `<div class="phase"><button class="hex" data-act="finish">Einkauf beenden</button></div>`;
  }
  return '';
}

function snapshotList() {
  const rows = classify(state);
  if (state.phase === 'before') return plainList(rows);
  const planned = rows.filter((r) => r.planned);
  const later = rows.filter((r) => !r.planned);
  const s = summary(rows);
  return `
    <p class="lede">${s.planned
      ? `${s.plannedBought} von ${s.planned} von der Liste gekauft${s.extra ? ` · ${s.extra} zusätzlich` : ''}`
      : `Ohne Liste losgegangen${s.bought ? ` · ${s.bought} gekauft` : ''}`}</p>
    <h3>Beim Start auf der Liste</h3>
    ${planned.length ? `<ul>${planned.map((r) => row(r)).join('')}</ul>` : '<p class="empty">Die Liste war leer.</p>'}
    <h3>Seit dem Start dazugekommen</h3>
    ${later.length ? `<ul class="later">${later.map((r) => row(r, { note: who(r) })).join('')}</ul>` : '<p class="empty">Noch nichts.</p>'}
    ${sumLine(later.filter((r) => r.bought), 'Zusätzlich gekauft')}
    ${addBar()}${phaseBar()}`;
}

function plainList(rows) {
  const open = rows.filter((r) => !r.bought);
  const done = rows.filter((r) => r.bought);
  return `
    ${rows.length ? '' : '<p class="empty">Die Liste ist leer.</p>'}
    <ul>${open.map((r) => row(r)).join('')}</ul>
    ${done.length ? `<h3>Erledigt</h3><ul>${done.map((r) => row(r)).join('')}</ul>` : ''}
    ${addBar()}${phaseBar()}`;
}

function tripReview() {
  const rows = classify(state);
  if (state.phase !== 'done' || !ui.review) {
    const html = plainList(rows);
    return state.phase === 'done'
      ? `${html}<div class="phase"><button class="hex primary" data-act="review">Rückblick ansehen</button></div>`
      : html;
  }
  const extra = rows.filter((r) => r.kind === 'extra');
  const kept = rows.filter((r) => r.kind === 'planned-bought');
  const reclassButton = (r) => `<button class="toggle ${state.reclassified.has(r.id) ? 'on' : ''}" data-act="reclass" data-id="${r.id}"
    aria-pressed="${state.reclassified.has(r.id)}">War geplant</button>`;
  const open = rows.filter((r) => !r.bought);
  const s = summary(rows);
  return `
    <section class="sheet">
      <h2>Einkauf fertig</h2>
      <p class="lede">${s.bought} gekauft${s.planned ? ` · ${s.plannedBought} von ${s.planned} von der Liste` : ''}</p>
      ${s.bought ? '' : '<p class="empty">Nichts gekauft. Die Liste bleibt, wie sie ist.</p>'}
      ${s.bought ? `<div class="card highlight">
        <h3>${state.snapshot.size ? 'Nicht auf der Liste beim Start' : 'Ohne Liste gekauft'}</h3>
        ${extra.length ? `<ul>${extra.map((r) => `<li class="row">
            <span class="name">${esc(r.name)}</span><span class="meta">${who(r)}${price(r)}</span>
            ${reclassButton(r)}</li>`).join('')}</ul>
            <p class="hint">„War geplant“ zählt den Artikel zur Liste, wenn er nur nicht aufgeschrieben war.</p>`
          : '<p class="empty">Alles stand auf der Liste.</p>'}
        ${sumLine(extra, 'Zusammen')}
      </div>` : ''}
      ${kept.length ? `<details ${state.reclassified.size ? 'open' : ''}><summary>Wie geplant (${kept.length})</summary><ul>${kept.map((r) => (state.reclassified.has(r.id)
        ? `<li class="row"><span class="name">${esc(r.name)}</span><span class="meta">${who(r)}${price(r)}</span>${reclassButton(r)}</li>`
        : row(r, { tick: false }))).join('')}</ul></details>` : ''}
      ${open.length ? `<div class="card"><h3>Nicht gekauft (${open.length})</h3>
        <p class="hint">Bleibt auf der Liste für das nächste Mal, außer du entfernst es.</p>
        <ul>${open.map((r) => `<li class="row"><span class="name">${esc(r.name)}</span>
          <button class="toggle ${state.removed.has(r.id) ? 'on' : ''}" data-act="remove" data-id="${r.id}" aria-pressed="${state.removed.has(r.id)}">${state.removed.has(r.id) ? 'Entfernt' : 'Entfernen'}</button></li>`).join('')}</ul></div>` : ''}
      <div class="phase"><button class="hex primary" data-act="close-review">Fertig</button></div>
    </section>`;
}

function weekly() {
  const rows = classify(state);
  const current = state.phase === 'before' ? [] : rows.filter((r) => r.planned || r.bought)
    .map((r) => [r.name, r.planned, r.bought, r.price]);
  const trips = [...pastTrips, ...(current.length || state.phase !== 'before'
    ? [{ day: 'Heute', store: 'Supermarkt', rows: current, live: state.phase === 'shopping' }] : [])];
  const all = trips.flatMap((t) => t.rows);
  const n = (f) => all.filter(f).length;
  const closed = trips.filter((t) => !t.live).flatMap((t) => t.rows);
  const extras = all.filter(([, p, b]) => !p && b).map(([name, , , price]) => ({ name, price }));
  const tripLine = (t) => {
    if (t.live) return `läuft, ${t.rows.filter(([, , b]) => b).length} gekauft bis jetzt`;
    const pb = t.rows.filter(([, p, b]) => p && b).length;
    const p = t.rows.filter(([, pl]) => pl).length;
    const x = t.rows.filter(([, pl, b]) => !pl && b).length;
    return p ? `${pb} von ${p} geplanten gekauft${x ? `, ${x} zusätzlich` : ''}` : x ? `${x} gekauft, ohne Liste` : 'nichts gekauft';
  };
  return `
    <h2>Diese Woche</h2>
    <div class="stats">
      <div class="stat"><b>${n(([, p, b]) => p && b)}</b><span>geplant und gekauft</span></div>
      <div class="stat"><b>${n(([, p, b]) => !p && b)}</b><span>zusätzlich</span></div>
      <div class="stat"><b>${closed.filter(([, p, b]) => p && !b).length}</b><span>nicht gekauft</span></div>
    </div>
    ${sumLine(extras, 'Zusätzlich gekauft')}
    <h3>Einkäufe</h3>
    <ul class="trips">${trips.map((t, i) => `<li>
      <button class="trip" data-act="trip" data-i="${i}" aria-expanded="${ui.openTrip === i}">
        <span class="name">${t.day} · ${t.store}</span>
        <span class="meta">${tripLine(t)}</span></button>
      ${ui.openTrip === i ? `<ul class="tripitems">${t.rows.map(([name, p, b]) => `<li><span>${esc(name)}</span>
        <span class="meta">${p ? (b ? 'geplant · gekauft' : 'geplant · nicht gekauft') : 'zusätzlich'}</span></li>`).join('') || '<li class="empty">Nichts gekauft.</li>'}</ul>` : ''}
    </li>`).join('')}</ul>
    ${phaseBar()}
    ${ui.openTrip === trips.length - 1 && state.phase === 'shopping' ? `<h3>Heute abhaken</h3><ul>${rows.map((r) => row(r)).join('')}</ul>${addBar()}` : ''}`;
}

function badgeList() {
  const rows = classify(state);
  const open = rows.filter((r) => !r.bought);
  const done = rows.filter((r) => r.bought);
  const badge = (r) => (state.phase !== 'before' && !r.planned ? '<span class="badge" title="nach dem Start dazugekommen">neu</span>' : '');
  return `
    ${rows.length ? '' : '<p class="empty">Die Liste ist leer.</p>'}
    <ul>${open.map((r) => row(r, { badge: badge(r) })).join('')}</ul>
    ${done.length ? `<h3>Erledigt</h3><ul>${done.map((r) => row(r, { badge: badge(r) })).join('')}</ul>` : ''}
    ${rows.some((r) => badge(r)) ? '<p class="hint legend"><span class="badge">neu</span> kam nach dem Start des Einkaufs dazu.</p>' : ''}
    ${addBar()}${phaseBar()}`;
}

function twoColumn() {
  const rows = classify(state);
  if (state.phase === 'before') return plainList(rows);
  const order = [...rows.filter((r) => r.planned), ...rows.filter((r) => !r.planned)];
  const cols = ui.receiptColumn ? 'three' : '';
  return `
    <div class="tablebar">
      <button class="toggle ${ui.receiptColumn ? 'on' : ''}" data-act="receipt" aria-pressed="${ui.receiptColumn}">Bon-Spalte</button>
    </div>
    <p class="hint right">Vorschau: einen Bon-Abgleich gibt es noch nicht.</p>
    <div class="grid ${cols}" role="table" aria-label="Geplant und gekauft">
      <div class="gh" role="columnheader">Geplant</div><div class="gh" role="columnheader">Gekauft</div>
      ${ui.receiptColumn ? '<div class="gh muted" role="columnheader">Bon</div>' : ''}
      ${order.map((r) => `
        <div class="gc ${r.planned ? '' : 'blank'}" role="cell">${r.planned ? esc(r.name) : '–'}</div>
        <div role="cell" class="cellwrap"><button class="gc buy ${r.bought ? 'on' : ''} ${r.planned ? '' : 'extra'}" data-act="toggle" data-id="${r.id}" aria-pressed="${r.bought}">
          ${r.bought ? `✓ ${esc(r.name)}${price(r)}` : `<span class="muted">${r.planned ? 'offen' : `${esc(r.name)} · offen`}</span>`}</button></div>
        ${ui.receiptColumn ? '<div class="gc muted" role="cell">–</div>' : ''}`).join('')}
    </div>
    ${order.length ? '' : '<p class="empty">Nichts geplant, nichts gekauft.</p>'}
    ${sumLine(rows.filter((r) => r.bought && !r.planned), 'Zusätzlich gekauft')}
    ${addBar()}${phaseBar()}`;
}

function render() {
  const a = approaches.find((x) => x.slug === ui.approach) ?? approaches[0];
  document.querySelector('#tabs').innerHTML = approaches.map((x) =>
    `<button class="tab ${x.slug === a.slug ? 'on' : ''}" data-act="approach" data-slug="${x.slug}" aria-pressed="${x.slug === a.slug}">
      ${x.title}<small>${x.slug}</small></button>`).join('');
  document.querySelector('#scenarios').innerHTML = Object.entries(scenarios).map(([id, s]) =>
    `<button class="tab ${id === state.scenarioId ? 'on' : ''}" data-act="scenario" data-id="${id}" aria-pressed="${id === state.scenarioId}">${s.label}</button>`).join('');
  document.querySelector('#prices').checked = ui.prices;
  const steps = scenarios[state.scenarioId].steps.length;
  document.querySelector('#step').textContent = `Schritt ${state.step} von ${steps}`;
  document.querySelector('#next').disabled = state.step >= steps || state.phase === 'done';
  document.querySelector('[data-act="partner"]').disabled = state.phase === 'done';
  document.querySelector('#appbar-sub').textContent =
    { before: 'vor dem Einkauf', shopping: 'Einkauf läuft', done: 'Einkauf beendet' }[state.phase];
  document.querySelector('#screen').innerHTML = a.render();
  document.body.dataset.approach = a.slug;
  document.body.dataset.phase = state.phase;
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const { act, id } = el.dataset;
  if (act === 'approach') { ui.approach = el.dataset.slug; ui.openTrip = null; }
  if (act === 'scenario') { state = initialState(id); ui.review = false; }
  if (act === 'toggle') toggle(state, id);
  if (act === 'start') start(state);
  if (act === 'finish') { finish(state); ui.review = true; }
  if (act === 'review') ui.review = true;
  if (act === 'close-review') { nextTrip(state); ui.review = false; }
  if (act === 'reclass') state.reclassified.has(id) ? state.reclassified.delete(id) : state.reclassified.add(id);
  if (act === 'remove') state.removed.has(id) ? state.removed.delete(id) : state.removed.add(id);
  if (act === 'receipt') ui.receiptColumn = !ui.receiptColumn;
  if (act === 'trip') ui.openTrip = ui.openTrip === Number(el.dataset.i) ? null : Number(el.dataset.i);
  if (act === 'reset') { state = initialState(state.scenarioId, { played: false }); ui.review = false; }
  if (act === 'next') next(state);
  if (act === 'partner' && state.phase !== 'done') {
    if (state.phase === 'before') start(state);
    const name = ['Joghurt', 'Bananen', 'Reis', 'Zwiebeln'][state.items.length % 4];
    addDuring(state, { id: newId(name), name, price: null }, 'Ben');
  }
  render();
});

document.addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  const name = form.elements.name.value.trim();
  if (!name) return;
  const item = { id: newId(name), name, price: null };
  if (e.submitter?.value === 'log') logBought(state, item);
  else addDuring(state, item);
  render();
  document.querySelector('.addbar input')?.focus();
});

document.querySelector('#prices').addEventListener('change', (e) => { ui.prices = e.target.checked; render(); });

render();
