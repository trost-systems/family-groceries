-- Job 31: the Alexa skill's tables and functions (migration 20261030140000_alexa.sql).
begin;
select plan(33);

create function pg_temp.login(uid uuid, client text default null) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    (jsonb_build_object('sub', uid, 'role', 'authenticated')
      || case when client is null then '{}'::jsonb else jsonb_build_object('client_id', client) end)::text,
    true);
end $$;

create function pg_temp.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000031a1', 'peter31@example.com'),
  ('00000000-0000-0000-0000-0000000031b1', 'max31@example.com');

insert into auth.oauth_clients (id, registration_type, redirect_uris, grant_types, client_name, client_type, token_endpoint_auth_method)
values ('00000000-0000-0000-0000-00000000a1e1', 'dynamic', 'https://layla.amazon.com/api/skill/link/M1',
        'authorization_code,refresh_token', 'Amazon Alexa', 'confidential', 'client_secret_basic');

-- Two Alexa sessions of Peter (an older link and the current one), and his app session.
insert into auth.sessions (id, user_id, oauth_client_id) values
  ('00000000-0000-0000-0000-00000000501d', '00000000-0000-0000-0000-0000000031a1', '00000000-0000-0000-0000-00000000a1e1'),
  ('00000000-0000-0000-0000-00000000502e', '00000000-0000-0000-0000-0000000031a1', '00000000-0000-0000-0000-00000000a1e1'),
  ('00000000-0000-0000-0000-00000000a99a', '00000000-0000-0000-0000-0000000031a1', null),
  ('00000000-0000-0000-0000-00000000b01d', '00000000-0000-0000-0000-0000000031b1', '00000000-0000-0000-0000-00000000a1e1');

-- Clients reach nothing of it ----------------------------------------------------------------

select pg_temp.login('00000000-0000-0000-0000-0000000031a1');
select public.create_household('Peter');

select throws_ok($$ select * from public.alexa_links $$, '42501', null, 'clients cannot read alexa_links');
select throws_ok($$ select * from public.alexa_rate $$, '42501', null, 'clients cannot read alexa_rate');
select throws_ok($$ select * from public.analytics_consents $$, '42501', null,
  'clients cannot read analytics_consents');
select throws_ok(
  $$ insert into public.analytics_consents (user_id, install_id, consent)
     values (auth.uid(), gen_random_uuid(), true) $$,
  '42501', null, 'clients write their answer only through the RPC');
select throws_ok(
  $$ select public.alexa_take_adds('00000000-0000-0000-0000-0000000031a1', 1) $$,
  '42501', null, 'clients cannot take from the rate limit');
select throws_ok(
  $$ select public.alexa_revoke(repeat('a', 64)) $$,
  '42501', null, 'clients cannot revoke Alexa links');
select throws_ok(
  $$ select public.alexa_remember(repeat('a', 64), auth.uid(), gen_random_uuid()) $$,
  '42501', null, 'clients cannot write Alexa links');

-- record_analytics_consent --------------------------------------------------------------------

select lives_ok(
  $$ select public.record_analytics_consent('00000000-0000-4000-8000-0000000000f1', true) $$,
  'a signed-in user records an install''s yes');
select throws_ok(
  $$ select public.record_analytics_consent('00000000-0000-4000-8000-0000000000f1', null) $$,
  '22023', null, 'an answer is yes or no');

select pg_temp.login('00000000-0000-0000-0000-0000000031a1', 'some-oauth-client');
select throws_ok(
  $$ select public.record_analytics_consent('00000000-0000-4000-8000-0000000000f1', false) $$,
  '42501', null, 'a connected app (MCP, Alexa) cannot answer for the user');

select pg_temp.as_postgres();
select set_config('role', 'anon', true);
select throws_ok(
  $$ select public.record_analytics_consent('00000000-0000-4000-8000-0000000000f1', false) $$,
  '42501', null, 'signed out: not callable');

select pg_temp.as_postgres();
update public.analytics_consents set decided_at = now() - interval '1 day';
create temp table before as select decided_at from public.analytics_consents;

select pg_temp.login('00000000-0000-0000-0000-0000000031a1');
select public.record_analytics_consent('00000000-0000-4000-8000-0000000000f1', true);
select pg_temp.as_postgres();
select is((select decided_at from public.analytics_consents), (select decided_at from before),
  'the same answer again (an app start) keeps when it was given');

select pg_temp.login('00000000-0000-0000-0000-0000000031a1');
select public.record_analytics_consent('00000000-0000-4000-8000-0000000000f2', false, true);
select pg_temp.as_postgres();
select is(
  (select install_id::text || ' ' || consent || ' ' || internal from public.analytics_consents
   where user_id = '00000000-0000-0000-0000-0000000031a1' order by decided_at desc limit 1),
  '00000000-0000-4000-8000-0000000000f2 false true',
  'a newer no on another install is the user''s answer now');

select pg_temp.login('00000000-0000-0000-0000-0000000031a1');
select throws_ok(
  $$ select public.record_analytics_consent(null, true) $$,
  '22023', null, 'a yes always names its install');
select pg_temp.as_postgres();
-- One transaction has one now(): earlier answers move back a minute.
update public.analytics_consents set decided_at = decided_at - interval '1 minute';
select pg_temp.login('00000000-0000-0000-0000-0000000031a1');
select public.record_analytics_consent(null, false, false, true);
select pg_temp.as_postgres();
select is(
  (select install_id::text || ' ' || consent from public.analytics_consents
   where user_id = '00000000-0000-0000-0000-0000000031a1' order by decided_at desc limit 1),
  '00000000-0000-0000-0000-000000000000 false',
  'a no from an install without an id is kept under the nil UUID, as the newest answer');
update public.analytics_consents set decided_at = now() - interval '2 days'
where install_id = '00000000-0000-4000-8000-0000000000f1';
select pg_temp.login('00000000-0000-0000-0000-0000000031a1');
select public.record_analytics_consent('00000000-0000-4000-8000-0000000000f1', true, false, true);
select pg_temp.as_postgres();
select is(
  (select install_id::text from public.analytics_consents
   where user_id = '00000000-0000-0000-0000-0000000031a1' order by decided_at desc limit 1),
  '00000000-0000-4000-8000-0000000000f1',
  'the same answer given again by the user (not a start) is the newest answer');

select pg_temp.login('00000000-0000-0000-0000-0000000031a1');
select public.record_analytics_consent(gen_random_uuid(), true) from generate_series(1, 25);
select pg_temp.as_postgres();
select is((select count(*)::int from public.analytics_consents
           where user_id = '00000000-0000-0000-0000-0000000031a1'), 20,
  'at most 20 installs are kept per user');

-- Rate limit ----------------------------------------------------------------------------------

select ok(public.alexa_take_adds('00000000-0000-0000-0000-0000000031a1', 30), '30 items in a minute');
select ok(not public.alexa_take_adds('00000000-0000-0000-0000-0000000031a1', 1), 'the 31st is refused');
select ok(public.alexa_take_adds('00000000-0000-0000-0000-0000000031b1', 5),
  'another user has an allowance of their own');
select is((select adds from public.alexa_rate where user_id = '00000000-0000-0000-0000-0000000031a1'), 30,
  'a refused take takes nothing');
update public.alexa_rate set window_start = now() - interval '61 seconds'
where user_id = '00000000-0000-0000-0000-0000000031a1';
select ok(public.alexa_take_adds('00000000-0000-0000-0000-0000000031a1', 1), 'a new minute, a new allowance');
select ok(not public.alexa_take_adds('00000000-0000-0000-0000-0000000031a1', 31), 'more than 30 at once never');

-- Links and revocation ------------------------------------------------------------------------

select is(public.alexa_remember(repeat('a', 64), '00000000-0000-0000-0000-0000000031a1',
  '00000000-0000-0000-0000-00000000501d'), 0, 'a request remembers the session it came with');
select is(public.alexa_remember(repeat('b', 64), '00000000-0000-0000-0000-0000000031b1',
  '00000000-0000-0000-0000-00000000b01d'), 0, 'another Alexa account, another user');
select is(public.alexa_remember(repeat('a', 64), '00000000-0000-0000-0000-0000000031a1',
  '00000000-0000-0000-0000-00000000502e', true), 1, 'linking again revokes the older session');
select is(
  (select array_agg(id::text order by id) from auth.sessions where user_id = '00000000-0000-0000-0000-0000000031a1'),
  array['00000000-0000-0000-0000-00000000502e', '00000000-0000-0000-0000-00000000a99a'],
  'the new Alexa session and the app session stay');

select pg_temp.login('00000000-0000-0000-0000-0000000031a1');
select is(jsonb_array_length(public.export_my_data() -> 'alexa_links'), 1, 'the export lists the Alexa link');
select is(jsonb_array_length(public.export_my_data() -> 'analytics_decisions'), 20,
  'the export lists the analytics answers');
select pg_temp.as_postgres();

select is(public.alexa_revoke(repeat('a', 64)), 1, 'disabling the skill revokes the Alexa session');
select is(
  (select array_agg(id::text) from auth.sessions where user_id = '00000000-0000-0000-0000-0000000031a1'),
  array['00000000-0000-0000-0000-00000000a99a'], 'the app session is never touched');
select ok(exists (select from auth.sessions where id = '00000000-0000-0000-0000-00000000b01d'),
  'another Alexa account keeps its session');

-- A session revoked elsewhere (Zugänge) is dropped from the links on the next request.
delete from auth.sessions where id = '00000000-0000-0000-0000-00000000b01d';
insert into auth.sessions (id, user_id, oauth_client_id) values
  ('00000000-0000-0000-0000-00000000b02e', '00000000-0000-0000-0000-0000000031b1', '00000000-0000-0000-0000-00000000a1e1');
select public.alexa_remember(repeat('b', 64), '00000000-0000-0000-0000-0000000031b1',
  '00000000-0000-0000-0000-00000000b02e');
select is((select count(*)::int from public.alexa_links where alexa_user_hash = repeat('b', 64)), 1,
  'stale links go');

select * from finish();
rollback;
