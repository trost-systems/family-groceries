-- Job 185: Premium follows the user who bought it (migration 20261112232617_per_user_premium.sql).
-- Uma buys with her user id as RevenueCat App User ID. She is in household A (with Mo) and in
-- household B (Bea's); Cy has household C. Restore, lapse and renewal follow Uma in both
-- households, Mo never sees her premium, a household id never takes her purchase over, and her
-- account's deletion starts the 30 days. Only accounts whose id went to RevenueCat (Uma, Mo, Eve) are
-- ever queued for deletion there; Cy's is not.
begin;
select plan(73);

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

-- A yearly plan [p_tx] recorded for user [p_user] (its App User ID), ending [p_days] from now.
create function pg_temp.yearly(p_tx text, p_user uuid, p_days int, p_event_at timestamptz default now())
returns jsonb language sql as $$
  select public.purchase_record_user('apple', p_tx, p_tx, pg_temp.hmac(p_tx), 'com.snacklist.app.yearly',
    'premium', 'yearly', 'Production', now() - interval '1 minute', 9.99, 'EUR', 'DE', p_user,
    p_event_at, now() + make_interval(days => p_days), true, false)
$$;

-- The same transaction reported under household [p_household]'s id (an old build, a TRANSFER).
create function pg_temp.yearly_household(p_tx text, p_household uuid, p_days int, p_event_at timestamptz)
returns jsonb language sql as $$
  select public.purchase_record('apple', p_tx, p_tx, pg_temp.hmac(p_tx), 'com.snacklist.app.yearly',
    'premium', 'yearly', 'Production', now() - interval '1 minute', 9.99, 'EUR', 'DE', p_household,
    p_event_at, now() + make_interval(days => p_days), true, false)
$$;

create function pg_temp.lifetime(p_tx text, p_user uuid) returns jsonb language sql as $$
  select public.purchase_record_user('apple', p_tx, p_tx, pg_temp.hmac(p_tx), 'com.snacklist.app.lifetime',
    'premium', 'lifetime', 'Production', now() - interval '1 minute', 29.99, 'EUR', 'DE', p_user)
$$;

create function pg_temp.premium(p_user uuid) returns text language sql as $$
  select coalesce((select source from public.user_premium(p_user)), 'none')
$$;

create function pg_temp.gate(p_household uuid, p_integration text, p_user uuid) returns text
language sql as $$
  select case when g.locked then 'locked' else 'open' end
  from public.integration_gate(p_household, p_integration, p_user) g
$$;

create function pg_temp.bound(p_tx text) returns text language sql as $$
  select coalesce(p.bound_user::text, '-') || ' / ' || coalesce(p.bound_household::text, '-')
  from public.purchases p where p.transaction_id = p_tx
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000185a1', 'uma185@example.com'),
  ('00000000-0000-0000-0000-0000000185b1', 'mo185@example.com'),
  ('00000000-0000-0000-0000-0000000185c1', 'bea185@example.com'),
  ('00000000-0000-0000-0000-0000000185d1', 'cy185@example.com'),
  ('00000000-0000-0000-0000-0000000185e1', 'eve185@example.com');

select pg_temp.login('00000000-0000-0000-0000-0000000185a1');
create temp table ha as select id from public.create_household('Uma & Mo');
create temp table inv_a as select code from public.create_invite((select id from ha));
grant select on ha, inv_a to authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000185b1');
select public.join_household((select code from inv_a));
select pg_temp.login('00000000-0000-0000-0000-0000000185c1');
create temp table hb as select id from public.create_household('Bea');
create temp table inv_b as select code from public.create_invite((select id from hb));
grant select on hb, inv_b to authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000185a1');
select public.accept_invite((select code from inv_b), p_mode => 'add');
select pg_temp.login('00000000-0000-0000-0000-0000000185d1');
create temp table hc as select id from public.create_household('Cy');
create temp table inv_c as select code from public.create_invite((select id from hc));
grant select on hc, inv_c to authenticated;
select pg_temp.as_postgres();

-- The App User ID ---------------------------------------------------------------------------------

select is(public.app_user_owner('00000000-0000-0000-0000-0000000185a1'), 'user', 'a user id names a user');
select is(public.app_user_owner((select id from ha)), 'household', 'a household id names a household');
select is(public.app_user_owner(gen_random_uuid()), null, 'any other id names nobody');

-- A purchase, and restore on a new device ---------------------------------------------------------

select is(pg_temp.yearly('185-y1', '00000000-0000-0000-0000-000000018599', 365)->>'outcome', 'no_user',
  'a purchase for an unknown user is refused');
select is(pg_temp.yearly('185-y1', '00000000-0000-0000-0000-0000000185a1', 365)
            - 'internal' - 'household_gone' - 'plan',
  jsonb_build_object('outcome', 'granted', 'already_unlocked', false, 'second_yearly', false,
    'buyer', '00000000-0000-0000-0000-0000000185a1', 'send_completed', true),
  'Uma''s yearly plan is granted to her, and she is its buyer without a claim');
select is(pg_temp.bound('185-y1'), '00000000-0000-0000-0000-0000000185a1 / -', 'it is bound to Uma, to no household');
select ok(exists (select from public.revenuecat_customers where user_id = '00000000-0000-0000-0000-0000000185a1'),
  'the purchase notes Uma as known to RevenueCat');
select is(pg_temp.premium('00000000-0000-0000-0000-0000000185a1'), 'yearly', 'Uma has premium');
select is((select count(*)::int from public.entitlements where purchase_id =
            (select id from public.purchases where transaction_id = '185-y1')), 0,
  'no household is unlocked by it');
select ok(not public.household_has_premium((select id from ha)), 'household A has no premium of its own');

select is(pg_temp.yearly('185-y1', '00000000-0000-0000-0000-0000000185a1', 365)
            - 'internal' - 'household_gone' - 'plan',
  jsonb_build_object('outcome', 'restored', 'already_unlocked', false, 'second_yearly', false,
    'buyer', '00000000-0000-0000-0000-0000000185a1', 'send_completed', false),
  'the same transaction again (restore on a new device) is restored, purchase_completed not again');
select is(pg_temp.premium('00000000-0000-0000-0000-0000000185a1'), 'yearly', 'and premium is still on');
select is((select count(*)::int from public.user_entitlements
           where user_id = '00000000-0000-0000-0000-0000000185a1'), 1, 'with one unlock row');

select is(pg_temp.lifetime('185-l1', '00000000-0000-0000-0000-0000000185a1')->>'already_unlocked', 'true',
  'Lifetime on top of an active plan is flagged as already unlocked');
select is(pg_temp.premium('00000000-0000-0000-0000-0000000185a1'), 'lifetime', 'Lifetime wins over yearly');
select is(public.purchase_revoke('apple', '185-l1', now(), 'com.snacklist.app.lifetime', 'lifetime',
            'Production', null)->>'household_id', null, 'a refund of Uma''s Lifetime names no household');
select is(pg_temp.premium('00000000-0000-0000-0000-0000000185a1'), 'yearly', 'the refund takes Lifetime away');
select ok(public.purchase_reinstate('apple', '185-l1'), 'the refund is reversed');
select is(pg_temp.premium('00000000-0000-0000-0000-0000000185a1'), 'lifetime', 'and Lifetime is back');
select is(public.purchase_revoke('apple', '185-l1', now(), 'com.snacklist.app.lifetime', 'lifetime',
            'Production', null)->>'user_id', '00000000-0000-0000-0000-0000000185a1', 'refunded again, for good');

-- Two households -------------------------------------------------------------------------------------

select pg_temp.login('00000000-0000-0000-0000-0000000185a1');
select is((select array_agg(premium_source) from public.user_entitlements), array['yearly'],
  'Uma reads her premium, whichever household she has open');
select is(public.my_yearly_plan((select id from ha)) - 'until',
  '{"subscriber": true, "renewing": true, "billing_issue": false, "elsewhere": false, "household_billed": false}'::jsonb,
  'her plan page in household A shows her plan, billed to no household');
select is(public.my_yearly_plan((select id from hb)) - 'until',
  '{"subscriber": true, "renewing": true, "billing_issue": false, "elsewhere": false, "household_billed": false}'::jsonb,
  'and in household B');
select ok((public.my_yearly_plan((select id from hb))->>'until')::timestamptz > now() + interval '364 days',
  'until the plan''s end');
select throws_ok($$ select product_id from public.user_entitlements $$, '42501', null,
  'the store details stay with the server');
select throws_ok($$ select * from public.user_premium('00000000-0000-0000-0000-0000000185a1') $$, '42501', null,
  'the rule is the server''s');
select pg_temp.login('00000000-0000-0000-0000-0000000185b1');
select is((select count(*)::int from public.user_entitlements), 0, 'Mo, in household A with her, does not see it');
select is(public.my_yearly_plan((select id from ha))->'subscriber', 'false'::jsonb, 'nor is it his plan');
select pg_temp.as_postgres();

select is(pg_temp.yearly_household('185-y1', (select id from ha), 400, now() + interval '1 second')->>'outcome',
  'used_elsewhere', 'the transaction reported under household A''s id is used elsewhere');
select is(pg_temp.bound('185-y1'), '00000000-0000-0000-0000-0000000185a1 / -', 'and stays bound to Uma');
select ok(not public.household_has_premium((select id from ha)), 'household A is not unlocked by it');
select ok((select expires_at > now() + interval '399 days' from public.user_entitlements
           where purchase_id = (select id from public.purchases where transaction_id = '185-y1')),
  'its newer period still counts for Uma');
select is(public.purchase_claim('00000000-0000-0000-0000-0000000185a1', (select id from ha), 'apple', '185-y1')->>'status',
  'elsewhere', 'an old build''s claim for household A changes nothing');

select is(pg_temp.yearly('185-h1', '00000000-0000-0000-0000-0000000185c1', 30)->>'outcome', 'granted',
  'Bea buys for herself');
select is(pg_temp.yearly_household('185-h2', (select id from hb), 30, now())->>'outcome', 'granted',
  'and an old build of hers buys for household B');
select is(pg_temp.yearly('185-h2', '00000000-0000-0000-0000-0000000185c1', 30)->>'outcome', 'used_elsewhere',
  'a household''s purchase reported under her user id stays with the household');
select is(pg_temp.bound('185-h2'), '- / ' || (select id from hb)::text, 'bound to household B as before');
select is(pg_temp.yearly('185-h1', '00000000-0000-0000-0000-0000000185a1', 30)->>'outcome', 'used_elsewhere',
  'Bea''s own purchase under Uma''s id is used elsewhere');
select is(pg_temp.bound('185-h1'), '00000000-0000-0000-0000-0000000185c1 / -', 'and stays Bea''s');

select pg_temp.login('00000000-0000-0000-0000-0000000185a1');
select public.leave_household((select id from hb), false);
select public.accept_invite((select code from inv_c), p_mode => 'add');
select pg_temp.as_postgres();
select is(pg_temp.bound('185-y1'), '00000000-0000-0000-0000-0000000185a1 / -',
  'leaving B and joining C leaves Uma''s purchase bound to her');
select is(pg_temp.premium('00000000-0000-0000-0000-0000000185a1'), 'yearly', 'with her premium');

-- Lapse -------------------------------------------------------------------------------------------

update public.app_switches set enabled = true where key = 'integration_lock';
select is(pg_temp.gate((select id from hc), 'mcp', '00000000-0000-0000-0000-0000000185a1'), 'open',
  'lock on: Uma''s premium opens MCP in household C');
select is(pg_temp.gate((select id from hc), 'mcp', '00000000-0000-0000-0000-0000000185d1'), 'locked',
  'but not for Cy, in the same household');
select is(public.purchase_lifecycle('apple', '185-y1', now() + interval '2 seconds', now() - interval '1 minute',
            false, false)->>'outcome', 'updated', 'the plan expires (EXPIRATION)');
select is(pg_temp.premium('00000000-0000-0000-0000-0000000185a1'), 'none', 'Uma has no premium after the lapse');
select is((select count(*)::int from public.user_entitlements e
           where e.user_id = '00000000-0000-0000-0000-0000000185a1' and e.expires_at < now()), 1,
  'her unlock row stays, expired');
select is(pg_temp.gate((select id from hc), 'mcp', '00000000-0000-0000-0000-0000000185a1'), 'locked',
  'MCP is locked for her');
select is(pg_temp.gate((select id from ha), 'alexa', '00000000-0000-0000-0000-0000000185a1'), 'open',
  'Alexa stays free');
select throws_ok($$ select * from public.integration_gate((select id from ha), 'prices', '00000000-0000-0000-0000-0000000185a1') $$,
  '22023', null, 'prices are no integration: never gated');
select throws_ok($$ select * from public.integration_gate((select id from ha), 'barcode', '00000000-0000-0000-0000-0000000185a1') $$,
  '22023', null, 'nor is barcode scanning');
select pg_temp.login('00000000-0000-0000-0000-0000000185a1');
insert into public.items (household_id, name) select id, 'Milch' from ha;
update public.items set status = 'bought' where household_id = (select id from ha) and name = 'Milch';
select is((select status::text from public.items where household_id = (select id from ha) and name = 'Milch'),
  'bought', 'after the lapse Uma still adds and checks off items');
select pg_temp.as_postgres();
select is(pg_temp.yearly('185-y1', '00000000-0000-0000-0000-0000000185a1', 365, now() + interval '3 seconds')->>'outcome',
  'restored', 'the plan renews (RENEWAL)');
select is(pg_temp.premium('00000000-0000-0000-0000-0000000185a1'), 'yearly', 'Uma has premium again');
select is(pg_temp.gate((select id from hc), 'mcp', '00000000-0000-0000-0000-0000000185a1'), 'open',
  'and MCP opens again');

-- Promotional premium of a user --------------------------------------------------------------------

select is(public.promotional_premium_sync_user('00000000-0000-0000-0000-0000000185b1', true, null), 'granted',
  'a promotional grant to Mo''s user id is stored');
select ok(public.user_internal('00000000-0000-0000-0000-0000000185b1'), 'and marks him internal');
select ok(exists (select from public.revenuecat_customers where user_id = '00000000-0000-0000-0000-0000000185b1'),
  'and notes him as known to RevenueCat');
select is(pg_temp.premium('00000000-0000-0000-0000-0000000185b1'), 'promotional', 'Mo has premium');
select is(public.promotional_premium_sync_user('00000000-0000-0000-0000-0000000185b1', false, null), 'removed',
  'and loses it when RevenueCat no longer grants it');

-- Account ids at RevenueCat ------------------------------------------------------------------------

set local role anon;
select throws_ok($$ select public.note_revenuecat_customer() $$, '42501', null,
  'a signed-out caller cannot note an account');
select pg_temp.login(null);
select throws_ok($$ select public.note_revenuecat_customer() $$, '28000', null,
  'nor can a session without a user');
select pg_temp.login('00000000-0000-0000-0000-0000000185e1');
select public.note_revenuecat_customer();
select public.note_revenuecat_customer();
select pg_temp.as_postgres();
select is((select count(*)::int from public.revenuecat_customers where user_id = '00000000-0000-0000-0000-0000000185e1'),
  1, 'Eve tapping Buy or Restore notes her once');

select is(pg_temp.yearly('185-c1', '00000000-0000-0000-0000-0000000185d1', 30)->>'outcome', 'granted',
  'Cy has a purchase of his own');
-- A purchase from before job 185's marker, or one RevenueCat never reported under his id.
delete from public.revenuecat_customers where user_id = '00000000-0000-0000-0000-0000000185d1';
delete from auth.users where id = '00000000-0000-0000-0000-0000000185d1';
select is((select count(*)::int from public.revenuecat_deletions where app_user_id = '00000000-0000-0000-0000-0000000185d1'),
  0, 'deleting an account RevenueCat never got queues nothing for RevenueCat');
select is((select count(*)::int from public.purchases
           where bound_user = '00000000-0000-0000-0000-0000000185d1' and user_deleted_at is not null), 1,
  'but still starts its purchases'' 30 days');

delete from auth.users where id = '00000000-0000-0000-0000-0000000185e1';
select ok((select due_at between now() + interval '29 days' and now() + interval '31 days'
           from public.revenuecat_deletions where app_user_id = '00000000-0000-0000-0000-0000000185e1'),
  'deleting Eve''s account queues her RevenueCat customer for deletion in 30 days');
select ok(not exists (select from public.revenuecat_customers where user_id = '00000000-0000-0000-0000-0000000185e1'),
  'and forgets that RevenueCat knew her');

-- Account deletion -------------------------------------------------------------------------------

update public.purchases set revoked_at = now() - interval '40 days' where transaction_id = '185-l1';
select public.purge_purchases();
select ok(exists (select from public.purchases where transaction_id = '185-l1'),
  'a refunded purchase of an existing user is kept, like a household''s');
delete from auth.users where id = '00000000-0000-0000-0000-0000000185a1';
select ok((select due_at between now() + interval '29 days' and now() + interval '31 days'
           from public.revenuecat_deletions where app_user_id = '00000000-0000-0000-0000-0000000185a1'),
  'deleting Uma''s account queues her RevenueCat customer for deletion in 30 days');
select is((select count(*)::int from public.purchases
           where bound_user = '00000000-0000-0000-0000-0000000185a1' and user_deleted_at is not null), 2,
  'and starts her purchases'' 30 days');
select ok(not exists (select from public.revenuecat_customers where user_id = '00000000-0000-0000-0000-0000000185a1'),
  'and her RevenueCat marker is gone');
update public.purchases set user_deleted_at = now() - interval '31 days'
where bound_user = '00000000-0000-0000-0000-0000000185a1';
select public.purge_purchases();
select is((select count(*)::int from public.purchases where bound_user = '00000000-0000-0000-0000-0000000185a1'), 0,
  '30 days later they are purged');
select ok(exists (select from public.purchase_tombstones where transaction_hmac = pg_temp.hmac('185-y1')),
  'and the transaction is tombstoned');

select * from finish();
rollback;
