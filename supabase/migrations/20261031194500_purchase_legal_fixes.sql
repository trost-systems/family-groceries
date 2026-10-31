-- Job 47: Legal Review K.11 fixes for purchases and the archive (DECISIONS "Job 47").
--   * H-70: archiving waits for a server switch (app_switches.household_archive), seeded off.
--   * H-50: an archived household is deleted 24 months after archiving, the way any household is
--     deleted (its purchases start their 30 days, its RevenueCat customer is queued).
--   * H-69: the sandbox purchases from before job 43 bound to the nil UUID go, and none can linger.
--   * H-72: removing a tester clears their mark on the households they unlocked.
--   * Job 43 review: the buyer's claim names the household the purchase was made for, and counts
--     for a member of it at the time of buying, also one who left it since.

-- Switches the service role sets ---------------------------------------------------------------

create table public.app_switches (
  key text primary key check (key ~ '^[a-z_]{1,64}$'),
  enabled boolean not null default false,
  changed_at timestamptz not null default now()
);

comment on table public.app_switches is
  'Job 47: server-side switches, set by the service role only (NEEDS_LEAD "Job 47"). household_archive: archiving a household on the last leave is allowed.';

alter table public.app_switches enable row level security;
revoke all on public.app_switches from public, anon, authenticated;

insert into public.app_switches (key, enabled) values ('household_archive', false);

create function public.app_switch(p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select s.enabled from public.app_switches s where s.key = p_key), false)
$$;

revoke execute on function public.app_switch(text) from public, anon, authenticated;

-- Leaving: job 43's, but archiving needs household_archive on. A call that would archive is
-- refused with archive_disabled and changes nothing (the error rolls back accept_invite's and
-- unarchive_household's work too). A call with p_archive whose household is not archived anyway
-- (others stay, no Lifetime) goes on as before: unarchive_household always asks to archive the
-- household it leaves, and bringing an archived household back stays possible with the switch off.
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
  if p_archive and exists (
    select from public.entitlements e where e.household_id = v_household and e.kind = 'lifetime'
  ) then
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

-- 24 months after archiving -------------------------------------------------------------------

create function public.archive_deletes_at(p_archived_at timestamptz) returns timestamptz
language sql immutable set search_path = '' as $$
  select p_archived_at + interval '24 months'
$$;

-- The caller's archived households, newest first: [{id, name, archived_at, deletes_at, unlocked}].
create or replace function public.archived_households() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', h.id,
    'name', h.name,
    'archived_at', h.archived_at,
    'deletes_at', public.archive_deletes_at(h.archived_at),
    'unlocked', exists (select from public.entitlements e where e.household_id = h.id and e.kind = 'lifetime')
  ) order by h.archived_at desc, h.id), '[]'::jsonb)
  from public.households h
  where h.archived_by = auth.uid() and h.archived_at is not null
$$;

-- Ended memberships, for the buyer's claim ------------------------------------------------------

-- Who left which household when, kept one hour: the app claims a purchase seconds after buying,
-- and a buyer who left the household in between still counts as a member at the time of buying.
-- Service connection only.
create table public.household_departures (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null,
  left_at timestamptz not null default now()
);

create index household_departures_user on public.household_departures (user_id, household_id);

comment on table public.household_departures is
  'Job 47: memberships that ended in the last hour (household, user, joined, left), so a buyer who left right after buying can still claim the purchase. Service connection only.';

alter table public.household_departures enable row level security;
revoke all on public.household_departures from public, anon, authenticated;
-- No client has a grant; the policy only keeps the household rule of every household_id table.
create policy household_departures_member on public.household_departures
  for select to authenticated using (public.is_household_member(household_id));

create function public.household_departure() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.household_departures d where d.left_at < now() - interval '1 hour';
  -- Not when the household or the account goes with it (cascades): nothing to claim for then.
  if exists (select from public.households h where h.id = old.household_id)
    and exists (select from auth.users u where u.id = old.user_id) then
    insert into public.household_departures (household_id, user_id, joined_at)
    values (old.household_id, old.user_id, old.joined_at);
  end if;
  return null;
end $$;

revoke execute on function public.household_departure() from public, anon, authenticated;

create trigger household_members_departure after delete on public.household_members
  for each row execute function public.household_departure();

-- [p_user] was a member of [p_household] at [p_at] (the store's purchase time): a member now who
-- joined before it, or one whose membership ended in the last hour and spanned it. Ten minutes
-- either way for the store's clock against ours.
create function public.was_member_at(p_user uuid, p_household uuid, p_at timestamptz) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select from public.household_members m
    where m.user_id = p_user and m.household_id = p_household
      and m.joined_at <= p_at + interval '10 minutes'
  ) or exists (
    select from public.household_departures d
    where d.user_id = p_user and d.household_id = p_household
      and d.joined_at <= p_at + interval '10 minutes' and d.left_at >= p_at - interval '10 minutes'
      and d.left_at >= now() - interval '1 hour'
  )
$$;

revoke execute on function public.was_member_at(uuid, uuid, timestamptz) from public, anon, authenticated;

-- [p_user] says they bought store transaction [p_transaction] for household [p_household] (the
-- RevenueCat App User ID the app bought under, not the household they are in now). Counts only
-- for a member of that household at the time of buying: once the webhook recorded it, at its
-- purchased_at; before that, now or before leaving it in the last hour (the claim then waits for
-- the webhook). {status, send_completed}: status recorded (now the buyer), taken (another buyer),
-- elsewhere (another household's), waiting. Raises not_a_member otherwise.
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
      'environment', v_row.environment, 'price', v_row.price, 'currency', v_row.currency,
      'country', v_row.country, 'household_id', v_row.bound_household,
      'internal', exists (select from public.lifetime_testers t where t.user_id = p_user)
        or exists (select from public.entitlements e where e.household_id = p_household and e.source = 'tester')));
  end if;
  return jsonb_build_object('status', 'recorded', 'send_completed', false);
end $$;

revoke execute on function public.purchase_claim(uuid, uuid, text, text) from public, anon, authenticated;

-- Testers (H-72) ---------------------------------------------------------------------------------

-- A tester taken off the list (scripts/iap/testers.ts remove, or the account's deletion) leaves no
-- mark on the households they unlocked; the unlocks stay.
create function public.lifetime_tester_removed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.entitlements set tester = null where tester = old.user_id;
  return null;
end $$;

revoke execute on function public.lifetime_tester_removed() from public, anon, authenticated;

create trigger lifetime_testers_removed after delete on public.lifetime_testers
  for each row execute function public.lifetime_tester_removed();

-- Retention ------------------------------------------------------------------------------------

-- H-69: before job 43 only sandbox purchases existed; those that unlocked nothing were bound to the
-- nil UUID and have no HMAC. Test data: delete them (only Sandbox rows; nothing was sold).
delete from public.purchases
where bound_household = '00000000-0000-0000-0000-000000000000' and environment = 'Sandbox';

-- Daily (pg_cron, job 43's schedule): job 43's purge, plus archived households 24 months after
-- archiving (deleted like any household: the delete trigger starts their purchases' 30 days and
-- queues the RevenueCat customer), nil-bound sandbox purchases after 30 days, and departures after
-- an hour.
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
end $$;

revoke execute on function public.purge_purchases() from public, anon, authenticated;
