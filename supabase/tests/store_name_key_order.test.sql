-- Job 109: store_name_key and store_name collapse every whitespace run (tabs, newlines) first,
-- then trim, then fold case: the order of category_name_key (Job 90) and the app's key.
begin;
select plan(18);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;

-- The same table is in app/test/list/name_key_test.dart.
create temp table cases (name text, key text);
insert into cases values
  (E'\tLidl\n', 'lidl'),
  (E'\n dm \r\n', 'dm'),
  ('  Rewe   City ', 'rewe city'),
  (E'Rewe\t\tCity', 'rewe city'),
  (E'Rewe \n City', 'rewe city'),
  ('EDEKA', 'edeka'),
  (E'\t\t', '');

select is(public.store_name_key(name), key, format('store_name_key(%s)', to_json(name))) from cases order by name;

select is(
  (select count(*)::int from cases where public.store_name_key(name) is distinct from public.category_name_key(name)), 0,
  'store_name_key and category_name_key agree on every case'
);

select is(public.store_name(E'\tLidl Express\n'), 'Lidl Express', 'a stored name has no tab or newline at its ends');
select is(public.store_name(E' Rewe\t\n City '), 'Rewe City', 'and one space inside');

insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000010902', 'noa@example.com');
select pg_temp.login('00000000-0000-0000-0000-000000010902');
create temp table hn as select id from public.create_household(p_name => 'Noa', p_stores => array['Lidl', 'Edeka']);
grant select on hn to authenticated;

create temp table rewe as select public.add_store((select id from hn), E'\tRewe\n') as id;
grant select on rewe to authenticated;
select is((select name from public.stores where id = (select id from rewe)), 'Rewe', 'add_store stores the name trimmed');
select is(public.add_store((select id from hn), E'\nREWE\t'), (select id from rewe), 'and finds it again in any spacing');
select lives_ok($$ select public.rename_store((select id from rewe), E'\tAldi Süd\n') $$, 'a store is renamed');
select is((select name from public.stores where id = (select id from rewe)), 'Aldi Süd', 'to the trimmed name');
select throws_ok($$ select public.rename_store((select id from rewe), E'\tedeka\n') $$, '23505', 'store_name_taken',
  'a rename onto another store''s name in other spacing is refused');
select throws_ok(
  $$ insert into public.stores (household_id, name, sort_order) select id, E'\tLidl\n', 99 from hn $$,
  '23505', null, 'the table refuses a name that differs only by a tab and a newline'
);
select is((select count(*)::int from public.stores where household_id = (select id from hn)), 3, 'no duplicate was created');

reset role;
select is(
  (select count(*)::int from (
     select 1 from public.stores group by household_id, public.store_name_key(name) having count(*) > 1) d), 0,
  'no household has two stores with one key'
);

select * from finish();
rollback;
