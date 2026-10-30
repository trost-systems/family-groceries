-- Job 25: Hummlist Lifetime (migration 20261030190000_purchases.sql). Two households: Peter and Lea
-- share one, Max has his own. Peter buys; the unlock is the household's, clients only read it,
-- a transaction counts once and unlocks one household at a time, refunds take it away once.
begin;
select plan(50);

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

-- A verified Apple sandbox transaction of Lifetime, as the function records it.
create function pg_temp.grant_(p_tx text, p_user uuid, p_household uuid, p_revoked timestamptz default null)
returns text language sql as $$
  select public.purchase_grant('apple', p_tx, 'com.hummlist.app.lifetime', 'Sandbox',
    now() - interval '1 minute', p_revoked, 9.99, 'EUR', 'DE', p_user, p_household)
$$;

create function pg_temp.revoke_(p_tx text) returns jsonb language sql as $$
  select public.purchase_revoke('apple', p_tx, now(), 'com.hummlist.app.lifetime', 'Sandbox', now() - interval '1 hour')
$$;

create function pg_temp.unlocked(p_household uuid) returns int language sql as $$
  select count(*)::int from public.entitlements where household_id = p_household
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000025a1', 'peter25@example.com'),
  ('00000000-0000-0000-0000-0000000025b1', 'lea25@example.com'),
  ('00000000-0000-0000-0000-0000000025c1', 'max25@example.com');

select pg_temp.login('00000000-0000-0000-0000-0000000025a1');
create temp table hp as select id from public.create_household('Trost');
create temp table inv as select code from public.create_invite((select id from hp));
grant select on hp, inv to authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000025b1');
select public.join_household((select code from inv));
select pg_temp.login('00000000-0000-0000-0000-0000000025c1');
create temp table hm as select id from public.create_household('Max');
grant select on hm to authenticated;

-- Clients reach nothing but their household's entitlement -----------------------------------

select pg_temp.login('00000000-0000-0000-0000-0000000025a1');
select throws_ok($$ select * from public.purchases $$, '42501', null, 'clients cannot read purchases');
select throws_ok($$ select * from public.purchase_rate $$, '42501', null, 'clients cannot read purchase_rate');
select throws_ok(
  $$ insert into public.purchases (store, transaction_id, product_id, environment, purchased_at)
     values ('apple', 'x', 'com.hummlist.app.lifetime', 'Production', now()) $$,
  '42501', null, 'clients cannot write purchases');
select throws_ok(
  $$ select pg_temp.grant_('2000000000000001', auth.uid(), (select id from hp)) $$,
  '42501', null, 'clients cannot grant themselves the unlock');
select throws_ok($$ select pg_temp.revoke_('x') $$, '42501', null,
  'clients cannot revoke');
select throws_ok($$ select public.purchase_reinstate('apple', 'x') $$, '42501', null,
  'clients cannot reinstate');
select throws_ok($$ select public.purchase_take_call(auth.uid()) $$, '42501', null,
  'clients cannot take from the rate limit');
select is_empty($$ select * from public.entitlements $$, 'no unlock before a purchase');

-- Peter buys -------------------------------------------------------------------------------

select pg_temp.as_postgres();
select throws_ok(
  $$ select pg_temp.grant_('2000000000000001', '00000000-0000-0000-0000-0000000025c1', (select id from hp)) $$,
  '42501', 'not_a_member', 'a grant for a household the user is not in is refused');
select is(pg_temp.grant_('2000000000000001', '00000000-0000-0000-0000-0000000025a1', (select id from hp)),
  'granted', 'the first verification grants');
select is(pg_temp.grant_('2000000000000001', '00000000-0000-0000-0000-0000000025a1', (select id from hp)),
  'restored', 'the same transaction again (retry, double tap, restart) only restores');
select is((select count(*)::int from public.purchases where transaction_id = '2000000000000001'), 1,
  'one purchase row');
select is(pg_temp.unlocked((select id from hp)), 1, 'one unlock');

select pg_temp.login('00000000-0000-0000-0000-0000000025b1');
select results_eq(
  $$ select household_id, product_id, store, environment, granted_by from public.entitlements $$,
  $$ values ((select id from hp), 'com.hummlist.app.lifetime', 'apple', 'Sandbox', '00000000-0000-0000-0000-0000000025a1'::uuid) $$,
  'Lea sees the household''s unlock without buying');
select throws_ok($$ delete from public.entitlements $$, '42501', null, 'members cannot remove it');
select throws_ok(
  $$ update public.entitlements set household_id = household_id $$, '42501', null,
  'members cannot move it');
select throws_ok(
  $$ insert into public.entitlements (purchase_id, household_id, product_id, store)
     select gen_random_uuid(), id, 'com.hummlist.app.lifetime', 'apple' from hp $$,
  '42501', null, 'members cannot unlock themselves');
select pg_temp.login('00000000-0000-0000-0000-0000000025c1');
select is_empty($$ select * from public.entitlements $$, 'Max sees no other household''s unlock');

-- Lea restores on her phone; Max replays Peter's transaction --------------------------------

select pg_temp.as_postgres();
select is(pg_temp.grant_('2000000000000001', '00000000-0000-0000-0000-0000000025b1', (select id from hp)),
  'restored', 'the partner restoring the same purchase in the same household');
select is(pg_temp.grant_('2000000000000001', '00000000-0000-0000-0000-0000000025c1', (select id from hm)),
  'used_elsewhere', 'the purchase replayed from another household is refused');
select is(pg_temp.unlocked((select id from hm)), 0, 'and Max''s household stays locked');
select is((select user_id from public.purchases where transaction_id = '2000000000000001'),
  '00000000-0000-0000-0000-0000000025a1'::uuid, 'the buyer stays Peter');

-- Refunds ----------------------------------------------------------------------------------

select is(
  pg_temp.revoke_('2000000000000001') - 'household_id',
  jsonb_build_object('user_id', '00000000-0000-0000-0000-0000000025a1', 'product_id', 'com.hummlist.app.lifetime',
    'environment', 'Sandbox', 'price', 9.99, 'currency', 'EUR', 'country', 'DE'),
  'a refund returns what purchase_refunded needs');
select is(pg_temp.unlocked((select id from hp)), 0, 'and takes the unlock away');
select is(pg_temp.revoke_('2000000000000001'), null,
  'a second refund notification changes nothing (purchase_refunded once)');
select is(pg_temp.revoke_('2000000000000009'), null, 'a refund of a transaction never verified sends nothing');
select is(pg_temp.grant_('2000000000000009', '00000000-0000-0000-0000-0000000025a1', (select id from hp)),
  'revoked', 'but is recorded: its receipt, verified later, unlocks nothing');
select is(pg_temp.grant_('2000000000000001', '00000000-0000-0000-0000-0000000025a1', (select id from hp)),
  'revoked', 'a refunded purchase does not unlock again');
select is(pg_temp.unlocked((select id from hp)), 0, 'still locked');

select is(public.purchase_reinstate('apple', '2000000000000001'), true, 'Apple reverses the refund');
select is(pg_temp.unlocked((select id from hp)), 0, 'which unlocks nothing by itself');
select is(pg_temp.grant_('2000000000000001', '00000000-0000-0000-0000-0000000025a1', (select id from hp)),
  'restored', 'until it is restored');

select is(pg_temp.grant_('2000000000000002', '00000000-0000-0000-0000-0000000025c1', (select id from hm), now()),
  'revoked', 'a transaction the store already took back is stored, not granted');
select is(pg_temp.unlocked((select id from hm)), 0, 'Max stays locked');
select is(pg_temp.grant_('2000000000000003', '00000000-0000-0000-0000-0000000025c1', (select id from hm)),
  'granted', 'Max buys his own');
select is(pg_temp.grant_('2000000000000003', '00000000-0000-0000-0000-0000000025c1', (select id from hm), now()),
  'refunded', 'verification learning of a refund takes the unlock away');
select is(pg_temp.unlocked((select id from hm)), 0, 'Max is locked again');

-- Two purchases in one household: a refund of one keeps the other's unlock.
select is(pg_temp.grant_('2000000000000004', '00000000-0000-0000-0000-0000000025b1', (select id from hp)),
  'granted', 'Lea bought too, on her own Apple account');
select ok(pg_temp.revoke_('2000000000000004') is not null, 'her purchase is refunded');
select is(pg_temp.unlocked((select id from hp)), 1, 'Peter''s purchase keeps the household unlocked');

-- Decision 2: the unlock stays with the household ------------------------------------------

-- Peter moves to Max's household: Lea keeps the unlock, Peter can't take it along.
select pg_temp.login('00000000-0000-0000-0000-0000000025c1');
create temp table inv_m as select code from public.create_invite((select id from hm));
grant select on inv_m to authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000025a1');
select public.join_household((select code from inv_m));
select pg_temp.as_postgres();
select is(pg_temp.unlocked((select id from hp)), 1, 'the buyer left; the household keeps the unlock');
select is(pg_temp.grant_('2000000000000001', '00000000-0000-0000-0000-0000000025a1', (select id from hm)),
  'used_elsewhere', 'the buyer cannot restore it in his new household while the old one is unlocked');

-- Lea deletes her account as the last member: the household and its unlock go, so the purchase
-- may unlock Peter's new household.
select is(public.delete_account('00000000-0000-0000-0000-0000000025b1'), 'deleted', 'Lea was the last member');
select is(pg_temp.grant_('2000000000000001', '00000000-0000-0000-0000-0000000025a1', (select id from hm)),
  'restored', 'then the buyer restores it where he is now');
select is(pg_temp.unlocked((select id from hm)), 1, 'and Max''s household is unlocked');

-- Export and deletion -----------------------------------------------------------------------

select pg_temp.login('00000000-0000-0000-0000-0000000025a1');
select is(
  (select jsonb_agg(p - 'purchased_at') from jsonb_array_elements(public.export_my_data() -> 'purchases') p),
  jsonb_build_array(jsonb_build_object('store', 'apple', 'product_id', 'com.hummlist.app.lifetime',
    'transaction_id', '2000000000000001', 'environment', 'Sandbox', 'revoked_at', null, 'price', 9.99,
    'currency', 'EUR', 'country', 'DE', 'unlocks_household', (select id from hm))),
  'the buyer''s export lists his purchase and the household it unlocks');

select pg_temp.as_postgres();
select is(public.delete_account('00000000-0000-0000-0000-0000000025a1'), 'kept', 'Peter deletes his account');
select results_eq(
  $$ select p.user_id, e.granted_by, e.household_id from public.purchases p
     join public.entitlements e on e.purchase_id = p.id where p.transaction_id = '2000000000000001' $$,
  $$ values (null::uuid, null::uuid, (select id from hm)) $$,
  'his purchase loses its buyer; the household keeps the unlock');

-- Rate limit ------------------------------------------------------------------------------

select is(
  (select array_agg(public.purchase_take_call('00000000-0000-0000-0000-0000000025c1', 3)) from generate_series(1, 4)),
  array[true, true, true, false], 'three calls a minute, the fourth is refused');

select ok(
  exists (select from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'entitlements'),
  'the partner''s phone hears the unlock over Realtime');

select * from finish();
rollback;
