-- Job 59: suggestions find what was meant despite a typo or from part of a word. "Hafermlch" and
-- "milch" both find Hafermilch, in the household's history and in the catalog (docs/DECISIONS.md).

create extension if not exists pg_trgm with schema extensions;

-- How a folded name matches what is typed (folded the same way), best first:
--   0  the same name;
--   1  the name starts with it;
--   2  the name has it inside, from 4 letters ("milch" in Hafermilch; 3 would find Fleisch for
--      "Eis" and Brot for "Rot");
--   3  a word of the name, or the whole name, is a typo of it, from 3 letters: same first letter
--      and at most one edit (insert, delete, replace) for 3 to 5 letters, two from 6
--      ("Hafermlch", "Tomatn").
-- Null: no match. The app's offline rows (suggestionMatch in
-- app/lib/list/model.dart) match the same way.
create function public.suggest_match(p_typed text, p_name text) returns integer
language plpgsql immutable set search_path = '' as $$
declare
  v_len integer := char_length(p_typed);
  v_max integer := case when char_length(p_typed) < 6 then 1 else 2 end;
  v_word text;
begin
  if p_name = p_typed then
    return 0;
  elsif starts_with(p_name, p_typed) then
    return 1;
  elsif v_len < 3 then
    return null;
  elsif v_len >= 4 and strpos(p_name, p_typed) > 0 then
    return 2;
  end if;
  foreach v_word in array
    case when p_name ~ '[ -]' then p_name || regexp_split_to_array(p_name, '[ -]+') else array[p_name] end
  loop
    if left(v_word, 1) = left(p_typed, 1) and abs(char_length(v_word) - v_len) <= v_max
       and extensions.levenshtein_less_equal(p_typed, v_word, v_max) <= v_max then
      return 3;
    end if;
  end loop;
  return null;
end $$;

-- The household's items of the last year, for suggest_entries to match in full. The items policy
-- checks membership once per row (about 10 us each), which a fuzzy match cannot filter down first
-- the way the old prefix (starts_with) did; this checks it once. Same rows as the caller may read.
create function public.suggest_history(p_household uuid)
returns table (name text, brand text, properties text, quantity text, normalized_name text, at timestamptz)
language sql stable security definer set search_path = '' as $$
  select i.name, i.brand, i.properties, i.quantity, i.normalized_name, coalesce(i.bought_at, i.updated_at)
  from public.items i
  where (auth.uid() is null or public.is_household_member(p_household))
    and i.household_id = p_household
    and i.updated_at > now() - interval '1 year';
$$;

-- As in 20261029105411_suggest_entries.sql, with history and catalog rows matched by
-- public.suggest_match instead of by prefix only: history on the folded name (2+ characters, as
-- before), catalog terms on the key of the last word (2+ letters). Within each, the better match
-- first; exact and prefix matches latest first (history) or shortest first (catalog) as before,
-- in-word and typo matches the most similar first (pg_trgm), then the same.
create or replace function public.suggest_entries(p_household uuid, p_text text, p_limit integer default 8)
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
    with recent as materialized (
      select * from public.suggest_history(p_household)
    ),
    -- Matched once per name, not once per item.
    names as materialized (
      select n.normalized_name, public.suggest_match(v_norm, n.normalized_name) as tier
      from (select distinct r.normalized_name from recent r) n
    ),
    history as materialized (
      select r.*, n.tier, extensions.similarity(v_norm, r.normalized_name) as sim
      from recent r
      join names n using (normalized_name)
      where n.tier is not null
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
      select t.term, t.tier, t.sim from (
        select distinct on (t.key) t.term, m.tier, extensions.similarity(v_last_key, t.key) as sim
        from public.classifier_terms t
        cross join lateral (select public.suggest_match(v_last_key, t.key) as tier) m
        where char_length(v_last_key) >= 2
          and m.tier is not null
          and t.key <> public.item_key(v_typed.name)
          -- Only the last word is replaced, so after other words it takes a prefix or, inside a
          -- one-word term, the typed part: a typo of it would ignore them ("Rote Bete" -> "Rote
          -- Besen") and a phrase found by a later word would repeat them ("Rote Rote Beete").
          and (m.tier < 2 or v_typed.name !~ '\s' or (m.tier = 2 and t.key !~ ' '))
        order by t.key, char_length(t.term), t.term
      ) t
      order by t.tier, case when t.tier >= 2 then -t.sim end, char_length(t.term), t.term
      limit 3
    ),
    candidates as (
      select 'typed' as source, 1 as cap, 1 as ord, 1::bigint as rank,
        v_typed.name, v_typed.brand, v_typed.properties, v_typed.quantity, v_typed.store_id, v_typed.category_id
      union all
      select 'history', 3, 2,
        row_number() over (order by h.tier, case when h.tier >= 2 then -h.sim end, h.at desc, h.name, h.brand, h.properties),
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
      select 'catalog', 3, 6,
        row_number() over (order by t.tier, case when t.tier >= 2 then -t.sim end, char_length(t.term), t.term),
        p.name, p.brand, p.properties, p.quantity, p.store_id, p.category_id
      from terms t
      -- Written the way a German noun list shows it: "rote bete" -> "Rote Bete".
      cross join lateral public.parse_item(p_household, regexp_replace(btrim(p_text), '\S+$', initcap(t.term))) p
    )
    select * from candidates x order by x.ord, x.rank
  loop
    -- The cap first: keying a row is the costly part, and a fuzzy match brings many history rows.
    continue when coalesce((v_taken ->> c.source)::integer, 0) >= c.cap;
    v_key := public.suggestion_key(c.name, c.brand, c.properties);
    continue when v_key = any (v_seen);
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

revoke execute on function public.suggest_match(text, text), public.suggest_history(uuid) from public, anon;
grant execute on function public.suggest_match(text, text), public.suggest_history(uuid) to authenticated;
