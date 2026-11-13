// The purchases function's database work, all through the service connection and the functions in
// migrations 20261030190000_purchases.sql, 20261031123504_household_bound_lifetime.sql,
// 20261031214500_premium_yearly.sql, 20261101143000_revenuecat_promotional.sql and
// 20261112232617_per_user_premium.sql that no client may call. A webhook event's writes take [Tx]:
// they commit with its id (firstDelivery).
import type { Sql, Tx } from '../_shared/db.ts';
import type { AppStore } from '../_shared/purchases.ts';
import type { PromotionalPremium } from './promotional.ts';
import type { Lifecycle } from './revenuecat.ts';
import type { Plan, Refund, Sale, StoreEnvironment, StorePurchase } from './types.ts';

/** purchase_record's and purchase_record_user's outcome (see the migrations). */
export type Outcome =
  | 'granted'
  | 'restored'
  | 'used_elsewhere'
  | 'tombstoned'
  | 'no_household'
  | 'no_user'
  | 'revoked';

/** What an App User ID names (app_user_owner); null: neither, e.g. deleted. */
type Owner = 'user' | 'household' | null;

async function ownerOf(sql: Tx, appUserId: string): Promise<Owner> {
  const [row] = await sql<{ owner: Owner }[]>`
    select public.app_user_owner(${appUserId}::uuid) as owner`;
  return row?.owner ?? null;
}

/** purchase_record's answer. */
export interface Recorded {
  outcome: Outcome;
  /** Granted into a household that had this kind already: it was bought twice. */
  alreadyUnlocked: boolean;
  /** used_elsewhere, and the household or user the purchase belongs to is deleted. */
  householdGone: boolean;
  /**
   * The household (or, for a user's own purchase, the user) has a promotional grant (testers,
   * reviewers): analytics marks it internal.
   */
  internal: boolean;
  /** The buyer: the user it was bought for, else the member who claimed it, if any. */
  buyer: string | null;
  /** The household the purchase unlocks; null for a user's own (analytics names the buyer's). */
  householdId: string | null;
  /** purchase_completed is due now (for [buyer]). */
  sendCompleted: boolean;
  /** A new yearly plan in a household that had an active one: kept apart, logged (A2-3). */
  secondYearly: boolean;
}

/** Records the event id; false when it was recorded before (a retry or a duplicate delivery). */
export async function firstDelivery(sql: Tx, id: string, type: string): Promise<boolean> {
  const rows = await sql`
    insert into public.revenuecat_events (id, type) values (${id}, ${type})
    on conflict (id) do nothing returning id`;
  return rows.length === 1;
}

/**
 * [hmac]: the transaction's tombstone key (purchase_tombstones). A user's App User ID goes to
 * purchase_record_user, anything else to the household path.
 */
export async function record(sql: Tx, p: StorePurchase, hmac: string): Promise<Recorded> {
  const owner = await ownerOf(sql, p.appUserId);
  const fn = owner === 'user' ? sql`public.purchase_record_user` : sql`public.purchase_record`;
  const [row] = await sql<{ r: Record<string, unknown> }[]>`
    select ${fn}(
      ${p.store}, ${p.transactionId}, ${p.latestTransactionId}, ${hmac}, ${p.productId}, ${p.kind},
      ${p.plan}, ${p.environment}, ${p.purchasedAt.toISOString()}::timestamptz, ${p.price}::numeric,
      ${p.currency}, ${p.country}, ${p.appUserId}::uuid, ${p.eventAt.toISOString()}::timestamptz,
      ${p.subscription?.expiresAt?.toISOString() ?? null}::timestamptz,
      ${p.subscription?.autoRenew ?? null}::boolean, ${
    p.subscription?.billingIssue ?? null
  }::boolean
    ) as r`;
  const r = row.r;
  return {
    outcome: r.outcome as Outcome,
    alreadyUnlocked: r.already_unlocked === true,
    householdGone: r.household_gone === true,
    internal: r.internal === true,
    buyer: typeof r.buyer === 'string' ? r.buyer : null,
    sendCompleted: r.send_completed === true,
    secondYearly: r.second_yearly === true,
    householdId: owner === 'household' ? p.appUserId : null,
  };
}

/** purchase_lifecycle's outcome (see the migration). */
export type LifecycleOutcome = 'updated' | 'stale' | 'unknown' | 'lifetime' | 'revoked';

export async function lifecycle(sql: Tx, c: Lifecycle): Promise<LifecycleOutcome> {
  const [row] = await sql<{ r: { outcome: LifecycleOutcome } }[]>`
    select public.purchase_lifecycle(${c.store}, ${c.transactionId},
      ${c.eventAt.toISOString()}::timestamptz, ${
    c.state.expiresAt?.toISOString() ?? null
  }::timestamptz,
      ${c.state.autoRenew}::boolean, ${c.state.billingIssue}::boolean) as r`;
  return row.r.outcome;
}

/** A purchase the store just took back, as purchase_refunded needs it. */
export interface Revoked extends Sale {
  userId: string | null;
  /** In a household, or of a user, with a promotional grant (household_internal, user_internal). */
  internal: boolean;
}

const saleOf = (r: Record<string, unknown>, store: AppStore, transactionId: string): Sale => ({
  store,
  transactionId,
  productId: r.product_id as string,
  plan: r.plan as Plan,
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
      ${f.revokedAt.toISOString()}::timestamptz, ${f.productId}, ${f.plan}, ${f.environment},
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

/**
 * promotional_premium_sync's and promotional_premium_sync_user's outcome (migrations
 * 20261101143000_revenuecat_promotional.sql, 20261112232617_per_user_premium.sql).
 */
export type PromotionalOutcome =
  | 'granted'
  | 'updated'
  | 'unchanged'
  | 'removed'
  | 'no_household'
  | 'no_user';

/**
 * Stores [appUserId]'s promotional premium (a user's or a household's) as [read] finds it at
 * RevenueCat. The owner is locked first, so two deliveries for it read and write one after the
 * other: the later read wins, and it is never older than the later event.
 */
export async function promotional(
  sql: Tx,
  appUserId: string,
  read: () => Promise<PromotionalPremium>,
): Promise<PromotionalOutcome> {
  const owner = await ownerOf(sql, appUserId);
  if (owner === 'user') {
    await sql`select public.purchase_user_lock(${appUserId}::uuid)`;
  } else {
    const held = await sql`
      select 1 from public.households where id = ${appUserId}::uuid for no key update`;
    if (held.length === 0) return 'no_household';
  }
  const fn = owner === 'user'
    ? sql`public.promotional_premium_sync_user`
    : sql`public.promotional_premium_sync`;
  const now = await read();
  const [row] = await sql<{ outcome: PromotionalOutcome }[]>`
    select ${fn}(${appUserId}::uuid, ${now.active}::boolean, ${
    now.active ? now.expiresAt?.toISOString() ?? null : null
  }::timestamptz) as outcome`;
  return row.outcome;
}
