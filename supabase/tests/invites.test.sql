-- Job 22: invites last 7 days and work once, members revoke them for good, a code previews its
-- household's name, failed codes are rate-limited (10 per user and rolling hour), and a new
-- household may start without the default stores.
begin;
select plan(51);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;

create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- An invite of the owner's household, made by the owner; its code.
create function pg_temp.invite() returns text language plpgsql as $$
declare
  v_code text;
begin
  perform pg_temp.login('00000000-0000-0000-0000-0000000000a1');
  select code into v_code from public.create_invite(
    (select household_id from public.household_members where user_id = '00000000-0000-0000-0000-0000000000a1'));
  return v_code;
end $$;

create function pg_temp.status(p_result jsonb) returns text language sql as $$ select p_result ->> 'status' $$;

create function pg_temp.members() returns int language sql security definer as $$
  select count(*)::int from public.household_members
  where household_id = (select household_id from public.household_members where user_id = '00000000-0000-0000-0000-0000000000a1')
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'partner@example.com'),
  ('00000000-0000-0000-0000-0000000000c1', 'third@example.com'),
  ('00000000-0000-0000-0000-0000000000d1', 'guesser@example.com'),
  ('00000000-0000-0000-0000-0000000000e1', 'bystander@example.com'),
  ('00000000-0000-0000-0000-0000000000f1', 'nostores@example.com');

-- create_household: the default stores are optional, the categories are not ------------------

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
create temp table h as select * from public.create_household(p_name => 'Familie Test', p_default_stores => true);
grant select on h to authenticated;
select results_eq(
  $$ select name, seed_key from public.stores where household_id = (select id from h) order by sort_order $$,
  $$ values ('dm', 'dm'), ('Lidl', 'lidl'), ('Edeka', 'edeka') $$,
  'p_default_stores true still seeds dm, Lidl and Edeka (old builds)');
select is(
  (select count(*)::int from public.store_category_order where household_id = (select id from h)), 33,
  'with their store layouts');
select throws_ok($$ select public.create_household('Nochmal', false) $$, 'P0001', 'already_in_household',
  'a second create (double tap, retry) makes no second household');

select pg_temp.login('00000000-0000-0000-0000-0000000000f1');
create temp table hn as select * from public.create_household(p_name => 'Ohne Läden', p_default_stores => false);
grant select on hn to authenticated;
select is((select count(*)::int from public.stores where household_id = (select id from hn)), 0,
  'p_default_stores false: no stores');
select is((select count(*)::int from public.categories where household_id = (select id from hn)), 11,
  'the categories are seeded anyway');
select is((select count(*)::int from public.categories where household_id = (select id from hn) and seed_key = 'other'), 1,
  'the fallback category among them');
select is(
  (select c.seed_key from public.categories c where c.id = public.classify_item((select id from hn), 'Milch')),
  'chilled', 'the classifier works in a household without stores');
insert into public.items (household_id, name) select id, 'Brot' from hn;
select is((select store_id from public.items where name = 'Brot'), null, 'an item there has no store');
select is((select role from public.household_members where user_id = '00000000-0000-0000-0000-0000000000f1'), 'owner',
  'the creator is the owner');
select is((select name from public.households where id = (select id from hn)), 'Ohne Läden', 'with the given name');

-- Expiry: 7 days ------------------------------------------------------------------------

create temp table codes (k text primary key, code text);
grant all on codes to authenticated;
insert into codes values ('fresh', pg_temp.invite());
select pg_temp.logout();
select ok(
  (select expires_at between now() + interval '7 days' - interval '1 minute' and now() + interval '7 days'
   from public.invites where code = (select code from codes where k = 'fresh')),
  'a new invite expires in 7 days');

-- Six days old: still good. Eight days old: expired.
insert into codes values ('six', pg_temp.invite()), ('eight', pg_temp.invite());
select pg_temp.logout();
update public.invites set created_at = now() - interval '6 days', expires_at = now() + interval '1 day'
  where code = (select code from codes where k = 'six');
update public.invites set created_at = now() - interval '8 days', expires_at = now() - interval '1 day'
  where code = (select code from codes where k = 'eight');

select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is(pg_temp.status(public.preview_invite((select code from codes where k = 'eight'))), 'invalid_invite',
  'an 8-day-old code previews as invalid');
select is(pg_temp.status(public.accept_invite((select code from codes where k = 'eight'))), 'invalid_invite',
  'an 8-day-old code does not join');
select is(pg_temp.members(), 1, 'and adds no membership');
select is(public.preview_invite((select code from codes where k = 'six')),
  '{"status": "ok", "name": "Familie Test", "unlocked": false, "leaves_unlocked": false, "recent_purchase": false}'::jsonb,
  'a 6-day-old code previews the household name (job 43: and that it has no Lifetime)');

-- Single use ------------------------------------------------------------------------------

select is(
  public.accept_invite(lower((select code from codes where k = 'six'))),
  jsonb_build_object('status', 'joined', 'household_id', (select id from h)),
  'a 6-day-old code joins (case-insensitively)');
select is(pg_temp.members(), 2, 'the partner is a member');
select pg_temp.logout();
select is(
  (select used_by from public.invites where code = (select code from codes where k = 'six')),
  '00000000-0000-0000-0000-0000000000b1'::uuid, 'the invite records who used it');
select isnt((select used_at from public.invites where code = (select code from codes where k = 'six')), null,
  'and when');

select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
select is(pg_temp.status(public.preview_invite((select code from codes where k = 'six'))), 'invalid_invite',
  'a used code previews as invalid for anyone else');
select is(public.accept_invite((select code from codes where k = 'six')),
  '{"status": "invalid_invite", "household_id": null}'::jsonb, 'and does not join a second person');
select is(pg_temp.members(), 2, 'still two members');

-- The member who used it, opening the link again: success, nothing changes.
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is(public.accept_invite((select code from codes where k = 'six')),
  jsonb_build_object('status', 'member', 'household_id', (select id from h)),
  'opening a used link again as its member answers member');
select is(public.preview_invite((select code from codes where k = 'six')),
  '{"status": "member", "name": "Familie Test", "unlocked": false}'::jsonb, 'its preview too');
select is(pg_temp.members(), 2, 'no duplicate membership');
-- A member opening an expired or a fresh link: success without consuming it.
select is(pg_temp.status(public.accept_invite((select code from codes where k = 'eight'))), 'member',
  'a member opening an expired link of their household lands on the list');
select is(pg_temp.status(public.accept_invite((select code from codes where k = 'fresh'))), 'member',
  'a member opening an open link answers member');
select pg_temp.logout();
select is((select used_at from public.invites where code = (select code from codes where k = 'fresh')), null,
  'without using it up');

-- The old RPC: the household id on success, null for a bad code (no raise, so the failure counts).
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
select is(public.join_household('NOPE2345'), null, 'join_household returns null for a made-up code');
select is(public.join_household((select code from codes where k = 'fresh')), (select id from h),
  'and the household id for a good one');
select is(pg_temp.status(public.accept_invite((select code from codes where k = 'fresh'))), 'member',
  'that used it up for the third person only');

-- Revoke ----------------------------------------------------------------------------------

insert into codes values ('revoked', pg_temp.invite());
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select lives_ok(
  format($$ select public.revoke_invite((select id from public.invites where code = %L)) $$,
    (select code from codes where k = 'revoked')),
  'any member revokes an invite');
select throws_ok(
  format($$ update public.invites set revoked_at = null where code = %L $$, (select code from codes where k = 'revoked')),
  '42501', null, 'a member cannot un-revoke it by updating the row');
select lives_ok(
  format($$ select public.revoke_invite((select id from public.invites where code = %L)) $$,
    (select code from codes where k = 'revoked')),
  'revoking twice is fine');
select pg_temp.logout();
select isnt((select revoked_at from public.invites where code = (select code from codes where k = 'revoked')), null,
  'it stays revoked');
select pg_temp.login('00000000-0000-0000-0000-0000000000e1');
select is(pg_temp.status(public.accept_invite((select code from codes where k = 'revoked'))), 'invalid_invite',
  'a revoked code does not join');
select is(public.preview_invite((select code from codes where k = 'revoked')),
  '{"status": "invalid_invite", "name": null}'::jsonb, 'and previews the same as a made-up one');
select is(public.preview_invite('ZZZZ2345'),
  '{"status": "invalid_invite", "name": null}'::jsonb, 'a made-up code: the same answer');

-- Rate limit ------------------------------------------------------------------------------

insert into codes values ('limited', pg_temp.invite());
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select is(pg_temp.status(public.accept_invite('WRONG01')), 'invalid_invite', 'a wrong code answers invalid_invite');
select count(pg_temp.status(public.accept_invite('WRONG0' || n))) from generate_series(2, 9) n;
select is(pg_temp.status(public.preview_invite('WRONG10')), 'invalid_invite',
  'the 10th failure (a preview) still answers invalid_invite');
select is(pg_temp.status(public.accept_invite('WRONG11')), 'too_many_attempts',
  'the 11th attempt in an hour is refused');
select is(pg_temp.status(public.accept_invite((select code from codes where k = 'limited'))), 'too_many_attempts',
  'even with a valid code');
select is(pg_temp.status(public.preview_invite((select code from codes where k = 'limited'))), 'too_many_attempts',
  'and its preview');
select throws_ok(format($$ select public.join_household(%L) $$, (select code from codes where k = 'limited')),
  'P0001', 'too_many_attempts', 'the old RPC is limited too');
select pg_temp.logout();
select is((select count(*)::int from public.invite_attempts where user_id = '00000000-0000-0000-0000-0000000000d1'), 10,
  'the failures were recorded, the refused attempts not');
select is((select used_at from public.invites where code = (select code from codes where k = 'limited')), null,
  'the valid code was not used up');

select pg_temp.login('00000000-0000-0000-0000-0000000000e1');
select is(pg_temp.status(public.preview_invite((select code from codes where k = 'limited'))), 'ok',
  'another user is not limited');

-- An hour later the window has cleared.
select pg_temp.logout();
update public.invite_attempts set at = at - interval '61 minutes'
  where user_id = '00000000-0000-0000-0000-0000000000d1';
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select is(pg_temp.status(public.accept_invite((select code from codes where k = 'limited'))), 'joined',
  'after the window the valid code joins');

-- Rows older than a day go when the next failure is recorded.
select pg_temp.logout();
update public.invite_attempts set at = now() - interval '25 hours';
select pg_temp.login('00000000-0000-0000-0000-0000000000e1');
select pg_temp.status(public.accept_invite('WRONG12'));
select pg_temp.logout();
select is((select count(*)::int from public.invite_attempts), 1, 'old attempts are purged');

-- Data export --------------------------------------------------------------------------

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select is(jsonb_array_length(public.export_my_data() -> 'invites_created'), 5,
  'the export lists the invites the user created');
select ok(not (public.export_my_data() -> 'invites_created' -> 0 ? 'used_by'),
  'without who used them');

select * from finish();
rollback;
