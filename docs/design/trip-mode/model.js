// Shopping trip mode, job 217. Throwaway sandbox: one state shape for all five prototypes.
//
// A trip is: when it started (the moment of the tick that started it), the open items just
// before that tick (the snapshot), its pauses, the stores it passed, and when and why it ended.
// "Bought" is every item ticked between start and end, by anyone. Planned = the snapshot.
// Everything else bought is extra; extras someone else wrote onto the list mid-trip carry
// "von <Name>", and "War geplant" moves an extra into the planned part.

export const ME = 'Peter';
export const MIN = 60_000;
export const HOUR = 60 * MIN;
const BASE = Date.parse('2026-11-14T10:00:00+01:00');
const KEY = 'tm217-state';

export const STORES = ['Lidl', 'Rewe'];

const CATALOG = {
  Bananen: ['🍌', '6×', 'Lidl'], Äpfel: ['🍎', '1 kg', 'Lidl'], Brötchen: ['🥖', '4×', 'Lidl'],
  Vollmilch: ['🥛', '2×', 'Lidl'], Butter: ['🧈', '', 'Lidl'], Nudeln: ['🍝', '', 'Lidl'],
  Spülmittel: ['🧴', '', 'Lidl'], Kaffee: ['☕', '', 'Rewe'], Joghurt: ['🥣', '4×', 'Rewe'],
  Basilikum: ['🌿', '', 'Rewe'], Feta: ['🧀', '', 'Rewe'], Eis: ['🍦', '', 'Lidl'],
  Milch: ['🥛', '', 'Lidl'], Eier: ['🥚', '10×', 'Lidl'], Kerzen: ['🕯️', '', 'Rewe'],
};

export function newItem(name, addedBy, at, store) {
  const [emoji, qty, defaultStore] = CATALOG[name] ?? ['', '', null];
  return { id: `${name}-${at}`, name, emoji, qty, store: store ?? defaultStore, addedBy, addedAt: at, doneAt: null, doneBy: null };
}

export function freshState(names, v = 'TM1', premium = true) {
  const at = BASE - 26 * HOUR;
  return {
    v, premium,
    items: names.map((n, i) => newItem(n, i % 3 === 2 ? 'Lea' : ME, at + i * MIN)),
    trip: null,
    prompt: null,
    quiet: null,
    history: [],
    notice: null,
    seenSummary: false,
    clock: { real: Date.now(), sim: BASE },
  };
}

export function now(s) { return s.clock.sim + (Date.now() - s.clock.real); }
export function advance(s, ms) { s.clock.sim += ms; }

export function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }
export function load() {
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
}

export const isOpen = (i) => i.doneAt === null;
export const byId = (s, id) => s.items.find((i) => i.id === id);
export const byName = (s, name) => s.items.find((i) => i.name === name);

export function pausedMs(trip, at) {
  return trip.pauses.reduce((sum, p) => {
    const to = Math.min(p.to ?? at, at);
    return sum + Math.max(0, to - p.from);
  }, 0);
}
export const isPaused = (trip) => trip.pauses.some((p) => p.to === null);
export function elapsed(s, trip = s.trip) {
  const at = trip.endedAt ?? now(s);
  return Math.max(0, at - trip.startedAt - pausedMs(trip, at));
}
export function lastTickAt(s, trip = s.trip) {
  const ticks = s.items.filter((i) => i.doneAt !== null && i.doneAt >= trip.startedAt).map((i) => i.doneAt);
  return Math.max(trip.startedAt, ...ticks);
}

// The last sign of life: a tick, "Läuft noch" on a nudge, or "Doch weiter" after an end.
export function lastActivity(s, trip = s.trip) {
  return Math.max(lastTickAt(s, trip), trip.nudgeSnoozedAt ?? 0, trip.reopenedAt ?? 0);
}

export function clock(ms) {
  const t = Math.floor(ms / 1000);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
export function minutes(ms) {
  const m = Math.round(ms / MIN);
  if (m < 60) return `${m} Min.`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} Std. ${m % 60} Min.` : `${h} Std.`;
}
export function hhmm(at) {
  return new Date(at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
}
export function dayKey(at) {
  return new Date(at).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' });
}
export function dayLabel(at, ref) {
  if (dayKey(at) === dayKey(ref)) return 'Heute';
  if (dayKey(at) === dayKey(ref - 24 * HOUR)) return 'Gestern';
  return new Date(at).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Berlin' });
}

// What each prototype does at its decision points. `ask` decides whether a tick with no
// trip running raises the prompt; `decline` records the answer "no"; `watch` runs every
// second of simulated time and applies the long-running rule.
export const POLICY = {
  TM1: {
    declineRule: '„Nein“ gilt, bis 2 Stunden lang nichts abgehakt wurde. Danach fragt das nächste Abhaken wieder. Wer trotzdem einkauft, startet in Mehr › „Einkauf starten“ (in allen fünf).',
    longRule: 'Nach 2 Stunden ohne Abhaken, auch pausiert, fragt die Leiste „Noch beim Einkaufen?“ mit „Läuft noch“ (fragt 2 Stunden später wieder) und „Beenden um 10:06“ (das letzte Abhaken).',
    ask: (s, item, at) => !(s.quiet && at - s.quiet.lastTickAt < 2 * HOUR),
    decline: (s, at) => { s.quiet = { lastTickAt: at }; },
    onTick: (s, at) => { if (s.quiet) s.quiet.lastTickAt = at; },
    watch: (s, at) => {
      const t = s.trip;
      if (!t.nudge && at - lastActivity(s) >= 2 * HOUR) t.nudge = true;
    },
  },
  TM2: {
    declineRule: '„Nein, nur abgehakt“ gilt für den Rest des Tages. „Zurücknehmen“ macht das Abhaken rückgängig und merkt sich nichts.',
    longRule: 'Nach 45 Minuten ohne Abhaken pausiert die Uhr von selbst (ab dem letzten Abhaken + 45 Min.). Nach 4 Stunden ohne Abhaken, auch pausiert, endet der Einkauf beim letzten Abhaken; „Doch weiter“ holt ihn zurück.',
    ask: (s, item, at) => !(s.quiet && s.quiet.day === dayKey(at)),
    decline: (s, at) => { s.quiet = { day: dayKey(at) }; },
    onTick: () => {},
    watch: (s, at) => {
      const t = s.trip;
      const last = lastTickAt(s);
      const quietSince = lastActivity(s);
      if (at - quietSince >= 4 * HOUR) {
        closePauses(t, last);
        endTrip(s, last, 'auto');
        s.notice = { kind: 'autoEnded', tripId: t.id };
        return;
      }
      if (!isPaused(t) && at - quietSince >= 45 * MIN && !t.pauses.some((p) => p.from >= quietSince)) {
        t.pauses.push({ from: quietSince + 45 * MIN, to: null, auto: true });
      }
    },
  },
  TM3: {
    declineRule: 'Die Frage kommt als Hinweis unten und geht nach 6 Sekunden von selbst. Ohne Antwort fragt höchstens das dritte Abhaken noch einmal, dann erst wieder nach 3 Stunden Ruhe. In den Szenarien wartet der Hinweis auf den nächsten Schritt.',
    longRule: 'Nach 3 Stunden Laufzeit kommt eine Mitteilung „Einkauf läuft seit 3 Std.“ mit „Beenden“ (beim letzten Abhaken) und „Läuft noch“.',
    ask: (s, item, at) => {
      const q = s.quiet;
      if (!q) return true;
      if (at - q.lastTickAt >= 3 * HOUR) return true;
      return q.asked < 2 && q.ticks === 1;
    },
    decline: (s, at) => {
      const q = s.quiet;
      s.quiet = q && at - q.lastTickAt < 3 * HOUR ? { ...q, asked: q.asked + 1, lastTickAt: at } : { asked: 1, ticks: 0, lastTickAt: at };
    },
    onTick: (s, at) => { if (s.quiet) { s.quiet.ticks += 1; s.quiet.lastTickAt = at; } },
    watch: (s, at) => {
      const t = s.trip;
      if (!t.notified && at - Math.max(t.startedAt, t.nudgeSnoozedAt ?? 0, t.reopenedAt ?? 0) >= 3 * HOUR) { t.notified = true; s.notice = { kind: 'osBanner' }; }
    },
  },
  TM4: {
    declineRule: '„Nein“ gilt für diesen Laden bis morgen. Ein Artikel aus einem anderen Laden fragt nach diesem Laden.',
    longRule: 'Nach 90 Minuten ohne Abhaken, auch pausiert, fragt die Leiste „Noch bei Rewe?“ mit „Läuft noch“ und „Beenden um …“ (das letzte Abhaken).',
    ask: (s, item, at) => !(s.quiet && s.quiet.day === dayKey(at) && s.quiet.stores.includes(item.store ?? '')),
    decline: (s, at, item) => {
      const same = s.quiet && s.quiet.day === dayKey(at);
      s.quiet = { day: dayKey(at), stores: [...(same ? s.quiet.stores : []), item.store ?? ''] };
    },
    onTick: () => {},
    watch: (s, at) => {
      const t = s.trip;
      if (!t.nudge && at - lastActivity(s) >= 90 * MIN) t.nudge = true;
    },
  },
  TM5: {
    declineRule: 'Das erste Abhaken fragt im Artikel selbst: „Gekauft“ oder „Nicht mehr nötig“. Nach „Nicht mehr nötig“ hakt jedes Abhaken der nächsten 30 Minuten einfach ab.',
    longRule: 'Nach 2 Stunden ohne Abhaken endet der Einkauf still beim letzten Abhaken. Die Liste zeigt dann „Einkauf um 10:42 beendet“ mit „Doch weiter“.',
    ask: (s, item, at) => !(s.quiet && at - s.quiet.at < 30 * MIN),
    decline: (s, at) => { s.quiet = { at }; },
    onTick: () => {},
    watch: (s, at) => {
      const t = s.trip;
      const last = lastTickAt(s);
      if (at - lastActivity(s) >= 2 * HOUR) {
        closePauses(t, last);
        endTrip(s, last, 'auto');
        s.notice = { kind: 'autoEndedCard', tripId: t.id };
      }
    },
  },
};

function closePauses(t, at) {
  for (const p of t.pauses) if (p.to === null) p.to = Math.max(p.from, at);
}

// The tick. Returns 'prompt' when the variant asks, else null.
export function tick(s, id, by = ME) {
  const item = byId(s, id);
  const at = now(s);
  if (!isOpen(item)) {
    item.doneAt = null;
    item.doneBy = null;
    if (s.prompt && s.prompt.itemId === id) s.prompt = null;
    return null;
  }
  const openBefore = s.items.filter(isOpen).map((i) => i.id);
  item.doneAt = at;
  item.doneBy = by;
  if (s.trip) {
    enterStore(s, item.store, at);
    return null;
  }
  const policy = POLICY[s.v];
  if (by !== ME || s.prompt) return null;
  if (!policy.ask(s, item, at)) { policy.onTick(s, at); return null; }
  policy.onTick(s, at);
  s.prompt = { itemId: id, at, snapshot: openBefore, store: item.store };
  return 'prompt';
}

export function answer(s, yes) {
  const p = s.prompt;
  if (!p) return;
  s.prompt = null;
  if (!yes) {
    const item = byId(s, p.itemId);
    POLICY[s.v].decline(s, p.at, item);
    return;
  }
  s.quiet = null;
  s.trip = {
    id: `t${p.at}`, startedAt: p.at, snapshot: p.snapshot, pauses: [], segments: [{ store: p.store, from: p.at }],
    markedPlanned: [], endedAt: null, endReason: null, nudge: false, notified: false,
  };
  const later = s.items.filter((i) => i.doneAt !== null && i.doneAt > p.at).sort((a, b) => a.doneAt - b.doneAt);
  for (const i of later) enterStore(s, i.store, i.doneAt);
}

// A trip started by hand (Mehr › Einkauf starten): the snapshot is every open item now.
export function startByHand(s) {
  if (s.trip) return;
  const at = now(s);
  s.prompt = null;
  s.quiet = null;
  s.trip = {
    id: `t${at}`, startedAt: at, snapshot: s.items.filter(isOpen).map((i) => i.id), pauses: [], segments: [{ store: null, from: at }],
    markedPlanned: [], endedAt: null, endReason: null, nudge: false, notified: false,
  };
}

// Accidental tick: take it back and forget the prompt without counting it as "no".
export function undoPromptTick(s) {
  const p = s.prompt;
  if (!p) return;
  const item = byId(s, p.itemId);
  item.doneAt = null;
  item.doneBy = null;
  s.prompt = null;
}

function enterStore(s, store, at) {
  const segs = s.trip.segments;
  const last = segs[segs.length - 1];
  if (!store || last.store === store) return;
  if (last.store === null) last.store = store;
  else segs.push({ store, from: at });
}

export function pause(s) { if (!isPaused(s.trip)) s.trip.pauses.push({ from: now(s), to: null }); s.trip.nudge = false; }
export function resume(s) {
  for (const p of s.trip.pauses) if (p.to === null) p.to = now(s);
  s.trip.nudge = false;
}
export function keepGoing(s) { s.trip.nudge = false; s.trip.notified = false; s.trip.nudgeSnoozedAt = now(s); }

export function endTrip(s, at = now(s), reason = 'user') {
  const t = s.trip;
  closePauses(t, at);
  t.endedAt = at;
  t.endReason = reason;
  s.history.unshift(freeze(s, t));
  s.trip = null;
  s.prompt = null;
  return s.history[0];
}

// Undo an end: the trip runs on as if it never ended (the gap counts as a pause).
export function reopenTrip(s, tripId) {
  const idx = s.history.findIndex((h) => h.id === tripId);
  if (idx < 0 || s.trip) return;
  const h = s.history[idx];
  s.history.splice(idx, 1);
  const at = now(s);
  s.trip = {
    ...h.trip, endedAt: null, endReason: null, nudge: false, notified: false, reopenedAt: at, markedPlanned: h.markedPlanned,
    pauses: [...h.trip.pauses, { from: h.trip.endedAt, to: at }],
  };
  s.notice = null;
}

// The summary rows are frozen at the end, so a history entry keeps them after the list changes.
function freeze(s, t) {
  const bought = (i) => i.doneAt !== null && i.doneAt >= t.startedAt && i.doneAt <= t.endedAt;
  const snap = new Set(t.snapshot);
  const row = (i) => ({ id: i.id, name: i.name, emoji: i.emoji, qty: i.qty, store: i.store, bought: bought(i), addedBy: i.addedBy });
  const planned = s.items.filter((i) => snap.has(i.id)).map(row);
  const added = s.items
    .filter((i) => !snap.has(i.id) && (bought(i) || (i.addedAt > t.startedAt && i.addedAt <= t.endedAt)))
    .map((i) => ({ ...row(i), by: i.addedAt > t.startedAt && i.addedBy !== ME ? i.addedBy : null }));
  return {
    id: t.id, startedAt: t.startedAt, endedAt: t.endedAt, durationMs: elapsed(s, t), endReason: t.endReason,
    segments: t.segments, planned, added, markedPlanned: [...(t.markedPlanned ?? [])], trip: t,
  };
}

export function storeTime(trip, store, end) {
  const segs = trip.segments;
  return segs.reduce((sum, g, i) => {
    if (g.store !== store) return sum;
    const to = segs[i + 1] ? segs[i + 1].from : end;
    const paused = trip.pauses.reduce((p, x) => p + Math.max(0, Math.min(x.to ?? to, to) - Math.max(x.from, g.from)), 0);
    return sum + Math.max(0, to - g.from - paused);
  }, 0);
}

export function togglePlanned(entry, id) {
  const m = entry.markedPlanned;
  const i = m.indexOf(id);
  if (i >= 0) m.splice(i, 1); else m.push(id);
}

// Approach 1, snapshot vs ticked list: the planned part (snapshot plus "War geplant") and what
// came in since the start.
export function summary(entry) {
  const marked = new Set(entry.markedPlanned);
  const planned = [...entry.planned, ...entry.added.filter((r) => marked.has(r.id)).map((r) => ({ ...r, wasMarked: true }))];
  const added = entry.added.filter((r) => !marked.has(r.id));
  return {
    planned, added,
    plannedBought: planned.filter((r) => r.bought).length,
    extraBought: added.filter((r) => r.bought).length,
    bought: planned.filter((r) => r.bought).length + added.filter((r) => r.bought).length,
    stores: [...new Set([...entry.segments.map((g) => g.store), ...[...planned, ...added].filter((r) => r.bought).map((r) => r.store)].filter(Boolean))]
      .filter((st) => [...planned, ...added].some((r) => r.bought && r.store === st)),
  };
}

export function addItem(s, name, by = ME) {
  const at = now(s);
  const existing = byName(s, name);
  if (existing && isOpen(existing)) return existing;
  const item = newItem(name, by, at);
  s.items.push(item);
  return item;
}
