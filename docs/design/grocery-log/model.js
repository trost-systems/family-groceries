// Shared data for all five approaches. A trip is one shop at one store on one day:
// { id, store, date: 'YYYY-MM-DD', by, items: [{ name, qty }] }. No prices: this is a log, not spend.

export const TODAY = '2026-11-12';
export const ME = 'Anna';

export const stores = [
  { id: 'rewe', name: 'Rewe' },
  { id: 'aldi', name: 'Aldi Süd' },
  { id: 'markt', name: 'Wochenmarkt' },
  { id: 'dm', name: 'dm' },
];
export const storeName = (id) => stores.find((s) => s.id === id)?.name ?? id;

const i = (name, qty = '') => ({ name, qty });
const seededTrips = () => [
  { id: 't1', store: 'rewe', date: '2026-11-10', by: 'Anna', items: [i('Milch', '2'), i('Eier', '10'), i('Äpfel', '1 kg'), i('Haferflocken')] },
  { id: 't2', store: 'markt', date: '2026-11-07', by: 'Ben', items: [i('Tomaten', '500 g'), i('Feldsalat'), i('Bergkäse', '200 g')] },
  { id: 't3', store: 'dm', date: '2026-11-06', by: 'Anna', items: [i('Zahnpasta'), i('Duschgel', '2')] },
  { id: 't4', store: 'aldi', date: '2026-11-03', by: 'Ben', items: [i('Bananen'), i('Nudeln', '2'), i('Passierte Tomaten', '2'), i('Joghurt', '4')] },
  { id: 't5', store: 'rewe', date: '2026-10-31', by: 'Anna', items: [i('Milch'), i('Brot'), i('Butter'), i('Kaffee')] },
  { id: 't6', store: 'aldi', date: '2026-10-27', by: 'Ben', items: [i('Bananen'), i('Haferflocken'), i('Reis', '1 kg')] },
  { id: 't7', store: 'markt', date: '2026-10-24', by: 'Anna', items: [i('Äpfel', '2 kg'), i('Kartoffeln', '2 kg'), i('Eier', '6')] },
  { id: 't8', store: 'rewe', date: '2026-10-20', by: 'Ben', items: [i('Milch'), i('Brot'), i('Bergkäse'), i('Kaffee')] },
  { id: 't9', store: 'dm', date: '2026-10-15', by: 'Anna', items: [i('Handseife'), i('Taschentücher')] },
];

const seededList = () => [
  { id: 'l1', name: 'Milch', qty: '', store: 'rewe', done: false },
  { id: 'l2', name: 'Brot', qty: '', store: 'rewe', done: false },
  { id: 'l3', name: 'Butter', qty: '', store: 'aldi', done: false },
  { id: 'l4', name: 'Bananen', qty: '', store: 'aldi', done: false },
];

export function seed(scenario) {
  return { trips: scenario === 'empty' ? [] : seededTrips(), list: seededList(), next: 100 };
}

const newest = (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
export const tripsByDate = (s) => [...s.trips].sort(newest);
export const tripsAt = (s, store) => tripsByDate(s).filter((t) => t.store === store);
export const tripsOn = (s, date) => tripsByDate(s).filter((t) => t.date === date);
export const trip = (s, id) => s.trips.find((t) => t.id === id);

export function saveTrip(s, draft) {
  const items = draft.items.map((x) => ({ name: x.name.trim(), qty: x.qty.trim() })).filter((x) => x.name);
  const t = { ...draft, items };
  if (draft.id && trip(s, draft.id)) s.trips = s.trips.map((x) => (x.id === draft.id ? t : x));
  else s.trips.push({ ...t, id: `t${s.next++}`, by: ME });
  return draft.id ?? s.trips.at(-1).id;
}

export function deleteTrip(s, id) {
  const gone = trip(s, id);
  s.trips = s.trips.filter((t) => t.id !== id);
  return gone;
}

const key = (name) => name.trim().toLocaleLowerCase('de');
export const onList = (s, name) => s.list.some((x) => !x.done && key(x.name) === key(name));

// Adds names to the open list; a name already open there is skipped, like the app's duplicate skip.
export function relist(s, items, store) {
  const added = [];
  for (const it of items) {
    if (onList(s, it.name)) continue;
    s.list.push({ id: `l${s.next++}`, name: it.name, qty: it.qty, store, done: false });
    added.push(it.name);
  }
  return added;
}

const utc = (d) => new Date(`${d}T12:00:00Z`);
export const iso = (date) => date.toISOString().slice(0, 10);
export const addDays = (d, n) => iso(new Date(utc(d).getTime() + n * 864e5));
const fmt = (opts) => new Intl.DateTimeFormat('de-DE', { ...opts, timeZone: 'UTC' });

export function dayLabel(d) {
  if (d === TODAY) return 'Heute';
  if (d === addDays(TODAY, -1)) return 'Gestern';
  return fmt({ weekday: 'short', day: 'numeric', month: 'short' }).format(utc(d));
}
export const inline = (d) => dayLabel(d).replace(/^(Heute|Gestern)$/, (x) => x.toLowerCase());
export const shortDay = (d) => fmt({ day: 'numeric', month: 'short' }).format(utc(d));
export const longDay = (d) => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(utc(d));
export const monthLabel = (ym) => fmt({ month: 'long', year: 'numeric' }).format(utc(`${ym}-01`));

// Monday-based weeks: "Diese Woche", "Letzte Woche", then the month.
export function periodLabel(d) {
  const monday = (x) => addDays(x, -((utc(x).getUTCDay() + 6) % 7));
  const weeks = Math.round((utc(monday(TODAY)) - utc(monday(d))) / (7 * 864e5));
  if (weeks === 0) return 'Diese Woche';
  if (weeks === 1) return 'Letzte Woche';
  return monthLabel(d.slice(0, 7));
}

export function summary(items, max = 3) {
  const names = items.map((x) => x.name);
  return names.length > max ? `${names.slice(0, max).join(', ')} und ${names.length - max} mehr` : names.join(', ');
}
export const countLabel = (n, one, many) => `${n} ${n === 1 ? one : many}`;
