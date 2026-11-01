-- Job 47 (migration 20261031194500_purchase_legal_fixes.sql): the archive switch (H-70), the
-- 24-month deletion of archived households (H-50), nil-bound sandbox purchases (H-69), and the
-- buyer's claim for the purchase's household. Pia and Quinn share a household with Lifetime,
-- Rosa has her own, Sam is no member of anything Pia bought for.
begin;
select plan(55);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;

create function pg_temp.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

create function pg_temp.hmac(p_tx text) returns text language sql as $$
  select encode(extensions.hmac(p_tx, 'pgTAP key', 'sha256'), 'hex')
$$;

-- RevenueCat's webhook record of a sandbox Lifetime for [p_household], bought at [p_bought].
create function pg_temp.record(p_tx text, p_household uuid, p_bought timestamptz default now() - interval '1 minute')
returns text language sql as $$
  select public.purchase_record('apple', p_tx, p_tx, pg_temp.hmac(p_tx), 'com.hummlist.app.lifetime',
    'premium', 'lifetime', 'Sandbox', p_bought, 9.99, 'EUR', 'DE', p_household) ->> 'outcome'
$$;

create function pg_temp.archive_switch(p_on boolean) returns void language sql as $$
  update public.app_switches set enabled = p_on where key = 'household_archive'
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000047a1', 'pia47@example.com'),
  ('00000000-0000-0000-0000-0000000047b1', 'quinn47@example.com'),
  ('00000000-0000-0000-0000-0000000047c1', 'rosa47@example.com'),
  ('00000000-0000-0000-0000-0000000047d1', 'sam47@example.com');

select pg_temp.login('00000000-0000-0000-0000-0000000047a1');
create temp table hp as select id from public.create_household('Pia');
create temp table inv_p as select code from public.create_invite((select id from hp));
select pg_temp.login('00000000-0000-0000-0000-0000000047c1');
create temp table hr as select id from public.create_household('Rosa');
create temp table inv_r as select code from public.create_invite((select id from hr));
create temp table inv_r2 as select code from public.create_invite((select id from hr));
create temp table inv_r3 as select code from public.create_invite((select id from hr));
select pg_temp.login('00000000-0000-0000-0000-0000000047d1');
create temp table hs as select id from public.create_household('Sam');
grant select on hp, hr, hs, inv_p, inv_r, inv_r2, inv_r3 to authenticated, anon;
select pg_temp.as_postgres();
select is(pg_temp.record('4700000000000001', (select id from hp)), 'granted', 'Pia''s household has Lifetime');

-- The switch: service only, seeded off -------------------------------------------------------

select is((select enabled from public.app_switches where key = 'household_archive'), false,
  'household_archive is seeded off');
select pg_temp.login('00000000-0000-0000-0000-0000000047a1');
select throws_ok($$ select * from public.app_switches $$, '42501', null, 'members cannot read the switches');
select throws_ok($$ update public.app_switches set enabled = true $$, '42501', null, 'nor turn one on');
select throws_ok($$ insert into public.app_switches (key, enabled) values ('x', true) $$, '42501', null,
  'nor add one');
select throws_ok($$ select public.app_switch('household_archive') $$, '42501', null,
  'nor call the switch lookup');
set local role anon;
select throws_ok($$ select * from public.app_switches $$, '42501', null, 'anon cannot read them either');
select pg_temp.as_postgres();
select is(
  (select array_agg(privilege_type::text order by privilege_type) from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'app_switches' and grantee in ('anon', 'authenticated')),
  null, 'no client role has any grant on app_switches');

-- Switch off: every archiving path is refused and changes nothing -----------------------------

select pg_temp.login('00000000-0000-0000-0000-0000000047a1');
select throws_ok($$ select public.leave_current_household(true) $$, 'P0001', 'archive_disabled',
  'leaving an unlocked household as its last member with archive is refused');
select ok(public.is_household_member((select id from hp)), 'Pia is still a member');
select throws_ok($$ select public.accept_invite((select code from inv_r), true) $$, 'P0001', 'archive_disabled',
  'joining another household with archive is refused');
select ok(public.is_household_member((select id from hp)), 'Pia is still in her household');
select pg_temp.as_postgres();
select is((select used_at from public.invites where code = (select code from inv_r)), null, 'the invite is unused');
select is((select count(*)::int from public.households where archived_at is not null), 0, 'nothing is archived');

-- With p_archive but nothing to archive (no Lifetime) the call goes on as without it.
select pg_temp.login('00000000-0000-0000-0000-0000000047d1');
select is(public.accept_invite((select code from inv_r2), true) ->> 'previous', 'deleted',
  'Sam''s locked household is deleted as before, switch or not');

-- Switch on: archiving works -----------------------------------------------------------------

select pg_temp.as_postgres();
select pg_temp.archive_switch(true);
select pg_temp.login('00000000-0000-0000-0000-0000000047a1');
select is(public.accept_invite((select code from inv_r), true) ->> 'previous', 'archived',
  'with the switch on Pia archives her household and joins Rosa');
select is((public.archived_households() -> 0 ->> 'deletes_at')::timestamptz,
  (public.archived_households() -> 0 ->> 'archived_at')::timestamptz + interval '24 months',
  'the archived list says when it is deleted: 24 months after archiving');

-- Switch off again: bringing an archived household back stays possible.
select pg_temp.as_postgres();
select pg_temp.archive_switch(false);
select pg_temp.login('00000000-0000-0000-0000-0000000047a1');
select is(public.unarchive_household((select id from hp), true),
  '{"status": "unarchived", "previous": "left"}'::jsonb,
  'with the switch off Pia still re-enables her archived household (Rosa stays where she left)');
select ok(public.is_household_member((select id from hp)), 'Pia is back in it');
select pg_temp.as_postgres();
select is((select archived_at from public.households where id = (select id from hp)), null,
  're-enabling clears the archive date');

-- Re-enabling into a household that would need archiving is refused with the switch off.
select pg_temp.archive_switch(true);
select pg_temp.login('00000000-0000-0000-0000-0000000047a1');
select is(public.accept_invite((select code from inv_r3), true) ->> 'previous', 'archived', 'Pia archives again');
select pg_temp.as_postgres();
select is((select archived_at from public.households where id = (select id from hp)), now(),
  'archiving again starts a new 24 months from now');
select pg_temp.record('4700000000000002', (select id from hr));
select pg_temp.archive_switch(false);
-- Rosa's household now has Lifetime and Rosa, Sam and Pia; Rosa and Sam leave, Pia is its last member.
select pg_temp.login('00000000-0000-0000-0000-0000000047c1');
select is(public.leave_current_household(false), 'left', 'Rosa leaves her household');
select pg_temp.login('00000000-0000-0000-0000-0000000047d1');
select is(public.leave_current_household(false), 'left', 'so does Sam, leaving it to Pia');
select pg_temp.login('00000000-0000-0000-0000-0000000047a1');
select throws_ok($$ select public.unarchive_household((select id from hp), true) $$, 'P0001', 'archive_disabled',
  're-enabling while leaving an unlocked household as its last member is refused with the switch off');
select pg_temp.as_postgres();
select is((select archived_at is not null from public.households where id = (select id from hp)), true,
  'and Pia''s household stays archived');
select ok(exists (select from public.household_members where household_id = (select id from hr)),
  'and the household she is in keeps her');

-- 24 months after archiving ------------------------------------------------------------------

select pg_temp.archive_switch(true);
update public.households set archived_at = now() - interval '24 months' + interval '1 day'
where id = (select id from hp);
select public.purge_purchases();
select ok(exists (select from public.households where id = (select id from hp)),
  'archived 24 months minus a day ago: kept');
update public.households set archived_at = now() - interval '24 months' - interval '1 day'
where id = (select id from hp);
select public.purge_purchases();
select ok(not exists (select from public.households where id = (select id from hp)),
  'archived 24 months plus a day ago: deleted');
select is((select household_deleted_at from public.purchases where transaction_id = '4700000000000001'), now(),
  'its purchase starts the 30 days like any deleted household''s');
select ok(exists (select from public.revenuecat_deletions where app_user_id = (select id from hp)),
  'and its RevenueCat customer is queued for deletion');
update public.purchases set household_deleted_at = now() - interval '29 days' where transaction_id = '4700000000000001';
select public.purge_purchases();
select ok(exists (select from public.purchases where transaction_id = '4700000000000001'), 'kept 29 days on');
update public.purchases set household_deleted_at = now() - interval '31 days' where transaction_id = '4700000000000001';
select public.purge_purchases();
select ok(not exists (select from public.purchases where transaction_id = '4700000000000001'), 'gone after 30 days');
select ok(exists (select from public.purchase_tombstones where transaction_hmac = pg_temp.hmac('4700000000000001')),
  'only its tombstone stays');
select is(pg_temp.record('4700000000000001', (select id from hr)), 'tombstoned', 'it never unlocks another household');

-- An archiver's account deletion still deletes the archive at once.
select pg_temp.login('00000000-0000-0000-0000-0000000047a1');
select is(public.leave_current_household(true), 'archived', 'Pia archives Rosa''s former household');
select pg_temp.as_postgres();
create temp table harch as select id from public.households where archived_by = '00000000-0000-0000-0000-0000000047a1';
select public.delete_account('00000000-0000-0000-0000-0000000047a1');
select ok(not exists (select from public.households where id = (select id from harch)),
  'her account deletion deletes it right away, not 24 months later');

-- Nil-bound sandbox purchases (H-69) -----------------------------------------------------------

insert into public.purchases (store, transaction_id, product_id, environment, purchased_at, verified_at, bound_household)
values
  ('apple', '47-nil-old', 'com.hummlist.app.lifetime', 'Sandbox', now() - interval '40 days', now() - interval '31 days', '00000000-0000-0000-0000-000000000000'),
  ('apple', '47-nil-new', 'com.hummlist.app.lifetime', 'Sandbox', now() - interval '40 days', now() - interval '29 days', '00000000-0000-0000-0000-000000000000'),
  ('apple', '47-nil-prod', 'com.hummlist.app.lifetime', 'Production', now() - interval '40 days', now() - interval '31 days', '00000000-0000-0000-0000-000000000000');
select public.purge_purchases();
select is(
  (select array_agg(transaction_id order by transaction_id) from public.purchases where transaction_id like '47-nil-%'),
  array['47-nil-new', '47-nil-prod'],
  'a nil-bound sandbox purchase goes after 30 days; a younger one and a production row stay');

-- The buyer's claim names the purchase's household ---------------------------------------------

select pg_temp.login('00000000-0000-0000-0000-0000000047b1');
create temp table hq as select id from public.create_household('Quinn');
create temp table inv_q as select code from public.create_invite((select id from hq));
grant select on hq, inv_q to authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000047d1');
create temp table hs2 as select id from public.create_household('Sam 2');
create temp table inv_s as select code from public.create_invite((select id from hs2));
grant select on hs2, inv_s to authenticated;
select pg_temp.as_postgres();
select is(pg_temp.record('4700000000000003', (select id from hq)), 'granted', 'Quinn buys for his household');
-- Quinn joins Sam's household right after buying, before the claim arrives.
select pg_temp.archive_switch(false);
select pg_temp.login('00000000-0000-0000-0000-0000000047b1');
select is(public.accept_invite((select code from inv_s), false) ->> 'previous', 'deleted',
  'Quinn leaves his household for Sam''s (deleting it)');
select pg_temp.as_postgres();
-- His household is gone with him; a buyer who left one that others keep is the case below.
select throws_ok($$ select public.purchase_claim('00000000-0000-0000-0000-0000000047b1', (select id from hq), 'apple', '4700000000000003') $$,
  '42501', 'not_a_member', 'a claim for a household that is gone records nobody');

select pg_temp.login('00000000-0000-0000-0000-0000000047c1');
create temp table hr2 as select id from public.create_household('Rosa 2');
create temp table inv_r4 as select code from public.create_invite((select id from hr2));
grant select on hr2, inv_r4 to authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000047b1');
select is(public.accept_invite((select code from inv_r4), false) ->> 'previous', 'left', 'Quinn joins Rosa');
select pg_temp.as_postgres();
update public.household_members set joined_at = now() - interval '2 hours'
where household_id = (select id from hr2);
select is(pg_temp.record('4700000000000004', (select id from hr2)), 'granted', 'Quinn buys for Rosa''s household');
select pg_temp.login('00000000-0000-0000-0000-0000000047b1');
select is(public.leave_current_household(false), 'left', 'and leaves it at once');
select pg_temp.as_postgres();
select is(public.purchase_claim('00000000-0000-0000-0000-0000000047b1', (select id from hr2), 'apple', '4700000000000004') ->> 'status',
  'recorded', 'his claim names the purchase''s household and records him, though he left it');
select is((select user_id from public.purchases where transaction_id = '4700000000000004'),
  '00000000-0000-0000-0000-0000000047b1'::uuid, 'Quinn is the buyer');
select is(public.purchase_claim('00000000-0000-0000-0000-0000000047b1', (select id from hs2), 'apple', '4700000000000004') ->> 'status',
  'elsewhere', 'a claim naming the household he is in now is the other household''s purchase');

-- Sam joined Rosa's household after the purchase: not a member when buying.
select is(pg_temp.record('4700000000000005', (select id from hr2), now() - interval '1 hour'), 'granted',
  'a purchase in Rosa''s household an hour ago');
update public.household_members set joined_at = now() where user_id = '00000000-0000-0000-0000-0000000047c1';
select throws_ok($$ select public.purchase_claim('00000000-0000-0000-0000-0000000047c1', (select id from hr2), 'apple', '4700000000000005') $$,
  '42501', 'not_a_member', 'a member who joined after the purchase cannot claim it');
select throws_ok($$ select public.purchase_claim('00000000-0000-0000-0000-0000000047d1', (select id from hr2), 'apple', '4700000000000005') $$,
  '42501', 'not_a_member', 'nor can someone who never was a member');

-- The claim before the webhook: Quinn's departure counts for an hour.
select is(public.purchase_claim('00000000-0000-0000-0000-0000000047b1', (select id from hr2), 'apple', '4700000000000006') ->> 'status',
  'waiting', 'a claim before the webhook waits, for the household he just left');
select is(pg_temp.record('4700000000000006', (select id from hr2)), 'granted', 'the webhook records it');
select is((select user_id from public.purchases where transaction_id = '4700000000000006'),
  '00000000-0000-0000-0000-0000000047b1'::uuid, 'and takes Quinn''s claim as the buyer');
update public.household_departures set left_at = now() - interval '2 hours'
where user_id = '00000000-0000-0000-0000-0000000047b1';
select throws_ok($$ select public.purchase_claim('00000000-0000-0000-0000-0000000047b1', (select id from hr2), 'apple', '4700000000000007') $$,
  '42501', 'not_a_member', 'an hour after leaving his claim counts no more');
select public.purge_purchases();
select is((select count(*)::int from public.household_departures where user_id = '00000000-0000-0000-0000-0000000047b1'), 0,
  'and the purge deletes his departure');

select * from finish();
rollback;
