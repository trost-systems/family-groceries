-- Alexa stays free (Peter Q39 = AP1, Legal Review N-27): the integration lock covers Siri and
-- MCP only. The alexa function no longer asks; an alexa function deployed before it is answered
-- open here. 'alexa' stays a valid value (integration_blocks keeps its check and old rows), so
-- nothing old builds rely on is dropped.

comment on table public.app_switches is
  'Job 47: server-side switches, set by the service role only (NEEDS_LEAD "Job 47", "Job 49", "Job 50"). household_archive: archiving a household on the last leave is allowed. premium_offer (job 49): the app may offer Hummlist Premium for sale. integration_lock (job 50): Siri and MCP need Hummlist Premium; Alexa stays free (job 72).';

create or replace function public.integration_gate(p_household uuid, p_integration text)
returns table (locked boolean, report boolean)
language plpgsql security definer set search_path = '' as $$
begin
  if p_integration not in ('siri', 'alexa', 'mcp') then
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
