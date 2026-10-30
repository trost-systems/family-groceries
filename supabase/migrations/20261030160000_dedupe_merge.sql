-- Job 32b (Spec #8 Part B): the duplicate hint and its one-tap merge.
--
-- An item added while an open item with the same canonical key (job 32a: "Karotten" and
-- "Möhren" both give "mohr") is on the list is still added. The app then offers to merge the
-- two; MCP, Siri and voice say that a similar item is already on the list (similar_items).
--
-- merge_items folds the new item into the open one in one transaction: the open item keeps its
-- text, the quantities merge by merge_quantities, the other row is deleted. item_merges keeps
-- both rows as they were, so unmerge_items puts both back exactly (the second item with its id,
-- text, quantity, category, store, place, who added it and when), also after other members
-- synced. Decisions: docs/DECISIONS.md, "Job 32b".

-- Quantities ---------------------------------------------------------------------------------

-- What a quantity word measures: 'mass' (g, kg) and 'vol' (ml, l) convert (factor to g or ml),
-- 'count' is a bare number or Stück, 'unit:<word>' any other unit, which sums only with itself
-- (singular and plural count as one: "1 Packung" + "2 Packungen"). The PM's ruling (2026-10-29):
-- g/kg and ml/l convert, Stück sums only with Stück.
create function public.quantity_unit(
  p_word text, out kind text, out factor numeric, out singular text, out plural text
)
language plpgsql immutable set search_path = '' as $$
declare
  v_word text := lower(rtrim(btrim(coalesce(p_word, '')), '.'));
  v_pair text[];
begin
  factor := 1;
  if v_word in ('', 'stk', 'stück', 'st') then
    kind := 'count';
  elsif v_word in ('g', 'gr', 'gramm') then
    kind := 'mass';
  elsif v_word in ('kg', 'kilo', 'kilogramm') then
    kind := 'mass';
    factor := 1000;
  elsif v_word in ('ml', 'milliliter') then
    kind := 'vol';
  elsif v_word in ('l', 'liter') then
    kind := 'vol';
    factor := 1000;
  else
    select array[s, p] into v_pair
    from (values
      ('packung', 'packungen'), ('pack', 'packs'), ('paket', 'pakete'), ('dose', 'dosen'),
      ('büchse', 'büchsen'), ('flasche', 'flaschen'), ('glas', 'gläser'), ('tüte', 'tüten'),
      ('tube', 'tuben'), ('sack', 'säcke'), ('netz', 'netze'), ('kiste', 'kisten'),
      ('kasten', 'kästen'), ('karton', 'kartons'), ('rolle', 'rollen'), ('tafel', 'tafeln'),
      ('stange', 'stangen'), ('schale', 'schalen'), ('scheibe', 'scheiben'), ('laib', 'laibe'),
      ('kopf', 'köpfe')
    ) as w (s, p)
    where v_word in (w.s, w.p);
    singular := coalesce(v_pair[1], v_word);
    plural := coalesce(v_pair[2], v_word);
    kind := 'unit:' || singular;
  end if;
end $$;

-- "1,5" and "1.5" are 1.5; "1.000" (a point, three digits, not after a lone 0) is a thousand.
-- Null for anything but a plain number. At most four decimals count.
create function public.quantity_number(p_text text) returns numeric
language plpgsql immutable set search_path = '' as $$
declare
  v_match text[] := regexp_match(p_text, '^(\d+)(?:([.,])(\d+))?$');
begin
  if v_match is null then
    return null;
  elsif v_match[2] = '.' and char_length(v_match[3]) = 3 and v_match[1] <> '0' then
    return (v_match[1] || v_match[3])::numeric;
  end if;
  return trunc((v_match[1] || coalesce('.' || v_match[3], ''))::numeric, 4);
end $$;

-- German style, up to four decimals: 1.5 -> "1,5", 2.000 -> "2".
create function public.quantity_format(p_value numeric) returns text
language sql immutable set search_path = '' as $$
  select replace(regexp_replace(regexp_replace(round(p_value, 4)::text, '(\.\d*?)0+$', '\1'), '\.$', ''), '.', ',');
$$;

-- One quantity merged into another (the open item's first), as the PM decided (2026-10-29):
-- same or convertible units sum ("500 g" + "1 kg" = "1,5 kg", "2" + "3 Stück" = "5 Stück");
-- anything else is kept and the other quantity added as a note ("1 Bund" + "500 g" =
-- "1 Bund + 500 g"). A quantity is a list of such terms joined by " + ", so merging again sums
-- into the matching term ("1 Bund + 500 g" + "200 g" = "1 Bund + 700 g"). Terms that are not a
-- number and a unit ("etwas", "2x500 g") are kept as they are. No quantity is one piece when
-- the other side counts pieces ("" + "" = "2", "" + "2" = "3"), and nothing otherwise
-- ("" + "500 g" = "500 g"). Raises 22001 when the result would not fit the column (40).
-- app/lib/list/quantity.dart mirrors this; supabase/tests/merge_quantities.tsv is both their
-- table of cases.
create function public.merge_quantities(p_open text, p_other text) returns text
language plpgsql stable set search_path = '' as $$
declare
  v_open text[] := coalesce(regexp_split_to_array(nullif(btrim(p_open), ''), '\s*\+\s*'), '{}'::text[]);
  v_other text[] := coalesce(regexp_split_to_array(nullif(btrim(p_other), ''), '\s*\+\s*'), '{}'::text[]);
  v_terms text[] := '{}'::text[];
  v_kinds text[] := '{}'::text[];
  v_amounts numeric[] := '{}'::numeric[];
  v_words text[] := '{}'::text[];
  v_term text;
  v_match text[];
  v_unit record;
  v_amount numeric;
  v_kind text;
  v_at integer;
  v_result text;
begin
  v_open := array_remove(v_open, '');
  v_other := array_remove(v_other, '');
  if cardinality(v_open) = 0 and cardinality(v_other) = 0 then
    return '2';
  end if;
  -- A missing quantity is one piece if the other side counts pieces.
  if cardinality(v_open) = 0 or cardinality(v_other) = 0 then
    foreach v_term in array v_open || v_other loop
      v_match := regexp_match(v_term, '^(\d+(?:[.,]\d+)?)\s*(\S*)$');
      if v_match is not null and public.quantity_number(v_match[1]) is not null
         and (public.quantity_unit(v_match[2])).kind = 'count' then
        if cardinality(v_open) = 0 then
          v_open := array['1'];
        else
          v_other := array['1'];
        end if;
        exit;
      end if;
    end loop;
  end if;
  for v_side in 1..2 loop
    foreach v_term in array case when v_side = 1 then v_open else v_other end loop
      v_match := regexp_match(v_term, '^(\d+(?:[.,]\d+)?)\s*(\S*)$');
      v_amount := public.quantity_number(v_match[1]);
      if v_amount is null then
        v_kind := null;
      else
        v_unit := public.quantity_unit(v_match[2]);
        v_kind := v_unit.kind;
        v_amount := v_amount * v_unit.factor;
      end if;
      v_at := case when v_side = 2 and v_kind is not null then array_position(v_kinds, v_kind) end;
      if v_at is null then
        v_terms := v_terms || v_term;
        v_kinds := v_kinds || coalesce(v_kind, '');
        v_amounts := v_amounts || v_amount;
        v_words := v_words || nullif(v_match[2], '');
        continue;
      end if;
      v_amounts[v_at] := v_amounts[v_at] + v_amount;
      v_words[v_at] := coalesce(v_words[v_at], nullif(v_match[2], ''));
      v_unit := public.quantity_unit(v_words[v_at]);
      v_terms[v_at] := case
        when v_kind = 'mass' and v_amounts[v_at] >= 1000 then public.quantity_format(v_amounts[v_at] / 1000) || ' kg'
        when v_kind = 'mass' then public.quantity_format(v_amounts[v_at]) || ' g'
        when v_kind = 'vol' and v_amounts[v_at] >= 1000 then public.quantity_format(v_amounts[v_at] / 1000) || ' l'
        when v_kind = 'vol' then public.quantity_format(v_amounts[v_at]) || ' ml'
        when v_kind = 'count' then concat_ws(' ', public.quantity_format(v_amounts[v_at]), v_words[v_at])
        else public.quantity_format(v_amounts[v_at]) || ' ' || (
          -- The open item's spelling decides upper or lower case.
          select case when left(v_words[v_at], 1) = upper(left(v_words[v_at], 1))
                      then upper(left(w, 1)) || substr(w, 2) else w end
          from (select case when v_amounts[v_at] = 1 then v_unit.singular else v_unit.plural end as w) s
        )
      end;
    end loop;
  end loop;
  v_result := array_to_string(v_terms, ' + ');
  if char_length(v_result) > 40 then
    raise exception 'merged_quantity_too_long: % characters, at most 40', char_length(v_result)
      using errcode = '22001';
  end if;
  return v_result;
end $$;

-- Similar items ------------------------------------------------------------------------------

-- Brand or properties that tell two items apart: both set and different (folded like names;
-- properties in any order). "Windeln Größe 3" and "Windeln Größe 4" are two things; "Milch"
-- and "Milch Weihenstephan" may be one.
create function public.details_differ(p_brand text, p_properties text, p_other_brand text, p_other_properties text)
returns boolean
language sql immutable set search_path = '' as $$
  select (nullif(public.normalize_item_name(coalesce(p_brand, '')), '') is not null
          and nullif(public.normalize_item_name(coalesce(p_other_brand, '')), '') is not null
          and public.normalize_item_name(p_brand) <> public.normalize_item_name(p_other_brand))
      or (nullif(btrim(coalesce(p_properties, '')), '') is not null
          and nullif(btrim(coalesce(p_other_properties, '')), '') is not null
          and array(select public.normalize_item_name(p) from unnest(string_to_array(p_properties, ',')) p
                    where btrim(p) <> '' order by 1)
              <> array(select public.normalize_item_name(p) from unnest(string_to_array(p_other_properties, ',')) p
                       where btrim(p) <> '' order by 1));
$$;

-- The other open items the duplicate hint names for p_item: same household, same non-empty
-- canonical key, details that do not tell them apart; oldest first. Runs as the caller (RLS).
-- MCP, Siri, voice and Alexa report these after an add; the app matches the same way on the
-- rows it has (ListCubit).
create function public.similar_items(p_item uuid) returns setof public.items
language sql stable set search_path = '' as $$
  select o.* from public.items i
  join public.items o
    on o.household_id = i.household_id and o.canonical_key = i.canonical_key and o.id <> i.id
  where i.id = p_item and o.status = 'active' and coalesce(i.canonical_key, '') <> ''
    and not public.details_differ(i.brand, i.properties, o.brand, o.properties)
  order by o.created_at, o.id;
$$;

-- Merges -------------------------------------------------------------------------------------

create table public.item_merges (
  -- The client's id for the merge, so a retried merge is the same merge.
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  kept_id uuid not null,
  -- Both rows as they were before the merge, and the kept row's merged fields after it.
  kept_before jsonb not null,
  kept_after jsonb not null,
  merged_row jsonb not null,
  merged_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  undone_at timestamptz
);

create index item_merges_household_idx on public.item_merges (household_id, created_at);

comment on table public.item_merges is
  'Duplicate-hint merges (job 32b) with both rows as they were, so unmerge_items restores them. '
  'Written only by merge_items/unmerge_items; kept 30 days.';

alter table public.item_merges enable row level security;

create policy item_merges_member on public.item_merges for select to authenticated
  using (public.is_household_member(household_id));

revoke all on public.item_merges from public, anon;
revoke insert, update, delete on public.item_merges from authenticated;

-- The rows a merge or an undo leaves, for the app's acknowledgement: {"kept": row or null,
-- "merged": row or null} (null: the row does not exist now).
create function public.merge_result(p_kept uuid, p_merged uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'kept', (select to_jsonb(i) from public.items i where i.id = p_kept),
    'merged', (select to_jsonb(i) from public.items i where i.id = p_merged)
  );
$$;

-- Folds the open item p_other into the open item p_keep, in one transaction: p_keep keeps its
-- name, takes the merged quantity and fills a missing brand or properties from p_other;
-- p_other is deleted. p_merge is the caller's id for the merge: calling again with it changes
-- nothing and answers the same way. Errors: 42501 not a member, P0002 an item is gone (nothing
-- changes), 22023 the same item twice, another household, or an item no longer open, 22001 the
-- merged quantity is too long. The merge is not a correction: nothing is learned or unlearned.
create function public.merge_items(p_merge uuid, p_keep uuid, p_other uuid) returns jsonb
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
  update public.items set
    quantity = public.merge_quantities(v_keep.quantity, v_other.quantity),
    brand = coalesce(v_keep.brand, v_other.brand),
    properties = coalesce(v_keep.properties, v_other.properties)
  where id = p_keep
  returning * into v_keep;
  delete from public.items where id = p_other;
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

-- Undoes the merge p_merge: the merged row comes back exactly as it was (id, text, quantity,
-- category, store, place, who added it and when), and the kept row gets its quantity, brand and
-- properties back, unless someone changed them since the merge (their edit wins; the merged
-- row still comes back). A kept row deleted since stays deleted. A category or store deleted
-- since is left out like any deleted one (category: classified again; store: none), an author
-- whose account is gone too. Calling again changes nothing and answers the same way.
-- Errors: 42501 not a member, P0002 no such merge.
create function public.unmerge_items(p_merge uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_merge public.item_merges;
  v_row public.items;
begin
  select * into v_merge from public.item_merges where id = p_merge for update;
  if not found then
    raise exception 'merge_not_found' using errcode = 'P0002';
  end if;
  if not public.is_household_member(v_merge.household_id) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  if v_merge.undone_at is null then
    perform set_config('family_groceries.learning', 'off', true);
    update public.items i set
      quantity = v_merge.kept_before ->> 'quantity',
      brand = v_merge.kept_before ->> 'brand',
      properties = v_merge.kept_before ->> 'properties'
    where i.id = v_merge.kept_id
      and (i.quantity, i.brand, i.properties) is not distinct from
          (v_merge.kept_after ->> 'quantity', v_merge.kept_after ->> 'brand', v_merge.kept_after ->> 'properties');
    v_row := jsonb_populate_record(null::public.items, v_merge.merged_row);
    v_row.updated_at := now();
    if not exists (select from public.categories c where c.id = v_row.category_id and c.household_id = v_row.household_id) then
      v_row.category_id := null;
    end if;
    if not exists (select from public.stores s where s.id = v_row.store_id and s.household_id = v_row.household_id) then
      v_row.store_id := null;
    end if;
    if not exists (select from auth.users u where u.id = v_row.added_by) then
      v_row.added_by := null;
    end if;
    insert into public.items select (v_row).* on conflict (id) do nothing;
    -- The insert trigger decides categorized_via afresh; the row had one already.
    update public.items i set categorized_via = v_row.categorized_via
    where i.id = v_row.id and i.categorized_via is distinct from v_row.categorized_via
      and i.category_id = v_row.category_id;
    perform set_config('family_groceries.learning', '', true);
    update public.item_merges set undone_at = now() where id = p_merge;
  end if;
  return public.merge_result(v_merge.kept_id, (v_merge.merged_row ->> 'id')::uuid);
end $$;

-- Account deletion: a deleted user's id leaves the stored rows too (merged_by is set null by its
-- foreign key). Runs for delete_account and for a delete straight from auth.users (dashboard,
-- admin API); unmerge_items already restores such a row without an author.
create function public.forget_user_in_row(p_row jsonb, p_user text) returns jsonb
language sql immutable set search_path = '' as $$
  select p_row
    || case when p_row ->> 'added_by' = p_user then '{"added_by": null}'::jsonb else '{}'::jsonb end
    || case when p_row ->> 'bought_by' = p_user then '{"bought_by": null}'::jsonb else '{}'::jsonb end;
$$;

create function public.item_merges_forget_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_user text := old.id::text;
begin
  update public.item_merges m set
    merged_row = public.forget_user_in_row(m.merged_row, v_user),
    kept_before = public.forget_user_in_row(m.kept_before, v_user)
  where v_user in (m.merged_row ->> 'added_by', m.merged_row ->> 'bought_by',
                   m.kept_before ->> 'added_by', m.kept_before ->> 'bought_by');
  return null;
end $$;

create trigger item_merges_forget_user
  after delete on auth.users
  for each row execute function public.item_merges_forget_user();

-- Grants -------------------------------------------------------------------------------------

revoke execute on function
  public.quantity_unit(text),
  public.quantity_number(text),
  public.quantity_format(numeric),
  public.merge_quantities(text, text),
  public.details_differ(text, text, text, text),
  public.similar_items(uuid),
  public.merge_result(uuid, uuid),
  public.merge_items(uuid, uuid, uuid),
  public.unmerge_items(uuid),
  public.forget_user_in_row(jsonb, text),
  public.item_merges_forget_user()
from public, anon;
grant execute on function
  public.merge_quantities(text, text),
  public.similar_items(uuid),
  public.merge_items(uuid, uuid, uuid),
  public.unmerge_items(uuid)
to authenticated;
-- similar_items and merge_items run their helpers as the caller.
grant execute on function
  public.quantity_unit(text),
  public.quantity_number(text),
  public.quantity_format(numeric),
  public.details_differ(text, text, text, text)
to authenticated;
revoke execute on function
  public.merge_result(uuid, uuid),
  public.forget_user_in_row(jsonb, text),
  public.item_merges_forget_user()
from authenticated;
