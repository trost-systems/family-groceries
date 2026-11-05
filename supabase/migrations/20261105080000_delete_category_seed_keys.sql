-- Job 109: delete_category appended {NULL} to the target's absorbed_seed_keys whenever the deleted
-- category had no seed key: array[NULL] is {NULL}, not NULL, so the coalesce never fired. It now
-- hands over only real keys, each once, sorted, never the target's own seed key: the rule
-- merge_duplicate_categories (Job 90) uses. The NULLs the old function left are removed and a
-- check keeps every writer from adding one. Decisions: docs/DECISIONS.md, "Job 109".

create or replace function public.delete_category(p_category uuid, p_reassign_to uuid default null) returns void
language plpgsql set search_path = '' as $$
declare
  v_deleted public.categories := (select c from public.categories c where c.id = p_category);
  v_target uuid;
begin
  if v_deleted.id is null or not public.is_household_member(v_deleted.household_id) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  if v_deleted.seed_key = 'other' then
    raise exception 'fallback_category_required' using errcode = 'P0001';
  end if;
  v_target := coalesce(
    p_reassign_to,
    (select id from public.categories where household_id = v_deleted.household_id and seed_key = 'other')
  );
  if v_target = p_category
     or not exists (select 1 from public.categories where id = v_target and household_id = v_deleted.household_id) then
    raise exception 'invalid_reassign_target' using errcode = '22023';
  end if;

  perform set_config('family_groceries.learning', 'off', true);
  update public.items set category_id = v_target where category_id = p_category;
  perform set_config('family_groceries.learning', 'on', true);

  update public.categories c
  set absorbed_seed_keys = array(
    select distinct k
    from unnest(c.absorbed_seed_keys || array[v_deleted.seed_key] || v_deleted.absorbed_seed_keys) k
    where k is not null and k is distinct from c.seed_key
    order by k
  )
  where c.id = v_target;
  delete from public.categories where id = p_category;
end $$;

update public.categories
set absorbed_seed_keys = array(
  select distinct k from unnest(absorbed_seed_keys) k where k is not null and k is distinct from seed_key order by k
)
where array_position(absorbed_seed_keys, null) is not null;

alter table public.categories
  add constraint categories_absorbed_seed_keys_not_null check (array_position(absorbed_seed_keys, null) is null) not valid;
alter table public.categories validate constraint categories_absorbed_seed_keys_not_null;
