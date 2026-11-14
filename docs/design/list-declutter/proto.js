import { icons } from './icons.js';
import { scenarios, datasets, storeOrder, catOrder, catName, strings, money } from './model.js';
import { allVariants as variants } from './variants.js';
import { rounds, roundOf, viewsOf } from './rounds.js';

const params = new URLSearchParams(location.search);
// This page's round (`<body data-round>`): only its sets, phones, recommendation and data.
const round = rounds.find((r) => r.path === document.body.dataset.round);
const views = viewsOf(round);
// A view of another round (an old link, a typed hash) goes on to that round's page.
const viewOf = (h) => {
  const v = h === 'all' ? 'r1' : h;
  if (views.has(v)) return v;
  const home = v && roundOf(v);
  if (home && home !== round) location.replace(`../${home.path}/${location.search}#/${v}`);
  return Object.keys(round.sets)[0];
};
const S = {
  view: viewOf(location.hash.slice(2)),
  // English by default (lead note t870u); ?lang=de or the Deutsch switch for German.
  lang: params.get('lang') === 'de' ? 'de' : 'en',
  theme: params.get('theme') === 'dark' ? 'dark' : 'light',
  data: round.data.includes(params.get('data')) ? params.get('data') : round.data[0],
  scen: ['one', 'two', 'many'].includes(params.get('scen')) ? params.get('scen') : 'two',
  opts: false,
  ts: ['100', '130', '160'].includes(params.get('ts')) ? params.get('ts') : '100',
};
// The sheet the base phones (R2, BB, LD4-3T) open from the switcher.
const BEST_SS = 'SS4';
const isST = (vid) => /^ST\d$/.test(vid);
const isR2 = (vid) => ['R2', 'LD4-3T'].includes(vid) || /^(SS|BB|ST)\d$/.test(vid);
const T = () => strings[S.lang];
const ic = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[name]}"/></svg>`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const phones = {};
// Views whose sheets were opened on entry (the SS set opens every switcher sheet once).
let opened = new Set();
const fresh = () => ({
  items: datasets[S.data](),
  hhs: structuredClone(scenarios[S.scen].households),
  requests: scenarios[S.scen].requests,
  tab: 'list',
  kb: false,
  away: false,
  menu: null,
  expanded: new Set(),
  seg: 'lists',
  page: null,
  fsHidden: false,
  folded: new Set(),
  editor: null,
  sheet: null,
  mode: 'plan',
  asked: false,
  prompt: null,
  trip: null,
  toast: null,
  snack: null,
  list: 0,
  hh: 0,
  swiped: null,
  leaving: new Set(),
  stOpen: false,
});
const reset = () => {
  variants.forEach((v) => (phones[v.id] = { ...fresh(), vid: v.id }));
  if (params.get('trip') === '1') for (const v of ['LD1', 'LD3', 'R2', 'BB4', 'LD4-3T']) startTrip(phones[v], open(phones[v]).map((x) => x.id));
  opened = new Set();
};

const name = (it) => it[S.lang];
const open = (p) => p.items.filter((it) => !it.ticked);
const totals = (p) => {
  const priced = p.items.filter((it) => it.price != null);
  return { sum: priced.reduce((a, it) => a + it.price, 0), priced: priced.length, open: open(p).filter((it) => it.price == null).length };
};
const storeStats = (p, store) => {
  const all = p.items.filter((it) => it.store === store);
  return { done: all.filter((it) => it.ticked).length, all: all.length, open: all.filter((it) => !it.ticked).length };
};
const listName = (p) => p.hhs[p.hh].lists[p.list][S.lang];
const hhName = (p) => p.hhs[p.hh].name;
const listOpen = (p, h, l) => (h === p.hh && l === p.list ? open(p).length : p.hhs[h].lists[l].open);
const hhOpen = (p, h) => p.hhs[h].lists.reduce((a, _, l) => a + listOpen(p, h, l), 0);

// Shared parts. Each variant picks options; nothing here knows variant ids.

const bar205 = (p, { editIcon = false, extra = '' } = {}) => `
  <div class="bar">
    <span class="tact stacked" data-act="switch"><span><span class="lines"><small class="ell">${esc(hhName(p))}</small><b class="ell">${esc(listName(p))}</b></span>${ic('unfold_more', 'sm')}</span></span>
    <span class="grow"></span>${extra}
    ${editIcon ? `<span class="tact icon-tact" data-act="edit" aria-label="${T().edit}"><span>${ic('tune')}</span></span>` : `<span class="tact" data-act="edit"><span>${T().edit}</span></span>`}
  </div>`;

const todayHeader = (p) => `
  <div class="hdr today-hdr">
    <div class="bar">
      <span class="tact hh-chip" data-act="switch"><span><b class="ell">${esc(hhName(p))}</b>${ic('expand_more', 'sm')}</span></span>
      <span class="grow"></span>
      <span class="tact" data-act="edit"><span>${T().edit}</span></span>
    </div>
    <div class="tabs-row"><span class="track-wrap"><span class="track">
      ${p.hhs[p.hh].lists.map((l, i) => `<span class="tab ${i === p.list ? 'on' : ''}" data-act="list" data-i="${i}">${esc(l[S.lang])}</span>`).join('')}
      <span class="tab plus" data-act="noop">${ic('add', 'sm')}</span></span></span></div>
  </div>`;

const fsSteps = () => [
  { t: T().fsCreated, done: true },
  { t: T().fsInvite, done: true },
  { t: T().fsShop, line: T().fsShopLine },
];
const fsCard = (p, { flat = false } = {}) =>
  p.fsHidden
    ? ''
    : `<div class="fs-card ${flat ? 'flat' : ''}">
    <div class="fs-head">${ic('flag_outlined', 'flag')}<span class="grow"><b>${T().firstSteps}</b><span class="muted">${T().ofN(2, 3)}</span></span>
      <button class="x" data-act="fs-hide" aria-label="${T().hideFs}">${ic('close', 'sm')}</button></div>
    ${fsSteps()
      .map(
        (s) => `<div class="fs-step ${s.done ? 'done' : ''}"><span class="fs-dot"><i>${s.done ? ic('check', 'xs') : ''}</i></span><div class="grow">
        <div class="fs-t">${s.t}</div>${s.line ? `<div class="fs-l">${s.line}</div>` : ''}</div>${s.btn ? `<button class="fs-btn" data-act="toast" data-msg="toastInvite">${s.btn}</button>` : ''}</div>`,
      )
      .join('')}
  </div>`;
const fsNudge = (p) =>
  p.fsHidden
    ? ''
    : `<div class="fs-nudge"><button class="grow nudge-main" data-act="sheet" data-sheet="fs">${ic('checklist', 'sm')}<b>${T().firstSteps}</b><span class="muted">${T().ofN(2, 3)}</span>${ic('chevron_right', 'sm')}</button>
    <button class="x" data-act="fs-hide" aria-label="${T().hideFs}">${ic('close', 'sm')}</button></div>`;

const priceEl = (p, it, mode) => {
  const shop = p.mode === 'shop';
  if (mode === 'none' || (mode === 'shop' && !shop)) return '';
  if (mode === 'text') return it.price != null ? `<span class="amount">${money(it.price, S.lang)}</span>` : '';
  if (it.price != null) return `<button class="pchip on" data-act="price" data-id="${it.id}" aria-label="${T().priceFor(name(it))}"><span>${money(it.price, S.lang)}</span></button>`;
  if (mode === 'priced') return '';
  if (mode === 'ghost') return `<button class="pghost" data-act="price" data-id="${it.id}" aria-label="${T().priceFor(name(it))}">€</button>`;
  return `<button class="pchip" data-act="price" data-id="${it.id}"><span>${T().addPrice}</span></button>`;
};

const editor = (p, it) => `
  <div class="editor"><label class="pfield"><span>${T().price}</span><input inputmode="decimal" autocomplete="off" value="${it.price != null ? (it.price / 100).toFixed(2).replace('.', S.lang === 'de' ? ',' : '.') : ''}" data-price-for="${it.id}"><i>€</i></label>
  <button class="txt" data-act="price-cancel">${T().cancel}</button><button class="fill" data-act="price-save" data-id="${it.id}">${T().done}</button></div>`;

const row = (p, it, o) => {
  const leaving = p.leaving.has(it.id);
  const swiped = p.swiped === it.id;
  return `<div class="item-wrap ${swiped ? 'swiped' : ''}">
    ${o.price === 'text' ? `<button class="swipe-act" data-act="price" data-id="${it.id}">${ic('sell_outlined', 'sm')}${T().price}</button>` : ''}
    <div class="item ${leaving ? 'leaving' : ''}" data-act="tick" data-id="${it.id}" role="checkbox" aria-checked="${leaving}">
      <span class="emoji ${it.emoji ? '' : 'none'}">${it.emoji}</span>
      <span class="iname">${it.qty ? `<b class="qty">${esc(/^\d+$/.test(it.qty) ? `${it.qty}×` : it.qty)}</b> ` : ''}${esc(name(it))}</span>
      ${priceEl(p, it, o.price)}
    </div></div>${p.editor === it.id ? editor(p, it) : ''}`;
};

const divider = (p, store, o) => {
  const st = storeStats(p, store);
  const label = store ?? T().noStore;
  const folded = p.folded.has(String(store));
  const sub = p.items.filter((it) => it.store === store && it.price != null).reduce((a, it) => a + it.price, 0);
  const subTxt = o.subtotal && sub ? `<span class="sub">${money(sub, S.lang)}</span>` : '';
  if (o.divider === 'st') return o.stDivider(store, st, folded);
  if (o.divider === 'slim' || o.divider === 'plain')
    return `<button class="div slim ${o.divider}" data-act="fold" data-store="${store}"><span class="badge-hex"><i>${esc(label)}</i></span><span class="rule"></span><span class="count"><b>${st.open}</b></span>${subTxt}${ic(folded ? 'expand_more' : 'expand_less', 'sm muted')}</button>`;
  return `<button class="div" data-act="fold" data-store="${store}"><span class="badge-hex big"><i>${esc(label)}</i></span>
    <span class="rule accent"></span><span class="count"><b>${st.open}</b> ${T().items(st.open).replace(/^\d+ /, '')}</span><span class="tact fold"><span>${ic(folded ? 'expand_less' : 'expand_more', 'sm')}</span></span></button>`;
};

const sections = (p, o) =>
  storeOrder(p.items)
    .filter((store) => o.done || p.items.some((it) => it.store === store && (!it.ticked || p.leaving.has(it.id))))
    .map((store) => {
      const its = p.items.filter((it) => it.store === store && (!it.ticked || p.leaving.has(it.id)));
      if (!its.length) return `<section data-sec="${store}">${o.done(store)}</section>`;
      const folded = p.folded.has(String(store));
      const body = folded
        ? ''
        : [...new Set([...(catOrder[store] ?? catOrder.null), ...its.map((it) => it.cat)])]
            .filter((c) => its.some((it) => it.cat === c))
            .map((c) => `<div class="cat ${o.catClass ?? ''}"><span>${catName(c, S.lang)}</span><i></i></div>${its.filter((it) => it.cat === c).map((it) => row(p, it, o)).join('')}`)
            .join('');
      const subLine =
        o.subtotalLine && !folded && its.some((it) => it.price != null)
          ? `<div class="subline">${T().sum(`${store ?? T().noStore} ${money(p.items.filter((it) => it.store === store && it.price != null).reduce((a, it) => a + it.price, 0), S.lang)}`)}</div>`
          : '';
      return `<section data-sec="${store}">${divider(p, store, o)}${body}${subLine}${o.foot ? o.foot(store, folded) : ''}</section>`;
    })
    .join('');

const totalText = (p) => {
  const t = totals(p);
  return { sum: money(t.sum, S.lang), meta: `${T().priced(t.priced)} · ${T().open(t.open)}` };
};
const totalBar = (p) => {
  const t = totalText(p);
  return `<div class="total-bar" data-cover><span><b>${T().total}</b><small>${t.meta}</small></span><b class="big-sum">${t.sum}</b></div>`;
};
const totalStrip = (p) => {
  const t = totalText(p);
  return `<div class="total-strip" data-cover><span>${T().total}</span><small>${t.meta}</small><span class="grow"></span><b>${t.sum}</b></div>`;
};
const totalRow = (p) => {
  const t = totalText(p);
  return `<div class="total-row"><span><b>${T().total}</b><small>${t.meta}</small></span><b>${t.sum}</b></div>`;
};
const addBar = ({ cover = true, more = false } = {}) => `
  <div class="addbar ${more ? 'with-more' : ''}" ${cover ? 'data-cover data-bb' : ''}>
    <div class="addfield"><span class="in"><span class="grow muted">${T().addHint}</span><button data-act="toast" data-msg="toastMic" class="mic">${ic('mic_none')}</button></span></div>
    ${more ? `<button class="tact dock-more" data-act="toast" data-msg="toastNav" aria-label="${T().navMore}"><span>${ic('menu')}</span></button>` : ''}
  </div>`;
const nav = () => `
  <nav class="nav" data-cover data-bb><span class="pill-wrap"><span class="pill-nav three" role="tablist">
    <span class="on" data-act="noop" role="tab" aria-label="${T().navList}">${ic('shopping_cart')}<em>${T().navList}</em></span>
    <span data-act="toast" data-msg="toastNav" role="tab" aria-label="${T().navLog}">${ic('history')}<em>${T().navLog}</em></span>
    <span data-act="toast" data-msg="toastNav" role="tab" aria-label="${T().navMore}">${ic('menu')}<em>${T().navMore}</em></span>
  </span></span></nav>`;
const recent = (p) => {
  const n = p.items.filter((it) => it.ticked && !p.leaving.has(it.id)).length;
  return n ? `<div class="recent">${ic('history', 'sm')}<span>${S.lang === 'de' ? 'Zuletzt verwendet' : 'Recently used'}</span><span class="muted">${n}</span>${ic('expand_more', 'sm')}</div>` : '';
};
const pad = '<div class="endpad"></div>';

const tripBar = (p) => {
  const snap = p.trip.snap;
  const pr = { done: p.items.filter((it) => snap.includes(it.id) && it.ticked).length, all: snap.length };
  const t = totalText(p);
  const paused = p.trip?.paused;
  return `<div class="trip-bar" data-cover>
    <span class="trip-clock">${ic('timer_outlined', 'sm')}<b data-clock>${clock(p)}</b></span>
    <span class="trip-mid"><small>${T().bought(pr.done, pr.all)}</small><b>${t.sum}</b></span>
    <button class="trip-btn" data-act="trip-pause" aria-label="${paused ? T().resume : T().pause}">${ic(paused ? 'play_arrow' : 'pause', 'sm')}</button>
    <button class="trip-btn end" data-act="trip-end">${T().endTrip}</button></div>`;
};
const clock = (p) => {
  if (!p.trip) return '0:00';
  const ms = (p.trip.paused ? p.trip.pausedAt : Date.now()) - p.trip.start - p.trip.pausedFor;
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// The six screens. Each returns { top, scroll, bottom } markup; `scroll` is the list area.

const screens = {
  today: (p) => ({
    top: todayHeader(p),
    scroll: `${fsCard(p)}${sections(p, { price: 'chip', divider: 'full', subtotalLine: true })}${recent(p)}${pad}`,
    bottom: `${open(p).length ? totalBar(p) : ''}${addBar()}${nav()}`,
  }),
  LD1: (p) => ({
    top: `<div class="hdr">${bar205(p)}</div>`,
    scroll: `${fsNudge(p)}${sections(p, { price: 'ghost', divider: 'slim', subtotal: true, catClass: 'tight' })}${recent(p)}${pad}`,
    bottom: `${p.trip ? tripBar(p) : totalStrip(p)}${addBar()}${nav()}`,
  }),
  LD2: (p) => {
    const t = totalText(p);
    return {
      top: '',
      scroll: `<div class="hdr big" data-collapse-src>${bar205(p)}</div>
        <div class="mini" data-mini><button class="mini-main" data-act="switch"><b class="ell">${esc(listName(p))}</b>${ic('unfold_more', 'xs')}</button>
          <span class="muted">${T().open(open(p).length)}</span><span class="grow"></span><b>${t.sum}</b>
          <button class="mini-edit" data-act="edit" aria-label="${T().edit}">${ic('tune', 'sm')}</button></div>
        ${fsCard(p, { flat: true })}${sections(p, { price: 'priced', divider: 'slim', subtotal: true })}${recent(p)}${totalRow(p)}${pad}`,
      bottom: `${addBar()}${nav()}`,
    };
  },
  LD3: (p) => {
    const shop = p.mode === 'shop';
    return {
      top: `<div class="hdr">${bar205(p, { editIcon: true, extra: shop ? '' : `<span class="tact shop-tact" data-act="shop"><span>${ic('shopping_cart_outlined', 'sm')}${T().shopping}</span></span>` })}</div>`,
      scroll: `${shop ? '' : fsNudge(p)}${sections(p, { price: 'shop', divider: shop ? 'slim' : 'plain', subtotal: shop })}${recent(p)}${pad}`,
      bottom: `${shop ? tripBar(p) : ''}${addBar()}${nav()}`,
    };
  },
  LD4: (p) => {
    const t = totalText(p);
    return {
      top: '',
      scroll: `<div class="ld4-title" data-act="sheet" data-sheet="dock"><small>${esc(hhName(p))}</small><h2>${esc(listName(p))}</h2></div>
        ${sections(p, { price: 'text', divider: 'slim', noSwipe: true })}${recent(p)}${pad}`,
      bottom: `<div class="dock" data-cover>
        <button class="handle-row" data-act="sheet" data-sheet="dock"><span class="grip"></span>
          <span class="ell grow"><b>${esc(listName(p))}</b> · ${T().open(open(p).length)}</span>${p.fsHidden ? '' : `<span class="dot-badge">${ic('checklist', 'xs')} ${T().ofN(2, 3)}</span>`}<b>${t.sum}</b>${ic('keyboard_arrow_up', 'sm')}</button>
        ${addBar({ cover: false, more: true })}</div>`,
    };
  },
  LD5: (p) => ({
    top: `<div class="quick-hdr" data-quick>${bar205(p)}</div>`,
    scroll: `<div class="hdr">${bar205(p)}</div>
      ${p.fsHidden ? '' : `<div class="fs-row"><button class="grow nudge-main" data-act="sheet" data-sheet="fs">${ic('checklist', 'sm')}<b>${T().firstSteps}</b><span class="muted">${T().ofN(2, 3)}</span></button><button class="x" data-act="fs-hide" aria-label="${T().hideFs}">${ic('close', 'sm')}</button></div>`}
      <div class="swipe-hint">${ic('swipe_left', 'xs')}${T().swipeHint}</div>
      ${sections(p, { price: 'text', divider: 'slim', subtotal: true })}${recent(p)}${totalRow(p)}${pad}`,
    bottom: `${addBar()}${nav()}`,
  }),
};

// Round 2 (job 227). Every phone shares the base: job 205's switcher in a fixed see-through header, today's
// First steps card, LD1's rows, the total as a row after the open items, three tabs, LD1's trip prompt and bar.

const tabsDef = () => [
  { id: 'list', icon: 'shopping_cart', label: T().navList },
  { id: 'log', icon: 'history', label: T().navLog },
  { id: 'more', icon: 'menu', label: T().navMore },
];
const tabAttrs = (p, t) => `data-act="tab" data-tab="${t.id}" role="tab" aria-selected="${p.tab === t.id}" aria-label="${t.label}"`;

const field = (p, { hint = T().addHint, lead = '' } = {}) =>
  `<span class="in" data-act="kb">${lead}<span class="grow ell muted hint">${hint}</span><button data-act="toast" data-msg="toastMic" class="mic" aria-label="Mikrofon">${ic('mic_none')}</button></span>`;
const addField = (p, cls = '') => `<div class="addfield ${cls}">${field(p)}</div>`;

const pill3 = (p, cls = '') => `
  <span class="pill-wrap ${cls}"><span class="pill-nav three" role="tablist">
    ${tabsDef().map((t) => `<span class="${p.tab === t.id ? 'on' : ''}" ${tabAttrs(p, t)}>${ic(t.icon)}<em>${t.label}</em></span>`).join('')}
  </span></span>`;
const nav3 = (p, cls = '') => `<nav class="nav ${cls}" data-cover data-bb>${pill3(p)}</nav>`;
const band = (p, cls = '') => (p.tab === 'list' ? `<div class="addbar ${cls}" data-cover data-bb>${addField(p)}</div>` : '');
const trip = (p) => (p.trip && p.tab === 'list' ? tripBar(p) : '');

const keyboard = () => {
  const rows = ['QWERTZUIOPÜ', 'ASDFGHJKLÖÄ', '⇧YXCVBNM⌫'];
  return `<div class="kbd" data-act="noop" aria-hidden="true">${rows.map((r) => `<div class="krow">${[...r].map((k) => `<i>${k}</i>`).join('')}</div>`).join('')}
    <div class="krow"><i class="w">123</i><i class="space"></i><i class="w">↵</i></div></div>`;
};
// The field above the keyboard, as today: the tabs go while the keyboard is up.
const kbBottom = (p) => `<div class="addbar kb-on" data-cover data-bb><div class="addfield">${field(p, { hint: `<span class="caret"></span>${T().addHint}` })}</div>
  <button class="kb-hide" data-act="kb-close" aria-label="${T().kbDone}">${ic('keyboard_hide_outlined')}</button></div>
  <div class="kb-note">${T().kbNote}</div>${keyboard()}`;

const bottoms = {
  stack: (p) => `${trip(p)}${band(p)}${nav3(p)}`,
  BB1: (p) => `${trip(p)}${band(p, 'tight')}${nav3(p, 'tight')}`,
  BB2: (p) =>
    p.tab === 'list'
      ? `${trip(p)}<div class="addbar one-row" data-cover data-bb>${addField(p)}<span class="icon-tabs" role="tablist">${tabsDef()
          .map((t) => `<button class="itab ${p.tab === t.id ? 'on' : ''}" ${tabAttrs(p, t)}><span>${ic(t.icon)}</span></button>`)
          .join('')}</span></div>`
      : nav3(p),
  BB3: (p) =>
    `${trip(p)}<div class="slab-wrap" data-cover data-bb><div class="slab">${p.tab === 'list' ? `<div class="slab-field">${field(p)}</div>` : ''}
      <div class="slab-tabs" role="tablist">${tabsDef().map((t) => `<span class="${p.tab === t.id ? 'on' : ''}" ${tabAttrs(p, t)}>${ic(t.icon, 'sm')}<em>${t.label}</em></span>`).join('')}</div></div></div>`,
  BB4: (p) =>
    `${trip(p)}<nav class="nav one-row" data-cover data-bb><span class="pill-wrap"><span class="pill-nav three fieldtab ${p.tab === 'list' ? 'listing' : ''}" role="tablist">
      ${tabsDef()
        .map((t) =>
          t.id === 'list' && p.tab === 'list'
            ? `<span class="on fieldslot" ${tabAttrs(p, t)}>${field(p, { lead: ic('shopping_cart', 'sm lead') })}</span>`
            : `<span class="${p.tab === t.id ? 'on' : ''}" ${tabAttrs(p, t)}>${ic(t.icon)}<em>${t.label}</em></span>`,
        )
        .join('')}</span></span></nav>`,
  BB5: (p) => `${trip(p)}${band(p)}${nav3(p, 'hideable')}`,
  'LD4-3T': (p) =>
    `${trip(p)}<div class="dock3" data-cover data-bb>${p.tab === 'list' ? addField(p) : ''}
      <div class="dock-tabs" role="tablist">${tabsDef().map((t) => `<span class="${p.tab === t.id ? 'on' : ''}" ${tabAttrs(p, t)}>${ic(t.icon, 'sm')}<em>${t.label}</em></span>`).join('')}</div></div>`,
};

const tabPage = (p) => {
  const [t, n] = p.tab === 'log' ? [T().logTitle, T().logNote] : [T().moreTitle, T().moreNote];
  return `<div class="tabpage"><h2>${t}</h2><p class="muted">${n}</p></div>`;
};
const r2Screen = (vid) => (p) => ({
  r2: true,
  top: p.tab === 'list' ? `<div class="hdr glass">${bar205(p)}</div>` : '<div class="hdr glass"><div class="bar"></div></div>',
  scroll:
    p.tab === 'list'
      ? `${fsCard(p)}${sections(p, { price: 'ghost', divider: 'slim', subtotal: true, catClass: 'tight' })}${open(p).length ? totalRow(p) : ''}${recent(p)}`
      : tabPage(p),
  bottom: p.kb ? kbBottom(p) : (bottoms[vid] ?? bottoms.stack)(p),
});
for (const v of variants) if (isR2(v.id)) screens[v.id] = r2Screen(v.id);

// Job 230: per-store subtotals and a final total on Peter's style: R2's phone with SS5's sheet, without the trip prompt
// (job 217 is not on main). A store's subtotal sums its priced items, open or ticked, as the app's total does (job 190);
// "ohne Preis" counts its open items without one. With one store there is no subtotal, only the total.
const storeGroups = (p) =>
  storeOrder(p.items).map((store) => {
    const its = p.items.filter((it) => it.store === store);
    const priced = its.filter((it) => it.price != null);
    return {
      store,
      label: store ?? T().noStore,
      sum: priced.reduce((a, it) => a + it.price, 0),
      priced: priced.length,
      unpriced: its.filter((it) => !it.ticked && it.price == null).length,
      open: its.filter((it) => !it.ticked).length,
    };
  });
const multi = (p) => storeGroups(p).length > 1;
const group = (p, store) => storeGroups(p).find((g) => g.store === store);
const amt = (cents) => money(cents, S.lang);
const stMeta = (p) => {
  const t = totals(p);
  const named = storeGroups(p).filter((g) => g.store != null).length;
  return [multi(p) ? T().stores(named, named < storeGroups(p).length) : '', T().priced(t.priced), t.open ? T().noPrice(t.open) : ''].filter(Boolean).join(' · ');
};
const stTotal = (p, { label = multi(p) ? T().grand : T().total, tail = '', act = '' } = {}) =>
  `<div class="total-row st" data-grand="${totals(p).sum}" ${act}><span><b>${label}</b><small>${stMeta(p)}</small></span><b class="grand">${amt(totals(p).sum)}</b>${tail}</div>`;
// One line per store: hex badge, "2 ohne Preis", subtotal. Used by the summary block and the expandable total.
const storeLine = (g) =>
  `<button class="st-line" data-act="jump" data-store="${g.store}" data-sub="${g.sum}"><span class="st-name"><span class="nm">${esc(g.label)}</span>
    <small class="muted">${g.open ? '' : `${ic('check', 'xs')}${T().allBought}`}${g.unpriced ? T().noPrice(g.unpriced) : ''}</small></span><b>${amt(g.sum)}</b></button>`;
const doneDivider = (p) => (store) => {
  const g = group(p, store);
  return multi(p) && g.priced
    ? `<div class="div slim st done"><span class="badge-hex"><i class="ell">${esc(g.label)}</i></span><span class="rule"></span><span class="st-amt"><small>${ic('check', 'xs')}${T().allBought}</small><b data-sub="${g.sum}">${amt(g.sum)}</b></span></div>`
    : '';
};
const countDivider = (p) => (store, st, folded) =>
  `<button class="div slim" data-act="fold" data-store="${store}"><span class="badge-hex"><i class="ell">${esc(store ?? T().noStore)}</i></span><span class="rule"></span><span class="count"><b>${st.open}</b></span>${ic(folded ? 'expand_more' : 'expand_less', 'sm muted')}</button>`;
const stRows = (p, o) => sections(p, { price: 'ghost', divider: 'st', catClass: 'tight', stDivider: countDivider(p), ...o });

const stScroll = {
  // ST1: the subtotal and "ohne Preis" sit on each store's divider; a store bought in full keeps a divider with its sum.
  ST1: (p) =>
    `${stRows(p, {
      stDivider: (store, st, folded) => {
        const g = group(p, store);
        if (!multi(p)) return countDivider(p)(store, st, folded);
        return `<button class="div slim st" data-act="fold" data-store="${store}"><span class="badge-hex"><i class="ell">${esc(g.label)}</i></span><span class="rule"></span>
          <span class="st-amt"><small>${[T().open(g.open), g.unpriced ? T().noPrice(g.unpriced) : ''].filter(Boolean).join(' · ')}</small>${g.priced ? `<b data-sub="${g.sum}">${amt(g.sum)}</b>` : ''}</span>${ic(folded ? 'expand_more' : 'expand_less', 'sm muted')}</button>`;
      },
      done: doneDivider(p),
    })}${open(p).length ? stTotal(p) : ''}`,
  // ST2: a sum line closes each store's section, as the app's "Summe dm" line; folded, the sum moves to the divider.
  ST2: (p) =>
    `${stRows(p, {
      stDivider: (store, st, folded) => {
        const g = group(p, store);
        if (!multi(p) || !folded || !g.priced) return countDivider(p)(store, st, folded);
        return `<button class="div slim" data-act="fold" data-store="${store}"><span class="badge-hex"><i class="ell">${esc(g.label)}</i></span><span class="rule"></span><span class="count"><b>${st.open}</b></span><span class="sub" data-sub="${g.sum}">${amt(g.sum)}</span>${ic('expand_more', 'sm muted')}</button>`;
      },
      foot: (store, folded) => {
        const g = group(p, store);
        if (!multi(p) || folded || (!g.priced && !g.unpriced)) return '';
        return `<div class="st-foot"><small class="muted">${g.unpriced ? T().noPrice(g.unpriced) : ''}</small><span class="grow"></span><span class="ell">${esc(g.store == null ? T().sumNoStore : T().sumOf(g.label))}</span><b data-sub="${g.sum}">${amt(g.sum)}</b></div>`;
      },
      done: doneDivider(p),
    })}${open(p).length ? stTotal(p) : ''}`,
  // ST3: one block above "Zuletzt verwendet": a line per store, then the total. A store line jumps to its section.
  ST3: (p) =>
    `${stRows(p)}${
      !open(p).length ? '' : multi(p) ? `<div class="st-block"><div class="st-head">${T().total}</div>${storeGroups(p).map(storeLine).join('')}${stTotal(p)}</div>` : stTotal(p)
    }`,
  // ST4: the total row folds the store lines away; a tap unfolds them under it.
  ST4: (p) =>
    `${stRows(p)}${
      !open(p).length
        ? ''
        : multi(p)
          ? `<div class="st-exp ${p.stOpen ? 'open' : ''}">${stTotal(p, { act: `data-act="st-exp" role="button" aria-expanded="${p.stOpen}" aria-label="${T().showStores}"`, tail: ic(p.stOpen ? 'expand_less' : 'expand_more', 'sm muted') })}${p.stOpen ? `<div class="st-lines">${storeGroups(p).map(storeLine).join('')}</div>` : ''}</div>`
          : stTotal(p)
    }`,
  // ST5: under the total a line of store chips (name and subtotal) that wraps; a chip jumps to its section.
  ST5: (p) =>
    `${stRows(p)}${
      !open(p).length
        ? ''
        : `${stTotal(p)}${multi(p) ? `<div class="st-chips">${storeGroups(p).map((g) => `<button class="st-chip ${g.open ? '' : 'done'}" data-act="jump" data-store="${g.store}" data-sub="${g.sum}" ${g.open ? '' : `aria-label="${esc(`${g.label}, ${T().allBought}, ${amt(g.sum)}`)}"`}><span>${g.open ? '' : ic('check', 'xs')}<i class="ell">${esc(g.label)}</i><b>${amt(g.sum)}</b></span></button>`).join('')}</div>` : ''}`
    }`,
};
const stScreen = (vid) => (p) => {
  const base = r2Screen(vid)(p);
  return p.tab === 'list' ? { ...base, scroll: `${fsCard(p)}${stScroll[vid](p)}${recent(p)}` } : base;
};
for (const v of variants) if (isST(v.id)) screens[v.id] = stScreen(v.id);

// The switcher sheet. Today's household sheet row for row, and the list rows the five SS variants add to it.
const hexIcon = (name, cls = '') => `<span class="hexmark ${cls}">${ic(name, 'sm')}</span>`;
const hhTile = (p, h, { act = 'hh', trailing = '', chevron = false } = {}) => {
  const hh = p.hhs[h];
  const on = h === p.hh;
  return `<div class="tile ${on ? 'on' : ''}" data-act="${act}" data-i="${h}" role="button">
    ${hexIcon('home_outlined', on ? 'honey' : '')}
    <span class="tile-text"><span class="tile-title ell">${esc(hh.name)}</span><span class="tile-sub">${T().members(hh.members)} · ${T().openItems(hhOpen(p, h))}</span></span>
    ${on ? `<span class="cur" aria-label="${T().shown}">${ic('check')}</span>` : ''}
    <button class="ibtn" data-act="toast" data-msg="toastInviteSheet" aria-label="${esc(T().inviteTo(hh.name))}">${ic('person_add_outlined')}</button>${trailing}${chevron ? `<span class="chev">${ic('chevron_right')}</span>` : ''}</div>`;
};
const listTile = (p, h, l, { indent = false } = {}) => {
  const li = p.hhs[h].lists[l];
  const on = h === p.hh && l === p.list;
  const key = `${h}:${l}`;
  const n = p.hhs[h].lists.length;
  return `<div class="tile list ${indent ? 'indent' : ''} ${on ? 'on' : ''}" data-act="pick" data-h="${h}" data-l="${l}" role="button">
    ${hexIcon('checklist', on ? 'honey' : '')}
    <span class="tile-text"><span class="tile-title clamp2">${esc(li[S.lang])}</span><span class="tile-sub">${T().openItems(listOpen(p, h, l))}</span></span>
    ${on ? `<span class="cur" aria-label="${T().shown}">${ic('check')}</span>` : ''}
    <button class="ibtn" data-act="lmenu" data-key="${key}" aria-label="${esc(T().listActions(li[S.lang]))}" aria-expanded="${p.menu === key}">${ic('more_vert')}</button></div>
    ${p.menu === key ? `<div class="lmenu ${indent ? 'indent' : ''}">
      <button data-act="lrename">${ic('edit_outlined', 'sm')}${T().rename}</button>
      ${l > 0 ? `<button data-act="lmove" data-h="${h}" data-l="${l}" data-d="-1">${ic('arrow_upward', 'sm')}${T().moveUp}</button>` : ''}
      ${l < n - 1 ? `<button data-act="lmove" data-h="${h}" data-l="${l}" data-d="1">${ic('arrow_downward', 'sm')}${T().moveDown}</button>` : ''}
      ${n > 1 ? `<button data-act="ldel" data-h="${h}" data-l="${l}">${ic('delete_outline', 'sm')}${T().del}</button>` : ''}</div>` : ''}`;
};
const newListTile = (h, { indent = false } = {}) =>
  `<div class="tile ${indent ? 'indent' : ''} quiet" data-act="lnew" data-h="${h}" role="button">${hexIcon('add')}<span class="tile-text"><span class="tile-title">${T().newList}</span></span></div>`;
const listsOf = (p, h, o) => `${p.hhs[h].lists.map((_, l) => listTile(p, h, l, o)).join('')}${newListTile(h, o)}`;
const hhTail = (p) => `
  ${p.requests.map((r) => `<div class="tile muted" data-act="toast" data-msg="toastWithdraw" role="button">${hexIcon('hourglass_top_outlined', 'dim')}<span class="tile-text"><span class="tile-title ell">${esc(r.name)}</span><span class="tile-sub">${T().requestPending}</span></span></div>`).join('')}
  <hr class="sdiv">
  <div class="tile short" data-act="toast" data-msg="toastNewHousehold" role="button">${hexIcon('add')}<span class="tile-title">${T().newHousehold}</span></div>
  <div class="tile short" data-act="toast" data-msg="toastJoin" role="button">${hexIcon('group_add_outlined')}<span class="tile-title">${T().joinWithCode}</span></div>
  <hr class="sdiv">
  <div class="tile short" data-act="toast" data-msg="toastVoice" role="button">${hexIcon('record_voice_over_outlined', 'accent')}<span class="tile-title small">${T().voiceDefault(p.hhs[0].name)}</span><span class="chev">${ic('chevron_right')}</span></div>`;
const sheetTitle = (t) => `<h3 class="stitle">${esc(t)}</h3>`;
// Today's sheet; `under(h)` adds what a variant puts under a household's row.
const householdSheet = (p, { under = () => '', tile = (h) => hhTile(p, h) } = {}) =>
  `${sheetTitle(T().householdsTitle)}${p.hhs.map((_, h) => `${tile(h)}${under(h)}`).join('')}${hhTail(p)}`;
const backRow = (label, act) => `<button class="back" data-act="${act}">${ic('arrow_back')}<span>${esc(label)}</span></button>`;

const ssSheets = {
  today: (p) => householdSheet(p),
  SS1: (p) =>
    householdSheet(p, {
      tile: (h) =>
        hhTile(p, h, {
          trailing:
            h === p.hh
              ? ''
              : `<button class="fold" data-act="expand" data-h="${h}" aria-expanded="${p.expanded.has(h)}">${T().listCount(p.hhs[h].lists.length)}${ic(p.expanded.has(h) ? 'expand_less' : 'expand_more', 'sm')}</button>`,
        }),
      under: (h) => (h === p.hh || p.expanded.has(h) ? `<div class="nest">${listsOf(p, h, { indent: true })}</div>` : ''),
    }),
  SS2: (p) => `${sheetTitle(T().listsIn(hhName(p)))}${listsOf(p, p.hh)}<hr class="sdiv wide">${householdSheet(p)}`,
  SS3: (p) => `<div class="seg" role="tablist">
      <button class="${p.seg === 'lists' ? 'on' : ''}" data-act="seg" data-seg="lists" role="tab" aria-selected="${p.seg === 'lists'}">${T().segLists}</button>
      <button class="${p.seg === 'hh' ? 'on' : ''}" data-act="seg" data-seg="hh" role="tab" aria-selected="${p.seg === 'hh'}">${T().segHouseholds}</button></div>
    ${p.seg === 'lists' ? `${sheetTitle(T().listsIn(hhName(p)))}${listsOf(p, p.hh)}` : householdSheet(p)}`,
  SS4: (p) =>
    p.page === 'manage'
      ? `${backRow(T().householdsTitle, 'page-home')}${sheetTitle(T().listsIn(hhName(p)))}${listsOf(p, p.hh)}`
      : householdSheet(p, {
          under: (h) =>
            h === p.hh
              ? `<div class="chiprow"><span class="track-wrap"><span class="track">${p.hhs[h].lists
                  .map((l, i) => `<button class="chip48" data-act="pick" data-h="${h}" data-l="${i}" title="${esc(l[S.lang])}"><span class="tab ${i === p.list ? 'on' : ''}"><span class="ell">${esc(l[S.lang])}</span></span></button>`)
                  .join('')}<button class="chip48" data-act="lnew" data-h="${h}" aria-label="${T().newList}"><span class="tab plus">${ic('add', 'sm')}</span></button></span></span>
                <button class="manage" data-act="page" data-page="manage">${ic('edit_outlined', 'sm')}${T().manageLists}</button></div>`
              : '',
        }),
  SS5: (p) => {
    if (p.page === 'home') return householdSheet(p, { tile: (h) => hhTile(p, h, { act: 'drill', chevron: true }) });
    const h = p.page ?? p.hh;
    const hh = p.hhs[h];
    return `${backRow(T().backToHouseholds, 'page-home')}
      <div class="hhhead">${hexIcon('home_outlined', h === p.hh ? 'honey' : '')}<span class="tile-text"><span class="hh-name">${esc(hh.name)}</span><span class="tile-sub">${T().members(hh.members)} · ${T().openItems(hhOpen(p, h))}</span></span>
        <button class="ibtn" data-act="toast" data-msg="toastInviteSheet" aria-label="${esc(T().inviteTo(hh.name))}">${ic('person_add_outlined')}</button></div>
      ${sheetTitle(T().segLists)}${listsOf(p, h)}`;
  },
};

const switchSheet = (p) => `
  <div class="sheet-h">${T().lists}</div>
  ${p.hhs[p.hh].lists.map((l, i) => `<button class="row ${i === p.list ? 'on' : ''}" data-act="list" data-i="${i}"><span class="hexmark">${ic('checklist', 'sm')}</span><span class="row-title grow">${esc(l[S.lang])}</span>${i === p.list ? ic('check', 'sm') : ''}</button>`).join('')}
  <button class="row" data-act="noop"><span class="hexmark">${ic('add', 'sm')}</span><span class="row-title">${T().newList}</span></button>
  <div class="sheet-h">${T().householdsIn}</div>
  <div class="hh-picks">${p.hhs.map((h, i) => `<button class="hh-pick ${i === p.hh ? 'on' : ''}" data-act="hh" data-i="${i}">${esc(h.name)}</button>`).join('')}<button class="hh-pick" data-act="noop">${ic('add', 'xs')}${T().newHousehold}</button></div>
  <p class="sheet-note">${S.lang === 'de' ? 'Wie Job 205 (`stacked-two-line`).' : 'As in job 205 (`stacked-two-line`).'}</p>`;

const dockSheet = (p) => {
  const t = totalText(p);
  return `${switchSheet(p).replace(/<p class="sheet-note">.*<\/p>/, '')}
  <div class="sheet-row-btns"><button class="tact" data-act="edit"><span>${ic('tune', 'sm')}${T().edit}</span></button><button class="tact" data-act="toast" data-msg="toastNav"><span>${ic('history', 'sm')}${T().navLog}</span></button></div>
  <div class="sheet-h">${T().total} <span class="muted">${t.meta}</span></div>
  ${storeOrder(p.items).map((s) => { const st = storeStats(p, s); const sub = p.items.filter((it) => it.store === s && it.price != null).reduce((a, it) => a + it.price, 0); return st.all ? `<div class="store-line"><span class="badge-hex"><i>${esc(s ?? T().noStore)}</i></span><span class="muted">${T().items(st.open)}</span><span class="grow"></span><b>${money(sub, S.lang)}</b></div>` : ''; }).join('')}
  <div class="store-line total"><b>${T().total}</b><span class="grow"></span><b>${t.sum}</b></div>
  ${p.fsHidden ? '' : `<div class="sheet-pad">${fsCard(p, { flat: true })}</div>`}`;
};

const editSheet = (p, it) => `
  <div class="sheet-h"><span class="emoji">${it.emoji}</span>${esc(name(it))}</div>
  <div class="edit-fields"><label class="pfield wide"><span>${T().price}</span><input inputmode="decimal" autocomplete="off" value="${it.price != null ? (it.price / 100).toFixed(2).replace('.', S.lang === 'de' ? ',' : '.') : ''}" data-price-for="${it.id}"><i>€</i></label>
  <p class="sheet-note">${S.lang === 'de' ? 'Menge, Laden, Kategorie wie heute im Bearbeiten-Blatt.' : 'Quantity, store, category as in today’s edit sheet.'}</p></div>
  <div class="sheet-actions"><button class="txt" data-act="close">${T().cancel}</button><button class="fill" data-act="price-save" data-id="${it.id}">${T().done}</button></div>`;

const sheet = (p) => {
  if (!p.sheet) return '';
  const it = p.sheet.startsWith('item:') ? p.items.find((x) => x.id === p.sheet.slice(5)) : null;
  const ss = ssSheets[p.vid] ?? (isST(p.vid) ? ssSheets.SS5 : isR2(p.vid) ? ssSheets[BEST_SS] : null);
  const body = p.sheet === 'switch' ? (ss ? ss(p) : switchSheet(p)) : p.sheet === 'fs' ? `<div class="sheet-pad">${fsCard(p, { flat: true })}</div>` : p.sheet === 'dock' ? dockSheet(p) : editSheet(p, it);
  return `<div class="scrim" data-act="close"></div><div class="sheet ${ss && p.sheet === 'switch' ? 'hhs' : ''}" role="dialog"><div class="handle"></div><div class="sheet-body">${body}</div></div>`;
};

const overlays = (p) => `
  ${p.prompt ? `<div class="snack prompt"><span class="grow">${T().shopNow}</span><button data-act="prompt-no">${T().no}</button><button class="fill" data-act="prompt-yes">${T().yes}</button></div>` : ''}
  ${p.snack ? `<div class="snack"><span class="grow">${esc(p.snack.text)}</span><button class="fill" data-act="price" data-id="${p.snack.id}">${T().addPrice}</button></div>` : ''}
  ${p.toast ? `<div class="toast">${esc(p.toast)}</div>` : ''}
  ${p.kb ? '<div class="kb-catch" data-act="kb-close"></div>' : ''}
  ${sheet(p)}`;

const phoneHtml = (v) => {
  const p = phones[v.id];
  const s = screens[v.id](p);
  const status = '<div class="status"><b>9:41</b><span class="grow"></span><span class="sig"></span></div>';
  return `<div class="phone th-${S.theme} ${s.r2 ? 'r2' : ''} ${p.away ? 'away' : ''}" data-v="${v.id}" style="--ts:${Number(S.ts) / 100};--tsn:${Math.min(1.5, Number(S.ts) / 100)}">
    ${s.r2 ? `<div class="top">${status}${s.top}</div>` : `${status}${s.top ? `<div class="top">${s.top}</div>` : ''}`}
    <div class="scroll">${s.scroll}</div>
    <div class="bottom">${s.bottom}</div><div class="homeind"><i></i></div>
    ${overlays(p)}
  </div>`;
};

const device = (v) => `
  <figure class="device" data-v="${v.id}">
    <figcaption class="cap-top"><b>${v.id === 'today' ? '' : v.id}</b> ${esc(v.name[S.lang])} <code>${v.slug}</code></figcaption>
    <div class="phone-host" data-host="${v.id}">${phoneHtml(v)}</div>
    <figcaption class="measure" data-measure="${v.id}"></figcaption>
  </figure>`;

// Grid views: the round's sets, each next to its yardsticks. `every` holds all the round's phones (the shoot scripts measure there).
const sets = { ...round.sets, every: [...new Set(Object.values(round.sets).flat())] };
const setLabel = { ss: () => T().setSS, bb: () => T().setBB, ld4: () => T().setLD4 };
const controls = () => {
  const btn = (key, val, label) => `<button data-set="${key}" data-val="${val}" aria-pressed="${S[key] === val}">${label}</button>`;
  const names = Object.keys(round.sets);
  const set = names.find((k) => sets[k].includes(S.view)) ?? S.view;
  const members = sets[set] ?? [];
  const label = (id) => (id === 'today' ? T().today : `${id} ${variants.find((v) => v.id === id).slug}`);
  const data = { shot: T().dataShot, big: T().data25, one: T().stOne, three: T().stThree, mixed: T().stMixed };
  return `<div class="controls ${S.opts ? 'open' : ''}">
    <div class="group"><button class="opts-btn" data-act="opts" aria-expanded="${S.opts}">${T().options}</button>${names.map((k) => btn('view', k, names.length > 1 ? setLabel[k]() : T().sideBySide)).join('')}${btn('view', round.rec.view, T().rec)}</div>
    ${members.length ? `<div class="group members">${members.map((id) => btn('view', id, label(id))).join('')}</div>` : ''}
    <div class="group opt">${round.data.map((d) => btn('data', d, data[d])).join('')}${round.people ? `<span class="sep"></span>${btn('scen', 'one', T().scenOne)}${btn('scen', 'two', T().scenTwo)}${btn('scen', 'many', T().scenMany)}` : ''}</div>
    <div class="group opt">${btn('lang', 'de', 'Deutsch')}${btn('lang', 'en', 'English')}<span class="sep"></span>${btn('theme', 'light', T().light)}${btn('theme', 'dark', T().dark)}<span class="sep"></span>${['100', '130', '160'].map((t) => btn('ts', t, `${T().textSize} ${t} %`)).join('')}<span class="sep"></span><button data-act="reset">Reset</button></div>
  </div>`;
};
// Entering the SS set opens every switcher sheet once, so the five sheets sit side by side.
const enterView = () => {
  if (S.view !== 'ss' || opened.has('ss')) return;
  opened.add('ss');
  for (const id of sets.ss) phones[id].sheet = 'switch';
};

const recHtml = { de: '', en: '' };
const narrow = matchMedia('(max-width: 440px)');

const render = () => {
  for (const p of Object.values(phones)) p.quick = false;
  document.documentElement.lang = S.lang;
  document.title = round.title[S.lang];
  enterView();
  const byId = (id) => variants.find((v) => v.id === id);
  const shown = sets[S.view] ? sets[S.view].map(byId) : [...new Set([byId(S.view), variants[0]])].filter(Boolean);
  // On a phone the whole page is one phone: it fills what the control strip leaves, so its bottom is always on screen.
  const rec = S.view === round.rec.view;
  const solo = narrow.matches && !rec;
  document.body.classList.toggle('solo-page', solo);
  const first = sets[S.view] ? byId(sets[S.view].find((id) => id !== 'today')) : shown[0];
  const notes = (v) => `<div class="notes"><h2>${v.id} ${esc(v.name[S.lang])}</h2><code>${v.slug}</code>${v.notes[S.lang].map((n) => `<p>${esc(n)}</p>`).join('')}</div>`;
  const body =
    rec
      ? `<article class="rec">${recHtml[S.lang]}</article>`
      : solo
        ? `<div class="solo">${device(first)}</div>`
        : sets[S.view]
        ? `<div class="grid">${shown.map(device).join('')}</div>`
        : `<div class="single">${device(shown[0])}${notes(shown[0])}${shown[1] ? device(shown[1]) : ''}</div>`;
  // On a phone the variant's name and notes sit in one line under the strip; it opens to the notes.
  const soloNotes = solo
    ? `<details class="solo-notes" ${S.notesOpen ? 'open' : ''}><summary><b>${first.id === 'today' ? T().today : first.id}</b><span class="ell grow">${esc(first.name[S.lang])}</span><span class="muted">${T().notesLabel} ▾</span></summary>${first.notes[S.lang].map((n) => `<p>${esc(n)}</p>`).join('')}</details>`
    : '';
  document.getElementById('app').innerHTML = `<header class="page-head"><div class="title-row"><a class="back-link" href="../?lang=${S.lang}">← ${T().allRounds}</a><h1>${esc(round.title[S.lang])}</h1></div><p class="note">${esc(round.compare[S.lang])}</p>${controls()}${soloNotes}</header>${body}`;
  document.querySelector('.solo-notes')?.addEventListener('toggle', (e) => (S.notesOpen = e.target.open));
  wire();
};

// Timers re-render while someone types a price: carry the typed text, focus and caret across.
const rerender = (vid) => {
  const host = document.querySelector(`[data-host="${vid}"]`);
  if (!host) return;
  const top = host.querySelector('.scroll')?.scrollTop ?? 0;
  const sheetTop = host.querySelector('.sheet-body')?.scrollTop ?? 0;
  const trackLeft = host.querySelector('.chiprow .track')?.scrollLeft ?? 0;
  const typed = Object.fromEntries([...host.querySelectorAll('[data-price-for]')].map((i) => [i.dataset.priceFor, i.value]));
  const active = document.activeElement?.closest?.('[data-price-for]');
  const focus = active && host.contains(active) ? { id: active.dataset.priceFor, at: active.selectionStart } : null;
  host.innerHTML = phoneHtml(variants.find((v) => v.id === vid));
  host.querySelector('.scroll').scrollTop = top;
  // The sheet keeps its place too (a toast or a list action re-renders it).
  const sb = host.querySelector('.sheet-body');
  if (sb) sb.scrollTop = sheetTop;
  const tr = host.querySelector('.chiprow .track');
  if (tr) tr.scrollLeft = trackLeft;
  for (const i of host.querySelectorAll('[data-price-for]')) if (i.dataset.priceFor in typed) i.value = typed[i.dataset.priceFor];
  if (focus) {
    const i = host.querySelector(`[data-price-for="${focus.id}"]`);
    i?.focus();
    i?.setSelectionRange(focus.at, focus.at);
  }
  syncScroll(host);
  measureAll();
};

// "Items fully visible": item rows whose whole box lies in the scroll area minus anything fixed drawn over it.
const visibleCount = (phone) => {
  const sc = phone.querySelector('.scroll');
  const r = sc.getBoundingClientRect();
  let top = r.top;
  let bottom = r.bottom;
  for (const c of phone.querySelectorAll('[data-cover], .top, .quick-hdr.show, .mini.pinned')) {
    const cr = c.getBoundingClientRect();
    if (!cr.height || cr.bottom <= r.top || cr.top >= r.bottom) continue;
    if (c.closest('.scroll') && !c.matches('.mini.pinned')) continue;
    if (cr.top + cr.height / 2 < (r.top + r.bottom) / 2) top = Math.max(top, cr.bottom);
    else bottom = Math.min(bottom, cr.top);
  }
  const rows = [...sc.querySelectorAll('.item')].map((el) => el.getBoundingClientRect()).filter((b) => b.height > 0);
  return {
    full: rows.filter((b) => b.top >= top - 0.5 && b.bottom <= bottom + 0.5).length,
    partial: rows.filter((b) => b.bottom > top + 0.5 && b.top < bottom - 0.5 && !(b.top >= top - 0.5 && b.bottom <= bottom + 0.5)).length,
    band: Math.round(bottom - top),
    // The add field and the tabs: from the top of the highest of them to the phone's bottom edge.
    bottomH: (() => {
      const tops = [...phone.querySelectorAll('[data-bb]')].map((el) => el.getBoundingClientRect()).filter((b) => b.height > 0).map((b) => b.top);
      return tops.length ? Math.round(phone.getBoundingClientRect().bottom - Math.min(...tops)) : null;
    })(),
    size: `${Math.round(phone.clientWidth)}×${Math.round(phone.clientHeight)}`,
  };
};
globalThis.__measure = () => Object.fromEntries([...document.querySelectorAll('.phone')].map((ph) => [ph.dataset.v, visibleCount(ph)]));

const measureAll = () => {
  const today = document.querySelector('.phone[data-v="today"]');
  const base = today ? visibleCount(today).full : null;
  const r2 = document.querySelector('.phone[data-v="R2"]');
  const r2n = r2 ? visibleCount(r2).full : null;
  for (const el of document.querySelectorAll('[data-measure]')) {
    const ph = document.querySelector(`.phone[data-v="${el.dataset.measure}"]`);
    if (!ph) continue;
    const m = visibleCount(ph);
    el.innerHTML = `<b>${T().visible(m.full)}</b>${el.dataset.measure !== 'today' && base != null ? ` · ${T().vsToday(base)}` : ''}${isST(el.dataset.measure) && r2n != null ? ` · R2 ${r2n}` : ''}${m.bottomH ? ` · ${T().bottomH(m.bottomH)}` : ''} <span class="muted">(${m.size})</span>`;
  }
};

const toast = (vid, msg) => {
  const p = phones[vid];
  p.toast = msg;
  rerender(vid);
  clearTimeout(p.toastTimer);
  p.toastTimer = setTimeout(() => {
    p.toast = null;
    rerender(vid);
  }, 1800);
};

const parsePrice = (s) => {
  const n = Number(String(s).replace(/\s|€/g, '').replace(',', '.'));
  return Number.isFinite(n) && String(s).trim() !== '' ? Math.round(n * 100) : null;
};

const tick = (vid, id) => {
  const p = phones[vid];
  const it = p.items.find((x) => x.id === id);
  if (!it || it.ticked) return;
  if ((vid === 'LD1' || vid === 'LD3' || (isR2(vid) && !isST(vid))) && !p.trip && !p.asked) {
    p.asked = true;
    p.prompt = { snap: open(p).map((x) => x.id) };
  }
  it.ticked = true;
  p.leaving.add(id);
  if (vid === 'LD2' && it.price == null) {
    p.snack = { id, text: T().ticked(name(it)) };
    clearTimeout(p.snackTimer);
    p.snackTimer = setTimeout(() => {
      p.snack = null;
      rerender(vid);
    }, 4000);
  }
  rerender(vid);
  setTimeout(() => {
    p.leaving.delete(id);
    rerender(vid);
  }, 440);
};

const savePrice = (vid, id, input) => {
  const p = phones[vid];
  p.items.find((x) => x.id === id).price = parsePrice(input.value);
  p.editor = null;
  p.sheet = null;
  rerender(vid);
};

// As in job 217: the trip's snapshot is the open items just before the tick that started it.
const startTrip = (p, snap) => {
  p.mode = 'shop';
  p.trip = { start: Date.now(), paused: false, pausedFor: 0, pausedAt: 0, snap };
};

const act = (vid, el, ev) => {
  const p = phones[vid];
  const a = el.dataset.act;
  const id = el.dataset.id;
  switch (a) {
    case 'tick':
      if (p.swiped) {
        p.swiped = null;
        return rerender(vid);
      }
      return tick(vid, id);
    case 'price':
      ev.stopPropagation();
      clearTimeout(p.snackTimer);
      p.snack = null;
      p.swiped = null;
      if (vid === 'LD4' || (vid === 'LD2' && el.closest('.snack'))) {
        p.sheet = `item:${id}`;
      } else p.editor = p.editor === id ? null : id;
      rerender(vid);
      return document.querySelector(`[data-host="${vid}"] [data-price-for="${id}"]`)?.focus();
    case 'price-save':
      return savePrice(vid, id, el.closest('.editor, .sheet').querySelector(`[data-price-for="${id}"]`));
    case 'price-cancel':
      p.editor = null;
      return rerender(vid);
    case 'fold': {
      const k = el.dataset.store;
      p.folded.has(k) ? p.folded.delete(k) : p.folded.add(k);
      return rerender(vid);
    }
    case 'fs-hide':
      p.fsHidden = true;
      if (p.sheet === 'fs') p.sheet = null;
      return rerender(vid);
    case 'sheet':
      p.sheet = el.dataset.sheet;
      return rerender(vid);
    case 'switch':
      p.sheet = 'switch';
      return rerender(vid);
    case 'close':
      p.sheet = null;
      return rerender(vid);
    case 'list':
      p.list = Number(el.dataset.i);
      p.sheet = p.sheet === 'dock' ? 'dock' : null;
      return rerender(vid);
    case 'hh':
      p.hh = Number(el.dataset.i);
      p.list = 0;
      p.page = null;
      p.sheet = p.sheet === 'dock' ? 'dock' : null;
      return rerender(vid);
    case 'edit':
      p.sheet = null;
      return toast(vid, T().toastEdit);
    case 'toast':
      return toast(vid, T()[el.dataset.msg]);
    case 'shop':
      startTrip(p, open(p).map((x) => x.id));
      return rerender(vid);
    case 'prompt-yes':
      startTrip(p, p.prompt.snap);
      p.prompt = null;
      return rerender(vid);
    case 'prompt-no':
      p.prompt = null;
      return rerender(vid);
    case 'trip-pause':
      if (p.trip.paused) {
        p.trip.pausedFor += Date.now() - p.trip.pausedAt;
        p.trip.paused = false;
      } else {
        p.trip.paused = true;
        p.trip.pausedAt = Date.now();
      }
      return rerender(vid);
    case 'tab':
      p.tab = el.dataset.tab;
      p.kb = false;
      p.away = false;
      rerender(vid);
      return document.querySelector(`[data-host="${vid}"] .scroll`)?.scrollTo(0, 0);
    case 'kb':
      if (!isR2(vid)) return;
      p.kb = true;
      return rerender(vid);
    case 'kb-close':
      p.kb = false;
      return rerender(vid);
    case 'pick':
      p.hh = Number(el.dataset.h);
      p.list = Number(el.dataset.l);
      p.sheet = null;
      p.menu = null;
      p.page = null;
      return rerender(vid);
    case 'drill':
      p.page = Number(el.dataset.i);
      p.menu = null;
      return rerender(vid);
    case 'page':
      p.page = el.dataset.page;
      p.menu = null;
      return rerender(vid);
    case 'page-home':
      p.page = 'home';
      if (vid === 'SS4') p.page = null;
      p.menu = null;
      return rerender(vid);
    case 'seg':
      p.seg = el.dataset.seg;
      p.menu = null;
      return rerender(vid);
    case 'expand': {
      const h = Number(el.dataset.h);
      p.expanded.has(h) ? p.expanded.delete(h) : p.expanded.add(h);
      return rerender(vid);
    }
    case 'lmenu':
      p.menu = p.menu === el.dataset.key ? null : el.dataset.key;
      return rerender(vid);
    case 'lrename':
      p.menu = null;
      return toast(vid, T().toastRename);
    case 'lmove': {
      const [h, l, d] = ['h', 'l', 'd'].map((k) => Number(el.dataset[k]));
      const ls = p.hhs[h].lists;
      [ls[l], ls[l + d]] = [ls[l + d], ls[l]];
      if (h === p.hh && p.list === l) p.list = l + d;
      else if (h === p.hh && p.list === l + d) p.list = l;
      p.menu = `${h}:${l + d}`;
      return rerender(vid);
    }
    case 'ldel': {
      const [h, l] = ['h', 'l'].map((k) => Number(el.dataset[k]));
      const ls = p.hhs[h].lists;
      if (ls.length < 2) return toast(vid, T().toastLastList);
      const [gone] = ls.splice(l, 1);
      if (h === p.hh && p.list >= l && p.list > 0) p.list -= 1;
      p.menu = null;
      return toast(vid, T().toastDelete(gone[S.lang]));
    }
    case 'lnew': {
      const h = Number(el.dataset.h);
      p.hhs[h].lists.push({ de: 'Neue Liste', en: 'New list', open: 0 });
      p.hh = h;
      p.list = p.hhs[h].lists.length - 1;
      p.menu = null;
      return toast(vid, T().toastNewList);
    }
    case 'st-exp':
      p.stOpen = !p.stOpen;
      return rerender(vid);
    case 'jump': {
      ev.stopPropagation();
      p.folded.delete(el.dataset.store);
      rerender(vid);
      const host = document.querySelector(`[data-host="${vid}"]`);
      const sc = host.querySelector('.scroll');
      const target = host.querySelector(`.scroll [data-sec="${el.dataset.store}"]`);
      if (target) sc.scrollTo({ top: sc.scrollTop + target.getBoundingClientRect().top - sc.getBoundingClientRect().top - host.querySelector('.top').offsetHeight - 4, behavior: 'smooth' });
      return;
    }
    case 'trip-end':
      p.mode = 'plan';
      p.trip = null;
      return toast(vid, T().toastEnd);
    default:
  }
};

// Hold opens the edit sheet (as today); a left swipe in LD5 shows the price action; dragging LD4's handle up opens its sheet.
// Listeners sit on the host, which outlives re-renders, so a hold's release cannot land on a fresh scrim as a click.
const gestures = {};
const wirePhone = (host) => {
  const vid = host.dataset.host;
  const g = (gestures[vid] = { hold: null, start: null, swallow: false, last: 0 });
  host.addEventListener('pointerdown', (e) => {
    g.swallow = false;
    const row = e.target.closest('.item');
    const handle = e.target.closest('.handle-row');
    if (!row && !handle) return;
    g.start = { x: e.clientX, y: e.clientY, id: row?.dataset.id, handle: !!handle };
    if (row)
      g.hold = setTimeout(() => {
        g.swallow = true;
        phones[vid].editor = null;
        phones[vid].sheet = `item:${row.dataset.id}`;
        rerender(vid);
      }, 450);
  });
  host.addEventListener('pointermove', (e) => {
    if (!g.start) return;
    const dx = e.clientX - g.start.x;
    const dy = e.clientY - g.start.y;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      clearTimeout(g.hold);
      g.swallow = true;
    }
    if (g.start.handle && dy < -30 && phones[vid].sheet !== 'dock') {
      phones[vid].sheet = 'dock';
      g.start = null;
      rerender(vid);
    } else if (vid === 'LD5' && g.start.id && dx < -40 && phones[vid].swiped !== g.start.id) {
      phones[vid].swiped = g.start.id;
      rerender(vid);
    }
  });
  const end = () => {
    clearTimeout(g.hold);
    g.start = null;
  };
  host.addEventListener('pointerup', end);
  host.addEventListener('pointercancel', end);
  host.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (g.swallow) {
      g.swallow = false;
      return;
    }
    if (el) act(vid, el, e);
  });
  host.addEventListener('keydown', (e) => {
    g.swallow = false;
    const inp = e.target.closest('[data-price-for]');
    if (inp && e.key === 'Enter') savePrice(vid, inp.dataset.priceFor, inp);
  });
  host.addEventListener('scroll', () => onScroll(host), { capture: true, passive: true });
  syncScroll(host);
};

const onScroll = (host) => {
  const vid = host.dataset.host;
  const g = gestures[vid];
  const p = phones[vid];
  const y = host.querySelector('.scroll').scrollTop;
  if (vid === 'BB5') {
    const sc = host.querySelector('.scroll');
    const end = y + sc.clientHeight >= sc.scrollHeight - 4;
    const away = y < 40 || end ? false : y > g.last + 4 ? true : y < g.last - 4 ? false : p.away;
    if (away !== p.away) {
      p.away = away;
      host.querySelector('.phone').classList.toggle('away', away);
    }
  }
  if (host.querySelector('[data-quick]')) {
    if (y < 80) p.quick = false;
    else if (y < g.last - 4) p.quick = true;
    else if (y > g.last + 4) p.quick = false;
  }
  g.last = y;
  syncScroll(host);
  measureAll();
};

const syncScroll = (host) => {
  const stack = host.querySelector('.bottom').offsetHeight;
  for (const el of host.querySelectorAll('.snack')) el.style.bottom = `${stack + 8}px`;
  for (const el of host.querySelectorAll('.toast')) el.style.bottom = `${stack + 68}px`;
  // As the app's pill: when the labels don't fit, the other tabs keep their icon only.
  for (const pill of host.querySelectorAll('.pill-nav.three:not(.fieldtab)')) {
    pill.classList.remove('crowded');
    if (pill.getBoundingClientRect().width > host.querySelector('.phone').clientWidth - 32) pill.classList.add('crowded');
  }
  for (const t of host.querySelectorAll('.chiprow .track')) t.classList.toggle('more', t.scrollWidth > t.clientWidth + 1 && t.scrollLeft + t.clientWidth < t.scrollWidth - 1);
  const sc = host.querySelector('.scroll');
  if (host.querySelector('.phone.r2')) {
    sc.style.paddingTop = `${host.querySelector('.top').offsetHeight}px`;
    host.querySelector('.top').classList.toggle('lifted', sc.scrollTop > 4);
    // BB5's band shrinks while scrolling; the padding keeps the resting height so the list's end stays put.
    if (!host.querySelector('.phone.away')) host.dataset.rest = stack;
    sc.style.paddingBottom = `${Math.max(stack, Number(host.dataset.rest ?? 0)) + 24}px`;
  }
  const mini = host.querySelector('[data-mini]');
  if (mini) mini.classList.toggle('pinned', sc.scrollTop > host.querySelector('[data-collapse-src]').offsetHeight - 4);
  host.querySelector('[data-quick]')?.classList.toggle('show', !!phones[host.dataset.host].quick);
};

addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  for (const [vid, p] of Object.entries(phones)) {
    if (!p.sheet && !p.editor && !p.swiped) continue;
    p.sheet = null;
    p.editor = null;
    p.swiped = null;
    rerender(vid);
  }
});

const wire = () => {
  for (const b of document.querySelectorAll('.controls [data-set]'))
    b.addEventListener('click', () => {
      const changedData = ['data', 'scen'].includes(b.dataset.set) && S[b.dataset.set] !== b.dataset.val;
      S[b.dataset.set] = b.dataset.val;
      if (changedData) reset();
      const q = new URLSearchParams({ lang: S.lang, theme: S.theme, data: S.data, ...(round.people && { scen: S.scen }), ts: S.ts });
      history.replaceState(null, '', `?${q}#/${S.view}`);
      render();
    });
  for (const b of document.querySelectorAll('.controls .group [aria-pressed="true"]')) b.parentElement.scrollLeft = b.offsetLeft - 8;
  document.querySelector('.controls [data-act="opts"]')?.addEventListener('click', () => {
    S.opts = !S.opts;
    render();
  });
  document.querySelector('.controls [data-act="reset"]')?.addEventListener('click', () => {
    reset();
    render();
  });
  document.querySelectorAll('[data-host]').forEach(wirePhone);
  measureAll();
};

setInterval(() => {
  for (const el of document.querySelectorAll('[data-clock]')) {
    const vid = el.closest('.phone').dataset.v;
    el.textContent = clock(phones[vid]);
  }
}, 1000);

// The phone gets both themes from the site tokens, independent of the device setting.
const themeTokens = async () => {
  const css = await (await fetch(document.querySelector('link[data-tokens]').href)).text();
  const light = css.match(/:root\s*{([^}]*)}/)[1];
  const dark = css.match(/prefers-color-scheme:\s*dark\)\s*{\s*:root\s*{([^}]*)}/)[1];
  const st = document.createElement('style');
  st.textContent = `.th-light{${light}color-scheme:light}.th-dark{${dark}color-scheme:dark;--hl-shadow-sticker-s:var(--hl-shadow-night-s)}`;
  document.head.append(st);
};

// Just enough Markdown for RECOMMENDATION*.md: headings, paragraphs, bullets, one table, bold and code.
const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>');
const markdown = (md) =>
  md
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split('\n');
      if (block.startsWith('## ')) return `<h3>${inline(block.slice(3))}</h3>`;
      if (block.startsWith('# ')) return `<h2>${inline(block.slice(2))}</h2>`;
      if (lines.every((l) => l.startsWith('- '))) return `<ul>${lines.map((l) => `<li>${inline(l.slice(2))}</li>`).join('')}</ul>`;
      if (lines[0].startsWith('|')) {
        const cells = (l) => l.split('|').slice(1, -1).map((c) => c.trim());
        const [head, , ...body] = lines;
        return `<table><tr>${cells(head).map((c) => `<th>${inline(c)}</th>`).join('')}</tr>${body.map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</table>`;
      }
      return `<p>${inline(block)}</p>`;
    })
    .join('');

const loadRec = async () => {
  for (const [lang, file] of [['de', `${round.rec.file}.de.md`], ['en', `${round.rec.file}.md`]]) {
    const res = await fetch(new URL(file, import.meta.url));
    recHtml[lang] = res.ok ? markdown(await res.text()) : '';
  }
};

narrow.addEventListener('change', () => render());
addEventListener('hashchange', () => {
  S.view = viewOf(location.hash.slice(2));
  render();
});

reset();
await Promise.all([themeTokens(), loadRec(), document.fonts.ready]);
render();
// Text measured before a font face arrived (160 % pulls new sizes) would leave a pill crowded: measure again.
document.fonts.addEventListener('loadingdone', () => document.querySelectorAll('[data-host]').forEach(syncScroll));
