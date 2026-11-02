-- Job 67: a yearly plan keeps its grace period, and renews where it is bound.
--
-- RevenueCat sends CANCELLATION (cancel_reason BILLING_ERROR) next to BILLING_ISSUE, in any order;
-- only BILLING_ISSUE carries the grace period's end, CANCELLATION the paid period's (already past).
-- While the stored plan has a billing issue, an event that says nothing about billing never moves
-- its end earlier; EXPIRATION (billing_issue false) and RENEWAL still set it.
create or replace function public.purchase_state_apply(
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
  set expires_at = case when p.billing_issue and p_billing_issue is null
                        then greatest(p.expires_at, p_expires_at)
                        else coalesce(p_expires_at, p.expires_at) end,
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

-- 20261101150000's purchase_record, except that a known yearly plan bound to another existing
-- household takes the event's newer state there before the answer used_elsewhere (a RENEWAL after
-- a TRANSFER would otherwise end the paid plan at its old period's end). Signature unchanged.
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
  if v_row.bound_household is null then
    -- Recorded as refunded before it was ever granted (purchase_revoke); the first grant binds it.
    update public.purchases set bound_household = p_household where id = v_row.id;
    v_row.bound_household := p_household;
  end if;
  if v_row.bound_household <> p_household then
    -- A renewal under another App User ID (TRANSFER, an App User ID drift) is still the plan's: its
    -- newer state applies where it is bound, and nothing is granted here.
    if v_row.plan = 'yearly' and exists (select from public.households h where h.id = v_row.bound_household) then
      perform public.purchase_state_apply(v_row.id, p_event_at, p_expires_at, coalesce(p_auto_renew, true),
                                          coalesce(p_billing_issue, false));
    end if;
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
    'internal', v_internal,
    'buyer', v_row.user_id, 'send_completed', v_send, 'plan', v_row.plan);
end $$;

revoke execute on function public.purchase_record(text, text, text, text, text, text, text, text, timestamptz,
  numeric, text, text, uuid, timestamptz, timestamptz, boolean, boolean) from public, anon, authenticated;
