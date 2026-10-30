// The purchases function's database work, all through the service connection and the functions
// in migration 20261030190000_purchases.sql that no client may call.
import type { Sql } from '../_shared/db.ts';
import type { AppStore } from '../_shared/purchases.ts';
import type { StoreEnvironment, StorePurchase } from './types.ts';

/** purchase_grant's answer (see the migration). */
export type Outcome = 'granted' | 'restored' | 'used_elsewhere' | 'revoked' | 'refunded';

/** A purchase the store just took back, as purchase_refunded needs it. */
export interface Revoked {
  userId: string | null;
  householdId: string | null;
  productId: string;
  environment: StoreEnvironment;
  price: number | null;
  currency: string | null;
  country: string | null;
}

export async function grant(
  sql: Sql,
  p: StorePurchase,
  userId: string,
  householdId: string,
): Promise<Outcome> {
  const purchasedAt = p.purchasedAt.toISOString();
  const revokedAt = p.revokedAt?.toISOString() ?? null;
  const [row] = await sql<{ outcome: Outcome }[]>`
    select public.purchase_grant(
      ${p.store}, ${p.transactionId}, ${p.productId}, ${p.environment},
      ${purchasedAt}::timestamptz, ${revokedAt}::timestamptz,
      ${p.price}::numeric, ${p.currency}, ${p.country}, ${userId}::uuid, ${householdId}::uuid
    ) as outcome`;
  return row.outcome;
}

/** What the store says about a revoked transaction, recorded if it was never verified. */
export interface RevokedFacts {
  productId: string;
  environment: StoreEnvironment;
  purchasedAt: Date | null;
}

export async function revoke(
  sql: Sql,
  store: AppStore,
  transactionId: string,
  at: Date,
  facts: RevokedFacts,
): Promise<Revoked | null> {
  const revokedAt = at.toISOString();
  const purchasedAt = facts.purchasedAt?.toISOString() ?? null;
  const [row] = await sql<{ revoked: Record<string, unknown> | null }[]>`
    select public.purchase_revoke(${store}, ${transactionId}, ${revokedAt}::timestamptz,
      ${facts.productId}, ${facts.environment}, ${purchasedAt}::timestamptz) as revoked`;
  const r = row.revoked;
  if (!r) return null;
  return {
    userId: (r.user_id as string | null) ?? null,
    householdId: (r.household_id as string | null) ?? null,
    productId: r.product_id as string,
    environment: r.environment as StoreEnvironment,
    price: r.price === null || r.price === undefined ? null : Number(r.price),
    currency: (r.currency as string | null) ?? null,
    country: (r.country as string | null) ?? null,
  };
}

export async function reinstate(sql: Sql, store: AppStore, transactionId: string) {
  const [row] = await sql<{ changed: boolean }[]>`
    select public.purchase_reinstate(${store}, ${transactionId}) as changed`;
  return row.changed;
}

/** Verifications a minute, per user: generous for retries, tight for scripted abuse. */
export const callsPerMinute = 20;

export async function takeCall(sql: Sql, userId: string): Promise<boolean> {
  const [row] = await sql<{ ok: boolean }[]>`
    select public.purchase_take_call(${userId}::uuid, ${callsPerMinute}) as ok`;
  return row.ok;
}
