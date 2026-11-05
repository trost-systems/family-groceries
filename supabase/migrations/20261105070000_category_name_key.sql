-- Job 90: category names are unique per household ignoring case and spacing, like store names
-- (Job 58): "baby" and "Baby" are one category. Duplicates households already have are merged
-- first; create_category returns the category the household already has. Decisions:
-- docs/DECISIONS.md, "Job 90".

-- The identity of a category name: whitespace runs (tabs, newlines too) collapsed to one space,
-- then trimmed, case folded; the same as the app's nameKey. btrim alone trims only spaces.
create function public.category_name_key(p_name text) returns text
language sql immutable set search_path = '' as $$
  select lower(btrim(regexp_replace(p_name, '\s+', ' ', 'g')));
$$;

-- Folds every category into the household's first one of the same name key: the fallback if it
-- is among them (it must stay), else the oldest. Items, their history, store layouts (shown if
-- either was shown, at the kept category's place) and learned corrections (added up) move to it,
-- and it takes over the merged one's seed keys for the classifier. Returns how many it merged; a
-- second run merges none. For this migration only: no client role (anon, authenticated,
-- service_role) may run it, only the owner (postgres).
create function public.merge_duplicate_categories() returns integer
language plpgsql set search_path = '' as $$
declare
  v_pair record;
  v_merged integer := 0;
  v_learning text := coalesce(current_setting('family_groceries.learning', true), '');
begin
  perform set_config('family_groceries.learning', 'off', true);
  for v_pair in
    select d.id as loser, d.keeper, d.seed_key, d.absorbed_seed_keys
    from (
      select c.id, c.seed_key, c.absorbed_seed_keys,
        first_value(c.id) over w as keeper, row_number() over w as n
      from public.categories c
      window w as (
        partition by c.household_id, public.category_name_key(c.name)
        order by c.seed_key is not distinct from 'other' desc, c.created_at, c.sort_order, c.id
      )
    ) d
    where d.n > 1
  loop
    update public.items set category_id = v_pair.keeper where category_id = v_pair.loser;
    update public.item_events set category_id = v_pair.keeper where category_id = v_pair.loser;

    insert into public.store_category_order as o (household_id, store_id, category_id, sort_order, hidden)
    select household_id, store_id, v_pair.keeper, sort_order, hidden
    from public.store_category_order where category_id = v_pair.loser
    on conflict (store_id, category_id) do update set hidden = o.hidden and excluded.hidden;

    insert into public.category_memory as m
      (household_id, item_key, category_id, corrections, updated_at, undo_item, undo_by, undo_prev_at, undo_at)
    select household_id, item_key, v_pair.keeper, corrections, updated_at, undo_item, undo_by, undo_prev_at, undo_at
    from public.category_memory where category_id = v_pair.loser
    on conflict (household_id, item_key, category_id) do update
      set corrections = m.corrections + excluded.corrections,
        updated_at = greatest(m.updated_at, excluded.updated_at),
        undo_item = null, undo_by = null, undo_prev_at = null, undo_at = null;

    -- array[null] is {NULL}, not null: drop it, and the keeper's own seed key, and repeats.
    update public.categories c
    set absorbed_seed_keys = array(
      select distinct k
      from unnest(c.absorbed_seed_keys || array[v_pair.seed_key] || v_pair.absorbed_seed_keys) k
      where k is not null and k is distinct from c.seed_key
      order by k
    )
    where c.id = v_pair.keeper;
    delete from public.categories where id = v_pair.loser;
    v_merged := v_merged + 1;
  end loop;
  perform set_config('family_groceries.learning', v_learning, true);
  return v_merged;
end $$;

revoke execute on function public.merge_duplicate_categories() from public, anon, authenticated, service_role;

select public.merge_duplicate_categories();

create unique index categories_household_name_key on public.categories (household_id, public.category_name_key(name));

-- A new category goes before the fallback when the fallback is last, else at the end, in the
-- route and in every store. A name the household has already, in any case or spacing, returns
-- that category instead.
create or replace function public.create_category(p_household uuid, p_name text) returns public.categories
language plpgsql set search_path = '' as $$
declare
  v_category public.categories;
  v_ids uuid[];
  v_store record;
begin
  if not public.is_household_member(p_household) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  insert into public.categories (household_id, name, sort_order)
  values (p_household, btrim(regexp_replace(p_name, '\s+', ' ', 'g')), 0)
  on conflict (household_id, public.category_name_key(name)) do nothing
  returning * into v_category;

  if v_category.id is null then
    return (
      select c from public.categories c
      where c.household_id = p_household and public.category_name_key(c.name) = public.category_name_key(p_name)
    );
  end if;

  select array_agg(id order by sort_order, name) into v_ids
  from public.categories where household_id = p_household and id <> v_category.id;
  perform public.reorder_categories(p_household, public.insert_before_fallback(p_household, v_ids, v_category.id));

  for v_store in
    select s.id, coalesce(array_agg(o.category_id order by o.sort_order) filter (where o.category_id is not null), '{}') as ids,
           coalesce(array_agg(o.category_id) filter (where o.hidden), '{}') as hidden
    from public.stores s left join public.store_category_order o on o.store_id = s.id
    where s.household_id = p_household
    group by s.id
  loop
    perform public.set_store_layout(
      v_store.id, public.insert_before_fallback(p_household, v_store.ids, v_category.id, v_store.hidden), v_store.hidden
    );
  end loop;
  return (select c from public.categories c where c.id = v_category.id);
end $$;

revoke execute on function public.category_name_key(text) from public, anon;
grant execute on function public.category_name_key(text) to authenticated;
