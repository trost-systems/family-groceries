-- Job 94: OAuth Client ID Metadata Documents for MCP clients (protocol 2026-07-28). Supabase Auth
-- does not resolve a client_id URL, so the mcp function maps each document URL to one Supabase
-- OAuth client it registers through the admin API, and keeps that client's name and redirect URIs
-- in step with the document. Only the function's service connection reads or writes this table.
create table public.oauth_cimd_clients (
  client_id text primary key check (client_id like 'https://%'),
  auth_client_id uuid not null unique,
  client_name text not null,
  redirect_uris text[] not null check (cardinality(redirect_uris) > 0),
  client_uri text,
  -- The document is fetched again after this (its Cache-Control max-age, 5 min .. 1 day).
  fresh_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.oauth_cimd_clients enable row level security;
revoke all on public.oauth_cimd_clients from public, anon, authenticated;

-- The front's own limits, per hour: document fetches per host and in all, new clients per host and
-- in all, token requests per hashed client address. Keys are 'fetch:<host>', 'new:<host>',
-- 'token:<sha256 of the address>' and the totals 'fetch:all', 'new:all'. Rows go 2 hours after
-- their window.
create table public.oauth_cimd_rate (
  key text not null check (key ~ '^(fetch|new|token):.+$'),
  window_start timestamptz not null,
  hits integer not null check (hits >= 0),
  primary key (key, window_start)
);

alter table public.oauth_cimd_rate enable row level security;
revoke all on public.oauth_cimd_rate from public, anon, authenticated;

-- Counts one hit for every key and returns whether each stays within its limit this hour.
create function public.oauth_cimd_rate_hit(p_keys text[], p_limits integer[])
returns boolean
language plpgsql set search_path = '' as $$
declare
  v_window timestamptz := date_trunc('hour', now());
  v_ok boolean := true;
  v_hits integer;
begin
  if cardinality(p_keys) <> cardinality(p_limits) then
    raise exception 'one limit per key' using errcode = '22023';
  end if;
  delete from public.oauth_cimd_rate r where r.window_start < now() - interval '2 hours';
  for i in 1 .. cardinality(p_keys) loop
    insert into public.oauth_cimd_rate as r (key, window_start, hits)
    values (p_keys[i], v_window, 1)
    on conflict (key, window_start) do update set hits = r.hits + 1
    returning r.hits into v_hits;
    v_ok := v_ok and v_hits <= p_limits[i];
  end loop;
  return v_ok;
end $$;

revoke execute on function public.oauth_cimd_rate_hit(text[], integer[]) from public, anon, authenticated;
