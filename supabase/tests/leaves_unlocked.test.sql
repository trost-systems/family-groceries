-- Job 68 (migration 20261102091002_leaves_unlocked.sql): what account deletion tells the last
-- member of an unlocked household, and what it then deletes. Uma has her own household with
-- Lifetime, Vic and Wim share one with Lifetime, Xia has one without, Yan is in none. Uma also
-- archived an unlocked household before. Job 104: Zoe's own household has a yearly plan, Ari's a
-- gifted (promotional) unlock, and Bo shares Ari's gift with Cy.
begin;
select plan(18);

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

create function pg_temp.record(p_tx text, p_household uuid) returns text language sql as $$
  select public.purchase_record('apple', p_tx, p_tx,
    encode(extensions.hmac(p_tx, 'pgTAP key', 'sha256'), 'hex'), 'com.hummlist.app.lifetime',
    'premium', 'lifetime', 'Sandbox', now() - interval '1 minute', 9.99, 'EUR', 'DE', p_household) ->> 'outcome'
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000068a1', 'uma68@example.com'),
  ('00000000-0000-0000-0000-0000000068b1', 'vic68@example.com'),
  ('00000000-0000-0000-0000-0000000068b2', 'wim68@example.com'),
  ('00000000-0000-0000-0000-0000000068c1', 'xia68@example.com'),
  ('00000000-0000-0000-0000-0000000068d1', 'yan68@example.com'),
  ('00000000-0000-0000-0000-0000000068e1', 'zoe104@example.com'),
  ('00000000-0000-0000-0000-0000000068f1', 'ari104@example.com'),
  ('00000000-0000-0000-0000-000000006801', 'bo104@example.com'),
  ('00000000-0000-0000-0000-000000006802', 'cy104@example.com');

select pg_temp.login('00000000-0000-0000-0000-0000000068a1');
create temp table h_old as select id from public.create_household('Uma alt');
select pg_temp.login('00000000-0000-0000-0000-0000000068b1');
create temp table hv as select id from public.create_household('Vic');
create temp table inv_v as select code from public.create_invite((select id from hv));
select pg_temp.login('00000000-0000-0000-0000-0000000068c1');
create temp table hx as select id from public.create_household('Xia');
select pg_temp.login('00000000-0000-0000-0000-0000000068e1');
create temp table hz as select id from public.create_household('Zoe');
select pg_temp.login('00000000-0000-0000-0000-0000000068f1');
create temp table ha as select id from public.create_household('Ari');
select pg_temp.login('00000000-0000-0000-0000-000000006801');
create temp table hb as select id from public.create_household('Bo');
create temp table inv_b as select code from public.create_invite((select id from hb));
grant select on h_old, hv, inv_v, hx, hz, ha, hb, inv_b to authenticated, anon;

select pg_temp.as_postgres();
update public.app_switches set enabled = true where key = 'household_archive';
select is(pg_temp.record('6800000000000001', (select id from h_old)), 'granted', 'Uma''s first household has Lifetime');
select is(pg_temp.record('6800000000000002', (select id from hv)), 'granted', 'Vic''s household has Lifetime');

-- Uma archives her first household and starts a second one, which gets Lifetime too.
select pg_temp.login('00000000-0000-0000-0000-0000000068a1');
select is(public.leave_current_household(true), 'archived', 'Uma archives her unlocked household');
create temp table hu as select id from public.create_household('Uma');
grant select on hu to authenticated, anon;
select pg_temp.as_postgres();
select is(pg_temp.record('6800000000000003', (select id from hu)), 'granted', 'her new household has Lifetime');
select pg_temp.login('00000000-0000-0000-0000-0000000068b2');
select public.join_household((select code from inv_v));
select pg_temp.login('00000000-0000-0000-0000-000000006802');
select public.join_household((select code from inv_b));

select pg_temp.as_postgres();
select public.purchase_record('apple', '6800000000000004', '6800000000000004',
  encode(extensions.hmac('6800000000000004', 'pgTAP key', 'sha256'), 'hex'), 'com.hummlist.app.yearly',
  'premium', 'yearly', 'Production', now() - interval '1 minute', 9.99, 'EUR', 'DE', (select id from hz),
  now(), now() + interval '300 days', true, false);
select public.promotional_premium_sync((select id from ha), true, '2100-01-01');
select public.promotional_premium_sync((select id from hb), true, null);

-- leaves_unlocked ------------------------------------------------------------------------------

select pg_temp.login('00000000-0000-0000-0000-0000000068a1');
select is(public.leaves_unlocked(), true, 'the last member of an unlocked household is warned');
select pg_temp.login('00000000-0000-0000-0000-0000000068b1');
select is(public.leaves_unlocked(), false, 'a member whose household keeps someone is not');
select pg_temp.login('00000000-0000-0000-0000-0000000068c1');
select is(public.leaves_unlocked(), false, 'nor the last member of a household without premium');
select pg_temp.login('00000000-0000-0000-0000-0000000068d1');
select is(public.leaves_unlocked(), false, 'nor someone in no household');
select pg_temp.login('00000000-0000-0000-0000-0000000068e1');
select is(public.leaves_unlocked(), true, 'the last member of a household with a yearly plan is warned');
select pg_temp.login('00000000-0000-0000-0000-0000000068f1');
select is(public.leaves_unlocked(), true, 'so is the last member of a household with a gifted unlock');
select pg_temp.login('00000000-0000-0000-0000-000000006801');
select is(public.leaves_unlocked(), false, 'a member whose gifted household keeps someone is not');
select pg_temp.as_postgres();
select public.promotional_premium_sync((select id from ha), false, null);
select pg_temp.login('00000000-0000-0000-0000-0000000068f1');
select is(public.leaves_unlocked(), false, 'nor the last member once the gift has ended');
set local role anon;
select throws_ok($$ select public.leaves_unlocked() $$, '42501', null, 'anon cannot ask');

-- Uma deletes her account: both households go, neither is archived -----------------------------

select pg_temp.as_postgres();
select is(public.delete_account('00000000-0000-0000-0000-0000000068a1'), 'deleted',
  'Uma deletes her account as the last member');
select ok(not exists (select from public.households where id = (select id from hu)),
  'her unlocked household is deleted, not archived');
select ok(not exists (select from public.households where id = (select id from h_old)),
  'the household she archived goes with her account');
select is((select count(*)::int from public.entitlements
           where household_id in ((select id from hu), (select id from h_old))), 0,
  'both Lifetime unlocks end with them');
select is((select count(*)::int from public.purchases
           where transaction_id in ('6800000000000001', '6800000000000003')
             and bound_household in ((select id from hu), (select id from h_old))), 2,
  'the purchases still name their deleted households, so they never unlock another');

select * from finish();
rollback;
