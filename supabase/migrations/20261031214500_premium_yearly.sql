-- Job 49: Hummlist Premium, sold as a yearly subscription and as Lifetime under one entitlement,
-- premium (Peter, Spec #4, 2026-10-31; DECISIONS "Job 49"; docs/PURCHASES.md).
--   * The kind both products unlock is premium (was lifetime). Old rows are migrated; a later
--     running-cost entitlement adds its own kind to the checks.
--   * A purchase has a plan: yearly (com.hummlist.app.yearly) or lifetime. A yearly row keeps the
--     subscription's state from RevenueCat's lifecycle events: when the paid period (or the grace
--     period of a billing problem) ends, whether it renews, whether a billing problem is open, and
--     the time of the newest event applied, so an older event never overwrites a newer state.
--   * Premium is active at read time: a lifetime or tester grant row, or a yearly row whose end lies
--     ahead. No cron decides it, so a missed EXPIRATION never leaves premium on, and expiry deletes
--     nothing. household_premium()/household_has_premium() are the one server-side check.
--   * Members read their rows' premium_source, expires_at and auto_renew (H-55 column grants);
--     only the subscriber learns of a billing problem (my_yearly_plan(), H-87).
--   * app_switches.premium_offer (seeded off) hides every purchase offer in the app.

-- The kind: lifetime -> premium -------------------------------------------------------------------

alter table public.purchases drop constraint purchases_kind;
alter table public.entitlements drop constraint entitlements_kind;
update public.purchases set kind = 'premium' where kind = 'lifetime';
update public.entitlements set kind = 'premium' where kind = 'lifetime';
alter table public.purchases alter column kind set default 'premium';
alter table public.entitlements alter column kind set default 'premium';
-- squawk-ignore constraint-missing-not-valid -- every row was just set to premium; a few sandbox rows
alter table public.purchases add constraint purchases_kind check (kind in ('premium'));
-- squawk-ignore constraint-missing-not-valid -- every row was just set to premium; a few sandbox rows
alter table public.entitlements add constraint entitlements_kind check (kind in ('premium'));

comment on column public.purchases.kind is
  'Job 49: what the purchase unlocks: premium (both products). A later separate entitlement adds its kind here.';
comment on column public.entitlements.kind is
  'Job 49: what the row unlocks: premium. The app asks for a kind (Entitlement.premium), never for any row.';

-- The plan and the subscription's state, per purchase (service connection only) ------------------

alter table public.purchases add column plan text not null default 'lifetime'
  constraint purchases_plan check (plan in ('yearly', 'lifetime'));
-- Yearly: when premium from this purchase ends (the paid period, or the grace period while a
-- billing problem is open). Null for lifetime, which never ends.
alter table public.purchases add column expires_at timestamptz;
-- Yearly: renews at expires_at (auto-renew on). Null for lifetime.
alter table public.purchases add column auto_renew boolean;
-- Yearly: the store could not charge the renewal; expires_at is then the grace period's end.
alter table public.purchases add column billing_issue boolean not null default false;
-- event_timestamp_ms of the newest RevenueCat event applied to this row.
alter table public.purchases add column state_at timestamptz;
-- squawk-ignore constraint-missing-not-valid -- the columns are new: every row is lifetime with nulls
alter table public.purchases add constraint purchases_plan_state check (
  case plan
    when 'lifetime' then expires_at is null and auto_renew is null and not billing_issue
    else true
  end
);

comment on column public.purchases.plan is
  'Job 49: yearly (auto-renewing subscription) or lifetime (one-time), from the product id.';
comment on column public.purchases.expires_at is
  'Job 49: yearly only: premium from this purchase ends here (period end, or grace end with billing_issue). Active is computed at read time.';

-- What members read, per unlock row --------------------------------------------------------------

alter table public.entitlements add column premium_source text not null default 'lifetime'
  constraint entitlements_premium_source check (premium_source in ('yearly', 'lifetime', 'tester_grant'));
update public.entitlements set premium_source = 'tester_grant' where source = 'tester';
alter table public.entitlements alter column premium_source drop default;
alter table public.entitlements add column expires_at timestamptz;
alter table public.entitlements add column auto_renew boolean;
-- squawk-ignore constraint-missing-not-valid -- the columns are new and the update above set them
alter table public.entitlements add constraint entitlements_premium_columns check (
  (source = 'tester') = (premium_source = 'tester_grant')
  and (premium_source = 'yearly') = (expires_at is not null)
  and (premium_source = 'yearly' or auto_renew is null)
);

comment on column public.entitlements.premium_source is
  'Job 49: yearly, lifetime or tester_grant. Members read it; the effective one is household_premium().';
comment on column public.entitlements.expires_at is
  'Job 49: yearly only: premium from this row ends here. Members read it; the row stays after it.';

grant select (premium_source, expires_at, auto_renew) on public.entitlements to authenticated;

create index entitlements_household_premium on public.entitlements (household_id, premium_source);

-- The effective premium (one rule, at read time) ---------------------------------------------------

-- [p_household]'s premium now: source lifetime or tester_grant (no end, wins over yearly), else
-- yearly with the latest end of its active yearly rows, else no row (no premium). Archived
-- households count like any other. The check integration gating calls (Spec #4); it never deletes
-- or changes anything.
create function public.household_premium(p_household uuid)
returns table (source text, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  (select e.premium_source, null::timestamptz
   from public.entitlements e
   where e.household_id = p_household and e.kind = 'premium'
     and e.premium_source in ('lifetime', 'tester_grant')
   order by e.premium_source = 'lifetime' desc
   limit 1)
  union all
  select 'yearly', max(e.expires_at)
  from public.entitlements e
  where e.household_id = p_household and e.kind = 'premium'
    and e.premium_source = 'yearly' and e.expires_at > now()
    and not exists (
      select from public.entitlements l
      where l.household_id = p_household and l.kind = 'premium'
        and l.premium_source in ('lifetime', 'tester_grant')
    )
  having max(e.expires_at) is not null
$$;

create function public.household_has_premium(p_household uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select from public.household_premium(p_household))
$$;

revoke execute on function public.household_premium(uuid) from public, anon, authenticated;
revoke execute on function public.household_has_premium(uuid) from public, anon, authenticated;

-- A purchase's unlock row mirrors its purchase -------------------------------------------------

-- Writes [v_row]'s unlock in its bound household (if that exists and the purchase is not
-- refunded), or brings an existing one up to date. The one place an entitlements row of a
-- purchase is written.
create function public.purchase_entitlement_sync(p_purchase uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.purchases;
begin
  select * into v_row from public.purchases p where p.id = p_purchase;
  if v_row.id is null or v_row.revoked_at is not null then
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

revoke execute on function public.purchase_entitlement_sync(uuid) from public, anon, authenticated;

-- Applies a subscription state RevenueCat reported at [p_event_at] to purchase [p_purchase],
-- unless a newer event was applied already (out-of-order delivery). Null arguments keep what is
-- stored. True if the state changed.
create function public.purchase_state_apply(
  p_purchase uuid,
  p_event_at timestamptz,
  p_expires_at timestamptz,
  p_auto_renew boolean,
  p_billing_issue boolean
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.purchases;
begin
  update public.purchases p
  set expires_at = coalesce(p_expires_at, p.expires_at),
      auto_renew = coalesce(p_auto_renew, p.auto_renew),
      billing_issue = coalesce(p_billing_issue, p.billing_issue),
      state_at = p_event_at
  where p.id = p_purchase and p.plan = 'yearly'
    and (p.state_at is null or p.state_at <= p_event_at)
  returning * into v_row;
  if v_row.id is null then
    return false;
  end if;
  perform public.purchase_entitlement_sync(v_row.id);
  return true;
end $$;

revoke execute on function public.purchase_state_apply(uuid, timestamptz, timestamptz, boolean, boolean)
  from public, anon, authenticated;

-- Recording a purchase (RevenueCat's webhook) ------------------------------------------------------

-- Job 43's purchase_record with the plan and the subscription's state. The old signature goes: only
-- the purchases function called it (service connection), and it would write the old kind.
-- squawk-ignore ban-drop-function -- service connection only, its one caller (the purchases function) ships with this migration
drop function public.purchase_record(text, text, text, text, text, text, text, timestamptz, numeric, text, text, uuid);

-- Records a store transaction RevenueCat reports for household [p_household] (its App User ID) and
-- unlocks the household. Safe to call again with the same transaction: a renewal or a resubscribe
-- under the same original transaction updates the yearly state (only if [p_event_at] is newer).
-- Outcomes and answer as job 43's, plus second_yearly: a yearly purchase recorded while the
-- household already had an active yearly plan (it is kept as its own row, never merged).
create function public.purchase_record(
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

  v_internal := exists (select from public.entitlements e where e.household_id = p_household and e.source = 'tester')
    or exists (select from public.lifetime_testers t where t.user_id = v_row.user_id);
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
    'internal', v_internal or exists (select from public.lifetime_testers t where t.user_id = v_row.user_id),
    'buyer', v_row.user_id, 'send_completed', v_send, 'plan', v_row.plan);
end $$;

revoke execute on function public.purchase_record(text, text, text, text, text, text, text, text, timestamptz,
  numeric, text, text, uuid, timestamptz, timestamptz, boolean, boolean) from public, anon, authenticated;

-- A lifecycle event for a known yearly transaction (cancellation without refund, uncancellation,
-- billing issue, expiration, extension, pause): applies its state if it is newer. {outcome}:
-- updated, stale (a newer event was applied), unknown (no such transaction: nothing written,
-- nothing granted), lifetime (not a subscription: nothing to change), revoked.
create function public.purchase_lifecycle(
  p_store text,
  p_transaction text,
  p_event_at timestamptz,
  p_expires_at timestamptz,
  p_auto_renew boolean,
  p_billing_issue boolean
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.purchases;
begin
  select * into v_row from public.purchases p
  where p.store = p_store and p.transaction_id = p_transaction for update;
  if v_row.id is null then
    return jsonb_build_object('outcome', 'unknown');
  elsif v_row.plan <> 'yearly' then
    return jsonb_build_object('outcome', 'lifetime');
  elsif v_row.revoked_at is not null then
    return jsonb_build_object('outcome', 'revoked');
  end if;
  return jsonb_build_object('outcome', case
    when public.purchase_state_apply(v_row.id, p_event_at, p_expires_at, p_auto_renew, p_billing_issue)
    then 'updated' else 'stale' end);
end $$;

revoke execute on function public.purchase_lifecycle(text, text, timestamptz, timestamptz, boolean, boolean)
  from public, anon, authenticated;

-- Revoke: job 43's, plus the plan, which a refund of a transaction never recorded keeps, and which
-- purchase_refunded reports as premium_source. The old signature goes (service connection only).
-- squawk-ignore ban-drop-function -- service connection only, its one caller (the purchases function) ships with this migration
drop function public.purchase_revoke(text, text, timestamptz, text, text, timestamptz);

create function public.purchase_revoke(
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
    'internal', exists (select from public.lifetime_testers t where t.user_id = v_row.user_id)
      or exists (select from public.entitlements e where e.household_id = v_household and e.source = 'tester')
  );
end $$;

revoke execute on function public.purchase_revoke(text, text, timestamptz, text, text, text, timestamptz)
  from public, anon, authenticated;

-- RevenueCat's REFUND_REVERSED: the purchase stands again and unlocks its household again (with its
-- stored yearly state), if that still exists. True if it changed.
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
  perform public.purchase_entitlement_sync(v_row.id);
  return true;
end $$;

-- The buyer's claim: job 47's, plus the plan for purchase_completed's premium_source.
create or replace function public.purchase_claim(p_user uuid, p_household uuid, p_store text, p_transaction text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.purchases;
begin
  if not exists (
    select from public.household_members m where m.user_id = p_user and m.household_id = p_household
  ) and not exists (
    select from public.household_departures d
    where d.user_id = p_user and d.household_id = p_household and d.left_at >= now() - interval '1 hour'
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
  if not public.was_member_at(p_user, p_household, v_row.purchased_at) then
    raise exception 'not_a_member' using errcode = '42501';
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
      'plan', v_row.plan,
      'environment', v_row.environment, 'price', v_row.price, 'currency', v_row.currency,
      'country', v_row.country, 'household_id', v_row.bound_household,
      'internal', exists (select from public.lifetime_testers t where t.user_id = p_user)
        or exists (select from public.entitlements e where e.household_id = p_household and e.source = 'tester')));
  end if;
  return jsonb_build_object('status', 'recorded', 'send_completed', false);
end $$;


-- Testers: a grant needs a household without lasting premium -------------------------------------

-- Job 43's, but "has Lifetime" is now "has a lifetime or tester row": a household with only a
-- yearly plan gets the grant (it wins over yearly and never ends).
create or replace function public.tester_grant_apply(p_user uuid, p_household uuid) returns boolean
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
     or exists (
       select from public.entitlements e
       where e.household_id = p_household and e.kind = 'premium'
         and e.premium_source in ('lifetime', 'tester_grant')
     )
  then
    return false;
  end if;
  insert into public.entitlements (household_id, kind, source, premium_source, tester, granted_by)
  values (p_household, 'premium', 'tester', 'tester_grant', p_user, p_user)
  on conflict (tester, household_id) do nothing;
  if not found then
    return false;
  end if;
  update public.lifetime_testers set used = used + 1 where user_id = p_user;
  return true;
end $$;

-- "Unlocked" is "has premium now" everywhere it was "has a lifetime row" ---------------------------

-- Leaving: job 47's, with household_has_premium for "unlocked": the last member may archive a
-- household whose premium is active (any source; an archived household's yearly plan keeps being
-- billed until it is cancelled, and premium ends at its expiry while the archive stays).
create or replace function public.leave_current_household(p_archive boolean) returns text
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
  if p_archive and public.household_has_premium(v_household) then
    if not public.app_switch('household_archive') then
      raise exception 'archive_disabled'
        using hint = 'Archiving households is switched off on this server (app_switches).';
    end if;
    update public.households set archived_at = now(), archived_by = auth.uid() where id = v_household;
    return 'archived';
  end if;
  delete from public.households where id = v_household;
  return 'deleted';
end $$;

-- Job 47's, with household_has_premium for "unlocked".
create or replace function public.archived_households() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', h.id,
    'name', h.name,
    'archived_at', h.archived_at,
    'deletes_at', public.archive_deletes_at(h.archived_at),
    'unlocked', public.household_has_premium(h.id)
  ) order by h.archived_at desc, h.id), '[]'::jsonb)
  from public.households h
  where h.archived_by = auth.uid() and h.archived_at is not null
$$;

-- Job 43's, with household_has_premium for "unlocked".
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
    'unlocked', public.household_has_premium(v_check.household_id)
  ) || case when v_check.status = 'ok' then jsonb_build_object(
    'leaves_unlocked', v_current is not null
      and not exists (
        select from public.household_members m where m.household_id = v_current and m.user_id <> v_user
      )
      and public.household_has_premium(v_current),
    'recent_purchase', exists (
      select from public.purchases p
      where p.user_id = v_user and p.revoked_at is null
        and p.purchased_at > now() - interval '30 days'
    )
  ) else '{}'::jsonb end;
end $$;

-- The subscriber's own view (H-83, H-85, H-87) -----------------------------------------------------

-- The caller's active yearly plans, as only they may know them: whether they took out an active
-- yearly plan for their current household (subscriber), whether its renewal failed (billing_issue,
-- with the grace end in until), and whether they pay an active, renewing yearly plan for any other
-- household (archived, left or deleted), which deleting the account doesn't cancel. Plus whether
-- their household has a renewing yearly plan at all (household_billed), which every member may
-- know (the rows say so too); asked here so a warning never waits for Realtime. Never names a
-- household or another person.
create function public.my_yearly_plan() returns jsonb
language sql stable security definer set search_path = '' as $$
  with mine as (
    select p.bound_household, p.billing_issue, p.expires_at, p.auto_renew
    from public.purchases p
    where p.user_id = auth.uid() and p.plan = 'yearly' and p.revoked_at is null
      and p.expires_at > now()
  ), here as (
    select m.household_id from public.household_members m where m.user_id = auth.uid()
  )
  select jsonb_build_object(
    'subscriber', exists (select from mine where bound_household in (select household_id from here)),
    'renewing', exists (
      select from mine where bound_household in (select household_id from here) and auto_renew
    ),
    'billing_issue', exists (
      select from mine where bound_household in (select household_id from here) and billing_issue
    ),
    'until', (select max(expires_at) from mine where bound_household in (select household_id from here)),
    'elsewhere', exists (
      select from mine
      where auto_renew and bound_household is distinct from (select household_id from here)
    ),
    'household_billed', exists (
      select from public.purchases p
      where p.bound_household in (select household_id from here) and p.plan = 'yearly'
        and p.revoked_at is null and p.expires_at > now() and p.auto_renew
    )
  )
$$;

revoke execute on function public.my_yearly_plan() from public, anon;
grant execute on function public.my_yearly_plan() to authenticated;

-- The purchase offer's server switch (A2-5) --------------------------------------------------------

insert into public.app_switches (key, enabled) values ('premium_offer', false);

comment on table public.app_switches is
  'Job 47: server-side switches, set by the service role only (NEEDS_LEAD "Job 47", "Job 49"). household_archive: archiving a household on the last leave is allowed. premium_offer (job 49): the app may offer Hummlist Premium for sale.';

-- Whether the app may offer Hummlist Premium for sale. The only switch a client reads; off (or
-- unreadable) hides every purchase offer.
create function public.premium_offer() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.app_switch('premium_offer')
$$;

revoke execute on function public.premium_offer() from public, anon;
grant execute on function public.premium_offer() to authenticated;

-- Data export ------------------------------------------------------------------------------------
-- Job 43's body; each purchase also names its plan, and a yearly one its end and renewal (GDPR
-- Art. 15). The additions keep version 1.
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
        'plan', p.plan,
        'transaction_id', p.transaction_id,
        'environment', p.environment,
        'purchased_at', p.purchased_at,
        'expires_at', p.expires_at,
        'auto_renew', p.auto_renew,
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
