-- Job 64b: put_item, the app's add. An add the duplicate check skips (an undone delete, an add
-- replayed after a partner added the same item) answers with the open item that is there, unchanged;
-- a retry answers with its own row; the store memory and "no store" work as before.
begin;
select plan(17);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'peter@example.com'),
  ('00000000-0000-0000-0000-0000000000a2', 'lea@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'bob@example.com');

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
create temp table ha as select id from public.create_household('Trost');
create temp table inv as select * from public.create_invite((select id from ha));
create temp table st as select public.add_store((select id from ha), 'Drogerie') as id;
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
do $$ begin perform public.join_household((select code from inv)); end $$;
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
create temp table hb as select id from public.create_household('Bob');
grant select on ha, hb, st to authenticated;

-- Peter deletes his "2 Milch" from the Drogerie; Lea adds Milch; Peter's undo puts his row back.
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select ok((select id = '10000000-0000-4000-8000-000000000001' from public.put_item(
  '10000000-0000-4000-8000-000000000001', (select id from ha), 'Milch', '2', p_store => (select id from st)
)), 'a new add lands and answers with its own row');
delete from public.items where id = '10000000-0000-4000-8000-000000000001';
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
insert into public.items (id, household_id, name, quantity)
  select '10000000-0000-4000-8000-000000000002', id, 'Milch', '1 l' from ha;
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
create temp table undo as select * from public.put_item(
  '10000000-0000-4000-8000-000000000001', (select id from ha), 'Milch', '2',
  p_store => (select id from st), p_sort_key => 2048
);
select is((select count(*)::int from undo), 1, 'the undo answers with one row, not none');
select is((select id from undo), '10000000-0000-4000-8000-000000000002'::uuid, 'Lea''s open Milch');
select is((select quantity from undo), '1 l', 'the open item keeps its quantity');
select is((select store_id from undo), null, 'and its store');
select is(
  (select count(*)::int from public.items where household_id = (select id from ha) and normalized_name = 'milch'),
  1, 'one Milch on the list'
);

-- A replayed offline add with its details in another order is the same item.
insert into public.items (id, household_id, name, brand, properties)
  select '10000000-0000-4000-8000-000000000003', id, 'Windeln', 'Pampers', 'Größe 3, sensitiv' from ha;
select is((select id from public.put_item(
  '10000000-0000-4000-8000-000000000004', (select id from ha), 'windeln', p_brand => 'pampers',
  p_properties => 'Sensitiv,Größe 3'
)), '10000000-0000-4000-8000-000000000003'::uuid, 'details in any order answer with the open Windeln');
select is((select count(*)::int from public.put_item(
  '10000000-0000-4000-8000-000000000005', (select id from ha), 'Windeln', p_brand => 'Pampers',
  p_properties => 'Größe 4'
)), 1, 'another size lands');
select is((select count(*)::int from public.items where name = 'Windeln' and status = 'active'), 2,
  'next to the first one');

-- A retry after a lost answer gets its own row, also when a duplicate from before job 64 is open.
insert into public.items (id, household_id, name) select '10000000-0000-4000-8000-000000000006', id, 'Brot' from ha;
select ok((select id is not null from public.put_item('10000000-0000-4000-8000-000000000007', (select id from ha), 'Brötchen')),
  'Brötchen lands');
-- Such a duplicate can no longer be made by a rename either (job 104), so the guard is off for it.
select set_config('role', 'postgres', true);
alter table public.items disable trigger items_rename_duplicate;
update public.items set name = 'Brot' where id = '10000000-0000-4000-8000-000000000007';
alter table public.items enable trigger items_rename_duplicate;
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select is((select id from public.put_item(
  '10000000-0000-4000-8000-000000000007', (select id from ha), 'Brot'
)), '10000000-0000-4000-8000-000000000007'::uuid, 'a retry answers with its own row');
select is((select count(*)::int from public.items where name = 'Brot'), 2, 'and adds nothing');

-- A ticked copy does not hold up a new one.
update public.items set status = 'bought' where id = '10000000-0000-4000-8000-000000000002';
select is((select id from public.put_item(
  '10000000-0000-4000-8000-000000000008', (select id from ha), 'Milch'
)), '10000000-0000-4000-8000-000000000008'::uuid, 'a ticked Milch does not block a new one');

-- The store: the remembered one when none is given, none with p_no_store.
select is((select store_id from public.put_item(
  '10000000-0000-4000-8000-000000000009', (select id from ha), 'Shampoo', p_store => (select id from st)
)), (select id from st), 'an add with a store keeps it');
update public.items set status = 'bought' where id = '10000000-0000-4000-8000-000000000009';
select is((select store_id from public.put_item(
  '10000000-0000-4000-8000-00000000000a', (select id from ha), 'Shampoo', p_no_store => true
)), null, 'no store: the store stays empty');

-- Bob cannot add to the Trosts' list, nor learn what is on it.
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select throws_ok(
  $$ select public.put_item('10000000-0000-4000-8000-0000000000b1', (select id from ha), 'Windeln',
       p_brand => 'Pampers', p_properties => 'Größe 3, sensitiv') $$,
  '42501', null, 'put_item into another household is denied'
);
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.add_item((select id from ha), 'Pampers Windeln sensitiv, Größe 3')), 1,
  'add_item still answers with the open row');

select * from finish();
rollback;
