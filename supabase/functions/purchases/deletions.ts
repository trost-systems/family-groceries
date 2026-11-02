// Deletes RevenueCat customers of deleted households (job 43, ADDENDUM 5 and 6; docs/PURCHASES.md
// "Retention"). The App User ID is the household id; 30 days after a household is deleted it is
// due in public.revenuecat_deletions. For each due one: DELETE the customer (RevenueCat API v2;
// 200 queues the deletion, 404 means there is none), then GET it; only a 404 counts as deleted and
// the queue row goes. Anything else is tried again an hour later at the earliest
// (revenuecat_deletions_take). The only call we make to RevenueCat.

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * How long a RevenueCat API request may take. A webhook's read holds its database transaction open
 * meanwhile; past this it fails (502) and RevenueCat delivers again.
 */
export const revenueCatTimeoutMs = 10_000;

/** [fetch], aborted and rejected after [ms], also when [fetch] ignores the signal. */
export function within(fetch: Fetch, ms: number): Fetch {
  return (url, init) => {
    const signal = AbortSignal.timeout(ms);
    const timedOut = new Promise<never>((_, reject) =>
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    );
    return Promise.race([fetch(url, { ...init, signal }), timedOut]);
  };
}

export interface RevenueCatKey {
  /** A v2 secret key with customer_information:customers:read_write. */
  secretKey: string;
  projectId: string;
}

export interface DeletionQueue {
  /** Up to [limit] due ids, marked tried now. */
  take(limit: number): Promise<string[]>;
  /** RevenueCat confirmed the customer is gone. */
  done(id: string): Promise<void>;
}

export interface DeletionOutcome {
  due: number;
  deleted: number;
  pending: number;
  failed: number;
}

const api = 'https://api.revenuecat.com/v2/projects';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A run's worth: well inside RevenueCat's 480 customer requests a minute. */
export const deletionsPerRun = 25;

export async function deleteDueCustomers(
  queue: DeletionQueue,
  key: RevenueCatKey,
  untimed: Fetch,
  timeoutMs = revenueCatTimeoutMs,
): Promise<DeletionOutcome> {
  const fetch = within(untimed, timeoutMs);
  const ids = await queue.take(deletionsPerRun);
  const outcome: DeletionOutcome = { due: ids.length, deleted: 0, pending: 0, failed: 0 };
  const headers = { authorization: `Bearer ${key.secretKey}` };
  for (const id of ids) {
    // From our own uuid column; checked anyway before it goes into a URL.
    if (!uuid.test(id)) {
      outcome.failed++;
      continue;
    }
    const url = `${api}/${encodeURIComponent(key.projectId)}/customers/${id}`;
    const removed = await fetch(url, { method: 'DELETE', headers }).catch(() => null);
    await removed?.body?.cancel();
    if (!removed || (removed.status !== 200 && removed.status !== 404)) {
      outcome.failed++;
      continue;
    }
    const check = await fetch(url, { headers }).catch(() => null);
    await check?.body?.cancel();
    if (check?.status === 404) {
      await queue.done(id);
      outcome.deleted++;
    } else {
      outcome.pending++;
    }
  }
  return outcome;
}
