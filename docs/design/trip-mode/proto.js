import * as M from './model.js';
import { icons } from './icons.js';
import { TMS, SCENARIOS } from './variants.js';

const SEED_TRIP = {
  id: 'seed', startedAt: Date.parse('2026-11-12T17:40:00+01:00'), endedAt: Date.parse('2026-11-12T18:02:00+01:00'),
  durationMs: 22 * M.MIN, endReason: 'user', segments: [{ store: 'Lidl', from: 0 }], markedPlanned: [],
  planned: [['Kartoffeln', '🥔', true], ['Quark', '🥛', true], ['Zwiebeln', '🧅', false]].map(([name, emoji, bought]) => ({ id: name, name, emoji, qty: '', store: 'Lidl', bought })),
  added: [{ id: 'Chips', name: 'Chips', emoji: '🥔', qty: '', store: 'Lidl', bought: true, by: null }],
};

let s = M.load();
const ui = { tab: 'list', view: null, kb: false, kbText: '', pop: false, showTabs: false, panel: false, toast: null };
let promptTimer = null;
let reloading = false;

function setup(scenId, keep = {}) {
  const scen = SCENARIOS.find((x) => x.id === scenId);
  s = M.freshState(scen.items, keep.v ?? 'TM1', keep.premium ?? true);
  s.scen = scenId;
  s.step = 0;
  s.history = [structuredClone(SEED_TRIP)];
  s.freebie = null;
  Object.assign(ui, { tab: 'list', view: null, kb: false, kbText: '', pop: false, showTabs: false, toast: null });
  M.save(s);
}

if (!s) setup('S1');
const params = new URLSearchParams(location.search);
if (params.get('tm') && TMS.some((t) => t.id === params.get('tm'))) s.v = params.get('tm');
if (params.get('free') === '1') s.premium = false;

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[name]}"/></svg>`;
const tm = () => TMS.find((t) => t.id === s.v);
const scen = () => SCENARIOS.find((x) => x.id === s.scen);
const hexBtn = (label, act, extra = '') => `<span class="hexbtn"><button data-act="${act}" ${extra}>${label}</button></span>`;

// ---------- actions (taps and scenario steps share them) ----------

function tickItem(id) {
  const r = M.tick(s, id);
  if (r === 'prompt' && s.v === 'TM3') {
    clearTimeout(promptTimer);
    promptTimer = setTimeout(() => { if (s.prompt) { M.answer(s, false); render(); } }, 6000);
  }
  if (r !== 'prompt' && !s.trip && M.byId(s, id).doneAt !== null) ui.toast = { text: `${M.byId(s, id).name} abgehakt`, undo: id };
  else ui.toast = null;
}

function endNow(at, reason) {
  const entry = M.endTrip(s, at, reason);
  openSummary(entry.id, true);
}

function openSummary(id, fresh = false) {
  ui.pop = false;
  ui.kb = false;
  if (s.v === 'TM3') {
    ui.tab = 'history';
    ui.view = { kind: 'inline', id, fresh };
    if (fresh && !s.premium && !s.freebie) s.freebie = id;
  } else if (s.v === 'TM5' && fresh) {
    ui.tab = 'list';
    s.notice = { kind: 'endedCard', tripId: id };
    ui.view = null;
  } else if (s.v === 'TM4' && fresh && !s.premium) {
    ui.toast = { text: `Einkauf beendet · ${M.minutes(s.history[0].durationMs)}` };
  } else {
    ui.view = { kind: s.v === 'TM2' ? 'sheet' : 'page', id, fresh };
  }
}

const api = {
  tick: (name) => tickItem([...s.items].reverse().find((i) => i.name === name && M.isOpen(i)).id),
  yes: () => M.answer(s, true),
  no: () => M.answer(s, false),
  wait: (ms) => { M.advance(s, ms); watch(); },
  add: (name) => M.addItem(s, name),
  lea: (name) => M.addItem(s, name, 'Lea'),
  pause: () => M.pause(s),
  resume: () => M.resume(s),
  end: () => endNow(),
  keyboard: (on) => { ui.kb = on; },
  reopen: (ms, fromStep = true) => {
    M.advance(s, ms);
    if (fromStep) s.step += 1;
    M.save(s);
    sessionStorage.setItem('tm217-reopened', '1');
    reloading = true;
    location.reload();
  },
  planned: (name) => {
    const e = s.history[0];
    M.togglePlanned(e, e.added.find((r) => r.name === name).id);
  },
  resolveLong: () => {
    if (s.trip) endNow(M.lastTickAt(s), 'nudge');
    else openSummary(s.history[0].id);
    if (s.v === 'TM5') ui.view = { kind: 'page', id: s.history[0].id };
    s.notice = null;
  },
  openHistory: () => {
    ui.view = null;
    ui.tab = 'history';
    openSummary(s.history[0].id);
  },
};

function watch() {
  if (s.trip) M.POLICY[s.v].watch(s, M.now(s));
}

function runStep() {
  const step = scen().steps[s.step];
  if (!step) return;
  step.run(api);
  if (reloading) return;
  s.step += 1;
}

// ---------- the phone ----------

function itemRow(i) {
  const promptHere = s.prompt && s.prompt.itemId === i.id && s.v === 'TM5';
  const fresh = s.trip && i.addedAt > s.trip.startedAt && i.addedBy !== M.ME;
  const qty = i.qty ? `<b class="qty">${esc(i.qty)}</b> ` : '';
  if (promptHere) {
    return `<li class="row asking"><div class="row-line"><span class="emoji">${i.emoji}</span><span class="iname">${qty}${esc(i.name)}</span>
      <button class="icon-btn" data-act="undo-prompt" aria-label="Rückgängig">${icon('undo')}</button></div>
      <div class="row-ask"><span class="hexbtn"><button data-act="yes">${icon('shopping_cart')} Gekauft, Einkauf starten</button></span>
      <button class="ghost" data-act="no">Nicht mehr nötig</button></div></li>`;
  }
  return `<li class="row ${M.isOpen(i) ? '' : 'done'}"><button class="row-btn" data-act="tick" data-id="${esc(i.id)}">
    <span class="emoji">${i.emoji}</span><span class="iname">${qty}${esc(i.name)}</span>
    ${fresh ? `<span class="tag">neu · ${esc(i.addedBy)}</span>` : ''}</button></li>`;
}

function listScreen() {
  const asking = (i) => s.prompt && s.prompt.itemId === i.id && s.v === 'TM5';
  const open = s.items.filter((i) => M.isOpen(i) || asking(i));
  const done = s.items.filter((i) => !M.isOpen(i) && !asking(i));
  const groups = [...M.STORES, null].map((st) => ({ st, items: open.filter((i) => i.store === st) })).filter((g) => g.items.length);
  const promptItem = s.prompt ? M.byId(s, s.prompt.itemId) : null;
  return `
    <div class="hdr"><span class="pill-o"><span class="pillbtn">Familie Brandt ${icon('expand_more')}</span></span><span class="pill-o"><span class="pillbtn">Anpassen</span></span></div>
    ${promptItem && (s.v === 'TM1' || s.v === 'TM4') ? promptCard(promptItem) : ''}
    ${noticeCard()}
    ${groups.map((g) => `<div class="store-row"><span class="pill-o"><span class="pillbtn small">${g.st ? icon('storefront_outlined') : ''}${g.st ?? 'Ohne Laden'}</span></span><span class="rule"></span><span class="count"><b>${g.items.length}</b> Artikel</span></div>
      <ul class="rows">${g.items.map(itemRow).join('')}</ul>`).join('')}
    ${open.length ? '' : '<p class="hint center">Alles abgehakt.</p>'}
    ${done.length ? `<div class="section">Abgehakt</div><ul class="rows">${done.map(itemRow).join('')}</ul>` : ''}`;
}

function promptCard(item) {
  if (s.v === 'TM4' && item.store) {
    return `<div class="prompt sticky" role="group" aria-label="Bist du gerade bei ${item.store}?">
      <div class="prompt-title">Bist du gerade bei ${esc(item.store)}?</div>
      <p class="prompt-body">Dann läuft eine Uhr mit, pro Laden. Am Ende siehst du, was geplant war und was dazukam.</p>
      <div class="prompt-actions"><button class="link" data-act="no">Nein</button>${hexBtn(`Ja, bei ${esc(item.store)}`, 'yes')}</div></div>`;
  }
  return `<div class="prompt sticky" role="group" aria-label="Kaufst du gerade ein?">
    <div class="prompt-title">Kaufst du gerade ein?</div>
    <p class="prompt-body">${esc(item.name)} ist abgehakt. Dann läuft eine Uhr mit, und am Ende siehst du, was geplant war und was dazukam.</p>
    <div class="prompt-actions"><button class="link" data-act="no">Nein</button>${hexBtn('Ja, Einkauf starten', 'yes')}</div></div>`;
}

function noticeCard() {
  const n = s.notice;
  if (!n) return '';
  const e = s.history.find((h) => h.id === n.tripId);
  if (!e) return '';
  if (n.kind === 'autoEndedCard' || n.kind === 'endedCard') {
    const sum = M.summary(e);
    const auto = n.kind === 'autoEndedCard';
    const counts = sum.planned.length
      ? `${sum.plannedBought} von ${sum.planned.length} geplant gekauft${sum.extraBought ? ` · ${sum.extraBought} dazu` : ''}`
      : `${sum.bought} gekauft`;
    return `<div class="endcard" role="group" aria-label="Einkauf beendet">
      <div class="endcard-head">${icon('flag_outlined')}<div><div class="prompt-title">${auto ? `Einkauf um ${M.hhmm(e.endedAt)} beendet` : 'Einkauf beendet'}</div>
      <p class="prompt-body">${auto ? 'Beim letzten Abhaken, danach kam nichts mehr. ' : ''}${M.minutes(e.durationMs)} · ${counts}</p></div>
      <button class="icon-btn" data-act="dismiss-notice" aria-label="Schließen">${icon('close')}</button></div>
      <div class="prompt-actions">${auto ? '<button class="link" data-act="reopen-trip">Doch weiter</button>' : '<button class="link" data-act="reopen-trip">Weiter einkaufen</button>'}
      ${hexBtn(s.premium ? 'Übersicht ansehen' : `${icon('lock_outline')} Übersicht`, 'open-summary', `data-id="${e.id}"`)}</div></div>`;
  }
  if (n.kind === 'autoEnded') {
    return `<div class="endcard" role="group" aria-label="Einkauf beendet"><div class="endcard-head">${icon('flag_outlined')}<div>
      <div class="prompt-title">Einkauf automatisch beendet</div><p class="prompt-body">4 Stunden lang wurde nichts abgehakt. Er endet beim letzten Abhaken um ${M.hhmm(e.endedAt)}.</p></div>
      <button class="icon-btn" data-act="dismiss-notice" aria-label="Schließen">${icon('close')}</button></div>
      <div class="prompt-actions"><button class="link" data-act="reopen-trip">Doch weiter</button>${hexBtn('Übersicht ansehen', 'open-summary', `data-id="${e.id}"`)}</div></div>`;
  }
  return '';
}

const clockSpan = () => `<span class="clock" data-clock>${M.clock(M.elapsed(s))}</span>`;

function tripBar() {
  const t = s.trip;
  if (!t) return '';
  const paused = M.isPaused(t);
  const autoPaused = paused && t.pauses[t.pauses.length - 1].auto;
  const last = M.lastTickAt(s);
  if (s.v === 'TM1') {
    if (ui.kb) return '';
    if (t.nudge) {
      return `<div class="strip-bar nudge" role="group" aria-label="Einkauf"><div class="strip-text"><b>Noch beim Einkaufen?</b><small>Zuletzt abgehakt um ${M.hhmm(last)}</small></div>
        <button class="sbtn" data-act="keep-going">Weiter</button><button class="sbtn strong" data-act="end-at-last">Ende ${M.hhmm(last)}</button></div>`;
    }
    return `<div class="strip-bar" role="group" aria-label="Einkauf läuft"><span class="live ${paused ? 'off' : ''}"></span>${clockSpan()}
      <span class="strip-label">${paused ? 'Pausiert' : 'Einkauf läuft'}</span>
      <button class="sbtn" data-act="${paused ? 'resume' : 'pause'}" aria-label="${paused ? 'Weiter' : 'Pause'}">${icon(paused ? 'play_arrow' : 'pause')}</button>
      <button class="sbtn strong" data-act="end">Beenden</button></div>`;
  }
  if (s.v === 'TM2') {
    return `<div class="float-wrap"><div class="float-pill" role="group" aria-label="Einkauf läuft">${icon('timer_outlined')}${clockSpan()}
      ${paused ? `<span class="float-note">${autoPaused ? `Pause, seit ${M.hhmm(last)} nichts abgehakt` : 'Pause'}</span>` : ''}
      <button class="fbtn" data-act="${paused ? 'resume' : 'pause'}" aria-label="${paused ? 'Weiter' : 'Pause'}">${icon(paused ? 'play_arrow' : 'pause')}</button>
      <button class="fbtn end" data-act="end">Beenden</button></div></div>`;
  }
  if (s.v === 'TM4') {
    const segs = t.segments.filter((g) => g.store);
    const lapOf = (i) => {
      const from = segs[i].from;
      const to = segs[i + 1] ? segs[i + 1].from : (t.endedAt ?? M.now(s));
      return Math.max(0, to - from - pausedBetween(t, from, to));
    };
    const cur = segs[segs.length - 1];
    if (ui.kb) return `<div class="lap-thin">${icon('timer_outlined')} ${esc(cur ? cur.store : 'Einkauf')} ${clockSpan()}</div>`;
    if (t.nudge) {
      return `<div class="lap-bar nudge" role="group" aria-label="Einkauf"><div class="lap-main"><b>Noch bei ${esc(cur ? cur.store : 'dem Laden')}?</b><small>Zuletzt abgehakt um ${M.hhmm(last)}</small></div>
        <button class="sbtn" data-act="keep-going">Weiter</button><button class="sbtn strong" data-act="end-at-last">Ende ${M.hhmm(last)}</button></div>`;
    }
    return `<div class="lap-bar" role="group" aria-label="Einkauf läuft"><div class="lap-main">
      <div class="lap-now">${icon('storefront_outlined')}<b>${esc(cur ? cur.store : 'Einkauf')}</b>${paused ? '<span class="paused-tag">Pause</span>' : ''}</div>
      <small>${segs.length > 1 ? segs.map((g, i) => `${esc(g.store)} <span ${i === segs.length - 1 ? 'data-lap' : ''}>${M.clock(lapOf(i))}</span>`).join(' · ') : `seit ${M.hhmm(t.startedAt)}`}</small></div>
      ${clockSpan()}
      <button class="sbtn" data-act="${paused ? 'resume' : 'pause'}" aria-label="${paused ? 'Weiter' : 'Pause'}">${icon(paused ? 'play_arrow' : 'pause')}</button>
      <button class="sbtn strong" data-act="end">Beenden</button></div>`;
  }
  return '';
}

function pausedBetween(t, from, to) {
  return t.pauses.reduce((sum, p) => sum + Math.max(0, Math.min(p.to ?? to, to) - Math.max(p.from, from)), 0);
}

function tabPill() {
  const tabs = [['list', 'shopping_cart', 'Liste'], ['history', 'history', 'Verlauf'], ['more', 'menu', 'Mehr']];
  const t = s.trip;
  if (s.v === 'TM5' && t && !ui.showTabs) {
    const paused = M.isPaused(t);
    return `<div class="pill-wrap"><div class="pill-nav trip" role="group" aria-label="Einkauf läuft">
      <span class="trip-clock">${icon('timer_outlined')}${clockSpan()}</span>
      <button class="tbtn" data-act="${paused ? 'resume' : 'pause'}" aria-label="${paused ? 'Weiter' : 'Pause'}">${icon(paused ? 'play_arrow' : 'pause')}</button>
      <button class="tbtn end" data-act="end">Beenden</button>
      <button class="tbtn" data-act="show-tabs" aria-label="Tabs zeigen">${icon('menu')}</button></div></div>`;
  }
  const timer = s.v === 'TM3' && t
    ? `<button class="tab timer ${M.isPaused(t) ? 'paused' : ''}" data-act="pop" aria-label="Einkauf läuft, ${M.clock(M.elapsed(s))}" aria-expanded="${ui.pop}">${icon(M.isPaused(t) ? 'pause' : 'timer_outlined')}${clockSpan()}</button>`
    : '';
  const back = s.v === 'TM5' && t ? `<button class="tab" data-act="hide-tabs" aria-label="Zurück zum Einkauf">${icon('timer_outlined')}</button>` : '';
  const compact = Boolean(timer || back);
  return `<div class="pill-wrap"><div class="pill-nav ${compact ? 'compact' : ''}" role="tablist">${timer}${back}
    ${tabs.map(([id, ic, label]) => `<button class="tab ${ui.tab === id ? 'on' : ''}" role="tab" aria-selected="${ui.tab === id}" data-act="tab" data-tab="${id}">${icon(ic)}<em>${label}</em></button>`).join('')}</div></div>`;
}

function bottom() {
  const toast = ui.toast && !ui.kb
    ? `<div class="toast" role="status"><span>${esc(ui.toast.text)}</span>${ui.toast.undo ? `<button data-act="undo-tick" data-id="${esc(ui.toast.undo)}">Rückgängig</button>` : ''}</div>` : '';
  const tm3prompt = s.prompt && s.v === 'TM3' && !ui.kb
    ? `<div class="toast ask" role="group" aria-label="Kaufst du gerade ein?"><span>${esc(M.byId(s, s.prompt.itemId).name)} abgehakt. <b>Kaufst du gerade ein?</b></span>
      <button data-act="undo-prompt">Rückgängig</button><button class="go" data-act="yes">Starten</button></div>` : '';
  const kbTimer = ui.kb && s.trip && s.v === 'TM3' ? `<span class="kb-timer">${icon('timer_outlined')}${clockSpan()}</span>` : '';
  const field = `<div class="addbar ${ui.kb ? 'kb-on' : ''}"><div class="addfield"><button class="in" data-act="kb">${ui.kbText ? esc(ui.kbText) : '<span class="ph">Was brauchst du?</span>'}${ui.kb ? '<span class="caret"></span>' : ''}</button></div>${kbTimer}
    ${ui.kb ? `<button class="icon-btn" data-act="kb-close" aria-label="Tastatur schließen">${icon('expand_more')}</button>` : ''}</div>`;
  const pop = s.v === 'TM3' && ui.pop && s.trip ? tm3Popover() : '';
  const bar = tripBar();
  return `<div class="bottom" id="bottom">${tm3prompt}${toast}${pop}${bar}${ui.tab === 'list' ? field : ''}${ui.kb ? '' : `<div class="nav">${tabPill()}</div>`}</div>
    ${ui.kb ? keyboard() : ''}`;
}

function tm3Popover() {
  const t = s.trip;
  const paused = M.isPaused(t);
  return `<div class="popover" role="menu" aria-label="Einkauf">
    <div class="pop-head"><b>Einkauf läuft</b><small>seit ${M.hhmm(t.startedAt)}${paused ? ' · pausiert' : ''}</small></div>
    <button role="menuitem" data-act="${paused ? 'resume' : 'pause'}">${icon(paused ? 'play_arrow' : 'pause')} ${paused ? 'Weiter' : 'Pause'}</button>
    <button role="menuitem" data-act="end">${icon('flag_outlined')} Einkauf beenden</button></div>`;
}

function keyboard() {
  const sugg = ['Eis', 'Kerzen', 'Feta', 'Eier'];
  const rows = ['qwertzuiopü', 'asdfghjklöä', 'yxcvbnm'];
  return `<div class="kb" aria-label="Tastatur (Attrappe)"><div class="kb-sugg">${sugg.map((w) => `<button data-act="kb-add" data-name="${w}">${w}</button>`).join('')}</div>
    ${rows.map((r) => `<div class="kb-row">${[...r].map((c) => `<span>${c}</span>`).join('')}</div>`).join('')}
    <div class="kb-row"><span class="wide">123</span><span class="space">Leerzeichen</span><span class="wide">Fertig</span></div></div>`;
}

function historyScreen() {
  return `<div class="title-row"><h1 class="screen-title">Verlauf</h1></div>
    ${s.history.map((e) => {
    const sum = M.summary(e);
    const open = ui.view && ui.view.kind === 'inline' && ui.view.id === e.id;
    const stores = sum.stores.join(' + ') || 'Ohne Laden';
    return `<div class="trip-card ${open ? 'open' : ''}"><button class="trip-row" data-act="open-summary" data-id="${e.id}" aria-expanded="${open}">
      <span class="store-mark">${icon('storefront_outlined')}</span><span class="trip-text"><b>${esc(stores)} · ${M.dayLabel(e.startedAt, M.now(s))}, ${M.hhmm(e.startedAt)}</b>
      <small>${sum.bought} Artikel · ${M.minutes(e.durationMs)}</small></span>${icon(s.v === 'TM3' ? (open ? 'expand_more' : 'chevron_right') : 'chevron_right')}</button>
      ${open ? `<div class="inline-sum">${gated(e, summaryBody(e, { inline: true }))}</div>` : ''}</div>`;
  }).join('')}`;
}

// ---------- summary (approach 1: snapshot vs ticked list) ----------

function sumRow(r, e, { canMark }) {
  const marked = e.markedPlanned.includes(r.id);
  const state = r.bought ? `<span class="hex-tick on">${icon('check')}</span>` : '<span class="hex-tick"></span>';
  const meta = [r.by ? `von ${esc(r.by)}` : '', r.bought ? '' : 'nicht gekauft', s.v !== 'TM4' && r.store && M.summary(e).stores.length > 1 ? esc(r.store) : '']
    .filter(Boolean).join(' · ');
  const btn = canMark && r.bought
    ? `<button class="toggle ${marked ? 'on' : ''}" data-act="mark" data-entry="${e.id}" data-id="${esc(r.id)}" aria-pressed="${marked}">${marked ? `${icon('undo')} War geplant` : 'War geplant'}</button>` : '';
  return `<li class="sum-row ${r.bought ? '' : 'muted'}">${state}<span class="emoji">${r.emoji}</span><span class="sum-name">${esc(r.name)}${meta ? `<small>${meta}</small>` : ''}</span>${btn}</li>`;
}

function summaryBody(e, opts = {}) {
  const sum = M.summary(e);
  const reason = e.endReason === 'auto' || e.endReason === 'nudge'
    ? `<p class="hint">Beendet beim letzten Abhaken um ${M.hhmm(e.endedAt)}${e.endReason === 'auto' ? ', automatisch' : ''}.</p>` : '';
  const lede = sum.planned.length
    ? `${sum.plannedBought} von ${sum.planned.length} von der Liste gekauft${sum.extraBought ? ` · ${sum.extraBought} zusätzlich` : ''}`
    : `Ohne Liste losgegangen · ${sum.bought} gekauft`;
  const plannedRows = (rows) => rows.map((r) => (r.wasMarked ? sumRow(r, e, { canMark: true }) : sumRow(r, e, { canMark: false }))).join('');
  const sections = (rowsPlanned, rowsAdded) => `
    <h3 class="sum-h">Beim Start auf der Liste <span>${rowsPlanned.length}</span></h3>
    ${rowsPlanned.length ? `<ul class="sum-list">${plannedRows(rowsPlanned)}</ul>` : '<p class="hint">Die Liste war leer.</p>'}
    <h3 class="sum-h">Seit dem Start dazugekommen <span>${rowsAdded.length}</span></h3>
    ${rowsAdded.length ? `<ul class="sum-list">${rowsAdded.map((r) => sumRow(r, e, { canMark: true })).join('')}</ul>
      <p class="hint">„War geplant“ zählt einen Artikel zur Liste, wenn er abgesprochen war, aber nicht draufstand.</p>` : '<p class="hint">Nichts. Alles stand auf der Liste.</p>'}`;
  let body;
  if (s.v === 'TM4' && sum.stores.length > 1) {
    const segs = e.segments.filter((g) => g.store);
    body = sum.stores.map((st) => {
      const i = segs.findIndex((g) => g.store === st);
      const to = segs[i + 1] ? segs[i + 1].from : e.endedAt;
      const lap = to - segs[i].from - pausedBetween(e.trip, segs[i].from, to);
      return `<div class="store-sec"><div class="store-sec-head">${icon('storefront_outlined')}<b>${esc(st)}</b><span>${M.minutes(lap)}</span></div>
        ${sections(sum.planned.filter((r) => r.store === st), sum.added.filter((r) => r.store === st))}</div>`;
    }).join('');
  } else {
    body = sections(sum.planned, sum.added);
  }
  const head = opts.inline ? '' : `<div class="sum-head"><div class="eyebrow">${M.dayLabel(e.startedAt, M.now(s))}, ${M.hhmm(e.startedAt)} bis ${M.hhmm(e.endedAt)}${sum.stores.length ? ` · ${esc(sum.stores.join(', '))}` : ''}</div>
    <h2 class="sum-title">${M.minutes(e.durationMs)} eingekauft</h2></div>`;
  return `${head}<div class="gatearea"><p class="lede">${lede}</p>${reason}${body}</div>`;
}

// PB3a: the planned-vs-bought part is Premium. Each prototype gates it differently.
function gated(e, html) {
  if (s.premium) return html;
  const sum = M.summary(e);
  const upsell = (title, text) => `<div class="upsell" role="group" aria-label="${title}">${icon('lock_outline', 'lock')}<b>${title}</b><p>${text}</p>
    ${hexBtn('Snacklist Premium ansehen', 'premium')}</div>`;
  const head = html.slice(0, html.indexOf('<div class="gatearea">'));
  if (s.v === 'TM1') {
    return `${head}<div class="blurwrap"><div class="blurred" aria-hidden="true">${html.slice(head.length)}</div>
      ${upsell('Geplant und gekauft mit Snacklist Premium', 'Was auf der Liste stand, was dazukam und was liegen blieb, nach jedem Einkauf.')}</div>`;
  }
  if (s.v === 'TM2') {
    return `${head}<p class="lede">${sum.bought} Artikel abgehakt</p>
      ${upsell('Was war geplant, was kam dazu?', 'Snacklist Premium zeigt nach jedem Einkauf, was auf der Liste stand und was unterwegs dazukam, auch von anderen im Haushalt.')}`;
  }
  if (s.v === 'TM3') {
    if (s.freebie === e.id) return `<p class="gift">${icon('check')} Diese Übersicht zeigen wir dir einmal so. Ab dem nächsten Einkauf gehört sie zu Snacklist Premium.</p>${html}`;
    return `${head}<div class="lockrow">${icon('lock_outline')}<span>Geplant und gekauft siehst du mit Snacklist Premium</span>${hexBtn('Ansehen', 'premium')}</div>`;
  }
  if (s.v === 'TM4') {
    return `${head}<div class="lockrow">${icon('lock_outline')}<span>Geplant und gekauft pro Laden siehst du mit Snacklist Premium</span>${hexBtn('Ansehen', 'premium')}</div>`;
  }
  return `${head}<p class="lede">${sum.plannedBought} von ${sum.planned.length} von der Liste gekauft · ${sum.extraBought} zusätzlich</p>
    ${upsell('Welche das waren, zeigt Snacklist Premium', 'Die Zahlen bleiben für alle. Welche Artikel es waren, wer sie dazugeschrieben hat und „War geplant“ gehören zu Premium.')}`;
}

function summaryOverlay() {
  const v = ui.view;
  if (!v || v.kind === 'inline') return '';
  const e = s.history.find((h) => h.id === v.id);
  if (!e) return '';
  const foot = `<div class="sum-foot">${v.fresh && !s.trip ? '<button class="link" data-act="reopen-trip">Weiter einkaufen</button>' : '<span></span>'}${hexBtn('Fertig', 'close-view')}</div>`;
  const content = gated(e, summaryBody(e));
  if (v.kind === 'sheet') {
    return `<div class="scrim" data-act="close-view"></div><div class="sheet tall" role="dialog" aria-label="Einkauf beendet">
      <div class="grip"></div><div class="sheet-head"><span class="sheet-title">Einkauf beendet</span>
      <button class="icon-btn" data-act="close-view" aria-label="Schließen">${icon('close')}</button></div>${content}${foot}</div>`;
  }
  return `<div class="page" role="dialog" aria-label="Geplant und gekauft"><div class="page-bar"><button class="icon-btn" data-act="close-view" aria-label="Zurück">${icon('arrow_back')}</button>
    <span class="page-title">Geplant und gekauft</span></div><div class="page-body">${content}${foot}</div></div>`;
}

function tm2PromptSheet() {
  if (!(s.prompt && s.v === 'TM2')) return '';
  const item = M.byId(s, s.prompt.itemId);
  return `<div class="scrim"></div><div class="sheet" role="dialog" aria-label="Kaufst du gerade ein?"><div class="grip"></div>
    <p class="eyebrow">${item.emoji} ${esc(item.name)} abgehakt</p>
    <div class="sheet-title">Kaufst du gerade ein?</div>
    <p class="prompt-body">Dann läuft eine Uhr mit, und am Ende siehst du, was geplant war und was dazukam.</p>
    <div class="sheet-actions">${hexBtn('Ja, Einkauf starten', 'yes')}<button class="ghost" data-act="no">Nein, nur abgehakt</button></div>
    <p class="hint center">Aus Versehen abgehakt? <button class="link" data-act="undo-prompt">Zurücknehmen</button></p></div>`;
}

function osBanner() {
  if (!(s.notice && s.notice.kind === 'osBanner' && s.trip)) return '';
  return `<div class="os-banner" role="alert"><div class="os-app"><span class="os-icon">S</span>SNACKLIST · jetzt</div>
    <b>Einkauf läuft seit ${M.minutes(M.now(s) - s.trip.startedAt)}</b><p>Zuletzt abgehakt um ${M.hhmm(M.lastTickAt(s))}. Fertig?</p>
    <div class="os-actions"><button data-act="banner-keep">Läuft noch</button><button data-act="end-at-last">Beenden</button></div></div>`;
}

function reopenToast() {
  if (!(ui.reopened && s.trip && s.v === 'TM2')) return '';
  return `<div class="toast top" role="status">Einkauf läuft noch · seit ${M.hhmm(s.trip.startedAt)}</div>`;
}

function render() {
  if (reloading) return;
  const scroll = document.querySelector('#scroll');
  const top = scroll ? scroll.scrollTop : 0;
  const phone = document.querySelector('#phone');
  phone.dataset.v = s.v;
  const body = ui.tab === 'list' ? listScreen() : ui.tab === 'history' ? historyScreen() : '<div class="title-row"><h1 class="screen-title">Mehr</h1></div><p class="hint">Nicht Teil des Prototyps.</p>';
  phone.innerHTML = `<div class="status"><span>${M.hhmm(M.now(s))}</span><span class="status-r">5G ▮▮▮</span></div>
    <div class="scroll" id="scroll">${body}</div>${bottom()}${reopenToast()}${osBanner()}${tm2PromptSheet()}${summaryOverlay()}
    ${ui.splash ? '<div class="splash"><span class="splash-hex">S</span></div>' : ''}`;
  const sc = document.querySelector('#scroll');
  sc.scrollTop = top;
  fitBottom();
  renderPanel();
  M.save(s);
}

function fitBottom() {
  const b = document.querySelector('#bottom');
  const sc = document.querySelector('#scroll');
  const kb = document.querySelector('.kb');
  if (b && sc) sc.style.paddingBottom = `${b.offsetHeight + (kb ? kb.offsetHeight : 0) + 16}px`;
  if (b && kb) b.style.bottom = `${kb.offsetHeight}px`;
}

function updateClocks() {
  if (!s.trip) return;
  const txt = M.clock(M.elapsed(s));
  for (const el of document.querySelectorAll('[data-clock]')) el.textContent = txt;
  const st = document.querySelector('.status span');
  if (st) st.textContent = M.hhmm(M.now(s));
}

// ---------- the panel ----------

function renderPanel() {
  const t = tm();
  const sc = scen();
  const pol = M.POLICY[s.v];
  const steps = sc.steps.map((st, i) => `<li class="${i < s.step ? 'done' : i === s.step ? 'next' : ''}">${esc(st.label)}</li>`).join('');
  document.querySelector('#panel').innerHTML = `
    <button class="panel-close" data-act="panel" aria-label="Schließen">${icon('close')}</button>
    <h1>Einkaufsmodus</h1>
    <p class="note">Wegwerf-Prototypen (Job 217), keine App-Oberfläche. Erfundene Daten, nur Deutsch. Hier ist Sa., 14. Nov. 2026, Uhrzeit Europe/Berlin; die Uhr läuft echt und lässt sich vorspulen.</p>
    <h2>Prototyp <span class="note">(Tasten 1 bis 5)</span></h2>
    <div class="tabs">${TMS.map((x) => `<button data-act="tm" data-tm="${x.id}" aria-pressed="${x.id === s.v}"><span><b>${x.id}</b> ${esc(x.title)}</span><code>${x.slug}</code></button>`).join('')}</div>
    <p class="pitch">${esc(t.pitch)}</p>
    <dl class="facts"><dt>Leiste</dt><dd>${esc(t.bar)}</dd><dt>Nicht ständig fragen</dt><dd>${esc(pol.declineRule)}</dd>
      <dt>Läuft seit Stunden</dt><dd>${esc(pol.longRule)}</dd><dt>Übersicht</dt><dd>${esc(t.summary)}</dd><dt>Premium</dt><dd>${esc(t.gate)}</dd></dl>
    <p class="pm"><b>Dafür.</b> ${esc(t.plus)}</p><p class="pm"><b>Dagegen.</b> ${esc(t.minus)}</p>
    <h2>Szenario</h2>
    <div class="tabs inline wrap">${SCENARIOS.map((x) => `<button data-act="scen" data-scen="${x.id}" aria-pressed="${x.id === s.scen}">${x.id} ${esc(x.title)}</button>`).join('')}</div>
    <ol class="steps">${steps}</ol>
    <div class="row-controls">${s.step < sc.steps.length ? `<button class="primary" data-act="step">Nächster Schritt</button>` : '<span class="note">Szenario durch.</span>'}<button data-act="restart">Von vorn</button></div>
    <h2>Selbst ausprobieren</h2>
    <div class="row-controls wrap"><button data-act="wait" data-ms="${5 * M.MIN}">+5 Min.</button><button data-act="wait" data-ms="${30 * M.MIN}">+30 Min.</button><button data-act="wait" data-ms="${3 * M.HOUR}">+3 Std.</button>
      <button data-act="lea">Lea schreibt etwas dazu</button><button data-act="reopen">App beenden und neu öffnen</button></div>
    <div class="row-controls"><button data-act="premium-toggle" aria-pressed="${!s.premium}">${s.premium ? 'Premium (umschalten auf Free)' : 'Free (umschalten auf Premium)'}</button></div>
    <p class="note">Tippe Artikel zum Abhaken. „Was brauchst du?“ öffnet eine Tastatur-Attrappe mit Vorschlägen.</p>
    <p class="note"><a href="#rec" data-act="rec">Empfehlung und offene Fragen (TQ1 bis TQ12)</a></p>`;
  document.querySelector('#strip').innerHTML = `<div class="strip-tms">${TMS.map((x) => `<button data-act="tm" data-tm="${x.id}" aria-pressed="${x.id === s.v}">${x.id}</button>`).join('')}
    <button data-act="panel" aria-label="Szenarien und Einstellungen">${icon('menu')}</button></div>
    <div class="strip-step"><span>${sc.id} · ${s.step}/${sc.steps.length}${s.premium ? '' : ' · Free'}</span>${s.step < sc.steps.length ? `<button data-act="step">Weiter: ${esc(sc.steps[s.step].label)}</button>` : '<button data-act="restart">Szenario von vorn</button>'}</div>`;
  document.body.classList.toggle('panel-open', ui.panel);
}

// ---------- recommendation view ----------

async function showRec() {
  const md = await (await fetch('RECOMMENDATION.md')).text();
  const html = md.split(/\n{2,}/).map((block) => {
    const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>');
    if (block.startsWith('# ')) return `<h1>${inline(block.slice(2))}</h1>`;
    if (block.startsWith('## ')) return `<h2>${inline(block.slice(3))}</h2>`;
    if (/^(- |\d+\. )/.test(block)) {
      const items = block.split(/\n(?=- |\d+\. )/).map((li) => `<li>${inline(li.replace(/^(- |\d+\. )/, ''))}</li>`).join('');
      return /^\d/.test(block) ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
    }
    if (block.startsWith('|')) {
      const rows = block.split('\n').filter((r) => !/^\|\s*-/.test(r));
      return `<table>${rows.map((r, i) => `<tr>${r.split('|').slice(1, -1).map((c) => (i ? `<td>${inline(c.trim())}</td>` : `<th>${inline(c.trim())}</th>`)).join('')}</tr>`).join('')}</table>`;
    }
    return `<p>${inline(block)}</p>`;
  }).join('');
  const box = document.createElement('div');
  box.className = 'rec';
  box.innerHTML = `<button class="rec-close" data-act="rec-close">${icon('close')} Zurück zu den Prototypen</button>${html}`;
  document.body.append(box);
}

// ---------- events ----------

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const id = el.dataset.id;
  const was = s.trip;
  switch (act) {
    case 'tick': tickItem(id); break;
    case 'undo-tick': M.tick(s, id); ui.toast = null; break;
    case 'yes': M.answer(s, true); ui.toast = null; break;
    case 'no': M.answer(s, false); break;
    case 'undo-prompt': M.undoPromptTick(s); break;
    case 'pause': M.pause(s); break;
    case 'resume': M.resume(s); break;
    case 'end': endNow(); break;
    case 'end-at-last': endNow(M.lastTickAt(s), 'nudge'); s.notice = null; break;
    case 'keep-going': M.keepGoing(s); break;
    case 'banner-keep': s.notice = null; break;
    case 'pop': ui.pop = !ui.pop; break;
    case 'show-tabs': ui.showTabs = true; break;
    case 'hide-tabs': ui.showTabs = false; ui.tab = 'list'; break;
    case 'tab': ui.tab = el.dataset.tab; ui.view = null; ui.pop = false; break;
    case 'kb': ui.kb = true; ui.toast = null; break;
    case 'kb-close': ui.kb = false; ui.kbText = ''; break;
    case 'kb-add': M.addItem(s, el.dataset.name); ui.kbText = ''; break;
    case 'open-summary': {
      if (s.v === 'TM3' && ui.view && ui.view.id === id) ui.view = null;
      else if (s.v === 'TM4' && !s.premium) { ui.view = { kind: 'page', id }; }
      else openSummary(id);
      if (s.v === 'TM5') ui.view = { kind: 'page', id };
      break;
    }
    case 'close-view': ui.view = null; break;
    case 'mark': M.togglePlanned(s.history.find((h) => h.id === el.dataset.entry), id); break;
    case 'reopen-trip': {
      const tid = ui.view ? ui.view.id : s.notice && s.notice.tripId;
      M.reopenTrip(s, tid);
      ui.view = null;
      ui.tab = 'list';
      break;
    }
    case 'dismiss-notice': s.notice = null; break;
    case 'premium': ui.toast = { text: 'Öffnet die Premium-Seite (nicht Teil des Prototyps).' }; ui.view = null; break;
    case 'tm': s.v = el.dataset.tm; ui.view = null; ui.pop = false; ui.showTabs = false; break;
    case 'scen': setup(el.dataset.scen, s); break;
    case 'restart': setup(s.scen, s); break;
    case 'step': runStep(); break;
    case 'wait': M.advance(s, Number(el.dataset.ms)); watch(); break;
    case 'lea': M.addItem(s, ['Milch', 'Eier', 'Kerzen'].find((n) => !s.items.some((i) => i.name === n && M.isOpen(i))) ?? 'Feta', 'Lea'); break;
    case 'reopen': api.reopen(0, false); return;
    case 'premium-toggle': s.premium = !s.premium; break;
    case 'panel': ui.panel = !ui.panel; break;
    case 'rec': ev.preventDefault(); showRec(); return;
    case 'rec-close': document.querySelector('.rec').remove(); return;
    default: return;
  }
  if (was && !s.trip) ui.showTabs = false;
  render();
});

document.addEventListener('keydown', (ev) => {
  const n = Number(ev.key);
  if (n >= 1 && n <= 5 && !ev.target.closest('input')) { s.v = `TM${n}`; ui.view = null; render(); }
});

setInterval(() => {
  if (!s.trip) return;
  const before = JSON.stringify([s.trip.pauses, s.trip.nudge, s.notice]);
  watch();
  if (JSON.stringify([s.trip && s.trip.pauses, s.trip && s.trip.nudge, s.notice]) !== before) render();
  else updateClocks();
}, 1000);

if (sessionStorage.getItem('tm217-reopened')) {
  sessionStorage.removeItem('tm217-reopened');
  ui.reopened = true;
  ui.splash = true;
  setTimeout(() => { ui.splash = false; render(); }, 700);
  setTimeout(() => { ui.reopened = false; render(); }, 4000);
}
watch();
new ResizeObserver(fitBottom).observe(document.body);
render();
if (location.hash === '#rec') showRec();
globalThis.tm217 = { api, get state() { return s; }, render, runStep, setup, scenarios: SCENARIOS };
