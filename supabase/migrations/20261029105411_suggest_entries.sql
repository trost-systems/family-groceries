-- Job 17: the add sheet's suggestions (public.suggest_entries) and learning from what the sheet
-- inserts (items_learn_insert). docs/design/h-satz-final/SPEC.md, sections 2.7 and 3.

-- Suggestions --------------------------------------------------------------

-- When two suggestions are the same entry: name folded like item_name_key (Gurke = Gurken, but
-- Größe 4 is not Größe 5), brand like brand_key, properties in any order.
create function public.suggestion_key(p_name text, p_brand text, p_properties text) returns text
language sql immutable set search_path = '' as $$
  select concat_ws('|',
    public.item_name_key(p_name),
    public.brand_key(p_brand),
    (select string_agg(k, ',' order by k)
     from (select public.item_name_key(p) as k from unnest(string_to_array(p_properties, ', ')) as p) parts));
$$;

-- A property that says how much comes in one pack, the parser's pack words: "4er Pack", "6er",
-- "6er-Pack", "Big Pack", "Maxi Box", "Doppelpack", "XXL", "6x1,5 l", "4x125g", "16 Rollen".
create function public.is_pack_property(p_property text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(p_property, '') ~* ('^('
    || '\d+er(-?pack| (pack|packung|pck|box|karton))?'
    || '|(big|maxi|mega|jumbo|standard|spar|vorteils|familien|mini|duo|multi|monats|xxl|xl) (pack|packung|box)'
    || '|doppelpack|vorteilspack|sparpack|großpackung|grosspackung|familienpackung|monatsbox|xxl'
    || '|\d+ ?x ?\d+([.,]\d+)? ?[[:alpha:]]*'
    || '|\d+ rollen?'
    || ')$');
$$;

-- The add sheet's rows for one typed entry, every one a complete entry to add, in this order:
--   typed    public.parse_item of the text, always first (Enter adds it);
--   history  up to 3 of the household's entries of the last year whose name starts with the typed
--            name (2+ characters), latest first, each with its own brand and properties, and the
--            typed Menge if there is one;
--   pack     the typed entry with another pack the household bought it in ("Big Pack");
--   variant  the typed entry plus another property it was bought with ("sensitiv"); up to 2 of
--            each, from entries of exactly the typed name, latest first; sizes are left to:
--   size     Größe n+1, then n-1 (within 1..8) when the entry has "Größe n";
--   brand    up to 3 other brands of the product: the household's for this name (latest first),
--            then public.brands whose product it is (A-Z);
--   catalog  up to 3 dictionary terms the last word starts the key of (2+ letters), shortest
--            first, each parsed in place of that word ("Mi" -> "Milch").
-- Every row's store and category are what the list would guess for it now (public.classify_item,
-- public.guess_store, as public.parse_item does), not where an old entry once was: the memory has
-- the latest word, and a row tapped without a chip pick teaches nothing (items_learn_insert).
-- A row that is the same entry as an earlier one (public.suggestion_key) is left out. Blank text
-- gives no rows. Runs on every keystroke (debounced): one pass over the household's items.
create function public.suggest_entries(p_household uuid, p_text text, p_limit integer default 8)
returns table (source text, name text, brand text, properties text, quantity text, store_id uuid, category_id uuid)
language plpgsql stable set search_path = '' as $$
declare
  v_typed record;
  v_norm text;
  v_parts text[];
  v_size integer;
  v_last_key text;
  v_left integer := least(greatest(coalesce(p_limit, 8), 1), 20);
  v_seen text[] := '{}'::text[];
  v_taken jsonb := '{}'::jsonb;
  v_key text;
  c record;
begin
  if auth.uid() is not null and not public.is_household_member(p_household) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  if btrim(coalesce(p_text, '')) = '' then
    return;
  end if;
  select * into v_typed from public.parse_item(p_household, p_text);
  if v_typed.name = '' then
    return;
  end if;
  v_norm := public.normalize_item_name(v_typed.name);
  v_parts := coalesce(string_to_array(v_typed.properties, ', '), '{}');
  v_size := (select substring(p from '^Größe (\d+)$')::integer from unnest(v_parts) as p where p ~ '^Größe \d+$' limit 1);
  v_last_key := public.item_key(substring(btrim(p_text) from '\S+$'));

  for c in
    with history as materialized (
      select i.name, i.brand, i.properties, i.quantity, i.normalized_name,
        coalesce(i.bought_at, i.updated_at) as at
      from public.items i
      where i.household_id = p_household
        and i.updated_at > now() - interval '1 year'
        and starts_with(i.normalized_name, v_norm)
    ),
    same_name as (
      select h.* from history h where h.normalized_name = v_norm
    ),
    other_parts as (
      select distinct on (lower(p.part)) p.part, h.at
      from same_name h cross join unnest(string_to_array(h.properties, ', ')) as p (part)
      where lower(p.part) <> all (select lower(t) from unnest(v_parts) as t)
        and p.part !~* '^(größe|grösse|groesse|gr\.)(\s|\d)'
      order by lower(p.part), h.at desc
    ),
    other_brands as (
      select distinct on (public.brand_key(b.brand)) b.brand, b.tier, b.at
      from (
        select h.brand, 0 as tier, h.at from same_name h where h.brand is not null
        union all
        select g.brand, 1, null from public.brands g
        where g.product is not null and public.normalize_item_name(g.product) = v_norm
      ) b
      where public.brand_key(b.brand) <> public.brand_key(v_typed.brand)
      order by public.brand_key(b.brand), b.tier, b.at desc nulls last
    ),
    terms as (
      select t.term from (
        select distinct on (t.key) t.term
        from public.classifier_terms t
        where char_length(v_last_key) >= 2
          and starts_with(t.key, v_last_key)
          and t.key <> public.item_key(v_typed.name)
        order by t.key, char_length(t.term), t.term
      ) t
      order by char_length(t.term), t.term
      limit 3
    ),
    candidates as (
      select 'typed' as source, 1 as cap, 1 as ord, 1::bigint as rank,
        v_typed.name, v_typed.brand, v_typed.properties, v_typed.quantity, v_typed.store_id, v_typed.category_id
      union all
      select 'history', 3, 2, row_number() over (order by h.at desc, h.name, h.brand, h.properties),
        h.name, h.brand, h.properties, coalesce(v_typed.quantity, h.quantity), null::uuid, null::uuid
      from (
        select distinct on (h.name, h.brand, h.properties) h.*
        from history h
        where char_length(v_norm) >= 2
        order by h.name, h.brand, h.properties, h.at desc
      ) h
      union all
      select case when public.is_pack_property(p.part) then 'pack' else 'variant' end, 2, 3,
        row_number() over (order by p.at desc, p.part),
        v_typed.name, v_typed.brand,
        public.cap_text(array_to_string(
          case when public.is_pack_property(p.part)
            then array(select t from unnest(v_parts) with ordinality as u (t, o)
                       where not public.is_pack_property(u.t) order by u.o)
            else v_parts
          end || p.part, ', '), 120),
        v_typed.quantity, v_typed.store_id, v_typed.category_id
      from other_parts p
      union all
      select 'size', 2, 4, s.rank,
        v_typed.name, v_typed.brand,
        array_to_string(array_replace(v_parts, 'Größe ' || v_size, 'Größe ' || s.size), ', '),
        v_typed.quantity, v_typed.store_id, v_typed.category_id
      from (values (1::bigint, v_size + 1), (2, v_size - 1)) as s (rank, size)
      where s.size between 1 and 8
      union all
      select 'brand', 3, 5, row_number() over (order by b.tier, b.at desc nulls last, lower(b.brand)),
        v_typed.name, b.brand, v_typed.properties, v_typed.quantity, null::uuid, v_typed.category_id
      from other_brands b
      union all
      select 'catalog', 3, 6, row_number() over (order by char_length(t.term), t.term),
        p.name, p.brand, p.properties, p.quantity, p.store_id, p.category_id
      from terms t
      -- Written the way a German noun list shows it: "rote bete" -> "Rote Bete".
      cross join lateral public.parse_item(p_household, regexp_replace(btrim(p_text), '\S+$', initcap(t.term))) p
    )
    select * from candidates x order by x.ord, x.rank
  loop
    v_key := public.suggestion_key(c.name, c.brand, c.properties);
    continue when v_key = any (v_seen) or coalesce((v_taken ->> c.source)::integer, 0) >= c.cap;
    v_seen := v_seen || v_key;
    v_taken := v_taken || jsonb_build_object(c.source, coalesce((v_taken ->> c.source)::integer, 0) + 1);
    source := c.source;
    name := c.name;
    brand := c.brand;
    properties := c.properties;
    quantity := c.quantity;
    category_id := c.category_id;
    store_id := c.store_id;
    if c.source = 'history' then
      category_id := public.classify_item(p_household, c.name);
    end if;
    if c.source in ('history', 'brand') then
      store_id := public.guess_store(p_household, c.name, c.brand, category_id);
    end if;
    return next;
    v_left := v_left - 1;
    exit when v_left = 0;
  end loop;
end $$;

-- Learning from an insert --------------------------------------------------

-- The store public.parse_item shows for an entry (its Laden rule): the remembered one, else the
-- brand's own store (Balea -> dm), else dm for a drugstore item.
create function public.guess_store(p_household uuid, p_name text, p_brand text, p_category uuid) returns uuid
language sql stable set search_path = '' as $$
  select coalesce(
    public.suggest_store(p_household, p_name),
    (select s.id from public.brands g
     join public.stores s on s.household_id = p_household and s.seed_key = g.store_seed
     where g.key = public.brand_key(p_brand)),
    (select s.id from public.stores s
     join public.categories c on c.id = p_category and (c.seed_key = 'drugstore' or 'drugstore' = any (c.absorbed_seed_keys))
     where s.household_id = p_household and s.seed_key = 'dm')
  );
$$;

-- What an insert taught a memory row, so that deleting the item soon after (the add sheet's
-- Rückgängig) takes it back: the item, how much it added, the row's updated_at before it (null: the
-- insert created the row) and the updated_at it set (any later learning changes updated_at, and
-- then the delete leaves the row alone).
alter table public.category_memory
  add column undo_item uuid,
  add column undo_by integer,
  add column undo_prev_at timestamptz,
  add column undo_at timestamptz;
alter table public.item_store_memory
  add column undo_item uuid,
  add column undo_by integer,
  add column undo_prev_at timestamptz,
  add column undo_at timestamptz;

-- A category or store inserted with the row (picked in the add sheet) that is not what the list
-- would have guessed is learned like an edit: a category correction, a store tag. An insert that
-- takes the guesses (no category or store given, or the parsed ones, or any row of
-- public.suggest_entries without a chip pick) learns nothing, and so does putting back a deleted
-- item (the delete snackbar's Rückgängig): its store and category are history, not a pick. Per
-- statement, so every row of a multi-row insert is compared with the memory as it stood before
-- the statement.
create function public.items_learn_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if coalesce(current_setting('family_groceries.learning', true), '') = 'off' then
    return null;
  end if;
  with added as materialized (
    select n.id, n.household_id, public.item_key(n.name) as key, n.category_id, n.store_id,
      public.classify_item(n.household_id, n.name) as guessed_category,
      public.guess_store(n.household_id, n.name, n.brand, n.category_id) as guessed_store
    from new_items n
    where not exists (
      select from public.item_events e
      where e.household_id = n.household_id and e.created_at > now() - interval '1 day'
        and e.item_id = n.id and e.action = 'deleted'
    )
  ),
  corrections as (
    insert into public.category_memory as m
      (household_id, item_key, category_id, corrections, updated_at, undo_item, undo_by, undo_prev_at, undo_at)
    select a.household_id, a.key, a.category_id, count(*), v_now,
      case when count(*) = 1 then (array_agg(a.id))[1] end, count(*), null, v_now
    from added a
    where a.key <> '' and a.category_id is distinct from a.guessed_category
    group by a.household_id, a.key, a.category_id
    on conflict (household_id, item_key, category_id)
      do update set corrections = m.corrections + excluded.corrections, updated_at = v_now,
        undo_item = excluded.undo_item, undo_by = excluded.undo_by, undo_prev_at = m.updated_at, undo_at = v_now
  )
  insert into public.item_store_memory as m
    (household_id, item_key, store_id, times, updated_at, undo_item, undo_by, undo_prev_at, undo_at)
  select a.household_id, a.key, a.store_id, count(*), v_now,
    case when count(*) = 1 then (array_agg(a.id))[1] end, count(*), null, v_now
  from added a
  where a.key <> '' and a.store_id is not null and a.store_id is distinct from a.guessed_store
  group by a.household_id, a.key, a.store_id
  on conflict (household_id, item_key, store_id)
    do update set times = m.times + excluded.times, updated_at = v_now,
      undo_item = excluded.undo_item, undo_by = excluded.undo_by, undo_prev_at = m.updated_at, undo_at = v_now;
  return null;
end $$;

create trigger items_learn_insert
  after insert on public.items
  referencing new table as new_items
  for each statement execute function public.items_learn_insert();

-- Deleting an item within 10 minutes of the insert that taught a memory row, with nothing learned
-- on that row since, takes the lesson back: a picked store or category the user undid (or deleted
-- right away) is not remembered. A row the insert created goes; an older one gets its count and
-- updated_at back, so the guess before the add wins again.
create function public.items_unlearn_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(current_setting('family_groceries.learning', true), '') = 'off' then
    return null;
  end if;
  delete from public.category_memory m using old_items o
  where m.household_id = o.household_id and m.undo_item = o.id and m.updated_at = m.undo_at
    and m.undo_at > clock_timestamp() - interval '10 minutes'
    and (m.undo_prev_at is null or m.corrections <= m.undo_by);
  update public.category_memory m
  set corrections = m.corrections - m.undo_by, updated_at = m.undo_prev_at,
    undo_item = null, undo_by = null, undo_prev_at = null, undo_at = null
  from old_items o
  where m.household_id = o.household_id and m.undo_item = o.id and m.updated_at = m.undo_at
    and m.undo_at > clock_timestamp() - interval '10 minutes';
  delete from public.item_store_memory m using old_items o
  where m.household_id = o.household_id and m.undo_item = o.id and m.updated_at = m.undo_at
    and m.undo_at > clock_timestamp() - interval '10 minutes'
    and (m.undo_prev_at is null or m.times <= m.undo_by);
  update public.item_store_memory m
  set times = m.times - m.undo_by, updated_at = m.undo_prev_at,
    undo_item = null, undo_by = null, undo_prev_at = null, undo_at = null
  from old_items o
  where m.household_id = o.household_id and m.undo_item = o.id and m.updated_at = m.undo_at
    and m.undo_at > clock_timestamp() - interval '10 minutes';
  return null;
end $$;

create trigger items_unlearn_delete
  after delete on public.items
  referencing old table as old_items
  for each statement execute function public.items_unlearn_delete();

-- Grants -------------------------------------------------------------------

revoke execute on function
  public.suggestion_key(text, text, text),
  public.is_pack_property(text),
  public.suggest_entries(uuid, text, integer),
  public.guess_store(uuid, text, text, uuid),
  public.items_learn_insert(),
  public.items_unlearn_delete()
from public, anon;
grant execute on function
  public.suggestion_key(text, text, text),
  public.is_pack_property(text),
  public.suggest_entries(uuid, text, integer),
  -- suggest_entries runs as the caller and calls it; it runs as the caller too, so RLS applies.
  public.guess_store(uuid, text, text, uuid)
to authenticated;
revoke execute on function public.items_learn_insert(), public.items_unlearn_delete() from authenticated;
