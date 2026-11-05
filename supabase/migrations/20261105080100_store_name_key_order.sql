-- Job 109: store_name_key and store_name trimmed before collapsing whitespace, and btrim trims
-- only spaces: "\tLidl\n" had the key " lidl ", so the unique index let it in next to "Lidl", and
-- add_store("\tRewe\n") stored " Rewe ". Both now collapse every whitespace run first, then trim:
-- the order of category_name_key (Job 90) and the app's key. Decisions: docs/DECISIONS.md,
-- "Job 109".

-- Stores that clash under the new key keep their items and layout: every one but the first (by
-- sort order) gets the first free number, "Lidl (2)", which the household can rename or delete
-- (Job 58's rule). The migration reports how many it renamed.
do $$
declare
  v_store record;
  v_base text;
  v_n integer;
  v_renamed integer := 0;
begin
  for v_store in
    select d.id, d.household_id, d.name
    from (
      select s.id, s.household_id, s.name, row_number() over (
        partition by s.household_id, lower(btrim(regexp_replace(s.name, '\s+', ' ', 'g')))
        order by s.sort_order, s.created_at, s.id
      ) as n
      from public.stores s
    ) d
    where d.n > 1
    order by d.household_id, d.n
  loop
    v_base := btrim(left(btrim(regexp_replace(v_store.name, '\s+', ' ', 'g')), 54));
    v_n := 2;
    while exists (
      select 1 from public.stores
      where household_id = v_store.household_id
        and lower(btrim(regexp_replace(name, '\s+', ' ', 'g'))) = lower(btrim(v_base || ' (' || v_n || ')'))
    ) loop
      v_n := v_n + 1;
    end loop;
    update public.stores set name = btrim(v_base || ' (' || v_n || ')') where id = v_store.id;
    v_renamed := v_renamed + 1;
  end loop;
  raise notice 'store_name_key_order: renamed % store(s) that shared a name key', v_renamed;
end $$;

create or replace function public.store_name_key(p_name text) returns text
language sql immutable set search_path = '' as $$
  select lower(btrim(regexp_replace(p_name, '\s+', ' ', 'g')));
$$;

reindex index public.stores_household_name_key;

create or replace function public.store_name(p_name text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
begin
  if v_name = '' then
    raise exception 'store_name_empty' using errcode = '22023';
  end if;
  if char_length(v_name) > 40 then
    raise exception 'store_name_too_long' using errcode = '22001';
  end if;
  return v_name;
end $$;

-- Names stored with whitespace at their ends (" Rewe " from the old store_name) or inside runs:
-- the same key, so no clash.
update public.stores
set name = btrim(regexp_replace(name, '\s+', ' ', 'g'))
where name is distinct from btrim(regexp_replace(name, '\s+', ' ', 'g'))
  and btrim(regexp_replace(name, '\s+', ' ', 'g')) <> '';
