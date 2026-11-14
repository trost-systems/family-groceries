-- Job 225: the daily feedback digest (docs/FEEDBACK.md, "Daily digest"). Off by default with no
-- cron job; clients reach none of it; switching on needs the vault secret and schedules an hourly
-- job without the secret in it; the Berlin day window across 08:00 and both DST days; empty and
-- internal-only windows; the address only with contact_ok; Premium; the watermark's
-- compare-and-set; the health status.
begin;
select plan(65);

create function pg_temp.as_role(p_role text) returns void language plpgsql as $$
begin
  perform set_config('role', p_role, true);
  perform set_config('request.jwt.claims',
    case when p_role = 'authenticated'
      then json_build_object('sub', '00000000-0000-0000-0000-0000000225a1', 'role', 'authenticated')::text
      else '' end, true);
end $$;

-- A note as the trigger leaves it, then moved to [p_at] (the trigger sets created_at to now()).
create function pg_temp.note(p_id uuid, p_user uuid, p_at timestamptz, p_contact boolean default false,
  p_category text default null) returns void language plpgsql as $$
begin
  insert into public.feedback (id, user_id, message, category, contact_ok, app_version, build,
    platform, os_version, locale, screen)
  values (p_id, p_user, 'Notiz ' || p_id, p_category, p_contact, '1.4.0', '88', 'ios', 'iOS 18.1',
    'de', 'list');
  update public.feedback set created_at = p_at where id = p_id;
end $$;

create function pg_temp.batch(p_now timestamptz) returns jsonb language sql as $$
  select public.feedback_digest_batch(p_now)
$$;

create function pg_temp.ids(p_batch jsonb) returns text[] language sql as $$
  select coalesce(array_agg(n ->> 'id' order by o), '{}')
  from jsonb_array_elements(p_batch -> 'notes') with ordinality as t (n, o)
$$;

create function pg_temp.watermark(p_at timestamptz, p_id uuid) returns void language sql as $$
  update public.feedback_digest_state set since_created_at = p_at, since_id = p_id
$$;

-- Off as shipped ------------------------------------------------------------------------------

select is(public.app_switch('feedback_digest'), false, 'the switch is seeded off');
select is((select enabled from public.app_switches where key = 'feedback_digest'), false,
  'the switch row exists, off');
select is(public.feedback_digest_batch(), '{"enabled": false}'::jsonb, 'off: the batch reads nothing');
select is((select count(*)::int from cron.job where jobname = 'feedback-digest'), 0,
  'the migration schedules no feedback-digest job');
select is((select since_created_at from public.feedback_digest_state), null, 'no watermark yet');
select is((select count(*)::int from public.feedback_digest_state), 1, 'one state row');
select throws_ok($$ insert into public.feedback_digest_state (id) values (false) $$, '23514', null,
  'a second state row is refused');
select results_eq($$ select enabled, healthy from public.feedback_digest_status() $$,
  $$ values (false, true) $$, 'off: status says disabled and healthy');
-- Switched on with no watermark (never through feedback_digest_set) still counts as off.
update public.app_switches set enabled = true where key = 'feedback_digest';
select is(public.feedback_digest_batch(), '{"enabled": false}'::jsonb,
  'switch on without a watermark: still off');
update public.app_switches set enabled = false where key = 'feedback_digest';

-- Clients reach nothing -------------------------------------------------------------------------

select pg_temp.as_role('authenticated');
select throws_ok($$ select * from public.feedback_digest_state $$, '42501', null,
  'a signed-in user cannot read the state');
select throws_ok($$ select public.feedback_digest_batch() $$, '42501', null, 'nor build a batch');
select throws_ok($$ select public.feedback_digest_advance(null, null, '2026-01-01T00:00:00Z',
  gen_random_uuid(), '2026-01-01') $$, '42501', null, 'nor move the watermark');
select throws_ok($$ select public.feedback_digest_record(null) $$, '42501', null, 'nor record a run');
select throws_ok($$ select * from public.feedback_digest_status() $$, '42501', null, 'nor read the status');
select throws_ok($$ select public.feedback_digest_set(false) $$, '42501', null, 'nor switch it');
select pg_temp.as_role('anon');
select throws_ok($$ select * from public.feedback_digest_state $$, '42501', null,
  'anon cannot read the state');
select throws_ok($$ select public.feedback_digest_batch() $$, '42501', null, 'nor build a batch');
select throws_ok($$ select public.feedback_digest_set(true, 'https://x.test') $$, '42501', null,
  'nor switch it');
select pg_temp.as_role('service_role');
select throws_ok($$ select public.feedback_digest_set(true, 'https://x.test') $$, '42501', null,
  'the service key cannot switch it on');
select throws_ok($$ select public.feedback_digest_record(null) $$, '42501', null, 'nor record a run');
select throws_ok($$ select * from public.feedback_digest_state $$, '42501', null, 'nor read the state');
select pg_temp.as_role('postgres');

-- feedback_digest_set ---------------------------------------------------------------------------

select throws_ok($$ select public.feedback_digest_set(true, 'https://fn.test/functions/v1/feedback-digest') $$,
  '22023', 'vault secret feedback_digest_secret is missing', 'on without the vault secret is refused');
select is(public.app_switch('feedback_digest'), false, 'and stays off');
select vault.create_secret('digest-secret-225-value', 'feedback_digest_secret');
select throws_ok($$ select public.feedback_digest_set(true) $$, '22023', null, 'on without a URL is refused');
select throws_ok($$ select public.feedback_digest_set(true, 'file:///etc/passwd') $$, '22023', null,
  'on with a non-HTTP URL is refused');
select is(public.feedback_digest_set(true, 'https://fn.test/functions/v1/feedback-digest'), 'on',
  'on with the secret and a URL');
select is(public.app_switch('feedback_digest'), true, 'the switch is on');
select is((select since_created_at from public.feedback_digest_state), now(), 'the first switch-on starts now');
select is((select schedule from cron.job where jobname = 'feedback-digest'), '0 * * * *', 'an hourly job');
select ok((select command like '%net.http_post(url := ''https://fn.test/functions/v1/feedback-digest''%'
  from cron.job where jobname = 'feedback-digest'), 'the job posts to the given URL');
select ok((select command like '%from vault.decrypted_secrets where name = ''feedback_digest_secret''%'
  from cron.job where jobname = 'feedback-digest'), 'the job reads the secret from the vault at run time');
select ok((select position('digest-secret-225-value' in command) = 0
  from cron.job where jobname = 'feedback-digest'), 'the job holds no secret value');
select results_eq($$ select enabled, healthy from public.feedback_digest_status() $$,
  $$ values (true, true) $$, 'a fresh switch-on is healthy until its first run');
update public.feedback_digest_state set since_created_at = '2026-01-02 03:04:05.678901+00';
select is(public.feedback_digest_set(false), 'off', 'off');
select is(public.app_switch('feedback_digest'), false, 'the switch is off');
select is((select count(*)::int from cron.job where jobname = 'feedback-digest'), 0, 'the job is gone');
select is(public.feedback_digest_batch(), '{"enabled": false}'::jsonb, 'off again: no batch');
select is(public.feedback_digest_set(false), 'off', 'off twice is fine');
select is(public.feedback_digest_set(true, 'https://fn.test/functions/v1/feedback-digest'), 'on', 'on again');
select is((select since_created_at from public.feedback_digest_state), '2026-01-02 03:04:05.678901+00',
  'a later switch-on keeps the watermark: a pause loses no note');
select is((select count(*)::int from cron.job where jobname = 'feedback-digest'), 1, 'one job after on twice');

-- The batch -------------------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000225a1', 'anna@gmail.com'),
  ('00000000-0000-0000-0000-0000000225b1', 'ben@web.de'),
  ('00000000-0000-0000-0000-0000000225c1', 'carla@gmx.at'),
  ('00000000-0000-0000-0000-0000000225d1', 'tester.run1@fg-test.invalid');
select pg_temp.as_role('authenticated');
select public.create_household('Anna');
select pg_temp.as_role('postgres');
insert into public.entitlements (household_id, kind, source, premium_source)
select household_id, 'premium', 'promotional', 'promotional' from public.household_members
where user_id = '00000000-0000-0000-0000-0000000225a1';
insert into public.user_entitlements (user_id, source, premium_source)
values ('00000000-0000-0000-0000-0000000225c1', 'promotional', 'promotional');

-- Watermark 2026-11-10 07:00 Berlin. Anna (household Premium, reply allowed) on the 10th, Ben on
-- the 11th, Carla (her own Premium, reply allowed) on the 11th, the tester (internal) on the 11th,
-- Anna again at 07:59:30 on the 12th, inside the settle minute.
select pg_temp.watermark('2026-11-10 06:00:00+00', '00000000-0000-0000-0000-000000000000');
select pg_temp.note('20000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-0000000225a1',
  '2026-11-10 08:00:00.123456+00', true, 'bug');
select pg_temp.note('20000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-0000000225b1',
  '2026-11-11 09:00:00+00');
select pg_temp.note('20000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-0000000225c1',
  '2026-11-11 09:00:00+00', true, 'idea');
select pg_temp.note('20000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-0000000225d1',
  '2026-11-11 10:00:00+00', true);
select pg_temp.note('20000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-0000000225a1',
  '2026-11-12 06:59:30+00', true);

create temp table b as select pg_temp.batch('2026-11-12 07:00:00+00') as j;
select is((select j ->> 'digest_on' from b), '2026-11-12', '08:00 Berlin: today''s digest');
select is((select j -> 'since' from b),
  '{"created_at": "2026-11-10T06:00:00.000000Z", "id": "00000000-0000-0000-0000-000000000000"}'::jsonb,
  'the batch names the watermark it read');
select is((select pg_temp.ids(j) from b), array['20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003'],
  'external notes before 07:59 in order; the internal one and the one inside the settle minute are not');
select is((select j -> 'notes' -> 0 from b), jsonb_build_object(
  'id', '20000000-0000-4000-8000-000000000001', 'created_at', '2026-11-10T08:00:00.123456Z',
  'created_berlin', '2026-11-10 09:00', 'category', 'bug',
  'message', 'Notiz 20000000-0000-4000-8000-000000000001', 'platform', 'ios', 'app_version', '1.4.0',
  'build', '88', 'premium', true, 'contact_ok', true, 'email', 'anna@gmail.com'),
  'a note: Berlin time, microseconds, household Premium, the address with reply allowed');
select is((select j -> 'notes' -> 1 -> 'email' from b), 'null'::jsonb, 'no address without reply allowed');
select is((select (j -> 'notes' -> 1 ->> 'premium')::boolean from b), false, 'Ben has no Premium');
select is((select (j -> 'notes' -> 2 ->> 'premium')::boolean from b), true, 'Carla''s own Premium counts');
select is(pg_temp.batch('2026-11-12 06:59:59+00') ->> 'digest_on', '2026-11-11', 'before 08:00 Berlin: yesterday''s');
select is(pg_temp.batch('2026-11-10 07:00:00+00') -> 'notes', '[]'::jsonb, 'an empty day: no notes');

-- The rerun: the mail went out, the watermark moves once.
select is(public.feedback_digest_advance('2026-11-10T06:00:00.000000Z', '00000000-0000-0000-0000-000000000000',
  '2026-11-11T09:00:00.000000Z', '20000000-0000-4000-8000-000000000003', '2026-11-12'), true,
  'advance from the watermark the batch read');
select is(public.feedback_digest_advance('2026-11-10T06:00:00.000000Z', '00000000-0000-0000-0000-000000000000',
  '2026-11-11T09:00:00.000000Z', '20000000-0000-4000-8000-000000000003', '2026-11-12'), false,
  'the same advance again (a rerun or a racing run) moves nothing');
select is(pg_temp.batch('2026-11-12 07:00:00+00') -> 'notes', '[]'::jsonb,
  'an internal-only window: no notes');
select is(pg_temp.ids(pg_temp.batch('2026-11-13 07:00:00+00')), array['20000000-0000-4000-8000-000000000005'],
  'the note inside the settle minute is in the next day''s digest');
select is((select last_digest_on from public.feedback_digest_state), '2026-11-12'::date, 'the day is recorded');

-- The window's end on the DST days: 07:59 Berlin is 05:59 UTC on 29 March, 06:59 UTC on 25 October.
select pg_temp.watermark('2026-03-28 06:00:00+00', '00000000-0000-0000-0000-000000000000');
select pg_temp.note('20000000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-0000000225b1',
  '2026-03-29 05:58:59+00');
select pg_temp.note('20000000-0000-4000-8000-000000000007', '00000000-0000-0000-0000-0000000225b1',
  '2026-03-29 05:59:00+00');
select is(pg_temp.batch('2026-03-29 06:00:00+00') ->> 'digest_on', '2026-03-29', 'spring: 08:00 CEST is 06:00 UTC');
select is(pg_temp.batch('2026-03-29 05:59:59+00') ->> 'digest_on', '2026-03-28', 'spring: 07:59 CEST is yesterday''s');
select is(pg_temp.ids(pg_temp.batch('2026-03-29 06:00:00+00')), array['20000000-0000-4000-8000-000000000006'],
  'spring: the window ends at 05:59 UTC');
select pg_temp.watermark('2026-10-24 06:00:00+00', '00000000-0000-0000-0000-000000000000');
select pg_temp.note('20000000-0000-4000-8000-000000000008', '00000000-0000-0000-0000-0000000225b1',
  '2026-10-25 06:58:59+00');
select pg_temp.note('20000000-0000-4000-8000-000000000009', '00000000-0000-0000-0000-0000000225b1',
  '2026-10-25 06:59:00+00');
select is(pg_temp.batch('2026-10-25 07:00:00+00') ->> 'digest_on', '2026-10-25', 'autumn: 08:00 CET is 07:00 UTC');
select is(pg_temp.batch('2026-10-25 06:59:59+00') ->> 'digest_on', '2026-10-24', 'autumn: 07:59 CET is yesterday''s');
select is(pg_temp.ids(pg_temp.batch('2026-10-25 07:00:00+00')), array['20000000-0000-4000-8000-000000000008'],
  'autumn: the window ends at 06:59 UTC');

-- Runs and health --------------------------------------------------------------------------------

select throws_ok($$ select public.feedback_digest_record('Mail failed for anna@gmail.com') $$, '23514', null,
  'an error is a fixed code, never text');
select public.feedback_digest_record('send_failed');
select results_eq($$ select enabled, healthy from public.feedback_digest_status() $$,
  $$ values (true, false) $$, 'a failed run: unhealthy');
select public.feedback_digest_record(null);
select results_eq($$ select enabled, healthy from public.feedback_digest_status() $$,
  $$ values (true, true) $$, 'a good run: healthy');
update public.feedback_digest_state set last_ok_at = now() - interval '4 hours';
select results_eq($$ select enabled, healthy from public.feedback_digest_status() $$,
  $$ values (true, false) $$, 'no good run for three hours: unhealthy');

select * from finish();
rollback;
