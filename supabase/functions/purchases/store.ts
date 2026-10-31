// The purchases function's database work, all through the service connection and the functions
// in migrations 20261030190000_purchases.sql and 20261031123504_household_bound_lifetime.sql that
// no client may call. A webhook event's writes take [Tx]: they commit with its id (firstDelivery).
import type { Sql, Tx } from '../_shared/db.ts';
import type { AppStore } from '../_shared/purchases.ts';
import type { Refund, Sale, StoreEnvironment, StorePurchase } from './types.ts';

/** purchase_record's outcome (see the migration). */
export type Outcome =
  | 'granted'
  | 'restored'
  | 'used_elsewhere'
  | 'tombstoned'
  | 'no_household'
  | 'revoked';

/** purchase_record's answer. */
export interface Recorded {
  outcome: Outcome;
  /** Granted into a household that had this kind already: it was bought twice. */
  alreadyUnlocked: boolean;
  /** used_elsewhere, and the household the purchase belongs to is deleted. */
  householdGone: boolean;
  /** The buyer or the household is a tester's: analytics marks it internal. */
  internal: boolean;
  /** The member who claimed it, if any. */
  buyer: string | null;
  /** purchase_completed is due now (for [buyer]). */
  sendCompleted: boolean;
}

/** Records the event id; false when it was recorded before (a retry or a duplicate delivery). */
export async function firstDelivery(sql: Tx, id: string, type: string): Promise<boolean> {
  const rows = await sql`
    insert into public.revenuecat_events (id, type) values (${id}, ${type})
    on conflict (id) do nothing returning id`;
  return rows.length === 1;
}

/** [hmac]: the transaction's tombstone key (purchase_tombstones). */
export async function record(sql: Tx, p: StorePurchase, hmac: string): Promise<Recorded> {
  const [row] = await sql<{ r: Record<string, unknown> }[]>`
    select public.purchase_record(
      ${p.store}, ${p.transactionId}, ${p.latestTransactionId}, ${hmac}, ${p.productId}, ${p.kind},
      ${p.environment}, ${p.purchasedAt.toISOString()}::timestamptz, ${p.price}::numeric,
      ${p.currency}, ${p.country}, ${p.householdId}::uuid
    ) as r`;
  const r = row.r;
  return {
    outcome: r.outcome as Outcome,
    alreadyUnlocked: r.already_unlocked === true,
    householdGone: r.household_gone === true,
    internal: r.internal === true,
    buyer: typeof r.buyer === 'string' ? r.buyer : null,
    sendCompleted: r.send_completed === true,
  };
}

/** A purchase the store just took back, as purchase_refunded needs it. */
export interface Revoked extends Sale {
  userId: string | null;
  /** A tester's purchase or household. */
  internal: boolean;
}

const saleOf = (r: Record<string, unknown>, store: AppStore, transactionId: string): Sale => ({
  store,
  transactionId,
  productId: r.product_id as string,
  environment: r.environment as StoreEnvironment,
  price: r.price === null || r.price === undefined ? null : Number(r.price),
  currency: (r.currency as string | null) ?? null,
  country: (r.country as string | null) ?? null,
  householdId: (r.household_id as string | null) ?? null,
});

/** Null when nothing changed (refunded before). An unknown transaction is recorded as refunded. */
export async function revoke(sql: Tx, f: Refund): Promise<Revoked | null> {
  const [row] = await sql<{ revoked: Record<string, unknown> | null }[]>`
    select public.purchase_revoke(${f.store}, ${f.transactionId},
      ${f.revokedAt.toISOString()}::timestamptz, ${f.productId}, ${f.environment},
      ${f.purchasedAt?.toISOString() ?? null}::timestamptz) as revoked`;
  const r = row.revoked;
  if (!r) return null;
  return {
    ...saleOf(r, f.store, f.transactionId),
    userId: (r.user_id as string | null) ?? null,
    internal: r.internal === true,
  };
}

export async function reinstate(sql: Tx, store: AppStore, transactionId: string) {
  const [row] = await sql<{ changed: boolean }[]>`
    select public.purchase_reinstate(${store}, ${transactionId}) as changed`;
  return row.changed;
}

/** purchase_claim's answer; [completed]: purchase_completed is due now, with these facts. */
export interface Claim {
  status: 'recorded' | 'taken' | 'elsewhere' | 'waiting';
  completed: (Sale & { internal: boolean }) | null;
}

/** Throws Postgres 42501 (not_a_member) when [userId] is not in [householdId]. */
export async function claim(
  sql: Sql,
  userId: string,
  householdId: string,
  store: AppStore,
  transactionId: string,
): Promise<Claim> {
  const [row] = await sql<{ c: Record<string, unknown> }[]>`
    select public.purchase_claim(${userId}::uuid, ${householdId}::uuid, ${store},
      ${transactionId}) as c`;
  const c = row.c;
  const p = c.send_completed === true ? c.purchase as Record<string, unknown> | undefined : null;
  return {
    status: c.status as Claim['status'],
    completed: p
      ? {
        ...saleOf(p, p.store as AppStore, p.transaction_id as string),
        internal: p.internal === true,
      }
      : null,
  };
}

/** Claims a minute, per user: generous for retries, tight for scripted abuse. */
export const callsPerMinute = 20;

export async function takeCall(sql: Sql, userId: string): Promise<boolean> {
  const [row] = await sql<{ ok: boolean }[]>`
    select public.purchase_take_call(${userId}::uuid, ${callsPerMinute}) as ok`;
  return row.ok;
}

/** The due RevenueCat customer deletions (revenuecat_deletions_take), marked tried. */
export async function takeDeletions(sql: Sql, limit: number): Promise<string[]> {
  const rows = await sql<{ id: string }[]>`
    select public.revenuecat_deletions_take(${limit}::integer)::text as id`;
  return rows.map((r) => r.id);
}

export async function deletionDone(sql: Sql, id: string): Promise<void> {
  await sql`select public.revenuecat_deletion_done(${id}::uuid)`;
}
