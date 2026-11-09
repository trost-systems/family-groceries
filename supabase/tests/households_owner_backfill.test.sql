-- Job 169b review.0: households whose owner left before 169b get an owner again.
begin;
select plan(5);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000169c01', 'a169c@example.com'),
  ('00000000-0000-0000-0000-000000169c02', 'b169c@example.com'),
  ('00000000-0000-0000-0000-000000169c03', 'c169c@example.com');
insert into public.households (id, name, created_by) values
  ('00000000-0000-0000-0000-00000169c0a1', 'Ohne Besitzer', '00000000-0000-0000-0000-000000169c01'),
  ('00000000-0000-0000-0000-00000169c0a2', 'Mit Besitzer', '00000000-0000-0000-0000-000000169c01');
-- The creator left before 169b: only members stay, Bea joined before Carl.
insert into public.household_members (household_id, user_id, role, joined_at) values
  ('00000000-0000-0000-0000-00000169c0a1', '00000000-0000-0000-0000-000000169c03', 'member', now() - interval '1 day'),
  ('00000000-0000-0000-0000-00000169c0a1', '00000000-0000-0000-0000-000000169c02', 'member', now() - interval '2 days'),
  ('00000000-0000-0000-0000-00000169c0a2', '00000000-0000-0000-0000-000000169c01', 'owner', now() - interval '3 days'),
  ('00000000-0000-0000-0000-00000169c0a2', '00000000-0000-0000-0000-000000169c02', 'member', now() - interval '1 day');

select is(public.repair_ownerless_households(), 1, 'one household without an owner is repaired');
select is((select user_id from public.household_members
  where household_id = '00000000-0000-0000-0000-00000169c0a1' and role = 'owner'),
  '00000000-0000-0000-0000-000000169c02'::uuid, 'its earliest-joined member owns it');
select is((select role from public.household_members
  where household_id = '00000000-0000-0000-0000-00000169c0a1' and user_id = '00000000-0000-0000-0000-000000169c03'),
  'member', 'the others stay members');
select is((select count(*)::int from public.household_members
  where household_id = '00000000-0000-0000-0000-00000169c0a2' and role = 'owner'), 1,
  'a household with an owner keeps exactly that one');
select is(public.repair_ownerless_households(), 0, 'a second run changes nothing');

select * from finish();
rollback;
