-- Job 51 (Spec #9 AC3): the fifty most common English grocery words, as Siri hears them in English,
-- land in a sensible category through add_item, and keep their names as spoken.
begin;
select plan(52);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000051e1', 'english51@example.com');
select set_config('role', 'authenticated', true),
  set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000051e1", "role": "authenticated"}', true);
create temp table h as select id from public.create_household('English');
grant select on h to authenticated;

create temp table words (name text, seed text);
grant select on words to authenticated;
insert into words values
  ('milk', 'chilled'), ('eggs', 'chilled'), ('bread', 'bakery'), ('butter', 'chilled'),
  ('cheese', 'chilled'), ('yogurt', 'chilled'), ('cream', 'chilled'), ('apples', 'produce'),
  ('bananas', 'produce'), ('oranges', 'produce'), ('lemons', 'produce'), ('tomatoes', 'produce'),
  ('potatoes', 'produce'), ('onions', 'produce'), ('garlic', 'produce'), ('carrots', 'produce'),
  ('cucumbers', 'produce'), ('lettuce', 'produce'), ('spinach', 'produce'), ('broccoli', 'produce'),
  ('bell peppers', 'produce'), ('mushrooms', 'produce'), ('strawberries', 'produce'), ('grapes', 'produce'),
  ('chicken', 'meat'), ('beef', 'meat'), ('pork', 'meat'), ('bacon', 'meat'),
  ('ham', 'meat'), ('sausages', 'meat'), ('fish', 'meat'), ('salmon', 'meat'),
  ('rice', 'pantry'), ('pasta', 'pantry'), ('flour', 'pantry'), ('sugar', 'pantry'),
  ('salt', 'pantry'), ('coffee', 'pantry'), ('tea', 'pantry'), ('cereal', 'pantry'),
  ('oats', 'pantry'), ('honey', 'pantry'), ('jam', 'pantry'), ('juice', 'drinks'),
  ('water', 'drinks'), ('wine', 'drinks'), ('chocolate', 'sweets'), ('cookies', 'sweets'),
  ('chips', 'sweets'), ('toilet paper', 'household');

create temp table added as
select w.name, w.seed, a.name as stored, c.seed_key as category, a.categorized_via
from words w
cross join lateral public.add_item((select id from h), w.name) a
join public.categories c on c.id = a.category_id;
grant select on added to authenticated;

select is(category, seed, format('%s is %s', name, seed)) from added order by name;

select is(
  (select count(*)::int from added where stored = name and categorized_via <> 'fallback'),
  50, 'every name is stored as spoken, none by the fallback'
);

-- German stemming folds "beer" and "Beere" (berry) to one key; a synonym for beer would move
-- every berry to drinks.
select todo('beer shares its key with Beere', 1);
select is(
  (select c.seed_key from public.categories c
   where c.id = public.classify_item((select id from h), 'beer')),
  'drinks', 'beer is drinks'
);

select * from finish();
rollback;
