-- Job 190: a price on an item (all five columns or none, the unit price in millionths) and the
-- household's currency (EUR by default, any member changes it, ISO codes only), both in the export.
begin;
select plan(20);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;

-- Sets a complete price on the item named [p_name].
create function pg_temp.price(p_name text, p_micros bigint) returns void language sql as $$
  update public.items set price_unit_micros = p_micros, price_basis = 'unit', price_per = 'piece',
    price_currency = 'EUR', priced_at = '2026-11-13 09:00+01'
  where name = p_name
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000190a1', 'price-a@example.com'),
  ('00000000-0000-0000-0000-0000000190b1', 'price-b@example.com');

select pg_temp.login('00000000-0000-0000-0000-0000000190b1');
select public.create_household('B', false, '{}');
select pg_temp.login('00000000-0000-0000-0000-0000000190a1');
select public.create_household('A', false, '{}');
insert into public.items (household_id, name)
  select id, 'Milch' from public.households where name = 'A';

select is((select currency from public.households where name = 'A'), 'EUR', 'a new household counts in EUR');
select is(
  (select num_nulls(price_unit_micros, price_basis, price_per, price_currency, priced_at) from public.items where name = 'Milch'),
  5, 'a new item has no price');

select lives_ok($$ select pg_temp.price('Milch', -9999000000) $$, '-9999.00 is a price (a deposit return)');
select lives_ok($$ select pg_temp.price('Milch', 0) $$, '0 is a price');
select lives_ok($$ select pg_temp.price('Milch', 333333) $$, 'a third of a euro keeps its micros');
select throws_ok($$ select pg_temp.price('Milch', -999900000001) $$, '23514', null, 'below the unit price range is refused');
select throws_ok($$ select pg_temp.price('Milch', 999900000001) $$, '23514', null, 'above the unit price range is refused');
select results_eq(
  $$ select price_unit_micros, price_basis, price_per, price_currency, priced_at from public.items where name = 'Milch' $$,
  $$ values (333333::bigint, 'unit', 'piece', 'EUR', '2026-11-13 09:00+01'::timestamptz) $$,
  'the member reads the price back');

select throws_ok(
  $$ update public.items set price_unit_micros = null where name = 'Milch' $$,
  '23514', null, 'a price without its amount is refused');
select throws_ok(
  $$ update public.items set price_basis = 'each' where name = 'Milch' $$,
  '23514', null, 'an unknown basis is refused');
select throws_ok(
  $$ update public.items set price_per = 'g' where name = 'Milch' $$,
  '23514', null, 'an unknown unit is refused');
select throws_ok(
  $$ update public.items set price_currency = 'eur' where name = 'Milch' $$,
  '23514', null, 'a price currency that is not an ISO code is refused');
select lives_ok(
  $$ update public.items set price_unit_micros = null, price_basis = null, price_per = null, price_currency = null,
       priced_at = null where name = 'Milch' $$,
  'clearing all five removes the price');
select throws_ok(
  $$ update public.items set price_unit_micros = 1200000 where name = 'Milch' $$,
  '23514', null, 'an amount without basis, unit, currency and time is refused');

update public.households set currency = 'CHF' where name = 'A';
select is((select currency from public.households where name = 'A'), 'CHF', 'a member changes the currency');
select throws_ok(
  $$ update public.households set currency = 'EURO' where name = 'A' $$,
  '23514', null, 'a currency that is not an ISO code is refused');
select is_empty(
  $$ update public.households h set currency = 'USD' from public.household_members m
     where m.household_id = h.id and m.user_id = '00000000-0000-0000-0000-0000000190b1' returning h.id $$,
  'another household''s currency is not changed');

select pg_temp.price('Milch', 1190000);
select results_eq(
  $$ select d -> 'items_added' -> 0 ->> 'price_unit_micros', d -> 'items_added' -> 0 ->> 'price_basis',
            d -> 'items_added' -> 0 ->> 'price_per', d -> 'items_added' -> 0 ->> 'price_currency',
            (d -> 'items_added' -> 0 ->> 'priced_at')::timestamptz
     from (select public.export_my_data() as d) e $$,
  $$ values ('1190000', 'unit', 'piece', 'EUR', '2026-11-13 09:00+01'::timestamptz) $$,
  'the export carries the item''s price');
select results_eq(
  $$ select d -> 'household' ->> 'currency', d -> 'households' -> 0 ->> 'currency'
     from (select public.export_my_data() as d) e $$,
  $$ values ('CHF', 'CHF') $$,
  'the export carries the household currency');

reset role;
select is((select currency from public.households where name = 'B'), 'EUR', 'household B still counts in EUR');

select * from finish();
rollback;
