-- Job 207: a member's default list per household (household_members.default_list_id). Unset, it is
-- the first list; deleting the chosen list falls back to the first one; another household's list
-- can't be chosen; each membership keeps its own.
begin;
select plan(18);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;

create function pg_temp.name_of(p_list uuid) returns text language sql security definer as $$
  select name from public.lists where id = p_list
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'peter@example.com'),
  ('00000000-0000-0000-0000-0000000000a2', 'lea@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'bob@example.com');

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
create temp table ha as select id from public.create_household('Trost');
create temp table inv as select * from public.create_invite((select id from ha));
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
do $$ begin perform public.join_household((select code from inv)); end $$;
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
create temp table hb as select id from public.create_household(p_request_id => gen_random_uuid(), p_name => 'Bob');
create temp table list_b as select id from public.lists;
-- Peter's second household, not his default.
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
create temp table hc as select id from public.create_household(p_request_id => gen_random_uuid(), p_name => 'Ferienhaus');
grant select on ha, hb, hc, list_b to authenticated;

select is(pg_temp.name_of(public.default_list((select id from ha))), 'Einkaufsliste',
  'unset, the default list is the first list');
create temp table alltag as select * from public.create_list((select id from ha), 'Alltag', 'f0000000-0000-4000-8000-0000000000a1');
create temp table geb as select * from public.create_list((select id from ha), 'Geburtstag', 'f0000000-0000-4000-8000-0000000000a2');
grant select on alltag, geb to authenticated;
select lives_ok($$ select public.move_list((select id from alltag), 0) $$, 'Alltag moves first');
select is(pg_temp.name_of(public.default_list((select id from ha))), 'Alltag',
  'unset, it follows the first list by position');

select lives_ok($$ select public.set_default_list((select id from geb)) $$, 'Peter picks Geburtstag');
select is(pg_temp.name_of(public.default_list((select id from ha))), 'Geburtstag', 'and it is his default list');
select lives_ok($$ select public.set_default_list((select id from geb)) $$, 'picking it again changes nothing');
select is(
  (select e ->> 'default_list' from jsonb_array_elements(public.export_my_data() -> 'households') e
   where e ->> 'name' = 'Trost'),
  'Geburtstag', 'his export names the chosen list');

select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select is(pg_temp.name_of(public.default_list((select id from ha))), 'Alltag',
  'Lea''s default list is her own: still the first list');

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select is(pg_temp.name_of(public.default_list((select id from hc))), 'Einkaufsliste',
  'his other household keeps its own (unset) default list');
select throws_ok($$ select public.set_default_list((select id from list_b)) $$, '42501', 'not_a_member',
  'another household''s list cannot be the default');
select throws_ok($$ select public.set_default_list(gen_random_uuid()) $$, 'P0002', 'list_not_found',
  'nor a list that does not exist');
select is(public.default_list((select id from hb)), null, 'no default list is answered for another household');
select throws_ok(
  $$ update public.household_members set default_list_id = (select id from list_b) where household_id = (select id from ha) $$,
  '42501', null, 'the column is written through set_default_list only');

select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select lives_ok($$ select public.set_default_list((select id from geb)) $$, 'Lea picks Geburtstag too');
select lives_ok($$ select public.delete_list((select id from geb)) $$, 'and deletes it');
select is(pg_temp.name_of(public.default_list((select id from ha))), 'Alltag',
  'a deleted default list falls back to the first list');
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select is(pg_temp.name_of(public.default_list((select id from ha))), 'Alltag', 'for Peter as well');
select is(
  (select count(*)::int from public.add_list_item((select id from ha), public.default_list((select id from ha)), 'Milch')),
  1, 'and the next add to the default list works');

select * from finish();
rollback;
