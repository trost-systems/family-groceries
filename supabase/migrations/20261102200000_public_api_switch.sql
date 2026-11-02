-- Job 75: the public API (job 73) is off on a server until app_switches.public_api is on. Off, every
-- request answers like an unknown path and no API key can be made; listing and revoking keys stays.
-- MCP, Siri and Alexa do not read this switch.

insert into public.app_switches (key, enabled) values ('public_api', false);

comment on table public.app_switches is
  'Job 47: server-side switches, set by the service role only (NEEDS_LEAD "Job 47", "Job 49", "Job 50"). household_archive: archiving a household on the last leave is allowed. premium_offer (job 49): the app may offer Hummlist Premium for sale. integration_lock (job 50): Siri, MCP and the API (job 73) need Hummlist Premium; Alexa stays free (job 72). public_api (job 75): the public API is served and API keys can be made.';

-- The app's own session only (no OAuth client, no token), like create_siri_credential: a
-- connected app cannot mint itself an API key. [p_scopes] is {read} or {read,write} in any order.
create or replace function public.create_api_token(p_name text, p_scopes text[])
returns table (id uuid, name text, token text, scopes text[])
language plpgsql security definer set search_path = '' as $$
declare
  v_claims jsonb := coalesce(auth.jwt(), '{}'::jsonb);
  v_household uuid;
  v_scopes text[];
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not public.app_switch('public_api') then
    raise exception 'api_disabled' using errcode = '42501',
      hint = 'The public API is switched off on this server (app_switches.public_api).';
  end if;
  if v_claims ? 'client_id' or nullif(v_claims ->> 'session_id', '') is null then
    raise exception 'session_required' using errcode = '42501';
  end if;
  select m.household_id into v_household from public.household_members m where m.user_id = auth.uid();
  if v_household is null then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  select array_agg(distinct s order by s) into v_scopes from unnest(p_scopes) s;
  if v_scopes is null or v_scopes not in ('{read}'::text[], '{read,write}'::text[]) then
    raise exception 'invalid_scopes' using errcode = '22023';
  end if;
  if (select count(*) from public.personal_access_tokens t
      where t.user_id = auth.uid() and t.revoked_at is null and t.kind = 'api') >= 10 then
    raise exception 'too_many_tokens' using errcode = 'P0001';
  end if;
  -- 32 random bytes, base64url without padding: 43 characters after the prefix.
  v_token := 'fgp_' || rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  return query
  insert into public.personal_access_tokens as t
    (household_id, user_id, name, token_hash, token_hint, kind, scopes)
  values (
    v_household,
    auth.uid(),
    coalesce(nullif(btrim(p_name), ''), 'API'),
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    right(v_token, 4),
    'api',
    v_scopes
  )
  returning t.id, t.name, v_token, t.scopes;
end $$;

revoke execute on function public.create_api_token(text, text[]) from public, anon;
grant execute on function public.create_api_token(text, text[]) to authenticated;

-- One request: the key, the limits, and for an unknown key the address's failure budget. The
-- address is the gateway's X-Real-IP (never X-Forwarded-For, which hosted Supabase passes on as the
-- client sent it). Outcomes:
--   disabled - app_switches.public_api is off: nothing is read or written, no key, no limit;
--   blocked - an unknown key from an address that used up its failed authentications;
--   invalid - no active API key with this hash; only an unknown one counts a failure, never a
--             missing key or one we know that ended (revoked, creator left, another kind);
--   limited - a valid key over its bucket or its household's day; nothing is taken;
--   ok      - one request taken from both.
-- rate_* describe the limit closest to running out (for blocked and invalid: the failure budget);
-- rate_reset is seconds until it is full again, retry_after (blocked, limited) seconds until a
-- request can succeed.
create or replace function public.api_begin(
  p_token_hash text,
  p_ip_hash text,
  p_burst integer,
  p_per_minute integer,
  p_per_day integer,
  p_failures integer,
  p_failure_window integer
)
returns table (
  outcome text,
  token_id uuid,
  user_id uuid,
  household_id uuid,
  scopes text[],
  rate_limit integer,
  rate_remaining integer,
  rate_reset integer,
  retry_after integer
)
language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := now();
  v_window interval := make_interval(secs => p_failure_window);
  v_rate double precision := p_per_minute / 60.0;
  v_day date := (v_now at time zone 'utc')::date;
  v_day_reset integer := ceil(extract(epoch from ((v_day + 1)::timestamp at time zone 'utc') - v_now))::integer;
  v_fail_start timestamptz;
  v_failures integer;
  v_key record;
  v_tokens double precision;
  v_requests integer;
  v_bucket_reset integer;
begin
  if not public.app_switch('public_api') then
    return query select 'disabled', null::uuid, null::uuid, null::uuid, null::text[], 0, 0, 0, null::integer;
    return;
  end if;

  select t.id, t.user_id, t.household_id, t.scopes into v_key
  from public.personal_access_tokens t
  join public.household_members m on m.user_id = t.user_id and m.household_id = t.household_id
  where t.token_hash = p_token_hash and t.kind = 'api' and t.revoked_at is null;

  if not found then
    select f.window_start, f.failures into v_fail_start, v_failures
    from public.api_auth_failures f
    where f.ip_hash = p_ip_hash and f.window_start > v_now - v_window;
    -- No key, or one we know that ended (revoked, its creator left, an MCP or Siri token): a client
    -- nobody updated, not a guess. It costs the address nothing, so an integration polling with a
    -- revoked key never blocks others behind the same address.
    if p_token_hash is null or p_ip_hash is null or exists (
      select from public.personal_access_tokens t where t.token_hash = p_token_hash
    ) then
      return query select 'invalid', null::uuid, null::uuid, null::uuid, null::text[], p_failures,
        greatest(p_failures - coalesce(v_failures, 0), 0),
        coalesce(ceil(extract(epoch from v_fail_start + v_window - v_now))::integer, 0), null::integer;
      return;
    end if;
    if v_failures >= p_failures then
      return query select 'blocked', null::uuid, null::uuid, null::uuid, null::text[], p_failures, 0,
        ceil(extract(epoch from v_fail_start + v_window - v_now))::integer,
        ceil(extract(epoch from v_fail_start + v_window - v_now))::integer;
      return;
    end if;
    -- Ended windows go as new failures come, a hundred at a time, so the table holds about the
    -- addresses that failed in the last window whatever the rate (the daily purge sweeps the rest).
    delete from public.api_auth_failures f where f.ctid in (
      select g.ctid from public.api_auth_failures g where g.window_start <= v_now - v_window limit 100
    );
    insert into public.api_auth_failures as f (ip_hash, window_start, failures)
    values (p_ip_hash, v_now, 1)
    on conflict (ip_hash) do update set
      window_start = case when f.window_start <= v_now - v_window then v_now else f.window_start end,
      failures = case when f.window_start <= v_now - v_window then 1 else f.failures + 1 end
    returning f.window_start, f.failures into v_fail_start, v_failures;
    return query select 'invalid', null::uuid, null::uuid, null::uuid, null::text[], p_failures,
      greatest(p_failures - v_failures, 0),
      ceil(extract(epoch from v_fail_start + v_window - v_now))::integer, null::integer;
    return;
  end if;

  -- Always the bucket first, then the day: concurrent requests lock in one order.
  insert into public.api_token_buckets (token_id, tokens, refilled_at)
  values (v_key.id, p_burst, v_now)
  on conflict on constraint api_token_buckets_pkey do nothing;
  select least(p_burst::double precision,
               b.tokens + greatest(extract(epoch from v_now - b.refilled_at), 0) * v_rate)
  into v_tokens
  from public.api_token_buckets b where b.token_id = v_key.id for update;

  insert into public.api_household_days (household_id, day, requests)
  values (v_key.household_id, v_day, 0)
  on conflict on constraint api_household_days_pkey do nothing;
  select d.requests into v_requests
  from public.api_household_days d
  where d.household_id = v_key.household_id and d.day = v_day for update;

  if v_tokens < 1 or v_requests >= p_per_day then
    update public.api_token_buckets b set tokens = v_tokens, refilled_at = v_now
    where b.token_id = v_key.id;
    return query select 'limited', v_key.id, v_key.user_id, v_key.household_id, v_key.scopes,
      case when v_requests >= p_per_day then p_per_day else p_burst end,
      0,
      case when v_requests >= p_per_day then v_day_reset
        else ceil((p_burst - v_tokens) / v_rate)::integer end,
      greatest(
        case when v_tokens < 1 then ceil((1 - v_tokens) / v_rate)::integer else 0 end,
        case when v_requests >= p_per_day then v_day_reset else 0 end
      );
    return;
  end if;

  v_tokens := v_tokens - 1;
  v_requests := v_requests + 1;
  update public.api_token_buckets b set tokens = v_tokens, refilled_at = v_now
  where b.token_id = v_key.id;
  update public.api_household_days d set requests = v_requests
  where d.household_id = v_key.household_id and d.day = v_day;
  update public.personal_access_tokens t set last_used_at = v_now where t.id = v_key.id;

  v_bucket_reset := ceil((p_burst - v_tokens) / v_rate)::integer;
  if floor(v_tokens) <= p_per_day - v_requests then
    return query select 'ok', v_key.id, v_key.user_id, v_key.household_id, v_key.scopes, p_burst,
      floor(v_tokens)::integer, v_bucket_reset, null::integer;
  else
    return query select 'ok', v_key.id, v_key.user_id, v_key.household_id, v_key.scopes, p_per_day,
      p_per_day - v_requests, v_day_reset, null::integer;
  end if;
end $$;

revoke execute on function public.api_begin(text, text, integer, integer, integer, integer, integer)
  from public, anon, authenticated;
