-- Job 211: RevenueCat customer deletions only for ids RevenueCat has, and none lost to a race.
--
-- * Households: a deleted household was queued for deletion at RevenueCat unconditionally (job 43:
--   opening the purchase page created the customer then). Since job 185 builds give RevenueCat the
--   user id, and no store build ever had REVENUECAT_PURCHASES, so RevenueCat knows a household id
--   only from a purchase or a promotional grant it reported to the webhook. Those are noted in
--   revenuecat_households, as revenuecat_customers notes accounts, and only noted households are
--   queued when deleted.
-- * Accounts: a note racing the account's deletion (the webhook, or the app right before Buy) could
--   commit after the deletion trigger looked for it: the customer stayed, never queued. A note, and
--   the webhook's user paths before they write, now take a key share lock on the account first, so
--   the deletion waits for them, or they wait for the deletion and then queue the gone account
--   themselves.

-- Households known to RevenueCat -------------------------------------------------------------------

-- No foreign key, like revenuecat_customers: the deletion trigger reads the row after the household
-- is gone.
create table public.revenuecat_households (
  -- RevenueCat's App User ID: a household id it reported a purchase or a promotional grant for.
  app_user_id uuid primary key,
  noted_at timestamptz not null default now()
);

comment on table public.revenuecat_households is
  'Job 211: households RevenueCat reported to the webhook (a purchase or a promotional grant on the household id as App User ID, older builds and Ops). Only these are queued in revenuecat_deletions when the household is deleted. Service connection only.';

alter table public.revenuecat_households enable row level security;
revoke all on public.revenuecat_households from anon, authenticated;

-- What RevenueCat reported before this migration.
insert into public.revenuecat_households (app_user_id)
select p.bound_household from public.purchases p
where exists (select from public.households h where h.id = p.bound_household)
union
select e.household_id from public.entitlements e where e.source = 'promotional'
on conflict (app_user_id) do nothing;

-- Callers hold the household's row lock (for no key update), so its deletion waits for them.
create function public.note_revenuecat_household(p_household uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.revenuecat_households (app_user_id) values (p_household)
  on conflict (app_user_id) do nothing
$$;

revoke execute on function public.note_revenuecat_household(uuid) from public, anon, authenticated;

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
  if found then
    perform public.note_revenuecat_household(p_household);
  end if;
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

create or replace function public.promotional_premium_sync(
  p_household uuid,
  p_active boolean,
  p_expires_at timestamptz
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_had timestamptz;
  v_found boolean;
begin
  perform from public.households h where h.id = p_household for no key update;
  if not found then
    return 'no_household';
  end if;
  perform public.note_revenuecat_household(p_household);
  select true, e.expires_at into v_found, v_had
  from public.entitlements e
  where e.household_id = p_household and e.source = 'promotional';
  v_found := coalesce(v_found, false);
  if not p_active or (p_expires_at is not null and p_expires_at <= now()) then
    delete from public.entitlements e where e.household_id = p_household and e.source = 'promotional';
    return case when v_found then 'removed' else 'unchanged' end;
  end if;
  if v_found and v_had is not distinct from p_expires_at then
    return 'unchanged';
  end if;
  insert into public.entitlements (household_id, kind, source, premium_source, expires_at)
  values (p_household, 'premium', 'promotional', 'promotional', p_expires_at)
  on conflict (household_id) where source = 'promotional'
  do update set expires_at = excluded.expires_at;
  return case when v_found then 'updated' else 'granted' end;
end $$;

-- A deleted household: its purchases start their 30 days; its RevenueCat customer is queued only
-- if RevenueCat reported it.
create or replace function public.household_deleted_purchases() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.purchases set household_deleted_at = now()
  where bound_household = old.id and household_deleted_at is null;
  delete from public.revenuecat_households r where r.app_user_id = old.id;
  if found then
    insert into public.revenuecat_deletions (app_user_id, due_at)
    values (old.id, now() + interval '30 days')
    on conflict (app_user_id) do nothing;
  end if;
  return null;
end $$;

-- Accounts: a note serializes with the account's deletion ----------------------------------------

-- Takes a key share lock on account [p_user]: its deletion (delete_account, users_deleted_purchases)
-- needs the row, so it waits for the caller's transaction and then sees what it noted. False when
-- the account is gone, also after waiting for its deletion: RevenueCat named the id (or is about
-- to get it), so its customer is queued here, as the deletion trigger would have.
create function public.revenuecat_account_hold(p_user uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform from auth.users u where u.id = p_user for key share;
  if found then
    return true;
  end if;
  insert into public.revenuecat_deletions (app_user_id, due_at)
  values (p_user, now() + interval '30 days')
  on conflict (app_user_id) do nothing;
  return false;
end $$;

revoke execute on function public.revenuecat_account_hold(uuid) from public, anon, authenticated;

-- Every note: note_revenuecat_customer() (the app before Buy) and the webhook's.
create function public.revenuecat_customer_lock_account() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.revenuecat_account_hold(new.user_id) then
    return null;
  end if;
  return new;
end $$;

revoke execute on function public.revenuecat_customer_lock_account() from public, anon, authenticated;

create trigger revenuecat_customers_lock_account before insert on public.revenuecat_customers
  for each row execute function public.revenuecat_customer_lock_account();

-- The webhook's user paths hold the account before they write for it: an account deleted while the
-- event waited answers no_user (its customer queued) instead of failing on a foreign key, which
-- rolled the queueing back and left the retry nothing to queue.
create or replace function public.purchase_record_user(
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
  if not public.revenuecat_account_hold(p_user) and v_row.id is null then
    return jsonb_build_object('outcome', 'no_user');
  end if;
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

create or replace function public.promotional_premium_sync_user(
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
  if not public.revenuecat_account_hold(p_user) then
    return 'no_user';
  end if;
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

-- The account's deletion takes the webhook's per-user lock first, as every webhook user path does
-- before its row locks. Without it, an event under the user's id for their household's purchase
-- (a plan from before job 185, the user its last member) held the account (revenuecat_account_hold)
-- and waited for the purchase row, while the deletion held that row (household_deleted_purchases)
-- and waited for the account: a deadlock that aborted the deletion.
create or replace function public.delete_account(p_user uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_default uuid := public.default_household_of(p_user);
  v_household uuid;
  v_role text;
  v_this text;
  v_fate text := 'none';
begin
  perform public.purchase_user_lock(p_user);
  perform public.lock_memberships(p_user);
  -- The household row locks serialize with joins (their membership insert takes a key share lock
  -- on the household) and with another member deleting their account at once. Household id
  -- order, so two deletions sharing households lock them in the same order.
  for v_household, v_role in
    select h.id, m.role
    from public.households h
    join public.household_members m on m.household_id = h.id
    where m.user_id = p_user
    order by h.id
    for update of h
  loop
    if exists (
      select from public.household_members m
      where m.household_id = v_household and m.user_id <> p_user
    ) then
      v_this := 'kept';
      if v_role = 'owner' then
        perform public.hand_over_ownership(v_household, p_user);
      end if;
    else
      v_this := 'deleted';
      delete from public.households where id = v_household;
    end if;
    if v_household = v_default then
      v_fate := v_this;
    end if;
  end loop;

  -- Job 43: the households they archived have no one else to come back to them.
  delete from public.households where archived_by = p_user;
  update public.item_events set actor = null where actor = p_user;
  delete from auth.users where id = p_user;
  return v_fate;
end $$;
