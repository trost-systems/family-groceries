-- Job 64: one open item per name, brand and details, also when two members add it at the same
-- moment. The app checks its own list before an add, but two phones (or a phone and Siri) adding
-- "Milch" at once each saw a list without it, and both rows landed. Every insert now takes the
-- household's item lock and is skipped when an open item with the same key is there: the app's
-- upsert then gets no row back and acknowledges its add with the row that is there (as for a
-- replayed add), MCP, Siri and Alexa (add_item) return the existing row. Ticked items and
-- updates are not checked: putting an item back stays possible while a copy is open.

-- The app's duplicate rule (ListCubit._sameItem): name and brand folded, details folded and in
-- any order.
create function public.open_item_key(p_name text, p_brand text, p_properties text) returns text
language sql immutable set search_path = '' as $$
  select concat_ws('|',
    public.normalize_item_name(p_name),
    public.normalize_item_name(coalesce(p_brand, '')),
    coalesce((
      select string_agg(p.folded, ',' order by p.folded collate "C")
      from (
        select public.normalize_item_name(t) as folded
        from unnest(string_to_array(coalesce(p_properties, ''), ',')) as t
      ) p
      where p.folded <> ''
    ), ''));
$$;

-- Held to the end of the transaction, so a second add waits until the first is committed and
-- then sees it.
create function public.lock_household_items(p_household uuid) returns void
language sql set search_path = '' as $$
  select pg_advisory_xact_lock(hashtextextended('items:' || p_household::text, 0));
$$;

-- Runs after items_before_write (trigger order is by name), so name, brand, properties and
-- normalized_name are already trimmed and folded.
create function public.items_skip_duplicate() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status <> 'active' then
    return new;
  end if;
  perform public.lock_household_items(new.household_id);
  if exists (
    select 1 from public.items i
    where i.household_id = new.household_id
      and i.normalized_name = new.normalized_name
      and i.status = 'active'
      and i.id <> new.id
      and public.open_item_key(i.name, i.brand, i.properties)
        = public.open_item_key(new.name, new.brand, new.properties)
  ) then
    return null;
  end if;
  return new;
end $$;

create trigger items_skip_duplicate before insert on public.items
for each row execute function public.items_skip_duplicate();

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
  if not found then
    insert into public.items (household_id, name, brand, properties, quantity, store_id)
    values (p_household, v_parsed.name, v_brand, v_properties, coalesce(p_quantity, v_parsed.quantity),
            coalesce(p_store, v_parsed.store_id))
    returning * into v_row;
    if not found then
      -- items_skip_duplicate found the same item with its details in another order.
      select * into v_row from public.items i
      where i.household_id = p_household and i.status = 'active'
        and public.open_item_key(i.name, i.brand, i.properties)
          = public.open_item_key(v_parsed.name, nullif(btrim(v_brand), ''), nullif(btrim(v_properties), ''))
      order by i.created_at
      limit 1;
    end if;
  end if;
  return next v_row;
end $$;

revoke execute on function
  public.open_item_key(text, text, text),
  public.lock_household_items(uuid)
from public, anon;
grant execute on function
  public.open_item_key(text, text, text),
  public.lock_household_items(uuid)
to authenticated, service_role;
