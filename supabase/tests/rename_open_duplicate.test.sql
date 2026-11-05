-- Job 104 (migration 20261105060950_rename_open_duplicate.sql): renaming an open item to another
-- open item's name, brand and details fails with 23505; its own name in any case, a ticked copy,
-- a synonym (the app merges those), another household and unticking stay allowed.
begin;
select plan(14);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000104a01', 'peter104@example.com'),
  ('00000000-0000-0000-0000-000000104b01', 'bob104@example.com');

select pg_temp.login('00000000-0000-0000-0000-000000104b01');
create temp table hb as select id from public.create_household('Bob');
insert into public.items (household_id, name) select id, 'Mineralwasser' from hb;
select pg_temp.login('00000000-0000-0000-0000-000000104a01');
create temp table ha as select id from public.create_household('Trost');
grant select on ha, hb to authenticated;

insert into public.items (id, household_id, name, brand, properties, status) values
  ('10400000-0000-4000-8000-000000000001', (select id from ha), 'Apfelsaft', null, null, 'active'),
  ('10400000-0000-4000-8000-000000000002', (select id from ha), 'Mineralwasser', null, null, 'active'),
  ('10400000-0000-4000-8000-000000000003', (select id from ha), 'Windeln', 'Pampers', 'Größe 3, sensitiv', 'active'),
  ('10400000-0000-4000-8000-000000000004', (select id from ha), 'Windeln', null, null, 'active'),
  ('10400000-0000-4000-8000-000000000005', (select id from ha), 'Karotten', null, null, 'active'),
  ('10400000-0000-4000-8000-000000000006', (select id from ha), 'Brot', null, null, 'bought'),
  ('10400000-0000-4000-8000-000000000007', (select id from ha), 'Milch', null, null, 'active'),
  ('10400000-0000-4000-8000-000000000008', (select id from ha), 'Milch', null, null, 'bought');

select throws_ok(
  $$ update public.items set name = 'Mineralwasser' where id = '10400000-0000-4000-8000-000000000001' $$,
  '23505', 'already_on_list', 'renaming to an open item''s name fails');
select throws_ok(
  $$ update public.items set name = '  MINERALWASSER ' where id = '10400000-0000-4000-8000-000000000001' $$,
  '23505', 'already_on_list', 'in any case and spacing');
select throws_ok(
  $$ update public.items set brand = 'Pampers', properties = 'sensitiv, Größe 3'
     where id = '10400000-0000-4000-8000-000000000004' $$,
  '23505', 'already_on_list', 'with brand and details, in any order');
select is((select count(*)::int from public.items
           where household_id = (select id from ha) and name ilike 'mineralwasser' and status = 'active'), 1,
  'nothing changed: one open Mineralwasser');

select lives_ok(
  $$ update public.items set name = 'apfelsaft' where id = '10400000-0000-4000-8000-000000000001' $$,
  'its own name in another case is fine');
select lives_ok(
  $$ update public.items set name = 'apfelsaft', quantity = '2' where id = '10400000-0000-4000-8000-000000000001' $$,
  'so is saving its own name again with a new quantity');
select lives_ok(
  $$ update public.items set brand = 'Lillydoo' where id = '10400000-0000-4000-8000-000000000004' $$,
  'other details are another item');
select lives_ok(
  $$ update public.items set name = 'Brot' where id = '10400000-0000-4000-8000-000000000001' $$,
  'a ticked copy does not count');
select lives_ok(
  $$ update public.items set name = 'Möhren' where id = '10400000-0000-4000-8000-000000000001' $$,
  'a synonym of an open item is the app''s to merge');
select lives_ok(
  $$ update public.items set status = 'active' where id = '10400000-0000-4000-8000-000000000008' $$,
  'putting a ticked item back while a copy is open stays possible');

select pg_temp.login('00000000-0000-0000-0000-000000104b01');
select lives_ok(
  $$ insert into public.items (household_id, name) select id, 'Saft' from hb;
     update public.items set name = 'Karotten' where household_id = (select id from hb) and name = 'Saft' $$,
  'another household''s items do not count');

select pg_temp.login('00000000-0000-0000-0000-000000104a01');
select is(
  (public.merge_items('10400000-0000-4000-8000-0000000000f1', '10400000-0000-4000-8000-000000000002',
                      '10400000-0000-4000-8000-000000000001') -> 'merged'), 'null'::jsonb,
  'a merge still folds one open item into another');

-- Zusammenführen fills the kept row's missing brand from the other row, which is open with that
-- brand until the merge deletes it: the merge must not trip the guard.
insert into public.items (id, household_id, name, brand, status) values
  ('10400000-0000-4000-8000-000000000011', (select id from ha), 'Butter', null, 'active'),
  ('10400000-0000-4000-8000-000000000012', (select id from ha), 'Butter', 'Kerrygold', 'active');
select is(
  (public.merge_items('10400000-0000-4000-8000-0000000000f2', '10400000-0000-4000-8000-000000000011',
                      '10400000-0000-4000-8000-000000000012') -> 'kept' ->> 'brand'), 'Kerrygold',
  'merging a branded copy into the plain one takes its brand');
select is(
  (public.unmerge_items('10400000-0000-4000-8000-0000000000f2') -> 'merged' ->> 'brand'), 'Kerrygold',
  'and the undo brings the branded copy back');

select * from finish();
rollback;
