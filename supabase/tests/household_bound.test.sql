-- Job 43: Hummlist Lifetime is household-bound (migration 20261031123504_household_bound_lifetime.sql).
-- Anna and Ben share a household, Cleo has her own, Dana (a tester) has hers. A purchase stays
-- with its household for good, a tester's unlock goes with the tester, the join preview says
-- what a household has and what joining ends.
begin;
select plan(96);

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

-- A sandbox Lifetime bought by [p_user] for [p_household]: the app's claim, then RevenueCat's
-- webhook record (the usual order; the reverse is covered below). Returns the record's answer.
create function pg_temp.hmac(p_tx text) returns text language sql as $$
  select encode(extensions.hmac(p_tx, 'pgTAP key', 'sha256'), 'hex')
$$;

create function pg_temp.grant_(p_tx text, p_user uuid, p_household uuid, p_bought timestamptz default now() - interval '1 minute')
returns jsonb language plpgsql as $$
begin
  if exists (select from public.household_members m where m.user_id = p_user and m.household_id = p_household) then
    perform public.purchase_claim(p_user, p_household, 'apple', p_tx);
  end if;
  return public.purchase_record('apple', p_tx, p_tx, pg_temp.hmac(p_tx), 'com.hummlist.app.lifetime',
    'premium', 'lifetime', 'Sandbox', p_bought, 9.99, 'EUR', 'DE', p_household) - 'buyer' - 'send_completed' - 'plan' - 'second_yearly';
end $$;

create function pg_temp.unlocks(p_household uuid) returns text language sql as $$
  select coalesce(string_agg(source, ',' order by source), '') from public.entitlements where household_id = p_household
$$;

-- These cases archive with the server switch on (job 47); household_archive.test.sql has it off.
update public.app_switches set enabled = true where key = 'household_archive';

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000043a1', 'anna43@example.com'),
  ('00000000-0000-0000-0000-0000000043b1', 'ben43@example.com'),
  ('00000000-0000-0000-0000-0000000043c1', 'cleo43@example.com'),
  ('00000000-0000-0000-0000-0000000043d1', 'dana43@example.com'),
  ('00000000-0000-0000-0000-0000000043e1', 'eva43@example.com'),
  ('00000000-0000-0000-0000-0000000043f1', 'frank43@example.com');

select pg_temp.login('00000000-0000-0000-0000-0000000043a1');
create temp table ha as select id from public.create_household('Anna & Ben');
create temp table inv_a as select code from public.create_invite((select id from ha));
grant select on ha, inv_a to authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000043b1');
select public.join_household((select code from inv_a));
select pg_temp.login('00000000-0000-0000-0000-0000000043a1');
create temp table inv_a2 as select code from public.create_invite((select id from ha));
grant select on inv_a2 to authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000043c1');
create temp table hc as select id from public.create_household('Cleo');
create temp table inv_c as select code from public.create_invite((select id from hc));
grant select on hc, inv_c to authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000043d1');
create temp table hd as select id from public.create_household('Dana');
grant select on hd to authenticated;

-- The tester list is the service connection's -------------------------------------------------

select pg_temp.login('00000000-0000-0000-0000-0000000043d1');
select throws_ok($$ select * from public.lifetime_testers $$, '42501', null, 'clients cannot read the tester list');
select throws_ok($$ insert into public.lifetime_testers (user_id) values (auth.uid()) $$, '42501', null,
  'clients cannot put themselves on it');
select throws_ok($$ select public.tester_grant_apply(auth.uid(), (select id from hd)) $$, '42501', null,
  'clients cannot use a grant themselves');
set local role anon;
select throws_ok($$ select * from public.lifetime_testers $$, '42501', null, 'anon cannot read it either');
select pg_temp.login('00000000-0000-0000-0000-0000000043a1');
select throws_ok(
  $$ select public.purchase_record('apple', 'x', 'x', repeat('a', 64), 'com.hummlist.app.lifetime', 'premium', 'lifetime',
       'Sandbox', now(), 9.99, 'EUR', 'DE', (select id from ha)) $$,
  '42501', null, 'clients cannot record a purchase');
select throws_ok($$ select public.purchase_claim(auth.uid(), (select id from ha), 'apple', 'x') $$,
  '42501', null, 'clients cannot claim directly (only through the function)');
select throws_ok(
  $$ insert into public.entitlements (household_id, source, tester) select id, 'tester', auth.uid() from ha $$,
  '42501', null, 'clients cannot write a tester unlock');

-- Join preview before anything is unlocked ---------------------------------------------------

select pg_temp.login('00000000-0000-0000-0000-0000000043c1');
select is(public.preview_invite((select code from inv_a2)) - 'name',
  '{"status": "ok", "unlocked": false, "leaves_unlocked": false, "recent_purchase": false}'::jsonb,
  'Cleo previews Anna''s locked household: nothing to tell');

-- Anna buys; the purchase is bound to her household -----------------------------------------

select pg_temp.as_postgres();
select is(pg_temp.grant_('4300000000000001', '00000000-0000-0000-0000-0000000043a1', (select id from ha)),
  '{"outcome": "granted", "already_unlocked": false, "household_gone": false, "internal": false}'::jsonb,
  'Anna''s purchase unlocks the household');
select results_eq(
  $$ select p.kind, p.bound_household, e.kind, e.source, e.household_id from public.purchases p
     join public.entitlements e on e.purchase_id = p.id where p.transaction_id = '4300000000000001' $$,
  $$ values ('premium', (select id from ha), 'premium', 'purchase', (select id from ha)) $$,
  'the purchase and its unlock carry the kind; the purchase records its household');
select pg_temp.login('00000000-0000-0000-0000-0000000043b1');
select results_eq($$ select kind, source from public.entitlements $$, $$ values ('premium', 'purchase') $$,
  'Ben reads the household''s unlock');

-- Ben buys too (his phone, the race, Ask to Buy): a second row, flagged for the refund help.
select pg_temp.as_postgres();
select is(pg_temp.grant_('4300000000000002', '00000000-0000-0000-0000-0000000043b1', (select id from ha)) ->> 'already_unlocked',
  'true', 'a purchase in a household that was unlocked already says so');
select is(pg_temp.grant_('4300000000000002', '00000000-0000-0000-0000-0000000043b1', (select id from ha)),
  '{"outcome": "restored", "already_unlocked": false, "household_gone": false, "internal": false}'::jsonb,
  'its retry is a plain restore');
select is(pg_temp.unlocks((select id from ha)), 'purchase,purchase', 'two rows, one per purchase');
select ok(public.purchase_revoke('apple', '4300000000000002', now(), 'com.hummlist.app.lifetime', 'lifetime', 'Sandbox', null) is not null,
  'Apple refunds Ben''s');
select is(pg_temp.unlocks((select id from ha)), 'purchase', 'Anna''s keeps the household unlocked');

select pg_temp.login('00000000-0000-0000-0000-0000000043c1');
select is(public.preview_invite((select code from inv_a2)) ->> 'unlocked', 'true',
  'the preview of an unlocked household says so: nothing to buy');

-- Anna leaves for Cleo's household: her purchase stays -------------------------------------

select pg_temp.login('00000000-0000-0000-0000-0000000043a1');
select is(public.preview_invite((select code from inv_c)) - 'name',
  '{"status": "ok", "unlocked": false, "leaves_unlocked": false, "recent_purchase": true}'::jsonb,
  'Anna is not the last member (Ben stays): no warning; her purchase is recent');
select is(public.accept_invite((select code from inv_c)) ->> 'status', 'joined', 'Anna joins Cleo');
select pg_temp.as_postgres();
select is(pg_temp.unlocks((select id from ha)), 'purchase', 'the payer left; Ben keeps the unlock');
select is(pg_temp.grant_('4300000000000001', '00000000-0000-0000-0000-0000000043a1', (select id from hc)),
  '{"outcome": "used_elsewhere", "already_unlocked": false, "household_gone": false, "internal": false}'::jsonb,
  'Anna cannot restore it in Cleo''s household');
select is(pg_temp.unlocks((select id from hc)), '', 'Cleo''s household stays locked');

-- Ben, the last member, joins Cleo's too: warned first, never blocked; the unlock ends.
select pg_temp.login('00000000-0000-0000-0000-0000000043c1');
create temp table inv_c2 as select code from public.create_invite((select id from hc));
select pg_temp.login('00000000-0000-0000-0000-0000000043b1');
select is(public.preview_invite((select code from inv_c2)) - 'name',
  '{"status": "ok", "unlocked": false, "leaves_unlocked": true, "recent_purchase": false}'::jsonb,
  'Ben, last member of an unlocked household, is told it ends; his refunded purchase is not recent');
select is(public.accept_invite((select code from inv_c2)) ->> 'status', 'joined', 'and can still join');
select pg_temp.as_postgres();
select ok(not exists (select from public.households where id = (select id from ha)), 'Anna & Ben''s household is gone');
select is((select bound_household from public.purchases where transaction_id = '4300000000000001'), (select id from ha),
  'the purchase still names it');
select is(pg_temp.grant_('4300000000000001', '00000000-0000-0000-0000-0000000043a1', (select id from hc)),
  '{"outcome": "used_elsewhere", "already_unlocked": false, "household_gone": true, "internal": false}'::jsonb,
  'a restore in Cleo''s household is refused also after its household is gone');
select hasnt_function('public', 'purchase_grant', 'job 25''s self-verifying grant is gone (RevenueCat records purchases)');
select is(pg_temp.unlocks((select id from hc)), '', 'Cleo''s household is still locked');

-- A reversed refund unlocks the purchase's own household, never another.
select is(public.purchase_reinstate('apple', '4300000000000002'), true, 'Apple reverses Ben''s refund');
select is((select count(*)::int from public.entitlements e join public.purchases p on p.id = e.purchase_id
  where p.transaction_id = '4300000000000002'), 0, 'its household is gone: it unlocks nothing');

-- An old purchase is not recent.
select pg_temp.as_postgres();
select is(pg_temp.grant_('4300000000000003', '00000000-0000-0000-0000-0000000043c1', (select id from hc),
  now() - interval '31 days') ->> 'outcome', 'granted', 'Cleo bought 31 days ago');
select pg_temp.login('00000000-0000-0000-0000-0000000043d1');
create temp table inv_d as select code from public.create_invite((select id from hd));
select pg_temp.login('00000000-0000-0000-0000-0000000043c1');
select is(public.preview_invite((select code from inv_d)) ->> 'recent_purchase', 'false',
  'a purchase older than 30 days is not recent');
select is(public.preview_invite((select code from inv_d)) ->> 'leaves_unlocked', 'false',
  'Cleo is not the last member of her unlocked household');

-- Testers ------------------------------------------------------------------------------------

select pg_temp.login('00000000-0000-0000-0000-0000000043d1');
create temp table inv_d2 as select code from public.create_invite((select id from hd));
select pg_temp.login('00000000-0000-0000-0000-0000000043e1');
select is(public.accept_invite((select code from inv_d2)) ->> 'status', 'joined', 'Eva joins Dana');

select pg_temp.as_postgres();
insert into public.lifetime_testers (user_id, note) values ('00000000-0000-0000-0000-0000000043d1', 'pgTAP');
select is(pg_temp.unlocks((select id from hd)), 'tester', 'putting Dana on the list uses her one grant on her household');
select pg_temp.login('00000000-0000-0000-0000-0000000043e1');
select results_eq($$ select kind, source, purchase_id from public.entitlements $$,
  $$ values ('premium', 'tester', null::uuid) $$, 'Eva reads it like a purchase''s, with its source');
select throws_ok($$ select tester from public.entitlements $$, '42501', null, 'but not whose grant it is');
select throws_ok($$ select granted_by from public.entitlements $$, '42501', null, 'nor who gave it');
select throws_ok($$ select * from public.entitlements $$, '42501', null, 'so no select *');
select pg_temp.login('00000000-0000-0000-0000-0000000043c1');
select is(public.preview_invite((select code from inv_d)) ->> 'unlocked', 'true',
  'Cleo previews Dana''s household as unlocked');
select is_empty($$ select household_id from public.entitlements where source = 'tester' $$,
  'and cannot read its unlock (not her household)');

select pg_temp.as_postgres();
select is(pg_temp.grant_('4300000000000004', '00000000-0000-0000-0000-0000000043d1', (select id from hd)),
  '{"outcome": "granted", "already_unlocked": true, "household_gone": false, "internal": true}'::jsonb,
  'a tester''s purchase is internal, and her household was unlocked already');
select is((public.purchase_revoke('apple', '4300000000000004', now(), 'com.hummlist.app.lifetime', 'lifetime', 'Sandbox', null)) ->> 'internal',
  'true', 'so is its refund');

-- Dana moves to Cleo's household: her grant stays with Eva, like a purchase.
select pg_temp.login('00000000-0000-0000-0000-0000000043c1');
create temp table inv_c3 as select code from public.create_invite((select id from hc));
select pg_temp.login('00000000-0000-0000-0000-0000000043d1');
select is(public.preview_invite((select code from inv_c3)) - 'name',
  '{"status": "ok", "unlocked": true, "leaves_unlocked": false, "recent_purchase": false}'::jsonb,
  'Eva stays: no warning; Dana''s refunded purchase is not recent');
select is(public.accept_invite((select code from inv_c3)) ->> 'status', 'joined', 'Dana joins Cleo');
select pg_temp.as_postgres();
select is(pg_temp.unlocks((select id from hd)), 'tester', 'the tester left; her grant stays with Eva''s household');
select is(pg_temp.unlocks((select id from hc)), 'purchase', 'Cleo''s household was unlocked: no grant used there');
select is(pg_temp.grant_('4300000000000005', '00000000-0000-0000-0000-0000000043e1', (select id from hd)) ->> 'internal',
  'true', 'a purchase by anyone in a household a tester unlocked is internal');

select pg_temp.login('00000000-0000-0000-0000-0000000043d1');
select public.leave_current_household();
create temp table hd2 as select id from public.create_household('Dana neu');
select pg_temp.as_postgres();
select is(pg_temp.unlocks((select id from hd2)), '', 'her one grant is used: her new household stays locked');
update public.lifetime_testers set grants = 2 where user_id = '00000000-0000-0000-0000-0000000043d1';
select is(pg_temp.unlocks((select id from hd2)), 'tester', 'the Lead raises her count: the new household is unlocked');
select is((select used from public.lifetime_testers where user_id = '00000000-0000-0000-0000-0000000043d1'), 2,
  'both grants are counted as used; deleting a household later gives none back');
update public.lifetime_testers set grants = 0 where user_id = '00000000-0000-0000-0000-0000000043d1';
delete from public.lifetime_testers where user_id = '00000000-0000-0000-0000-0000000043d1';
select is(pg_temp.unlocks((select id from hd)) || '/' || pg_temp.unlocks((select id from hd2)), 'purchase,tester/tester',
  'used grants stay when the count is lowered or the tester is taken off the list');
select is((select count(*)::int from public.entitlements where tester = '00000000-0000-0000-0000-0000000043d1'), 0,
  'taking her off the list clears her mark on the households she unlocked (H-72)');

-- Archive ------------------------------------------------------------------------------------

select pg_temp.login('00000000-0000-0000-0000-0000000043f1');
create temp table hf as select id from public.create_household('Frank');
create temp table inv_f as select code from public.create_invite((select id from hf));
grant select on hf, inv_f to authenticated;
select pg_temp.as_postgres();
select is(pg_temp.grant_('4300000000000006', '00000000-0000-0000-0000-0000000043f1', (select id from hf)) ->> 'outcome',
  'granted', 'Frank buys');
select pg_temp.login('00000000-0000-0000-0000-0000000043c1');
create temp table inv_c4 as select code from public.create_invite((select id from hc));
select pg_temp.login('00000000-0000-0000-0000-0000000043f1');
select is(public.preview_invite((select code from inv_c4)) ->> 'leaves_unlocked', 'true',
  'Frank is the last member of an unlocked household');
select is(public.accept_invite((select code from inv_c4), true) - 'household_id',
  '{"status": "joined", "previous": "archived"}'::jsonb, 'he archives it and joins Cleo');
select is((public.archived_households() -> 0) - 'archived_at' - 'deletes_at',
  jsonb_build_object('id', (select id from hf), 'name', 'Frank', 'unlocked', true), 'he sees it archived, still unlocked');
select pg_temp.as_postgres();
select is(pg_temp.unlocks((select id from hf)), 'purchase', 'the archived household keeps its unlock');
select is(pg_temp.grant_('4300000000000006', '00000000-0000-0000-0000-0000000043f1', (select id from hc)) ->> 'outcome',
  'used_elsewhere', 'and the purchase stays its own: no restore in Cleo''s household');
select pg_temp.login('00000000-0000-0000-0000-0000000043c1');
select is(public.archived_households(), '[]'::jsonb, 'Cleo sees no archived household of his');
select is_empty($$ select id from public.households where name = 'Frank' $$, 'nor the household itself');
select is(public.unarchive_household((select id from hf), true), '{"status": "not_found"}'::jsonb,
  'and cannot re-enable it');
select is(public.preview_invite((select code from inv_f)) ->> 'status', 'invalid_invite',
  'an old invite of an archived household leads nowhere');

select pg_temp.login('00000000-0000-0000-0000-0000000043f1');
select is(public.unarchive_household((select id from hf), true), '{"status": "unarchived", "previous": "left"}'::jsonb,
  'Frank re-enables it; Cleo''s household keeps its other members');
select results_eq($$ select m.household_id, m.role from public.household_members m where m.user_id = auth.uid() $$,
  $$ values ((select id from hf), 'owner') $$, 'he is its owner again');
select is(public.archived_households(), '[]'::jsonb, 'nothing archived any more');
select pg_temp.as_postgres();
select is(pg_temp.grant_('4300000000000006', '00000000-0000-0000-0000-0000000043f1', (select id from hf)) ->> 'outcome',
  'restored', 'a restore there finds the unlock in place');

-- Only an unlocked household is archived; one without Lifetime is deleted as before.
select pg_temp.as_postgres();
delete from public.entitlements where household_id = (select id from hd2);
select pg_temp.login('00000000-0000-0000-0000-0000000043c1');
create temp table inv_c5 as select code from public.create_invite((select id from hc));
create temp table inv_c6 as select code from public.create_invite((select id from hc));
grant select on inv_c5, inv_c6 to authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000043d1');
select is(public.accept_invite((select code from inv_c5), true) - 'household_id',
  '{"status": "joined", "previous": "deleted"}'::jsonb, 'Dana''s locked household is deleted, not archived');
select is(public.archived_households(), '[]'::jsonb, 'she has nothing archived');

select pg_temp.login('00000000-0000-0000-0000-0000000043f1');
select is(public.accept_invite((select code from inv_c6), true) ->> 'previous', 'archived',
  'Frank archives his again, joining Cleo');

-- RevenueCat: claims, unknown ids, retention -------------------------------------------------------

select pg_temp.as_postgres();
create temp table rc as select public.purchase_record('apple', '4300000000000007', '4300000000000007',
  pg_temp.hmac('4300000000000007'), 'com.hummlist.app.lifetime', 'premium', 'lifetime', 'Sandbox', now(), 9.99, 'EUR', 'DE',
  (select id from hc)) as r;
select is((select r ->> 'outcome' from rc) || '/' || (select coalesce(r ->> 'buyer', 'none') from rc) || '/' || (select r ->> 'send_completed' from rc),
  'granted/none/false', 'the webhook first: recorded without a buyer, no purchase_completed yet');
select is(public.purchase_claim('00000000-0000-0000-0000-0000000043c1', (select id from hc), 'apple', '4300000000000007')
    - 'purchase',
  '{"status": "recorded", "send_completed": true}'::jsonb, 'Cleo''s claim makes her the buyer; now it is sent');
select is(public.purchase_claim('00000000-0000-0000-0000-0000000043c1', (select id from hc), 'apple', '4300000000000007'),
  '{"status": "recorded", "send_completed": false}'::jsonb, 'once');
select is(public.purchase_claim('00000000-0000-0000-0000-0000000043b1', (select id from hc), 'apple', '4300000000000007') ->> 'status',
  'taken', 'a second member''s claim doesn''t change the buyer');
select is(public.purchase_record('apple', '4300000000000008', '4300000000000008', pg_temp.hmac('4300000000000008'),
  'com.hummlist.app.lifetime', 'premium', 'lifetime', 'Sandbox', now(), 9.99, 'EUR', 'DE', gen_random_uuid()) ->> 'outcome',
  'no_household', 'an App User ID that is no household unlocks nothing');
select is((select count(*)::int from public.purchases where transaction_id = '4300000000000008'), 0, 'and records nothing');

-- Retention: Ben's deleted household (Anna & Ben) is queued; after 30 days its purchases go.
select ok(exists (select from public.revenuecat_deletions d where d.app_user_id = (select id from ha)
  and d.due_at > now() + interval '29 days'), 'the deleted household''s RevenueCat customer is queued for in 30 days');
select ok(exists (select from public.revenuecat_deletions d where d.app_user_id = (select id from hd2)),
  'a deleted household without a purchase is queued too (opening the page creates the customer)');
update public.revenuecat_deletions set due_at = now() - interval '1 minute' where app_user_id = (select id from ha);
select is((select array_agg(x) from public.revenuecat_deletions_take(10) x), array[(select id from ha)],
  'the due one is taken');
select is((select count(*)::int from public.revenuecat_deletions_take(10)), 0, 'and not again within the hour');
select public.revenuecat_deletion_done((select id from ha));
select ok(not exists (select from public.revenuecat_deletions d where d.app_user_id = (select id from ha)),
  'confirmed gone at RevenueCat, it leaves the queue');
update public.purchases set household_deleted_at = now() - interval '31 days' where bound_household = (select id from ha);
select public.purge_purchases();
select is((select count(*)::int from public.purchases where bound_household = (select id from ha)), 0,
  'after 30 days its purchases are purged');
select ok(exists (select from public.purchase_tombstones t where t.transaction_hmac = pg_temp.hmac('4300000000000001')),
  'leaving only the HMAC of each transaction');
select is(pg_temp.grant_('4300000000000001', '00000000-0000-0000-0000-0000000043c1', (select id from hc)) ->> 'outcome',
  'tombstoned', 'which never binds again, in any household');
insert into public.households (name, archived_at) values ('Orphan', now());
select public.purge_purchases();
select ok(not exists (select from public.households where name = 'Orphan'),
  'an archived household nobody can bring back is deleted');

-- Export ---------------------------------------------------------------------------------------

select pg_temp.login('00000000-0000-0000-0000-0000000043f1');
select is(
  (select jsonb_agg(h - 'archived_at' - 'id') from jsonb_array_elements(public.export_my_data() -> 'archived_households') h),
  '[{"name": "Frank"}]'::jsonb, 'Frank''s export lists his archived household');
select pg_temp.as_postgres();
insert into public.lifetime_testers (user_id, grants, note) values ('00000000-0000-0000-0000-0000000043d1', 3, 'pgTAP');
select pg_temp.login('00000000-0000-0000-0000-0000000043d1');
select is((public.export_my_data() -> 'lifetime_tester') - 'added_at' - 'used_in_households',
  '{"note": "pgTAP", "grants": 3}'::jsonb, 'a tester''s export shows her grants');
select is(public.export_my_data() -> 'lifetime_tester' -> 'used_in_households', '[]'::jsonb,
  'added again, she has no marked households: removal cleared the marks (H-72)');
select is(
  (select jsonb_agg(p -> 'belongs_to_household') from jsonb_array_elements(public.export_my_data() -> 'purchases') p),
  jsonb_build_array((select id from hd)), 'and names the household her purchase belongs to');

-- Account deletion -------------------------------------------------------------------------------

select pg_temp.as_postgres();
select is(public.delete_account('00000000-0000-0000-0000-0000000043f1'), 'kept', 'Frank deletes his account (Cleo''s household stays)');
select ok(not exists (select from public.households where id = (select id from hf)),
  'his archived household goes with it');
select is((select bound_household from public.purchases where transaction_id = '4300000000000006'), (select id from hf),
  'his purchase still names it, so it never unlocks another');
select is(public.delete_account('00000000-0000-0000-0000-0000000043d1'), 'kept', 'Dana deletes her account');
select is((select count(*)::int from public.lifetime_testers), 0, 'and leaves the tester list');
select results_eq($$ select source, tester from public.entitlements where household_id = (select id from hd) and source = 'tester' $$,
  $$ values ('tester', null::uuid) $$, 'Eva''s household keeps the unlock Dana gave it, without her');

select * from finish();
rollback;
