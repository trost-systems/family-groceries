-- Job 25, as of job 43: Hummlist Lifetime recorded from RevenueCat's webhook (purchase_record,
-- purchase_revoke, purchase_reinstate; migration 20261031123504_household_bound_lifetime.sql). Two
-- households: Peter and Lea share one, Max has his own. The unlock is the household's, clients only
-- read it, a transaction counts once and belongs to one household, refunds take it away once.
begin;
select plan(40);

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

-- RevenueCat reports a sandbox Lifetime for household [p_household] (its App User ID).
create function pg_temp.record_(p_tx text, p_household uuid) returns text language sql as $$
  select public.purchase_record('apple', p_tx, p_tx, encode(extensions.hmac(p_tx, 'pgTAP key', 'sha256'), 'hex'),
    'com.hummlist.app.lifetime', 'premium', 'lifetime', 'Sandbox', now() - interval '1 minute', 9.99, 'EUR', 'DE', p_household)
    ->> 'outcome'
$$;

create function pg_temp.revoke_(p_tx text) returns jsonb language sql as $$
  select public.purchase_revoke('apple', p_tx, now(), 'com.hummlist.app.lifetime', 'lifetime', 'Sandbox', now() - interval '1 hour')
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

-- Clients reach nothing but their household's unlock ------------------------------------------

select pg_temp.login('00000000-0000-0000-0000-0000000025a1');
select throws_ok($$ select * from public.purchases $$, '42501', null, 'clients cannot read purchases');
select throws_ok($$ select * from public.purchase_rate $$, '42501', null, 'clients cannot read purchase_rate');
select throws_ok($$ select * from public.purchase_claims $$, '42501', null, 'clients cannot read claims');
select throws_ok($$ select * from public.revenuecat_events $$, '42501', null, 'clients cannot read webhook ids');
select throws_ok($$ select * from public.purchase_tombstones $$, '42501', null, 'clients cannot read tombstones');
select throws_ok($$ select * from public.revenuecat_deletions $$, '42501', null, 'clients cannot read the deletion queue');
select throws_ok(
  $$ insert into public.purchases (store, transaction_id, product_id, environment, purchased_at)
     values ('apple', 'x', 'com.hummlist.app.lifetime', 'Production', now()) $$,
  '42501', null, 'clients cannot write purchases');
select throws_ok($$ select pg_temp.record_('2000000000000001', (select id from hp)) $$, '42501', null,
  'clients cannot record a purchase');
select throws_ok($$ select pg_temp.revoke_('x') $$, '42501', null, 'clients cannot revoke');
select throws_ok($$ select public.purchase_reinstate('apple', 'x') $$, '42501', null, 'clients cannot reinstate');
select throws_ok($$ select public.purge_purchases() $$, '42501', null, 'clients cannot purge');
select throws_ok($$ select public.purchase_take_call(auth.uid()) $$, '42501', null,
  'clients cannot take from the rate limit');
select is_empty($$ select household_id from public.entitlements $$, 'no unlock before a purchase');

-- Peter buys -------------------------------------------------------------------------------

select pg_temp.as_postgres();
select is(pg_temp.record_('2000000000000001', (select id from hp)), 'granted', 'the first record grants');
select is(pg_temp.record_('2000000000000001', (select id from hp)), 'restored',
  'the same transaction again (a webhook retry) only restores');
select is((select count(*)::int from public.purchases where transaction_id = '2000000000000001'), 1, 'one purchase row');
select is(pg_temp.unlocked((select id from hp)), 1, 'one unlock');

select pg_temp.login('00000000-0000-0000-0000-0000000025b1');
select results_eq(
  $$ select household_id, product_id, store, environment, kind from public.entitlements $$,
  $$ values ((select id from hp), 'com.hummlist.app.lifetime', 'apple', 'Sandbox', 'premium') $$,
  'Lea sees the household''s unlock without buying');
select throws_ok($$ select granted_by from public.entitlements $$, '42501', null, 'but not who bought it (H-55)');
select throws_ok($$ delete from public.entitlements $$, '42501', null, 'members cannot remove it');
select throws_ok($$ update public.entitlements set household_id = household_id $$, '42501', null,
  'members cannot move it');
select throws_ok(
  $$ insert into public.entitlements (purchase_id, household_id, product_id, store, environment)
     select gen_random_uuid(), id, 'com.hummlist.app.lifetime', 'apple', 'Sandbox' from hp $$,
  '42501', null, 'members cannot unlock themselves');
select pg_temp.login('00000000-0000-0000-0000-0000000025c1');
select is_empty($$ select household_id from public.entitlements $$, 'Max sees no other household''s unlock');

-- The same transaction for Max's household (a transfer, a replay): refused ------------------

select pg_temp.as_postgres();
select is(pg_temp.record_('2000000000000001', (select id from hm)), 'used_elsewhere',
  'the purchase reported for another household is refused');
select is(pg_temp.unlocked((select id from hm)), 0, 'and Max''s household stays locked');

-- Refunds ----------------------------------------------------------------------------------

select is(pg_temp.revoke_('2000000000000001') - 'household_id' - 'user_id',
  jsonb_build_object('product_id', 'com.hummlist.app.lifetime', 'plan', 'lifetime', 'environment', 'Sandbox',
    'price', 9.99, 'currency', 'EUR', 'country', 'DE', 'internal', false),
  'a refund returns what purchase_refunded needs');
select is(pg_temp.unlocked((select id from hp)), 0, 'and takes the unlock away');
select is(pg_temp.revoke_('2000000000000001'), null, 'a second refund changes nothing (purchase_refunded once)');
select is(pg_temp.revoke_('2000000000000009'), null, 'a refund of a transaction never recorded sends nothing');
select is(pg_temp.record_('2000000000000009', (select id from hp)), 'revoked',
  'but is kept: its purchase, reported later, unlocks nothing');
select is(pg_temp.record_('2000000000000001', (select id from hp)), 'revoked', 'a refunded purchase does not unlock again');

select is(public.purchase_reinstate('apple', '2000000000000001'), true, 'the store reverses the refund');
select is(pg_temp.unlocked((select id from hp)), 1, 'which unlocks its own household again');

-- Two purchases in one household: a refund of one keeps the other's unlock.
select is(pg_temp.record_('2000000000000004', (select id from hp)), 'granted', 'Lea bought too, on her own Apple account');
select ok(pg_temp.revoke_('2000000000000004') is not null, 'her purchase is refunded');
select is(pg_temp.unlocked((select id from hp)), 1, 'Peter''s purchase keeps the household unlocked');

-- The buyer leaves; the unlock stays ----------------------------------------------------------

select pg_temp.login('00000000-0000-0000-0000-0000000025c1');
create temp table inv_m as select code from public.create_invite((select id from hm));
grant select on inv_m to authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000025a1');
select public.join_household((select code from inv_m));
select pg_temp.as_postgres();
select is(pg_temp.unlocked((select id from hp)), 1, 'the buyer left; the household keeps the unlock');
select is(pg_temp.record_('2000000000000001', (select id from hm)), 'used_elsewhere',
  'and it never unlocks his new household');

-- Rate limit and Realtime ----------------------------------------------------------------------

select is(
  (select array_agg(public.purchase_take_call('00000000-0000-0000-0000-0000000025c1', 3)) from generate_series(1, 4)),
  array[true, true, true, false], 'three claims a minute, the fourth is refused');

select ok(
  exists (select from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'entitlements'),
  'the partner''s phone hears the unlock over Realtime');

select * from finish();
rollback;
