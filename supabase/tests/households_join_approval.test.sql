-- Job 169b wave 3, part M: join approval (docs/households/W3.md). With approval on, every
-- accept_invite signature files a request and answers 'requested'; the owner and admins approve
-- (membership, invite_uses, the counted use) or decline; the requester cancels. Two approvals
-- racing for a group link's last use are in supabase/functions/_shared/households_integration_test.ts.
begin;
select plan(75);

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

create function pg_temp.is_member(p_user uuid, p_household text) returns boolean
language sql security definer as $$
  select exists (select from public.household_members where user_id = p_user and household_id = pg_temp.hid(p_household))
$$;

create function pg_temp.default_of(p_user uuid) returns text language sql security definer as $$
  select h.name from public.household_members m join public.households h on h.id = m.household_id
  where m.user_id = p_user and m.is_default
$$;

-- [p_user]'s open request for [p_household].
create function pg_temp.request(p_user uuid, p_household text) returns uuid language sql security definer as $$
  select id from public.join_requests
  where user_id = p_user and household_id = pg_temp.hid(p_household) and decision is null
$$;

-- Jana was removed from TSV once, before this link was made (wave 2: check_invite let her ask).
create function pg_temp.removed_once(p_user uuid, p_household text) returns void
language sql security definer as $$
  insert into public.household_removals (household_id, user_id, removed_at)
  values (pg_temp.hid(p_household), p_user, now() - interval '1 day')
$$;
create function pg_temp.removals(p_user uuid) returns integer language sql security definer as $$
  select count(*)::int from public.household_removals where user_id = p_user
$$;
create function pg_temp.uses(p_code text) returns integer language sql security definer as $$
  select use_count from public.invites where code = p_code
$$;

grant execute on all functions in schema pg_temp to authenticated;

\set olga '''00000000-0000-0000-0000-000000169a01'''
\set anna '''00000000-0000-0000-0000-000000169a02'''
\set max '''00000000-0000-0000-0000-000000169a03'''
\set udo '''00000000-0000-0000-0000-000000169a04'''
\set jana '''00000000-0000-0000-0000-000000169a11'''
\set jonas '''00000000-0000-0000-0000-000000169a12'''
\set jule '''00000000-0000-0000-0000-000000169a13'''
\set kai '''00000000-0000-0000-0000-000000169a21'''
\set lou '''00000000-0000-0000-0000-000000169a22'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:olga, 'olga169a@example.com', '{"display_name": "Olga"}'),
  (:anna, 'anna169a@example.com', '{"display_name": "Anna"}'),
  (:max, 'max169a@example.com', '{"display_name": "Max"}'),
  (:udo, 'udo169a@example.com', '{"display_name": "Udo"}'),
  (:jana, 'jana169a@example.com', '{"display_name": "Jana"}'),
  (:jonas, 'jonas169a@example.com', '{"display_name": "Jonas"}'),
  (:jule, 'jule169a@example.com', '{"display_name": "Jule"}'),
  (:kai, 'kai169a@example.com', '{"display_name": "Kai"}'),
  (:lou, 'lou169a@example.com', '{"display_name": "Lou"}');

-- Which households start with approval ------------------------------------------------------------

select pg_temp.login(:olga);
select public.create_household(p_request_id => gen_random_uuid(), p_name => 'TSV', p_kind => 'club');
select public.create_household(p_request_id => gen_random_uuid(), p_name => 'Familie', p_kind => 'family');
select pg_temp.login(:udo);
select public.create_household('Bei Udo');
select pg_temp.login(:jana);
select public.create_household('Bei Jana');
select pg_temp.login(:jonas);
select public.create_household('Bei Jonas');
select pg_temp.as_postgres();
select results_eq($$ select name, join_approval from public.households order by name $$,
  $$ values ('Bei Jana', false), ('Bei Jonas', false), ('Bei Udo', false), ('Familie', false), ('TSV', true) $$,
  'a club starts with join approval on, every other household with it off');
select pg_temp.login(:olga);
select results_eq($$ select name, join_approval from public.my_households() order by name $$,
  $$ values ('Familie', false), ('TSV', true) $$, 'my_households shows the switch');

-- Anna is an admin of the TSV, Max a plain member (both joined before approval mattered).
select pg_temp.login(:olga);
select public.set_join_approval(pg_temp.hid('TSV'), false);
create temp table inv_anna as select code from public.create_invite(pg_temp.hid('TSV'), 'person');
create temp table inv_max as select code from public.create_invite(pg_temp.hid('TSV'), 'person');
grant select on inv_anna, inv_max to authenticated;
select pg_temp.login(:anna);
select public.accept_invite((select code from inv_anna), p_mode => 'add');
select pg_temp.login(:max);
select public.accept_invite((select code from inv_max), p_mode => 'add');
select pg_temp.login(:olga);
select public.set_member_role(pg_temp.hid('TSV'), :anna, 'admin');
select public.set_join_approval(pg_temp.hid('TSV'), true);
create temp table link as select code from public.create_invite(pg_temp.hid('TSV'), 'group');
create temp table person as select code from public.create_invite(pg_temp.hid('TSV'), 'person');
grant select on link, person to authenticated;

-- Asking to join -------------------------------------------------------------------------------

select pg_temp.login(:jana);
select is(public.accept_invite((select code from link), p_mode => 'add'),
  jsonb_build_object('status', 'requested', 'household_id', pg_temp.hid('TSV')),
  'with approval on, a join answers requested');
select is(pg_temp.is_member(:jana, 'TSV'), false, 'and makes no membership');
select is(pg_temp.uses((select code from link)), 0, 'nor counts a use');
select is(public.accept_invite((select code from link), p_mode => 'add') ->> 'status', 'requested',
  'asking again answers the same');
select is((select count(*)::int from public.join_requests), 1, 'with the one open request');
select results_eq($$ select household_name, decision from public.my_join_requests() $$,
  $$ values ('TSV', null::text) $$, 'my_join_requests shows it with the household''s name');

-- Old store builds get the same answer, an unknown status to them, and keep their household.
select pg_temp.login(:jonas);
select is(public.accept_invite((select code from link)),
  jsonb_build_object('status', 'requested', 'household_id', pg_temp.hid('TSV')),
  'the old one-argument accept_invite answers requested');
select is(public.accept_invite((select code from link), false) ->> 'status', 'requested',
  'and so does the old one with p_archive');
select is(pg_temp.default_of(:jonas), 'Bei Jonas', 'the old call left nothing');
select is(public.join_household((select code from link)), null,
  'the oldest join_household answers no household for a request');
select is((select count(*)::int from public.join_requests), 1, 'Jonas sees only his own request');
select pg_temp.login(:jule);
select is(public.accept_invite((select code from person), p_mode => 'add') ->> 'status', 'requested',
  'a person invite asks too');

-- Who sees the requests ---------------------------------------------------------------------------

select pg_temp.as_postgres();
update public.join_requests r set created_at = now() - make_interval(mins => case u.email
  when 'jana169a@example.com' then 3 when 'jonas169a@example.com' then 2 else 1 end)
from auth.users u where u.id = r.user_id;

select pg_temp.login(:max);
select is((select count(*)::int from public.join_requests), 0, 'a plain member sees no request');
select throws_ok($$ select * from public.household_join_requests(pg_temp.hid('TSV')) $$, '42501', 'not_admin',
  'household_join_requests is for the owner and admins');
select throws_ok($$ select public.decide_join_request(pg_temp.request('00000000-0000-0000-0000-000000169a11', 'TSV'), true) $$, '42501', 'not_admin',
  'so is deciding');
select pg_temp.login(:udo);
select throws_ok($$ select * from public.household_join_requests(pg_temp.hid('TSV')) $$, '42501', 'not_member',
  'an outsider gets not_member');
select throws_ok($$ select public.decide_join_request(pg_temp.request('00000000-0000-0000-0000-000000169a11', 'TSV'), true) $$, 'P0002',
  'request_not_found', 'and no request of another household');
select pg_temp.login(:anna);
select is((select count(*)::int from public.join_requests), 3, 'an admin sees the household''s requests');
select results_eq(
  $$ select display_name, invite_kind from public.household_join_requests(pg_temp.hid('TSV')) $$,
  $$ values ('Jana', 'group'), ('Jonas', 'group'), ('Jule', 'person') $$,
  'household_join_requests: the requester''s name and the invite they came through, oldest first');
select throws_ok($$ select public.decide_join_request(pg_temp.request('00000000-0000-0000-0000-000000169a11', 'TSV'), null) $$, '22023',
  'invalid_value', 'a decision is required');

-- Deciding ------------------------------------------------------------------------------------

select pg_temp.removed_once(:jana, 'TSV');
create temp table jana_req as select pg_temp.request(:jana, 'TSV') as id;
grant select on jana_req to authenticated;
select is(public.decide_join_request((select id from jana_req), true),
  jsonb_build_object('status', 'approved', 'household_id', pg_temp.hid('TSV'), 'user_id', :jana::uuid),
  'an admin approves');
select is(pg_temp.is_member(:jana, 'TSV'), true, 'the requester is a member');
select is(pg_temp.default_of(:jana), 'Bei Jana', 'and keeps her default');
select is(pg_temp.uses((select code from link)), 1, 'the group link counts the use');
select is((select count(*)::int from public.invite_uses where user_id = :jana), 1, 'invite_uses has the join');
select is(pg_temp.removals(:jana), 0, 'and her old removal record ends with the approval');
select is(public.decide_join_request((select id from jana_req), true) ->> 'status', 'approved',
  'approving again answers the same');
select is(public.decide_join_request((select id from jana_req), false) ->> 'status', 'approved',
  'a decline after the approval changes nothing');
select is(pg_temp.uses((select code from link)), 1, 'and counts nothing more');

select pg_temp.login(:olga);
create temp table jonas_req as select pg_temp.request(:jonas, 'TSV') as id;
grant select on jonas_req to authenticated;
select is(public.decide_join_request((select id from jonas_req), false) ->> 'status', 'declined',
  'the owner declines');
select is(pg_temp.is_member(:jonas, 'TSV'), false, 'no membership');
select pg_temp.login(:jonas);
select results_eq($$ select household_name, decision from public.my_join_requests() $$,
  $$ values ('TSV', 'declined') $$, 'the requester sees the decline');
select is(public.accept_invite((select code from link), p_mode => 'add'),
  jsonb_build_object('status', 'declined_recently', 'household_id', null),
  'asking again within 24 hours answers declined_recently');
select is(public.join_household((select code from link)), null,
  'the oldest join_household answers no household for it');
select is((select count(*)::int from public.join_requests where user_id = :jonas), 1, 'and files nothing');
select pg_temp.as_postgres();
update public.join_requests set decided_at = now() - interval '25 hours' where id = (select id from jonas_req);
select pg_temp.login(:jonas);
select is(public.accept_invite((select code from link), p_mode => 'add') ->> 'status', 'requested',
  'a day later he may ask again');
select is((select count(*)::int from public.join_requests where user_id = :jonas), 2, 'a new request');

-- Cancelling ----------------------------------------------------------------------------------

select pg_temp.login(:anna);
select throws_ok($$ select public.cancel_join_request(pg_temp.request('00000000-0000-0000-0000-000000169a12', 'TSV')) $$, 'P0002',
  'request_not_found', 'only the requester cancels');
select pg_temp.login(:jonas);
create temp table jonas_again as select pg_temp.request(:jonas, 'TSV') as id;
grant select on jonas_again to authenticated;
select is(public.cancel_join_request((select id from jonas_again)),
  jsonb_build_object('status', 'cancelled', 'household_id', pg_temp.hid('TSV')), 'the requester cancels');
select is(public.cancel_join_request((select id from jonas_again)) ->> 'status', 'cancelled',
  'cancelling again answers the same');
select is(public.cancel_join_request((select id from jonas_req)) ->> 'status', 'declined',
  'a decided request answers its decision');
select pg_temp.login(:anna);
select is(public.decide_join_request((select id from jonas_again), true) ->> 'status', 'cancelled',
  'approving a cancelled request answers cancelled');
select is(pg_temp.is_member(:jonas, 'TSV'), false, 'and makes no member');

-- An invite with no use left ------------------------------------------------------------------

-- Jonas asks through Jule's person invite too; Jule is approved first and uses it up.
select pg_temp.login(:jonas);
select public.accept_invite((select code from person), p_mode => 'add');
select pg_temp.login(:anna);
select is(public.decide_join_request(pg_temp.request(:jule, 'TSV'), true) ->> 'status', 'approved',
  'Jule is approved through the person invite');
create temp table jonas_person as select pg_temp.request(:jonas, 'TSV') as id;
grant select on jonas_person to authenticated;
select is(public.decide_join_request((select id from jonas_person), true),
  jsonb_build_object('status', 'invite_full', 'household_id', pg_temp.hid('TSV'), 'user_id', :jonas::uuid),
  'the invite is used up: invite_full');
select is(pg_temp.is_member(:jonas, 'TSV'), false, 'no membership');
select is((select decision from public.join_requests where id = (select id from jonas_person)), null,
  'the request stays open');
-- The admin sends a new link: opening it moves the waiting request to it, so it can be approved.
select pg_temp.login(:jonas);
select public.accept_invite((select code from link), p_mode => 'add');
select pg_temp.as_postgres();
select is(pg_temp.request(:jonas, 'TSV'), (select id from jonas_person),
  'a new link opened while a request waits keeps that one request');
select is((select i.code from public.join_requests r join public.invites i on i.id = r.invite_id
  where r.id = (select id from jonas_person)), (select code from link),
  'and moves it to the new link, whose use the approval counts');
select pg_temp.login(:anna);
select is(public.decide_join_request((select id from jonas_person), false) ->> 'status', 'declined',
  'and can be declined');

-- Switching approval --------------------------------------------------------------------------

select pg_temp.login(:max);
select throws_ok($$ select public.set_join_approval(pg_temp.hid('TSV'), false) $$, '42501', 'not_admin',
  'a plain member cannot switch approval');
select throws_ok($$ update public.households set join_approval = false where id = pg_temp.hid('TSV') $$,
  '42501', null, 'nor write the column');
select pg_temp.login(:udo);
select throws_ok($$ select public.set_join_approval(pg_temp.hid('TSV'), false) $$, '42501', 'not_member',
  'an outsider gets not_member');
select pg_temp.login(:anna);
select throws_ok($$ select public.set_join_approval(pg_temp.hid('TSV'), null) $$, '22023', 'invalid_value',
  'on or off, not null');
select pg_temp.as_postgres();
update public.join_requests set decided_at = now() - interval '25 hours'
where user_id = :jonas and decision = 'declined';
select pg_temp.login(:jonas);
select public.accept_invite((select code from link), p_mode => 'add');
select pg_temp.login(:anna);
select lives_ok($$ select public.set_join_approval(pg_temp.hid('TSV'), false) $$, 'an admin switches it off');
select is((select join_approval from public.households where id = pg_temp.hid('TSV')), false, 'it is off');
select pg_temp.login(:udo);
select is(public.accept_invite((select code from link), p_mode => 'add') ->> 'status', 'joined',
  'with approval off, a join joins');
select is(pg_temp.uses((select code from link)), 2, 'and counts');
select pg_temp.login(:jonas);
select is(public.accept_invite((select code from link), p_mode => 'add') ->> 'status', 'joined',
  'Jonas, with a request still open, joins directly');
select pg_temp.login(:anna);
select is_empty($$ select * from public.household_join_requests(pg_temp.hid('TSV')) $$,
  'a member''s open request is not listed');
select is(pg_temp.request(:jonas, 'TSV'), null, 'his open request closed when he joined');
select is(pg_temp.uses((select code from link)), 3, 'without a second use');
select pg_temp.login(:olga);
select lives_ok($$ select public.set_join_approval(pg_temp.hid('Familie'), true) $$,
  'the owner switches it on for the family');

-- A request ends when its asker joins another way, or was removed since asking (review W3.2) -----

select pg_temp.as_postgres();
update public.households set join_approval = true where id = pg_temp.hid('TSV');
select pg_temp.login(:kai);
select is(public.accept_invite((select code from link), p_mode => 'add') ->> 'status', 'requested',
  'Kai asks to join TSV');
select pg_temp.as_postgres();
update public.households set join_approval = false where id = pg_temp.hid('TSV');
select pg_temp.login(:kai);
select is(public.accept_invite((select code from link), p_mode => 'add') ->> 'status', 'joined',
  'with approval off he joins through the link');
select pg_temp.as_postgres();
select is((select decision from public.join_requests where user_id = :kai), 'cancelled',
  'and his open request closes with the membership');
select pg_temp.login(:kai);
select public.leave_household(pg_temp.hid('TSV'));
select pg_temp.login(:olga);
select is(public.decide_join_request((select id from public.join_requests where user_id = :kai), true)
  ->> 'status', 'cancelled', 'after he left, approving his old request answers cancelled');
select is(pg_temp.is_member(:kai, 'TSV'), false, 'and Kai stays out');
select pg_temp.as_postgres();
update public.households set join_approval = true where id = pg_temp.hid('TSV');
select pg_temp.login(:lou);
select public.accept_invite((select code from link), p_mode => 'add');
select pg_temp.as_postgres();
create temp table lou_req as select id from public.join_requests where user_id = :lou;
grant select on lou_req to authenticated;
update public.households set join_approval = false where id = pg_temp.hid('TSV');
select pg_temp.login(:lou);
select public.accept_invite((select code from link), p_mode => 'add');
select pg_temp.login(:olga);
select public.remove_member(pg_temp.hid('TSV'), :lou);
select public.set_join_approval(pg_temp.hid('TSV'), true);
select is(public.decide_join_request((select id from lou_req), true) ->> 'status', 'cancelled',
  'a request from someone who joined and was removed since asking is closed, not approved');
select is(pg_temp.is_member(:lou, 'TSV'), false, 'and Lou stays out');

-- Retention -----------------------------------------------------------------------------------

select pg_temp.as_postgres();
update public.join_requests set decided_at = now() - interval '8 days', created_at = now() - interval '9 days'
where user_id = :jana;
insert into public.join_requests (household_id, user_id, created_at)
values (pg_temp.hid('Familie'), :udo, now() - interval '60 days');
select is(public.purge_join_requests(), 1, 'the purge removes requests decided over 7 days ago');
select is((select count(*)::int from public.join_requests where user_id = :udo and decision is null), 1,
  'and keeps open ones, however old');
select pg_temp.login(:jana);
select is_empty($$ select * from public.my_join_requests() $$, 'nothing left for Jana to see');

select * from finish();
rollback;
