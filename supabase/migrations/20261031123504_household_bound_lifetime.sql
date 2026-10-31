-- Job 43: Hummlist Lifetime is household-bound (Peter, 2026-10-31, model A; DECISIONS "Job 43"),
-- verified by RevenueCat (addenda 4 and 5): the app buys through RevenueCat with the household id as
-- App User ID, RevenueCat checks the store, and its webhook (the `purchases` function) writes here.
--   * A purchase belongs to the household it was first recorded for, for good:
--     purchases.bound_household (no foreign key, so it survives the household's deletion), and
--     after the purge a tombstone (an HMAC of the store transaction id) so it never binds again
--     (Legal Review H-56).
--   * Every unlock has a kind (lifetime now), from the product, stored with purchase and unlock.
--   * The buyer is whoever claims the transaction from the app (purchase_claim); members never
--     read who paid (H-55).
--   * Testers get free unlocks: lifetime_testers gives each a number of grants. A grant unlocks a
--     household the tester is in and then stays with it like a purchase.
--   * The last member leaving an unlocked household may archive it instead of deleting it.
--   * Retention: 30 days after a household is deleted its purchase rows go (tombstones stay) and
--     RevenueCat is asked to delete the household's customer (revenuecat_deletions).

-- Purchases: the bound household and the kind ------------------------------------------------------

alter table public.purchases add column bound_household uuid;
alter table public.purchases add column kind text not null default 'lifetime'
  constraint purchases_kind check (kind in ('lifetime'));

comment on column public.purchases.bound_household is
  'Job 43: the household this purchase unlocks, set at its first grant and never changed. Not a foreign key: it stays after the household is deleted, so the purchase never unlocks another one.';
comment on column public.purchases.kind is
  'Job 43: what the purchase unlocks (the function maps the product to it). lifetime only so far.';

-- RevenueCat's webhook names the original transaction (transaction_id holds it, as before) and
-- the latest one; the app's claim may carry either.
alter table public.purchases add column latest_transaction_id text
  constraint purchases_latest_transaction check (length(latest_transaction_id) between 1 and 200);
-- HMAC-SHA256 (hex) of transaction_id under REVENUECAT_TOMBSTONE_HMAC_KEY, computed by the function;
-- what becomes the tombstone when the row is purged.
alter table public.purchases add column transaction_hmac text
  constraint purchases_transaction_hmac check (transaction_hmac ~ '^[0-9a-f]{64}$');
-- purchase_completed went out (once, when both the store's record and the buyer's claim are in).
alter table public.purchases add column completed_sent_at timestamptz;
-- When bound_household was deleted; the row is purged 30 days later.
alter table public.purchases add column household_deleted_at timestamptz;

-- A purchase unlocking a household now is bound to it. One that unlocks none (its household was
-- deleted, or it was refunded, which dropped the row) has no household we could name: it gets the
-- nil UUID, a household that never exists, so it never unlocks one again. Only sandbox purchases
-- exist before this migration (nothing was sold).
update public.purchases p set bound_household = e.household_id
from public.entitlements e
where e.purchase_id = p.id and p.bound_household is null;
update public.purchases set bound_household = '00000000-0000-0000-0000-000000000000'
where bound_household is null;

-- Testers ---------------------------------------------------------------------------------------

create table public.lifetime_testers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Free unlocks this tester may give, and how many they gave. Counted, not derived from the
  -- entitlements rows: a deleted household doesn't give a grant back.
  grants integer not null default 1 check (grants between 0 and 100),
  used integer not null default 0 check (used >= 0),
  -- Why they are on the list, for the Lead (e.g. "TestFlight group"). No names, no e-mail.
  note text check (length(note) <= 200),
  added_at timestamptz not null default now()
);

comment on table public.lifetime_testers is
  'Job 43: users who may unlock households with Hummlist Lifetime for free, grants of them. Service connection only (scripts/iap/testers.ts).';

alter table public.lifetime_testers enable row level security;
revoke all on public.lifetime_testers from anon, authenticated;

-- Entitlements: one row per unlock, a purchase's or a tester grant's ------------------------------

-- squawk-ignore adding-field-with-default -- gen_random_uuid() on a table of a few sandbox rows; the new key replaces purchase_id, which tester rows lack
alter table public.entitlements add column id uuid not null default gen_random_uuid();
alter table public.entitlements drop constraint entitlements_pkey;
alter table public.entitlements add constraint entitlements_pkey primary key (id);
-- squawk-ignore ban-drop-not-null -- tester rows have no purchase; released apps only check that the household has a row
alter table public.entitlements alter column purchase_id drop not null;
alter table public.entitlements add constraint entitlements_purchase unique (purchase_id);
-- squawk-ignore ban-drop-not-null -- tester rows have no store; no released app reads this column
alter table public.entitlements alter column product_id drop not null;
-- squawk-ignore ban-drop-not-null -- tester rows have no store; no released app reads this column
alter table public.entitlements alter column store drop not null;
-- squawk-ignore ban-drop-not-null -- tester rows have no store; no released app reads this column
alter table public.entitlements alter column environment drop not null;
alter table public.entitlements add column kind text not null default 'lifetime'
  constraint entitlements_kind check (kind in ('lifetime'));
alter table public.entitlements add column source text not null default 'purchase'
  constraint entitlements_source check (source in ('purchase', 'tester'));
-- The tester whose grant it is; null once they deleted their account (the unlock stays).
alter table public.entitlements add column tester uuid references auth.users (id) on delete set null;
-- One grant per household and tester.
alter table public.entitlements add constraint entitlements_tester unique (tester, household_id);
alter table public.entitlements add constraint entitlements_source_columns check (
  case source
    when 'purchase' then purchase_id is not null and tester is null
      and product_id is not null and store is not null and environment is not null
    else purchase_id is null
  end
);

comment on column public.entitlements.kind is
  'Job 43: what the row unlocks. The app asks for a kind (Entitlement.lifetime), never for any row.';
comment on column public.entitlements.source is
  'Job 43: purchase (purchase_id) or tester (a tester''s free grant). Both stay with the household.';

-- H-55: members see that their household is unlocked, and by which kind and store, not who paid
-- or granted it (granted_by, tester). Realtime still delivers the rows (e2e purchases.spec.ts).
revoke select on public.entitlements from authenticated;
grant select (id, purchase_id, household_id, kind, source, product_id, store, environment, granted_at)
  on public.entitlements to authenticated;

-- Uses one of [p_user]'s grants on [p_household], if they are a tester with one left, are a member
-- and the household has no Lifetime yet. True if it did.
create function public.tester_grant_apply(p_user uuid, p_household uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_grants integer;
begin
  -- Nearly every caller is no tester (the trigger runs on every join): answer them before taking
  -- any lock, or a join would wait on, and deadlock with, another join's share lock.
  if not exists (
    select from public.lifetime_testers t where t.user_id = p_user and t.grants > t.used
  ) then
    return false;
  end if;
  -- The same household lock purchase_record takes: a grant and a purchase landing at once see
  -- each other.
  perform from public.households h where h.id = p_household for no key update;
  select t.grants - t.used into v_grants from public.lifetime_testers t where t.user_id = p_user for update;
  if v_grants is null or v_grants <= 0
     or not exists (select from public.household_members m where m.user_id = p_user and m.household_id = p_household)
     or exists (select from public.entitlements e where e.household_id = p_household and e.kind = 'lifetime')
  then
    return false;
  end if;
  insert into public.entitlements (household_id, kind, source, tester, granted_by)
  values (p_household, 'lifetime', 'tester', p_user, p_user)
  on conflict (tester, household_id) do nothing;
  if not found then
    return false;
  end if;
  update public.lifetime_testers set used = used + 1 where user_id = p_user;
  return true;
end $$;

-- A grant applies itself: when the Lead adds a tester or raises their count (their household now),
-- and when a tester with one left creates or joins a household that has no Lifetime.
create function public.tester_grant_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_household uuid;
begin
  select m.household_id into v_household from public.household_members m where m.user_id = new.user_id;
  if v_household is not null then
    perform public.tester_grant_apply(new.user_id, v_household);
  end if;
  return null;
end $$;

revoke execute on function public.tester_grant_apply(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.tester_grant_trigger() from public, anon, authenticated;

create trigger lifetime_testers_grant after insert or update of grants on public.lifetime_testers
  for each row execute function public.tester_grant_trigger();
create trigger household_members_tester_grant after insert on public.household_members
  for each row execute function public.tester_grant_trigger();

-- Recording a purchase (RevenueCat's webhook) ------------------------------------------------------

-- Store transactions RevenueCat already delivered, by event id: a retry changes nothing. Purged
-- after 90 days (purge_purchases).
create table public.revenuecat_events (
  id text primary key check (length(id) between 1 and 200),
  type text not null check (length(type) between 1 and 64),
  received_at timestamptz not null default now()
);

comment on table public.revenuecat_events is
  'Job 43: ids of RevenueCat webhook events already processed (idempotency). Service connection only; 90 days.';

alter table public.revenuecat_events enable row level security;
revoke all on public.revenuecat_events from anon, authenticated;

-- What stays of a purged purchase: the HMAC of its store transaction id, nothing else. A transaction
-- whose HMAC is here never unlocks a household again (H-56). Kept while Hummlist Lifetime is sold or
-- its unlocks are honoured; reviewed yearly (NEEDS_LEAD Job 43).
create table public.purchase_tombstones (
  transaction_hmac text primary key check (transaction_hmac ~ '^[0-9a-f]{64}$')
);

comment on table public.purchase_tombstones is
  'Job 43: HMAC-SHA256 of purged store transaction ids, so a purchase of a deleted household never binds again. Service connection only.';

alter table public.purchase_tombstones enable row level security;
revoke all on public.purchase_tombstones from anon, authenticated;

-- A member's word that they bought a transaction (the app, right after RevenueCat's purchase), kept
-- until the webhook records it. Service connection only (the function's claim route).
create table public.purchase_claims (
  store text not null check (store in ('apple', 'google')),
  transaction_id text not null check (length(transaction_id) between 1 and 200),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The household the claimant was in (not household-owned data: service-only, gone with it).
  claimed_for uuid not null references public.households (id) on delete cascade,
  claimed_at timestamptz not null default now(),
  primary key (store, transaction_id)
);

comment on table public.purchase_claims is
  'Job 43: who bought a store transaction the webhook has not recorded yet. First claim wins; service connection only.';

alter table public.purchase_claims enable row level security;
revoke all on public.purchase_claims from anon, authenticated;

-- Households whose RevenueCat customer (App User ID = household id) is to be deleted, from 30 days
-- after the household's deletion; drained by the function (POST /purchases/revenuecat/deletions).
-- Every deleted household is queued: opening the purchase page already creates the customer at
-- RevenueCat, also without a purchase; deleting one that never existed answers 404.
create table public.revenuecat_deletions (
  -- RevenueCat's App User ID: the id of a deleted household.
  app_user_id uuid primary key,
  due_at timestamptz not null,
  attempts integer not null default 0,
  last_attempt_at timestamptz
);

comment on table public.revenuecat_deletions is
  'Job 43: RevenueCat customers (household ids of deleted households) to delete at RevenueCat once due. Service connection only.';

alter table public.revenuecat_deletions enable row level security;
revoke all on public.revenuecat_deletions from anon, authenticated;

-- A deleted household: its purchases start their 30 days, its RevenueCat customer is queued.
create function public.household_deleted_purchases() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.purchases set household_deleted_at = now()
  where bound_household = old.id and household_deleted_at is null;
  insert into public.revenuecat_deletions (app_user_id, due_at)
  values (old.id, now() + interval '30 days')
  on conflict (app_user_id) do nothing;
  return null;
end $$;

revoke execute on function public.household_deleted_purchases() from public, anon, authenticated;

create trigger households_deleted_purchases after delete on public.households
  for each row execute function public.household_deleted_purchases();

-- Records a store transaction RevenueCat reports for household [p_household] (its App User ID) and
-- unlocks the household. Safe to call again with the same transaction. {outcome, already_unlocked,
-- household_gone, internal, buyer, send_completed}; outcome is one of:
--   granted         first time this transaction is seen; the household is unlocked now
--   restored        seen before; it unlocks this household (again, or still)
--   used_elsewhere  it belongs to another household, existing or deleted (household_gone)
--   tombstoned      a purged purchase of a deleted household: never binds again
--   no_household    the App User ID is no household (anonymous, unknown, deleted before its first record)
--   revoked         the store has taken it back; nothing unlocked
-- buyer: the member who claimed it (purchase_claim), if any. send_completed: purchase_completed is
-- due now (first record with a claim in, once). purchase_claim answers the same for the other order,
-- with the purchase's facts.
create function public.purchase_record(
  p_store text,
  p_transaction text,
  p_latest_transaction text,
  p_transaction_hmac text,
  p_product text,
  p_kind text,
  p_environment text,
  p_purchased_at timestamptz,
  p_price numeric,
  p_currency text,
  p_country text,
  p_household uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.purchases;
  v_new boolean;
  v_already boolean;
  v_internal boolean;
  v_send boolean := false;
  v_claim public.purchase_claims;
begin
  if exists (select from public.purchase_tombstones t where t.transaction_hmac = p_transaction_hmac) then
    return jsonb_build_object('outcome', 'tombstoned');
  end if;
  select * into v_row from public.purchases p where p.store = p_store and p.transaction_id = p_transaction;
  if v_row.id is null and not exists (select from public.households h where h.id = p_household) then
    return jsonb_build_object('outcome', 'no_household');
  end if;
  -- Two purchases landing in one household at once (two phones, Ask to Buy): the second sees the
  -- first's unlock, so exactly one of them is already_unlocked.
  perform from public.households h where h.id = p_household for no key update;

  insert into public.purchases as p (store, transaction_id, latest_transaction_id, transaction_hmac,
                                     product_id, kind, environment, purchased_at, price, currency,
                                     country, bound_household)
  values (p_store, p_transaction, p_latest_transaction, p_transaction_hmac, p_product, p_kind,
          p_environment, p_purchased_at, p_price, p_currency, p_country, p_household)
  on conflict (store, transaction_id) do nothing
  returning * into v_row;
  v_new := v_row.id is not null;
  select * into v_row from public.purchases p
  where p.store = p_store and p.transaction_id = p_transaction for update;

  v_internal := exists (select from public.entitlements e where e.household_id = p_household and e.source = 'tester')
    or exists (select from public.lifetime_testers t where t.user_id = v_row.user_id);
  if v_row.revoked_at is not null then
    return jsonb_build_object('outcome', 'revoked', 'internal', v_internal);
  end if;
  if v_row.bound_household is null then
    -- Recorded as refunded before it was ever granted (purchase_revoke); the first grant binds it.
    update public.purchases set bound_household = p_household where id = v_row.id;
    v_row.bound_household := p_household;
  end if;
  if v_row.bound_household <> p_household then
    return jsonb_build_object('outcome', 'used_elsewhere', 'internal', v_internal, 'already_unlocked', false,
      'household_gone', not exists (select from public.households h where h.id = v_row.bound_household));
  end if;
  if not exists (select from public.households h where h.id = p_household) then
    return jsonb_build_object('outcome', 'used_elsewhere', 'household_gone', true, 'internal', v_internal,
      'already_unlocked', false);
  end if;
  update public.purchases p
  set latest_transaction_id = coalesce(p_latest_transaction, p.latest_transaction_id),
      transaction_hmac = coalesce(p.transaction_hmac, p_transaction_hmac),
      price = coalesce(p.price, p_price),
      currency = coalesce(p.currency, p_currency),
      country = coalesce(p.country, p_country)
  where p.id = v_row.id;

  -- The buyer's claim may have come first (the first one, if the app claimed both ids).
  if v_row.user_id is null then
    select * into v_claim from public.purchase_claims c
    where c.store = p_store and c.claimed_for = p_household
      and c.transaction_id in (p_transaction, p_latest_transaction)
    order by c.claimed_at limit 1;
    delete from public.purchase_claims c
    where c.store = p_store and c.transaction_id in (p_transaction, p_latest_transaction);
    if v_claim.user_id is not null then
      update public.purchases set user_id = v_claim.user_id where id = v_row.id;
      v_row.user_id := v_claim.user_id;
    end if;
  end if;
  if v_row.user_id is not null and v_row.completed_sent_at is null then
    update public.purchases set completed_sent_at = now() where id = v_row.id;
    v_send := true;
  end if;

  v_already := v_new and exists (
    select from public.entitlements e
    where e.household_id = p_household and e.kind = v_row.kind and e.purchase_id is distinct from v_row.id
  );
  insert into public.entitlements (purchase_id, household_id, kind, source, product_id, store, environment, granted_by)
  values (v_row.id, p_household, v_row.kind, 'purchase', v_row.product_id, v_row.store, v_row.environment, v_row.user_id)
  on conflict (purchase_id) do nothing;
  return jsonb_build_object('outcome', case when v_new then 'granted' else 'restored' end,
    'already_unlocked', v_already, 'household_gone', false,
    'internal', v_internal or exists (select from public.lifetime_testers t where t.user_id = v_row.user_id),
    'buyer', v_row.user_id, 'send_completed', v_send);
end $$;

-- [p_user], a member of [p_household] (the function checked their session), says they bought
-- store transaction [p_transaction]. If the webhook recorded it for that household, they become its
-- buyer unless someone was first; otherwise the claim waits for the webhook. {status, send_completed}:
-- status recorded (now the buyer), taken (another buyer), elsewhere (another household's), waiting.
create function public.purchase_claim(p_user uuid, p_household uuid, p_store text, p_transaction text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.purchases;
begin
  if not exists (
    select from public.household_members m where m.user_id = p_user and m.household_id = p_household
  ) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  -- purchase_record takes the same lock before it looks for claims: whichever of the two commits
  -- first, the other sees it.
  perform from public.households h where h.id = p_household for no key update;
  select * into v_row from public.purchases p
  where p.store = p_store and p_transaction in (p.transaction_id, p.latest_transaction_id)
  for update;
  if v_row.id is null then
    insert into public.purchase_claims (store, transaction_id, user_id, claimed_for)
    values (p_store, p_transaction, p_user, p_household)
    on conflict (store, transaction_id) do nothing;
    return jsonb_build_object('status', 'waiting', 'send_completed', false);
  end if;
  if v_row.bound_household is distinct from p_household then
    return jsonb_build_object('status', 'elsewhere', 'send_completed', false);
  end if;
  if v_row.user_id is not null and v_row.user_id <> p_user then
    return jsonb_build_object('status', 'taken', 'send_completed', false);
  end if;
  update public.purchases set user_id = p_user where id = v_row.id;
  update public.entitlements set granted_by = p_user where purchase_id = v_row.id and granted_by is null;
  if v_row.completed_sent_at is null and v_row.revoked_at is null then
    update public.purchases set completed_sent_at = now() where id = v_row.id;
    return jsonb_build_object('status', 'recorded', 'send_completed', true, 'purchase', jsonb_build_object(
      'store', v_row.store, 'transaction_id', v_row.transaction_id, 'product_id', v_row.product_id,
      'environment', v_row.environment, 'price', v_row.price, 'currency', v_row.currency,
      'country', v_row.country, 'household_id', v_row.bound_household,
      'internal', exists (select from public.lifetime_testers t where t.user_id = p_user)
        or exists (select from public.entitlements e where e.household_id = p_household and e.source = 'tester')));
  end if;
  return jsonb_build_object('status', 'recorded', 'send_completed', false);
end $$;

-- Revoke: as job 25's (a refund, RevenueCat's CANCELLATION), plus whether analytics marks the
-- refund internal, and the bound household when its entitlement is already gone.
create or replace function public.purchase_revoke(
  p_store text,
  p_transaction text,
  p_revoked_at timestamptz,
  p_product text,
  p_environment text,
  p_purchased_at timestamptz
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.purchases;
  v_household uuid;
  v_at timestamptz := coalesce(p_revoked_at, now());
begin
  -- Waits for a concurrent first record of the same transaction, then finds its row below.
  insert into public.purchases (store, transaction_id, product_id, environment, purchased_at, revoked_at)
  values (p_store, p_transaction, p_product, p_environment, coalesce(p_purchased_at, v_at), v_at)
  on conflict (store, transaction_id) do nothing;
  update public.purchases p set revoked_at = v_at
  where p.store = p_store and p.transaction_id = p_transaction and p.revoked_at is null
  returning * into v_row;
  if v_row.id is null then
    return null;
  end if;
  delete from public.entitlements e where e.purchase_id = v_row.id
  returning e.household_id into v_household;
  v_household := coalesce(v_household, v_row.bound_household);
  return jsonb_build_object(
    'user_id', v_row.user_id,
    'household_id', v_household,
    'product_id', v_row.product_id,
    'environment', v_row.environment,
    'price', v_row.price,
    'currency', v_row.currency,
    'country', v_row.country,
    'internal', exists (select from public.lifetime_testers t where t.user_id = v_row.user_id)
      or exists (select from public.entitlements e where e.household_id = v_household and e.source = 'tester')
  );
end $$;

-- RevenueCat's REFUND_REVERSED: the purchase stands again and unlocks its household again, if that
-- still exists. True if it changed.
create or replace function public.purchase_reinstate(p_store text, p_transaction text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.purchases;
begin
  update public.purchases p set revoked_at = null
  where p.store = p_store and p.transaction_id = p_transaction and p.revoked_at is not null
  returning * into v_row;
  if v_row.id is null then
    return false;
  end if;
  insert into public.entitlements (purchase_id, household_id, kind, source, product_id, store, environment, granted_by)
  select v_row.id, h.id, v_row.kind, 'purchase', v_row.product_id, v_row.store, v_row.environment, v_row.user_id
  from public.households h where h.id = v_row.bound_household
  on conflict (purchase_id) do nothing;
  return true;
end $$;

-- Job 25's self-verification path is gone (the function no longer talks to Apple or Google).
-- squawk-ignore ban-drop-function -- only the job 25 function called it, service connection only; no app or client ever could
drop function public.purchase_grant(text, text, text, text, timestamptz, timestamptz, numeric, text, text, uuid, uuid);

-- The due RevenueCat deletions to try now, at most [p_limit], each at most once an hour; marks them
-- tried. The function's deletion route calls it, then revenuecat_deletion_done for each confirmed.
create function public.revenuecat_deletions_take(p_limit integer) returns setof uuid
language sql security definer set search_path = '' as $$
  update public.revenuecat_deletions d
  set attempts = d.attempts + 1, last_attempt_at = now()
  where d.app_user_id in (
    select q.app_user_id from public.revenuecat_deletions q
    where q.due_at <= now() and (q.last_attempt_at is null or q.last_attempt_at < now() - interval '1 hour')
    order by q.due_at
    limit p_limit
    for update skip locked
  )
  returning d.app_user_id
$$;

create function public.revenuecat_deletion_done(p_app_user_id uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.revenuecat_deletions where app_user_id = p_app_user_id
$$;

revoke execute on function public.revenuecat_deletions_take(integer) from public, anon, authenticated;
revoke execute on function public.revenuecat_deletion_done(uuid) from public, anon, authenticated;

-- Retention, daily (pg_cron): purchases of households deleted 30 days ago leave a tombstone and go,
-- with their unlocks' last trace; processed webhook ids after 90 days; an archived household whose
-- archiver was deleted outside delete_account (no one could re-enable it).
create function public.purge_purchases() returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.purchase_tombstones (transaction_hmac)
  select p.transaction_hmac from public.purchases p
  where p.household_deleted_at < now() - interval '30 days' and p.transaction_hmac is not null
  on conflict do nothing;
  delete from public.purchases p where p.household_deleted_at < now() - interval '30 days';
  -- Refunds of transactions never recorded for a household (or after their purge): nothing to
  -- keep them for once the refund window is over.
  delete from public.purchases p
  where p.bound_household is null and p.revoked_at < now() - interval '30 days';
  delete from public.revenuecat_events e where e.received_at < now() - interval '90 days';
  delete from public.purchase_claims c where c.claimed_at < now() - interval '30 days';
  delete from public.households h where h.archived_at is not null and h.archived_by is null;
end $$;

revoke execute on function public.purchase_record(text, text, text, text, text, text, text, timestamptz, numeric, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.purchase_claim(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.purchase_revoke(text, text, timestamptz, text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.purchase_reinstate(text, text) from public, anon, authenticated;
revoke execute on function public.purge_purchases() from public, anon, authenticated;

select cron.schedule('purge-purchases', '41 3 * * *', 'select public.purge_purchases()');

-- Archive: the last member keeps an unlocked household instead of deleting it --------------------

alter table public.households add column archived_at timestamptz;
-- Who archived it and alone may re-enable it. delete_account deletes it with their account (a
-- cascade here would race the invites' created_by set null and fail the deletion).
alter table public.households add column archived_by uuid references auth.users (id) on delete set null;
-- squawk-ignore constraint-missing-not-valid -- both columns are new and null in every row
alter table public.households add constraint households_archived
  check (archived_by is null or archived_at is not null);

comment on column public.households.archived_at is
  'Job 43: archived by its last member on leaving (it had Hummlist Lifetime): no members, list and unlock kept, re-enabled by archived_by.';

-- Leaves the caller's household, like leave_current_household(). As its last member they may
-- archive it ([p_archive]) if it has Hummlist Lifetime; otherwise it is deleted. Answers what
-- happened to it: left (others stay), archived, deleted, or none (no household).
create function public.leave_current_household(p_archive boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_household uuid;
begin
  delete from public.household_members where user_id = auth.uid()
  returning household_id into v_household;
  if v_household is null then
    return 'none';
  end if;
  -- Waits for a join that holds the household (accept_invite's share lock), so its new member is
  -- seen here and the household isn't archived or deleted under them.
  perform from public.households h where h.id = v_household for update;
  if exists (select from public.household_members where household_id = v_household) then
    return 'left';
  end if;
  if p_archive and exists (
    select from public.entitlements e where e.household_id = v_household and e.kind = 'lifetime'
  ) then
    update public.households set archived_at = now(), archived_by = auth.uid() where id = v_household;
    return 'archived';
  end if;
  delete from public.households where id = v_household;
  return 'deleted';
end $$;

-- accept_invite with the archive choice for the household the caller leaves: as before plus
-- `previous` (leave_current_household's answer) when it joined.
create function public.accept_invite(p_code text, p_archive boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_check record;
  v_household uuid;
  v_previous text;
begin
  select * into v_check from public.check_invite(p_code);
  if v_check.status = 'member' then
    return jsonb_build_object('status', 'member', 'household_id', v_check.household_id);
  elsif v_check.status <> 'ok' then
    return jsonb_build_object('status', v_check.status, 'household_id', null);
  end if;
  -- Its last member may be archiving it right now: wait for that, then don't join an archived one.
  if not exists (
    select from public.households h where h.id = v_check.household_id and h.archived_at is null for share
  ) then
    return jsonb_build_object('status', 'invalid_invite', 'household_id', null);
  end if;

  update public.invites i set used_at = now(), used_by = auth.uid()
  where i.id = v_check.invite_id and i.used_at is null and i.revoked_at is null and i.expires_at > now()
  returning i.household_id into v_household;
  if v_household is null then
    -- Lost the race. The winner may have been this same user (a double tap): then they are in.
    if public.is_household_member(v_check.household_id) then
      return jsonb_build_object('status', 'member', 'household_id', v_check.household_id);
    end if;
    delete from public.invite_attempts a where a.at < now() - interval '1 day';
    insert into public.invite_attempts (user_id) values (auth.uid());
    return jsonb_build_object('status', 'invalid_invite', 'household_id', null);
  end if;

  v_previous := public.leave_current_household(p_archive);
  insert into public.household_members (household_id, user_id, role)
  values (v_household, auth.uid(), 'member');
  return jsonb_build_object('status', 'joined', 'household_id', v_household, 'previous', v_previous);
end $$;

-- Job 22's signature (apps before job 43): the last member's household is deleted, as before.
create or replace function public.accept_invite(p_code text) returns jsonb
language sql security definer set search_path = '' as $$
  select public.accept_invite(p_code, false) - 'previous'
$$;

-- An archived household has no members to invite anyone; its old invites lead nowhere. The body is
-- job 22's with that one condition.
create or replace function public.check_invite(p_code text, out status text, out invite_id uuid, out household_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_invite public.invites;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('invite_attempts:' || v_user::text, 0));
  if (select count(*) from public.invite_attempts a
      where a.user_id = v_user and a.at > now() - interval '1 hour') >= 10 then
    status := 'too_many_attempts';
    return;
  end if;
  select * into v_invite from public.invites i
  where i.code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if v_invite.id is not null and public.is_household_member(v_invite.household_id) then
    status := 'member';
  elsif v_invite.id is not null and v_invite.used_at is null and v_invite.revoked_at is null
        and v_invite.expires_at > now()
        and not exists (select from public.households h where h.id = v_invite.household_id and h.archived_at is not null) then
    status := 'ok';
  else
    status := 'invalid_invite';
    -- No raise anywhere on this path: it would roll this row back with the call.
    delete from public.invite_attempts a where a.at < now() - interval '1 day';
    insert into public.invite_attempts (user_id) values (v_user);
    return;
  end if;
  invite_id := v_invite.id;
  household_id := v_invite.household_id;
end $$;

-- The caller's archived households, newest first: [{id, name, archived_at, unlocked}].
create function public.archived_households() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', h.id,
    'name', h.name,
    'archived_at', h.archived_at,
    'unlocked', exists (select from public.entitlements e where e.household_id = h.id and e.kind = 'lifetime')
  ) order by h.archived_at desc, h.id), '[]'::jsonb)
  from public.households h
  where h.archived_by = auth.uid() and h.archived_at is not null
$$;

-- Re-enables the caller's archived household [p_household] and moves them into it, as its owner;
-- the household they are in now is left like on a join ([p_archive]). {status, previous}: status
-- unarchived, or not_found (not theirs, not archived).
create function public.unarchive_household(p_household uuid, p_archive boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_previous text;
begin
  perform from public.households h
  where h.id = p_household and h.archived_by = auth.uid() and h.archived_at is not null
  for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  v_previous := public.leave_current_household(p_archive);
  update public.households set archived_at = null, archived_by = null where id = p_household;
  insert into public.household_members (household_id, user_id, role)
  values (p_household, auth.uid(), 'owner');
  return jsonb_build_object('status', 'unarchived', 'previous', v_previous);
end $$;

-- Account deletion: job 24's, plus the households the user archived.
create or replace function public.delete_account(p_user uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_household uuid;
  v_role text;
  v_fate text := 'none';
begin
  -- The household row lock serializes with join_household (its membership insert takes a key
  -- share lock on the household) and with another member deleting their account at once.
  select h.id into v_household
  from public.households h
  join public.household_members m on m.household_id = h.id
  where m.user_id = p_user
  for update of h;

  if v_household is not null then
    select m.role into v_role
    from public.household_members m
    where m.user_id = p_user and m.household_id = v_household;

    if exists (
      select from public.household_members m
      where m.household_id = v_household and m.user_id <> p_user
    ) then
      v_fate := 'kept';
      if v_role = 'owner' then
        update public.household_members set role = 'owner'
        where household_id = v_household
          and user_id = (
            select m.user_id from public.household_members m
            where m.household_id = v_household and m.user_id <> p_user
            order by m.joined_at, m.user_id
            limit 1
          );
      end if;
    else
      v_fate := 'deleted';
      delete from public.households where id = v_household;
    end if;
  end if;

  -- Job 43: the households they archived have no one else to come back to them.
  delete from public.households where archived_by = p_user;
  update public.item_events set actor = null where actor = p_user;
  delete from auth.users where id = p_user;
  return v_fate;
end $$;

revoke execute on function public.leave_current_household(boolean) from public, anon;
revoke execute on function public.accept_invite(text, boolean) from public, anon;
revoke execute on function public.archived_households() from public, anon;
revoke execute on function public.unarchive_household(uuid, boolean) from public, anon;
grant execute on function
  public.leave_current_household(boolean),
  public.accept_invite(text, boolean),
  public.archived_households(),
  public.unarchive_household(uuid, boolean)
to authenticated;

-- Join: what the invite's household has, and what leaving the current one ends -------------------

-- {status, name} as before, plus with ok or member:
--   unlocked          the invite's household has Hummlist Lifetime: nothing to buy there
-- and with ok:
--   leaves_unlocked   the caller is the last member of an unlocked household; joining deletes it
--                     and its Lifetime (household-bound, nothing moves) unless they archive it
--   recent_purchase   the caller verified a purchase in the last 30 days (DECISIONS 43.6) that the
--                     store has not taken back: the app points to the refund help
create or replace function public.preview_invite(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_check record;
  v_user uuid := auth.uid();
  v_current uuid;
begin
  select * into v_check from public.check_invite(p_code);
  if v_check.status not in ('ok', 'member') then
    return jsonb_build_object('status', v_check.status, 'name', null);
  end if;
  select m.household_id into v_current from public.household_members m where m.user_id = v_user;
  return jsonb_build_object(
    'status', v_check.status,
    'name', (select h.name from public.households h where h.id = v_check.household_id),
    'unlocked', exists (
      select from public.entitlements e
      where e.household_id = v_check.household_id and e.kind = 'lifetime'
    )
  ) || case when v_check.status = 'ok' then jsonb_build_object(
    'leaves_unlocked', v_current is not null
      and not exists (
        select from public.household_members m where m.household_id = v_current and m.user_id <> v_user
      )
      and exists (
        select from public.entitlements e
        where e.household_id = v_current and e.kind = 'lifetime'
      ),
    'recent_purchase', exists (
      select from public.purchases p
      where p.user_id = v_user and p.revoked_at is null
        and p.purchased_at > now() - interval '30 days'
    )
  ) else '{}'::jsonb end;
end $$;

-- Data export ------------------------------------------------------------------------------------
-- Job 25's body; each purchase also names the household it belongs to, a tester sees their grants,
-- and the user's archived households are listed (GDPR Art. 15). The additions keep version 1.
create or replace function public.export_my_data() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  -- An app connected over OAuth (MCP) acts on the list, not on the account.
  if auth.jwt() ->> 'client_id' is not null then
    raise exception 'session_required' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'format', 'family-groceries-export',
    'version', 1,
    'exported_at', now(),
    'account', (
      select jsonb_build_object(
        'id', u.id,
        'email', u.email,
        'created_at', u.created_at,
        'last_sign_in_at', u.last_sign_in_at,
        'providers', coalesce(
          (select jsonb_agg(distinct i.provider) from auth.identities i where i.user_id = u.id),
          '[]'::jsonb
        )
      )
      from auth.users u where u.id = v_user
    ),
    'profile', (
      select jsonb_build_object('display_name', p.display_name, 'created_at', p.created_at)
      from public.profiles p where p.id = v_user
    ),
    'household', (
      select jsonb_build_object('id', h.id, 'name', h.name, 'role', m.role, 'joined_at', m.joined_at)
      from public.household_members m
      join public.households h on h.id = m.household_id
      where m.user_id = v_user
    ),
    'items_added', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', i.name,
        'brand', i.brand,
        'properties', i.properties,
        'quantity', i.quantity,
        'status', i.status,
        'category', c.name,
        'store', s.name,
        'created_at', i.created_at,
        'bought_at', i.bought_at
      ) order by i.created_at, i.id)
      from public.items i
      join public.household_members m on m.household_id = i.household_id and m.user_id = v_user
      left join public.categories c on c.id = i.category_id
      left join public.stores s on s.id = i.store_id
      where i.added_by = v_user
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'action', e.action,
        'item_name', e.item_name,
        'category', c.name,
        'created_at', e.created_at
      ) order by e.created_at, e.id)
      from public.item_events e
      left join public.categories c on c.id = e.category_id
      where e.actor = v_user
    ), '[]'::jsonb),
    'access_tokens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', t.name,
        'token_hint', t.token_hint,
        'created_at', t.created_at,
        'last_used_at', t.last_used_at,
        'revoked_at', t.revoked_at
      ) order by t.created_at, t.id)
      from public.personal_access_tokens t
      where t.user_id = v_user
    ), '[]'::jsonb),
    'invites_created', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', iv.code,
        'created_at', iv.created_at,
        'expires_at', iv.expires_at,
        'used_at', iv.used_at,
        'revoked_at', iv.revoked_at
      ) order by iv.created_at, iv.id)
      from public.invites iv
      where iv.created_by = v_user
    ), '[]'::jsonb),
    'feedback', coalesce((
      select jsonb_agg(jsonb_build_object(
        'created_at', f.created_at,
        'message', f.message,
        'category', f.category,
        'contact_ok', f.contact_ok,
        'screen', f.screen,
        'platform', f.platform,
        'app_version', f.app_version,
        'build', f.build,
        'os_version', f.os_version,
        'locale', f.locale,
        'household_id', f.household_id,
        'is_internal', f.is_internal
      ) order by f.created_at, f.id)
      from public.feedback f
      where f.user_id = v_user
    ), '[]'::jsonb),
    'connected_apps', coalesce((
      select jsonb_agg(jsonb_build_object(
        'client_name', oc.client_name,
        'scopes', c.scopes,
        'granted_at', c.granted_at,
        'revoked_at', c.revoked_at
      ) order by c.granted_at, c.id)
      from auth.oauth_consents c
      join auth.oauth_clients oc on oc.id = c.client_id
      where c.user_id = v_user
    ), '[]'::jsonb),
    'analytics_decisions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'install_id', a.install_id,
        'consent', a.consent,
        'internal', a.internal,
        'decided_at', a.decided_at
      ) order by a.decided_at, a.install_id)
      from public.analytics_consents a
      where a.user_id = v_user
    ), '[]'::jsonb),
    'alexa_links', coalesce((
      select jsonb_agg(jsonb_build_object('last_seen', l.last_seen) order by l.last_seen)
      from public.alexa_links l
      where l.user_id = v_user
    ), '[]'::jsonb),
    'purchases', coalesce((
      select jsonb_agg(jsonb_build_object(
        'store', p.store,
        'product_id', p.product_id,
        'transaction_id', p.transaction_id,
        'environment', p.environment,
        'purchased_at', p.purchased_at,
        'revoked_at', p.revoked_at,
        'price', p.price,
        'currency', p.currency,
        'country', p.country,
        'unlocks_household', (select e.household_id from public.entitlements e where e.purchase_id = p.id),
        'belongs_to_household', p.bound_household
      ) order by p.purchased_at, p.id)
      from public.purchases p
      where p.user_id = v_user
    ), '[]'::jsonb),
    'lifetime_tester', (
      select jsonb_build_object('added_at', t.added_at, 'note', t.note, 'grants', t.grants,
        'used_in_households', coalesce((
          select jsonb_agg(e.household_id order by e.granted_at, e.id)
          from public.entitlements e where e.source = 'tester' and e.tester = v_user
        ), '[]'::jsonb))
      from public.lifetime_testers t where t.user_id = v_user
    ),
    'archived_households', coalesce((
      select jsonb_agg(jsonb_build_object('id', h.id, 'name', h.name, 'archived_at', h.archived_at)
        order by h.archived_at, h.id)
      from public.households h where h.archived_by = v_user
    ), '[]'::jsonb)
  );
end $$;
