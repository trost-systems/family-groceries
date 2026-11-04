-- Job 43b: free Hummlist Premium for every beta household (ADDENDUM 7 and 8, Legal Review N-50 to
-- N-58, Lead 2026-11-03 (a) to (e); docs/PURCHASES.md "Free premium in the beta").
--   * The purchases function grants each household's RevenueCat customer (App User ID = household id)
--     the premium entitlement as a promotional grant with a real end (BETA_PROMO_ENDS_AT, default
--     2027-12-31), server to server: RevenueCat gets the household id and the grant's dates, nothing
--     else. The grant then reaches entitlements like every promotional grant (reconcile).
--   * Off until the server switch beta_promo is on. While it is off nothing is queued and nothing
--     goes to RevenueCat; existing households are queued only by the backfill (beta_promo_backfill).
--   * A household that already has a promotional grant for good (testers, app review: until 2100)
--     is skipped: revoking the beta grant at launch would revoke theirs too.
--   * N-52: once a beta grant ends (its end, a revoke at launch, an objection), a household that
--     bought nothing gets its RevenueCat customer deleted 30 days later (an objection: at once).

insert into public.app_switches (key, enabled) values ('beta_promo', false) on conflict (key) do nothing;

comment on table public.app_switches is
  'Job 47: server-side switches, set by the service role only (NEEDS_LEAD "Job 47", "Job 49", "Job 50", "Job 43b"). household_archive: archiving a household on the last leave is allowed. premium_offer (job 49): the app may offer Hummlist Premium for sale. integration_lock (job 50): Siri, MCP and the API (job 73) need Hummlist Premium; Alexa stays free (job 72). public_api (job 75): the public API is served and API keys can be made. beta_promo (job 43b): every new household gets free Hummlist Premium in the beta (a RevenueCat promotional grant).';

-- One row per household the beta grant is for: queued, then granted (or skipped), then ended.
create table public.beta_promo_grants (
  -- Not household-owned data (no member reads it): the service's to-do list, gone with the household.
  beta_household uuid primary key references public.households (id) on delete cascade,
  queued_at timestamptz not null default now(),
  attempts integer not null default 0,
  last_attempt_at timestamptz,
  -- Granted at RevenueCat, ending then.
  granted_at timestamptz,
  ends_at timestamptz,
  -- Not granted: the household has a promotional grant for good already (testers, app review).
  skipped text check (skipped in ('tester')),
  -- The grant is over: its end passed, it was revoked at launch, or the household objected.
  ended_at timestamptz,
  objected_at timestamptz,
  check (granted_at is null or ends_at is not null),
  check (objected_at is null or ended_at is not null)
);

comment on table public.beta_promo_grants is
  'Job 43b: the free beta unlock per household (RevenueCat promotional grant): queued, granted until ends_at, ended. Service connection only.';

alter table public.beta_promo_grants enable row level security;
revoke all on public.beta_promo_grants from anon, authenticated;

-- Whether new households get the beta grant now.
create function public.beta_promo_on() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.app_switch('beta_promo')
$$;

-- A new household is queued while the switch is on; the function grants it on its next run.
create function public.beta_promo_enqueue() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.beta_promo_on() then
    insert into public.beta_promo_grants (beta_household) values (new.id)
    on conflict (beta_household) do nothing;
  end if;
  return null;
end $$;

create trigger households_beta_promo after insert on public.households
  for each row execute function public.beta_promo_enqueue();

-- The backfill for households created before the switch went on: how many have no row yet, and,
-- with [p_apply], queues them. Archived households are left out (nobody is in them).
create function public.beta_promo_backfill(p_apply boolean) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  if not p_apply then
    select count(*) into v_count from public.households h
    where h.archived_at is null
      and not exists (select from public.beta_promo_grants g where g.beta_household = h.id);
    return v_count;
  end if;
  insert into public.beta_promo_grants (beta_household)
  select h.id from public.households h
  where h.archived_at is null
  on conflict (beta_household) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Up to [p_limit] queued households to grant now, each at most every 10 minutes; marks them tried.
create function public.beta_promo_take(p_limit integer) returns setof uuid
language sql security definer set search_path = '' as $$
  update public.beta_promo_grants g
  set attempts = g.attempts + 1, last_attempt_at = now()
  where g.beta_household in (
    select q.beta_household from public.beta_promo_grants q
    where q.granted_at is null and q.skipped is null and q.ended_at is null
      and (q.last_attempt_at is null or q.last_attempt_at < now() - interval '10 minutes')
    order by q.queued_at
    limit p_limit
    for update skip locked
  )
  returning g.beta_household
$$;

-- RevenueCat granted [p_household] premium until [p_ends_at] (again, for a new end at launch).
create function public.beta_promo_granted(p_household uuid, p_ends_at timestamptz) returns void
language sql security definer set search_path = '' as $$
  update public.beta_promo_grants
  set granted_at = coalesce(granted_at, now()), ends_at = p_ends_at
  where beta_household = p_household
$$;

create function public.beta_promo_skipped(p_household uuid) returns void
language sql security definer set search_path = '' as $$
  update public.beta_promo_grants set skipped = 'tester' where beta_household = p_household
$$;

-- [p_household]'s beta grant is over at [p_at] (its end, a revoke, or with [p_objected] an
-- objection, which also means it is never granted again). N-52: a household without a purchase
-- has its RevenueCat customer deleted 30 days later; after an objection at once.
create function public.beta_promo_ended(p_household uuid, p_at timestamptz, p_objected boolean)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.beta_promo_grants (beta_household, ended_at, objected_at)
  values (p_household, p_at, case when p_objected then now() end)
  on conflict (beta_household) do update
  set ended_at = coalesce(beta_promo_grants.ended_at, excluded.ended_at),
      objected_at = coalesce(beta_promo_grants.objected_at, excluded.objected_at);
  if not exists (
    select from public.purchases p where p.bound_household = p_household and p.revoked_at is null
  ) then
    insert into public.revenuecat_deletions (app_user_id, due_at)
    values (p_household, case when p_objected then now() else p_at + interval '30 days' end)
    on conflict (app_user_id) do update
    set due_at = least(revenuecat_deletions.due_at, excluded.due_at);
  end if;
end $$;

-- The deletion queue (job 43) now also holds households that still exist (N-52). One that unlocked
-- Premium again since (a purchase, a new grant) keeps its RevenueCat customer: its row goes.
create or replace function public.revenuecat_deletions_take(p_limit integer) returns setof uuid
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.revenuecat_deletions d
  where exists (
    select from public.entitlements e
    where e.household_id = d.app_user_id and (e.expires_at is null or e.expires_at > now())
  );
  return query
  update public.revenuecat_deletions d
  set attempts = d.attempts + 1, last_attempt_at = now()
  where d.app_user_id in (
    select q.app_user_id from public.revenuecat_deletions q
    where q.due_at <= now() and (q.last_attempt_at is null or q.last_attempt_at < now() - interval '1 hour')
    order by q.due_at
    limit p_limit
    for update skip locked
  )
  returning d.app_user_id;
end $$;

-- Retention, daily (pg_cron): job 43's purge as of purchase_legal_fixes, plus beta grants whose end
-- passed (N-52).
create or replace function public.purge_purchases() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.households h
  where h.archived_at is not null and public.archive_deletes_at(h.archived_at) < now();
  insert into public.purchase_tombstones (transaction_hmac)
  select p.transaction_hmac from public.purchases p
  where (p.household_deleted_at < now() - interval '30 days'
         or (p.bound_household = '00000000-0000-0000-0000-000000000000' and p.environment = 'Sandbox'
             and p.verified_at < now() - interval '30 days'))
    and p.transaction_hmac is not null
  on conflict do nothing;
  delete from public.purchases p where p.household_deleted_at < now() - interval '30 days';
  delete from public.purchases p
  where p.bound_household = '00000000-0000-0000-0000-000000000000' and p.environment = 'Sandbox'
    and p.verified_at < now() - interval '30 days';
  -- Refunds of transactions never recorded for a household (or after their purge): nothing to
  -- keep them for once the refund window is over.
  delete from public.purchases p
  where p.bound_household is null and p.revoked_at < now() - interval '30 days';
  delete from public.revenuecat_events e where e.received_at < now() - interval '90 days';
  delete from public.purchase_claims c where c.claimed_at < now() - interval '30 days';
  delete from public.household_departures d where d.left_at < now() - interval '1 hour';
  delete from public.households h where h.archived_at is not null and h.archived_by is null;
  perform public.beta_promo_ended(g.beta_household, g.ends_at, false)
  from public.beta_promo_grants g
  where g.granted_at is not null and g.ended_at is null and g.ends_at <= now();
end $$;

revoke execute on function public.beta_promo_on() from public, anon, authenticated;
revoke execute on function public.beta_promo_enqueue() from public, anon, authenticated;
revoke execute on function public.beta_promo_backfill(boolean) from public, anon, authenticated;
revoke execute on function public.beta_promo_take(integer) from public, anon, authenticated;
revoke execute on function public.beta_promo_granted(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.beta_promo_skipped(uuid) from public, anon, authenticated;
revoke execute on function public.beta_promo_ended(uuid, timestamptz, boolean) from public, anon, authenticated;
revoke execute on function public.revenuecat_deletions_take(integer) from public, anon, authenticated;
revoke execute on function public.purge_purchases() from public, anon, authenticated;
