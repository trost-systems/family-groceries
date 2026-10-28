-- Job 15: Marke, Eigenschaften and walk order on items; the parser (public.parse_item) and the
-- server add path built on it (public.add_item); drag and drop (place_item, move_item) and the
-- store order (reorder_stores); brand and properties in the data export (export_my_data). The
-- contract is docs/design/h-satz-final/SPEC.md, section 3.

-- Item columns -------------------------------------------------------------

alter table public.items
  add column brand text check (brand is null or char_length(brand) <= 60),
  add column properties text check (properties is null or char_length(properties) <= 120),
  -- Walk order inside a group (household, store, category); lower first, ties by created_at, id.
  add column sort_key double precision;

create index items_group_order_idx on public.items (household_id, category_id, store_id, sort_key);

-- Existing rows keep the order they were added in. No trigger runs: the backfill is not an edit,
-- so neither updated_at nor the history changes.
alter table public.items disable trigger user;
update public.items i set sort_key = r.n * 1024
from (
  select id, row_number() over (partition by household_id, store_id, category_id order by created_at, id) as n
  from public.items
) r
where r.id = i.id;
alter table public.items enable trigger user;

-- The parser's words --------------------------------------------------------

-- Units after an amount, as one regex alternation ("2 l", "3 Packungen").
create function public.item_units() returns text
language sql immutable set search_path = '' as $$
  select 'x|kg|g|gr|l|ml|cl|stk|stück|st|pck|pkg|packung|packungen|pack|packs|päckchen|paket|pakete|'
    'dose|dosen|büchse|büchsen|flasche|flaschen|bund|becher|glas|gläser|tüte|tüten|tube|tuben|'
    'beutel|sack|säcke|netz|netze|kiste|kisten|kasten|kästen|karton|kartons|pfund|liter|kilo|'
    'gramm|rolle|rollen|tafel|tafeln|stange|stangen|schale|schalen|scheibe|scheiben|riegel|'
    'paar|dutzend|laib|laibe|kopf|köpfe';
$$;

create function public.item_number_words() returns jsonb
language sql immutable set search_path = '' as $$
  select '{"ein": 1, "eine": 1, "einen": 1, "einer": 1, "eins": 1,
    "zwei": 2, "drei": 3, "vier": 4, "fünf": 5, "fuenf": 5, "sechs": 6, "sieben": 7, "acht": 8,
    "neun": 9, "zehn": 10, "elf": 11, "zwölf": 12, "zwoelf": 12}'::jsonb;
$$;

-- Descriptor words and flavours: alias (as public.normalize_item_name writes it), label, words.
create function public.item_descriptors() returns table (alias text, label text, words integer)
language sql immutable set search_path = '' as $$
  select * from (values
      ('bio', 'Bio', 1), ('laktosefrei', 'laktosefrei', 1), ('glutenfrei', 'glutenfrei', 1),
      ('vegan', 'vegan', 1), ('vegetarisch', 'vegetarisch', 1), ('zero', 'Zero', 1), ('light', 'Light', 1),
      ('zuckerfrei', 'zuckerfrei', 1), ('ohne zucker', 'ohne Zucker', 2), ('koffeinfrei', 'koffeinfrei', 1),
      ('entkoffeiniert', 'entkoffeiniert', 1), ('alkoholfrei', 'alkoholfrei', 1), ('fettarm', 'fettarm', 1),
      ('mager', 'mager', 1), ('vollfett', 'vollfett', 1), ('gerieben', 'gerieben', 1),
      ('geschnitten', 'geschnitten', 1), ('gemahlen', 'gemahlen', 1), ('ganze bohne', 'ganze Bohne', 2),
      ('ganze bohnen', 'ganze Bohnen', 2), ('gehackt', 'gehackt', 1), ('gewuerfelt', 'gewürfelt', 1),
      ('passiert', 'passiert', 1), ('geschaelt', 'geschält', 1), ('gestueckelt', 'gestückelt', 1),
      ('getrocknet', 'getrocknet', 1), ('geraeuchert', 'geräuchert', 1), ('gesalzen', 'gesalzen', 1),
      ('ungesalzen', 'ungesalzen', 1), ('ungesuesst', 'ungesüßt', 1), ('geroestet', 'geröstet', 1),
      ('still', 'still', 1), ('medium', 'medium', 1), ('classic', 'classic', 1), ('spritzig', 'spritzig', 1),
      ('mit kohlensaeure', 'mit Kohlensäure', 2), ('ohne kohlensaeure', 'ohne Kohlensäure', 2),
      ('naturtrueb', 'naturtrüb', 1), ('mild', 'mild', 1), ('extra mild', 'extra mild', 2),
      ('scharf', 'scharf', 1), ('mittelalt', 'mittelalt', 1), ('jung', 'jung', 1), ('natur', 'Natur', 1),
      ('sensitiv', 'sensitiv', 1), ('sensitive', 'sensitive', 1), ('kinder', 'Kinder', 1),
      ('vollkorn', 'Vollkorn', 1), ('fein', 'fein', 1), ('grob', 'grob', 1), ('festkochend', 'festkochend', 1),
      ('mehligkochend', 'mehligkochend', 1), ('vorwiegend festkochend', 'vorwiegend festkochend', 2),
      ('weich', 'weich', 1), ('hart', 'hart', 1), ('zartbitter', 'Zartbitter', 1),
      ('edelbitter', 'Edelbitter', 1), ('vollmilch', 'Vollmilch', 1), ('weiss', 'weiß', 1),
      ('erdbeere', 'Erdbeere', 1), ('erdbeer', 'Erdbeer', 1), ('vanille', 'Vanille', 1),
      ('schoko', 'Schoko', 1), ('kirsche', 'Kirsche', 1), ('kirsch', 'Kirsch', 1),
      ('himbeere', 'Himbeere', 1), ('himbeer', 'Himbeer', 1), ('heidelbeere', 'Heidelbeere', 1),
      ('blaubeere', 'Blaubeere', 1), ('pfirsich', 'Pfirsich', 1), ('aprikose', 'Aprikose', 1),
      ('mango', 'Mango', 1), ('maracuja', 'Maracuja', 1), ('kokos', 'Kokos', 1), ('karamell', 'Karamell', 1),
      ('caramel', 'Caramel', 1), ('haselnuss', 'Haselnuss', 1), ('nuss', 'Nuss', 1), ('mandel', 'Mandel', 1),
      ('zitrone', 'Zitrone', 1), ('limette', 'Limette', 1), ('orange', 'Orange', 1), ('apfel', 'Apfel', 1),
      ('banane', 'Banane', 1), ('multivitamin', 'Multivitamin', 1), ('minze', 'Minze', 1),
      ('pfefferminz', 'Pfefferminz', 1), ('stracciatella', 'Stracciatella', 1), ('pistazie', 'Pistazie', 1),
      ('paprika', 'Paprika', 1), ('chili', 'Chili', 1), ('sour cream', 'Sour Cream', 2), ('zart', 'zart', 1),
      ('kernig', 'kernig', 1), ('huhn', 'Huhn', 1), ('rind', 'Rind', 1), ('gefluegel', 'Geflügel', 1)
  ) as d (alias, label, words);
$$;

-- p_text cut to p_max characters: at the last space that fits, else hard.
create function public.cap_text(p_text text, p_max integer) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_text is null or char_length(p_text) <= p_max then p_text
    when position(' ' in left(p_text, p_max + 1)) > 1
      then rtrim(substring(left(p_text, p_max + 1) from '^(.*) '), ' ,')
    else left(p_text, p_max)
  end;
$$;

-- The kind of a classifier category for the parser's variety rule: drinks, non-food (household
-- and drugstore share the non-food aisle) or food; null for no category.
create function public.item_domain(p_category text) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_category in ('household', 'drugstore') then 'non-food'
    when p_category = 'drinks' then 'drinks'
    when p_category is not null then 'food'
  end;
$$;

-- Whether p_text is made of words the list already means something by: a classifier term (by
-- public.item_key), a descriptor or flavour, a number, number word or unit. Such a text is no
-- brand: learned, "Milch" would turn "Hafer Milch" into Hafer + Marke Milch.
create function public.is_ordinary_text(p_text text) returns boolean
language sql stable set search_path = '' as $$
  select exists (select from public.classifier_terms t where t.key = public.item_key(p_text) and t.key <> '')
    or exists (select from public.item_descriptors() d where d.alias = public.normalize_item_name(p_text))
    or not exists (
      select from unnest(regexp_split_to_array(btrim(coalesce(p_text, '')), '\s+')) as w (word)
      where w.word <> ''
        and not (
          w.word ~ '^\d'
          or lower(w.word) ~ ('^(' || public.item_units() || ')\.?$')
          or public.item_number_words() ? lower(w.word)
          or exists (select from public.item_descriptors() d
                     where d.words = 1 and d.alias = public.normalize_item_name(w.word))
          or exists (select from public.classifier_terms t
                     where t.key = public.item_key(w.word) and t.key <> '')
        )
    );
$$;

-- Brands -------------------------------------------------------------------

-- The identity of a brand: lowercase, umlauts and accents folded (Müller = Mueller), ß -> ss,
-- spaces, dots, hyphens and apostrophes dropped. Coca Cola = Coca-Cola, Dr. Oetker = Dr Oetker,
-- Beck's = Becks. & and ! stay: "Ja!" is a brand, "ja" is not.
create function public.brand_key(p_brand text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(
    replace(replace(replace(
      translate(
        replace(replace(replace(replace(lower(coalesce(p_brand, '')), 'ä', 'a'), 'ö', 'o'), 'ü', 'u'), 'ß', 'ss'),
        'àáâãåçèéêëìíîïñòóôõùúûýÿ', 'aaaaaceeeeiiiinooooouuuyy'
      ),
      'ae', 'a'), 'oe', 'o'), 'ue', 'u'),
    '[[:space:].''’´`-]+', '', 'g'
  );
$$;

-- Generated from supabase/classifier/brands.tsv by generate_brands.ts; global, read-only for
-- clients. product names what a text that is only the brand means (Pampers -> Windeln);
-- store_seed is the store of a store's own brand (Balea -> dm).
create table public.brands (
  key text generated always as (public.brand_key(brand)) stored primary key,
  brand text not null check (char_length(brand) between 1 and 60),
  product text check (product is null or char_length(product) between 1 and 120),
  store_seed text check (store_seed is null or store_seed in ('dm', 'lidl', 'edeka'))
);

-- Brands a household wrote on its items that public.brands does not know; the latest spelling
-- wins. Written only by the items_learn_brand trigger.
create table public.household_brands (
  household_id uuid not null references public.households (id) on delete cascade,
  brand_key text not null check (brand_key <> ''),
  brand text not null check (char_length(brand) between 1 and 60),
  uses integer not null default 1,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (household_id, brand_key)
);

-- The items trigger --------------------------------------------------------

-- Adds to the latest body (account deletion): brand and properties are trimmed like quantity,
-- and sort_key is filled once store and category are known. An insert without a key and an
-- update that sets it to null go to the end of their group; so does an update that changes the
-- store or category but not the key (a plain edit), unless place_item asked to keep it.
create or replace function public.items_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - '{added_by,bought_by}'::text[]) = (to_jsonb(old) - '{added_by,bought_by}'::text[])
     and (new.added_by, new.bought_by) is distinct from (old.added_by, old.bought_by)
     and (new.added_by is not distinct from old.added_by
          or (new.added_by is null and not exists (select from auth.users u where u.id = old.added_by)))
     and (new.bought_by is not distinct from old.bought_by
          or (new.bought_by is null and not exists (select from auth.users u where u.id = old.bought_by)))
  then
    return new;
  end if;
  new.name := btrim(new.name);
  new.quantity := nullif(btrim(new.quantity), '');
  new.brand := nullif(btrim(new.brand), '');
  new.properties := nullif(btrim(new.properties), '');
  new.normalized_name := public.normalize_item_name(new.name);
  if new.category_id is null then
    new.category_id := public.classify_item(new.household_id, new.name);
  end if;
  if tg_op = 'INSERT' and new.store_id is null then
    new.store_id := public.suggest_store(new.household_id, new.name);
  end if;
  if new.sort_key is null
     or (tg_op = 'UPDATE'
         and (new.store_id, new.category_id) is distinct from (old.store_id, old.category_id)
         and new.sort_key is not distinct from old.sort_key
         and coalesce(current_setting('family_groceries.sort_key', true), '') <> 'keep') then
    new.sort_key := coalesce(
      (select max(i.sort_key) from public.items i
       where i.household_id = new.household_id and i.category_id = new.category_id
         and i.store_id is not distinct from new.store_id and i.id <> new.id),
      0
    ) + 1024;
  end if;
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
    new.added_by := old.added_by;
    new.updated_at := now();
  end if;
  if new.status = 'bought' and (tg_op = 'INSERT' or old.status is distinct from 'bought') then
    new.bought_at := now();
    new.bought_by := auth.uid();
  elsif new.status = 'active' then
    new.bought_at := null;
    new.bought_by := null;
  end if;
  return new;
end $$;

-- Brand and properties are part of what the list shows; the walk order is not.
create or replace function public.items_log_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.items := case when tg_op = 'DELETE' then old else new end;
  v_action text;
begin
  -- A household delete cascades to its items; its history goes with it.
  if tg_op = 'DELETE' and not exists (select 1 from public.households where id = old.household_id) then
    return null;
  end if;
  if tg_op = 'UPDATE'
     and (new.name, new.quantity, new.brand, new.properties, new.category_id, new.store_id, new.status)
         is not distinct from
         (old.name, old.quantity, old.brand, old.properties, old.category_id, old.store_id, old.status) then
    return null;
  end if;
  v_action := case
    when tg_op = 'INSERT' then 'added'
    when tg_op = 'DELETE' then 'deleted'
    when new.status = 'bought' and old.status = 'active' then 'bought'
    when new.status = 'active' and old.status = 'bought' then 'restored'
    else 'edited'
  end;
  insert into public.item_events (household_id, item_id, action, item_name, category_id)
  values (v_row.household_id, v_row.id, v_action, v_row.name, v_row.category_id);
  return null;
end $$;

-- A brand written on any item that public.brands does not know is learned for the household,
-- so the parser finds it next time ("Windeln Lillydoo"). An ordinary word (public.is_ordinary_text)
-- stays on the item but is not learned.
create function public.items_learn_brand() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_key text := public.brand_key(new.brand);
begin
  if v_key = ''
     or (tg_op = 'UPDATE' and new.brand is not distinct from old.brand)
     or exists (select from public.brands b where b.key = v_key)
     or public.is_ordinary_text(new.brand) then
    return null;
  end if;
  insert into public.household_brands as h (household_id, brand_key, brand)
  values (new.household_id, v_key, new.brand)
  on conflict (household_id, brand_key)
    do update set brand = excluded.brand, uses = h.uses + 1, updated_at = clock_timestamp();
  return null;
end $$;

create trigger items_learn_brand
  after insert or update of brand on public.items
  for each row execute function public.items_learn_brand();

-- The parser ---------------------------------------------------------------

-- Splits one entry into Bezeichnung, Marke, Eigenschaften and Menge, and picks the category and
-- store for it (SPEC.md section 3, "The parser"):
--   "Windeln Pampers Größe 3" -> Windeln | Pampers | Größe 3 | - | dm
--   "2 l Milch 1,5 %"         -> Milch | - | 1,5 % | 2 l
--   "Ja! Gouda gerieben"      -> Gouda | Ja! | gerieben
-- Menge: a leading amount (number or number word, optional unit), else a trailing number with a
-- unit. Marke: the longest run of 1 to 3 words that is a known brand (global, then learned; a
-- learned ordinary word is passed over). Eigenschaften: sizes, packs, percentages, rolls, plies,
-- further amounts anywhere; descriptor words and flavours only after a name word or the brand.
-- When the brand has a product and what is left of the name is unknown to the dictionary, or is
-- one word of another kind (public.item_domain of its dictionary category) than the product,
-- it is the first Eigenschaft and the product the name: "Whiskas Lachs" -> Katzenfutter |
-- Whiskas | Lachs, "Pampers Baby Dry" -> Windeln | Pampers | Baby Dry, but "Pampers
-- Feuchttücher" and "Krombacher Radler" keep their word. A text with no name word left keeps the brand's
-- product as its name, else the brand as typed (and no brand); with neither, it keeps everything
-- as its name.
create function public.parse_item(p_household uuid, p_text text)
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

-- Adding items -------------------------------------------------------------

-- The server add path for MCP and Siri: parses p_text, and every explicit (non-null) argument
-- replaces the parsed value. The same item (name, brand and properties, folded like
-- item_name_key, so "Gurke" is "2 Gurken" but Größe 4 is not Größe 5) already on the list comes
-- back instead of a new row. A blank text adds nothing.
create function public.add_item(
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
  end if;
  return next v_row;
end $$;

-- Same signature and semantics as before, one add_item per entry.
create or replace function public.add_items(p_household uuid, p_names text[], p_store uuid default null)
returns setof public.items
language plpgsql set search_path = '' as $$
declare
  v_raw text;
begin
  if auth.uid() is not null and not public.is_household_member(p_household) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  foreach v_raw in array coalesce(p_names, '{}') loop
    return query select * from public.add_item(p_household, v_raw, p_store);
  end loop;
end $$;

-- Walk order ---------------------------------------------------------------

-- Puts p_item directly before or after the active item p_anchor, in the anchor's store and
-- category. Only p_item changes, unless the gap to the anchor's neighbour is under 0.001: then
-- the group is renumbered (step 1024) first. Bought items keep their keys, so an untick puts an
-- item back where it was.
create function public.place_item(p_item uuid, p_anchor uuid, p_edge text) returns public.items
language plpgsql set search_path = '' as $$
declare
  v_item public.items;
  v_anchor public.items;
  v_neighbour double precision;
  v_key double precision;
begin
  if p_edge is null or p_edge not in ('before', 'after') then
    raise exception 'invalid_edge' using errcode = '22023';
  end if;
  select * into v_item from public.items where id = p_item;
  if not found then
    raise exception 'item_not_found' using errcode = 'P0002';
  end if;
  if not public.is_household_member(v_item.household_id) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  select * into v_anchor from public.items where id = p_anchor and household_id = v_item.household_id;
  if not found then
    raise exception 'item_not_found' using errcode = 'P0002';
  end if;
  if v_anchor.id = v_item.id or v_anchor.status <> 'active' then
    raise exception 'invalid_anchor' using errcode = '22023';
  end if;

  for v_round in 1..2 loop
    if p_edge = 'before' then
      select i.sort_key into v_neighbour from public.items i
      where i.household_id = v_anchor.household_id and i.category_id = v_anchor.category_id
        and i.store_id is not distinct from v_anchor.store_id and i.id <> p_item
        and (i.sort_key, i.created_at, i.id) < (v_anchor.sort_key, v_anchor.created_at, v_anchor.id)
      order by i.sort_key desc, i.created_at desc, i.id desc
      limit 1;
    else
      select i.sort_key into v_neighbour from public.items i
      where i.household_id = v_anchor.household_id and i.category_id = v_anchor.category_id
        and i.store_id is not distinct from v_anchor.store_id and i.id <> p_item
        and (i.sort_key, i.created_at, i.id) > (v_anchor.sort_key, v_anchor.created_at, v_anchor.id)
      order by i.sort_key, i.created_at, i.id
      limit 1;
    end if;
    if not found then
      v_key := v_anchor.sort_key + case when p_edge = 'before' then -1024 else 1024 end;
      exit;
    elsif abs(v_anchor.sort_key - v_neighbour) >= 0.001 then
      v_key := (v_anchor.sort_key + v_neighbour) / 2;
      exit;
    end if;
    update public.items i set sort_key = r.n * 1024
    from (
      select g.id, row_number() over (order by g.sort_key, g.created_at, g.id) as n
      from public.items g
      where g.household_id = v_anchor.household_id and g.category_id = v_anchor.category_id
        and g.store_id is not distinct from v_anchor.store_id and g.id <> p_item
    ) r
    where i.id = r.id and i.sort_key is distinct from r.n * 1024;
    select i.sort_key into v_anchor.sort_key from public.items i where i.id = p_anchor;
  end loop;

  -- The new key may equal the old one by chance; the trigger must not treat that as a plain edit.
  perform set_config('family_groceries.sort_key', 'keep', true);
  update public.items set store_id = v_anchor.store_id, category_id = v_anchor.category_id, sort_key = v_key
  where id = p_item
  returning * into v_item;
  perform set_config('family_groceries.sort_key', '', true);
  return v_item;
end $$;

-- Puts the item at the end of group (p_store, p_category): a drop on a category or store
-- divider. A null p_store is no store ("Ohne Laden"); a null p_category keeps the category.
create function public.move_item(p_item uuid, p_store uuid, p_category uuid) returns public.items
language plpgsql set search_path = '' as $$
declare
  v_item public.items;
begin
  select * into v_item from public.items where id = p_item;
  if not found then
    raise exception 'item_not_found' using errcode = 'P0002';
  end if;
  if not public.is_household_member(v_item.household_id) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  update public.items
  set store_id = p_store, category_id = coalesce(p_category, category_id), sort_key = null
  where id = p_item
  returning * into v_item;
  return v_item;
end $$;

-- Sets the store order to p_ids (every store of the household, once): sort_order 10, 20, 30.
create function public.reorder_stores(p_household uuid, p_ids uuid[]) returns void
language plpgsql set search_path = '' as $$
begin
  if not public.is_household_member(p_household) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  if cardinality(p_ids) is distinct from (select count(distinct x) from unnest(p_ids) as x)
     or exists (
       (select id from public.stores where household_id = p_household)
       except all (select unnest(p_ids))
     )
     or exists (
       (select unnest(p_ids))
       except all (select id from public.stores where household_id = p_household)
     ) then
    raise exception 'invalid_store_order' using errcode = '22023';
  end if;
  update public.stores s set sort_order = t.ord * 10
  from unnest(p_ids) with ordinality as t (id, ord)
  where s.id = t.id and s.sort_order is distinct from t.ord * 10;
end $$;

-- Data export ----------------------------------------------------------------

-- The body from the account deletion migration; items_added gains brand and properties. The
-- additions keep version 1 (docs/ACCOUNT_DELETION.md).
create or replace function public.export_my_data() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  -- An app connected over OAuth (MCP) acts on the list, not on the account.
  if auth.jwt() ->> 'client_id' is not null then
    raise exception 'session_required' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'format', 'family-groceries-export',
    'version', 1,
    'exported_at', now(),
    'account', (
      select jsonb_build_object(
        'id', u.id,
        'email', u.email,
        'created_at', u.created_at,
        'last_sign_in_at', u.last_sign_in_at,
        'providers', coalesce(
          (select jsonb_agg(distinct i.provider) from auth.identities i where i.user_id = u.id),
          '[]'::jsonb
        )
      )
      from auth.users u where u.id = v_user
    ),
    'profile', (
      select jsonb_build_object('display_name', p.display_name, 'created_at', p.created_at)
      from public.profiles p where p.id = v_user
    ),
    'household', (
      select jsonb_build_object('id', h.id, 'name', h.name, 'role', m.role, 'joined_at', m.joined_at)
      from public.household_members m
      join public.households h on h.id = m.household_id
      where m.user_id = v_user
    ),
    'items_added', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', i.name,
        'brand', i.brand,
        'properties', i.properties,
        'quantity', i.quantity,
        'status', i.status,
        'category', c.name,
        'store', s.name,
        'created_at', i.created_at,
        'bought_at', i.bought_at
      ) order by i.created_at, i.id)
      from public.items i
      join public.household_members m on m.household_id = i.household_id and m.user_id = v_user
      left join public.categories c on c.id = i.category_id
      left join public.stores s on s.id = i.store_id
      where i.added_by = v_user
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'action', e.action,
        'item_name', e.item_name,
        'category', c.name,
        'created_at', e.created_at
      ) order by e.created_at, e.id)
      from public.item_events e
      left join public.categories c on c.id = e.category_id
      where e.actor = v_user
    ), '[]'::jsonb),
    'access_tokens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', t.name,
        'token_hint', t.token_hint,
        'created_at', t.created_at,
        'last_used_at', t.last_used_at,
        'revoked_at', t.revoked_at
      ) order by t.created_at, t.id)
      from public.personal_access_tokens t
      where t.user_id = v_user
    ), '[]'::jsonb),
    'connected_apps', coalesce((
      select jsonb_agg(jsonb_build_object(
        'client_name', oc.client_name,
        'scopes', c.scopes,
        'granted_at', c.granted_at,
        'revoked_at', c.revoked_at
      ) order by c.granted_at, c.id)
      from auth.oauth_consents c
      join auth.oauth_clients oc on oc.id = c.client_id
      where c.user_id = v_user
    ), '[]'::jsonb)
  );
end $$;

-- Grants and row level security --------------------------------------------

revoke execute on function
  public.brand_key(text),
  public.parse_item(uuid, text),
  public.add_item(uuid, text, uuid, text, text, text),
  public.place_item(uuid, uuid, text),
  public.move_item(uuid, uuid, uuid),
  public.reorder_stores(uuid, uuid[]),
  public.items_learn_brand()
from public, anon;
grant execute on function
  public.brand_key(text),
  public.parse_item(uuid, text),
  public.add_item(uuid, text, uuid, text, text, text),
  public.place_item(uuid, uuid, text),
  public.move_item(uuid, uuid, uuid),
  public.reorder_stores(uuid, uuid[])
to authenticated;
revoke execute on function public.items_learn_brand() from authenticated;

alter table public.brands enable row level security;
alter table public.household_brands enable row level security;

create policy brands_read on public.brands for select to authenticated using (true);
create policy household_brands_member on public.household_brands for select to authenticated
  using (public.is_household_member(household_id));

-- Brands change only through migrations and the learning trigger.
revoke all on public.brands, public.household_brands from anon;
revoke insert, update, delete on public.brands, public.household_brands from authenticated;
