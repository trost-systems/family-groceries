-- Job 109: delete_category hands the target only real seed keys, each once, never the target's
-- own; categories never hold a NULL absorbed seed key.
begin;
select plan(10);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000010901', 'kim@example.com');
select pg_temp.login('00000000-0000-0000-0000-000000010901');
create temp table hk as select id from public.create_household(p_name => 'Kim');
grant select on hk to authenticated;

create function pg_temp.cat(p_name text) returns uuid language sql as $$
  select id from public.categories where household_id = (select id from hk) and (name = p_name or seed_key = p_name);
$$;

create function pg_temp.absorbed(p_name text) returns text[] language sql as $$
  select absorbed_seed_keys from public.categories where id = pg_temp.cat(p_name);
$$;

select public.create_category((select id from hk), 'Bio');
select public.delete_category(pg_temp.cat('Bio'));
select is(pg_temp.absorbed('other'), '{}', 'deleting a category without a seed key hands over no key');

select public.create_category((select id from hk), 'Baby');
select public.delete_category(pg_temp.cat('drugstore'), pg_temp.cat('Baby'));
select is(pg_temp.absorbed('Baby'), '{drugstore}', 'a seeded category hands its key to the target');
select public.delete_category(pg_temp.cat('Baby'));
select is(pg_temp.absorbed('other'), '{drugstore}', 'a seedless one hands on only the keys it absorbed');
select is(public.classify_item((select id from hk), 'Duschgel'), pg_temp.cat('other'),
  'the absorbed key still classifies');

select public.create_category((select id from hk), 'Pflege');
update public.categories set absorbed_seed_keys = '{drugstore,other}' where id = pg_temp.cat('Pflege');
select public.delete_category(pg_temp.cat('Pflege'));
select is(pg_temp.absorbed('other'), '{drugstore}', 'a key the target has already, or its own, is not added');

select public.delete_category(pg_temp.cat('drinks'), pg_temp.cat('sweets'));
select public.delete_category(pg_temp.cat('sweets'), pg_temp.cat('frozen'));
select is(pg_temp.absorbed('frozen'), '{drinks,sweets}', 'keys pass along a chain of deletes, sorted');

-- The table refuses a NULL key from any writer; the migration cleaned what the old function left.
reset role;
select throws_ok(
  $$ update public.categories set absorbed_seed_keys = '{drinks,NULL}' where id = pg_temp.cat('frozen') $$,
  '23514', null, 'the table refuses a NULL absorbed seed key'
);
select is(
  (select count(*)::int from public.categories where array_position(absorbed_seed_keys, null) is not null), 0,
  'no category holds a NULL absorbed seed key'
);
select ok(
  (select convalidated from pg_constraint where conname = 'categories_absorbed_seed_keys_not_null'),
  'the check is validated, not just added'
);
select is(
  (select array[p.prosecdef::text, array_to_string(p.proconfig, ',')] from pg_proc p
   where p.oid = 'public.delete_category(uuid, uuid)'::regprocedure),
  array['false', 'search_path=""'],
  'delete_category still runs with the caller''s rights and an empty search_path'
);

select * from finish();
rollback;
