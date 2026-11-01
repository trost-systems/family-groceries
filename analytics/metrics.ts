// The kill-gate and LTV metrics over exported PostHog events, as a reference for the HogQL in
// queries/ (docs/ANALYTICS.md). Each function mirrors one query step by step: same internal
// filter, same Europe/Berlin buckets, same windows. metrics_test.ts runs both definitions'
// expectations on fixtures.ts; the lead runs the HogQL against project 319492.

export interface Event {
  event: string;
  /** ISO 8601, UTC. */
  timestamp: string;
  properties: Record<string, unknown>;
}

const DAY = 86_400_000;

/** The Europe/Berlin calendar date (YYYY-MM-DD) of [timestamp]. */
export function berlinDate(timestamp: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(timestamp));
}

/** The Monday (Europe/Berlin) of [timestamp]'s week: toStartOfWeek(…, 1). */
export function berlinWeek(timestamp: string): string {
  const date = new Date(`${berlinDate(timestamp)}T00:00:00Z`);
  const sinceMonday = (date.getUTCDay() + 6) % 7;
  return new Date(date.getTime() - sinceMonday * DAY).toISOString().slice(0, 10);
}

/** The first of [timestamp]'s month (Europe/Berlin): toStartOfMonth(…). */
export function berlinMonth(timestamp: string): string {
  return `${berlinDate(timestamp).slice(0, 7)}-01`;
}

const str = (v: unknown) => (typeof v === 'string' && v !== '' ? v : null);
const num = (v: unknown) => (typeof v === 'number' ? v : 0);

/**
 * queries/internal.sql: drops every event of an install or household that ever sent
 * `is_internal = true`, so a test phone marked internal late, or a tester in a household,
 * takes all of it out.
 */
export function external(events: Event[]): Event[] {
  const installs = new Set<string>();
  const households = new Set<string>();
  for (const e of events) {
    if (e.properties.is_internal !== true) continue;
    const install = str(e.properties.install_id);
    const household = str(e.properties.household_id);
    if (install) installs.add(install);
    if (household) households.add(household);
  }
  return events.filter((e) => {
    const install = str(e.properties.install_id);
    const household = str(e.properties.household_id);
    return e.properties.is_internal !== true && !(install && installs.has(install)) &&
      !(household && households.has(household));
  });
}

const active = (e: Event) => e.event === 'item_added' || e.event === 'item_ticked';

/** queries/wah.sql: households with at least one add or tick in each Berlin week. */
export function weeklyActiveHouseholds(events: Event[]): Map<string, number> {
  const weeks = new Map<string, Set<string>>();
  for (const e of external(events)) {
    const household = str(e.properties.household_id);
    if (!active(e) || !household) continue;
    const week = berlinWeek(e.timestamp);
    weeks.set(week, (weeks.get(week) ?? new Set()).add(household));
  }
  return new Map([...weeks].sort().map(([w, hs]) => [w, hs.size]));
}

export interface UnlockCohort {
  installs: number;
  boughtByDay35: number;
  /** Percent, one decimal. */
  share: number;
}

/**
 * queries/unlock_d35.sql: per install week (the week of its first_open, Berlin), how many
 * installs completed a purchase within 35 days (35 × 24 h) of first_open. A purchase refunded
 * since (same transaction_ref) does not count.
 */
export function unlockByDay35(events: Event[]): Map<string, UnlockCohort> {
  const kept = external(events);
  const refunded = new Set(
    kept.filter((e) => e.event === 'purchase_refunded').map((e) =>
      str(e.properties.transaction_ref)
    ),
  );
  const firstOpen = new Map<string, number>();
  const bought = new Map<string, number>();
  for (const e of kept) {
    const install = str(e.properties.install_id);
    if (!install) continue;
    const at = Date.parse(e.timestamp);
    if (e.event === 'first_open') {
      firstOpen.set(install, Math.min(at, firstOpen.get(install) ?? Infinity));
    }
    if (e.event === 'purchase_completed' && !refunded.has(str(e.properties.transaction_ref))) {
      bought.set(install, Math.min(at, bought.get(install) ?? Infinity));
    }
  }
  const cohorts = new Map<string, UnlockCohort>();
  for (const [install, first] of firstOpen) {
    const week = berlinWeek(new Date(first).toISOString());
    const c = cohorts.get(week) ?? { installs: 0, boughtByDay35: 0, share: 0 };
    c.installs++;
    const at = bought.get(install);
    if (at !== undefined && at <= first + 35 * DAY) c.boughtByDay35++;
    c.share = Math.round((1000 * c.boughtByDay35) / c.installs) / 10;
    cohorts.set(week, c);
  }
  return new Map([...cohorts].sort());
}

export interface RetentionCohort {
  households: number;
  /** Households active in period k (k = 0 … periods-1). */
  active: number[];
}

/**
 * queries/retention_weekly.sql and retention_monthly.sql: households by the Berlin week of
 * their first event (household_created, invite_accepted, an add or a tick); a household is
 * active in period k when it added or ticked in [start + k·len, start + (k+1)·len), with len
 * 7 or 30 days.
 */
export function retention(events: Event[], days: 7 | 30, periods: number) {
  const kept = external(events);
  const starts = new Map<string, number>();
  for (const e of kept) {
    const household = str(e.properties.household_id);
    if (!household) continue;
    if (!active(e) && e.event !== 'household_created' && e.event !== 'invite_accepted') continue;
    starts.set(household, Math.min(Date.parse(e.timestamp), starts.get(household) ?? Infinity));
  }
  const seen = new Map<string, Set<number>>();
  for (const e of kept) {
    const household = str(e.properties.household_id);
    if (!household || !active(e)) continue;
    const k = Math.floor((Date.parse(e.timestamp) - starts.get(household)!) / (days * DAY));
    seen.set(household, (seen.get(household) ?? new Set()).add(k));
  }
  const cohorts = new Map<string, RetentionCohort>();
  for (const [household, start] of starts) {
    const week = berlinWeek(new Date(start).toISOString());
    const c = cohorts.get(week) ?? { households: 0, active: Array(periods).fill(0) };
    c.households++;
    for (const k of seen.get(household) ?? []) if (k < periods) c.active[k]++;
    cohorts.set(week, c);
  }
  return new Map([...cohorts].sort());
}

const yearlyProductId = 'com.hummlist.app.yearly';

/**
 * How long a Yearly purchase counts as paying: a year and 14 days' grace. Renewals send no event,
 * so this is the approximation docs/ANALYTICS.md describes.
 */
const yearlyDays = 365 + 14;

interface Purchase {
  household: string;
  /** ms */
  at: number;
  yearly: boolean;
}

/**
 * Every purchase_completed the store has not refunded (same transaction_ref, any time), of either
 * product. A refund takes back only its own purchase.
 */
function purchases(kept: Event[]): Purchase[] {
  const refunded = new Set(
    kept.filter((e) => e.event === 'purchase_refunded').map((e) =>
      str(e.properties.transaction_ref)
    ),
  );
  return kept.flatMap((e) => {
    const household = str(e.properties.household_id);
    if (!household || e.event !== 'purchase_completed') return [];
    if (refunded.has(str(e.properties.transaction_ref))) return [];
    const yearly = e.properties.premium_source === 'yearly' ||
      e.properties.product_id === yearlyProductId;
    return [{ household, at: Date.parse(e.timestamp), yearly }];
  });
}

export interface PayingCohort {
  households: number;
  payingByDay35: number;
  /** Percent, one decimal. */
  share: number;
}

/**
 * queries/paying_households_d35.sql: households by the Berlin week of their first event (as in
 * retention()); paying when an unrefunded purchase_completed of either product arrived within
 * 35 × 24 h of it.
 */
export function payingHouseholdsByDay35(events: Event[]): Map<string, PayingCohort> {
  const kept = external(events);
  const starts = new Map<string, number>();
  for (const e of kept) {
    const household = str(e.properties.household_id);
    if (!household) continue;
    if (!active(e) && e.event !== 'household_created' && e.event !== 'invite_accepted') continue;
    starts.set(household, Math.min(Date.parse(e.timestamp), starts.get(household) ?? Infinity));
  }
  const paid = new Map<string, number>();
  for (const p of purchases(kept)) {
    paid.set(p.household, Math.min(p.at, paid.get(p.household) ?? Infinity));
  }
  const cohorts = new Map<string, PayingCohort>();
  for (const [household, start] of starts) {
    const week = berlinWeek(new Date(start).toISOString());
    const c = cohorts.get(week) ?? { households: 0, payingByDay35: 0, share: 0 };
    c.households++;
    const at = paid.get(household);
    if (at !== undefined && at <= start + 35 * DAY) c.payingByDay35++;
    c.share = Math.round((1000 * c.payingByDay35) / c.households) / 10;
    cohorts.set(week, c);
  }
  return new Map([...cohorts].sort());
}

export interface PayingWeek {
  wah: number;
  paying: number;
  /** Percent, one decimal. */
  share: number;
}

/**
 * queries/paying_share_wah.sql, the kill gate: per Berlin week, the weekly active households
 * (weeklyActiveHouseholds()) and how many of them have Premium that week: an unrefunded Lifetime
 * purchase in that week or before, or a Yearly one from its week through the week that contains
 * the purchase + 379 days.
 */
export function payingShareOfWah(events: Event[]): Map<string, PayingWeek> {
  const kept = external(events);
  const covers = new Map<string, { from: string; until: string | null }[]>();
  for (const p of purchases(kept)) {
    const from = berlinWeek(new Date(p.at).toISOString());
    const until = p.yearly ? berlinWeek(new Date(p.at + yearlyDays * DAY).toISOString()) : null;
    covers.set(p.household, [...(covers.get(p.household) ?? []), { from, until }]);
  }
  const weeks = new Map<string, Set<string>>();
  for (const e of kept) {
    const household = str(e.properties.household_id);
    if (!active(e) || !household) continue;
    const week = berlinWeek(e.timestamp);
    weeks.set(week, (weeks.get(week) ?? new Set()).add(household));
  }
  return new Map(
    [...weeks].sort().map(([week, households]) => {
      const paying = [...households].filter((h) =>
        (covers.get(h) ?? []).some((c) =>
          c.from <= week && (c.until === null || week <= c.until)
        )
      ).length;
      const wah = households.size;
      return [week, { wah, paying, share: Math.round((1000 * paying) / wah) / 10 }];
    }),
  );
}

export interface RevenueMonth {
  currency: string;
  purchases: number;
  refunds: number;
  restores: number;
  gross: number;
  net: number;
}

/**
 * queries/revenue_monthly.sql: per Berlin month and currency, completed minus refunded, in the
 * month each happened. Restores add nothing.
 */
export function revenueByMonth(events: Event[]): Map<string, RevenueMonth> {
  const months = new Map<string, RevenueMonth>();
  for (const e of external(events)) {
    if (!e.event.startsWith('purchase_')) continue;
    const currency = str(e.properties.currency) ?? '';
    const key = `${berlinMonth(e.timestamp)} ${currency}`;
    const m = months.get(key) ??
      { currency, purchases: 0, refunds: 0, restores: 0, gross: 0, net: 0 };
    const sign = e.event === 'purchase_completed' ? 1 : e.event === 'purchase_refunded' ? -1 : 0;
    if (sign === 1) m.purchases++;
    if (sign === -1) m.refunds++;
    if (e.event === 'purchase_restored') m.restores++;
    m.gross = Math.round((m.gross + sign * num(e.properties.price)) * 100) / 100;
    m.net = Math.round((m.net + sign * num(e.properties.net_amount)) * 100) / 100;
    months.set(key, m);
  }
  return new Map([...months].sort());
}

/** queries/reorders.sql: manual reorders per household, by kind. */
export function reordersByHousehold(events: Event[]) {
  const households = new Map<
    string,
    { defaultOrder: number; storeLayout: number; stores: number }
  >();
  for (const e of external(events)) {
    const household = str(e.properties.household_id);
    if (!household) continue;
    if (e.event !== 'category_reordered' && e.event !== 'store_reordered') continue;
    const h = households.get(household) ?? { defaultOrder: 0, storeLayout: 0, stores: 0 };
    if (e.event === 'store_reordered') h.stores++;
    else if (e.properties.scope === 'store') h.storeLayout++;
    else h.defaultOrder++;
    households.set(household, h);
  }
  return new Map([...households].sort());
}
