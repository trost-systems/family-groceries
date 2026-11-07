-- Job 151: the Baumarkt. A store named "Baumarkt", "Heimwerkermarkt", "Hardware Store" or "DIY
-- Store" becomes a hardware store (seed key 'hardware', a type, not a chain) and gives the
-- household seven DIY categories: Farben & Lacke, Sanitär, Elektro & Leuchtmittel, Werkzeug,
-- Schrauben & Befestigung, Holz & Baustoffe, Garten & Pflanzen. Households without one get none
-- (eleven categories stay enough for groceries): the classifier puts DIY words in Haushalt
-- there, as before, and the catalog does not suggest them. DIY items default to the Baumarkt as
-- drugstore items default to dm.
-- Households that named a store Baumarkt before get it now. Decisions: docs/DECISIONS.md,
-- "Job 151".

-- The one list of the DIY categories: seed key, German name, place in the Baumarkt's walk.
create function public.hardware_categories() returns table (seed_key text, name text, walk integer)
language sql immutable set search_path = '' as $$
  values
    ('paint', 'Farben & Lacke', 1),
    ('plumbing', 'Sanitär', 2),
    ('electrical', 'Elektro & Leuchtmittel', 3),
    ('tools', 'Werkzeug', 4),
    ('fasteners', 'Schrauben & Befestigung', 5),
    ('building', 'Holz & Baustoffe', 6),
    ('garden', 'Garten & Pflanzen', 7);
$$;

alter table public.classifier_terms drop constraint classifier_terms_category_check;
alter table public.classifier_terms add constraint classifier_terms_category_check check (category in (
  'produce', 'bakery', 'chilled', 'meat', 'pantry', 'sweets', 'drinks', 'frozen', 'household', 'drugstore',
  'paint', 'plumbing', 'electrical', 'tools', 'fasteners', 'building', 'garden'
)) not valid;
alter table public.classifier_terms validate constraint classifier_terms_category_check;

-- Gives the household the DIY categories it lacks, in walk order before Sonstiges, in the route
-- and in every store (create_category). It never renames or reorders the household's own
-- categories: one it deleted (its key absorbed elsewhere) stays deleted, and its own category of
-- the same name ("Werkzeug") becomes the DIY one unless that has another seed key.
create function public.seed_hardware_categories(p_household uuid) returns void
language plpgsql set search_path = '' as $$
declare
  v_row record;
  v_category public.categories;
begin
  if not public.is_household_member(p_household) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  for v_row in select h.seed_key, h.name from public.hardware_categories() h order by h.walk loop
    continue when exists (
      select from public.categories c
      where c.household_id = p_household
        and (c.seed_key = v_row.seed_key or v_row.seed_key = any (c.absorbed_seed_keys))
    );
    v_category := public.create_category(p_household, v_row.name);
    update public.categories set seed_key = v_row.seed_key where id = v_category.id and seed_key is null;
  end loop;
end $$;

-- The chains list the DIY categories in the Baumarkt's walk just before Sonstiges, where
-- create_category puts them in a chain added before the Baumarkt: the order does not depend on
-- which came first. The Baumarkt's walk: docs/STORE_LAYOUTS.md.
create or replace function public.apply_store_layout(p_store uuid) returns void
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
    ('lidl', 'drugstore', 10, false), ('lidl', 'paint', 11, false), ('lidl', 'plumbing', 12, false),
    ('lidl', 'electrical', 13, false), ('lidl', 'tools', 14, false), ('lidl', 'fasteners', 15, false),
    ('lidl', 'building', 16, false), ('lidl', 'garden', 17, false), ('lidl', 'other', 18, false),
    ('edeka', 'produce', 1, false), ('edeka', 'bakery', 2, false), ('edeka', 'meat', 3, false),
    ('edeka', 'chilled', 4, false), ('edeka', 'pantry', 5, false), ('edeka', 'sweets', 6, false),
    ('edeka', 'frozen', 7, false), ('edeka', 'drinks', 8, false), ('edeka', 'household', 9, false),
    ('edeka', 'drugstore', 10, false), ('edeka', 'paint', 11, false), ('edeka', 'plumbing', 12, false),
    ('edeka', 'electrical', 13, false), ('edeka', 'tools', 14, false), ('edeka', 'fasteners', 15, false),
    ('edeka', 'building', 16, false), ('edeka', 'garden', 17, false), ('edeka', 'other', 18, false),
    ('dm', 'drugstore', 1, false), ('dm', 'pantry', 2, false), ('dm', 'sweets', 3, false),
    ('dm', 'household', 4, false), ('dm', 'drinks', 5, false), ('dm', 'paint', 6, false),
    ('dm', 'plumbing', 7, false), ('dm', 'electrical', 8, false), ('dm', 'tools', 9, false),
    ('dm', 'fasteners', 10, false), ('dm', 'building', 11, false), ('dm', 'garden', 12, false),
    ('dm', 'other', 13, false), ('dm', 'produce', 14, true), ('dm', 'bakery', 15, true),
    ('dm', 'chilled', 16, true), ('dm', 'meat', 17, true), ('dm', 'frozen', 18, true),
    ('hardware', 'paint', 1, false), ('hardware', 'plumbing', 2, false), ('hardware', 'electrical', 3, false),
    ('hardware', 'tools', 4, false), ('hardware', 'fasteners', 5, false), ('hardware', 'building', 6, false),
    ('hardware', 'garden', 7, false), ('hardware', 'household', 8, false), ('hardware', 'drinks', 9, false),
    ('hardware', 'sweets', 10, false), ('hardware', 'other', 11, false), ('hardware', 'produce', 12, true),
    ('hardware', 'bakery', 13, true), ('hardware', 'chilled', 14, true), ('hardware', 'meat', 15, true),
    ('hardware', 'pantry', 16, true), ('hardware', 'frozen', 17, true), ('hardware', 'drugstore', 18, true)
    -- STORE_LAYOUTS_END
  ) as l (store_key, category_key, ord, hidden)
    on l.store_key = v_store.seed_key and l.category_key = c.seed_key
  where c.household_id = v_store.household_id;
end $$;

-- A Baumarkt name also seeds the DIY categories; the layout applied after them places them.
create or replace function public.add_store(p_household uuid, p_name text) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_name text := public.store_name(p_name);
  v_seed text := case public.store_name_key(v_name)
    when 'dm' then 'dm' when 'lidl' then 'lidl' when 'edeka' then 'edeka'
    when 'baumarkt' then 'hardware' when 'heimwerkermarkt' then 'hardware'
    when 'hardware store' then 'hardware' when 'diy store' then 'hardware'
  end;
  v_store uuid;
begin
  if not public.is_household_member(p_household) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  if exists (select 1 from public.stores where household_id = p_household and seed_key = v_seed) then
    v_seed := null;
  end if;
  begin
    insert into public.stores (household_id, name, seed_key, sort_order)
    values (
      p_household, v_name, v_seed,
      coalesce((select max(sort_order) from public.stores where household_id = p_household), 0) + 10
    )
    on conflict (household_id, public.store_name_key(name)) do nothing
    returning id into v_store;
  exception when unique_violation then
    -- Another member made the Baumarkt under another of its names at the same moment
    -- ("Heimwerkermarkt"): this one is a plain store, as if it had come second.
    v_seed := null;
    insert into public.stores (household_id, name, seed_key, sort_order)
    values (
      p_household, v_name, null,
      coalesce((select max(sort_order) from public.stores where household_id = p_household), 0) + 10
    )
    on conflict (household_id, public.store_name_key(name)) do nothing
    returning id into v_store;
  end;

  if v_store is null then
    return (
      select id from public.stores
      where household_id = p_household and public.store_name_key(name) = public.store_name_key(v_name)
    );
  end if;

  if v_seed = 'hardware' then
    -- create_category extends every store's layout, so this store needs one first.
    perform public.apply_store_layout(v_store);
    perform public.seed_hardware_categories(p_household);
  end if;
  perform public.apply_store_layout(v_store);
  return v_store;
end $$;

-- A Baumarkt stays one under any name ("Baumarkt Nord"): the type is no chain whose brands could
-- pick it by mistake.
create or replace function public.rename_store(p_store uuid, p_name text) returns void
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
      seed_key = case when v_store.seed_key = 'hardware'
      or public.store_name_key(v_name) = public.store_name_key(v_store.name) then seed_key end
  where id = p_store and (name, seed_key) is distinct from (
    v_name, case when v_store.seed_key = 'hardware'
      or public.store_name_key(v_name) = public.store_name_key(v_store.name) then seed_key end
  );
end $$;

-- The store a category's items default to: dm for drugstore items, the Baumarkt for DIY items.
create function public.category_store(p_household uuid, p_category uuid) returns uuid
language sql stable set search_path = '' as $$
  select s.id
  from public.categories c
  join public.stores s on s.household_id = p_household and s.seed_key = case
    when c.seed_key = 'drugstore' or 'drugstore' = any (c.absorbed_seed_keys) then 'dm'
    when exists (
      select from public.hardware_categories() h where h.seed_key = c.seed_key or h.seed_key = any (c.absorbed_seed_keys)
    ) then 'hardware'
  end
  where c.id = p_category;
$$;

-- The store public.parse_item shows for an entry (its Laden rule): the remembered one, else the
-- brand's own store (Balea -> dm), else the category's store (public.category_store).
create or replace function public.guess_store(p_household uuid, p_name text, p_brand text, p_category uuid) returns uuid
language sql stable set search_path = '' as $$
  select coalesce(
    public.suggest_store(p_household, p_name),
    (select s.id from public.brands g
     join public.stores s on s.household_id = p_household and s.seed_key = g.store_seed
     where g.key = public.brand_key(p_brand)),
    public.category_store(p_household, p_category)
  );
$$;

-- The default store of the parsed category comes from public.category_store, as in guess_store.
create or replace function public.parse_item(p_household uuid, p_text text)
returns table (name text, brand text, properties text, quantity text, store_id uuid, category_id uuid)
language plpgsql stable set search_path = '' as $$
declare
  v_units constant text := public.item_units();
  -- Rolls are an Eigenschaft at the end ("Klopapier 16 Rollen"), a Menge only up front.
  v_trailing_units constant text := replace(v_units, 'rolle|rollen|', '');
  v_number_words constant jsonb := public.item_number_words();
  -- The article forms count only up front: "Trag Milch ein" is no Milch x1.
  v_trailing_words constant text := (
    select string_agg(k, '|') from jsonb_object_keys(v_number_words) k where k not in ('ein', 'eine', 'einen', 'einer'));
  v_text text := regexp_replace(btrim(coalesce(p_text, '')), '\s+', ' ', 'g');
  v_match text[];
  v_tok text[];
  v_low text[];
  v_kind text[];
  v_props text[] := '{}'::text[];
  v_n integer;
  v_i integer;
  v_category uuid;
  v_len integer;
  v_prop text;
  v_t1 text;
  v_t2 text;
  v_brand_at integer;
  v_brand_len integer;
  v_product text;
  v_store_seed text;
  v_suffix text[];
  v_units_re constant text := '(' || public.item_units() || ')';
begin
  if auth.uid() is not null and not public.is_household_member(p_household) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;

  -- Halves and one and a half up front: "ein halbes Brot" -> 1/2, "ein halbes Kilo" -> 0,5 Kilo,
  -- "anderthalb Liter" -> 1,5 Liter.
  v_text := regexp_replace(v_text, '^(?:(?:ein|eine|einen)\s+)?(?:halbe[snmr]?|halb)\s+(?=' || v_units_re || '\y)', '0,5 ', 'i');
  v_text := regexp_replace(v_text, '^(?:(?:ein|eine|einen)\s+)?(?:halbe[snmr]?|halb)\s+', '1/2 ', 'i');
  v_text := regexp_replace(v_text, '^(?:anderthalb|eineinhalb)\s+', '1,5 ', 'i');
  -- A multipack is one token: "6 x 1,5 l", "6x1,5l", "6×0,5 l" -> "6x1,5l".
  v_text := regexp_replace(v_text, '(^|\s)(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(?:' || v_units_re || '\.?)?(?=\s|$)', '\1\2x\3\4', 'gi');

  -- A leading count or amount is the Menge ("2 Gurken", "zwei Liter Milch", "1/2 Brot"), unless
  -- the number word starts a name ("Drei Glocken Spaghetti", public.item_number_names).
  v_match := regexp_match(
    v_text,
    '^(?:(\d+(?:[.,/]\d+)?)(?:\s*(' || v_units || ')\.?)?|(' || (select string_agg(k, '|') from jsonb_object_keys(v_number_words) k)
      || ')(?:\s+(' || v_units || ')\.?)?)\s+(.+)$',
    'i'
  );
  if v_match[3] is not null
     and exists (select from unnest(public.item_number_names()) n where lower(v_text) ~ ('^' || n || '\y')) then
    v_match := null;
  end if;
  if v_match is not null then
    quantity := concat_ws(' ',
      coalesce(v_match[1], v_number_words ->> lower(v_match[3])),
      case when lower(coalesce(v_match[2], v_match[4], 'x')) <> 'x' then coalesce(v_match[2], v_match[4]) end);
    v_text := v_match[5];
  end if;

  -- A bare count at the end is the Menge when it is 1 to 20 or a number word but no article
  -- form, the word before it is no size or unit word and has no digit, and the rest is a known
  -- name: "Karotten 2", "Gurken zwei", not "Windeln Größe 4", "Büroklammern 100" or "Plimbel 3"
  -- (jobs 61 and 104, supabase/tests/quantity_parse.tsv).
  if quantity is null then
    v_match := regexp_match(v_text, '^(.*\s)?(\S+)\s([1-9]\d?|' || v_trailing_words || ')$', 'i');
    if v_match is not null
       and coalesce(v_number_words ->> lower(v_match[3]), v_match[3])::integer <= 20
       and v_match[2] !~ '\d'
       and lower(rtrim(v_match[2], '.')) !~ ('^(' || v_units || '|größe|grösse|groesse|gr|stufe|nr|no|size|typ|type|klasse|pack|pcs|mah|cl|%)$')
       and public.is_known_name(p_household, coalesce(v_match[1], '') || v_match[2]) then
      quantity := coalesce(v_number_words ->> lower(v_match[3]), v_match[3]);
      v_text := coalesce(v_match[1], '') || v_match[2];
    end if;
  end if;

  -- Words, each with the list punctuation that followed it ("Tomaten, Gurke"): the name keeps it,
  -- the matching does not see it. A decimal comma ("1,5") is part of its word.
  v_tok := array_remove(regexp_split_to_array(regexp_replace(v_text, '\s+([,;]+)(?=\s|$)', '\1', 'g'), '\s+'), '');
  v_n := coalesce(cardinality(v_tok), 0);
  if v_n = 0 then
    name := '';
    return next;
    return;
  end if;
  v_suffix := array_fill(''::text, array[v_n]);
  for v_w in 1..v_n loop
    v_suffix[v_w] := coalesce(substring(v_tok[v_w] from '[,;]+$'), '');
    v_tok[v_w] := regexp_replace(v_tok[v_w], '[,;]+$', '');
  end loop;
  v_low := array(select public.normalize_item_name(t) from unnest(v_tok) with ordinality as u (t, ord) order by ord);
  v_kind := array_fill(null::text, array[v_n]);

  -- Marke: the longest run first, then the leftmost; a global brand before a learned one.
  select r.s, r.l, b.label, b.product, b.store_seed
  into v_brand_at, v_brand_len, brand, v_product, v_store_seed
  from (
    select g.s, gl.l, public.brand_key(array_to_string(v_tok[g.s:g.s + gl.l - 1], ' ')) as k
    from generate_series(1, v_n) as g (s) cross join generate_series(1, 3) as gl (l)
    where g.s + gl.l - 1 <= v_n
  ) r
  join (
    select gb.key as k, gb.brand as label, gb.product, gb.store_seed, 0 as rank from public.brands gb
    union all
    -- A brand learned before its word reached the dictionary is passed over.
    select hb.brand_key, hb.brand, null, null, 1 from public.household_brands hb
    where hb.household_id = p_household and not public.is_ordinary_text(hb.brand)
  ) b on b.k = r.k
  order by r.l desc, r.s, b.rank
  limit 1;
  if v_brand_at is not null then
    v_kind[v_brand_at:v_brand_at + v_brand_len - 1] := array_fill('brand'::text, array[v_brand_len]);
  end if;

  -- Eigenschaften, left to right.
  v_i := 1;
  while v_i <= v_n loop
    v_len := 0;
    v_prop := null;
    if v_kind[v_i] is null then
      v_t1 := v_low[v_i];
      v_t2 := case when v_i < v_n and v_kind[v_i + 1] is null then v_low[v_i + 1] end;
      if v_t1 ~ '^(groesse|grosse|gr\.?)$' and v_t2 ~ '^(\d+(\+|-\d+)?|x{0,3}s|m|x{0,3}l)$' then
        v_len := 2;
        v_prop := 'Größe ' || upper(v_t2);
      elsif v_t1 ~ '^(groesse|grosse|gr\.?)\d+\+?$' then
        v_len := 1;
        v_prop := 'Größe ' || substring(v_t1 from '\d+\+?$');
      elsif v_t1 ~ '^\d+([.,]\d+)?%$' or (v_t1 ~ '^\d+([.,]\d+)?$' and v_t2 = '%') then
        v_len := case when v_t1 like '%\%' then 1 else 2 end;
        v_prop := replace(rtrim(v_t1, '%'), '.', ',') || ' %';
        if v_i + v_len <= v_n and v_kind[v_i + v_len] is null and v_low[v_i + v_len] in ('fett', 'vol', 'vol.') then
          v_prop := v_prop || ' ' || v_tok[v_i + v_len];
          v_len := v_len + 1;
        end if;
      elsif v_t1 ~ '^\d+er$' and v_t2 in ('pack', 'packung', 'pck', 'box', 'karton') then
        v_len := 2;
        v_prop := v_tok[v_i] || ' ' || v_tok[v_i + 1];
      elsif v_t1 ~ '^\d+er(-?pack)?$' or v_t1 in ('doppelpack', 'vorteilspack', 'sparpack', 'grosspackung', 'familienpackung', 'monatsbox', 'xxl') then
        v_len := 1;
        v_prop := v_tok[v_i];
      elsif v_t1 in ('big', 'maxi', 'mega', 'jumbo', 'standard', 'spar', 'vorteils', 'familien', 'mini', 'duo', 'multi', 'monats', 'xxl', 'xl')
            and v_t2 in ('pack', 'packung', 'box') then
        v_len := 2;
        v_prop := v_tok[v_i] || ' ' || v_tok[v_i + 1];
      elsif v_t1 ~ '^\d+$' and v_t2 in ('rolle', 'rollen') then
        v_len := 2;
        v_prop := v_tok[v_i] || ' ' || v_tok[v_i + 1];
      elsif v_t1 ~ '^\d+-?lagig$' then
        v_len := 1;
        v_prop := substring(v_t1 from '^\d+') || '-lagig';
      elsif v_t1 ~ '^\d+$' and v_t2 = 'lagig' then
        v_len := 2;
        v_prop := v_t1 || '-lagig';
      elsif v_tok[v_i] ~* ('^\d+x\d+([.,]\d+)?' || v_units_re || '?\.?$') then
        -- A multipack: "6x1,5 l".
        v_len := 1;
        v_prop := regexp_replace(v_tok[v_i], '^(\d+x\d+(?:[.,]\d+)?)(.*)$', '\1 \2');
        v_prop := rtrim(v_prop);
      elsif v_t1 ~ '^\d+([.,]\d+)?$' and v_t2 is not null and v_tok[v_i + 1] ~* ('^(' || v_trailing_units || ')\.?$')
            and lower(v_tok[v_i + 1]) <> 'x' then
        v_len := 2;
        v_prop := v_tok[v_i] || ' ' || v_tok[v_i + 1];
      elsif v_tok[v_i] ~* ('^\d+([.,]\d+)?(' || v_trailing_units || ')\.?$') and v_t1 !~ '^\d+x$' then
        v_len := 1;
        v_prop := regexp_replace(v_tok[v_i], '^(\d+(?:[.,]\d+)?)\s*', '\1 ');
      elsif quantity is null and v_t1 ~ '^(\d+x|x\d+)$' then
        -- A count anywhere ("Spülmittel Pril 2x") when none came first.
        quantity := substring(v_t1 from '\d+');
        v_kind[v_i] := 'quantity';
      else
        -- Descriptors and flavours after a name word or the brand ("Joghurt Erdbeere"); the plain
        -- descriptors anywhere ("Bio Eier"). A flavour up front is the name ("Paprika rot").
        select d.label, d.words into v_prop, v_len
        from public.item_descriptors() d
        where d.alias = case when d.words = 2 then v_t1 || ' ' || coalesce(v_t2, '') else v_t1 end
          and (exists (select from unnest(v_kind[1:v_i - 1]) as k (kind) where k.kind is null or k.kind = 'brand')
               or d.alias in ('bio', 'laktosefrei', 'glutenfrei', 'vegan', 'vegetarisch', 'zuckerfrei',
                              'ohne zucker', 'koffeinfrei', 'entkoffeiniert', 'alkoholfrei', 'fettarm'))
        order by d.words desc
        limit 1;
      end if;
    end if;
    if v_prop is not null then
      -- The first amount with a unit is the Menge, wherever it stands ("Äpfel 1 kg bio"), unless
      -- a leading count took it ("2x Cola 0,5 l").
      if quantity is null and v_prop ~* ('^\d+([.,]\d+)? ?(' || v_trailing_units || ')\.?$') then
        quantity := v_prop;
      else
        v_props := v_props || v_prop;
      end if;
      v_kind[v_i:v_i + v_len - 1] := array_fill('property'::text, array[v_len]);
    end if;
    v_i := v_i + 1;
  end loop;

  name := rtrim(array_to_string(array(
    select t || sfx from unnest(v_tok, v_kind, v_suffix) with ordinality as u (t, kind, sfx, ord) where u.kind is null order by ord
  ), ' '), ',; ');
  if v_product is not null and name <> ''
     and (public.dictionary_category(public.item_key(name)) is null
          or (name ~ '^\S+$'
              and public.item_domain(public.dictionary_category(public.item_key(name)))
                  is distinct from public.item_domain(public.dictionary_category(public.item_key(v_product))))) then
    -- "Whiskas Lachs": the one name word is of another kind than the brand's product; "Persil
    -- Color", "Pampers Baby Dry": the dictionary knows none of the name. Either way it is the
    -- variety.
    v_props := name || v_props;
    name := v_product;
  elsif name = '' and v_product is not null then
    name := v_product;
  elsif name = '' and brand is not null then
    -- Only a brand and its properties: the brand is the name ("Nutella", "Nutella 2er Pack").
    name := array_to_string(v_tok[v_brand_at:v_brand_at + v_brand_len - 1], ' ');
    brand := null;
  elsif name = '' then
    -- Nothing but properties ("Größe 3", "Bio"): nothing is split off.
    name := array_to_string(v_tok, ' ');
    v_props := '{}';
  end if;
  -- Never longer than the columns (items: name 120, brand 60, properties 120, quantity 40).
  name := public.cap_text(name, 120);
  brand := public.cap_text(brand, 60);
  properties := public.cap_text(nullif(array_to_string(v_props, ', '), ''), 120);
  quantity := public.cap_text(quantity, 40);

  v_category := public.classify_item(p_household, name);
  category_id := v_category;
  store_id := coalesce(
    public.suggest_store(p_household, name),
    (select s.id from public.stores s where s.household_id = p_household and s.seed_key = v_store_seed),
    public.category_store(p_household, v_category)
  );
  return next;
end $$;

-- A DIY word in a household without that category takes Haushalt, not Sonstiges.
create or replace function public.classify_item_detail(
  p_household uuid, p_name text, out category_id uuid, out via text, out canonical_key text
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_key text := public.item_key(p_name);
  v_dict text;
  v_tier integer;
  v_len integer;
  v_word record;
  v_exact_category text;
  v_exact_how text;
  v_exact_len integer;
  v_exact_ord integer;
  v_fuzzy_category text;
  v_fuzzy_len integer;
  v_fuzzy_ord integer;
  v_seed text;
  v_max integer;
  v_canonical text;
begin
  -- Signed-in callers may classify only for their own household; service role and the database
  -- itself (no auth.uid()) are trusted server paths.
  if auth.uid() is not null and not public.is_household_member(p_household) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  -- One reading of the words: the canonical key, the head the lexicon recognizes exactly or as a
  -- synonym, and the head it recognizes fuzzily.
  for v_word in select * from public.classifier_words(v_key) w order by w.ord loop
    v_canonical := concat_ws(' ', v_canonical, v_word.canonical);
    if v_word.how in ('exact', 'synonym') then
      v_exact_category := v_word.category;
      v_exact_how := v_word.how;
      v_exact_len := v_word.len;
      v_exact_ord := v_word.ord;
    elsif v_word.how = 'fuzzy' then
      v_fuzzy_category := v_word.category;
      v_fuzzy_len := v_word.len;
      v_fuzzy_ord := v_word.ord;
    end if;
  end loop;
  v_canonical := coalesce(v_canonical, '');
  canonical_key := v_canonical;

  select m.category_id into category_id
  from public.category_memory m
  where m.household_id = p_household and m.item_key = v_key
  order by m.updated_at desc, m.corrections desc
  limit 1;
  if category_id is null and v_canonical <> '' then
    select m.category_id into category_id
    from public.category_memory m
    where m.household_id = p_household and m.canonical_key = v_canonical
    order by m.updated_at desc, m.corrections desc
    limit 1;
  end if;
  if category_id is not null then
    via := 'household';
    return;
  end if;

  select h.category, h.tier, h.len into v_dict, v_tier, v_len from public.dictionary_hit(v_key) h;
  -- The dictionary's strong rules win. A compound it matched only by its end loses to a longer
  -- form the lexicon recognizes after folding (Erdnusbutter is Erdnussbutter, pantry, not
  -- butter), or to a much longer one a typo away (Feuchttüscher).
  if v_tier = 2 and v_exact_len > v_len then
    v_seed := v_exact_category;
    via := v_exact_how;
  elsif v_tier = 2 and v_fuzzy_len >= v_len + 4 and v_fuzzy_ord >= coalesce(v_exact_ord, 0) then
    v_seed := v_fuzzy_category;
    via := 'fuzzy';
  elsif v_tier >= 2 then
    v_seed := v_dict;
    via := 'exact';
  elsif v_exact_category is not null then
    v_seed := v_exact_category;
    via := v_exact_how;
  end if;

  if v_seed is null and char_length(v_canonical) >= 6 then
    v_max := case when char_length(v_canonical) >= 8 then 2 else 1 end;
    with nearest as (
      select m.category_id, extensions.levenshtein_less_equal(v_canonical, m.canonical_key, v_max) as distance
      from public.category_memory m
      where m.household_id = p_household and left(m.canonical_key, 1) = left(v_canonical, 1)
        and abs(char_length(m.canonical_key) - char_length(v_canonical)) <= v_max
    )
    select min(n.category_id::text)::uuid into category_id
    from nearest n
    where n.distance = (select min(distance) from nearest) and n.distance <= v_max
    having count(distinct n.category_id) = 1;
    if category_id is not null then
      via := 'fuzzy';
      return;
    end if;
  end if;

  if v_seed is null and v_fuzzy_category is not null then
    v_seed := v_fuzzy_category;
    via := 'fuzzy';
  end if;

  if v_seed is null and v_tier = 1 then
    v_seed := v_dict;
    via := 'exact';
  end if;

  category_id := (
    select c.id from public.categories c
    where c.household_id = p_household and v_seed is not null
      and (c.seed_key = v_seed or v_seed = any (c.absorbed_seed_keys))
    order by c.seed_key = v_seed desc
    limit 1
  );
  -- Without the Baumarkt's categories a DIY word goes where it went before them: Haushalt.
  if category_id is null and exists (select from public.hardware_categories() h where h.seed_key = v_seed) then
    category_id := (
      select c.id from public.categories c
      where c.household_id = p_household and (c.seed_key = 'household' or 'household' = any (c.absorbed_seed_keys))
      order by c.seed_key = 'household' desc
      limit 1
    );
  end if;
  if category_id is null then
    category_id := (select c.id from public.categories c where c.household_id = p_household and c.seed_key = 'other');
    via := 'fallback';
  end if;
end $$;

-- A household without the DIY categories gets DIY terms from four typed letters on: a grocery
-- list's "Ho" stays Honig, not Holz and Hobel, and "Glühbi" still finds Glühbirne.
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
  v_unserved text[];
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
  v_unserved := array(
    select h.seed_key from public.hardware_categories() h
    where not exists (
      select from public.categories k
      where k.household_id = p_household and (k.seed_key = h.seed_key or h.seed_key = any (k.absorbed_seed_keys))
    )
  );

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
          and (t.category <> all (v_unserved) or char_length(v_last_key) >= 4)
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

-- Households that named a store Baumarkt before: its first such store becomes the hardware store
-- and the categories are seeded. The store keeps its layout (the household may have ordered it);
-- create_category puts the new categories before Sonstiges there. create_category checks
-- membership through auth.uid(), so each household is seeded as its owner (else any member).
do $$
declare
  v_store record;
  v_member uuid;
  v_seeded integer := 0;
begin
  for v_store in
    select distinct on (s.household_id) s.id, s.household_id
    from public.stores s
    where s.seed_key is null
      and public.store_name_key(s.name) in ('baumarkt', 'heimwerkermarkt', 'hardware store', 'diy store')
      and not exists (select from public.stores h where h.household_id = s.household_id and h.seed_key = 'hardware')
    order by s.household_id, s.sort_order, s.created_at, s.id
  loop
    select m.user_id into v_member
    from public.household_members m
    where m.household_id = v_store.household_id
    order by m.role = 'owner' desc, m.joined_at, m.user_id
    limit 1;
    continue when v_member is null;
    perform set_config('request.jwt.claims', json_build_object('sub', v_member, 'role', 'authenticated')::text, true);
    update public.stores set seed_key = 'hardware' where id = v_store.id;
    perform public.seed_hardware_categories(v_store.household_id);
    v_seeded := v_seeded + 1;
  end loop;
  perform set_config('request.jwt.claims', '', true);
  raise notice 'hardware_categories: % household(s) got the Baumarkt categories', v_seeded;
end $$;

revoke execute on function
  public.hardware_categories(),
  public.seed_hardware_categories(uuid),
  public.category_store(uuid, uuid)
from public, anon;
grant execute on function
  public.hardware_categories(),
  public.seed_hardware_categories(uuid),
  public.category_store(uuid, uuid)
to authenticated;
