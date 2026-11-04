-- Job 43b (migration 20261104032933_beta_promo.sql): the free beta unlock's queue behind the
-- server switch beta_promo, the backfill, and N-52 (a household without a purchase loses its
-- RevenueCat customer 30 days after its beta grant ends, at once after an objection).
begin;
select plan(30);

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

create function pg_temp.switch(p_on boolean) returns void language sql as $$
  update public.app_switches set enabled = p_on where key = 'beta_promo'
$$;

create function pg_temp.row_of(p_household uuid) returns public.beta_promo_grants language sql as $$
  select * from public.beta_promo_grants where beta_household = p_household
$$;

create function pg_temp.due(p_household uuid) returns timestamptz language sql as $$
  select due_at from public.revenuecat_deletions where app_user_id = p_household
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000b0a1', 'old43b@example.com'),
  ('00000000-0000-0000-0000-00000000b0b1', 'new43b@example.com'),
  ('00000000-0000-0000-0000-00000000b0c1', 'buyer43b@example.com'),
  ('00000000-0000-0000-0000-00000000b0d1', 'objects43b@example.com');

select is((select enabled from public.app_switches where key = 'beta_promo'), false, 'beta_promo is off');

-- Off: nothing is queued ---------------------------------------------------------------------------

select pg_temp.login('00000000-0000-0000-0000-00000000b0a1');
create temp table h_old as select id from public.create_household('Alt');
grant select on h_old to authenticated;
select pg_temp.as_postgres();
select is_empty($$ select * from public.beta_promo_grants $$, 'a household created while the switch is off is not queued');

-- Clients reach none of it -----------------------------------------------------------------------

select pg_temp.login('00000000-0000-0000-0000-00000000b0a1');
select throws_ok($$ select * from public.beta_promo_grants $$, '42501', null, 'clients cannot read the beta grants');
select throws_ok($$ select public.beta_promo_backfill(true) $$, '42501', null, 'clients cannot backfill');
select throws_ok($$ select public.beta_promo_take(10) $$, '42501', null, 'clients cannot take grants');
select throws_ok($$ select public.beta_promo_on() $$, '42501', null, 'clients cannot read the switch this way');
select throws_ok($$ select public.beta_promo_ended((select id from h_old), now(), true) $$, '42501', null,
  'clients cannot end a grant');

-- On: new households are queued; the backfill queues the old ones ----------------------------------

select pg_temp.as_postgres();
select pg_temp.switch(true);
select pg_temp.login('00000000-0000-0000-0000-00000000b0b1');
create temp table h_new as select id from public.create_household('Neu');
grant select on h_new to authenticated;
select pg_temp.as_postgres();
select ok((pg_temp.row_of((select id from h_new))).beta_household is not null, 'with the switch on, a new household is queued');
select ok((select count(*) from public.beta_promo_grants where beta_household = (select id from h_old)) = 0,
  'an older one is not');
select ok(public.beta_promo_backfill(false) >= 1, 'the backfill''s dry run counts it');
select ok((select count(*) from public.beta_promo_grants where beta_household = (select id from h_old)) = 0,
  'and changes nothing');
select ok(public.beta_promo_backfill(true) >= 1, 'with apply it queues it');
select ok((pg_temp.row_of((select id from h_old))).beta_household is not null, 'now the older household waits too');
select is(public.beta_promo_backfill(false), 0, 'a second backfill finds nothing left');

-- The function's run: take, granted, skipped ------------------------------------------------------

create temp table taken as select x from public.beta_promo_take(1000) x;
select ok((select count(*) from taken where x in ((select id from h_old), (select id from h_new))) = 2,
  'both queued households are taken');
select is((select count(*)::int from public.beta_promo_take(1000) x where x in ((select id from h_old), (select id from h_new))), 0,
  'and not again within 10 minutes');
select public.beta_promo_granted((select id from h_new), '2027-12-31 23:00+00');
select public.beta_promo_skipped((select id from h_old));
select is((pg_temp.row_of((select id from h_new))).ends_at, '2027-12-31 23:00+00'::timestamptz, 'granted until the beta''s end');
select is((pg_temp.row_of((select id from h_old))).skipped, 'tester', 'a household with a grant for good is skipped');
update public.beta_promo_grants set last_attempt_at = now() - interval '1 hour';
select is((select count(*)::int from public.beta_promo_take(1000) x where x in ((select id from h_old), (select id from h_new))), 0,
  'granted and skipped ones are not taken again');

-- N-52: the end of a grant ---------------------------------------------------------------------------

update public.beta_promo_grants set ends_at = now() - interval '1 day' where beta_household = (select id from h_new);
select public.purge_purchases();
select ok((pg_temp.row_of((select id from h_new))).ended_at is not null, 'the daily purge ends a grant whose end passed');
select is(pg_temp.due((select id from h_new)), (pg_temp.row_of((select id from h_new))).ends_at + interval '30 days',
  'its RevenueCat customer is due for deletion 30 days after the end (N-52)');

-- A household with a purchase keeps its customer.
select pg_temp.login('00000000-0000-0000-0000-00000000b0c1');
create temp table h_buyer as select id from public.create_household('Käufer');
grant select on h_buyer to authenticated;
select pg_temp.as_postgres();
select public.purchase_record('apple', '43b0000000000001', '43b0000000000001', repeat('d', 64),
  'com.hummlist.app.lifetime', 'premium', 'lifetime', 'Sandbox', now(), 29.99, 'EUR', 'DE', (select id from h_buyer));
select public.beta_promo_ended((select id from h_buyer), now(), false);
select is(pg_temp.due((select id from h_buyer)), null, 'a household that bought something is not queued');

-- An objection: ended, never granted again, customer deleted at once.
select pg_temp.login('00000000-0000-0000-0000-00000000b0d1');
create temp table h_obj as select id from public.create_household('Widerspruch');
grant select on h_obj to authenticated;
select pg_temp.as_postgres();
select public.beta_promo_granted((select id from h_obj), '2027-12-31 23:00+00');
select public.beta_promo_ended((select id from h_obj), now(), true);
select ok((pg_temp.row_of((select id from h_obj))).objected_at is not null, 'an objection is recorded');
select ok(pg_temp.due((select id from h_obj)) <= now(), 'and its RevenueCat customer is due at once');
update public.beta_promo_grants set last_attempt_at = null where beta_household = (select id from h_obj);
select is((select count(*)::int from public.beta_promo_take(1000) x where x = (select id from h_obj)), 0,
  'an objecting household is never granted again');

-- The deletion queue skips a household that has Premium again ------------------------------------

update public.revenuecat_deletions set due_at = now() - interval '1 minute';
insert into public.entitlements (household_id, kind, source, premium_source, expires_at)
values ((select id from h_new), 'premium', 'promotional', 'promotional', now() + interval '1 year');
create temp table deletions_taken as select x from public.revenuecat_deletions_take(1000) x;
select ok((select count(*) from deletions_taken where x = (select id from h_obj)) = 1, 'the objecting household is taken for deletion');
select ok((select count(*) from deletions_taken where x = (select id from h_new)) = 0,
  'one that has Premium again is not');
select is(pg_temp.due((select id from h_new)), null, 'and leaves the queue');

-- The household's deletion takes its row with it.
delete from public.households where id = (select id from h_obj);
select is(pg_temp.row_of((select id from h_obj)), null, 'a deleted household''s grant row goes with it');
select ok(pg_temp.due((select id from h_obj)) is not null, 'its RevenueCat customer stays queued (job 43)');

select * from finish();
rollback;
