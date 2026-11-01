-- Job 64: a household starts with no store unless one was picked (Peter, job 58). The app sends
-- p_default_stores false since job 22, so this changes only callers that leave it out: builds
-- older than job 22 (their onboarding offered no store choice) and the scripts, fixtures and
-- tests, which now create the stores they need. p_default_stores true still seeds dm, Lidl and
-- Edeka for builds whose onboarding ticked "dm, Lidl und Edeka".
create or replace function public.create_household(
  p_name text default 'Unser Haushalt',
  p_default_stores boolean default false,
  p_stores text[] default '{}'
) returns public.households
language plpgsql security definer set search_path = '' as $$
declare
  v_household public.households;
  v_name text;
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
  perform public.seed_household(v_household.id, coalesce(p_default_stores, false));
  for v_name in select t.name from unnest(coalesce(p_stores, '{}')) with ordinality as t (name, ord) order by t.ord
  loop
    perform public.add_store(v_household.id, v_name);
  end loop;
  return v_household;
end $$;
