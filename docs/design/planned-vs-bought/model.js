// One shopping trip: the list snapshot taken at "Einkauf starten", and what was
// bought (ticked on the list or logged by hand). Every approach renders from
// classify(), so they differ in presentation only.

export const scenarios = {
  basic: {
    label: 'Milch + Brot, dazu ein Snack',
    before: [
      { id: 'milch', name: 'Milch', price: 1.19 },
      { id: 'brot', name: 'Brot', price: 2.49 },
    ],
    steps: [
      { type: 'tick', id: 'milch' },
      { type: 'tick', id: 'brot' },
      { type: 'log', item: { id: 'chips', name: 'Chips', price: 1.99 } },
    ],
  },
  empty: {
    label: 'Leere Liste beim Start',
    before: [],
    steps: [
      { type: 'log', item: { id: 'milch', name: 'Milch', price: 1.19 } },
      { type: 'log', item: { id: 'kaffee', name: 'Kaffee', price: 6.99 } },
    ],
  },
  during: {
    label: 'Unterwegs dazugekommen',
    before: [
      { id: 'milch', name: 'Milch', price: 1.19 },
      { id: 'brot', name: 'Brot', price: 2.49 },
    ],
    steps: [
      { type: 'tick', id: 'milch' },
      { type: 'add', item: { id: 'eier', name: 'Eier', price: 2.29 }, by: 'Ben' },
      { type: 'tick', id: 'eier' },
      { type: 'add', item: { id: 'butter', name: 'Butter', price: null }, by: 'Ben' },
      { type: 'log', item: { id: 'chips', name: 'Chips', price: null } },
    ],
  },
  nothing: {
    label: 'Leere Liste, nichts gekauft',
    before: [],
    steps: [],
  },
};

export const ME = 'Anna';

export function initialState(scenarioId, { played = true } = {}) {
  const scenario = scenarios[scenarioId];
  const state = {
    scenarioId,
    phase: 'before',
    snapshot: new Set(),
    items: scenario.before.map((i) => ({ ...i, origin: 'list', by: ME, bought: false })),
    step: 0,
    reclassified: new Set(),
    removed: new Set(),
  };
  if (played) {
    start(state);
    while (state.step < scenario.steps.length) next(state);
  }
  return state;
}

export function start(state) {
  state.phase = 'shopping';
  state.snapshot = new Set(state.items.filter((i) => !i.bought).map((i) => i.id));
}

export function finish(state) {
  state.phase = 'done';
}

export function next(state) {
  const step = scenarios[state.scenarioId].steps[state.step];
  if (!step) return false;
  if (state.phase === 'before') start(state);
  apply(state, step);
  state.step += 1;
  return true;
}

export function apply(state, step) {
  if (step.type === 'tick') toggle(state, step.id);
  if (step.type === 'add') addDuring(state, step.item, step.by);
  if (step.type === 'log') logBought(state, step.item);
}

// The first tick starts the trip, so a list item ticked before "Einkauf
// starten" is still on the snapshot.
export function toggle(state, id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  if (state.phase === 'before' && !item.bought) start(state);
  item.bought = !item.bought;
}

// Same name, case and spaces ignored: a stand-in for items.canonical_key.
const openNamed = (state, name) => {
  const key = name.trim().toLowerCase();
  return state.items.find((i) => !i.bought && i.name.trim().toLowerCase() === key);
};

export function addDuring(state, item, by = ME) {
  if (openNamed(state, item.name)) return;
  const origin = state.phase === 'before' ? 'list' : 'during';
  state.items.push({ price: null, ...item, origin, by, bought: false });
}

export function logBought(state, item) {
  if (state.phase === 'before') start(state);
  const open = openNamed(state, item.name);
  if (open) open.bought = true;
  else state.items.push({ price: null, ...item, origin: 'logged', by: ME, bought: true });
}

// After the review: what was not bought (and not removed) is the next list.
export function nextTrip(state) {
  state.items = state.items
    .filter((i) => !i.bought && !state.removed.has(i.id))
    .map((i) => ({ ...i, origin: 'list' }));
  state.phase = 'before';
  state.snapshot = new Set();
  state.reclassified = new Set();
  state.removed = new Set();
  state.step = scenarios[state.scenarioId].steps.length;
}

let seq = 0;
export function newId(name) {
  seq += 1;
  return `${name.toLowerCase().replace(/[^a-zäöüß]+/g, '-')}-${seq}`;
}

// planned: on the snapshot (or marked "war geplant" in the review).
// kind: 'planned-bought' | 'planned-open' | 'extra' | 'during-open'
export function classify(state) {
  return state.items.map((item) => {
    const planned = state.snapshot.has(item.id) || state.reclassified.has(item.id);
    let kind;
    if (planned) kind = item.bought ? 'planned-bought' : 'planned-open';
    else kind = item.bought ? 'extra' : 'during-open';
    return { ...item, planned, kind };
  });
}

export function summary(rows) {
  const count = (k) => rows.filter((r) => r.kind === k).length;
  return {
    planned: rows.filter((r) => r.planned).length,
    plannedBought: count('planned-bought'),
    plannedOpen: count('planned-open'),
    extra: count('extra'),
    duringOpen: count('during-open'),
    bought: rows.filter((r) => r.bought).length,
  };
}

// A sum only when every row has a confirmed price; otherwise how many lack one.
export function priceSum(rows) {
  const missing = rows.filter((r) => r.price == null).length;
  if (missing) return { complete: false, missing, of: rows.length };
  return { complete: true, total: rows.reduce((s, r) => s + r.price, 0) };
}

export const euro = (n) =>
  n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

// Earlier trips this week for the weekly summary (made-up data).
export const pastTrips = [
  {
    day: 'Mo',
    store: 'Wochenmarkt',
    rows: [
      ['Äpfel', true, true, 2.4],
      ['Käse', true, true, 4.2],
      ['Blumen', false, true, 5.0],
    ],
  },
  {
    day: 'Mi',
    store: 'Supermarkt',
    rows: [
      ['Nudeln', true, true, 1.29],
      ['Tomaten', true, true, 1.99],
      ['Basilikum', true, false, null],
      ['Spülmittel', true, true, 1.45],
      ['Schokolade', false, true, null],
    ],
  },
];
