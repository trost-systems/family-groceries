-- Testers get Hummlist Premium through RevenueCat promotional grants; the custom tester grants go
-- (Peter, Nov 1: "use revenuecat to handle tester's premium grants instead of the custom code";
-- docs/PURCHASES.md "Testers").
--
-- A tester's household gets a RevenueCat promotional grant of premium (scripts/iap/promotional.ts
-- grant), which 20261101143000_revenuecat_promotional.sql stores as its promotional row. What goes:
--   * public.lifetime_testers, the triggers lifetime_testers_grant, household_members_tester_grant
--     and lifetime_testers_removed, the functions tester_grant_apply, tester_grant_trigger and
--     lifetime_tester_removed, and scripts/iap/testers.ts;
--   * entitlements rows with source 'tester' and the column entitlements.tester. A tester row is
--     deleted only in a household that has its promotional row; any other aborts this migration,
--     so no household loses premium (production had none on 2026-11-01);
--   * the export's lifetime_tester section (the list is gone).
-- What stays: analytics' internal mark. A household with a promotional row is internal
-- (household_internal), as a household with a tester grant was; purchase_record, purchase_revoke
-- and purchase_claim report it. A tester's purchase in a household without a grant is no longer
-- internal: RevenueCat knows households, not people.

-- Old tester rows: only where the promotional row is there -----------------------------------------

delete from public.entitlements t
where t.source = 'tester'
  and exists (select from public.entitlements p where p.household_id = t.household_id and p.source = 'promotional');

do $$
begin
  if exists (select from public.entitlements e where e.source = 'tester') then
    raise exception 'tester grants without a RevenueCat promotional grant: grant them first (docs/PURCHASES.md "Testers")';
  end if;
end $$;

-- The custom grants --------------------------------------------------------------------------------

drop trigger lifetime_testers_grant on public.lifetime_testers;
drop trigger lifetime_testers_removed on public.lifetime_testers;
drop trigger household_members_tester_grant on public.household_members;
-- squawk-ignore ban-drop-function -- service connection and triggers only; no caller is left
drop function public.tester_grant_trigger();
-- squawk-ignore ban-drop-function -- service connection and triggers only; no caller is left
drop function public.lifetime_tester_removed();
-- squawk-ignore ban-drop-function -- service connection and triggers only; no caller is left
drop function public.tester_grant_apply(uuid, uuid);
-- squawk-ignore ban-drop-table -- the tester list moves to RevenueCat; nothing reads it any more
drop table public.lifetime_testers;

-- The row ------------------------------------------------------------------------------------------

alter table public.entitlements drop constraint entitlements_premium_columns;
alter table public.entitlements drop constraint entitlements_source_columns;
alter table public.entitlements drop constraint entitlements_source;
alter table public.entitlements drop constraint entitlements_premium_source;
-- squawk-ignore ban-drop-column -- members never had it (column grants), the service writes it no more
alter table public.entitlements drop column tester;
-- squawk-ignore constraint-missing-not-valid -- narrows to what is left: every row passes (checked above)
alter table public.entitlements add constraint entitlements_source
  check (source in ('purchase', 'promotional'));
-- squawk-ignore constraint-missing-not-valid -- narrows to what is left: every row passes (checked above)
alter table public.entitlements add constraint entitlements_premium_source
  check (premium_source in ('yearly', 'lifetime', 'promotional'));
-- squawk-ignore constraint-missing-not-valid -- job 43's rule without the tester column
alter table public.entitlements add constraint entitlements_source_columns check (
  case source
    when 'purchase' then purchase_id is not null and product_id is not null and store is not null
                         and environment is not null
    else purchase_id is null
  end
);
-- squawk-ignore constraint-missing-not-valid -- 20261101143000's rule without the tester grant
alter table public.entitlements add constraint entitlements_premium_columns check (
  (source = 'promotional') = (premium_source = 'promotional')
  -- yearly always ends; lifetime never; a promotional grant may (null: no end).
  and (premium_source <> 'yearly' or expires_at is not null)
  and (premium_source in ('yearly', 'promotional') or expires_at is null)
  and (premium_source = 'yearly' or auto_renew is null)
  and (source <> 'promotional' or (store is null and product_id is null and environment is null))
);

comment on column public.entitlements.source is
  'purchase (purchase_id) or promotional (RevenueCat promotional grant, read from its API; testers, reviewers). Both stay with the household.';
comment on column public.entitlements.premium_source is
  'yearly, lifetime or promotional. Members read it; the effective one is household_premium().';

-- The effective premium ------------------------------------------------------------------------------

-- [p_household]'s premium now: lifetime, then a promotional grant without end; else the active
-- row (yearly or promotional) that ends last. Signature, callers and grants unchanged.
create or replace function public.household_premium(p_household uuid)
returns table (source text, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with lasting as (
    select e.premium_source
    from public.entitlements e
    where e.household_id = p_household and e.kind = 'premium'
      and (e.premium_source = 'lifetime'
           or (e.premium_source = 'promotional' and e.expires_at is null))
    order by e.premium_source = 'lifetime' desc
    limit 1
  )
  select l.premium_source, null::timestamptz from lasting l
  union all
  (select e.premium_source, e.expires_at
   from public.entitlements e
   where e.household_id = p_household and e.kind = 'premium'
     and e.premium_source in ('yearly', 'promotional') and e.expires_at > now()
     and not exists (select from lasting)
   -- On a tie the yearly plan names it: it is the one with a renewal and a store.
   order by e.expires_at desc, e.premium_source = 'yearly' desc
   limit 1)
$$;

revoke execute on function public.household_premium(uuid) from public, anon, authenticated;

-- Analytics' internal mark ----------------------------------------------------------------------------

-- True if [p_household] has a promotional grant (testers, App and Play Review): its purchases and
-- refunds are internal for analytics (docs/ANALYTICS.md), as a tester grant's household was.
create function public.household_internal(p_household uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select from public.entitlements e where e.household_id = p_household and e.source = 'promotional'
  )
$$;

revoke execute on function public.household_internal(uuid) from public, anon, authenticated;

-- 20261031214500's purchase_record, purchase_revoke and purchase_claim, with household_internal as
-- the internal mark (no lifetime_testers). Signatures and grants unchanged.

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
    'internal', public.household_internal(v_household)
  );
end $$;

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
      'internal', public.household_internal(p_household)));
  end if;
  return jsonb_build_object('status', 'recorded', 'send_completed', false);
end $$;

-- 20261101123500's export_my_data without the lifetime_tester section (the list is gone).
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
        'decided_at', a.decided_at,
        'consent_text_version', a.consent_text_version
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
    'archived_households', coalesce((
      select jsonb_agg(jsonb_build_object('id', h.id, 'name', h.name, 'archived_at', h.archived_at)
        order by h.archived_at, h.id)
      from public.households h where h.archived_by = v_user
    ), '[]'::jsonb)
  );
end $$;
