-- Job 51: the "Siri on this iPhone" credential: minted from the app's own session only, bound to
-- that session, capped at five, revocable, gone with the account, never a PAT elsewhere.
begin;
select plan(28);

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

create function pg_temp.auth(token text) returns setof record language sql as $$
  select user_id, household_id, kind from public.authenticate_access_token(pg_temp.hash(token));
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000051a1', 'peter51@example.com'),
  ('00000000-0000-0000-0000-0000000051b1', 'lea51@example.com'),
  ('00000000-0000-0000-0000-0000000051c1', 'carl51@example.com');
insert into auth.sessions (id, user_id) values
  ('00000000-0000-0000-0000-00000051a5a1', '00000000-0000-0000-0000-0000000051a1'),
  ('00000000-0000-0000-0000-00000051a5a2', '00000000-0000-0000-0000-0000000051a1'),
  ('00000000-0000-0000-0000-00000051b5b1', '00000000-0000-0000-0000-0000000051b1');

select pg_temp.login('00000000-0000-0000-0000-0000000051a1',
  '{"session_id": "00000000-0000-0000-0000-00000051a5a1"}');
create temp table hp as select id from public.create_household('Peter');
create temp table inv as select code from public.create_invite((select id from hp));
create temp table s1 as select * from public.create_siri_credential();
create temp table pat as select * from public.create_personal_access_token('Kurzbefehl');
grant select on hp, inv, s1, pat to authenticated;

select ok((select token ~ '^fgp_[A-Za-z0-9_-]{43}$' from s1), 'the credential has the PAT token format');
select results_eq(
  $$ select kind, name, token_hint from public.personal_access_tokens where id = (select id from s1) $$,
  $$ select 'siri'::text, 'Siri'::text, right(token, 4) from s1 $$,
  'it is a siri row named Siri with its hint, readable by its owner'
);
select is(
  (select kind from public.personal_access_tokens where id = (select id from pat)), 'pat',
  'a personal access token is kind pat'
);
select throws_ok(
  $$ select session_id from public.personal_access_tokens $$,
  '42501', null, 'the session binding is not readable by clients'
);
select throws_ok(
  $$ update public.personal_access_tokens set kind = 'pat' $$,
  '42501', null, 'the kind cannot be changed by clients'
);

select pg_temp.as_postgres();
select throws_ok(
  $$ update public.personal_access_tokens set kind = 'oauth' where id = (select id from pat) $$,
  '23514', null, 'kind is pat or siri'
);
select is(
  (select kind from public.authenticate_access_token(pg_temp.hash((select token from s1)))), 'siri',
  'the credential authenticates as kind siri'
);
select results_eq(
  $$ select user_id, household_id, kind from public.authenticate_access_token(pg_temp.hash((select token from pat))) $$,
  $$ select '00000000-0000-0000-0000-0000000051a1'::uuid, id, 'pat'::text from hp $$,
  'a PAT authenticates as kind pat'
);
select is_empty(
  $$ select * from public.authenticate_personal_access_token(pg_temp.hash((select token from s1))) $$,
  'the PAT-only lookup refuses a siri credential'
);
select is(
  (select count(*)::int from public.authenticate_personal_access_token(pg_temp.hash((select token from pat)))), 1,
  'the PAT-only lookup still takes a PAT'
);

select throws_ok(
  $$ select public.create_siri_credential() $$,
  '28000', 'not_authenticated', 'nobody signed in cannot create one'
);
set local role anon;
select throws_ok(
  $$ select public.create_siri_credential() $$,
  '42501', null, 'anon may not call it'
);
select pg_temp.login('00000000-0000-0000-0000-0000000051a1');
select throws_ok(
  $$ select public.authenticate_access_token(repeat('0', 64)) $$,
  '42501', null, 'clients cannot resolve token hashes'
);
select throws_ok(
  $$ select public.create_siri_credential() $$,
  '42501', 'session_required', 'a JWT without session_id cannot create one'
);
select pg_temp.login('00000000-0000-0000-0000-0000000051a1',
  '{"session_id": "00000000-0000-0000-0000-00000051a5a1", "client_id": "c-1"}');
select throws_ok(
  $$ select public.create_siri_credential() $$,
  '42501', 'session_required', 'an OAuth client''s token cannot create one'
);
select pg_temp.login('00000000-0000-0000-0000-0000000051c1', '{"session_id": "00000000-0000-0000-0000-00000051c5c1"}');
select throws_ok(
  $$ select public.create_siri_credential() $$,
  '42501', 'not_a_member', 'a user without a household cannot create one'
);

-- Lea, same household, cannot replace Peter's credential.
select pg_temp.login('00000000-0000-0000-0000-0000000051b1', '{"session_id": "00000000-0000-0000-0000-00000051b5b1"}');
select public.join_household((select code from inv));
create temp table l1 as select * from public.create_siri_credential((select id from s1));
grant select on l1 to authenticated;
select pg_temp.as_postgres();
select is(
  (select count(*)::int from public.authenticate_access_token(pg_temp.hash((select token from s1)))), 1,
  'p_replace leaves another user''s credential alone'
);

-- Peter replaces his credential on the same iPhone.
select pg_temp.login('00000000-0000-0000-0000-0000000051a1', '{"session_id": "00000000-0000-0000-0000-00000051a5a2"}');
create temp table s2 as select * from public.create_siri_credential((select id from s1));
grant select on s2 to authenticated;
select pg_temp.as_postgres();
select is_empty(
  $$ select * from public.authenticate_access_token(pg_temp.hash((select token from s1))) $$,
  'p_replace revokes the old credential'
);
select results_eq(
  $$ select session_id from public.personal_access_tokens where id = (select id from s2) $$,
  $$ values ('00000000-0000-0000-0000-00000051a5a2'::uuid) $$,
  'the credential is bound to the session that created it'
);

-- At most five active ones per user, the newest.
select pg_temp.login('00000000-0000-0000-0000-0000000051a1', '{"session_id": "00000000-0000-0000-0000-00000051a5a2"}');
create temp table more as
select * from public.create_siri_credential() union all select * from public.create_siri_credential()
union all select * from public.create_siri_credential() union all select * from public.create_siri_credential()
union all select * from public.create_siri_credential();
create temp table s7 as select * from public.create_siri_credential();
grant select on more, s7 to authenticated;
select is(
  (select count(*)::int from public.personal_access_tokens where kind = 'siri' and revoked_at is null), 5,
  'five active Siri credentials at most'
);
select ok(
  (select revoked_at is null from public.personal_access_tokens where id = (select id from s7)),
  'the newest is kept'
);
select ok(
  (select revoked_at is not null from public.personal_access_tokens where id = (select id from s2)),
  'the oldest is revoked'
);
select is(
  (select count(*)::int from public.personal_access_tokens where kind = 'pat' and revoked_at is null), 1,
  'PATs are not touched by the cap'
);

-- Revoking in Zugänge, like a PAT.
update public.personal_access_tokens set revoked_at = now() where id = (select id from s7);
select pg_temp.as_postgres();
select is_empty(
  $$ select * from public.authenticate_access_token(pg_temp.hash((select token from s7))) $$,
  'a revoked credential resolves to nothing'
);

-- Signing out on that iPhone deletes the session.
select is(
  (select count(*)::int from public.authenticate_access_token(pg_temp.hash((select token from l1)))), 1,
  'Lea''s credential works while her session exists'
);
delete from auth.sessions where id = '00000000-0000-0000-0000-00000051b5b1';
select is_empty(
  $$ select * from public.authenticate_access_token(pg_temp.hash((select token from l1))) $$,
  'once the session is gone, the credential resolves to nothing'
);

-- Leaving the household ends it too.
insert into auth.sessions (id, user_id) values
  ('00000000-0000-0000-0000-00000051b5b2', '00000000-0000-0000-0000-0000000051b1');
select pg_temp.login('00000000-0000-0000-0000-0000000051b1', '{"session_id": "00000000-0000-0000-0000-00000051b5b2"}');
create temp table l2 as select * from public.create_siri_credential();
grant select on l2 to authenticated;
select public.leave_current_household();
select pg_temp.as_postgres();
select is_empty(
  $$ select * from public.authenticate_access_token(pg_temp.hash((select token from l2))) $$,
  'once its user leaves the household, the credential resolves to nothing'
);

-- Account deletion takes the credentials with it.
select public.delete_account('00000000-0000-0000-0000-0000000051a1');
select is(
  (select count(*)::int from public.personal_access_tokens where user_id = '00000000-0000-0000-0000-0000000051a1'), 0,
  'deleting the account deletes its credentials'
);

select * from finish();
rollback;
