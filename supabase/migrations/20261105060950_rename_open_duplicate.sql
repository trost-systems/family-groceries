-- Job 104: a rename never makes a second open copy of an item. Job 64's items_skip_duplicate only
-- checks inserts, so renaming Apfelsaft to „Mineralwasser“ while Mineralwasser was open left two
-- open Mineralwasser rows. An update that gives an open item the name, brand and details of
-- another open item (open_item_key: folded, details in any order) now fails with 23505
-- already_on_list. The app merges such a rename into the open item before it sends anything
-- (ListCubit.edit); this is the guard for every other writer. Unticking stays possible while a
-- copy is open: only a changed key is checked. merge_items deletes the merged row before the kept
-- row takes its brand or details, so Zusammenführen of "Butter" and "Butter Kerrygold" passes.

-- Runs after items_before_write (trigger order is by name), so the text is already trimmed.
create function public.items_rename_duplicate() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_key text;
begin
  if new.status <> 'active' then
    return new;
  end if;
  v_key := public.open_item_key(new.name, new.brand, new.properties);
  if v_key = public.open_item_key(old.name, old.brand, old.properties) then
    return new;
  end if;
  perform public.lock_household_items(new.household_id);
  if exists (
    select from public.items i
    where i.household_id = new.household_id
      and i.normalized_name = new.normalized_name
      and i.status = 'active'
      and i.id <> new.id
      and public.open_item_key(i.name, i.brand, i.properties) = v_key
  ) then
    raise exception 'already_on_list' using errcode = '23505',
      detail = 'Another open item has this name, brand and details.';
  end if;
  return new;
end $$;

create trigger items_rename_duplicate before update of name, brand, properties on public.items
for each row execute function public.items_rename_duplicate();

-- As in 20261030160000_dedupe_merge.sql, with the other row deleted before the update.
create or replace function public.merge_items(p_merge uuid, p_keep uuid, p_other uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_done public.item_merges;
  v_keep public.items;
  v_other public.items;
  v_before jsonb;
begin
  if p_merge is null or p_keep is null or p_other is null then
    raise exception 'missing_argument' using errcode = '22023';
  end if;
  select * into v_done from public.item_merges where id = p_merge;
  if found then
    if not public.is_household_member(v_done.household_id) then
      raise exception 'not_a_member' using errcode = '42501';
    end if;
    return public.merge_result(v_done.kept_id, (v_done.merged_row ->> 'id')::uuid);
  end if;
  if p_keep = p_other then
    raise exception 'same_item' using errcode = '22023';
  end if;
  -- Both rows locked in id order, so two merges of the same pair cannot deadlock.
  perform from public.items where id in (p_keep, p_other) order by id for update;
  select * into v_keep from public.items where id = p_keep;
  select * into v_other from public.items where id = p_other;
  if v_keep.id is null or v_other.id is null then
    if (v_keep.id is not null and not public.is_household_member(v_keep.household_id))
       or (v_other.id is not null and not public.is_household_member(v_other.household_id)) then
      raise exception 'not_a_member' using errcode = '42501';
    end if;
    raise exception 'item_not_found' using errcode = 'P0002';
  end if;
  if not public.is_household_member(v_keep.household_id)
     or not public.is_household_member(v_other.household_id) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  if v_keep.household_id <> v_other.household_id then
    raise exception 'other_household' using errcode = '22023';
  end if;
  if v_keep.status <> 'active' or v_other.status <> 'active' then
    raise exception 'not_open' using errcode = '22023';
  end if;

  delete from public.item_merges where household_id = v_keep.household_id and created_at < now() - interval '30 days';
  v_before := to_jsonb(v_keep);
  perform set_config('family_groceries.learning', 'off', true);
  -- The other row goes first: with it still open, filling in its brand or details would give the
  -- kept row its key, which items_rename_duplicate refuses.
  delete from public.items where id = p_other;
  update public.items set
    quantity = public.merge_quantities(v_keep.quantity, v_other.quantity),
    brand = coalesce(v_keep.brand, v_other.brand),
    properties = coalesce(v_keep.properties, v_other.properties)
  where id = p_keep
  returning * into v_keep;
  perform set_config('family_groceries.learning', '', true);
  insert into public.item_merges (id, household_id, kept_id, kept_before, kept_after, merged_row)
  values (
    p_merge, v_keep.household_id, p_keep,
    v_before,
    jsonb_build_object('quantity', v_keep.quantity, 'brand', v_keep.brand, 'properties', v_keep.properties),
    to_jsonb(v_other)
  );
  return public.merge_result(p_keep, p_other);
end $$;
