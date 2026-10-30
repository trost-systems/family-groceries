-- Job 31: the Alexa skill (docs/ALEXA.md). The edge function `alexa` adds and reads items through
-- the same path as Siri (public.add_item, as the linked user, under RLS). This migration adds what
-- only the function needs, none of it readable or writable by clients:
--   * alexa_links: which Hummlist sessions an Alexa account holds, so disabling the skill in the
--     Alexa app revokes them (AlexaSkillEvent.SkillDisabled carries no token, only Alexa's user id);
--   * alexa_rate: a per-user limit of 30 items a minute;
-- and, for the app, its analytics decision per install (analytics_consents), so that an add over
-- Alexa is counted only for a user whose latest decision in the app was yes (Spec #1, AC10).

-- Analytics decisions -------------------------------------------------------------------------

create table public.analytics_consents (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The app's random install id (docs/ANALYTICS.md): the distinct_id of the user's events.
  install_id uuid not null,
  consent boolean not null,
  -- The install is internal (a test device, a debug build): its events say is_internal.
  internal boolean not null default false,
  -- When this install last changed its answer; the newest row is the user's decision.
  decided_at timestamptz not null default now(),
  primary key (user_id, install_id)
);

comment on table public.analytics_consents is
  'Job 31: the analytics answer of each install a user signed in on, written by the app through record_analytics_consent. Server events for the user (Alexa adds) go out only while the newest answer is yes, under that install id.';

alter table public.analytics_consents enable row level security;
revoke all on public.analytics_consents from anon, authenticated;

-- The app calls this when the user answers or switches (p_answered), and on every sign-in and
-- start (a new account on an install that already answered). An install that said no has no
-- install id (job 33b deletes it), so a no may come without one: it is kept under the nil UUID,
-- one row for all such installs. The newest decided_at is the user's answer: an answer the user
-- just gave always moves it, a sign-in or start only when the answer is new or changed, so an app
-- start never outranks a newer answer given on another device.
create function public.record_analytics_consent(
  p_install uuid,
  p_consent boolean,
  p_internal boolean default false,
  p_answered boolean default false
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_install uuid := coalesce(p_install, '00000000-0000-0000-0000-000000000000');
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  -- An app connected over OAuth (MCP, Alexa) does not decide for the user's installs.
  if auth.jwt() ->> 'client_id' is not null then
    raise exception 'session_required' using errcode = '42501';
  end if;
  -- A yes always names its install: events go out under it.
  if p_consent is null or (p_consent and p_install is null) then
    raise exception 'invalid_consent' using errcode = '22023';
  end if;
  insert into public.analytics_consents as a (user_id, install_id, consent, internal)
  values (v_user, v_install, p_consent, coalesce(p_internal, false))
  on conflict (user_id, install_id) do update
    set consent = excluded.consent,
        internal = excluded.internal,
        decided_at = case
          when coalesce(p_answered, false) or a.consent <> excluded.consent then now()
          else a.decided_at
        end;
  -- Reinstalls make new install ids; the 20 newest answers are plenty.
  delete from public.analytics_consents
  where user_id = v_user and install_id not in (
    select install_id from public.analytics_consents
    where user_id = v_user order by decided_at desc, install_id limit 20
  );
end $$;

revoke execute on function public.record_analytics_consent(uuid, boolean, boolean, boolean) from public, anon;
grant execute on function public.record_analytics_consent(uuid, boolean, boolean, boolean) to authenticated;

-- Alexa links ---------------------------------------------------------------------------------

create table public.alexa_links (
  -- SHA-256 (hex) of Alexa's user id for the skill: never the id itself.
  alexa_user_hash text not null check (alexa_user_hash ~ '^[0-9a-f]{64}$'),
  -- The Supabase session behind the access token Alexa holds (auth.sessions.id).
  session_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_seen timestamptz not null default now(),
  primary key (alexa_user_hash, session_id)
);

comment on table public.alexa_links is
  'Job 31: the Hummlist session each Alexa account links to, so AlexaSkillEvent.SkillDisabled (Alexa user id only) can revoke it. Service connection only.';

alter table public.alexa_links enable row level security;
revoke all on public.alexa_links from anon, authenticated;

create index alexa_links_user on public.alexa_links (user_id);

-- Remembers that [p_hash] holds [p_session] of [p_user]. With p_relinked, the account was just
-- linked again (AlexaSkillEvent.SkillAccountLinked): Alexa dropped its older tokens, so the older
-- sessions this Alexa account held are revoked. Returns how many sessions that revoked.
create function public.alexa_remember(
  p_hash text,
  p_user uuid,
  p_session uuid,
  p_relinked boolean default false
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_revoked integer := 0;
begin
  insert into public.alexa_links (alexa_user_hash, session_id, user_id)
  values (p_hash, p_session, p_user)
  on conflict (alexa_user_hash, session_id) do update
    set user_id = excluded.user_id, last_seen = now();
  if p_relinked then
    v_revoked := public.alexa_revoke(p_hash, p_session);
  else
    -- Sessions revoked elsewhere (Zugänge, sign-out, account deletion) leave nothing behind.
    delete from public.alexa_links l
    where l.alexa_user_hash = p_hash
      and not exists (select from auth.sessions s where s.id = l.session_id);
  end if;
  return v_revoked;
end $$;

-- Revokes every Hummlist session the Alexa account [p_hash] holds, except [p_keep]: the session
-- and its refresh tokens are deleted, so neither the access token nor a refresh works again.
-- Only OAuth sessions are touched, never the app's own.
create function public.alexa_revoke(p_hash text, p_keep uuid default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  with gone as (
    delete from public.alexa_links l
    where l.alexa_user_hash = p_hash and l.session_id is distinct from p_keep
    returning l.session_id, l.user_id
  ), revoked as (
    delete from auth.sessions s
    using gone g
    where s.id = g.session_id and s.user_id = g.user_id and s.oauth_client_id is not null
    returning s.id
  )
  select count(*) into v_count from revoked;
  return v_count;
end $$;

-- Rate limit ----------------------------------------------------------------------------------

create table public.alexa_rate (
  user_id uuid primary key references auth.users (id) on delete cascade,
  window_start timestamptz not null,
  adds integer not null check (adds >= 0)
);

comment on table public.alexa_rate is
  'Job 31: items asked for over Alexa in the current one-minute window, per user. Service connection only.';

alter table public.alexa_rate enable row level security;
revoke all on public.alexa_rate from anon, authenticated;

-- Takes [p_count] items from [p_user]'s allowance of [p_limit] a minute (a fixed window). False,
-- and nothing taken, when they would go over it.
create function public.alexa_take_adds(p_user uuid, p_count integer, p_limit integer default 30)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_start timestamptz;
  v_adds integer;
begin
  insert into public.alexa_rate (user_id, window_start, adds)
  values (p_user, now(), 0)
  on conflict (user_id) do nothing;
  select window_start, adds into v_start, v_adds
  from public.alexa_rate where user_id = p_user for update;
  if v_start <= now() - interval '1 minute' then
    v_start := now();
    v_adds := 0;
  end if;
  if v_adds + p_count > p_limit then
    update public.alexa_rate set window_start = v_start, adds = v_adds where user_id = p_user;
    return false;
  end if;
  update public.alexa_rate set window_start = v_start, adds = v_adds + p_count
  where user_id = p_user;
  return true;
end $$;

revoke execute on function public.alexa_remember(text, uuid, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.alexa_revoke(text, uuid) from public, anon, authenticated;
revoke execute on function public.alexa_take_adds(uuid, integer, integer) from public, anon, authenticated;

-- Data export ---------------------------------------------------------------------------------
-- The answers of each install and the Alexa links are the user's data (GDPR Art. 15). The body is
-- job 22's (feedback and invites_created) plus two sections; the addition keeps version 1.
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
    ), '[]'::jsonb)
  );
end $$;
