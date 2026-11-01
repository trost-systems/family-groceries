-- Job 58: the household adds, renames and deletes its own stores (add_store, rename_store,
-- delete_store). Store names are unique per household ignoring case and spacing. A new store
-- named like one of the researched chains (dm, Lidl, EDEKA) becomes that chain with its walking
-- order; any other starts from the household's route order, every category shown. Onboarding
-- creates the stores the user picked (create_household's p_stores). Decisions:
-- docs/DECISIONS.md, "Job 58".

-- The identity of a store name: trimmed, inner whitespace collapsed, case folded.
create function public.store_name_key(p_name text) returns text
language sql immutable set search_path = '' as $$
  select lower(regexp_replace(btrim(p_name), '\s+', ' ', 'g'));
$$;

-- Names that clash under the new key keep their store, items and layout: every one but the first
-- (by sort order) gets a number, "Lidl (2)", which the household can rename or delete.
update public.stores s set name = left(btrim(s.name), 54) || ' (' || d.n || ')'
from (
  select id, row_number() over (
    partition by household_id, public.store_name_key(name) order by sort_order, created_at, id
  ) as n
  from public.stores
) d
where d.id = s.id and d.n > 1;

create unique index stores_household_name_key on public.stores (household_id, public.store_name_key(name));

-- The name as stored: trimmed and collapsed; null when empty, an error past 40 characters (the
-- table allows 60, for the names households already have).
create function public.store_name(p_name text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
begin
  if v_name = '' then
    raise exception 'store_name_empty' using errcode = '22023';
  end if;
  if char_length(v_name) > 40 then
    raise exception 'store_name_too_long' using errcode = '22001';
  end if;
  return v_name;
end $$;

-- One store's walking order: a researched chain's (docs/STORE_LAYOUTS.md) by its seed key,
-- else the route order; every category gets a row. Categories a layout does not list keep their
-- route order after the listed ones.
create function public.apply_store_layout(p_store uuid) returns void
language plpgsql set search_path = '' as $$
declare
  v_store public.stores := (select s from public.stores s where s.id = p_store);
begin
  delete from public.store_category_order where store_id = p_store;
  insert into public.store_category_order (household_id, store_id, category_id, sort_order, hidden)
  select v_store.household_id, v_store.id, c.id,
         row_number() over (order by coalesce(l.ord, 1000), c.sort_order, c.name) * 10,
         coalesce(l.hidden, false)
  from public.categories c
  left join (values
    -- STORE_LAYOUTS_BEGIN
    ('lidl', 'bakery', 1, false), ('lidl', 'produce', 2, false), ('lidl', 'chilled', 3, false),
    ('lidl', 'meat', 4, false), ('lidl', 'pantry', 5, false), ('lidl', 'sweets', 6, false),
    ('lidl', 'drinks', 7, false), ('lidl', 'frozen', 8, false), ('lidl', 'household', 9, false),
    ('lidl', 'drugstore', 10, false), ('lidl', 'other', 11, false),
    ('edeka', 'produce', 1, false), ('edeka', 'bakery', 2, false), ('edeka', 'meat', 3, false),
    ('edeka', 'chilled', 4, false), ('edeka', 'pantry', 5, false), ('edeka', 'sweets', 6, false),
    ('edeka', 'frozen', 7, false), ('edeka', 'drinks', 8, false), ('edeka', 'household', 9, false),
    ('edeka', 'drugstore', 10, false), ('edeka', 'other', 11, false),
    ('dm', 'drugstore', 1, false), ('dm', 'pantry', 2, false), ('dm', 'sweets', 3, false),
    ('dm', 'household', 4, false), ('dm', 'drinks', 5, false), ('dm', 'other', 6, false),
    ('dm', 'produce', 7, true), ('dm', 'bakery', 8, true), ('dm', 'chilled', 9, true),
    ('dm', 'meat', 10, true), ('dm', 'frozen', 11, true)
    -- STORE_LAYOUTS_END
  ) as l (store_key, category_key, ord, hidden)
    on l.store_key = v_store.seed_key and l.category_key = c.seed_key
  where c.household_id = v_store.household_id;
end $$;

-- The researched layouts now live in apply_store_layout alone.
create or replace function public.apply_default_store_layouts(p_household uuid) returns void
language plpgsql set search_path = '' as $$
begin
  perform public.apply_store_layout(s.id) from public.stores s where s.household_id = p_household;
end $$;

-- Creates the store after the household's last one, or returns the store that already has the
-- name (any case or spacing): creating and selecting a store is one idempotent step. "dm",
-- "Lidl" or "EDEKA" in any case becomes that chain (its brand defaults and researched walking
-- order) unless the household has that chain already.
create function public.add_store(p_household uuid, p_name text) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_name text := public.store_name(p_name);
  v_seed text := case public.store_name_key(v_name)
    when 'dm' then 'dm' when 'lidl' then 'lidl' when 'edeka' then 'edeka'
  end;
  v_store uuid;
begin
  if not public.is_household_member(p_household) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  if exists (select 1 from public.stores where household_id = p_household and seed_key = v_seed) then
    v_seed := null;
  end if;
  insert into public.stores (household_id, name, seed_key, sort_order)
  values (
    p_household, v_name, v_seed,
    coalesce((select max(sort_order) from public.stores where household_id = p_household), 0) + 10
  )
  on conflict (household_id, public.store_name_key(name)) do nothing
  returning id into v_store;

  if v_store is null then
    return (
      select id from public.stores
      where household_id = p_household and public.store_name_key(name) = public.store_name_key(v_name)
    );
  end if;

  perform public.apply_store_layout(v_store);
  return v_store;
end $$;

-- A preset store renamed to another name stops being that chain: its seed key goes, so the
-- chain's brand defaults (Balea -> dm) no longer pick it. A change of case or spacing keeps it.
create function public.rename_store(p_store uuid, p_name text) returns void
language plpgsql set search_path = '' as $$
declare
  v_store public.stores := (select s from public.stores s where s.id = p_store);
  v_name text := public.store_name(p_name);
begin
  if v_store.id is null or not public.is_household_member(v_store.household_id) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.stores
    where household_id = v_store.household_id and id <> p_store
      and public.store_name_key(name) = public.store_name_key(v_name)
  ) then
    raise exception 'store_name_taken' using errcode = '23505';
  end if;
  update public.stores
  set name = v_name,
      seed_key = case when public.store_name_key(v_name) = public.store_name_key(v_store.name) then seed_key end
  where id = p_store and (name, seed_key) is distinct from (
    v_name, case when public.store_name_key(v_name) = public.store_name_key(v_store.name) then seed_key end
  );
end $$;

-- Its items, open and bought, fall back to no store; its layout and memories go with it.
create function public.delete_store(p_store uuid) returns void
language plpgsql set search_path = '' as $$
declare
  v_household uuid := (select household_id from public.stores where id = p_store);
begin
  if v_household is null or not public.is_household_member(v_household) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  delete from public.stores where id = p_store;
end $$;

-- Onboarding: p_stores are the stores the user picked or typed, created in that order
-- (add_store). The new app sends p_default_stores false; the default stays true for old builds,
-- whose screen still offers "dm, Lidl und Edeka", and for scripts and fixtures.
-- squawk-ignore ban-drop-function -- replaced in this migration by a signature that takes every old call
drop function public.create_household(text, boolean);

create function public.create_household(
  p_name text default 'Unser Haushalt',
  p_default_stores boolean default true,
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
  perform public.seed_household(v_household.id, coalesce(p_default_stores, true));
  for v_name in select t.name from unnest(coalesce(p_stores, '{}')) with ordinality as t (name, ord) order by t.ord
  loop
    perform public.add_store(v_household.id, v_name);
  end loop;
  return v_household;
end $$;

-- apply_store_layout runs with the caller's rights (add_store calls it): RLS keeps it to the
-- caller's household, where it only resets a store to its default order.
revoke execute on function
  public.create_household(text, boolean, text[]),
  public.apply_store_layout(uuid)
from public, anon;
grant execute on function
  public.create_household(text, boolean, text[]),
  public.apply_store_layout(uuid)
to authenticated;

revoke execute on function
  public.store_name_key(text),
  public.store_name(text),
  public.add_store(uuid, text),
  public.rename_store(uuid, text),
  public.delete_store(uuid)
from public, anon;
grant execute on function
  public.store_name_key(text),
  public.store_name(text),
  public.add_store(uuid, text),
  public.rename_store(uuid, text),
  public.delete_store(uuid)
to authenticated;
