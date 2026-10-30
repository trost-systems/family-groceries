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
select public.add_items((select id from fx where key = 'other'), array['Bier', 'Chips']);
insert into public.feedback (id, message, app_version, build, platform, os_version, locale, screen)
values (gen_random_uuid(), 'Gibt es das auch auf Englisch?', '0.1.0', '42', 'web', 'Safari on iOS', 'en', 'more');
reset role;

commit;
