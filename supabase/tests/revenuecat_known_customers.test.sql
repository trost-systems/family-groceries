-- Job 211: a deleted household is queued for deletion at RevenueCat only if RevenueCat reported it
-- (migration 20261113155327_revenuecat_known_customers.sql). Kai's household never reached
-- RevenueCat; Lu's has a purchase recorded under its id, Ola's a promotional grant, and Pia's only
-- a transaction that belongs elsewhere. A note for an account that is gone queues it at once.
begin;
select plan(13);

create function pg_temp.hmac(p_tx text) returns text language sql as $$
  select encode(extensions.hmac(p_tx, 'pgTAP key', 'sha256'), 'hex')
$$;

create function pg_temp.lifetime(p_tx text, p_household uuid) returns jsonb language sql as $$
  select public.purchase_record('apple', p_tx, p_tx, pg_temp.hmac(p_tx), 'com.snacklist.app.lifetime',
    'premium', 'lifetime', 'Production', now() - interval '1 minute', 29.99, 'EUR', 'DE', p_household)
$$;

create function pg_temp.household_of(p_user uuid, p_name text) returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  select id into v_id from public.create_household(p_name);
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  return v_id;
end $$;

create function pg_temp.queued(p_id uuid) returns boolean language sql as $$
  select exists (select from public.revenuecat_deletions d where d.app_user_id = p_id
                 and d.due_at > now() + interval '29 days')
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000211a1', 'kai@test.invalid'),
  ('00000000-0000-0000-0000-0000000211b1', 'lu@test.invalid'),
  ('00000000-0000-0000-0000-0000000211c1', 'ola@test.invalid'),
  ('00000000-0000-0000-0000-0000000211d1', 'pia@test.invalid');

create temp table hk as select pg_temp.household_of('00000000-0000-0000-0000-0000000211a1', 'Kai') as id;
create temp table hl as select pg_temp.household_of('00000000-0000-0000-0000-0000000211b1', 'Lu') as id;
create temp table ho as select pg_temp.household_of('00000000-0000-0000-0000-0000000211c1', 'Ola') as id;
create temp table hp as select pg_temp.household_of('00000000-0000-0000-0000-0000000211d1', 'Pia') as id;

select is(pg_temp.lifetime('211-l1', (select id from hl)) ->> 'outcome', 'granted', 'Lu''s household buys Lifetime');
select is(public.promotional_premium_sync((select id from ho), true, null), 'granted',
  'Ola''s household gets a promotional grant');
select is(pg_temp.lifetime('211-l1', (select id from hp)) ->> 'outcome', 'used_elsewhere',
  'Lu''s transaction reported under Pia''s household id stays Lu''s');
select is(public.purchase_record('apple', '211-x', '211-x', pg_temp.hmac('211-x'), 'com.snacklist.app.lifetime',
    'premium', 'lifetime', 'Production', now(), 29.99, 'EUR', 'DE', gen_random_uuid()) ->> 'outcome',
  'no_household', 'an App User ID that is no household');
select is((select array_agg(r.app_user_id order by r.app_user_id) from public.revenuecat_households r
           where r.app_user_id in ((select id from hk), (select id from hl), (select id from ho), (select id from hp))),
  (select array_agg(x order by x) from unnest(array[(select id from hl), (select id from ho), (select id from hp)]) x),
  'RevenueCat''s households are noted: Lu''s, Ola''s and Pia''s, not Kai''s');
select is((select count(*)::int from public.revenuecat_households r
           where not exists (select from public.households h where h.id = r.app_user_id)), 0,
  'an id that is no household is not noted');

delete from public.households where id in ((select id from hk), (select id from hl), (select id from ho), (select id from hp));
select ok(not pg_temp.queued((select id from hk)),
  'Kai''s deleted household never reached RevenueCat: its id is not sent there');
select ok(pg_temp.queued((select id from hl)), 'Lu''s is queued for in 30 days');
select ok(pg_temp.queued((select id from ho)), 'so is Ola''s');
select ok(pg_temp.queued((select id from hp)), 'and Pia''s');
select is((select count(*)::int from public.revenuecat_households r
           where r.app_user_id in ((select id from hl), (select id from ho), (select id from hp))), 0,
  'and their notes go with them');

-- A note for an account deleted before the note got its lock (job 185's race): queued, not noted.
insert into public.revenuecat_customers (user_id) values ('00000000-0000-0000-0000-0000000211e1');
select ok(pg_temp.queued('00000000-0000-0000-0000-0000000211e1'),
  'a note for an account that is gone queues its RevenueCat customer');
select ok(not exists (select from public.revenuecat_customers where user_id = '00000000-0000-0000-0000-0000000211e1'),
  'and leaves no note behind');

select * from finish();
rollback;
