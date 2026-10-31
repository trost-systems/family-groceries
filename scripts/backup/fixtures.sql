-- Household data for the restore drill (scripts/backup/drill.sh): every public table gets rows,
-- written the way the app writes them (RPCs and triggers as the signed-in user), on top of the
-- users and identities GoTrue created. Peter and Lea share a household, Carl has his own.
\set ON_ERROR_STOP on
begin;

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object(
    'sub', (select id from auth.users where email = p_email), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function pg_temp.category(p_household uuid, p_seed text) returns uuid language sql as $$
  select id from public.categories where household_id = p_household and seed_key = p_seed
$$;

create function pg_temp.store(p_household uuid, p_seed text) returns uuid language sql as $$
  select id from public.stores where household_id = p_household and seed_key = p_seed
$$;

create temp table fx (key text primary key, id uuid, code text);
grant all on fx to authenticated;

-- Peter also signs in with Google: a second identity, as GoTrue links it.
insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select 'google-104857600000000000001', id,
  jsonb_build_object('sub', 'google-104857600000000000001', 'email', email, 'full_name', 'Peter Trost', 'email_verified', true),
  'google', now(), now(), now()
from auth.users where email = 'peter@backup.test';

select pg_temp.login('peter@backup.test');
insert into fx (key, id) select 'home', id from public.create_household('Familie Trost');
insert into fx select 'invite', i.id, i.code from public.create_invite((select id from fx where key = 'home')) i;
reset role;

select pg_temp.login('lea@backup.test');
select public.join_household((select code from fx where key = 'invite'));
reset role;

select pg_temp.login('peter@backup.test');
-- An open invite that nobody used.
select public.create_invite((select id from fx where key = 'home'));
select public.add_items((select id from fx where key = 'home'),
  array['2 l Milch', 'Vollkornbrot', '6 Äpfel', 'Kaffee', 'Spülmittel', 'Joghurt'],
  pg_temp.store((select id from fx where key = 'home'), 'lidl'));
select public.create_category((select id from fx where key = 'home'), 'Für die Katze');
select public.set_store_layout(pg_temp.store((select id from fx where key = 'home'), 'edeka'),
  (select array_agg(id order by sort_order desc) from public.categories
    where household_id = (select id from fx where key = 'home')),
  array[pg_temp.category((select id from fx where key = 'home'), 'drinks')]);
-- A correction the classifier learns from (category_memory) and a store change (item_store_memory).
update public.items set category_id = pg_temp.category(household_id, 'drugstore')
  where household_id = (select id from fx where key = 'home') and name = 'Spülmittel';
update public.items set store_id = pg_temp.store(household_id, 'edeka')
  where household_id = (select id from fx where key = 'home') and name = 'Joghurt';
-- Job 15: brand and properties from the parser, a brand the household teaches (household_brands),
-- a drag in the walk order and a new store order.
select public.add_item((select id from fx where key = 'home'), 'Windeln Pampers Größe 4');
select public.add_item((select id from fx where key = 'home'), 'Windeln', p_brand => 'Lillydoo', p_properties => 'Größe 5');
select public.place_item(
  (select id from public.items where household_id = (select id from fx where key = 'home') and name = 'Joghurt'),
  (select id from public.items where household_id = (select id from fx where key = 'home') and name = 'Äpfel'),
  'before');
select public.reorder_stores((select id from fx where key = 'home'),
  array[pg_temp.store((select id from fx where key = 'home'), 'edeka'),
        pg_temp.store((select id from fx where key = 'home'), 'lidl'),
        pg_temp.store((select id from fx where key = 'home'), 'dm')]);
select public.create_personal_access_token('Claude Desktop');
-- Job 21: feedback as the app sends it; household_id and is_internal come from the trigger.
insert into public.feedback (id, message, category, contact_ok, app_version, build, platform, os_version, locale, screen)
values (gen_random_uuid(), 'Der Haken reagiert erst beim zweiten Tippen.', 'bug', true, '0.1.0', '42', 'android',
  'Android 14 (SDK 34)', 'de', 'list');
reset role;

-- Lea ticks two items (bought_by and bought_at come from the trigger) and deletes one.
select pg_temp.login('lea@backup.test');
update public.items set status = 'bought'
  where household_id = (select id from fx where key = 'home') and name in ('Milch', 'Vollkornbrot');
delete from public.items where household_id = (select id from fx where key = 'home') and name = 'Kaffee';
select public.create_personal_access_token('Siri');
reset role;

select pg_temp.login('carl@backup.test');
insert into fx (key, id) select 'other', id from public.create_household('Nachbarn');
-- Job 22: a mistyped invite code is a failed attempt (invite_attempts, the rate limit's log).
select public.accept_invite('FALSCH22');
select public.add_items((select id from fx where key = 'other'), array['Bier', 'Chips']);
insert into public.feedback (id, message, app_version, build, platform, os_version, locale, screen)
values (gen_random_uuid(), 'Gibt es das auch auf Englisch?', '0.1.0', '42', 'web', 'Safari on iOS', 'en', 'more');
reset role;

-- Job 31: the app records each install's analytics answer; the alexa function's link map and
-- rate limit (service connection only).
select pg_temp.login('peter@backup.test');
select public.record_analytics_consent('6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b', true);
reset role;
select pg_temp.login('lea@backup.test');
select public.record_analytics_consent('7a2b3c4d-5e6f-4a70-8b8c-9d0e1f2a3b4c', false);
reset role;
insert into public.alexa_links (alexa_user_hash, session_id, user_id)
select encode(sha256('amzn1.ask.account.BACKUP'::bytea), 'hex'), gen_random_uuid(), id
from auth.users where email = 'peter@backup.test';
select public.alexa_take_adds((select id from auth.users where email = 'peter@backup.test'), 2);

-- Job 32b: Lea adds Karotten while Möhren is open and merges them (item_merges keeps both rows
-- for the undo).
select pg_temp.login('lea@backup.test');
select public.add_items((select id from fx where key = 'home'), array['500 g Möhren', '1 kg Karotten']);
select public.merge_items(gen_random_uuid(),
  (select id from public.items where household_id = (select id from fx where key = 'home') and name = 'Möhren'),
  (select id from public.items where household_id = (select id from fx where key = 'home') and name = 'Karotten'));
reset role;

-- Job 25 (job 43: through RevenueCat): Peter bought Hummlist Lifetime (sandbox) for the household;
-- the purchases function writes through the service connection only. His claim came first; a
-- second claim waits for its webhook (purchase_claims). Carl is a tester; one webhook event id is
-- remembered; one purged purchase left its tombstone; one deleted household waits for RevenueCat.
select public.purchase_claim((select id from auth.users where email = 'peter@backup.test'),
  (select id from fx where key = 'home'), 'apple', '2000000999000001');
select public.purchase_claim((select id from auth.users where email = 'peter@backup.test'),
  (select id from fx where key = 'home'), 'apple', '2000000999000002');
select public.purchase_record('apple', '2000000999000001', '2000000999000001', repeat('b', 64),
  'com.hummlist.app.lifetime', 'lifetime', 'Sandbox', now(), 9.99, 'EUR', 'DE', (select id from fx where key = 'home'));
select public.purchase_take_call((select id from auth.users where email = 'peter@backup.test'));
insert into public.lifetime_testers (user_id, grants, note)
select id, 1, 'backup drill' from auth.users where email = 'carl@backup.test';
insert into public.revenuecat_events (id, type) values ('backup-drill-event', 'NON_RENEWING_PURCHASE');
insert into public.purchase_tombstones (transaction_hmac) values (repeat('c', 64));
insert into public.revenuecat_deletions (app_user_id, due_at) values (gen_random_uuid(), now() + interval '30 days');

commit;
