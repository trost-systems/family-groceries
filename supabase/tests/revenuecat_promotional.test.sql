-- RevenueCat promotional grants count as premium (migration 20261101143000_revenuecat_promotional.sql).
-- Rita and Rolf share a household, Sven has his own. Only the service connection stores a grant
-- (promotional_premium_sync); household_premium counts it while it runs, members read it, and a
-- deleted promo-only household is queued for RevenueCat's customer deletion.
begin;
select plan(44);

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

create function pg_temp.premium(p_household uuid) returns text language sql as $$
  select coalesce((select source || coalesce(' ' || round(extract(epoch from expires_at - now()) / 86400)::text, '')
                   from public.household_premium(p_household)), 'none')
$$;

-- RevenueCat's state for [p_household]: active for [p_days] (null: no end), or not active.
create function pg_temp.sync(p_household uuid, p_active boolean, p_days int default null) returns text
language sql as $$
  select public.promotional_premium_sync(p_household, p_active,
    case when p_days is null then null else now() + make_interval(days => p_days) end)
$$;

create function pg_temp.yearly(p_tx text, p_household uuid, p_days int) returns jsonb language sql as $$
  select public.purchase_record('apple', p_tx, p_tx, pg_temp.hmac(p_tx), 'com.hummlist.app.yearly',
    'premium', 'yearly', 'Production', now() - interval '1 minute', 9.99, 'EUR', 'DE', p_household,
    now(), now() + make_interval(days => p_days), true, false)
$$;

create function pg_temp.lifetime(p_tx text, p_household uuid) returns jsonb language sql as $$
  select public.purchase_record('apple', p_tx, p_tx, pg_temp.hmac(p_tx), 'com.hummlist.app.lifetime',
    'premium', 'lifetime', 'Production', now() - interval '1 minute', 29.99, 'EUR', 'DE', p_household)
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000050a1', 'rita50@example.com'),
  ('00000000-0000-0000-0000-0000000050b1', 'rolf50@example.com'),
  ('00000000-0000-0000-0000-0000000050c1', 'sven50@example.com');

select pg_temp.login('00000000-0000-0000-0000-0000000050a1');
create temp table hr as select id from public.create_household('Rita & Rolf');
create temp table inv as select code from public.create_invite((select id from hr));
grant select on hr, inv to authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000050b1');
select public.join_household((select code from inv));
select pg_temp.login('00000000-0000-0000-0000-0000000050c1');
create temp table hs as select id from public.create_household('Sven');
grant select on hs to authenticated;

-- Clients cannot grant or remove it -----------------------------------------------------------

select pg_temp.login('00000000-0000-0000-0000-0000000050a1');
select throws_ok($$ select public.promotional_premium_sync((select id from hr), true, null) $$, '42501', null,
  'members cannot store a promotional grant');
select throws_ok(
  $$ insert into public.entitlements (household_id, kind, source, premium_source)
     select id, 'premium', 'promotional', 'promotional' from hr $$,
  '42501', null, 'nor insert the row');
select pg_temp.as_postgres();

-- A grant with an end -------------------------------------------------------------------------

select is(pg_temp.premium((select id from hr)), 'none', 'a new household has no premium');
select is(pg_temp.sync((select id from hr), true, 30), 'granted', 'RevenueCat grants premium for 30 days');
select is(pg_temp.premium((select id from hr)), 'promotional 30', 'the household has promotional premium for 30 days');
select is(public.household_has_premium((select id from hr)), true, 'household_has_premium says yes');
select is(public.household_has_premium((select id from hs)), false, 'Sven''s household has none');
select is((select count(*)::int from public.purchases), 0, 'no purchase is written for a grant');
select is(pg_temp.sync((select id from hr), true, 30), 'unchanged', 'the same state again changes nothing');
select is((select count(*)::int from public.entitlements where source = 'promotional'), 1, 'one row per household');
select is(pg_temp.sync((select id from hr), true, 90), 'updated', 'an extended grant moves the end');
select is(pg_temp.premium((select id from hr)), 'promotional 90', 'to 90 days');

-- Members read it like any unlock, through RLS; other households see nothing.
select pg_temp.login('00000000-0000-0000-0000-0000000050b1');
select results_eq(
  $$ select kind, source, premium_source, auto_renew, round(extract(epoch from expires_at - now()) / 86400)::int
     from public.entitlements $$,
  $$ values ('premium'::text, 'promotional'::text, 'promotional'::text, null::boolean, 90) $$,
  'Rolf reads the grant and its end');
select throws_ok($$ update public.entitlements set expires_at = null $$, '42501', null, 'but cannot extend it');
select throws_ok($$ delete from public.entitlements $$, '42501', null, 'nor delete it');
select pg_temp.login('00000000-0000-0000-0000-0000000050c1');
select is((select count(*)::int from public.entitlements), 0, 'Sven reads none of it');
select pg_temp.as_postgres();

-- It ends -------------------------------------------------------------------------------------

update public.entitlements set expires_at = now() - interval '1 second' where source = 'promotional';
select is(pg_temp.premium((select id from hr)), 'none', 'an ended grant is no premium, before any event');
select is(public.household_has_premium((select id from hr)), false, 'household_has_premium says no');
select is(pg_temp.sync((select id from hr), false), 'removed', 'RevenueCat no longer grants it: the row goes');
select is((select count(*)::int from public.entitlements where source = 'promotional'), 0, 'no promotional row is left');
select is(pg_temp.sync((select id from hr), false), 'unchanged', 'again: nothing to remove');
select is(pg_temp.sync((select id from hr), true, 30), 'granted', 'granted again');
select is(public.promotional_premium_sync((select id from hr), true, now() - interval '1 day'), 'removed',
  'an end in the past is no grant');
select is(pg_temp.sync((select id from hr), true, 30), 'granted', 'granted once more');
select is(pg_temp.sync((select id from hr), false), 'removed', 'and revoked');
select is(public.household_has_premium((select id from hr)), false, 'revoked: no premium');

-- Without end, and next to purchases -----------------------------------------------------------

select is(pg_temp.sync((select id from hr), true), 'granted', 'a grant without end');
select is(pg_temp.premium((select id from hr)), 'promotional', 'is lasting premium');
select is(pg_temp.yearly('p1', (select id from hr), 365) ->> 'outcome', 'granted', 'a yearly plan next to it');
select is(pg_temp.premium((select id from hr)), 'promotional', 'the endless grant still names it');
select is(pg_temp.sync((select id from hr), true, 30), 'updated', 'the grant now ends in 30 days');
select is(pg_temp.premium((select id from hr)), 'yearly 365', 'the yearly plan ends later: it names premium');
select is(pg_temp.sync((select id from hr), true, 400), 'updated', 'the grant ends after the plan');
select is(pg_temp.premium((select id from hr)), 'promotional 400', 'so it names premium, with its end');
select is(pg_temp.lifetime('p2', (select id from hr)) ->> 'outcome', 'granted', 'Lifetime is bought');
select is(pg_temp.premium((select id from hr)), 'lifetime', 'Lifetime beats every grant');

-- The row's rules -----------------------------------------------------------------------------

select throws_ok(
  $$ insert into public.entitlements (household_id, kind, source, premium_source, expires_at)
     select id, 'premium', 'promotional', 'promotional', null::timestamptz from hs union all
     select id, 'premium', 'promotional', 'promotional', null::timestamptz from hs $$,
  '23505', null, 'never two promotional rows for one household');
select throws_ok(
  $$ insert into public.entitlements (household_id, kind, source, premium_source, store)
     select id, 'premium', 'promotional', 'promotional', 'apple' from hs $$,
  '23514', null, 'a grant has no store');
select throws_ok(
  $$ insert into public.entitlements (household_id, kind, source, premium_source, expires_at)
     select id, 'premium', 'tester', 'promotional', null from hs $$,
  '23514', null, 'source and premium_source agree');
select throws_ok(
  $$ insert into public.entitlements (household_id, kind, source, premium_source, expires_at)
     select id, 'premium', 'tester', 'tester_grant', now() + interval '1 day' from hs $$,
  '23514', null, 'a tester grant still has no end');
select is(public.promotional_premium_sync(gen_random_uuid(), true, null), 'no_household',
  'an App User ID that is no household stores nothing');

-- Deletion: a promo-only household is queued for RevenueCat's customer deletion ---------------

select is(pg_temp.sync((select id from hs), true), 'granted', 'Sven''s household gets a grant, and buys nothing');
delete from public.households where id = (select id from hs);
select ok(exists (select from public.revenuecat_deletions d where d.app_user_id = (select id from hs)
  and d.due_at > now() + interval '29 days'), 'deleting it queues its RevenueCat customer for in 30 days');
select is((select count(*)::int from public.entitlements e where e.household_id = (select id from hs)), 0,
  'and its grant row is gone with it');

select * from finish();
rollback;
