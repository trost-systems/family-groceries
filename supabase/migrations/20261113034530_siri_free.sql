-- Siri stays free like Alexa (job 184, Peter): the integration lock covers MCP and the API only.
-- The voice function no longer asks; a voice function deployed before it is answered open here.
-- 'siri' stays a valid value (integration_blocks keeps its check and old rows), so nothing old
-- builds rely on is dropped. Job 185's per-user gate is redefined with the same body otherwise;
-- the two-argument form still delegates to it.

comment on table public.app_switches is
  'Job 47: server-side switches, set by the service role only (NEEDS_LEAD "Job 47", "Job 49", "Job 50"). household_archive: archiving a household on the last leave is allowed. premium_offer (job 49): the app may offer Snacklist Premium for sale. integration_lock (job 50): MCP and the API (job 73) need Snacklist Premium; Siri (job 184) and Alexa (job 72) stay free. public_api (job 75): the public API is served and API keys can be made.';

create or replace function public.integration_gate(p_household uuid, p_integration text, p_user uuid)
returns table (locked boolean, report boolean)
language plpgsql security definer set search_path = '' as $$
begin
  if p_integration not in ('siri', 'alexa', 'mcp', 'api') then
    raise exception 'unknown integration %', p_integration using errcode = '22023';
  end if;
  if p_integration in ('siri', 'alexa')
    or not public.app_switch('integration_lock')
    or public.household_has_premium(p_household)
    or public.user_has_premium(p_user) then
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

revoke execute on function public.integration_gate(uuid, text, uuid) from public, anon, authenticated;
