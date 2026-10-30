-- Job 22 (onboarding): invites last 7 days and are single use, members revoke them through an RPC
-- (never back), a code can be previewed (the household name) before joining, failed codes are
-- rate-limited per user, and a new household may start without the default stores.

-- Invites -------------------------------------------------------------------

alter table public.invites alter column expires_at set default now() + interval '7 days';
-- Open invites made under the old 14-day rule get the new lifetime too.
update public.invites set expires_at = least(expires_at, created_at + interval '7 days');

alter table public.invites
  add column used_at timestamptz,
  add column used_by uuid references auth.users (id) on delete set null;

comment on column public.invites.used_at is 'When someone joined with this invite; it works only once.';
comment on column public.invites.used_by is 'Who joined with it; null once that account is deleted.';

-- Members revoke through revoke_invite, which never clears revoked_at again.
drop policy invites_revoke on public.invites;
revoke update on public.invites from authenticated;

-- Failed invite codes, for the rate limit: 10 failures per user in a rolling hour. Written only by
-- the security definer RPCs below; clients have no access at all. Rows older than a day are
-- purged whenever a failure is recorded.
create table public.invite_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now()
);
create index invite_attempts_user_at on public.invite_attempts (user_id, at);
create index invite_attempts_at on public.invite_attempts (at);
alter table public.invite_attempts enable row level security;
revoke all on public.invite_attempts from public, anon, authenticated;

comment on table public.invite_attempts is 'Failed join and preview attempts per user (rate limit); no client access.';

-- The checks every code goes through, in order:
--   1. too_many_attempts: 10 or more failures by this user in the last hour; even a valid code waits;
--   2. member: the caller is already in the code's household, whatever the invite's state;
--   3. invalid_invite: unknown, expired, revoked or used, one answer for all (recorded as a failure);
--   4. ok: the invite is open.
-- Returns the status and the invite's id and household (null unless 2 or 4). Takes a per-user
-- advisory lock, so a burst of parallel guesses is counted one by one instead of all reading the
-- same count.
create function public.check_invite(p_code text, out status text, out invite_id uuid, out household_id uuid)
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
        and v_invite.expires_at > now() then
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

-- The household an invite code leads to, before joining: {status, name}. status is ok, member,
-- invalid_invite or too_many_attempts (see check_invite); name only with ok or member.
create function public.preview_invite(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_check record;
begin
  select * into v_check from public.check_invite(p_code);
  return jsonb_build_object(
    'status', v_check.status,
    'name', (select h.name from public.households h where h.id = v_check.household_id)
  );
end $$;

-- Joins the household of invite p_code: {status, household_id}. status is joined (a new
-- membership; the invite is used up), member (already in it; the invite stays as it was),
-- invalid_invite or too_many_attempts. Never raises for a bad code, so the failure it records
-- survives. The invite is consumed by one conditional update: of two people racing for one code,
-- the second waits for the first's row lock, finds used_at set and gets invalid_invite.
create function public.accept_invite(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_check record;
  v_household uuid;
begin
  select * into v_check from public.check_invite(p_code);
  if v_check.status = 'member' then
    return jsonb_build_object('status', 'member', 'household_id', v_check.household_id);
  elsif v_check.status <> 'ok' then
    return jsonb_build_object('status', v_check.status, 'household_id', null);
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

  perform public.leave_current_household();
  insert into public.household_members (household_id, user_id, role)
  values (v_household, auth.uid(), 'member');
  return jsonb_build_object('status', 'joined', 'household_id', v_household);
end $$;

-- The old RPC, for apps and scripts from before job 22: the household id on success, as before.
-- A bad code now returns null instead of raising invalid_invite: a raise would roll back the
-- recorded failure, and the rate limit must hold on this path too. too_many_attempts still raises
-- (nothing is recorded then).
create or replace function public.join_household(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_result jsonb := public.accept_invite(p_code);
begin
  if v_result ->> 'status' = 'too_many_attempts' then
    raise exception 'too_many_attempts' using errcode = 'P0001';
  end if;
  return (v_result ->> 'household_id')::uuid;
end $$;

-- Revokes an invite of the caller's household: link and code stop working at once. Revoking
-- again keeps the first time; nothing un-revokes.
create function public.revoke_invite(p_invite uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.invites i set revoked_at = coalesce(i.revoked_at, now())
  where i.id = p_invite and public.is_household_member(i.household_id);
  if not found then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
end $$;

-- Households: the default stores are optional ---------------------------------

-- Categories (the fallback 'Sonstiges' included) always; dm, Lidl and Edeka with their
-- researched layouts only with p_stores.
create function public.seed_household(p_household uuid, p_stores boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.categories (household_id, name, seed_key, sort_order)
  values
    (p_household, 'Obst & Gemüse', 'produce', 10),
    (p_household, 'Brot & Backwaren', 'bakery', 20),
    (p_household, 'Kühlregal', 'chilled', 30),
    (p_household, 'Fleisch/Wurst/Fisch', 'meat', 40),
    (p_household, 'Vorrat & Konserven', 'pantry', 50),
    (p_household, 'Süßes & Snacks', 'sweets', 60),
    (p_household, 'Getränke', 'drinks', 70),
    (p_household, 'Tiefkühl', 'frozen', 80),
    (p_household, 'Haushalt', 'household', 90),
    (p_household, '👶 Drogerie', 'drugstore', 100),
    (p_household, 'Sonstiges', 'other', 1000);

  if p_stores then
    insert into public.stores (household_id, name, seed_key, sort_order)
    values
      (p_household, 'dm', 'dm', 10),
      (p_household, 'Lidl', 'lidl', 20),
      (p_household, 'Edeka', 'edeka', 30);
    perform public.apply_default_store_layouts(p_household);
  end if;
end $$;

create or replace function public.seed_household(p_household uuid) returns void
language sql security definer set search_path = '' as $$
  select public.seed_household(p_household, true);
$$;

-- One function with both defaults serves every old call (create_household('x'), {p_name}, {}),
-- which two overloads could not: a one-argument call would match both.
-- squawk-ignore ban-drop-function -- replaced in this same migration by a signature that takes every old call
drop function public.create_household(text);

create function public.create_household(
  p_name text default 'Unser Haushalt',
  p_default_stores boolean default true
) returns public.households
language plpgsql security definer set search_path = '' as $$
declare
  v_household public.households;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'already_in_household' using errcode = 'P0001';
  end if;
  insert into public.households (name, created_by)
  values (coalesce(nullif(btrim(p_name), ''), 'Unser Haushalt'), auth.uid())
  returning * into v_household;
  begin
    insert into public.household_members (household_id, user_id, role)
    values (v_household.id, auth.uid(), 'owner');
  exception when unique_violation then
    -- The same user's other device created (or joined) one at the same moment: the same answer
    -- as above, and this call's household goes with the rollback.
    raise exception 'already_in_household' using errcode = 'P0001';
  end;
  perform public.seed_household(v_household.id, coalesce(p_default_stores, true));
  return v_household;
end $$;

-- Grants ------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.create_household(text, boolean),
  public.preview_invite(text),
  public.accept_invite(text),
  public.revoke_invite(uuid)
to authenticated;
revoke execute on function
  public.check_invite(text),
  public.seed_household(uuid, boolean),
  public.seed_household(uuid)
from authenticated;

-- Data export: the invites the user created are household data they made (job 22). The body is
-- feedback's plus that section; the addition keeps version 1. The code is in it (it is theirs),
-- who used an invite is not (another person).
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
    ), '[]'::jsonb)
  );
end $$;
