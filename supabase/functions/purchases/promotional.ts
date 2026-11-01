// A household's promotional Hummlist Premium as RevenueCat has it now (docs/PURCHASES.md,
// "Free premium: RevenueCat promotional grants"). A grant from the RevenueCat dashboard or from API v2
// grant_entitlement is a promotional subscription of the customer (App User ID = household id):
// store "promotional", gives_access while it runs, ends_at its end. We read
// GET /v2/projects/{project}/customers/{household}/subscriptions (permission
// customer_information:customers:read) and keep only what decides premium: whether a promotional
// subscription with the premium entitlement gives access now, and until when.
import type { Fetch, RevenueCatKey } from './deletions.ts';

/** The entitlement's identifier (lookup key) in RevenueCat; entl654efcfce4 in project proj9cb4a72e. */
export const premiumEntitlement = 'premium';

/** The household's promotional premium: none, or active until [expiresAt] (null: no end). */
export type PromotionalPremium = { active: false } | { active: true; expiresAt: Date | null };

/** RevenueCat did not answer usably; the webhook fails so RevenueCat delivers again. */
export class RevenueCatUnavailable extends Error {
  constructor(readonly status: number | null) {
    super(`RevenueCat API: ${status ?? 'no response'}`);
  }
}

const base = 'https://api.revenuecat.com';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** More pages than any customer has; a guard against a next_page loop. */
const maxPages = 20;

interface Subscription {
  store?: unknown;
  gives_access?: unknown;
  ends_at?: unknown;
  current_period_ends_at?: unknown;
  entitlements?: { items?: { lookup_key?: unknown }[] } | null;
}

const millis = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? new Date(v) : null;

/** The promotional premium [subscriptions] give, at [now]. */
export function promotionalOf(subscriptions: Subscription[], now: Date): PromotionalPremium {
  let active = false;
  let end: Date | null = null;
  let endless = false;
  for (const s of subscriptions) {
    if (s.store !== 'promotional' || s.gives_access !== true) continue;
    const items = s.entitlements?.items ?? [];
    if (!items.some((e) => e.lookup_key === premiumEntitlement)) continue;
    const ends = millis(s.ends_at) ?? millis(s.current_period_ends_at);
    if (ends && ends <= now) continue;
    active = true;
    if (!ends) endless = true;
    else if (!end || ends > end) end = ends;
  }
  return active ? { active: true, expiresAt: endless ? null : end } : { active: false };
}

/**
 * Reads [householdId]'s promotional premium from RevenueCat. A customer RevenueCat doesn't know
 * (404, e.g. deleted) has none. Throws [RevenueCatUnavailable] for anything else that isn't 200.
 */
export async function fetchPromotional(
  key: RevenueCatKey,
  householdId: string,
  fetch: Fetch,
  now: Date,
): Promise<PromotionalPremium> {
  if (!uuid.test(householdId)) throw new Error('not a household id');
  const headers = { authorization: `Bearer ${key.secretKey}`, accept: 'application/json' };
  const items: Subscription[] = [];
  let url: string | null = `${base}/v2/projects/${encodeURIComponent(key.projectId)}/customers/${
    encodeURIComponent(householdId)
  }/subscriptions?limit=100`;
  for (let page = 0; url && page < maxPages; page++) {
    const res: Response | null = await fetch(url, { headers }).catch(() => null);
    if (res?.status === 404) {
      await res.body?.cancel();
      return { active: false };
    }
    if (!res || res.status !== 200) {
      await res?.body?.cancel();
      throw new RevenueCatUnavailable(res?.status ?? null);
    }
    const body = await res.json().catch(() => null) as
      | { items?: unknown; next_page?: unknown }
      | null;
    if (!body || !Array.isArray(body.items)) throw new RevenueCatUnavailable(200);
    items.push(...body.items as Subscription[]);
    // next_page: a path or URL on RevenueCat's API ("/v2/projects/…?starting_after=…"); nothing
    // else is ever fetched with the key.
    const next = typeof body.next_page === 'string' ? body.next_page : null;
    url = next?.startsWith('/v2/')
      ? `${base}${next}`
      : next?.startsWith(`${base}/v2/`)
      ? next
      : null;
  }
  return promotionalOf(items, now);
}
