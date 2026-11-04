// Free Hummlist Premium for every beta household (job 43b; docs/PURCHASES.md "Free premium in the
// beta"). While the server switch beta_promo is on, new households wait in public.beta_promo_grants;
// this grants each one's RevenueCat customer the premium entitlement until the beta's end, then
// stores it like any promotional grant (reconcile), so every member sees the unlock.
import type { Fetch, RevenueCatKey } from './deletions.ts';
import { grantEntitlement } from './grants.ts';
import { fetchPromotional } from './promotional.ts';

/** The beta's end unless BETA_PROMO_ENDS_AT says otherwise: 31 Dec 2027, midnight in Berlin. */
export const defaultBetaEnd = new Date('2027-12-31T23:00:00Z');

/**
 * Grants ending this late or never are for good: testers and app review (until 2100). Such a
 * household gets no beta grant, since revoking that at launch would revoke theirs too.
 */
export const grantForGoodFrom = new Date('2099-01-01T00:00:00Z');

/** RevenueCat ignores a grant within two hours of an existing one's end. */
const sameEndMs = 2 * 3_600_000;

/** A run's worth, like the deletions. */
export const betaGrantsPerRun = 25;

export interface BetaQueue {
  on(): Promise<boolean>;
  take(limit: number): Promise<string[]>;
  granted(householdId: string, endsAt: Date): Promise<void>;
  skipped(householdId: string): Promise<void>;
}

export type BetaOutcome =
  | { status: 'off' }
  | { status: 'done'; due: number; granted: number; skipped: number; failed: number };

export async function grantDue(
  queue: BetaQueue,
  key: RevenueCatKey,
  endsAt: Date,
  fetch: Fetch,
  reconcile: (householdId: string) => Promise<unknown>,
  now: Date,
): Promise<BetaOutcome> {
  if (!await queue.on()) return { status: 'off' };
  const ids = await queue.take(betaGrantsPerRun);
  const outcome = { status: 'done' as const, due: ids.length, granted: 0, skipped: 0, failed: 0 };
  for (const id of ids) {
    try {
      const has = await fetchPromotional(key, id, fetch, now);
      if (has.active && (has.expiresAt === null || has.expiresAt >= grantForGoodFrom)) {
        await queue.skipped(id);
        outcome.skipped++;
        continue;
      }
      const already = has.active && has.expiresAt !== null &&
        has.expiresAt.getTime() >= endsAt.getTime() - sameEndMs;
      if (!already) await grantEntitlement(key, id, endsAt, fetch);
      await reconcile(id);
      await queue.granted(id, already ? has.expiresAt! : endsAt);
      outcome.granted++;
    } catch {
      // Stays queued; the next run after 10 minutes tries again.
      outcome.failed++;
    }
  }
  return outcome;
}
