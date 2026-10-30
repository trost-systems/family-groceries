-- In-app feedback (job 21, docs/FEEDBACK.md): a note a user sends from More, with the context to
-- reproduce a problem and nothing from the household's list. Clients may only insert their own
-- rows; Peter and the PM read them with the service role. Rows go 12 months after created_at.

create extension if not exists pg_cron with schema pg_catalog;

-- Dart's String.trim() whitespace, so the app and the database agree on what "empty" and "2000
-- characters" mean (btrim alone strips only spaces).
create function public.feedback_trim(p_text text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(
    p_text,
    '^[\u0009-\u000d \u0085   -     　﻿]+|[\u0009-\u000d \u0085   -     　﻿]+$',
    '', 'g')
$$;

create table public.feedback (
  -- Made by the app once per form, so a double tap or a retry after a lost answer stays one row.
  id uuid primary key,
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Set by feedback_before_insert from household_members, never taken from the client.
  household_id uuid references public.households (id) on delete set null,
  message text not null check (char_length(public.feedback_trim(message)) between 1 and 2000),
  category text check (category in ('bug', 'idea', 'other')),
  contact_ok boolean not null default false,
  app_version text not null check (char_length(app_version) between 1 and 32),
  build text not null check (char_length(build) between 1 and 16),
  platform text not null check (platform in ('ios', 'android', 'web', 'linux', 'macos', 'windows')),
  os_version text not null check (char_length(os_version) between 1 and 64),
  locale text not null check (locale ~ '^[a-z]{2,3}([_-][A-Za-z0-9]{2,8})?$'),
  screen text not null check (screen ~ '^[a-z][a-z_]{0,39}$'),
  is_internal boolean not null default false
);

create index feedback_created_at on public.feedback (created_at);
create index feedback_user_id on public.feedback (user_id);
create index feedback_household_id on public.feedback (household_id);

comment on table public.feedback is
  'In-app feedback from More (job 21, docs/FEEDBACK.md). Insert-only for the sender; read with the service role. Deleted 12 months after created_at (purge_old_feedback, pg_cron).';
comment on column public.feedback.id is 'Made by the app per form submission: a retry of the same note stays one row.';
comment on column public.feedback.created_at is 'When the note arrived (UTC).';
comment on column public.feedback.user_id is 'The sender (auth.users). Deleting the account deletes their notes.';
comment on column public.feedback.household_id is 'The sender''s household when sending, id only; null without one or once the household is gone.';
comment on column public.feedback.message is 'The typed note, trimmed, 1 to 2000 characters.';
comment on column public.feedback.category is 'bug, idea or other; null when none was picked.';
comment on column public.feedback.contact_ok is 'The sender agreed that Peter may contact them about it. The e-mail is not copied: look it up in auth.users.';
comment on column public.feedback.app_version is 'App version, e.g. 0.1.0.';
comment on column public.feedback.build is 'Build number, e.g. 1023.';
comment on column public.feedback.platform is 'ios, android, web, linux, macos or windows.';
comment on column public.feedback.os_version is 'OS version; on the web the browser family and OS, e.g. "Chrome on Android".';
comment on column public.feedback.locale is 'The app''s language when sending (de, en).';
comment on column public.feedback.screen is 'The screen the note is about, a fixed name (list, account, …); never a path, code or item.';
comment on column public.feedback.is_internal is 'From Peter''s household, a test account, a debug, profile or preview build, or an install marked internal. Excluded from the Monday summary''s external part.';

-- The household is the sender's current one, whatever the client sent. A test account's note is
-- internal whatever the client said (the reserved test domains of app/lib/analytics/internal.dart).
-- A repeat of the sender's own id is skipped, so a retry succeeds without a second row; anyone
-- else's id still fails on the primary key. Security definer: it reads household_members,
-- auth.users and feedback, which clients cannot.
create function public.feedback_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_domain text;
begin
  -- Only the signed-in sender's own repeat: a row claiming someone else still meets the policy.
  if new.user_id = auth.uid()
     and exists (select from public.feedback f where f.id = new.id and f.user_id = new.user_id) then
    return null;
  end if;
  new.message := public.feedback_trim(new.message);
  new.created_at := now();
  new.household_id := (select m.household_id from public.household_members m where m.user_id = new.user_id);
  v_domain := lower((select split_part(u.email, '@', 2) from auth.users u where u.id = new.user_id));
  if split_part(v_domain, '.', -1) in ('test', 'invalid', 'example', 'localhost')
     or v_domain in ('example.com', 'example.net', 'example.org')
     or v_domain like any (array['%.example.com', '%.example.net', '%.example.org']) then
    new.is_internal := true;
  end if;
  return new;
end $$;

create trigger feedback_before_insert
  before insert on public.feedback
  for each row execute function public.feedback_before_insert();

alter table public.feedback enable row level security;

-- Insert only, only as oneself, only into one's own household (the trigger has set it by the
-- time this is checked). No select, update or delete policy: not even the sender reads a note
-- back.
create policy feedback_insert_own on public.feedback
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (household_id is null or public.is_household_member(household_id))
  );

revoke all on public.feedback from anon, authenticated;
grant insert (id, user_id, message, category, contact_ok, app_version, build, platform,
  os_version, locale, screen, is_internal) on public.feedback to authenticated;

-- Retention: daily, rows older than 12 months go. Returns how many.
create function public.purge_old_feedback() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  delete from public.feedback where created_at < now() - interval '12 months';
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke execute on function public.purge_old_feedback() from public, anon, authenticated;
revoke execute on function public.feedback_before_insert() from public, anon, authenticated;

-- The same name replaces the job, so applying this again keeps one.
select cron.schedule('purge-old-feedback', '17 3 * * *', 'select public.purge_old_feedback()');

-- Data export: the sender's own notes are their data (GDPR Art. 15), so "Meine Daten exportieren"
-- lists them. The body is item_details' plus the feedback section; the addition keeps version 1.
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
