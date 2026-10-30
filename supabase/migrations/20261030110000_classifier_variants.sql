-- Job 32a: spelling variants and synonyms in the classifier (Spec #8 Part A). "Möhren" went to
-- Obst & Gemüse and "Karrotten" to Sonstiges. Now every add path (the items trigger, add_item and
-- add_items for MCP, Siri, voice and Alexa, parse_item and suggest_entries for the app) gets:
--   - spelling folded before lookup (doubled letters, ph/th/gh, c/k, silent h), on top of
--     item_key's case, umlauts, ß and plurals;
--   - a synonym table (supabase/classifier/synonyms.tsv: regional German and English) that gives
--     each variant its canonical term's category and canonical key;
--   - a conservative fuzzy match against the dictionary and the household's corrections;
--   - a household's correction for its canonical key, so it holds for spelling variants,
--     synonyms and recognized typos of the corrected item.
-- items keep their text as typed and gain two hidden columns: canonical_key (job 32b's duplicate
-- hint matches on it) and categorized_via (the app's analytics).

create extension if not exists fuzzystrmatch with schema extensions;

-- Spelling ------------------------------------------------------------------

-- One word of an item_key spelled the way its variants share: doubled letters single
-- (Karrotten, Tomatten), ph -> f, th -> t, gh -> g (Jogurt, Spagetti), c -> k except in
-- ch/ce/ci (Broccoli, Cola), ck, dt and tz simplified, h after a vowel dropped when no vowel
-- follows (Hänchen, Tomahten). Words under 5 letters stay as they are, and so does a word that
-- gets that short by losing its doubled letters, so Kasse is not Käse and Hack not Haken. No two
-- dictionary terms of different categories share a folded form
-- (supabase/tests/classifier_variants.test.sql checks it).
create function public.fold_word(p_word text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v text := p_word;
begin
  if char_length(v) < 5 then
    return v;
  end if;
  v := regexp_replace(v, '([a-z])\1+', '\1', 'g');
  if char_length(v) < 5 then
    return v;
  end if;
  v := regexp_replace(v, 'c(?![hei])', 'k', 'g');
  v := replace(replace(replace(replace(replace(replace(v, 'ph', 'f'), 'th', 't'), 'gh', 'g'), 'kk', 'k'), 'dt', 't'), 'tz', 'z');
  return regexp_replace(v, '([aeiou])h(?![aeiou])', '\1', 'g');
end $$;

-- An item_key with every word folded.
create function public.fold_key(p_key text) returns text
language sql immutable set search_path = '' as $$
  select coalesce(
    (select string_agg(public.fold_word(w), ' ' order by ord)
     from unnest(string_to_array(p_key, ' ')) with ordinality as t (w, ord)
     where w <> ''),
    ''
  );
$$;

-- Synonyms and the lexicon ---------------------------------------------------

-- Generated from supabase/classifier/synonyms.tsv (generate.ts). The canonical is a
-- classifier_terms term; generate.ts and the pgTAP test check that.
create table public.classifier_synonyms (
  variant text primary key check (variant ~ '^[a-zäöüß]+( [a-zäöüß]+)*$'),
  canonical text not null check (canonical ~ '^[a-zäöüß]+( [a-zäöüß]+)*$')
);

-- Every folded form the classifier recognizes: the dictionary's terms and the synonyms'
-- variants, each with its canonical key and category. Rebuilt by
-- public.refresh_classifier_lexicon() whenever the dictionary or the synonyms change.
create table public.classifier_lexicon (
  form text primary key,
  canonical text not null,
  category text not null,
  -- Known only through the synonym table (not itself a dictionary term).
  synonym boolean not null,
  -- For the fuzzy match: same first letter, similar length.
  head text generated always as (left(form, 1)) stored,
  len integer generated always as (char_length(form)) stored
);

create index classifier_lexicon_fuzzy_idx on public.classifier_lexicon (head, len) where form !~ ' ';

-- Corrections and store memory, by canonical key too.
alter table public.category_memory add column canonical_key text;
alter table public.item_store_memory add column canonical_key text;
create index category_memory_canonical_idx on public.category_memory (household_id, canonical_key);
create index item_store_memory_canonical_idx on public.item_store_memory (household_id, canonical_key);

-- Items: the canonical key (job 32b's duplicate hint) and how the category was chosen.
alter table public.items
  add column canonical_key text,
  add column categorized_via text
    check (categorized_via in ('household', 'exact', 'synonym', 'fuzzy', 'fallback', 'picked'));

comment on column public.items.canonical_key is
  'public.canonical_key(name): spelling variants, synonyms and recognized typos share it (job 32a). Hidden; the duplicate hint (job 32b) matches on it.';
comment on column public.items.categorized_via is
  'How the category was chosen on insert: household (a correction), exact (dictionary, also after folding spelling), synonym, fuzzy, fallback (Sonstiges), picked (the user chose another category than the guess). Null on rows from before job 32a.';

-- The lexicon's single-word form nearest to a folded word, when it is near enough and the nearest
-- forms agree on the category. Conservative: same first letter; a pair of 5-letter words only by
-- swapping two neighbouring letters (Mlich); one edit when the longer of the two has 6 letters or
-- more, two when both have 8 or more (a swap counts as one edit). Words under 5 letters never
-- match, so Reis/Eis and Brot/Rot never meet. p_max caps the distance further.
create function public.lexicon_fuzzy(
  p_word text, p_max integer default 2,
  out form text, out canonical text, out category text, out len integer, out distance integer
)
language plpgsql stable set search_path = '' as $$
begin
  if char_length(p_word) < 5 then
    return;
  end if;
  select n.form, n.canonical, n.category, n.len, n.distance into form, canonical, category, len, distance
  from (
  with candidates as (
    select l.form, l.canonical, l.category, l.len,
      l.len = char_length(p_word) and exists (
        select from generate_series(1, char_length(p_word) - 1) as i
        where overlay(p_word placing substr(p_word, i + 1, 1) || substr(p_word, i, 1) from i for 2) = l.form
      ) as swap,
      extensions.levenshtein_less_equal(p_word, l.form, 2) as edits,
      case
        when least(l.len, char_length(p_word)) >= 8 then 2
        when greatest(l.len, char_length(p_word)) >= 6 then 1
        else 0
      end as allowed
    from public.classifier_lexicon l
    where l.head = left(p_word, 1)
      and l.len between char_length(p_word) - 2 and char_length(p_word) + 2 and l.form !~ ' '
      and l.form <> p_word
  ),
  near as (
    select c.form, c.canonical, c.category, c.len, case when c.swap then 1 else c.edits end as distance
    from candidates c
    where (c.swap and p_max >= 1) or c.edits <= least(c.allowed, p_max)
  ),
  nearest as (
    select n.* from near n where n.distance = (select min(x.distance) from near x)
  )
  select n.* from nearest n
  where (select count(distinct x.category) from nearest x) = 1
  ) n
  order by n.form
  limit 1;
end $$;

-- Per word of an item_key: its folded form, its canonical form and, when the lexicon recognizes
-- it, its category, how (exact: the folded word or the end of a compound is a dictionary term;
-- synonym; fuzzy: public.lexicon_fuzzy) and the length of the form that matched. Phrases of the
-- lexicon ("gelbe rübe") are one entry. A compound whose recognized end leaves 4+ letters is
-- checked for a longer form one edit away that ends otherwise, so Feuchttüscher is Feuchttücher,
-- not Schere; Spültücher stays Tücher (Spucktücher ends the same: the typo would not be in the
-- head).
create function public.classifier_words(p_key text)
returns table (ord integer, word text, canonical text, category text, how text, len integer)
language plpgsql stable set search_path = '' as $$
declare
  v_words text[] := string_to_array(public.fold_key(p_key), ' ');
  v_folded text;
  v_phrases public.classifier_lexicon[] := '{}'::public.classifier_lexicon[];
  v_phrase public.classifier_lexicon;
  v_hit public.classifier_lexicon;
  v_fuzzy public.classifier_lexicon;
  v_word text;
  v_n integer := 0;
begin
  if coalesce(cardinality(v_words), 0) = 0 or v_words = '{""}' then
    return;
  end if;
  -- Phrases first, longest first; each becomes one token (#n).
  if cardinality(v_words) > 1 then
    v_folded := ' ' || array_to_string(v_words, ' ') || ' ';
    for v_phrase in
      select l.* from public.classifier_lexicon l
      where l.form = any (array(
        select array_to_string(v_words[a:b], ' ')
        from generate_series(1, cardinality(v_words)) as a cross join generate_series(a + 1, cardinality(v_words)) as b
      ))
      order by l.len desc
    loop
      continue when v_folded not like '% ' || v_phrase.form || ' %';
      v_phrases := v_phrases || v_phrase;
      v_folded := replace(v_folded, ' ' || v_phrase.form || ' ', ' #' || cardinality(v_phrases) || ' ');
    end loop;
    v_words := string_to_array(btrim(v_folded), ' ');
  end if;

  foreach v_word in array v_words loop
    v_n := v_n + 1;
    ord := v_n;
    word := v_word;
    canonical := v_word;
    category := null;
    how := null;
    len := null;
    v_hit := null;
    v_fuzzy := null;
    if v_word ~ '^#[0-9]+$' then
      v_hit := v_phrases[substr(v_word, 2)::integer];
      word := v_hit.form;
    else
      -- The word, else the longest form of 4+ letters it ends with (a compound).
      select l.* into v_hit from public.classifier_lexicon l
      where l.form = any (array(
        select substr(v_word, i) from generate_series(1, greatest(char_length(v_word) - 3, 1)) as i
      ))
      order by l.len desc
      limit 1;
      if v_hit.form is null or char_length(v_word) - v_hit.len >= 4 then
        select f.form, f.canonical, f.category into v_fuzzy.form, v_fuzzy.canonical, v_fuzzy.category
        from public.lexicon_fuzzy(v_word, case when v_hit.form is null then 2 else 1 end) f
        where v_hit.form is null or (f.len >= v_hit.len + 4 and f.form not like '%' || v_hit.form);
      end if;
    end if;
    if v_fuzzy.form is not null then
      canonical := v_fuzzy.canonical;
      category := v_fuzzy.category;
      how := 'fuzzy';
      len := char_length(v_fuzzy.form);
    elsif v_hit.form is not null then
      canonical := case when v_word ~ '^#' then v_hit.canonical
                        else left(v_word, char_length(v_word) - v_hit.len) || v_hit.canonical end;
      category := v_hit.category;
      how := case when v_hit.synonym then 'synonym' else 'exact' end;
      len := v_hit.len;
    end if;
    return next;
  end loop;
end $$;

-- The key spelling variants, synonyms and recognized typos of an item share: "Karotten",
-- "Karrotten", "Möhren" and "Mohrrüben" all give "mor". From an item_key, and from a name.
create function public.canonical_of_key(p_key text) returns text
language sql stable set search_path = '' as $$
  select coalesce((select string_agg(w.canonical, ' ' order by w.ord) from public.classifier_words(p_key) w), '');
$$;

create function public.canonical_key(p_name text) returns text
language sql stable set search_path = '' as $$
  select public.canonical_of_key(public.item_key(p_name));
$$;

-- Memory rows carry the canonical key of their item key.
create function public.memory_canonical_key() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.canonical_key := public.canonical_of_key(new.item_key);
  return new;
end $$;

create trigger category_memory_canonical_key
  before insert or update of item_key on public.category_memory
  for each row execute function public.memory_canonical_key();
create trigger item_store_memory_canonical_key
  before insert or update of item_key on public.item_store_memory
  for each row execute function public.memory_canonical_key();

-- Rebuilds the lexicon from the dictionary and the synonyms, then every canonical key of the
-- memories. A generated dictionary or synonym migration calls it (and refreshes items).
create function public.refresh_classifier_lexicon() returns void
language plpgsql set search_path = '' as $$
begin
  delete from public.classifier_lexicon;
  insert into public.classifier_lexicon (form, canonical, category, synonym)
  select distinct on (x.form) x.form, x.canonical, x.category,
    not exists (select from public.classifier_terms t where public.fold_key(t.key) = x.form)
  from (
    -- A variant's canonical wins over the term itself (karotte -> möhre).
    select public.fold_key(public.item_key(s.variant)) as form, public.fold_key(t.key) as canonical, t.category, 0 as rank
    from public.classifier_synonyms s
    join public.classifier_terms t on t.term = s.canonical
    union all
    select public.fold_key(t.key), public.fold_key(t.key), t.category, 1
    from public.classifier_terms t
  ) x
  where x.form <> ''
  order by x.form, x.rank, x.canonical;

  update public.category_memory set canonical_key = public.canonical_of_key(item_key);
  update public.item_store_memory set canonical_key = public.canonical_of_key(item_key);
end $$;

-- The dictionary ------------------------------------------------------------

-- public.dictionary_category with the rule that matched (5 phrase, 4 whole key, 3 frozen marker,
-- 2 word ends with a term, 1 word starts with a term) and the matched term's length. Same rules and
-- order as before, but each rule is an index lookup of the key's word runs, endings and
-- beginnings instead of a LIKE over every term (job 32a, AC8: the classifier stays as fast):
--   5: a term with a space equals a run of 2+ consecutive words;
--   2: a single-word term equals the word or one of its endings of 3+ letters;
--   1: a single-word term of 4+ letters equals one of the word's beginnings of 4+ letters.
create function public.dictionary_hit(p_key text, out category text, out tier integer, out len integer)
language plpgsql stable set search_path = '' as $$
declare
  v_words text[] := array_remove(string_to_array(p_key, ' '), '');
  v_n integer := coalesce(cardinality(v_words), 0);
  v_runs text[] := '{}'::text[];
  v_parts text[] := '{}'::text[];
  v_ords integer[] := '{}'::integer[];
  v_starts text[] := '{}'::text[];
  v_start_ords integer[] := '{}'::integer[];
  v_w text;
begin
  for a in 1..v_n loop
    for b in a + 1..v_n loop
      v_runs := v_runs || array_to_string(v_words[a:b], ' ');
    end loop;
    v_w := v_words[a];
    for i in 1..greatest(char_length(v_w) - 2, 1) loop
      v_parts := v_parts || substr(v_w, i);
      v_ords := v_ords || a;
    end loop;
    for i in 4..char_length(v_w) loop
      v_starts := v_starts || left(v_w, i);
      v_start_ords := v_start_ords || a;
    end loop;
  end loop;
  select h.category, h.tier, h.len into category, tier, len
  from (
    select d.category, 5 as tier, char_length(d.key) as len, 0 as ord
    from public.classifier_terms d
    where d.key = any (v_runs)
    union all
    select d.category, 4, char_length(d.key), 0
    from public.classifier_terms d
    where d.key = p_key
    union all
    select 'frozen', 3, 0, t.ord::integer
    from unnest(v_words) with ordinality as t (w, ord)
    where t.w = 'tk' or t.w like 'tiefkuhl%' or t.w like 'tiefgekuhl%' or t.w like 'gefror%'
    union all
    select d.category, 2, char_length(d.key),
      (select max(e.o) from unnest(v_parts, v_ords) as e (p, o) where e.p = d.key)
    from public.classifier_terms d
    where d.key = any (v_parts)
    union all
    select d.category, 1, char_length(d.key),
      (select max(e.o) from unnest(v_starts, v_start_ords) as e (p, o) where e.p = d.key)
    from public.classifier_terms d
    where d.key = any (v_starts)
  ) h
  order by h.tier desc, h.len desc, h.ord desc, h.category
  limit 1;
end $$;

create or replace function public.dictionary_category(p_key text) returns text
language sql stable set search_path = '' as $$
  select (public.dictionary_hit(p_key)).category;
$$;

-- The classifier ------------------------------------------------------------

-- The category for a name and how it was found, first match wins:
--   household  the household corrected this item key, else its canonical key (spelling variants,
--              synonyms, recognized typos of the corrected item);
--   exact      the dictionary's phrase, whole-key, frozen-marker and compound rules;
--   exact/synonym  the lexicon after folding spelling, or a synonym (Karrotten, Paradeiser);
--   fuzzy      a household correction within the fuzzy distance (whole canonical key), then
--              the lexicon's fuzzy match (Kartofeln, Brokoli);
--   exact      the dictionary's weakest rule, a word starting with a term;
--   fallback   Sonstiges.
-- Among words, the later one (the head of a German noun phrase) wins, as in the dictionary.
create function public.classify_item_detail(
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
  if category_id is null then
    category_id := (select c.id from public.categories c where c.household_id = p_household and c.seed_key = 'other');
    via := 'fallback';
  end if;
end $$;

-- The one classifier's category, for every caller that only needs it.
create or replace function public.classify_item(p_household uuid, p_name text) returns uuid
language sql stable security definer set search_path = '' as $$
  select (public.classify_item_detail(p_household, p_name)).category_id;
$$;

-- The store an item is usually bought at, or null (any supermarket): the item key's, else its
-- canonical key's (a store remembered for "Möhren" holds for "Karotten").
create or replace function public.suggest_store(p_household uuid, p_name text) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_key text := public.item_key(p_name);
  v_store uuid;
begin
  if auth.uid() is not null and not public.is_household_member(p_household) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  select m.store_id into v_store from public.item_store_memory m
  where m.household_id = p_household and m.item_key = v_key
  order by m.updated_at desc
  limit 1;
  if v_store is null and exists (select from public.item_store_memory m where m.household_id = p_household) then
    select m.store_id into v_store from public.item_store_memory m
    where m.household_id = p_household and m.canonical_key = public.canonical_of_key(v_key)
    order by m.updated_at desc
    limit 1;
  end if;
  return v_store;
end $$;

-- The items trigger ----------------------------------------------------------

-- Adds to the latest body (item details): the classifier runs on every insert, and its category
-- is taken when none was given; canonical_key follows the name; categorized_via says how the
-- category was found, or "picked" when the insert brought another one.
create or replace function public.items_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_guess record;
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
  if tg_op = 'INSERT' or new.category_id is null then
    v_guess := public.classify_item_detail(new.household_id, new.name);
    new.canonical_key := v_guess.canonical_key;
    if new.category_id is null then
      new.category_id := v_guess.category_id;
      new.categorized_via := v_guess.via;
    elsif tg_op = 'INSERT' then
      new.categorized_via := case when new.category_id = v_guess.category_id then v_guess.via else 'picked' end;
    end if;
  elsif new.name is distinct from old.name then
    new.canonical_key := public.canonical_key(new.name);
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

-- Same as before, but the category guess is the one items_before_write made for the row
-- (categorized_via 'picked': the insert brought another category), so the classifier runs once.
create or replace function public.items_learn_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if coalesce(current_setting('family_groceries.learning', true), '') = 'off' then
    return null;
  end if;
  with added as materialized (
    select n.id, n.household_id, public.item_key(n.name) as key, n.category_id, n.store_id,
      n.categorized_via = 'picked' as picked_category,
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
    where a.key <> '' and a.picked_category
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

-- Grants and row level security ----------------------------------------------

revoke execute on function
  public.fold_word(text),
  public.fold_key(text),
  public.lexicon_fuzzy(text, integer),
  public.classifier_words(text),
  public.canonical_of_key(text),
  public.canonical_key(text),
  public.memory_canonical_key(),
  public.refresh_classifier_lexicon(),
  public.dictionary_hit(text),
  public.classify_item_detail(uuid, text)
from public, anon;
grant execute on function
  public.fold_word(text),
  public.fold_key(text),
  public.lexicon_fuzzy(text, integer),
  public.classifier_words(text),
  public.canonical_of_key(text),
  public.canonical_key(text),
  public.dictionary_hit(text),
  public.classify_item_detail(uuid, text)
to authenticated;
revoke execute on function public.memory_canonical_key(), public.refresh_classifier_lexicon() from authenticated;

alter table public.classifier_synonyms enable row level security;
alter table public.classifier_lexicon enable row level security;
create policy classifier_synonyms_read on public.classifier_synonyms for select to authenticated using (true);
create policy classifier_lexicon_read on public.classifier_lexicon for select to authenticated using (true);
revoke all on public.classifier_synonyms, public.classifier_lexicon from anon;
revoke insert, update, delete, truncate on public.classifier_synonyms, public.classifier_lexicon from authenticated;
