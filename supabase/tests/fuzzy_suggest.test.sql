-- Job 59: public.suggest_entries finds what was meant despite a typo or from part of a word, from
-- 3 characters (in-word from 4); shorter input matches prefixes only. Better matches rank first
-- within a source, history above catalog, the caps as before.
begin;
select plan(17);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000005e1', 'erna@example.com');
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000005e1", "role": "authenticated"}', true);
create temp table h as select id from public.create_household('Erna');
grant select on h to authenticated;

-- The household's rows for p_text, each as "source: name".
create function pg_temp.rows(p_text text, p_limit integer default 20) returns text[] language sql as $$
  select coalesce(array_agg(s.source || ': ' || s.name order by s.ord), '{}')
  from public.suggest_entries((select id from h), p_text, p_limit) with ordinality as s (source, name, brand, properties, quantity, store_id, category_id, ord);
$$;
create function pg_temp.history(p_text text) returns text[] language sql as $$
  select coalesce(array_agg(r order by o), '{}') from unnest(pg_temp.rows(p_text)) with ordinality as t (r, o) where r like 'history: %';
$$;

-- Bought before, the latest first: the typo Tomte, then Hafermilch, Cocktailtomate, Tomatensoße,
-- Tomate, Reis, Milchreis.
insert into public.items (household_id, name, status)
select id, v.name, 'bought' from h, (values ('Tomte'), ('Hafermilch'), ('Cocktailtomate'), ('Tomatensoße'),
  ('Tomate'), ('Reis'), ('Milchreis')) as v (name);
set local role postgres;
set local session_replication_role = replica;
update public.items i set bought_at = now() - t.age, updated_at = now() - t.age
from (values ('Tomte', interval '1 day'), ('Hafermilch', interval '2 days'), ('Cocktailtomate', interval '3 days'),
  ('Tomatensoße', interval '4 days'), ('Tomate', interval '5 days'), ('Reis', interval '6 days'),
  ('Milchreis', interval '7 days')) as t (name, age)
where i.household_id = (select id from h) and i.name = t.name;
set local session_replication_role = origin;
select set_config('role', 'authenticated', true);

-- Typos and part of a word.
select is(pg_temp.rows('Hafermlch'), array['typed: Hafermlch', 'history: Hafermilch'],
  'Hafermlch finds Hafermilch, history before the catalog''s same entry');
select is(pg_temp.history('milch'), array['history: Milchreis', 'history: Hafermilch'],
  'milch finds Milchreis (prefix) and Hafermilch (inside the word)');
select is(pg_temp.history('MILCH'), pg_temp.history('milch'), 'case does not matter');
select is(pg_temp.history('Ris'), array['history: Reis'], 'a typo is forgiven from 3 letters');
select is(pg_temp.history('Eis'), '{}', 'three letters inside a word are no match (Eis is not Reis)');
select is(pg_temp.history('Tomatn'), array['history: Tomate', 'history: Tomte'],
  'Tomatn: two edits from 6 letters, the most similar first');

-- Under 3 characters: prefixes only.
select is(pg_temp.history('Ha'), array['history: Hafermilch'], 'two letters match the start');
select is(pg_temp.history('af'), '{}', 'two letters inside a word are no match');
select is(pg_temp.history('Hf'), '{}', 'two letters are not forgiven a typo');
select is(pg_temp.rows('Mlc'), array['typed: Mlc'], 'three letters are forgiven one edit, not two');

-- Exact (here the typed row itself), then prefix, then inside a word, then a typo, whatever was
-- bought last.
select is(
  pg_temp.history('Tomate'),
  array['history: Tomatensoße', 'history: Cocktailtomate', 'history: Tomte'],
  'Tomate: prefix, in-word, then the typo Tomte, though bought last'
);
select is(
  pg_temp.history('Tom'),
  array['history: Tomte', 'history: Tomatensoße', 'history: Tomate'],
  'within one kind of match the latest first'
);

-- The catalog: typos and part of the last word, after its prefixes; history rows come first.
select is(pg_temp.rows('Schkolade'), array['typed: Schkolade', 'catalog: Schokolade'], 'Schkolade finds Schokolade');
select is(pg_temp.rows('Jogurt'), array['typed: Jogurt', 'catalog: Joghurt'], 'Jogurt finds Joghurt');
select ok(
  not exists (select from unnest(pg_temp.rows('Rote Bete')) r where r like 'catalog: %'),
  'after other words, the last word is completed, not corrected (no Rote Besen)'
);
select is(
  (select array_agg(split_part(r, ':', 1) order by o) from unnest(pg_temp.rows('Hafer')) with ordinality as t (r, o)),
  array['typed', 'history', 'catalog', 'catalog'],
  'history rows rank above catalog rows (whose Hafermilch is the history row)'
);
select is(
  (select count(*)::int from unnest(pg_temp.rows('Schoko')) r where r like 'catalog: %'),
  3,
  'at most three catalog rows, as before'
);

select * from finish();
rollback;
