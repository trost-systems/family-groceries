-- Job 173: the household cap on every way in (vmaint-20261109 gap 2), 20 since job 200. Zwanzig
-- is in 20 households, Neunzehn in 19. Each path refuses Zwanzig with too_many_households and lets
-- Neunzehn in: the new join, a join request, an approval, a restore and a plain insert. Old builds'
-- joins move a user out of their default household first, so they still work at 20.
begin;
select plan(38);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;

create function pg_temp.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

create function pg_temp.hid(p_name text) returns uuid language sql security definer as $$
  select id from public.households where name = p_name
$$;

create function pg_temp.count_of(p_user uuid) returns integer language sql security definer as $$
  select count(*)::int from public.household_members where user_id = p_user
$$;

create function pg_temp.is_member(p_user uuid, p_household text) returns boolean
language sql security definer as $$
  select exists (select from public.household_members where user_id = p_user and household_id = pg_temp.hid(p_household))
$$;

create function pg_temp.uses(p_household text) returns integer language sql security definer as $$
  select coalesce(sum(use_count), 0)::int from public.invites where household_id = pg_temp.hid(p_household)
$$;

create function pg_temp.requests(p_user uuid) returns integer language sql security definer as $$
  select count(*)::int from public.join_requests where user_id = p_user and decision is null
$$;

grant execute on all functions in schema pg_temp to authenticated;

\set olga '''00000000-0000-0000-0000-000000173a01'''
\set zwanzig '''00000000-0000-0000-0000-000000173a10'''
\set neunzehn '''00000000-0000-0000-0000-000000173a09'''
\set fritz '''00000000-0000-0000-0000-000000173a02'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:olga, 'olga173@example.com', '{"display_name": "Olga"}'),
  (:zwanzig, 'zwanzig173@example.com', '{"display_name": "Zwanzig"}'),
  (:neunzehn, 'neunzehn173@example.com', '{"display_name": "Neunzehn"}'),
  (:fritz, 'fritz173@example.com', '{"display_name": "Fritz"}');

select pg_temp.login(:olga);
select public.create_household(p_request_id => gen_random_uuid(), p_name => 'Offen', p_kind => 'family');
select public.create_household(p_request_id => gen_random_uuid(), p_name => 'Verein', p_kind => 'club');
select public.create_household(p_request_id => gen_random_uuid(), p_name => 'Alt', p_kind => 'family');
create temp table code as select
  (select code from public.create_invite(pg_temp.hid('Offen'), 'group')) as offen,
  (select code from public.create_invite(pg_temp.hid('Verein'), 'group')) as verein;
grant select on code to authenticated;

-- Zwanzig's 20 and Neunzehn's 19 households, owned by Fritz so leaving one keeps it.
select pg_temp.as_postgres();
insert into public.households (id, name, created_by)
select ('00000000-0000-0000-0000-000000173' || lpad(i::text, 3, '0'))::uuid, 'Fuell ' || i, :fritz
from generate_series(1, 20) i;
insert into public.household_members (household_id, user_id, role)
select ('00000000-0000-0000-0000-000000173' || lpad(i::text, 3, '0'))::uuid, :fritz, 'owner'
from generate_series(1, 20) i;
insert into public.household_members (household_id, user_id)
select ('00000000-0000-0000-0000-000000173' || lpad(i::text, 3, '0'))::uuid, :zwanzig
from generate_series(1, 20) i;
insert into public.household_members (household_id, user_id)
select ('00000000-0000-0000-0000-000000173' || lpad(i::text, 3, '0'))::uuid, :neunzehn
from generate_series(1, 19) i;
select is(pg_temp.count_of(:zwanzig), 20, 'Zwanzig is in 20 households');
select is(pg_temp.count_of(:neunzehn), 19, 'Neunzehn is in 19');

-- The new app's join ---------------------------------------------------------------------------

select pg_temp.login(:zwanzig);
select throws_ok($$ select public.accept_invite((select offen from code), p_mode => 'add') $$,
  'P0001', 'too_many_households', 'accept_invite add at 20 is refused');
select is(pg_temp.is_member(:zwanzig, 'Offen'), false, 'and Zwanzig is not in it');
select is(pg_temp.uses('Offen'), 0, 'nor is a use counted');
select pg_temp.login(:neunzehn);
select is(public.accept_invite((select offen from code), p_mode => 'add') ->> 'status', 'joined',
  'accept_invite add at 19 joins');
select is(pg_temp.count_of(:neunzehn), 20, 'Neunzehn is in 20 now');
select throws_ok($$ select public.create_household(p_request_id => gen_random_uuid(), p_name => 'Elfte') $$,
  'P0001', 'too_many_households', 'and creating a 21st is refused as before');
select pg_temp.as_postgres();
delete from public.household_members where user_id = :neunzehn and household_id = pg_temp.hid('Offen');

-- Old builds' joins move out of the default household -----------------------------------------

select pg_temp.login(:zwanzig);
select is(public.accept_invite((select offen from code)) ->> 'status', 'joined',
  'the old one-argument accept_invite at 20 still joins');
select is(pg_temp.count_of(:zwanzig), 20, 'by leaving the default: still 20');
select is(pg_temp.is_member(:zwanzig, 'Offen'), true, 'and Zwanzig is in Offen');
select pg_temp.as_postgres();
delete from public.household_members where user_id = :zwanzig and household_id = pg_temp.hid('Offen');
insert into public.household_members (household_id, user_id)
values ('00000000-0000-0000-0000-000000173001', :zwanzig);
-- Two steps: the one-default index is checked row by row, in whatever order the rows are stored.
update public.household_members set is_default = false
where user_id = :zwanzig and household_id <> '00000000-0000-0000-0000-000000173001';
update public.household_members set is_default = true
where user_id = :zwanzig and household_id = '00000000-0000-0000-0000-000000173001';
select pg_temp.login(:zwanzig);
select is(public.accept_invite((select offen from code), false) ->> 'status', 'joined',
  'so does the old one with p_archive');
select is(pg_temp.count_of(:zwanzig), 20, 'still 20');
select pg_temp.as_postgres();
delete from public.household_members where user_id = :zwanzig and household_id = pg_temp.hid('Offen');
insert into public.household_members (household_id, user_id)
values ('00000000-0000-0000-0000-000000173001', :zwanzig);
-- Two steps: the one-default index is checked row by row, in whatever order the rows are stored.
update public.household_members set is_default = false
where user_id = :zwanzig and household_id <> '00000000-0000-0000-0000-000000173001';
update public.household_members set is_default = true
where user_id = :zwanzig and household_id = '00000000-0000-0000-0000-000000173001';
select pg_temp.login(:zwanzig);
select is(public.join_household((select offen from code)), pg_temp.hid('Offen'),
  'and the oldest join_household answers the household');
select is(pg_temp.count_of(:zwanzig), 20, 'still 20');
select pg_temp.as_postgres();
delete from public.household_members where user_id = :zwanzig and household_id = pg_temp.hid('Offen');
insert into public.household_members (household_id, user_id)
values ('00000000-0000-0000-0000-000000173001', :zwanzig);
-- Two steps: the one-default index is checked row by row, in whatever order the rows are stored.
update public.household_members set is_default = false
where user_id = :zwanzig and household_id <> '00000000-0000-0000-0000-000000173001';
update public.household_members set is_default = true
where user_id = :zwanzig and household_id = '00000000-0000-0000-0000-000000173001';

-- Join requests and approvals ------------------------------------------------------------------

select pg_temp.login(:zwanzig);
select throws_ok($$ select public.accept_invite((select verein from code), p_mode => 'add') $$,
  'P0001', 'too_many_households', 'a join request at 20 is refused');
select is(pg_temp.requests(:zwanzig), 0, 'and none is filed');
select throws_ok($$ select public.accept_invite((select verein from code)) $$,
  'P0001', 'too_many_households',
  'the old one-argument accept_invite into a household with approval at 20 is refused too');
select is(public.join_household((select verein from code)), null,
  'the oldest join_household answers null, as for a filed request');
select is(pg_temp.requests(:zwanzig), 0, 'and still none is filed');
select is(pg_temp.count_of(:zwanzig), 20, 'Zwanzig stays at 20');
select pg_temp.login(:neunzehn);
select is(public.accept_invite((select verein from code), p_mode => 'add') ->> 'status', 'requested',
  'a join request at 19 is filed');
select pg_temp.login(:olga);
select is(public.decide_join_request(
    (select id from public.join_requests where user_id = :neunzehn and decision is null), true) ->> 'status',
  'approved', 'and approved: Neunzehn joins');
select is(pg_temp.count_of(:neunzehn), 20, 'Neunzehn is in 20');
select pg_temp.as_postgres();
delete from public.household_members where user_id = :neunzehn and household_id = pg_temp.hid('Verein');

-- Neunzehn asks at 19, then joins a 10th before Olga decides.
select pg_temp.login(:neunzehn);
select is(public.accept_invite((select verein from code), p_mode => 'add') ->> 'status', 'requested',
  'Neunzehn asks again at 19');
select is(public.accept_invite((select offen from code), p_mode => 'add') ->> 'status', 'joined',
  'and joins Offen meanwhile');
select pg_temp.login(:olga);
select is(public.decide_join_request(
    (select id from public.join_requests where user_id = :neunzehn and decision is null), true) ->> 'status',
  'cancelled', 'an approval for a requester now at 20 closes the request');
select is(pg_temp.is_member(:neunzehn, 'Verein'), false, 'without a membership');
select is(pg_temp.count_of(:neunzehn), 20, 'Neunzehn stays at 20');
select is(pg_temp.uses('Verein'), 1, 'nor a counted use');
select is(pg_temp.requests(:neunzehn), 0, 'and nothing waits in the admins'' list');
select pg_temp.as_postgres();
delete from public.household_members where user_id = :neunzehn and household_id = pg_temp.hid('Offen');

-- Restoring an archived household --------------------------------------------------------------

update public.households set archived_at = now(), archived_by = :zwanzig where name = 'Alt';
delete from public.household_members where household_id = pg_temp.hid('Alt');
select pg_temp.login(:zwanzig);
select throws_ok($$ select public.unarchive_household(pg_temp.hid('Alt'), false, 'add') $$,
  'P0001', 'too_many_households', 'restoring a 21st at 20 is refused');
select pg_temp.as_postgres();
select is((select archived_at is not null from public.households where name = 'Alt'), true,
  'and it stays archived');
update public.households set archived_by = :neunzehn where name = 'Alt';
select pg_temp.login(:neunzehn);
select is(public.unarchive_household(pg_temp.hid('Alt'), false, 'add') ->> 'status', 'unarchived',
  'restoring at 19 works');

-- The old builds' restore moves out of the default household, so it still works at 20.
select pg_temp.as_postgres();
delete from public.household_members where user_id = :neunzehn and household_id = pg_temp.hid('Alt');
update public.households set archived_at = now(), archived_by = :zwanzig where name = 'Alt';
select pg_temp.login(:zwanzig);
select is(public.unarchive_household(pg_temp.hid('Alt'), false) ->> 'status', 'unarchived',
  'the old restore at 20 still works');
select is(pg_temp.count_of(:zwanzig), 20, 'by leaving the default: still 20');
select is(pg_temp.is_member(:zwanzig, 'Alt'), true, 'and Zwanzig is in Alt');

-- Any other insert -----------------------------------------------------------------------------

select pg_temp.as_postgres();
select throws_ok(
  $$ insert into public.household_members (household_id, user_id) values (pg_temp.hid('Verein'), '00000000-0000-0000-0000-000000173a10') $$,
  'P0001', 'too_many_households', 'a direct insert of a 21st membership is refused');

select * from finish();
rollback;
