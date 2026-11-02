-- Job 31: the Alexa skill's tables and functions (migration 20261030140000_alexa.sql).
begin;
select plan(69);

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
-- The nil UUID's answer is from now() too: a minute back, so the next answer is the only newest.
update public.analytics_consents set decided_at = decided_at - interval '1 minute'
where install_id = '00000000-0000-0000-0000-000000000000';
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

-- A session revoked elsewhere (Zugänge) takes its link with it.
delete from auth.sessions where id = '00000000-0000-0000-0000-00000000b01d';
insert into auth.sessions (id, user_id, oauth_client_id) values
  ('00000000-0000-0000-0000-00000000b02e', '00000000-0000-0000-0000-0000000031b1', '00000000-0000-0000-0000-00000000a1e1');
select public.alexa_remember(repeat('b', 64), '00000000-0000-0000-0000-0000000031b1',
  '00000000-0000-0000-0000-00000000b02e');
select is((select count(*)::int from public.alexa_links where alexa_user_hash = repeat('b', 64)), 1,
  'stale links go');

-- Retention (migration 20261102093000_alexa_cleanup.sql) -------------------------------------
-- Job 72: Lea, Jan and Ida; Amazon Alexa (above) and an MCP app, which none of this touches even
-- when it calls itself "Amazon Alexa".
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000072a1', 'lea72@example.com'),
  ('00000000-0000-0000-0000-0000000072b1', 'jan72@example.com'),
  ('00000000-0000-0000-0000-0000000072d1', 'ida72@example.com');
insert into auth.oauth_clients (id, registration_type, redirect_uris, grant_types, client_name, client_type, token_endpoint_auth_method)
values ('00000000-0000-0000-0000-00000000c0de', 'dynamic', 'https://claude.ai/api/mcp/auth_callback',
        'authorization_code,refresh_token', 'Amazon Alexa', 'public', 'none');

create function pg_temp.consent(uid uuid, client uuid, granted interval default '0') returns void
language sql as $$
  insert into auth.oauth_consents (id, user_id, client_id, scopes, granted_at)
  values (gen_random_uuid(), uid, client, 'openid', now() - granted)
$$;

create function pg_temp.consents(uid uuid, client uuid) returns int language sql as $$
  select count(*)::int from auth.oauth_consents where user_id = uid and client_id = client
$$;

-- Each Amazon host scripts/alexa-oauth-client.sh registers is found on its own.
insert into auth.oauth_clients (id, registration_type, redirect_uris, grant_types, client_name, client_type, token_endpoint_auth_method)
select ('00000000-0000-0000-0000-0000000072' || n || '0')::uuid, 'dynamic', 'https://' || host || '/api/skill/link/M1',
       'authorization_code,refresh_token', 'host ' || n, 'confidential', 'client_secret_basic'
from (values ('a', 'pitangui.amazon.com'), ('b', 'layla.amazon.com'), ('c', 'alexa.amazon.co.jp')) h (n, host);
select is((select count(*)::int from public.alexa_client_ids() c where c::text like '%72_0'), 3,
  'pitangui (US), layla (EU) and alexa.amazon.co.jp (FE) each make an Alexa client');
delete from auth.oauth_clients where id::text like '%0000000072_0';

select is(
  (select array_agg(c order by c) from public.alexa_client_ids() c),
  array['00000000-0000-0000-0000-00000000a1e1'::uuid],
  'Amazon''s account linking redirect makes the Alexa client, not the name');

-- "Amazon Alexa trennen": GoTrue revokes the grant and deletes the client's sessions.
insert into auth.sessions (id, user_id, oauth_client_id) values
  ('00000000-0000-0000-0000-0000000072a2', '00000000-0000-0000-0000-0000000072a1', '00000000-0000-0000-0000-00000000a1e1'),
  ('00000000-0000-0000-0000-0000000072a3', '00000000-0000-0000-0000-0000000072a1', null);
select pg_temp.consent('00000000-0000-0000-0000-0000000072a1', '00000000-0000-0000-0000-00000000a1e1');
select public.alexa_remember(repeat('c', 64), '00000000-0000-0000-0000-0000000072a1',
  '00000000-0000-0000-0000-0000000072a2');
select public.alexa_take_adds('00000000-0000-0000-0000-0000000072a1', 3);

update auth.oauth_consents set revoked_at = now()
where user_id = '00000000-0000-0000-0000-0000000072a1' and client_id = '00000000-0000-0000-0000-00000000a1e1';
select lives_ok(
  $$ delete from auth.sessions
     where user_id = '00000000-0000-0000-0000-0000000072a1'
       and oauth_client_id = '00000000-0000-0000-0000-00000000a1e1' $$,
  'the client''s sessions delete as before');
select ok(not exists (select from public.alexa_links where user_id = '00000000-0000-0000-0000-0000000072a1'),
  'trennen: the link goes with the session, right away');
select ok(not exists (select from public.alexa_rate where user_id = '00000000-0000-0000-0000-0000000072a1'),
  'trennen: the counter goes with the user''s last link');
select ok(exists (select from auth.sessions where id = '00000000-0000-0000-0000-0000000072a3'),
  'trennen: the app session stays');
select is(pg_temp.consents('00000000-0000-0000-0000-0000000072a1', '00000000-0000-0000-0000-00000000a1e1'), 1,
  'trennen: GoTrue keeps the revoked grant until the daily job');

-- Disabling the skill (AlexaSkillEvent.SkillDisabled).
insert into auth.sessions (id, user_id, oauth_client_id) values
  ('00000000-0000-0000-0000-0000000072b2', '00000000-0000-0000-0000-0000000072b1', '00000000-0000-0000-0000-00000000a1e1'),
  ('00000000-0000-0000-0000-0000000072b3', '00000000-0000-0000-0000-0000000072b1', '00000000-0000-0000-0000-00000000c0de');
select pg_temp.consent('00000000-0000-0000-0000-0000000072b1', '00000000-0000-0000-0000-00000000a1e1');
select pg_temp.consent('00000000-0000-0000-0000-0000000072b1', '00000000-0000-0000-0000-00000000c0de');
select public.alexa_remember(repeat('d', 64), '00000000-0000-0000-0000-0000000072b1',
  '00000000-0000-0000-0000-0000000072b2');
select public.alexa_take_adds('00000000-0000-0000-0000-0000000072b1', 3);

select is(public.alexa_revoke(repeat('d', 64)), 1, 'disabling revokes Jan''s Alexa session');
select ok(not exists (select from public.alexa_links where user_id = '00000000-0000-0000-0000-0000000072b1'),
  'disabling: the link goes');
select ok(not exists (select from public.alexa_rate where user_id = '00000000-0000-0000-0000-0000000072b1'),
  'disabling: the counter goes');
select is(pg_temp.consents('00000000-0000-0000-0000-0000000072b1', '00000000-0000-0000-0000-00000000a1e1'), 0,
  'disabling: the grant goes, so Zugänge no longer lists Amazon Alexa');
select is(pg_temp.consents('00000000-0000-0000-0000-0000000072b1', '00000000-0000-0000-0000-00000000c0de'), 1,
  'disabling: another app''s grant stays');
select ok(exists (select from auth.sessions where id = '00000000-0000-0000-0000-0000000072b3'),
  'disabling: another app''s session stays');

-- A second Alexa account of the same user keeps the grant and the counter when one is disabled.
insert into auth.sessions (id, user_id, oauth_client_id) values
  ('00000000-0000-0000-0000-0000000072b4', '00000000-0000-0000-0000-0000000072b1', '00000000-0000-0000-0000-00000000a1e1'),
  ('00000000-0000-0000-0000-0000000072b5', '00000000-0000-0000-0000-0000000072b1', '00000000-0000-0000-0000-00000000a1e1');
select pg_temp.consent('00000000-0000-0000-0000-0000000072b1', '00000000-0000-0000-0000-00000000a1e1');
select public.alexa_remember(repeat('e', 64), '00000000-0000-0000-0000-0000000072b1',
  '00000000-0000-0000-0000-0000000072b4');
select public.alexa_remember(repeat('f', 64), '00000000-0000-0000-0000-0000000072b1',
  '00000000-0000-0000-0000-0000000072b5');
select public.alexa_take_adds('00000000-0000-0000-0000-0000000072b1', 3);
select public.alexa_revoke(repeat('e', 64));
select is(pg_temp.consents('00000000-0000-0000-0000-0000000072b1', '00000000-0000-0000-0000-00000000a1e1'), 1,
  'the other Alexa account keeps the grant');
select ok(exists (select from public.alexa_rate where user_id = '00000000-0000-0000-0000-0000000072b1'),
  'and the counter');
select is(public.alexa_remember(repeat('f', 64), '00000000-0000-0000-0000-0000000072b1',
  '00000000-0000-0000-0000-0000000072b5', true), 0, 'linking again, nothing older to revoke');
select is(pg_temp.consents('00000000-0000-0000-0000-0000000072b1', '00000000-0000-0000-0000-00000000a1e1'), 1,
  'linking again keeps the grant');

-- The daily job.
select pg_temp.login('00000000-0000-0000-0000-0000000072a1');
select throws_ok($$ select public.purge_alexa() $$, '42501', null, 'clients cannot run the job');
select pg_temp.as_postgres();
select is((select schedule || ' ' || command from cron.job where jobname = 'purge-alexa'),
  '29 3 * * * select public.purge_alexa()', 'the job runs daily');

-- (a) a link whose session went before the trigger existed.
insert into public.alexa_links (alexa_user_hash, session_id, user_id) values
  (repeat('9', 64), '00000000-0000-0000-0000-0000000072b9', '00000000-0000-0000-0000-0000000072b1');
-- (b) Jan's counter is from two minutes ago; Peter's (above, with a live link) is this minute's.
update public.alexa_rate set window_start = now() - interval '2 minutes'
where user_id = '00000000-0000-0000-0000-0000000072b1';
insert into public.alexa_rate (user_id, window_start, adds) values
  ('00000000-0000-0000-0000-0000000031a1', now() - interval '50 seconds', 1)
on conflict (user_id) do update set window_start = excluded.window_start;
insert into auth.sessions (id, user_id, oauth_client_id) values
  ('00000000-0000-0000-0000-0000000031a3', '00000000-0000-0000-0000-0000000031a1', '00000000-0000-0000-0000-00000000a1e1');
select public.alexa_remember(repeat('a', 64), '00000000-0000-0000-0000-0000000031a1',
  '00000000-0000-0000-0000-0000000031a3');
-- (c) Lea: an Alexa session whose last request was 13 months ago, one without a link refreshed
-- 13 months ago, one created 13 months ago but used today, one whose link is 13 months old but
-- which Alexa refreshed today (a request whose link update failed); an MCP session 13 months old.
insert into auth.sessions (id, user_id, oauth_client_id, created_at, updated_at, refreshed_at) values
  ('00000000-0000-0000-0000-0000000072c1', '00000000-0000-0000-0000-0000000072a1', '00000000-0000-0000-0000-00000000a1e1',
   now() - interval '14 months', now() - interval '14 months', (now() - interval '13 months') at time zone 'UTC'),
  ('00000000-0000-0000-0000-0000000072c2', '00000000-0000-0000-0000-0000000072a1', '00000000-0000-0000-0000-00000000a1e1',
   now() - interval '14 months', now() - interval '14 months', (now() - interval '13 months') at time zone 'UTC'),
  ('00000000-0000-0000-0000-0000000072c3', '00000000-0000-0000-0000-0000000072a1', '00000000-0000-0000-0000-00000000a1e1',
   now() - interval '14 months', now() - interval '14 months', (now() - interval '13 months') at time zone 'UTC'),
  ('00000000-0000-0000-0000-0000000072c4', '00000000-0000-0000-0000-0000000072a1', '00000000-0000-0000-0000-00000000c0de',
   now() - interval '14 months', now() - interval '14 months', null),
  ('00000000-0000-0000-0000-0000000072c5', '00000000-0000-0000-0000-0000000072a1', '00000000-0000-0000-0000-00000000a1e1',
   now() - interval '14 months', now() - interval '14 months', now() at time zone 'UTC');
insert into public.alexa_links (alexa_user_hash, session_id, user_id, last_seen) values
  (repeat('1', 64), '00000000-0000-0000-0000-0000000072c1', '00000000-0000-0000-0000-0000000072a1', now() - interval '13 months'),
  (repeat('3', 64), '00000000-0000-0000-0000-0000000072c3', '00000000-0000-0000-0000-0000000072a1', now()),
  (repeat('5', 64), '00000000-0000-0000-0000-0000000072c5', '00000000-0000-0000-0000-0000000072a1', now() - interval '13 months');
-- Grants without a session: Max's Alexa grant from two days ago, one given a moment ago (a link
-- in progress), and Max's MCP grant.
select pg_temp.consent('00000000-0000-0000-0000-0000000031b1', '00000000-0000-0000-0000-00000000a1e1', '2 days');
select pg_temp.consent('00000000-0000-0000-0000-0000000072d1', '00000000-0000-0000-0000-00000000a1e1');
-- Ole: an old grant GoTrue reuses (auto-approve) for a link in progress.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000072e1', 'ole72@example.com');
select pg_temp.consent('00000000-0000-0000-0000-0000000072e1', '00000000-0000-0000-0000-00000000a1e1', '3 months');
insert into auth.oauth_authorizations (id, authorization_id, client_id, user_id, redirect_uri, scope,
  response_type, status, created_at, expires_at)
values (gen_random_uuid(), 'e2e-72', '00000000-0000-0000-0000-00000000a1e1', '00000000-0000-0000-0000-0000000072e1',
  'https://layla.amazon.com/api/skill/link/M1', 'openid', 'code', 'approved', now(), now() + interval '10 minutes');
select pg_temp.consent('00000000-0000-0000-0000-0000000031a1', '00000000-0000-0000-0000-00000000c0de', '2 days');
delete from auth.sessions where user_id = '00000000-0000-0000-0000-0000000031b1';

-- Legal Review ADDENDUM 2: Uwe's only Alexa connection went unused for 12 months (unlinked only
-- in the Alexa app). His counter is from this minute, so only the link's end can take it.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000072f1', 'uwe72@example.com');
insert into auth.sessions (id, user_id, oauth_client_id, created_at, updated_at, refreshed_at) values
  ('00000000-0000-0000-0000-0000000072f2', '00000000-0000-0000-0000-0000000072f1', '00000000-0000-0000-0000-00000000a1e1',
   now() - interval '14 months', now() - interval '14 months', (now() - interval '13 months') at time zone 'UTC');
insert into public.alexa_links (alexa_user_hash, session_id, user_id, last_seen) values
  (repeat('7', 64), '00000000-0000-0000-0000-0000000072f2', '00000000-0000-0000-0000-0000000072f1', now() - interval '13 months');
insert into public.alexa_rate (user_id, window_start, adds) values ('00000000-0000-0000-0000-0000000072f1', now(), 2);
select pg_temp.consent('00000000-0000-0000-0000-0000000072f1', '00000000-0000-0000-0000-00000000a1e1', '14 months');

create temp table purged as select public.purge_alexa() as n;

select ok(not exists (select from public.alexa_links where session_id = '00000000-0000-0000-0000-0000000072b9'),
  '(a) a link without its session goes');
select ok(exists (select from public.alexa_links where session_id = '00000000-0000-0000-0000-0000000072b5'),
  '(a) a link with its session stays');
select ok(not exists (select from public.alexa_rate where user_id = '00000000-0000-0000-0000-0000000072b1'),
  '(b) a counter of a past minute goes');
select ok(exists (select from public.alexa_rate where user_id = '00000000-0000-0000-0000-0000000031a1'),
  '(b) this minute''s counter stays');
select is(
  (select array_agg(id order by id) from auth.sessions
   where user_id = '00000000-0000-0000-0000-0000000072a1' and id::text like '%72c%'),
  array['00000000-0000-0000-0000-0000000072c3', '00000000-0000-0000-0000-0000000072c4',
        '00000000-0000-0000-0000-0000000072c5']::uuid[],
  '(c) Alexa sessions unused for 12 months go; those used today and the MCP session stay');
select is(
  (select array_agg(alexa_user_hash order by alexa_user_hash) from public.alexa_links
   where user_id = '00000000-0000-0000-0000-0000000072a1'),
  array[repeat('3', 64), repeat('5', 64)],
  '(c) the link unused for 12 months goes; a refreshed session keeps its link, so disabling still revokes it');
select is(pg_temp.consents('00000000-0000-0000-0000-0000000072a1', '00000000-0000-0000-0000-00000000a1e1'), 0,
  'the grant revoked in Zugänge goes');
select is(pg_temp.consents('00000000-0000-0000-0000-0000000031b1', '00000000-0000-0000-0000-00000000a1e1'), 0,
  'an Alexa grant without a session goes');
select is(pg_temp.consents('00000000-0000-0000-0000-0000000072d1', '00000000-0000-0000-0000-00000000a1e1'), 1,
  'an Alexa grant given a moment ago (its session still to come) stays');
select is(pg_temp.consents('00000000-0000-0000-0000-0000000072e1', '00000000-0000-0000-0000-00000000a1e1'), 1,
  'an old grant reused for a link in progress stays');
select is(pg_temp.consents('00000000-0000-0000-0000-0000000031a1', '00000000-0000-0000-0000-00000000c0de'), 1,
  'another app''s grant without a session stays');
select ok(not exists (select from auth.sessions where user_id = '00000000-0000-0000-0000-0000000072f1'),
  '12 months unused: Uwe''s Alexa session goes');
select ok(not exists (select from public.alexa_links where user_id = '00000000-0000-0000-0000-0000000072f1'),
  '12 months unused: and his Alexa link');
select is(pg_temp.consents('00000000-0000-0000-0000-0000000072f1', '00000000-0000-0000-0000-00000000a1e1'), 0,
  '12 months unused: and the grant, so Zugänge no longer lists Amazon Alexa, in the same run');
select ok(not exists (select from public.alexa_rate where user_id = '00000000-0000-0000-0000-0000000072f1'),
  '12 months unused: and his counter');
select is((select n from purged), 8, 'the job counts what it deleted (3 sessions, a link, a counter, 3 grants)');
select is(public.purge_alexa(), 0, 'a second run deletes nothing');

select * from finish();
rollback;
