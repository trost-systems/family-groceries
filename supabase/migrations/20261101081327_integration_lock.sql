-- Job 50: Siri, Alexa and MCP / AI assistants are part of Hummlist Premium (Spec #4), behind the
-- server switch app_switches.integration_lock, seeded off (DECISIONS "Job 50", docs/PURCHASES.md).
--   * integration_gate() is the one check the integration endpoints call after authenticating:
--     with the switch off every household is open, as before job 50; with it on, a household
--     without premium (household_has_premium, job 49's rule at read time) is locked.
--   * A locked answer is noted per household and integration, so integration_blocked goes to
--     analytics at most once an hour for each (integration_blocks).
--   * integration_lock() tells the app whether the switch is on, so it shows the lock only when
--     the server enforces it.
-- Nothing here deletes, revokes or disconnects anything: a lapse or the switch locks at read time.

insert into public.app_switches (key, enabled) values ('integration_lock', false);

comment on table public.app_switches is
  'Job 47: server-side switches, set by the service role only (NEEDS_LEAD "Job 47", "Job 49", "Job 50"). household_archive: archiving a household on the last leave is allowed. premium_offer (job 49): the app may offer Hummlist Premium for sale. integration_lock (job 50): Siri, Alexa and MCP need Hummlist Premium.';

create table public.integration_blocks (
  household_id uuid not null references public.households (id) on delete cascade,
  integration text not null check (integration in ('siri', 'alexa', 'mcp')),
  reported_at timestamptz not null,
  primary key (household_id, integration)
);

comment on table public.integration_blocks is
  'Job 50: when integration_blocked last went to analytics for a locked household and integration (at most once an hour). Service connection only.';

alter table public.integration_blocks enable row level security;
revoke all on public.integration_blocks from public, anon, authenticated;

create policy integration_blocks_member on public.integration_blocks for select to authenticated
  using (public.is_household_member(household_id));

-- Whether [p_household] may use [p_integration] now, and, when it may not, whether this is the
-- first refusal for the pair within an hour (then the caller reports integration_blocked).
create function public.integration_gate(p_household uuid, p_integration text)
returns table (locked boolean, report boolean)
language plpgsql security definer set search_path = '' as $$
begin
  if p_integration not in ('siri', 'alexa', 'mcp') then
    raise exception 'unknown integration %', p_integration using errcode = '22023';
  end if;
  if not public.app_switch('integration_lock') or public.household_has_premium(p_household) then
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

-- Whether the server enforces the integration lock; the app shows the lock only then.
create function public.integration_lock() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.app_switch('integration_lock')
$$;

revoke execute on function public.integration_lock() from public, anon;
grant execute on function public.integration_lock() to authenticated;
