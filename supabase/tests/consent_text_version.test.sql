-- Legal Review 2026-11-01, addendum 12:35: every analytics decision carries the consent text
-- version (migration 20261101123500_consent_text_version.sql).
begin;
select plan(11);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;

create function pg_temp.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c0a1', 'consent-a@example.com'),
  ('00000000-0000-0000-0000-00000000c0b1', 'consent-b@example.com');

select pg_temp.login('00000000-0000-0000-0000-00000000c0a1');

select lives_ok(
  $$ select public.record_analytics_consent('00000000-0000-4000-8000-00000000c0f1', true, false, true, '2026-11-01') $$,
  'a yes with the version is recorded');
select throws_ok(
  $$ select public.record_analytics_consent('00000000-0000-4000-8000-00000000c0f1', true, false, true, 'neu') $$,
  '22023', null, 'a malformed version is refused');
select throws_ok(
  $$ select * from public.analytics_consents $$, '42501', null,
  'clients still cannot read analytics_consents');
select throws_ok(
  $$ update public.analytics_consents set consent_text_version = '2099-01-01' $$, '42501', null,
  'clients cannot change a stored version');

select pg_temp.as_postgres();
select is(
  (select consent_text_version from public.analytics_consents
   where install_id = '00000000-0000-4000-8000-00000000c0f1'),
  '2026-11-01', 'the version is stored with the decision');

-- A start that records the same answer again does not move decided_at; a new version does.
update public.analytics_consents set decided_at = now() - interval '1 day';
select pg_temp.login('00000000-0000-0000-0000-00000000c0a1');
select public.record_analytics_consent('00000000-0000-4000-8000-00000000c0f1', true, false, false, '2026-11-01');
select pg_temp.as_postgres();
select ok(
  (select decided_at < now() - interval '1 hour' from public.analytics_consents
   where install_id = '00000000-0000-4000-8000-00000000c0f1'),
  'the same answer and version at a start keep decided_at');
select pg_temp.login('00000000-0000-0000-0000-00000000c0a1');
select public.record_analytics_consent('00000000-0000-4000-8000-00000000c0f1', true, false, false, '2027-01-01');
select pg_temp.as_postgres();
select ok(
  (select decided_at > now() - interval '1 hour' from public.analytics_consents
   where install_id = '00000000-0000-4000-8000-00000000c0f1'),
  'a yes to a new version is a new decision');

-- An app build from before 2026-11-01 (four arguments) stores no version, even over one.
select pg_temp.login('00000000-0000-0000-0000-00000000c0a1');
select public.record_analytics_consent('00000000-0000-4000-8000-00000000c0f1', true, false, true);
select pg_temp.as_postgres();
select is(
  (select consent_text_version from public.analytics_consents
   where install_id = '00000000-0000-4000-8000-00000000c0f1'),
  null, 'an older build''s yes has no version');

-- A no without an install id (the nil UUID row) carries its version too.
select pg_temp.login('00000000-0000-0000-0000-00000000c0b1');
select public.record_analytics_consent(null, false, false, true, '2026-11-01');
select pg_temp.as_postgres();
select is(
  (select consent::text || ' ' || consent_text_version from public.analytics_consents
   where user_id = '00000000-0000-0000-0000-00000000c0b1'),
  'false 2026-11-01', 'a no is stored with its version');

-- The export names the version (GDPR Art. 15).
select pg_temp.login('00000000-0000-0000-0000-00000000c0b1');
select is(
  public.export_my_data() -> 'analytics_decisions' -> 0 ->> 'consent_text_version',
  '2026-11-01', 'the export lists the version of each decision');
select pg_temp.as_postgres();

select ok(
  not has_function_privilege('anon',
    'public.record_analytics_consent(uuid, boolean, boolean, boolean, text)', 'execute'),
  'anon cannot record a decision');

select * from finish();
rollback;
