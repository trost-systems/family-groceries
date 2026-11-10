// Words for times and numbers on the page. Pure, so the tests pin them.

const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;

/** "45 s", "4 min", "2 h 10 min", "3 d 4 h". */
export function duration(ms: number): string {
  const abs = Math.max(0, ms);
  if (abs < minute) return `${Math.round(abs / 1000)} s`;
  if (abs < hour) return `${Math.floor(abs / minute)} min`;
  if (abs < day) {
    const h = Math.floor(abs / hour);
    const m = Math.floor((abs % hour) / minute);
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
  }
  const d = Math.floor(abs / day);
  const h = Math.floor((abs % day) / hour);
  return h === 0 ? `${d} d` : `${d} d ${h} h`;
}

export function ago(iso: string, now: Date): string {
  const ms = now.getTime() - Date.parse(iso);
  return ms < minute ? 'just now' : `${duration(ms)} ago`;
}

export type Freshness = 'fresh' | 'stale' | 'outdated';

/** The page is published once a night (~03:00): stale after 25 h (one missed night), outdated after 49 h. */
export function freshness(generatedAt: string, now: Date): { level: Freshness; label: string } {
  const age = now.getTime() - Date.parse(generatedAt);
  const level: Freshness = age > 49 * hour ? 'outdated' : age > 25 * hour ? 'stale' : 'fresh';
  return { level, label: `updated ${ago(generatedAt, now)}` };
}

export function percent(fraction: number): string {
  return `${Math.round(fraction * 100)} %`;
}

/** Signed change from a to b in percent of a, e.g. "−24.9 %". */
export function change(from: number, to: number): string {
  if (from === 0) return to === 0 ? '0 %' : 'n/a';
  const pct = ((to - from) / Math.abs(from)) * 100;
  // Whole percent from 10 % on, but a partial change never rounds up to a total one: −99.8 % stays,
  // −99.97 % reads −99.9 %.
  const whole = Math.round(pct);
  const nearTotal = Math.abs(whole) === 100 && Math.abs(pct) !== 100;
  const rounded = nearTotal
    ? Math.trunc(pct * 10) / 10
    : Math.abs(pct) >= 10
    ? whole
    : Math.round(pct * 10) / 10;
  if (rounded === 0) return '0 %';
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)} %`;
}

/** A score in 3 significant digits: 175.0005 -> "175", 10.36 -> "10.4", 0.000491 -> "< 0.01". */
export function score(n: number): string {
  if (n === 0) return '0';
  if (Math.abs(n) < 0.01) return n > 0 ? '< 0.01' : '> −0.01';
  if (Math.abs(n) >= 100) return String(Math.round(n));
  return String(Number(n.toPrecision(3)));
}

const berlinTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Berlin',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const berlinDate = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' });
const berlinWeekday = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short' });

/** "Fri 22:17", Berlin time. */
export function clock(iso: string): string {
  return berlinTime.format(new Date(iso));
}

/** A YYYY-MM-DD day as "6 Nov". */
export function dayLabel(date: string): string {
  return berlinDate.format(new Date(`${date}T12:00:00Z`));
}

/** A YYYY-MM-DD day as "Fri". */
export function weekdayLabel(date: string): string {
  return berlinWeekday.format(new Date(`${date}T12:00:00Z`));
}
