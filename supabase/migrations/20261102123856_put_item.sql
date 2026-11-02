-- Job 64b: an add the duplicate check skips answers with the open item that is there. Job 64's
-- items_skip_duplicate skipped the insert silently, so the app's upsert got no row, looked its id up,
-- found nothing and dropped its own copy: an undone delete or an add replayed after a partner added
-- the same item vanished until the next reload. The trigger now notes the open item it matched,
-- and put_item, the app's add from now on, returns that row. The existing row is kept as it is
-- (DECISIONS, Job 64b). Old builds keep their upsert and behave as before.

create or replace function public.items_skip_duplicate() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_open uuid;
begin
  if new.status <> 'active' then
    return new;
  end if;
  perform public.lock_household_items(new.household_id);
  select i.id into v_open from public.items i
  where i.household_id = new.household_id
    and i.normalized_name = new.normalized_name
    and i.status = 'active'
    and i.id <> new.id
    and public.open_item_key(i.name, i.brand, i.properties)
      = public.open_item_key(new.name, new.brand, new.properties)
  order by i.created_at
  limit 1;
  if found then
    -- Read by put_item and add_item: the row this add is.
    perform set_config('family_groceries.open_duplicate', v_open::text, true);
    return null;
  end if;
  return new;
end $$;

-- The app's add (ItemOp AddItem): inserts the client-made id, or answers with the row the add
-- already is. A retry finds its own row; an add that is already open (another member's, or a
-- duplicate left from before job 64) finds that item. No row: the id is taken by a row the caller
-- cannot see. [p_no_store]: leave the store empty instead of the remembered one.
create function public.put_item(
  p_id uuid,
  p_household uuid,
  p_name text,
  p_quantity text default null,
  p_brand text default null,
  p_properties text default null,
  p_category uuid default null,
  p_store uuid default null,
  p_sort_key double precision default null,
  p_status text default 'active',
  p_no_store boolean default false
) returns setof public.items
language plpgsql set search_path = '' as $$
declare
  v_row public.items;
begin
  perform set_config('family_groceries.open_duplicate', '', true);
  insert into public.items
    (id, household_id, name, quantity, brand, properties, category_id, store_id, sort_key, status)
  values
    (p_id, p_household, p_name, p_quantity, p_brand, p_properties, p_category, p_store, p_sort_key,
     p_status)
  on conflict (id) do nothing
  returning * into v_row;
  if found then
    if p_no_store and v_row.store_id is not null then
      update public.items set store_id = null where id = p_id returning * into v_row;
    end if;
    return next v_row;
    return;
  end if;
  return query select * from public.items where id = p_id;
  if found then
    return;
  end if;
  return query select * from public.items
    where id = nullif(current_setting('family_groceries.open_duplicate', true), '')::uuid;
end $$;

create or replace function public.add_item(
  p_household uuid,
  p_text text,
  p_store uuid default null,
  p_brand text default null,
  p_properties text default null,
  p_quantity text default null
) returns setof public.items
language plpgsql set search_path = '' as $$
declare
  v_parsed record;
  v_brand text;
  v_properties text;
  v_row public.items;
begin
  if auth.uid() is not null and not public.is_household_member(p_household) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  if char_length(btrim(p_brand)) > 60 or char_length(btrim(p_properties)) > 120 or char_length(btrim(p_quantity)) > 40 then
    raise exception 'value_too_long: brand <= 60, properties <= 120, quantity <= 40 characters'
      using errcode = '22001';
  end if;
  select * into v_parsed from public.parse_item(p_household, p_text);
  if v_parsed.name = '' then
    return;
  end if;
  v_brand := coalesce(p_brand, v_parsed.brand);
  v_properties := coalesce(p_properties, v_parsed.properties);
  perform public.lock_household_items(p_household);
  select * into v_row from public.items i
  where i.household_id = p_household and i.status = 'active'
    and public.item_name_key(concat_ws(' ', i.name, i.brand, i.properties))
      = public.item_name_key(concat_ws(' ', v_parsed.name, nullif(btrim(v_brand), ''), nullif(btrim(v_properties), '')))
  order by i.created_at
  limit 1;
  if found then
    return next v_row;
    return;
  end if;
  perform set_config('family_groceries.open_duplicate', '', true);
  insert into public.items (household_id, name, brand, properties, quantity, store_id)
  values (p_household, v_parsed.name, v_brand, v_properties, coalesce(p_quantity, v_parsed.quantity),
          coalesce(p_store, v_parsed.store_id))
  returning * into v_row;
  if found then
    return next v_row;
    return;
  end if;
  -- items_skip_duplicate found the same item with its details in another order.
  return query select * from public.items
    where id = nullif(current_setting('family_groceries.open_duplicate', true), '')::uuid;
end $$;

revoke execute on function public.put_item(
  uuid, uuid, text, text, text, text, uuid, uuid, double precision, text, boolean
) from public, anon;
grant execute on function public.put_item(
  uuid, uuid, text, text, text, text, uuid, uuid, double precision, text, boolean
) to authenticated;
