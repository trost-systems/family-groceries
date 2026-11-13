-- Job 185: Premium belongs to the Snacklist user who bought it (Peter, Nov 11; DECISIONS "Job 185").
--
-- New app builds buy through RevenueCat with the user id as App User ID, so entitlement, restore on
-- a new device and lapse follow the buyer, whichever household they are in. Older builds and
-- RevenueCat promotional grants on household customers keep the household path (job 43):
--   * a purchase is bound to exactly one owner, bound_household or bound_user, at its first grant
--     and never moved; app_user_owner() tells the two kinds of App User ID apart;
--   * the buyer reads their premium from user_entitlements (own rows only), the other members of
--     their households never see it; user_premium() is the rule, like household_premium();
--   * the integration gate also opens for the caller's own premium; household reads (invites,
--     leaving, archiving) stay household-only;
--   * a deleted account's purchases are purged 30 days later; its RevenueCat customer is deleted
--     only if its id ever went to RevenueCat (revenuecat_customers).

-- Purchases: the bound user --------------------------------------------------------------------

alter table public.purchases add column bound_user uuid;
alter table public.purchases add column user_deleted_at timestamptz;
alter table public.purchases add constraint purchases_one_owner
  check (bound_household is null or bound_user is null);

comment on column public.purchases.bound_user is
  'Job 185: the user this purchase unlocks premium for (RevenueCat App User ID = user id), set at its first grant and never changed. Not a foreign key, like bound_household: a deleted account must not make the purchase look unbound.';
comment on column public.purchases.user_deleted_at is
  'Job 185: when bound_user''s account was deleted; the row is purged 30 days later.';
comment on table public.revenuecat_deletions is
  'Job 43, 185: RevenueCat customers (the App User ID: a deleted household''s or a deleted account''s id) to delete at RevenueCat once due. Service connection only.';

create index purchases_bound_user on public.purchases (bound_user) where bound_user is not null;

-- Accounts known to RevenueCat ---------------------------------------------------------------------

-- No foreign key: the account deletion trigger reads the row after auth.users lost it.
create table public.revenuecat_customers (
  user_id uuid primary key,
  noted_at timestamptz not null default now()
);

comment on table public.revenuecat_customers is
  'Job 185: accounts whose id was given to RevenueCat as App User ID (the app notes it before Buy or Restore reaches RevenueCat; a user-bound purchase or promotional grant notes it too). Only these are queued in revenuecat_deletions when the account is deleted. Service connection only.';

alter table public.revenuecat_customers enable row level security;
revoke all on public.revenuecat_customers from anon, authenticated;

-- The app calls this before it gives the caller's id to RevenueCat.
create function public.note_revenuecat_customer() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  insert into public.revenuecat_customers (user_id) values (auth.uid())
  on conflict (user_id) do nothing;
end $$;

revoke execute on function public.note_revenuecat_customer() from public, anon;
grant execute on function public.note_revenuecat_customer() to authenticated;

-- 'user' or 'household': what a RevenueCat App User ID names; null for neither.
create function public.app_user_owner(p_app_user_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when exists (select from auth.users u where u.id = p_app_user_id) then 'user'
    when exists (select from public.households h where h.id = p_app_user_id) then 'household'
  end
$$;

revoke execute on function public.app_user_owner(uuid) from public, anon, authenticated;

-- Serializes a user's purchase and promotional writes, as the households row lock does for a
-- household: two first purchases at once see each other, exactly one is already_unlocked.
create function public.purchase_user_lock(p_user uuid) returns void
language sql security definer set search_path = '' as $$
  select pg_advisory_xact_lock(hashtext('purchase_user:' || p_user::text))
$$;

revoke execute on function public.purchase_user_lock(uuid) from public, anon, authenticated;

-- The buyer's unlocks ----------------------------------------------------------------------------

-- Keyed by its own id: Realtime sends a delete's primary key to every subscriber.
create table public.user_entitlements (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid unique references public.purchases (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'premium' constraint user_entitlements_kind check (kind in ('premium')),
  source text not null constraint user_entitlements_source check (source in ('purchase', 'promotional')),
  premium_source text not null
    constraint user_entitlements_premium_source check (premium_source in ('yearly', 'lifetime', 'promotional')),
  product_id text check (product_id ~ '^[a-z0-9_.]{1,64}$'),
  store text check (store in ('apple', 'google')),
  environment text check (environment in ('Production', 'Sandbox')),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  auto_renew boolean,
  constraint user_entitlements_source_columns check (case source
    when 'purchase' then purchase_id is not null and product_id is not null and store is not null
                         and environment is not null
    else purchase_id is null and store is null and product_id is null and environment is null end),
  constraint user_entitlements_premium_columns check (
    (source = 'promotional') = (premium_source = 'promotional')
    and (premium_source <> 'yearly' or expires_at is not null)
    and (premium_source in ('yearly', 'promotional') or expires_at is null)
    and (premium_source = 'yearly' or auto_renew is null))
);

create index user_entitlements_user on public.user_entitlements (user_id);
create unique index user_entitlements_promotional on public.user_entitlements (user_id)
  where source = 'promotional';

comment on table public.user_entitlements is
  'Job 185: premium a user bought (or was granted at RevenueCat) for themselves, in every household they are in. The user reads their own rows; the effective one is user_premium().';

alter table public.user_entitlements enable row level security;
revoke all on public.user_entitlements from anon, authenticated;
-- user_id too, so the app can filter on it (PostgREST and the Realtime channel); RLS already
-- limits the rows to the caller's own.
grant select (id, user_id, kind, source, premium_source, expires_at, auto_renew, granted_at)
  on public.user_entitlements to authenticated;
create policy user_entitlements_select on public.user_entitlements
  for select to authenticated using (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.user_entitlements;

-- [p_user]'s own premium now, by household_premium()'s rule.
create function public.user_premium(p_user uuid)
returns table (source text, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with lasting as (
    select e.premium_source
    from public.user_entitlements e
    where e.user_id = p_user and e.kind = 'premium'
      and (e.premium_source = 'lifetime'
           or (e.premium_source = 'promotional' and e.expires_at is null))
    order by e.premium_source = 'lifetime' desc
    limit 1
  )
  select l.premium_source, null::timestamptz from lasting l
  union all
  (select e.premium_source, e.expires_at
   from public.user_entitlements e
   where e.user_id = p_user and e.kind = 'premium'
     and e.premium_source in ('yearly', 'promotional') and e.expires_at > now()
     and not exists (select from lasting)
   order by e.expires_at desc, e.premium_source = 'yearly' desc
   limit 1)
$$;

create function public.user_has_premium(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select from public.user_premium(p_user))
$$;

-- Testers and reviewers: a promotional grant of their own, or one of a household they are in.
create function public.user_internal(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select from public.user_entitlements e where e.user_id = p_user and e.source = 'promotional'
  ) or exists (
    select from public.household_members m
    where m.user_id = p_user and public.household_internal(m.household_id)
  )
$$;

revoke execute on function public.user_premium(uuid) from public, anon, authenticated;
revoke execute on function public.user_has_premium(uuid) from public, anon, authenticated;
revoke execute on function public.user_internal(uuid) from public, anon, authenticated;

-- Writes ------------------------------------------------------------------------------------------

create or replace function public.purchase_entitlement_sync(p_purchase uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.purchases;
begin
  select * into v_row from public.purchases p where p.id = p_purchase;
  if v_row.id is null or v_row.revoked_at is not null then
    return;
  end if;
  if v_row.bound_user is not null then
    insert into public.user_entitlements as e (purchase_id, user_id, kind, source, premium_source,
                                               product_id, store, environment, expires_at, auto_renew)
    select v_row.id, u.id, v_row.kind, 'purchase', v_row.plan, v_row.product_id, v_row.store,
           v_row.environment, v_row.expires_at, v_row.auto_renew
    from auth.users u where u.id = v_row.bound_user
    on conflict (purchase_id) do update
      set expires_at = excluded.expires_at, auto_renew = excluded.auto_renew,
          product_id = excluded.product_id
      where e.expires_at is distinct from excluded.expires_at
         or e.auto_renew is distinct from excluded.auto_renew
         or e.product_id is distinct from excluded.product_id;
    return;
  end if;
  insert into public.entitlements as e (purchase_id, household_id, kind, source, premium_source,
                                        product_id, store, environment, granted_by, expires_at,
                                        auto_renew)
  select v_row.id, h.id, v_row.kind, 'purchase', v_row.plan, v_row.product_id, v_row.store,
         v_row.environment, v_row.user_id, v_row.expires_at, v_row.auto_renew
  from public.households h where h.id = v_row.bound_household
  on conflict (purchase_id) do update
    set expires_at = excluded.expires_at, auto_renew = excluded.auto_renew,
        product_id = excluded.product_id
    where e.expires_at is distinct from excluded.expires_at
       or e.auto_renew is distinct from excluded.auto_renew
       or e.product_id is distinct from excluded.product_id;
end $$;

-- Whether the owner [p_row] is bound to still exists.
create function public.purchase_owner_exists(p_row public.purchases) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when p_row.bound_user is not null then exists (select from auth.users u where u.id = p_row.bound_user)
    else exists (select from public.households h where h.id = p_row.bound_household)
  end
$$;

revoke execute on function public.purchase_owner_exists(public.purchases) from public, anon, authenticated;

-- The household path (job 43, 49, 67), unchanged but for user-bound transactions: one recorded
-- under a household id (an old build of the buyer, a TRANSFER) is used_elsewhere and never binds.
create or replace function public.purchase_record(
  p_store text,
  p_transaction text,
  p_latest_transaction text,
  p_transaction_hmac text,
  p_product text,
  p_kind text,
  p_plan text,
  p_environment text,
  p_purchased_at timestamptz,
  p_price numeric,
  p_currency text,
  p_country text,
  p_household uuid,
  p_event_at timestamptz default now(),
  p_expires_at timestamptz default null,
  p_auto_renew boolean default null,
  p_billing_issue boolean default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.purchases;
  v_new boolean;
  v_already boolean;
  v_second_yearly boolean := false;
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
  v_already := public.household_has_premium(p_household);
  v_second_yearly := p_plan = 'yearly' and exists (
    select from public.entitlements e
    where e.household_id = p_household and e.premium_source = 'yearly' and e.expires_at > now()
  );

  insert into public.purchases as p (store, transaction_id, latest_transaction_id, transaction_hmac,
                                     product_id, kind, plan, environment, purchased_at, price,
                                     currency, country, bound_household, expires_at, auto_renew,
                                     billing_issue, state_at)
  values (p_store, p_transaction, p_latest_transaction, p_transaction_hmac, p_product, p_kind,
          p_plan, p_environment, p_purchased_at, p_price, p_currency, p_country, p_household,
          case when p_plan = 'yearly' then p_expires_at end,
          case when p_plan = 'yearly' then coalesce(p_auto_renew, true) end,
          p_plan = 'yearly' and coalesce(p_billing_issue, false), p_event_at)
  on conflict (store, transaction_id) do nothing
  returning * into v_row;
  v_new := v_row.id is not null;
  select * into v_row from public.purchases p
  where p.store = p_store and p.transaction_id = p_transaction for update;

  v_internal := public.household_internal(p_household);
  -- A refunded yearly plan whose next period is paid (RevenueCat: a subscription refund covers the
  -- latest period only, and auto-renew may stay on) counts again from a renewal after the refund,
  -- in its own household only.
  if v_row.revoked_at is not null and v_row.plan = 'yearly' and not v_new
     and v_row.bound_household = p_household and p_event_at > v_row.revoked_at then
    update public.purchases set revoked_at = null where id = v_row.id;
    v_row.revoked_at := null;
  end if;
  if v_row.revoked_at is not null then
    return jsonb_build_object('outcome', 'revoked', 'internal', v_internal);
  end if;
  if v_row.bound_household is null and v_row.bound_user is null then
    -- Recorded as refunded before it was ever granted (purchase_revoke); the first grant binds it.
    update public.purchases set bound_household = p_household where id = v_row.id;
    v_row.bound_household := p_household;
  end if;
  if v_row.bound_household is distinct from p_household then
    -- A renewal under another App User ID (TRANSFER, an App User ID drift) is still the plan's: its
    -- newer state applies where it is bound, and nothing is granted here.
    if v_row.plan = 'yearly' and public.purchase_owner_exists(v_row) then
      perform public.purchase_state_apply(v_row.id, p_event_at, p_expires_at, coalesce(p_auto_renew, true),
                                          coalesce(p_billing_issue, false));
    end if;
    return jsonb_build_object('outcome', 'used_elsewhere', 'internal', v_internal, 'already_unlocked', false,
      'household_gone', not public.purchase_owner_exists(v_row));
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
  if not v_new and v_row.plan = 'yearly' then
    -- A renewal, or the same event again: newer state wins, the period never moves back.
    perform public.purchase_state_apply(v_row.id, p_event_at, p_expires_at, coalesce(p_auto_renew, true),
                                        coalesce(p_billing_issue, false));
  end if;

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

  perform public.purchase_entitlement_sync(v_row.id);
  return jsonb_build_object('outcome', case when v_new then 'granted' else 'restored' end,
    'already_unlocked', v_new and v_already, 'second_yearly', v_new and v_second_yearly,
    'household_gone', false,
    'internal', v_internal,
    'buyer', v_row.user_id, 'send_completed', v_send, 'plan', v_row.plan);
end $$;

-- purchase_record for an App User ID that is a user: the same answer, with no_user for no_household.
-- The buyer is the user, so no claim is needed: purchase_completed is due at the first grant.
create function public.purchase_record_user(
  p_store text,
  p_transaction text,
  p_latest_transaction text,
  p_transaction_hmac text,
  p_product text,
  p_kind text,
  p_plan text,
  p_environment text,
  p_purchased_at timestamptz,
  p_price numeric,
  p_currency text,
  p_country text,
  p_user uuid,
  p_event_at timestamptz default now(),
  p_expires_at timestamptz default null,
  p_auto_renew boolean default null,
  p_billing_issue boolean default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.purchases;
  v_new boolean;
  v_already boolean;
  v_second_yearly boolean := false;
  v_internal boolean;
  v_send boolean := false;
begin
  if exists (select from public.purchase_tombstones t where t.transaction_hmac = p_transaction_hmac) then
    return jsonb_build_object('outcome', 'tombstoned');
  end if;
  select * into v_row from public.purchases p where p.store = p_store and p.transaction_id = p_transaction;
  if v_row.id is null and not exists (select from auth.users u where u.id = p_user) then
    return jsonb_build_object('outcome', 'no_user');
  end if;
  perform public.purchase_user_lock(p_user);
  insert into public.revenuecat_customers (user_id)
  select p_user where exists (select from auth.users u where u.id = p_user)
  on conflict (user_id) do nothing;
  v_already := public.user_has_premium(p_user);
  v_second_yearly := p_plan = 'yearly' and exists (
    select from public.user_entitlements e
    where e.user_id = p_user and e.premium_source = 'yearly' and e.expires_at > now()
  );

  insert into public.purchases as p (store, transaction_id, latest_transaction_id, transaction_hmac,
                                     product_id, kind, plan, environment, purchased_at, price,
                                     currency, country, bound_user, user_id, expires_at, auto_renew,
                                     billing_issue, state_at)
  values (p_store, p_transaction, p_latest_transaction, p_transaction_hmac, p_product, p_kind,
          p_plan, p_environment, p_purchased_at, p_price, p_currency, p_country, p_user, p_user,
          case when p_plan = 'yearly' then p_expires_at end,
          case when p_plan = 'yearly' then coalesce(p_auto_renew, true) end,
          p_plan = 'yearly' and coalesce(p_billing_issue, false), p_event_at)
  on conflict (store, transaction_id) do nothing
  returning * into v_row;
  v_new := v_row.id is not null;
  select * into v_row from public.purchases p
  where p.store = p_store and p.transaction_id = p_transaction for update;

  v_internal := public.user_internal(p_user);
  if v_row.revoked_at is not null and v_row.plan = 'yearly' and not v_new
     and v_row.bound_user = p_user and p_event_at > v_row.revoked_at then
    update public.purchases set revoked_at = null where id = v_row.id;
    v_row.revoked_at := null;
  end if;
  if v_row.revoked_at is not null then
    return jsonb_build_object('outcome', 'revoked', 'internal', v_internal);
  end if;
  if v_row.bound_household is null and v_row.bound_user is null then
    update public.purchases set bound_user = p_user where id = v_row.id;
    v_row.bound_user := p_user;
  end if;
  if v_row.bound_user is distinct from p_user then
    if v_row.plan = 'yearly' and public.purchase_owner_exists(v_row) then
      perform public.purchase_state_apply(v_row.id, p_event_at, p_expires_at, coalesce(p_auto_renew, true),
                                          coalesce(p_billing_issue, false));
    end if;
    return jsonb_build_object('outcome', 'used_elsewhere', 'internal', v_internal, 'already_unlocked', false,
      'household_gone', not public.purchase_owner_exists(v_row));
  end if;
  if not exists (select from auth.users u where u.id = p_user) then
    return jsonb_build_object('outcome', 'used_elsewhere', 'household_gone', true, 'internal', v_internal,
      'already_unlocked', false);
  end if;
  update public.purchases p
  set latest_transaction_id = coalesce(p_latest_transaction, p.latest_transaction_id),
      transaction_hmac = coalesce(p.transaction_hmac, p_transaction_hmac),
      price = coalesce(p.price, p_price),
      currency = coalesce(p.currency, p_currency),
      country = coalesce(p.country, p_country),
      user_id = p_user
  where p.id = v_row.id;
  if not v_new and v_row.plan = 'yearly' then
    perform public.purchase_state_apply(v_row.id, p_event_at, p_expires_at, coalesce(p_auto_renew, true),
                                        coalesce(p_billing_issue, false));
  end if;
  if v_row.completed_sent_at is null then
    update public.purchases set completed_sent_at = now() where id = v_row.id;
    v_send := true;
  end if;

  perform public.purchase_entitlement_sync(v_row.id);
  return jsonb_build_object('outcome', case when v_new then 'granted' else 'restored' end,
    'already_unlocked', v_new and v_already, 'second_yearly', v_new and v_second_yearly,
    'household_gone', false,
    'internal', v_internal,
    'buyer', p_user, 'send_completed', v_send, 'plan', v_row.plan);
end $$;

revoke execute on function public.purchase_record_user(text, text, text, text, text, text, text, text,
  timestamptz, numeric, text, text, uuid, timestamptz, timestamptz, boolean, boolean)
  from public, anon, authenticated;

create or replace function public.purchase_revoke(
  p_store text,
  p_transaction text,
  p_revoked_at timestamptz,
  p_product text,
  p_plan text,
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
  insert into public.purchases (store, transaction_id, product_id, plan, environment, purchased_at, revoked_at)
  values (p_store, p_transaction, p_product, p_plan, p_environment, coalesce(p_purchased_at, v_at), v_at)
  on conflict (store, transaction_id) do nothing;
  update public.purchases p set revoked_at = v_at
  where p.store = p_store and p.transaction_id = p_transaction and p.revoked_at is null
  returning * into v_row;
  if v_row.id is null then
    return null;
  end if;
  delete from public.user_entitlements e where e.purchase_id = v_row.id;
  delete from public.entitlements e where e.purchase_id = v_row.id
  returning e.household_id into v_household;
  v_household := coalesce(v_household, v_row.bound_household);
  return jsonb_build_object(
    'user_id', v_row.user_id,
    'household_id', v_household,
    'product_id', v_row.product_id,
    'plan', v_row.plan,
    'environment', v_row.environment,
    'price', v_row.price,
    'currency', v_row.currency,
    'country', v_row.country,
    'internal', case when v_row.bound_user is not null then public.user_internal(v_row.bound_user)
                     else public.household_internal(v_household) end
  );
end $$;

-- Promotional premium of a user customer, as promotional_premium_sync() keeps a household's.
create function public.promotional_premium_sync_user(
  p_user uuid,
  p_active boolean,
  p_expires_at timestamptz
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_had timestamptz;
  v_found boolean;
begin
  if not exists (select from auth.users u where u.id = p_user) then
    return 'no_user';
  end if;
  perform public.purchase_user_lock(p_user);
  insert into public.revenuecat_customers (user_id) values (p_user) on conflict (user_id) do nothing;
  select true, e.expires_at into v_found, v_had
  from public.user_entitlements e
  where e.user_id = p_user and e.source = 'promotional';
  v_found := coalesce(v_found, false);
  if not p_active or (p_expires_at is not null and p_expires_at <= now()) then
    delete from public.user_entitlements e where e.user_id = p_user and e.source = 'promotional';
    return case when v_found then 'removed' else 'unchanged' end;
  end if;
  if v_found and v_had is not distinct from p_expires_at then
    return 'unchanged';
  end if;
  insert into public.user_entitlements (user_id, kind, source, premium_source, expires_at)
  values (p_user, 'premium', 'promotional', 'promotional', p_expires_at)
  on conflict (user_id) where source = 'promotional'
  do update set expires_at = excluded.expires_at;
  return case when v_found then 'updated' else 'granted' end;
end $$;

revoke execute on function public.promotional_premium_sync_user(uuid, boolean, timestamptz)
  from public, anon, authenticated;

-- A deleted account: its purchases start their 30 days. Its RevenueCat customer is queued only
-- if its id went to RevenueCat; any other account's id must never reach RevenueCat.
create function public.user_deleted_purchases() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.purchases set user_deleted_at = now()
  where bound_user = old.id and user_deleted_at is null;
  delete from public.revenuecat_customers c where c.user_id = old.id;
  if found then
    insert into public.revenuecat_deletions (app_user_id, due_at)
    values (old.id, now() + interval '30 days')
    on conflict (app_user_id) do nothing;
  end if;
  return null;
end $$;

revoke execute on function public.user_deleted_purchases() from public, anon, authenticated;

create trigger users_deleted_purchases after delete on auth.users
  for each row execute function public.user_deleted_purchases();

create or replace function public.purge_purchases() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.households h
  where h.archived_at is not null and public.archive_deletes_at(h.archived_at) < now();
  insert into public.purchase_tombstones (transaction_hmac)
  select p.transaction_hmac from public.purchases p
  where (p.household_deleted_at < now() - interval '30 days'
         or p.user_deleted_at < now() - interval '30 days'
         or (p.bound_household = '00000000-0000-0000-0000-000000000000' and p.environment = 'Sandbox'
             and p.verified_at < now() - interval '30 days'))
    and p.transaction_hmac is not null
  on conflict do nothing;
  delete from public.purchases p where p.household_deleted_at < now() - interval '30 days';
  delete from public.purchases p where p.user_deleted_at < now() - interval '30 days';
  delete from public.purchases p
  where p.bound_household = '00000000-0000-0000-0000-000000000000' and p.environment = 'Sandbox'
    and p.verified_at < now() - interval '30 days';
  -- Refunds of transactions never recorded for an owner (or after their purge): nothing to keep
  -- them for once the refund window is over.
  delete from public.purchases p
  where p.bound_household is null and p.bound_user is null and p.revoked_at < now() - interval '30 days';
  delete from public.revenuecat_events e where e.received_at < now() - interval '90 days';
  delete from public.purchase_claims c where c.claimed_at < now() - interval '30 days';
  delete from public.household_departures d where d.left_at < now() - interval '1 hour';
  delete from public.households h where h.archived_at is not null and h.archived_by is null;
end $$;

-- Reads ---------------------------------------------------------------------------------------------

-- Same keys as before. A yearly plan bound to the caller counts in every household they open;
-- elsewhere and household_billed stay about household-bound plans.
create or replace function public.my_yearly_plan(p_household uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with mine as (
    select p.bound_household, p.bound_user, p.billing_issue, p.expires_at, p.auto_renew
    from public.purchases p
    where p.user_id = auth.uid() and p.plan = 'yearly' and p.revoked_at is null
      and p.expires_at > now()
  ), here as (
    select m.household_id from public.household_members m
    where m.user_id = auth.uid()
      and m.household_id = coalesce(p_household, public.default_household_of(auth.uid()))
  ), counted as (
    select * from mine
    where bound_user = auth.uid() or bound_household in (select household_id from here)
  )
  select jsonb_build_object(
    'subscriber', exists (select from counted),
    'renewing', exists (select from counted where auto_renew),
    'billing_issue', exists (select from counted where billing_issue),
    'until', (select max(expires_at) from counted),
    'elsewhere', exists (
      select from mine
      where auto_renew and bound_user is null
        and bound_household is distinct from (select household_id from here)
    ),
    'household_billed', exists (
      select from public.purchases p
      where p.bound_household in (select household_id from here) and p.plan = 'yearly'
        and p.revoked_at is null and p.expires_at > now() and p.auto_renew
    )
  )
$$;

-- The integration gate also opens for [p_user]'s own premium. Siri, MCP and the API pass the
-- caller; the two-argument form stays for function deploys that still call it.
create function public.integration_gate(p_household uuid, p_integration text, p_user uuid)
returns table (locked boolean, report boolean)
language plpgsql security definer set search_path = '' as $$
begin
  if p_integration not in ('siri', 'alexa', 'mcp', 'api') then
    raise exception 'unknown integration %', p_integration using errcode = '22023';
  end if;
  if p_integration = 'alexa'
    or not public.app_switch('integration_lock')
    or public.household_has_premium(p_household)
    or public.user_has_premium(p_user) then
    return query select false, false;
    return;
  end if;
  return query
    insert into public.integration_blocks as b (household_id, integration, reported_at)
    values (p_household, p_integration, now())
    on conflict (household_id, integration) do update set reported_at = now()
      where b.reported_at <= now() - interval '1 hour'
    returning true, true;
  if not found then
    return query select true, false;
  end if;
end $$;

revoke execute on function public.integration_gate(uuid, text, uuid) from public, anon, authenticated;

create or replace function public.integration_gate(p_household uuid, p_integration text)
returns table (locked boolean, report boolean)
language sql security definer set search_path = '' as $$
  select g.locked, g.report from public.integration_gate(p_household, p_integration, null) g
$$;
