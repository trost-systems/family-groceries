-- RevenueCat promotional grants count as Hummlist Premium (Peter, Nov 1; docs/PURCHASES.md,
-- "Free premium: RevenueCat promotional grants").
--
-- A grant of the premium entitlement in the RevenueCat dashboard, or through API v2
-- grant_entitlement, to the customer whose App User ID is a household id unlocks that household
-- for exactly as long as RevenueCat grants it. The purchases function stores it on every
-- PROMOTIONAL webhook event, and Ops on demand (POST /purchases/revenuecat/reconcile), by reading
-- the customer's current state from RevenueCat's API, never from the event's payload:
--   * one entitlements row per household, source and premium_source 'promotional', expires_at
--     the grant's end (null: no end, a lifetime grant);
--   * the row is deleted when RevenueCat no longer grants it (revoked, or ended);
--   * no purchases row: a grant is no sale.
-- Only the service connection writes it (promotional_premium_sync); members read it like any
-- unlock row (RLS entitlements_select, the column grants, Realtime). household_premium() counts it
-- while it runs, so every server-side check (app, Siri, Alexa, MCP, integration_gate) does.

-- The row ----------------------------------------------------------------------------------------

alter table public.entitlements drop constraint entitlements_source;
-- squawk-ignore constraint-missing-not-valid -- widens the check: every row passes
alter table public.entitlements add constraint entitlements_source
  check (source in ('purchase', 'tester', 'promotional'));
alter table public.entitlements drop constraint entitlements_premium_source;
-- squawk-ignore constraint-missing-not-valid -- widens the check: every row passes
alter table public.entitlements add constraint entitlements_premium_source
  check (premium_source in ('yearly', 'lifetime', 'tester_grant', 'promotional'));
alter table public.entitlements drop constraint entitlements_premium_columns;
-- squawk-ignore constraint-missing-not-valid -- the old rule for every old row; promotional is new
alter table public.entitlements add constraint entitlements_premium_columns check (
  (source = 'tester') = (premium_source = 'tester_grant')
  and (source = 'promotional') = (premium_source = 'promotional')
  -- yearly always ends; lifetime and tester grants never; a promotional grant may (null: no end).
  and (premium_source <> 'yearly' or expires_at is not null)
  and (premium_source in ('yearly', 'promotional') or expires_at is null)
  and (premium_source = 'yearly' or auto_renew is null)
  and (source <> 'promotional' or (tester is null and store is null and product_id is null
                                   and environment is null))
);

-- One promotional row per household: RevenueCat's grants for it, merged.
create unique index entitlements_promotional on public.entitlements (household_id)
  where source = 'promotional';

comment on column public.entitlements.source is
  'purchase (purchase_id), tester (a tester''s free grant) or promotional (RevenueCat promotional grant, read from its API). All stay with the household.';
comment on column public.entitlements.premium_source is
  'yearly, lifetime, tester_grant or promotional. Members read it; the effective one is household_premium().';
comment on column public.entitlements.expires_at is
  'yearly: premium from this row ends here; promotional: the grant ends here (null: no end). Members read it.';

-- The effective premium (one rule, at read time) -------------------------------------------------

-- [p_household]'s premium now. Lasting first: lifetime, then a tester grant, then a promotional
-- grant without end. Else the active row (yearly or promotional, expires_at > now()) that ends
-- last, with its source and end. Else no row. Signature, callers and grants unchanged.
create or replace function public.household_premium(p_household uuid)
returns table (source text, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with lasting as (
    select e.premium_source
    from public.entitlements e
    where e.household_id = p_household and e.kind = 'premium'
      and (e.premium_source in ('lifetime', 'tester_grant')
           or (e.premium_source = 'promotional' and e.expires_at is null))
    order by case e.premium_source when 'lifetime' then 0 when 'tester_grant' then 1 else 2 end
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

-- The one writer ---------------------------------------------------------------------------------

-- Stores [p_household]'s promotional premium as RevenueCat has it now: active until
-- [p_expires_at] (null: no end) upserts the one row, anything else deletes it. Takes the
-- household's lock (as purchase_record does). Returns granted, updated, unchanged, removed or
-- no_household (deleted, or never one: nothing is stored). The purchases function's service
-- connection only.
create function public.promotional_premium_sync(
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

revoke execute on function public.promotional_premium_sync(uuid, boolean, timestamptz)
  from public, anon, authenticated;
