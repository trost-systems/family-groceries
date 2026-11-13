-- Job 199: the grocery log. A trip is one shop at one store on one day, logged by a member. Its
-- items are a snapshot (name, quantity, canonical key), never item ids: a ticked row is reused
-- when the item is added again, and its bought time is overwritten then.
-- Written through save_trip and delete_trip, read through trip_history only (which keeps a Free
-- user to the last 4 weeks). Not in the realtime publication, not on the public API or MCP.

create table public.trips (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  store_id uuid,
  store_name text,
  shopped_on date not null,
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 200),
  logged_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (store_id, household_id) references public.stores (id, household_id) on delete set null (store_id)
);
create index trips_household_shopped_on on public.trips (household_id, shopped_on desc);
alter table public.trips enable row level security;
revoke all on public.trips from public, anon, authenticated;
-- No grant: the policy stays so that a grant added later still keeps households apart.
create policy trips_member on public.trips for select to authenticated
  using (public.is_household_member(household_id));

comment on table public.trips is
  'Job 199: the household''s shopping trips (store, day, a snapshot of the items). Who logged it is nulled when they leave or delete the account.';

-- Saves trip [p_id] of [p_household]: creates it, or replaces its store, day and items; the same
-- call twice leaves one trip. logged_by stays the first saver's. The store's name is kept as it is
-- now; an edit without a store of a trip whose store was deleted keeps that name.
-- Errors: not_authenticated, not_a_member, other_household (the id is another household's trip),
-- store_not_found (no store of this household), missing_argument (no day), day_in_future (after
-- tomorrow, which allows for time zones), no_items, too_many_items (over 200), invalid_item (an
-- entry without a name of 1 to 120 characters, or with a quantity over 40).
create function public.save_trip(p_household uuid, p_id uuid, p_store uuid, p_day date, p_items jsonb)
returns public.trips
language plpgsql security definer set search_path = '' as $$
declare
  v_old public.trips;
  v_store_name text;
  v_items jsonb;
  v_trip public.trips;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_id is null or p_day is null then
    raise exception 'missing_argument' using errcode = '22023';
  end if;
  -- Waits for a leave or removal in flight, whose trigger forgets the user in the trips.
  perform public.lock_memberships(auth.uid());
  if not public.is_household_member(p_household) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  select * into v_old from public.trips t where t.id = p_id for update;
  if found and v_old.household_id <> p_household then
    raise exception 'other_household' using errcode = '22023';
  end if;
  if p_store is not null then
    select s.name into v_store_name from public.stores s where s.id = p_store and s.household_id = p_household;
    if not found then
      raise exception 'store_not_found' using errcode = 'P0002';
    end if;
  elsif v_old.store_id is null then
    v_store_name := v_old.store_name;
  end if;
  if p_day > current_date + 1 then
    raise exception 'day_in_future' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'no_items' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'no_items' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception 'too_many_items' using errcode = '22023';
  end if;
  if exists (
    select from jsonb_array_elements(p_items) e
    where jsonb_typeof(e) is distinct from 'object'
       or jsonb_typeof(e -> 'name') is distinct from 'string'
       or char_length(btrim(e ->> 'name')) not between 1 and 120
       or jsonb_typeof(coalesce(e -> 'quantity', 'null')) not in ('string', 'null')
       or char_length(btrim(e ->> 'quantity')) > 40
  ) then
    raise exception 'invalid_item' using errcode = '22023';
  end if;
  select jsonb_agg(jsonb_build_object(
    'name', btrim(e ->> 'name'),
    'quantity', nullif(btrim(e ->> 'quantity'), ''),
    'canonical_key', nullif(public.canonical_key(btrim(e ->> 'name')), '')
  ) order by o)
  into v_items
  from jsonb_array_elements(p_items) with ordinality as x (e, o);

  insert into public.trips as t (id, household_id, store_id, store_name, shopped_on, items, logged_by)
  values (p_id, p_household, p_store, v_store_name, p_day, v_items, auth.uid())
  on conflict (id) do update set
    store_id = excluded.store_id,
    store_name = excluded.store_name,
    shopped_on = excluded.shopped_on,
    items = excluded.items,
    updated_at = now()
  where (t.store_id, t.store_name, t.shopped_on, t.items)
    is distinct from (excluded.store_id, excluded.store_name, excluded.shopped_on, excluded.items);
  select * into v_trip from public.trips t where t.id = p_id;
  return v_trip;
end $$;
revoke execute on function public.save_trip(uuid, uuid, uuid, date, jsonb) from public, anon;
grant execute on function public.save_trip(uuid, uuid, uuid, date, jsonb) to authenticated;

-- Deletes trip [p_id]; a missing one is no error, so a retried delete succeeds.
create function public.delete_trip(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_household uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select t.household_id into v_household from public.trips t where t.id = p_id for update;
  if not found then
    return;
  end if;
  if not public.is_household_member(v_household) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  delete from public.trips t where t.id = p_id;
end $$;
revoke execute on function public.delete_trip(uuid) from public, anon;
grant execute on function public.delete_trip(uuid) to authenticated;

-- The trips of [p_household] a member may browse, newest first:
-- {"trips": [<as save_trip returns them>], "premium": bool, "since": date | null, "locked": int}.
-- Premium is the household's (household-bound Lifetime, promotional and tester grants) or the
-- user's own (job 185), as in integration_gate. Free sees the 28 days up to [p_today], the client's
-- local date, clamped to the server's yesterday..tomorrow; locked counts the older trips, which are
-- kept. Premium sees all: since null, locked 0.
-- Errors: not_authenticated, missing_argument, not_a_member.
create function public.trip_history(p_household uuid, p_today date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_premium boolean;
  v_since date;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_household is null or p_today is null then
    raise exception 'missing_argument' using errcode = '22023';
  end if;
  if not public.is_household_member(p_household) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  v_premium := public.household_has_premium(p_household) or public.user_has_premium(auth.uid());
  if not v_premium then
    v_since := least(greatest(p_today, current_date - 1), current_date + 1) - 27;
  end if;
  return jsonb_build_object(
    'trips', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.shopped_on desc, t.created_at desc, t.id desc)
      from public.trips t
      where t.household_id = p_household and (v_since is null or t.shopped_on >= v_since)
    ), '[]'::jsonb),
    'premium', v_premium,
    'since', v_since,
    'locked', (
      select count(*)::int from public.trips t
      where t.household_id = p_household and t.shopped_on < v_since
    )
  );
end $$;
revoke execute on function public.trip_history(uuid, date) from public, anon;
grant execute on function public.trip_history(uuid, date) to authenticated;

-- Leaving or being removed also forgets who logged the household's trips (Legal N-115).
-- Otherwise unchanged from 20261110193718_household_leave_forgets_user.sql.
create or replace function public.household_member_forget_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_user text := old.user_id::text;
begin
  -- A deleted household takes its rows with it. The last member leaving archives or deletes it
  -- (leave_household_as): an archive is theirs to bring back as it was, and a delete goes anyway.
  if not exists (select from public.households h where h.id = old.household_id)
     or not exists (select from public.household_members m where m.household_id = old.household_id) then
    return null;
  end if;
  update public.items i set
    added_by = case when i.added_by = old.user_id then null else i.added_by end,
    bought_by = case when i.bought_by = old.user_id then null else i.bought_by end
  where i.household_id = old.household_id and old.user_id in (i.added_by, i.bought_by);
  update public.item_events e set actor = null
  where e.household_id = old.household_id and e.actor = old.user_id;
  update public.lists l set created_by = null
  where l.household_id = old.household_id and l.created_by = old.user_id;
  update public.item_merges m set
    merged_by = case when m.merged_by = old.user_id then null else m.merged_by end,
    merged_row = public.forget_user_in_row(m.merged_row, v_user),
    kept_before = public.forget_user_in_row(m.kept_before, v_user)
  where m.household_id = old.household_id
    and (m.merged_by = old.user_id
         or v_user in (m.merged_row ->> 'added_by', m.merged_row ->> 'bought_by',
                       m.kept_before ->> 'added_by', m.kept_before ->> 'bought_by'));
  update public.invites v set
    created_by = case when v.created_by = old.user_id then null else v.created_by end,
    used_by = case when v.used_by = old.user_id then null else v.used_by end
  where v.household_id = old.household_id and old.user_id in (v.created_by, v.used_by);
  update public.join_requests r set decided_by = null
  where r.household_id = old.household_id and r.decided_by = old.user_id;
  update public.trips t set logged_by = null
  where t.household_id = old.household_id and t.logged_by = old.user_id;
  update public.households h set created_by = null
  where h.id = old.household_id and h.created_by = old.user_id;
  return null;
end $$;

-- The export adds the trips the user logged. Otherwise unchanged from
-- 20261108144412_households_join_approval.sql.
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
      where m.user_id = v_user and m.is_default
    ),
    'invite_uses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'household_id', u.household_id, 'invite_id', u.invite_id, 'joined_at', u.joined_at
      ) order by u.joined_at)
      from public.invite_uses u where u.user_id = v_user
    ), '[]'::jsonb),
    'household_removals', coalesce((
      select jsonb_agg(jsonb_build_object('household_id', r.household_id, 'removed_at', r.removed_at)
        order by r.removed_at, r.household_id)
      from public.household_removals r where r.user_id = v_user
    ), '[]'::jsonb),
    'households', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', h.id,
        'name', h.name,
        'kind', h.kind,
        'role', m.role,
        'joined_at', m.joined_at,
        'is_default', m.is_default
      ) order by m.joined_at, h.id)
      from public.household_members m
      join public.households h on h.id = m.household_id
      where m.user_id = v_user
    ), '[]'::jsonb),
    'items_added', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', i.name,
        'brand', i.brand,
        'properties', i.properties,
        'quantity', i.quantity,
        'status', i.status,
        'category', c.name,
        'store', s.name,
        'list', l.name,
        'created_at', i.created_at,
        'bought_at', i.bought_at
      ) order by i.created_at, i.id)
      from public.items i
      join public.household_members m on m.household_id = i.household_id and m.user_id = v_user
      left join public.categories c on c.id = i.category_id
      left join public.stores s on s.id = i.store_id
      left join public.lists l on l.id = i.list_id
      where i.added_by = v_user
    ), '[]'::jsonb),
    'lists_created', coalesce((
      select jsonb_agg(jsonb_build_object(
        'household_id', l.household_id, 'name', l.name, 'created_at', l.created_at
      ) order by l.created_at, l.id)
      from public.lists l where l.created_by = v_user
    ), '[]'::jsonb),
    'item_claims', coalesce((
      select jsonb_agg(jsonb_build_object(
        'household_id', c.household_id, 'item_name', i.name, 'quantity', c.quantity,
        'created_at', c.created_at
      ) order by c.created_at, c.item_id)
      from public.item_claims c join public.items i on i.id = c.item_id
      where c.user_id = v_user
    ), '[]'::jsonb),
    'join_requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'household_id', r.household_id, 'created_at', r.created_at, 'decision', r.decision,
        'decided_at', r.decided_at
      ) order by r.created_at, r.id)
      from public.join_requests r where r.user_id = v_user
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
        'kind', iv.kind,
        'max_uses', iv.max_uses,
        'use_count', iv.use_count,
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
        'revoked_at', c.revoked_at,
        'device', d.device
      ) order by c.granted_at, c.id)
      from auth.oauth_consents c
      join auth.oauth_clients oc on oc.id = c.client_id
      left join public.oauth_app_devices d on d.user_id = c.user_id and d.client_id = c.client_id
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
    ), '[]'::jsonb),
    'trips_logged', coalesce((
      select jsonb_agg(jsonb_build_object(
        'household_id', t.household_id,
        'store_name', t.store_name,
        'shopped_on', t.shopped_on,
        'items', (select jsonb_agg(jsonb_build_object('name', i ->> 'name', 'quantity', i -> 'quantity') order by o)
                  from jsonb_array_elements(t.items) with ordinality as x (i, o)),
        'created_at', t.created_at
      ) order by t.created_at, t.id)
      from public.trips t where t.logged_by = v_user
    ), '[]'::jsonb)
  );
end $$;
