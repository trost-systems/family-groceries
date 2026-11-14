-- Job 229: each user orders their own households (reorder_households); my_households answers in
-- that order, never-ordered memberships after the ordered ones, oldest first.
begin;
select plan(11);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;

-- The caller's households by name, in my_households' order.
create function pg_temp.mine() returns text[] language sql as $$
  select array_agg(name) from (select name from public.my_households()) h
$$;

create function pg_temp.hid(p_name text) returns uuid language sql security definer as $$
  select id from public.households where name = p_name
$$;

create function pg_temp.positions(p_user uuid) returns text language sql security definer as $$
  select string_agg(h.name || '=' || coalesce(m.position::text, 'null'), ', ' order by h.name)
  from public.household_members m join public.households h on h.id = m.household_id
  where m.user_id = p_user
$$;

-- Membership times one day apart, in the order given.
create function pg_temp.age(p_user uuid, variadic p_households text[]) returns void
language plpgsql security definer as $$
begin
  for i in 1 .. array_length(p_households, 1) loop
    update public.household_members set joined_at = now() - make_interval(days => 10 - i)
    where user_id = p_user and household_id = pg_temp.hid(p_households[i]);
  end loop;
end $$;

grant execute on all functions in schema pg_temp to authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'peter@example.com'),
  ('00000000-0000-0000-0000-0000000000a2', 'lea@example.com');

do $$ begin perform pg_temp.login('00000000-0000-0000-0000-0000000000a1'); end $$;
do $$ begin perform public.create_household(p_request_id => gen_random_uuid(), p_name => 'Zuhause'); end $$;
do $$ begin perform public.create_household(p_request_id => gen_random_uuid(), p_name => 'Ferienhaus'); end $$;
do $$ begin perform public.create_household(p_request_id => gen_random_uuid(), p_name => 'Verein'); end $$;
create temp table inv as select * from public.create_invite(pg_temp.hid('Zuhause'));
grant select on inv to authenticated;
do $$ begin perform pg_temp.login('00000000-0000-0000-0000-0000000000a2'); end $$;
do $$ begin perform public.create_household(p_request_id => gen_random_uuid(), p_name => 'Lea'); end $$;
do $$ begin perform public.accept_invite((select code from inv), p_mode => 'add'); end $$;
reset role;
do $$ begin perform pg_temp.age('00000000-0000-0000-0000-0000000000a1', 'Zuhause', 'Ferienhaus', 'Verein'); end $$;
do $$ begin perform pg_temp.age('00000000-0000-0000-0000-0000000000a2', 'Lea', 'Zuhause'); end $$;

do $$ begin perform pg_temp.login('00000000-0000-0000-0000-0000000000a1'); end $$;
select is(pg_temp.mine(), array['Zuhause', 'Ferienhaus', 'Verein'], 'never ordered: oldest membership first');

select lives_ok(
  $$ select public.reorder_households(array[pg_temp.hid('Verein'), pg_temp.hid('Zuhause'), pg_temp.hid('Ferienhaus')]) $$,
  'Peter puts Verein first');
select is(pg_temp.mine(), array['Verein', 'Zuhause', 'Ferienhaus'], 'my_households answers in his order');

do $$ begin perform pg_temp.login('00000000-0000-0000-0000-0000000000a2'); end $$;
select is(pg_temp.mine(), array['Lea', 'Zuhause'], 'Lea''s order is her own');
reset role;
select is(pg_temp.positions('00000000-0000-0000-0000-0000000000a2'), 'Lea=null, Zuhause=null',
  'Peter''s reorder wrote none of Lea''s memberships, not even in the household they share');

do $$ begin perform pg_temp.login('00000000-0000-0000-0000-0000000000a1'); end $$;
select lives_ok(
  $$ select public.reorder_households(array[gen_random_uuid(), pg_temp.hid('Lea'), pg_temp.hid('Ferienhaus'),
       pg_temp.hid('Verein'), pg_temp.hid('Zuhause')]) $$,
  'ids he is not a member of are skipped');
select is(pg_temp.mine(), array['Ferienhaus', 'Verein', 'Zuhause'], 'his own ones take the order given');
reset role;
select is(pg_temp.positions('00000000-0000-0000-0000-0000000000a2'), 'Lea=null, Zuhause=null',
  'Lea''s household he named stays untouched');

do $$ begin perform pg_temp.login('00000000-0000-0000-0000-0000000000a1'); end $$;
do $$ begin perform public.create_household(p_request_id => gen_random_uuid(), p_name => 'Neu'); end $$;
select is(pg_temp.mine(), array['Ferienhaus', 'Verein', 'Zuhause', 'Neu'], 'a household added later comes last');

select throws_ok(
  $$ update public.household_members set position = 0 where household_id = pg_temp.hid('Zuhause') $$,
  '42501', null, 'the column is written through reorder_households only');

set local role anon;
select throws_ok($$ select public.reorder_households(array[gen_random_uuid()]) $$, '42501', null,
  'anon may not call it');

select * from finish();
rollback;
