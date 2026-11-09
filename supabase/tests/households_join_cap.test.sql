-- Job 173: the 10-household cap on every way in (vmaint-20261109 gap 2). Zehn is in 10
-- households, Neun in 9. Each path refuses Zehn with too_many_households and lets Neun in: the
-- new join, a join request, an approval, a restore and a plain insert. Old builds' joins move a
-- user out of their default household first, so they still work at 10.
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
\set zehn '''00000000-0000-0000-0000-000000173a10'''
\set neun '''00000000-0000-0000-0000-000000173a09'''
\set fritz '''00000000-0000-0000-0000-000000173a02'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:olga, 'olga173@example.com', '{"display_name": "Olga"}'),
  (:zehn, 'zehn173@example.com', '{"display_name": "Zehn"}'),
  (:neun, 'neun173@example.com', '{"display_name": "Neun"}'),
  (:fritz, 'fritz173@example.com', '{"display_name": "Fritz"}');

select pg_temp.login(:olga);
select public.create_household(p_request_id => gen_random_uuid(), p_name => 'Offen', p_kind => 'family');
select public.create_household(p_request_id => gen_random_uuid(), p_name => 'Verein', p_kind => 'club');
select public.create_household(p_request_id => gen_random_uuid(), p_name => 'Alt', p_kind => 'family');
create temp table code as select
  (select code from public.create_invite(pg_temp.hid('Offen'), 'group')) as offen,
  (select code from public.create_invite(pg_temp.hid('Verein'), 'group')) as verein;
grant select on code to authenticated;

-- Zehn's 10 and Neun's 9 households, owned by Fritz so leaving one keeps it.
select pg_temp.as_postgres();
insert into public.households (id, name, created_by)
select ('00000000-0000-0000-0000-000000173' || lpad(i::text, 3, '0'))::uuid, 'Fuell ' || i, :fritz
from generate_series(1, 10) i;
insert into public.household_members (household_id, user_id, role)
select ('00000000-0000-0000-0000-000000173' || lpad(i::text, 3, '0'))::uuid, :fritz, 'owner'
from generate_series(1, 10) i;
insert into public.household_members (household_id, user_id)
select ('00000000-0000-0000-0000-000000173' || lpad(i::text, 3, '0'))::uuid, :zehn
from generate_series(1, 10) i;
insert into public.household_members (household_id, user_id)
select ('00000000-0000-0000-0000-000000173' || lpad(i::text, 3, '0'))::uuid, :neun
from generate_series(1, 9) i;
select is(pg_temp.count_of(:zehn), 10, 'Zehn is in 10 households');
select is(pg_temp.count_of(:neun), 9, 'Neun is in 9');

-- The new app's join ---------------------------------------------------------------------------

select pg_temp.login(:zehn);
select throws_ok($$ select public.accept_invite((select offen from code), p_mode => 'add') $$,
  'P0001', 'too_many_households', 'accept_invite add at 10 is refused');
select is(pg_temp.is_member(:zehn, 'Offen'), false, 'and Zehn is not in it');
select is(pg_temp.uses('Offen'), 0, 'nor is a use counted');
select pg_temp.login(:neun);
select is(public.accept_invite((select offen from code), p_mode => 'add') ->> 'status', 'joined',
  'accept_invite add at 9 joins');
select is(pg_temp.count_of(:neun), 10, 'Neun is in 10 now');
select throws_ok($$ select public.create_household(p_request_id => gen_random_uuid(), p_name => 'Elfte') $$,
  'P0001', 'too_many_households', 'and creating an eleventh is refused as before');
select pg_temp.as_postgres();
delete from public.household_members where user_id = :neun and household_id = pg_temp.hid('Offen');

-- Old builds' joins move out of the default household -----------------------------------------

select pg_temp.login(:zehn);
select is(public.accept_invite((select offen from code)) ->> 'status', 'joined',
  'the old one-argument accept_invite at 10 still joins');
select is(pg_temp.count_of(:zehn), 10, 'by leaving the default: still 10');
select is(pg_temp.is_member(:zehn, 'Offen'), true, 'and Zehn is in Offen');
select pg_temp.as_postgres();
delete from public.household_members where user_id = :zehn and household_id = pg_temp.hid('Offen');
insert into public.household_members (household_id, user_id)
values ('00000000-0000-0000-0000-000000173001', :zehn);
update public.household_members set is_default = (household_id = '00000000-0000-0000-0000-000000173001')
where user_id = :zehn;
select pg_temp.login(:zehn);
select is(public.accept_invite((select offen from code), false) ->> 'status', 'joined',
  'so does the old one with p_archive');
select is(pg_temp.count_of(:zehn), 10, 'still 10');
select pg_temp.as_postgres();
delete from public.household_members where user_id = :zehn and household_id = pg_temp.hid('Offen');
insert into public.household_members (household_id, user_id)
values ('00000000-0000-0000-0000-000000173001', :zehn);
update public.household_members set is_default = (household_id = '00000000-0000-0000-0000-000000173001')
where user_id = :zehn;
select pg_temp.login(:zehn);
select is(public.join_household((select offen from code)), pg_temp.hid('Offen'),
  'and the oldest join_household answers the household');
select is(pg_temp.count_of(:zehn), 10, 'still 10');
select pg_temp.as_postgres();
delete from public.household_members where user_id = :zehn and household_id = pg_temp.hid('Offen');
insert into public.household_members (household_id, user_id)
values ('00000000-0000-0000-0000-000000173001', :zehn);
update public.household_members set is_default = (household_id = '00000000-0000-0000-0000-000000173001')
where user_id = :zehn;

-- Join requests and approvals ------------------------------------------------------------------

select pg_temp.login(:zehn);
select throws_ok($$ select public.accept_invite((select verein from code), p_mode => 'add') $$,
  'P0001', 'too_many_households', 'a join request at 10 is refused');
select is(pg_temp.requests(:zehn), 0, 'and none is filed');
select throws_ok($$ select public.accept_invite((select verein from code)) $$,
  'P0001', 'too_many_households',
  'the old one-argument accept_invite into a household with approval at 10 is refused too');
select is(public.join_household((select verein from code)), null,
  'the oldest join_household answers null, as for a filed request');
select is(pg_temp.requests(:zehn), 0, 'and still none is filed');
select is(pg_temp.count_of(:zehn), 10, 'Zehn stays at 10');
select pg_temp.login(:neun);
select is(public.accept_invite((select verein from code), p_mode => 'add') ->> 'status', 'requested',
  'a join request at 9 is filed');
select pg_temp.login(:olga);
select is(public.decide_join_request(
    (select id from public.join_requests where user_id = :neun and decision is null), true) ->> 'status',
  'approved', 'and approved: Neun joins');
select is(pg_temp.count_of(:neun), 10, 'Neun is in 10');
select pg_temp.as_postgres();
delete from public.household_members where user_id = :neun and household_id = pg_temp.hid('Verein');

-- Neun asks at 9, then joins a 10th before Olga decides.
select pg_temp.login(:neun);
select is(public.accept_invite((select verein from code), p_mode => 'add') ->> 'status', 'requested',
  'Neun asks again at 9');
select is(public.accept_invite((select offen from code), p_mode => 'add') ->> 'status', 'joined',
  'and joins Offen meanwhile');
select pg_temp.login(:olga);
select is(public.decide_join_request(
    (select id from public.join_requests where user_id = :neun and decision is null), true) ->> 'status',
  'cancelled', 'an approval for a requester now at 10 closes the request');
select is(pg_temp.is_member(:neun, 'Verein'), false, 'without a membership');
select is(pg_temp.count_of(:neun), 10, 'Neun stays at 10');
select is(pg_temp.uses('Verein'), 1, 'nor a counted use');
select is(pg_temp.requests(:neun), 0, 'and nothing waits in the admins'' list');
select pg_temp.as_postgres();
delete from public.household_members where user_id = :neun and household_id = pg_temp.hid('Offen');

-- Restoring an archived household --------------------------------------------------------------

update public.households set archived_at = now(), archived_by = :zehn where name = 'Alt';
delete from public.household_members where household_id = pg_temp.hid('Alt');
select pg_temp.login(:zehn);
select throws_ok($$ select public.unarchive_household(pg_temp.hid('Alt'), false, 'add') $$,
  'P0001', 'too_many_households', 'restoring an eleventh at 10 is refused');
select pg_temp.as_postgres();
select is((select archived_at is not null from public.households where name = 'Alt'), true,
  'and it stays archived');
update public.households set archived_by = :neun where name = 'Alt';
select pg_temp.login(:neun);
select is(public.unarchive_household(pg_temp.hid('Alt'), false, 'add') ->> 'status', 'unarchived',
  'restoring at 9 works');

-- The old builds' restore moves out of the default household, so it still works at 10.
select pg_temp.as_postgres();
delete from public.household_members where user_id = :neun and household_id = pg_temp.hid('Alt');
update public.households set archived_at = now(), archived_by = :zehn where name = 'Alt';
select pg_temp.login(:zehn);
select is(public.unarchive_household(pg_temp.hid('Alt'), false) ->> 'status', 'unarchived',
  'the old restore at 10 still works');
select is(pg_temp.count_of(:zehn), 10, 'by leaving the default: still 10');
select is(pg_temp.is_member(:zehn, 'Alt'), true, 'and Zehn is in Alt');

-- Any other insert -----------------------------------------------------------------------------

select pg_temp.as_postgres();
select throws_ok(
  $$ insert into public.household_members (household_id, user_id) values (pg_temp.hid('Verein'), '00000000-0000-0000-0000-000000173a10') $$,
  'P0001', 'too_many_households', 'a direct insert of an eleventh membership is refused');

select * from finish();
rollback;
