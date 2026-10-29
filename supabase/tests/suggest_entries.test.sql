-- Job 17: public.suggest_entries, the add sheet's rows for one typed entry, and learning from a
-- store or category inserted with the row (docs/design/h-satz-final/SPEC.md, 2.7 and 3).
begin;
select plan(41);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'carla@example.com'),
  ('00000000-0000-0000-0000-0000000000d1', 'dora@example.com');

select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
create temp table hd as select id from public.create_household('Dora');
insert into public.items (household_id, name, brand, properties, status)
select id, 'Windeln', 'Lillydoo', 'Größe 3', 'bought' from hd;
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
create temp table hc as select id from public.create_household('Carla');
grant select on hc, hd to authenticated;

create function pg_temp.store(p_seed text) returns uuid language sql as $$
  select id from public.stores where household_id = (select id from hc) and seed_key = p_seed;
$$;

create function pg_temp.cat(p_seed text) returns uuid language sql as $$
  select id from public.categories where household_id = (select id from hc) and seed_key = p_seed;
$$;

-- Carla's rows for p_text, each as "source: name | brand | properties | quantity | store seed".
create function pg_temp.rows(p_text text, p_limit integer default 8) returns text[] language sql as $$
  select coalesce(array_agg(
    concat_ws(' | ', s.source || ': ' || s.name, coalesce(s.brand, '-'), coalesce(s.properties, '-'),
      coalesce(s.quantity, '-'), coalesce(st.seed_key, '-'))
    order by s.ord), '{}')
  from public.suggest_entries((select id from hc), p_text, p_limit) with ordinality as s (source, name, brand, properties, quantity, store_id, category_id, ord)
  left join public.stores st on st.id = s.store_id;
$$;

-- The household bought Windeln four ways, the latest first; one more over a year ago.
insert into public.items (household_id, name, brand, properties, quantity, store_id, status)
select id, v.name, v.brand, v.properties, v.quantity, pg_temp.store('dm'), 'bought'
from hc, (values
  ('Windeln', 'Pampers', 'Größe 4, Big Pack', '3'),
  ('Windeln', 'Pampers', 'Größe 3, sensitiv', null),
  ('Windeln', 'Huggies', 'Größe 3', null),
  ('Windeln', 'Babylove', 'Größe 5', null),
  ('Windeln', 'Pampers', 'Größe 6, Maxi Pack, Nacht', null)
) as v (name, brand, properties, quantity);
set local role postgres;
set local session_replication_role = replica;
update public.items i set bought_at = now() - t.age, updated_at = now() - t.age
from (values
  ('Größe 4, Big Pack', interval '10 days'), ('Größe 3, sensitiv', interval '20 days'),
  ('Größe 3', interval '30 days'), ('Größe 5', interval '40 days'), ('Größe 6, Maxi Pack, Nacht', interval '400 days')
) as t (properties, age)
where i.household_id = (select id from hc) and i.properties = t.properties;
set local session_replication_role = origin;
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');

-- Members only; blank text gives nothing.
select throws_ok(
  $$ select * from public.suggest_entries((select id from hd), 'Milch') $$,
  '42501', 'not_a_member', 'another household''s suggestions are refused'
);
select is(pg_temp.rows(''), '{}', 'an empty text gives no rows');
select is(pg_temp.rows('   '), '{}', 'a blank text gives no rows');
select is(pg_temp.rows(null), '{}', 'no text gives no rows');

-- The typed row is the parser's reading, first.
select results_eq(
  $$ select s.name, s.brand, s.properties, s.quantity, s.store_id, s.category_id
     from public.suggest_entries((select id from hc), '2 l Milch 1,5 %') s where s.source = 'typed' $$,
  $$ select p.name, p.brand, p.properties, p.quantity, p.store_id, p.category_id
     from public.parse_item((select id from hc), '2 l Milch 1,5 %') p $$,
  'the typed row is exactly parse_item'
);
select results_eq(
  $$ select s.source, s.name, s.brand, s.properties, s.quantity, s.store_id, s.category_id
     from public.suggest_entries((select id from hc), 'Windeln Pampers Größe 3') s limit 1 $$,
  $$ select 'typed', p.name, p.brand, p.properties, p.quantity, p.store_id, p.category_id
     from public.parse_item((select id from hc), 'Windeln Pampers Größe 3') p $$,
  'the parsed entry comes first'
);

-- Every source, in order. Variant "sensitiv" is the second history row and Huggies Größe 3 the
-- third, so neither shows twice; the Windeln of over a year ago are not history.
select is(
  pg_temp.rows('Windeln Pampers Größe 3', 20),
  array[
    'typed: Windeln | Pampers | Größe 3 | - | dm',
    'history: Windeln | Pampers | Größe 4, Big Pack | 3 | dm',
    'history: Windeln | Pampers | Größe 3, sensitiv | - | dm',
    'history: Windeln | Huggies | Größe 3 | - | dm',
    'pack: Windeln | Pampers | Größe 3, Big Pack | - | dm',
    'size: Windeln | Pampers | Größe 4 | - | dm',
    'size: Windeln | Pampers | Größe 2 | - | dm',
    'brand: Windeln | Babylove | Größe 3 | - | dm'
  ],
  'Windeln Pampers Größe 3: typed, history, pack, sizes, brand'
);
select is(
  pg_temp.rows('Windeln Pampers Größe 4'),
  array[
    'typed: Windeln | Pampers | Größe 4 | - | dm',
    'history: Windeln | Pampers | Größe 4, Big Pack | 3 | dm',
    'history: Windeln | Pampers | Größe 3, sensitiv | - | dm',
    'history: Windeln | Huggies | Größe 3 | - | dm',
    'variant: Windeln | Pampers | Größe 4, sensitiv | - | dm',
    'size: Windeln | Pampers | Größe 5 | - | dm',
    'size: Windeln | Pampers | Größe 3 | - | dm',
    'brand: Windeln | Huggies | Größe 4 | - | dm'
  ],
  'a variant is the typed entry plus a property bought with it; 8 rows by default'
);
select is(
  (pg_temp.rows('Windeln Pampers Größe 3 Maxi Pack', 20))[5],
  'pack: Windeln | Pampers | Größe 3, Big Pack | - | dm',
  'another pack replaces the typed one'
);
select is(
  (pg_temp.rows('2 Windeln Pampers Größe 1', 20))[2:7],
  array[
    'history: Windeln | Pampers | Größe 4, Big Pack | 2 | dm',
    'history: Windeln | Pampers | Größe 3, sensitiv | 2 | dm',
    'history: Windeln | Huggies | Größe 3 | 2 | dm',
    'pack: Windeln | Pampers | Größe 1, Big Pack | 2 | dm',
    'variant: Windeln | Pampers | Größe 1, sensitiv | 2 | dm',
    'size: Windeln | Pampers | Größe 2 | 2 | dm'
  ],
  'a typed Menge goes on every row; Größe 0 is no size'
);
select is(
  (pg_temp.rows('Windeln Pampers Größe 8', 20))[6:8],
  array['variant: Windeln | Pampers | Größe 8, sensitiv | - | dm', 'size: Windeln | Pampers | Größe 7 | - | dm',
        'brand: Windeln | Huggies | Größe 8 | - | dm'],
  'Größe 9 is no size either'
);
select is(
  pg_temp.rows('Wi', 4),
  array[
    'typed: Wi | - | - | - | -',
    'history: Windeln | Pampers | Größe 4, Big Pack | 3 | dm',
    'history: Windeln | Pampers | Größe 3, sensitiv | - | dm',
    'history: Windeln | Huggies | Größe 3 | - | dm'
  ],
  'history matches names starting with the typed one'
);
select is(
  pg_temp.rows('W', 20),
  array['typed: W | - | - | - | -'],
  'one letter matches no history and no catalog'
);
select ok(
  not exists (select from public.suggest_entries((select id from hc), 'Windeln', 20) s where s.brand = 'Lillydoo'),
  'another household''s items are not suggested'
);

-- Brands of the product, from public.brands when the household has none.
select is(
  pg_temp.rows('Spülmittel'),
  array['typed: Spülmittel | - | - | - | -', 'brand: Spülmittel | Fairy | - | - | -', 'brand: Spülmittel | Pril | - | - | -'],
  'Spülmittel: the brands whose product it is, A-Z'
);
select is(
  pg_temp.rows('Spülmittel Pril'),
  array['typed: Spülmittel | Pril | - | - | -', 'brand: Spülmittel | Fairy | - | - | -'],
  'the typed brand is not offered again'
);

-- The catalog: dictionary terms the last word starts, written like nouns, parsed in its place.
select is(
  (pg_temp.rows('2 Mi'))[1:2],
  array['typed: Mi | - | - | 2 | -', 'catalog: Milch | - | - | 2 | -'],
  'the catalog completes the last word and keeps the Menge'
);
select is(
  (select count(*)::int from public.suggest_entries((select id from hc), 'Mi', 20) s where s.source = 'catalog'),
  3,
  'at most three catalog rows'
);
select is(
  pg_temp.rows('Übe'),
  array['typed: Übe | - | - | - | -', 'catalog: Überraschungsei | - | - | - | -'],
  'a catalog word is written with a capital, umlauts included'
);
select is(pg_temp.rows('Salat Ol'), array['typed: Salat Ol | - | - | - | -', 'catalog: Salat Oliven | - | - | - | -',
  'catalog: Salat Olivenöl | - | - | - | -'], 'a term that folds to the typed name (Öl = Ol) is the typed row');

-- The limit.
select is(cardinality(pg_temp.rows('Windeln Pampers Größe 3', 3)), 3, 'p_limit cuts the rows');
select is(pg_temp.rows('Windeln Pampers Größe 3', 0), array['typed: Windeln | Pampers | Größe 3 | - | dm'], 'p_limit is at least 1');
select is(
  pg_temp.rows('Windeln', 100),
  array[
    'typed: Windeln | - | - | - | dm',
    'history: Windeln | Pampers | Größe 4, Big Pack | 3 | dm',
    'history: Windeln | Pampers | Größe 3, sensitiv | - | dm',
    'history: Windeln | Huggies | Größe 3 | - | dm',
    'pack: Windeln | - | Big Pack | - | dm',
    'variant: Windeln | - | sensitiv | - | dm',
    'brand: Windeln | Pampers | - | - | dm',
    'brand: Windeln | Huggies | - | - | dm',
    'brand: Windeln | Babylove | - | - | dm',
    'catalog: Windelbeutel | - | - | - | dm'
  ],
  'p_limit is at most 20: all ten rows, brands the household used latest first'
);

-- A history row is at the store and in the category the list guesses now, not where the old entry
-- was, so tapping it teaches nothing.
select set_config('family_groceries.learning', 'off', true);
insert into public.items (household_id, name, store_id, category_id, status)
select id, 'Haferflocken', pg_temp.store('edeka'), pg_temp.cat('bakery'), 'bought' from hc;
select set_config('family_groceries.learning', '', true);
select results_eq(
  $$ select s.store_id, s.category_id from public.suggest_entries((select id from hc), 'Hafer') s where s.source = 'history' $$,
  $$ select public.guess_store(hc.id, 'Haferflocken', null, public.classify_item(hc.id, 'Haferflocken')),
       public.classify_item(hc.id, 'Haferflocken') from hc $$,
  'a history row carries today''s store and category guesses'
);
insert into public.items (household_id, name, brand, properties, store_id, category_id)
select hc.id, s.name, s.brand, s.properties, s.store_id, s.category_id
from hc, public.suggest_entries(hc.id, 'Hafer') s where s.source = 'history';
select is(
  (select count(*)::int from public.item_store_memory where item_key = public.item_key('Haferflocken'))
    + (select count(*)::int from public.category_memory where item_key = public.item_key('Haferflocken')),
  0,
  'adding a history row as suggested learns nothing'
);

-- Learning from an insert: a picked store or category is learned, a guess is not.
insert into public.items (household_id, name, store_id) select id, 'Gurke', pg_temp.store('lidl') from hc;
select results_eq(
  $$ select item_key, store_id, times from public.item_store_memory where item_key = 'gurk' $$,
  $$ values ('gurk', pg_temp.store('lidl'), 1) $$,
  'a store picked with the insert is learned'
);
insert into public.items (household_id, name, category_id) select id, 'Kekse', pg_temp.cat('pantry') from hc;
select is(public.classify_item((select id from hc), 'Keks'), pg_temp.cat('pantry'), 'a category picked with the insert is learned');

insert into public.items (household_id, name) select id, 'Tomaten' from hc;
insert into public.items (household_id, name, brand, store_id, category_id)
select id, p.name, p.brand, p.store_id, p.category_id from hc, public.parse_item(hc.id, 'Duschgel Balea') p;
insert into public.items (household_id, name, store_id, category_id)
select id, 'Shampoo', pg_temp.store('dm'), public.classify_item(id, 'Shampoo') from hc;
select is(
  (select count(*)::int from public.item_store_memory where item_key in ('tomat', 'duschgel', 'shampoo'))
    + (select count(*)::int from public.category_memory where item_key in ('tomat', 'duschgel', 'shampoo')),
  0,
  'an insert with the guessed store and category learns nothing (memory, brand store, drugstore)'
);

insert into public.items (id, household_id, name, store_id)
select (select id from public.items where name = 'Gurke'), id, 'Gurke', pg_temp.store('edeka') from hc
on conflict (id) do nothing;
select is((select sum(times)::int from public.item_store_memory where item_key = 'gurk'), 1, 'a retried add that inserts nothing learns nothing');

-- Rückgängig right after the add takes the pick back; putting the deleted item back learns nothing.
create temp table kekse as select * from public.items where name = 'Kekse';
delete from public.items where name = 'Kekse';
select is((select count(*)::int from public.category_memory where item_key = 'keks'), 0, 'deleting a picked add right away takes the pick back');
insert into public.items select * from kekse;
select is((select count(*)::int from public.category_memory where item_key = 'keks'), 0, 'undoing a delete learns nothing');

-- An older lesson comes back: Gurke was tagged Lidl, then Edeka; picking Lidl again and undoing it
-- leaves Edeka the latest and Lidl's count as it was.
insert into public.items (household_id, name, store_id) select id, 'Gurken', pg_temp.store('edeka') from hc;
select is(public.suggest_store((select id from hc), 'Gurke'), pg_temp.store('edeka'), 'Edeka picked for Gurke');
insert into public.items (id, household_id, name, store_id)
select '00000000-0000-0000-0000-00000000a001', id, 'Gurke', pg_temp.store('lidl') from hc;
select is(public.suggest_store((select id from hc), 'Gurke'), pg_temp.store('lidl'), 'then Lidl again');
delete from public.items where id = '00000000-0000-0000-0000-00000000a001';
select results_eq(
  $$ select st.seed_key, m.times from public.item_store_memory m join public.stores st on st.id = m.store_id
     where m.item_key = 'gurk' order by m.updated_at desc $$,
  $$ values ('edeka', 1), ('lidl', 1) $$,
  'undoing the Lidl pick: Edeka is the latest again, Lidl counted once'
);

-- A lesson learned on the row since the add stays when the item goes.
insert into public.items (id, household_id, name, category_id)
select '00000000-0000-0000-0000-00000000a002', id, 'Senf', pg_temp.cat('bakery') from hc;
insert into public.items (id, household_id, name, category_id)
select '00000000-0000-0000-0000-00000000a003', id, 'Senf', pg_temp.cat('pantry') from hc;
update public.items set category_id = pg_temp.cat('bakery') where id = '00000000-0000-0000-0000-00000000a003';
delete from public.items where id = '00000000-0000-0000-0000-00000000a002';
select is(public.classify_item((select id from hc), 'Senf'), pg_temp.cat('bakery'), 'a later edit to the same category keeps the lesson');

insert into public.items (household_id, name, category_id)
select id, 'Zwiebeln', pg_temp.cat('bakery') from hc
union all select id, 'Zwiebeln', null from hc;
select results_eq(
  $$ select category_id, corrections from public.category_memory where item_key = 'zwiebel' $$,
  $$ values (pg_temp.cat('bakery'), 1) $$,
  'in one statement, the second row is not a correction of the first'
);

select set_config('family_groceries.learning', 'off', true);
insert into public.items (household_id, name, store_id, category_id) select id, 'Salz', pg_temp.store('lidl'), pg_temp.cat('drugstore') from hc;
select set_config('family_groceries.learning', '', true);
select is(
  (select count(*)::int from public.item_store_memory where item_key = 'salz') + (select count(*)::int from public.category_memory where item_key = 'salz'),
  0,
  'learning off learns nothing'
);

select is((select count(*)::int from public.add_item((select id from hc), 'Windeln Babylove')), 1, 'add_item adds');
select is((select count(*)::int from public.item_store_memory where item_key = 'windeln'), 0, 'add_item with the parsed store learns nothing');
select is(
  (select store_id from public.add_item((select id from hc), 'Brot', pg_temp.store('lidl'))),
  pg_temp.store('lidl'),
  'add_item takes an explicit store'
);
select is(public.suggest_store((select id from hc), 'Brot'), pg_temp.store('lidl'), 'and learns it');

select * from finish();
rollback;
