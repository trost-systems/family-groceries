-- Job 90: category names are unique per household ignoring case and spacing; create_category
-- returns the category the household already has; merge_duplicate_categories folds existing
-- duplicates into one (the fallback, else the oldest) without losing items, layouts or memory.
begin;
select plan(42);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000009a1', 'ada@example.com'),
  ('00000000-0000-0000-0000-0000000009b1', 'bo@example.com');
select pg_temp.login('00000000-0000-0000-0000-0000000009a1');
create temp table ha as select id from public.create_household(p_name => 'Ada', p_stores => array['dm', 'Lidl']);
select pg_temp.login('00000000-0000-0000-0000-0000000009b1');
create temp table hb as select id from public.create_household(p_name => 'Bo');
reset role;
grant select on ha, hb to authenticated;

create function pg_temp.cat(p_household uuid, p_name text) returns uuid language sql as $$
  select id from public.categories where household_id = p_household and name = p_name;
$$;
create function pg_temp.seeded(p_household uuid, p_seed text) returns uuid language sql as $$
  select id from public.categories where household_id = p_household and seed_key = p_seed;
$$;
create function pg_temp.store(p_household uuid, p_name text) returns uuid language sql as $$
  select id from public.stores where household_id = p_household and name = p_name;
$$;

-- Creating and renaming.
select pg_temp.login('00000000-0000-0000-0000-0000000009a1');
create temp table baby as select (public.create_category((select id from ha), 'Baby')).id;
grant select on baby to authenticated;
select is((public.create_category((select id from ha), '  baby ')).id, (select id from baby),
  'the same name in another case and spacing returns the existing category');
select is((public.create_category((select id from ha), 'SONSTIGES')).id, pg_temp.seeded((select id from ha), 'other'),
  'a seeded category is found by name too');
select is((public.create_category((select id from ha), E'\tbaby\n')).id, (select id from baby),
  'a leading tab or trailing newline still finds the existing category');
select is(
  (select count(*)::int from public.categories
   where household_id = (select id from ha) and lower(btrim(name)) in ('baby', 'sonstiges')),
  2, 'no duplicate was created'
);
select is((public.create_category((select id from ha), '  Tier   futter ')).name, 'Tier futter',
  'a new name is trimmed and its spaces collapsed');
select throws_ok(
  $$ insert into public.categories (household_id, name, sort_order) select id, 'BABY', 5 from ha $$,
  '23505', null, 'the table refuses a name that differs only in case'
);
select throws_ok(
  $$ update public.categories set name = 'baby ' where id = pg_temp.seeded((select id from ha), 'chilled') $$,
  '23505', null, 'renaming onto another category''s name in another case is refused'
);
select lives_ok(
  $$ update public.categories set name = 'BABY' where id = (select id from baby) $$,
  'a category may change its own case'
);
select pg_temp.login('00000000-0000-0000-0000-0000000009b1');
select isnt((public.create_category((select id from hb), 'baby')).id, (select id from baby),
  'another household has its own category of that name');
reset role;

-- Merging duplicates that exist from before the unique index: Ada has two more spellings of Baby
-- and an older "SONSTIGES"; Bo has a user "tiefkühl" older than the seeded Tiefkühl.
drop index public.categories_household_name_key;
select set_config('family_groceries.learning', 'off', true);
insert into public.categories (household_id, name, sort_order, created_at) values
  ((select id from ha), 'baby', 200, now() + interval '1 minute'),
  ((select id from ha), ' BABY ', 210, now() + interval '2 minutes'),
  ((select id from ha), 'SONSTIGES', 220, now() - interval '1 year'),
  ((select id from hb), 'tiefkühl', 230, now() - interval '1 year');
create temp table ids as select
  (select id from baby) as keeper,
  pg_temp.cat((select id from ha), 'baby') as loser,
  pg_temp.cat((select id from ha), ' BABY ') as loser2,
  pg_temp.cat((select id from ha), 'SONSTIGES') as old_other,
  pg_temp.seeded((select id from ha), 'other') as other,
  pg_temp.cat((select id from hb), 'tiefkühl') as frozen_keeper,
  pg_temp.seeded((select id from hb), 'frozen') as frozen_loser,
  pg_temp.cat((select id from hb), 'baby') as bo_baby,
  (select sort_order from public.store_category_order
   where store_id = pg_temp.store((select id from ha), 'Lidl') and category_id = (select id from baby)) as lidl_order;

grant select on ids to authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000009a1');
insert into public.items (household_id, name, category_id) values
  ((select id from ha), 'Brei', (select keeper from ids)),
  ((select id from ha), 'Windeln', (select loser from ids)),
  ((select id from ha), 'Feuchttücher', (select loser2 from ids)),
  ((select id from ha), 'Kerzen', (select old_other from ids));
select pg_temp.login('00000000-0000-0000-0000-0000000009b1');
insert into public.items (household_id, name, category_id) values
  ((select id from hb), 'Erbsen', (select frozen_loser from ids));
reset role;
create temp table items_before as select id, household_id, name, quantity, status from public.items;

-- Lidl hides Baby but shows its duplicate; dm has no row for Baby, only for the duplicate.
update public.store_category_order set hidden = true
where store_id = pg_temp.store((select id from ha), 'Lidl') and category_id = (select keeper from ids);
insert into public.store_category_order (household_id, store_id, category_id, sort_order, hidden)
select (select id from ha), pg_temp.store((select id from ha), 'Lidl'), (select loser from ids), 5, false;
delete from public.store_category_order
where store_id = pg_temp.store((select id from ha), 'dm') and category_id = (select keeper from ids);
insert into public.store_category_order (household_id, store_id, category_id, sort_order, hidden)
select (select id from ha), pg_temp.store((select id from ha), 'dm'), (select loser2 from ids), 7, false;

insert into public.category_memory (household_id, item_key, category_id, corrections) values
  ((select id from ha), 'windeln', (select keeper from ids), 1),
  ((select id from ha), 'windeln', (select loser from ids), 2),
  ((select id from ha), 'brei', (select loser2 from ids), 4);

-- Seed keys the duplicates carry from earlier deletions: one key twice, and the fallback's own.
update public.categories set absorbed_seed_keys = '{drinks}' where id in ((select loser from ids), (select loser2 from ids));
update public.categories set absorbed_seed_keys = '{other,sweets}' where id = (select old_other from ids);

select is(public.merge_duplicate_categories(), 4, 'four duplicates are merged');
select is(current_setting('family_groceries.learning', true), 'off',
  'the merge puts the caller''s learning setting back');
select is(
  (select count(*)::int from (
     select 1 from public.categories group by household_id, public.category_name_key(name) having count(*) > 1) d),
  0, 'no household has two categories of one name left'
);
select ok(not exists (select 1 from public.categories where id in ((select loser from ids), (select loser2 from ids))),
  'the newer spellings are gone');
select is((select name from public.categories where id = (select keeper from ids)), 'BABY',
  'the oldest keeps its id and name');
select is(
  (select array_agg(name order by name) from public.items where category_id = (select keeper from ids)),
  array['Brei', 'Feuchttücher', 'Windeln'], 'the duplicates'' items moved to it'
);
select ok(not exists (select 1 from public.categories where id = (select old_other from ids)),
  'an older duplicate of the fallback goes, the fallback stays');
select is((select category_id from public.items where name = 'Kerzen'), (select other from ids),
  'its items moved to the fallback');
select is((select seed_key from public.categories where id = (select other from ids)), 'other',
  'the fallback keeps its seed key');
select results_eq(
  $$ select id, household_id, name, quantity, status from public.items order by id $$,
  $$ select id, household_id, name, quantity, status from items_before order by id $$,
  'every item survived as it was'
);
select is(
  (select array_agg(distinct category_id) from public.item_events
   where household_id = (select id from ha) and item_name in ('Windeln', 'Feuchttücher')),
  array[(select keeper from ids)], 'the history points at the kept category'
);

select is(
  (select hidden from public.store_category_order
   where store_id = pg_temp.store((select id from ha), 'Lidl') and category_id = (select keeper from ids)),
  false, 'a store that showed one of them shows the kept category'
);
select is(
  (select sort_order from public.store_category_order
   where store_id = pg_temp.store((select id from ha), 'Lidl') and category_id = (select keeper from ids)),
  (select lidl_order from ids), 'the kept category keeps its place in the store'
);
select is(
  (select (sort_order, hidden)::text from public.store_category_order
   where store_id = pg_temp.store((select id from ha), 'dm') and category_id = (select keeper from ids)),
  '(7,f)', 'a store that had only the duplicate gets its place for the kept category'
);
select is(
  (select count(*)::int from public.store_category_order
   where store_id = pg_temp.store((select id from ha), 'Lidl')),
  (select count(*)::int from public.categories where household_id = (select id from ha)),
  'every store has one row per category'
);

select is(
  (select corrections from public.category_memory
   where household_id = (select id from ha) and item_key = 'windeln' and category_id = (select keeper from ids)),
  3, 'learned corrections for both add up on the kept category'
);
select is(
  (select corrections from public.category_memory
   where household_id = (select id from ha) and item_key = 'brei' and category_id = (select keeper from ids)),
  4, 'a correction learned only for a duplicate moves to the kept category'
);
select pg_temp.login('00000000-0000-0000-0000-0000000009a1');
select is((public.classify_item_detail((select id from ha), 'Windeln')).category_id, (select keeper from ids),
  'the classifier now picks the kept category');
reset role;

select ok(exists (select 1 from public.categories where id = (select frozen_keeper from ids)),
  'in the other household the older own category is kept');
select ok(not exists (select 1 from public.categories where id = (select frozen_loser from ids)),
  'and the newer seeded one merged into it');
select is((select absorbed_seed_keys from public.categories where id = (select frozen_keeper from ids)), '{frozen}',
  'the kept category takes over the merged seed key');
select is((select absorbed_seed_keys from public.categories where id = (select keeper from ids)), '{drinks}',
  'duplicates without a seed key add no NULL, and a key they share comes once');
select is((select absorbed_seed_keys from public.categories where id = (select other from ids)), '{sweets}',
  'the kept category never absorbs its own seed key');
select ok(
  not exists (select 1 from public.categories
              where household_id in ((select id from ha), (select id from hb))
                and (array_position(absorbed_seed_keys, null) is not null
                     or cardinality(absorbed_seed_keys) <> (select count(distinct k) from unnest(absorbed_seed_keys) k))),
  'no category has a NULL or a repeated absorbed seed key'
);
select is((select category_id from public.items where name = 'Erbsen'), (select frozen_keeper from ids),
  'the other household''s items moved inside it');
select ok(exists (select 1 from public.categories where id = (select bo_baby from ids)),
  'a name that is a duplicate only across households stays');

select is(public.merge_duplicate_categories(), 0, 'a second run merges nothing');
select lives_ok(
  $$ create unique index categories_household_name_key on public.categories (household_id, public.category_name_key(name)) $$,
  'the unique index fits afterwards'
);
select is(public.category_name_key('  Obst   &  GEMÜSE '), 'obst & gemüse', 'the key folds case and spacing');
select is(public.category_name_key(E'\t Baby\n'), 'baby', 'tabs and newlines at the ends go too, as in the app');

select pg_temp.login('00000000-0000-0000-0000-0000000009a1');
select throws_ok($$ select public.merge_duplicate_categories() $$, '42501', null,
  'a signed-in user cannot run the merge');
reset role;
select is(
  (select count(*)::int from public.categories where household_id = (select id from hb)),
  12, 'the other household lost exactly its duplicate'
);
select is(
  (select count(*)::int from public.categories where household_id = (select id from ha)),
  13, 'Ada has the seeds, Baby and Tier futter'
);

select * from finish();
rollback;
