-- Job 61: a bare number at the end of a typed or said line is the Menge when it can only be a
-- count ("Karotten 2" is 2 Karotten; "Windeln Größe 4", "Vitamin D3", "Büroklammern 100" keep
-- it). public.parse_item is the one parser behind add_item (MCP, Siri, Alexa) and
-- suggest_entries; the app's parseEntry (app/lib/list/entry.dart) applies the same rule offline.

-- Whether the classifier knows a word of p_name (dictionary, synonyms, typos:
-- public.classifier_words) or the household has had an item of that name.
create function public.is_known_name(p_household uuid, p_name text) returns boolean
language sql stable set search_path = '' as $$
  select exists (select from public.classifier_words(public.item_key(p_name)) w where w.category is not null)
    or exists (
      select from public.items i
      where i.household_id = p_household and i.normalized_name = public.normalize_item_name(p_name)
    );
$$;

revoke execute on function public.is_known_name(uuid, text) from public, anon;
grant execute on function public.is_known_name(uuid, text) to authenticated;

create or replace function public.parse_item(p_household uuid, p_text text)
returns table (name text, brand text, properties text, quantity text, store_id uuid, category_id uuid)
language plpgsql stable set search_path = '' as $$
declare
  v_units constant text := public.item_units();
  -- Rolls are an Eigenschaft at the end ("Klopapier 16 Rollen"), a Menge only up front.
  v_trailing_units constant text := replace(v_units, 'rolle|rollen|', '');
  v_number_words constant jsonb := public.item_number_words();
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

  -- A leading count or amount is the Menge ("2 Gurken", "zwei Liter Milch", "1/2 Brot").
  v_match := regexp_match(
    v_text,
    '^(?:(\d+(?:[.,/]\d+)?)(?:\s*(' || v_units || ')\.?)?|(' || (select string_agg(k, '|') from jsonb_object_keys(v_number_words) k)
      || ')(?:\s+(' || v_units || ')\.?)?)\s+(.+)$',
    'i'
  );
  if v_match is not null then
    quantity := concat_ws(' ',
      coalesce(v_match[1], v_number_words ->> lower(v_match[3])),
      case when lower(coalesce(v_match[2], v_match[4], 'x')) <> 'x' then coalesce(v_match[2], v_match[4]) end);
    v_text := v_match[5];
  end if;

  -- A bare count at the end is the Menge when it is 1 to 20, the word before it is no size or
  -- unit word and has no digit, and the rest is a known name: "Karotten 2", not "Windeln
  -- Größe 4", "Büroklammern 100" or "Plimbel 3" (job 61, supabase/tests/quantity_parse.tsv).
  if quantity is null then
    v_match := regexp_match(v_text, '^(.*\s)?(\S+)\s([1-9]\d?)$');
    if v_match is not null and v_match[3]::integer <= 20
       and v_match[2] !~ '\d'
       and lower(rtrim(v_match[2], '.')) !~ ('^(' || v_units || '|größe|grösse|groesse|gr|stufe|nr|no|size|typ|type|klasse|pack|pcs|mah|cl|%)$')
       and public.is_known_name(p_household, coalesce(v_match[1], '') || v_match[2]) then
      quantity := v_match[3];
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
    (select s.id from public.stores s
     join public.categories c on c.id = v_category and (c.seed_key = 'drugstore' or 'drugstore' = any (c.absorbed_seed_keys))
     where s.household_id = p_household and s.seed_key = 'dm')
  );
  return next;
end $$;
