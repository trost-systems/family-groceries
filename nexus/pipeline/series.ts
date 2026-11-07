// Daily and weekly series in Europe/Berlin calendar days, where the team reads them.
import type { Job, Snapshot } from '../src/snapshot.ts';
import type { CiRun, FlakyIssue, PrRecord } from './github.ts';

const berlin = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The Europe/Berlin calendar day of an instant, as YYYY-MM-DD. */
export function berlinDay(at: Date | string): string {
  return berlin.format(typeof at === 'string' ? new Date(at) : at);
}

function shiftDay(day: string, by: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
}

/** The n days ending today, oldest first. */
export function lastDays(now: Date, n: number): string[] {
  const today = berlinDay(now);
  return Array.from({ length: n }, (_, i) => shiftDay(today, i - n + 1));
}

/** The Monday of a day's week. */
export function weekOf(day: string): string {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return shiftDay(day, -((weekday + 6) % 7));
}

export function ciDaily(runs: readonly CiRun[], now: Date): Snapshot['ci']['daily'] {
  return lastDays(now, 14).map((date) => {
    const day = runs.filter((r) => berlinDay(r.createdAt) === date);
    return {
      date,
      pass: day.filter((r) => r.conclusion === 'success').length,
      fail: day.filter((r) => r.conclusion === 'failure' || r.conclusion === 'timed_out').length,
    };
  });
}

export function mergesDaily(prs: readonly PrRecord[], now: Date): Snapshot['merges']['daily'] {
  const merged = prs.flatMap((p) => p.mergedAt === null ? [] : [berlinDay(p.mergedAt)]);
  return lastDays(now, 14).map((date) => ({ date, count: merged.filter((d) => d === date).length }));
}

/** PRs merged in the 7 x 24 h ending `weeksBack` weeks before now. */
export function mergedInWeek(prs: readonly PrRecord[], now: Date, weeksBack: number): number {
  const end = now.getTime() - weeksBack * 7 * 24 * 3600_000;
  const start = end - 7 * 24 * 3600_000;
  return prs.filter((p) => {
    const at = p.mergedAt === null ? NaN : Date.parse(p.mergedAt);
    return at > start && at <= end;
  }).length;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const hi = sorted[mid] ?? 0;
  return sorted.length % 2 === 1 ? hi : ((sorted[mid - 1] ?? 0) + hi) / 2;
}

/** Hours from brief to merge for the jobs merged in the last 7 days, rounded to 0.1 h. */
export function medianQueuedToMerged(jobs: readonly Job[], now: Date): number | null {
  const since = now.getTime() - 7 * 24 * 3600_000;
  const hours = jobs.flatMap((j) => {
    const merged = j.pr?.mergedAt;
    if (j.queuedAt === null || merged === null || merged === undefined || Date.parse(merged) < since) {
      return [];
    }
    return [(Date.parse(merged) - Date.parse(j.queuedAt)) / 3600_000];
  });
  const m = median(hours);
  return m === null ? null : Math.round(m * 10) / 10;
}

export function flakyTrend(issues: readonly FlakyIssue[], now: Date): Snapshot['flaky'] {
  const thisWeek = weekOf(berlinDay(now));
  const weeks = Array.from({ length: 8 }, (_, i) => shiftDay(thisWeek, (i - 7) * 7));
  const weekOfAt = (at: string): string => weekOf(berlinDay(at));
  return {
    open: issues.filter((i) => i.open).length,
    weekly: weeks.map((week) => ({
      week,
      opened: issues.filter((i) => weekOfAt(i.createdAt) === week).length,
      closed: issues.filter((i) => i.closedAt !== null && weekOfAt(i.closedAt) === week).length,
    })),
  };
}
