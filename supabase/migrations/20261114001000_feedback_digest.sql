-- Job 225: the daily feedback digest (docs/FEEDBACK.md, "Daily digest"). Once a day after 08:00
-- Berlin the feedback-digest function mails Peter every external note since the last digest. It
-- ships off: the switch app_switches.feedback_digest is seeded off and this migration schedules
-- nothing. feedback_digest_set(true, <function url>) is the one way to turn it on, by hand after
-- Legal GO (NEEDS_PETER "Job 225").

create extension if not exists pg_net with schema extensions;

insert into public.app_switches (key, enabled) values ('feedback_digest', false) on conflict do nothing;

comment on table public.app_switches is
  'Job 47: server-side switches, set by the service role only (NEEDS_LEAD "Job 47", "Job 49", "Job 50"). household_archive: archiving a household on the last leave is allowed. premium_offer (job 49): the app may offer Snacklist Premium for sale. integration_lock (job 50): MCP and the API (job 73) need Snacklist Premium; Siri (job 184) and Alexa (job 72) stay free. public_api (job 75): the public API is served and API keys can be made. feedback_digest (job 225): the daily feedback mail runs; set only through feedback_digest_set.';

create table public.feedback_digest_state (
  id boolean primary key default true check (id),
  since_created_at timestamptz,
  since_id uuid,
  last_digest_on date,
  last_run_at timestamptz,
  last_ok_at timestamptz,
  last_error text check (last_error ~ '^[a-z0-9_]{1,40}$')
);

comment on table public.feedback_digest_state is
  'Job 225: the daily feedback digest''s one row: the watermark and the last run''s outcome. Read and written only through the feedback_digest_* functions.';
comment on column public.feedback_digest_state.id is 'Always true: the table holds one row.';
comment on column public.feedback_digest_state.since_created_at is 'Watermark: created_at of the last note mailed. Null until the digest is first switched on, which sets it to that moment.';
comment on column public.feedback_digest_state.since_id is 'Watermark: id of the last note mailed, the tie-breaker for notes of the same created_at.';
comment on column public.feedback_digest_state.last_digest_on is 'The Berlin day of the last digest mailed.';
comment on column public.feedback_digest_state.last_run_at is 'When the function last ran with the switch on.';
comment on column public.feedback_digest_state.last_ok_at is 'When a run last ended without an error (mailed, empty or raced).';
comment on column public.feedback_digest_state.last_error is 'The last run''s fixed error code (send_failed, db_error, mail_not_configured), null after a good run. Never feedback content.';

insert into public.feedback_digest_state (id) values (true);

alter table public.feedback_digest_state enable row level security;
revoke all on public.feedback_digest_state from public, anon, authenticated, service_role;

-- The UTC text of a timestamp with all six fractional digits: the watermark travels through the
-- function as text, since postgres.js drops microseconds from timestamptz values.
create function public.feedback_digest_ts(p_at timestamptz) returns text
language sql immutable set search_path = '' as $$
  select to_char(p_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
$$;

-- The day's notes. The digest of day D holds the external notes after the watermark and before
-- D 07:59 Berlin; D is today from 08:00 Berlin on, else yesterday. The minute's margin is for
-- notes still being inserted: created_at is the inserting transaction's start. Premium is the
-- state when the digest runs. The address is read only for a note whose sender allowed a reply.
create function public.feedback_digest_batch(p_now timestamptz default now()) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_state public.feedback_digest_state;
  v_local timestamp := p_now at time zone 'Europe/Berlin';
  v_on date;
  v_until timestamptz;
begin
  select * into v_state from public.feedback_digest_state;
  if not public.app_switch('feedback_digest') or v_state.since_created_at is null then
    return jsonb_build_object('enabled', false);
  end if;
  v_on := case when v_local::time >= time '08:00' then v_local::date else v_local::date - 1 end;
  v_until := ((v_on + time '08:00') at time zone 'Europe/Berlin') - interval '1 minute';
  return jsonb_build_object(
    'enabled', true,
    'digest_on', to_char(v_on, 'YYYY-MM-DD'),
    'since', jsonb_build_object(
      'created_at', public.feedback_digest_ts(v_state.since_created_at),
      'id', v_state.since_id),
    'notes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id,
        'created_at', public.feedback_digest_ts(f.created_at),
        'created_berlin', to_char(f.created_at at time zone 'Europe/Berlin', 'YYYY-MM-DD HH24:MI'),
        'category', f.category,
        'message', f.message,
        'platform', f.platform,
        'app_version', f.app_version,
        'build', f.build,
        'premium', (f.household_id is not null and public.household_has_premium(f.household_id))
          or public.user_has_premium(f.user_id),
        'contact_ok', f.contact_ok,
        'email', case when f.contact_ok then (select u.email from auth.users u where u.id = f.user_id) end
      ) order by f.created_at, f.id)
      from public.feedback f
      where not f.is_internal
        and (f.created_at, f.id) > (v_state.since_created_at, v_state.since_id)
        and f.created_at < v_until
    ), '[]'::jsonb));
end $$;

-- Compare-and-set: moves the watermark from (from) to (to) only if it still is (from), so of two
-- runs that mailed the same window only one moves it. Times are the batch's text.
create function public.feedback_digest_advance(p_from_created_at text, p_from_id uuid,
  p_to_created_at text, p_to_id uuid, p_digest_on date) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.feedback_digest_state s
  set since_created_at = p_to_created_at::timestamptz, since_id = p_to_id, last_digest_on = p_digest_on
  where s.since_created_at is not distinct from p_from_created_at::timestamptz
    and s.since_id is not distinct from p_from_id;
  return found;
end $$;

create function public.feedback_digest_record(p_error text) returns void
language sql security definer set search_path = '' as $$
  update public.feedback_digest_state
  set last_run_at = now(),
      last_ok_at = case when p_error is null then now() else last_ok_at end,
      last_error = p_error
$$;

-- What the public status route and the watch workflow see: two booleans, nothing else. Hourly runs
-- leave three hours for a missed or failed one before the digest counts as unhealthy.
create function public.feedback_digest_status() returns table (enabled boolean, healthy boolean)
language sql stable security definer set search_path = '' as $$
  select o.enabled,
    not o.enabled or (s.last_error is null and coalesce(s.last_ok_at > now() - interval '3 hours', false))
  from public.feedback_digest_state s
  cross join lateral (
    select public.app_switch('feedback_digest') and s.since_created_at is not null as enabled
  ) o
$$;

-- On: needs the function's URL and the vault secret feedback_digest_secret (the function's
-- FEEDBACK_DIGEST_SECRET). The first switch-on starts the watermark now; a later one keeps it, so
-- a pause delays notes and loses none. The job runs hourly (pg_cron is UTC, the window is Berlin's
-- day) and reads the secret from the vault at run time: cron.job never holds it.
-- Off: the switch goes off and the job is removed; the watermark stays.
create function public.feedback_digest_set(p_on boolean, p_url text default null) returns text
language plpgsql security definer set search_path = '' as $$
begin
  if not p_on then
    update public.app_switches set enabled = false, changed_at = now() where key = 'feedback_digest';
    perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'feedback-digest';
    return 'off';
  end if;
  if p_url is null or p_url !~ '^https?://' then
    raise exception 'feedback_digest_set(true, url) needs the feedback-digest function URL'
      using errcode = '22023';
  end if;
  if not exists (select from vault.decrypted_secrets where name = 'feedback_digest_secret') then
    raise exception 'vault secret feedback_digest_secret is missing'
      using errcode = '22023',
        hint = 'select vault.create_secret(''<FEEDBACK_DIGEST_SECRET>'', ''feedback_digest_secret'');';
  end if;
  update public.feedback_digest_state
  set since_created_at = now(), since_id = '00000000-0000-0000-0000-000000000000'
  where since_created_at is null;
  -- Healthy until the first hourly run, so the watch doesn't report a fresh switch-on as failed.
  update public.feedback_digest_state set last_ok_at = now(), last_error = null;
  insert into public.app_switches (key, enabled) values ('feedback_digest', true)
  on conflict (key) do update set enabled = true, changed_at = now();
  perform cron.schedule('feedback-digest', '0 * * * *', format(
    $cmd$select net.http_post(url := %L, headers := jsonb_build_object('content-type', 'application/json', 'x-feedback-digest-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'feedback_digest_secret')), body := '{}'::jsonb, timeout_milliseconds := 60000)$cmd$,
    p_url));
  return 'on';
end $$;

-- Only the owner runs these: the function connects as postgres, and the service key must not be
-- able to point the job, with the vault secret in its header, at another URL.
revoke execute on function public.feedback_digest_ts(timestamptz)
  from public, anon, authenticated, service_role;
revoke execute on function public.feedback_digest_batch(timestamptz)
  from public, anon, authenticated, service_role;
revoke execute on function public.feedback_digest_advance(text, uuid, text, uuid, date)
  from public, anon, authenticated, service_role;
revoke execute on function public.feedback_digest_record(text)
  from public, anon, authenticated, service_role;
revoke execute on function public.feedback_digest_status()
  from public, anon, authenticated, service_role;
revoke execute on function public.feedback_digest_set(boolean, text)
  from public, anon, authenticated, service_role;
