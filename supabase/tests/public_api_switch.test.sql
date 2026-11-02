-- Job 75: the public API's server switch (migration 20261102200000_public_api_switch.sql). It is off
-- after the migrations. Off, no API key can be made and api_begin answers 'disabled' for any key
-- without reading or writing anything; keys made while it was on can still be listed and revoked.
-- On, the same key works again (api.test.sql covers the API with the switch on).
begin;
select plan(15);

create function pg_temp.login(uid uuid, claims jsonb default '{}') returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    (jsonb_build_object('sub', uid, 'role', 'authenticated') || claims)::text, true);
end $$;

create function pg_temp.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

create function pg_temp.hash(token text) returns text language sql as $$
  select encode(extensions.digest(token, 'sha256'), 'hex');
$$;

create function pg_temp.begin_(token text, ip text) returns jsonb language sql as $$
  select to_jsonb(b) from public.api_begin(
    case when token is null then null else pg_temp.hash(token) end, pg_temp.hash(ip), 20, 60, 1000, 20, 600) b;
$$;

-- What a request could leave behind for this key and these addresses.
create function pg_temp.traces(p_token uuid) returns jsonb language sql as $$
  select jsonb_build_object(
    'last_used_at', (select last_used_at from public.personal_access_tokens where id = p_token),
    'buckets', (select count(*) from public.api_token_buckets where token_id = p_token),
    'days', (select count(*) from public.api_household_days d
             join public.personal_access_tokens t on t.household_id = d.household_id where t.id = p_token),
    'failures', (select count(*) from public.api_auth_failures
                 where ip_hash in (pg_temp.hash('ip-75a'), pg_temp.hash('ip-75b'))));
$$;

select is(public.app_switch('public_api'), false, 'the public API is off after the migrations');

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000075a1', 'ada75@example.com');
select pg_temp.login('00000000-0000-0000-0000-0000000075a1', '{"session_id": "00000000-0000-0000-0000-0000000075a5"}');
create temp table ha as select id from public.create_household('Ada');

select throws_ok(
  $$ select * from public.create_api_token('Home Assistant', '{read,write}') $$,
  '42501', 'api_disabled', 'off: the app cannot make an API key');
select is((select count(*)::int from public.personal_access_tokens where kind = 'api'
           and user_id = '00000000-0000-0000-0000-0000000075a1'), 0, 'and none was made');
select lives_ok(
  $$ select * from public.create_personal_access_token('Claude') $$,
  'off: an MCP token can still be made');

select pg_temp.as_postgres();
update public.app_switches set enabled = true where key = 'public_api';
select pg_temp.login('00000000-0000-0000-0000-0000000075a1', '{"session_id": "00000000-0000-0000-0000-0000000075a5"}');
create temp table ka as select * from public.create_api_token('Home Assistant', '{read,write}');
create temp table kb as select * from public.create_api_token('n8n', '{read}');
grant select on ha, ka, kb to authenticated;
select is((select count(*)::int from ka), 1, 'on: the app makes an API key');

select pg_temp.as_postgres();
update public.app_switches set enabled = false where key = 'public_api';

select is(pg_temp.begin_((select token from ka), 'ip-75a'),
  '{"outcome": "disabled", "token_id": null, "user_id": null, "household_id": null, "scopes": null,
    "rate_limit": 0, "rate_remaining": 0, "rate_reset": 0, "retry_after": null}'::jsonb,
  'off: a valid key gets disabled, with no key and no limit');
select is(pg_temp.begin_('fgp_unknown75', 'ip-75b') ->> 'outcome', 'disabled', 'off: an unknown key gets disabled');
select is(pg_temp.begin_(null, 'ip-75b') ->> 'outcome', 'disabled', 'off: no key gets disabled');
select is(pg_temp.traces((select id from ka)),
  '{"last_used_at": null, "buckets": 0, "days": 0, "failures": 0}'::jsonb,
  'off: nothing was used, taken or counted as a failure');

select pg_temp.login('00000000-0000-0000-0000-0000000075a1', '{"session_id": "00000000-0000-0000-0000-0000000075a5"}');
select is((select count(*)::int from public.personal_access_tokens where kind = 'api' and revoked_at is null), 2,
  'off: the member still sees their API keys');
update public.personal_access_tokens set revoked_at = now() where id = (select id from kb);
select isnt((select revoked_at from public.personal_access_tokens where id = (select id from kb)), null,
  'off: and can revoke one');

select pg_temp.as_postgres();
update public.app_switches set enabled = true where key = 'public_api';
select is(pg_temp.begin_((select token from ka), 'ip-75a') ->> 'outcome', 'ok', 'on again: the same key is served');
select isnt(pg_temp.traces((select id from ka)) ->> 'last_used_at', null, 'and counts as used');
select is(pg_temp.begin_((select token from kb), 'ip-75a') ->> 'outcome', 'invalid',
  'the key revoked while off stays revoked');
select is(pg_temp.begin_('fgp_unknown75', 'ip-75b') ->> 'outcome', 'invalid', 'on: an unknown key is invalid again');

select * from finish();
rollback;
