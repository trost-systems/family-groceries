-- Job 73: the public REST API (docs/API.md), the edge function `api`.
--   * API keys are personal access tokens of kind 'api' with scopes ({read} or {read,write}).
--     The app creates them from its own session (create_api_token); MCP and Siri never take them
--     (authenticate_access_token passes 'pat' and session-bound 'siri' rows only).
--   * api_begin() is the one call per request: the address's failed-authentication budget, the
--     key, then the key's token bucket and the household's day. Limits come in as arguments from
--     supabase/functions/api/limits.ts, the one place they are set.
--   * api_idempotency keeps a POST's first successful response for 24 hours per key.
--   * 'api' joins the integration lock (job 50): a Premium integration like Siri and MCP.
--   * purge_api_rate() deletes old counters and idempotency records daily (pg_cron).

-- API keys ----------------------------------------------------------------------------------------

alter table public.personal_access_tokens drop constraint personal_access_tokens_kind_check;
alter table public.personal_access_tokens add constraint personal_access_tokens_kind_check
  check (kind in ('pat', 'siri', 'api'));

alter table public.personal_access_tokens add column scopes text[];
alter table public.personal_access_tokens add constraint personal_access_tokens_scopes_check
  check (
    case when kind = 'api'
      then scopes is not null and scopes in ('{read}'::text[], '{read,write}'::text[])
      else scopes is null
    end
  );

comment on column public.personal_access_tokens.scopes is
  'Job 73: what an API key (kind api) may do: {read} or {read,write}. Null for every other kind.';

grant select (scopes) on public.personal_access_tokens to authenticated;

-- The app's own session only (no OAuth client, no token), like create_siri_credential: a
-- connected app cannot mint itself an API key. [p_scopes] is {read} or {read,write} in any order.
create function public.create_api_token(p_name text, p_scopes text[])
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

-- Rate counters (service connection only) ---------------------------------------------------------

create table public.api_token_buckets (
  token_id uuid primary key references public.personal_access_tokens (id) on delete cascade,
  tokens double precision not null check (tokens >= 0),
  refilled_at timestamptz not null
);

comment on table public.api_token_buckets is
  'Job 73: each API key''s token bucket (fill level at refilled_at). Service connection only.';

alter table public.api_token_buckets enable row level security;
revoke all on public.api_token_buckets from public, anon, authenticated;

create table public.api_household_days (
  household_id uuid not null references public.households (id) on delete cascade,
  day date not null,
  requests integer not null check (requests >= 0),
  primary key (household_id, day)
);

comment on table public.api_household_days is
  'Job 73: API requests per household and UTC day, all its keys together. Service connection only.';

alter table public.api_household_days enable row level security;
revoke all on public.api_household_days from public, anon, authenticated;
create policy api_household_days_member on public.api_household_days for select to authenticated
  using (public.is_household_member(household_id));

create table public.api_auth_failures (
  ip_hash text primary key check (ip_hash ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null,
  failures integer not null check (failures >= 0)
);

comment on table public.api_auth_failures is
  'Job 73: failed API authentications per address (SHA-256 of the IP, never the IP) in the current window. Service connection only.';

alter table public.api_auth_failures enable row level security;
revoke all on public.api_auth_failures from public, anon, authenticated;

-- One request: the key, the limits, and for an unknown key the address's failure budget. The
-- address is the gateway's X-Real-IP (never X-Forwarded-For, which hosted Supabase passes on as the
-- client sent it). Outcomes:
--   blocked - an unknown key from an address that used up its failed authentications;
--   invalid - no active API key with this hash; only an unknown one counts a failure, never a
--             missing key or one we know that ended (revoked, creator left, another kind);
--   limited - a valid key over its bucket or its household's day; nothing is taken;
--   ok      - one request taken from both.
-- rate_* describe the limit closest to running out (for blocked and invalid: the failure budget);
-- rate_reset is seconds until it is full again, retry_after (blocked, limited) seconds until a
-- request can succeed.
create function public.api_begin(
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

-- Idempotency records (service connection only) ---------------------------------------------------

create table public.api_idempotency (
  token_id uuid not null references public.personal_access_tokens (id) on delete cascade,
  key text not null check (key ~ '^[\x21-\x7e]{1,255}$'),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  status integer not null check (status between 200 and 299),
  -- json, not jsonb: a replay returns the first response's keys in their order.
  body json not null,
  created_at timestamptz not null default now(),
  primary key (token_id, key)
);

comment on table public.api_idempotency is
  'Job 73: a POST''s first successful response per API key and Idempotency-Key, replayed for 24 hours. Service connection only.';

alter table public.api_idempotency enable row level security;
revoke all on public.api_idempotency from public, anon, authenticated;

-- The integration lock knows the API --------------------------------------------------------------

alter table public.integration_blocks drop constraint integration_blocks_integration_check;
alter table public.integration_blocks add constraint integration_blocks_integration_check
  check (integration in ('siri', 'alexa', 'mcp', 'api'));

-- Job 72's rule (20261102120000_alexa_free.sql) plus 'api': Alexa stays free, the API needs
-- Premium like Siri and MCP while the lock is on.
create or replace function public.integration_gate(p_household uuid, p_integration text)
returns table (locked boolean, report boolean)
language plpgsql security definer set search_path = '' as $$
begin
  if p_integration not in ('siri', 'alexa', 'mcp', 'api') then
    raise exception 'unknown integration %', p_integration using errcode = '22023';
  end if;
  if p_integration = 'alexa'
    or not public.app_switch('integration_lock')
    or public.household_has_premium(p_household) then
    return query select false, false;
    return;
  end if;
  return query
    insert into public.integration_blocks as b (household_id, integration, reported_at)
    values (p_household, p_integration, now())
    on conflict (household_id, integration) do update set reported_at = now()
      where b.reported_at <= now() - interval '1 hour'
    returning true, true;
  if not found then
    return query select true, false;
  end if;
end $$;

revoke execute on function public.integration_gate(uuid, text) from public, anon, authenticated;

comment on table public.app_switches is
  'Job 47: server-side switches, set by the service role only (NEEDS_LEAD "Job 47", "Job 49", "Job 50"). household_archive: archiving a household on the last leave is allowed. premium_offer (job 49): the app may offer Hummlist Premium for sale. integration_lock (job 50): Siri, MCP and the API (job 73) need Hummlist Premium; Alexa stays free (job 72).';

-- Retention ---------------------------------------------------------------------------------------

-- Daily: household days before yesterday, buckets and failure windows untouched for a day (a
-- bucket left alone that long is full anyway), idempotency records older than 24 hours. Returns
-- how many rows went.
create function public.purge_api_rate() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_total integer := 0;
  v_count integer;
begin
  delete from public.api_household_days d where d.day < (now() at time zone 'utc')::date - 1;
  get diagnostics v_count = row_count;
  v_total := v_total + v_count;
  delete from public.api_token_buckets b where b.refilled_at < now() - interval '1 day';
  get diagnostics v_count = row_count;
  v_total := v_total + v_count;
  delete from public.api_auth_failures f where f.window_start < now() - interval '1 day';
  get diagnostics v_count = row_count;
  v_total := v_total + v_count;
  delete from public.api_idempotency i where i.created_at < now() - interval '24 hours';
  get diagnostics v_count = row_count;
  return v_total + v_count;
end $$;

revoke execute on function public.purge_api_rate() from public, anon, authenticated;

-- The same name replaces the job, so applying this again keeps one.
select cron.schedule('purge-api-rate', '41 3 * * *', 'select public.purge_api_rate()');
