-- Job 80: the device label and last activity of connected apps (20261102213000_connected_app_devices.sql).
begin;
select plan(17);

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
  ('00000000-0000-0000-0000-0000000080a1', 'peter80@example.com'),
  ('00000000-0000-0000-0000-0000000080b1', 'max80@example.com');

insert into auth.oauth_clients (id, registration_type, redirect_uris, grant_types, client_name, client_type, token_endpoint_auth_method)
values
  ('00000000-0000-0000-0000-0000000080c1', 'dynamic', 'http://127.0.0.1/callback',
   'authorization_code,refresh_token', 'Cursor', 'public', 'none'),
  ('00000000-0000-0000-0000-0000000080c2', 'dynamic', 'https://claude.ai/api/mcp/auth_callback',
   'authorization_code,refresh_token', 'Claude', 'public', 'none');

-- Peter granted Cursor and Claude, Max only Cursor.
insert into auth.oauth_consents (id, user_id, client_id, scopes) values
  ('00000000-0000-0000-0000-0000000080d1', '00000000-0000-0000-0000-0000000080a1', '00000000-0000-0000-0000-0000000080c1', 'openid email'),
  ('00000000-0000-0000-0000-0000000080d2', '00000000-0000-0000-0000-0000000080a1', '00000000-0000-0000-0000-0000000080c2', 'openid email'),
  ('00000000-0000-0000-0000-0000000080d3', '00000000-0000-0000-0000-0000000080b1', '00000000-0000-0000-0000-0000000080c1', 'openid email');

-- Cursor's two sessions for Peter, refreshed a day and an hour ago; Claude has none yet.
insert into auth.sessions (id, user_id, oauth_client_id, updated_at, refreshed_at) values
  ('00000000-0000-0000-0000-0000000080e1', '00000000-0000-0000-0000-0000000080a1', '00000000-0000-0000-0000-0000000080c1',
   now() - interval '2 days', (now() - interval '1 day') at time zone 'UTC'),
  ('00000000-0000-0000-0000-0000000080e2', '00000000-0000-0000-0000-0000000080a1', '00000000-0000-0000-0000-0000000080c1',
   now() - interval '3 hours', (now() - interval '1 hour') at time zone 'UTC');

-- Clients reach the table only through the functions ------------------------------------------

select pg_temp.login('00000000-0000-0000-0000-0000000080a1');
select throws_ok($$ select * from public.oauth_app_devices $$, '42501', null,
  'clients cannot read oauth_app_devices');
select throws_ok(
  $$ insert into public.oauth_app_devices (user_id, client_id, device)
     values (auth.uid(), '00000000-0000-0000-0000-0000000080c1', 'Chrome · macOS') $$,
  '42501', null, 'clients cannot write oauth_app_devices');

-- record_oauth_device -----------------------------------------------------------------------

select lives_ok(
  $$ select public.record_oauth_device('00000000-0000-0000-0000-0000000080c1', 'Chrome · macOS') $$,
  'the app records where a grant was approved');
select lives_ok(
  $$ select public.record_oauth_device('00000000-0000-0000-0000-0000000080c1', 'Safari · iOS') $$,
  'approving again replaces the label');
select lives_ok(
  $$ select public.record_oauth_device('00000000-0000-0000-0000-0000000080c9', 'Chrome · macOS') $$,
  'a client without a grant records nothing, without an error');
select throws_ok(
  $$ select public.record_oauth_device('00000000-0000-0000-0000-0000000080c2', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36') $$,
  '23514', null, 'a whole user agent is refused');

select pg_temp.login('00000000-0000-0000-0000-0000000080a1', '00000000-0000-0000-0000-0000000080c1');
select throws_ok(
  $$ select public.record_oauth_device('00000000-0000-0000-0000-0000000080c1', 'Firefox · Linux') $$,
  '42501', null, 'a connected app cannot label itself');

select pg_temp.as_postgres();
select set_config('role', 'anon', true);
select throws_ok($$ select * from public.connected_app_details() $$, '42501', null,
  'signed out: connected_app_details is not callable');

select pg_temp.as_postgres();
select is(
  (select array_agg(d.device || '/' || d.client_id order by d.client_id) from public.oauth_app_devices d),
  array['Safari · iOS/00000000-0000-0000-0000-0000000080c1'],
  'one row: the newest label of the granted client');

-- connected_app_details ----------------------------------------------------------------------

select pg_temp.login('00000000-0000-0000-0000-0000000080a1');
select is(
  (select array_agg(c.client_id || '/' || coalesce(c.device, '-') order by c.client_id) from public.connected_app_details() c),
  array['00000000-0000-0000-0000-0000000080c1/Safari · iOS', '00000000-0000-0000-0000-0000000080c2/-'],
  'each active grant once, with its label or none');
select ok(
  (select c.last_used_at between now() - interval '61 minutes' and now() - interval '59 minutes'
   from public.connected_app_details() c where c.client_id = '00000000-0000-0000-0000-0000000080c1'),
  'last activity: the newest refresh of the client''s sessions');
select is(
  (select c.last_used_at from public.connected_app_details() c where c.client_id = '00000000-0000-0000-0000-0000000080c2'),
  null, 'no session yet: no last activity');
select is(
  (select public.export_my_data() -> 'connected_apps' -> 0 ->> 'device'),
  'Safari · iOS', 'the export carries the label');

select pg_temp.login('00000000-0000-0000-0000-0000000080b1');
select is(
  (select count(*)::int from public.connected_app_details()), 1,
  'Max sees only his own grant');
select is(
  (select c.device from public.connected_app_details() c), null,
  'and not Peter''s label for the same client');

-- The label goes with the grant -----------------------------------------------------------------

select pg_temp.as_postgres();
update auth.oauth_consents set revoked_at = now() where id = '00000000-0000-0000-0000-0000000080d1';
select is((select count(*)::int from public.oauth_app_devices), 0, 'a revoked grant takes its label');

insert into public.oauth_app_devices (user_id, client_id, device)
values ('00000000-0000-0000-0000-0000000080a1', '00000000-0000-0000-0000-0000000080c2', 'Chrome · Windows');
delete from auth.users where id = '00000000-0000-0000-0000-0000000080a1';
select is((select count(*)::int from public.oauth_app_devices), 0, 'a deleted account takes its labels');

select * from finish();
rollback;
