-- Job 15: public.parse_item splits an entry into Bezeichnung, Marke, Eigenschaften and Menge and
-- picks category and store (docs/design/h-satz-final/SPEC.md, section 3).
begin;
select plan(151);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;

create function pg_temp.store(p_household uuid, p_seed text) returns uuid language sql as $$
  select id from public.stores where household_id = p_household and seed_key = p_seed;
$$;

-- One parse as (name, brand, properties, quantity, store seed, category seed).
create function pg_temp.parsed(p_household uuid, p_text text) returns text language sql as $$
  select row(p.name, p.brand, p.properties, p.quantity, s.seed_key, c.seed_key)::text
  from public.parse_item(p_household, p_text) p
  left join public.stores s on s.id = p.store_id
  left join public.categories c on c.id = p.category_id;
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'carla@example.com'),
  ('00000000-0000-0000-0000-0000000000d1', 'dora@example.com');

select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
create temp table hd as select id from public.create_household('Dora');
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
create temp table hc as select id from public.create_household('Carla');
grant select on hc, hd to authenticated;

create temp table cases (ord serial, entry text, name text, brand text, properties text, quantity text, store text, category text);
grant select on cases to authenticated;
insert into cases (entry, name, brand, properties, quantity, store, category) values
  -- The examples the spec names.
  ('Windeln Pampers Größe 3', 'Windeln', 'Pampers', 'Größe 3', null, 'dm', 'drugstore'),
  ('2 l Milch 1,5 %', 'Milch', null, '1,5 %', '2 l', null, 'chilled'),
  ('Ja! Gouda gerieben', 'Gouda', 'Ja!', 'gerieben', null, null, 'chilled'),
  ('6 Eier bio', 'Eier', null, 'Bio', '6', null, 'chilled'),
  ('Zahnpasta Elmex', 'Zahnpasta', 'elmex', null, null, 'dm', 'drugstore'),
  ('Milch', 'Milch', null, null, null, null, 'chilled'),
  ('Brot', 'Brot', null, null, null, null, 'bakery'),
  -- An unknown brand stays in the name.
  ('Windeln Lillydoo Größe 4', 'Windeln Lillydoo', null, 'Größe 4', null, 'dm', 'drugstore'),
  -- Only a brand: its product, else the brand itself as the name.
  ('Pampers', 'Windeln', 'Pampers', null, null, 'dm', 'drugstore'),
  ('Tempo', 'Taschentücher', 'Tempo', null, null, 'dm', 'drugstore'),
  ('Zewa', 'Küchenrolle', 'Zewa', null, null, null, 'household'),
  ('Persil', 'Waschmittel', 'Persil', null, null, null, 'household'),
  ('Kerrygold', 'Butter', 'Kerrygold', null, null, null, 'chilled'),
  ('Becks', 'Bier', 'Beck''s', null, null, null, 'drinks'),
  ('Q-tips', 'Wattestäbchen', 'Q-tips', null, null, 'dm', 'drugstore'),
  ('Nutella', 'Nutella', null, null, null, null, 'pantry'),
  ('Nutella 2er Pack', 'Nutella', null, '2er Pack', null, null, 'pantry'),
  ('Pringles Paprika', 'Chips', 'Pringles', 'Paprika', null, null, 'sweets'),
  ('Milka Vollmilch', 'Schokolade', 'Milka', 'Vollmilch', null, null, 'sweets'),
  ('Hohes C Orange 1 l', 'Saft', 'Hohes C', 'Orange', '1 l', null, 'drinks'),
  ('Beck''s Alkoholfrei 6er', 'Bier', 'Beck''s', 'alkoholfrei, 6er', null, null, 'drinks'),
  ('Gerolsteiner Medium 6er Pack', 'Mineralwasser', 'Gerolsteiner', 'medium, 6er Pack', null, null, 'drinks'),
  -- Coca-Cola however it is written.
  ('Coca Cola', 'Cola', 'Coca-Cola', null, null, null, 'drinks'),
  ('Coca-Cola', 'Cola', 'Coca-Cola', null, null, null, 'drinks'),
  ('coca-cola zero', 'Cola', 'Coca-Cola', 'Zero', null, null, 'drinks'),
  ('Coca Cola Light 1,5 l', 'Cola', 'Coca-Cola', 'Light', '1,5 l', null, 'drinks'),
  ('2 Coca-Cola', 'Cola', 'Coca-Cola', null, '2', null, 'drinks'),
  ('Cola zero', 'Cola', null, 'Zero', null, null, 'drinks'),
  -- Brands anywhere, of one to three words, spelled loosely.
  ('Tempo Taschentücher', 'Taschentücher', 'Tempo', null, null, 'dm', 'drugstore'),
  ('Taschentücher Tempo 30er Pack', 'Taschentücher', 'Tempo', '30er Pack', null, 'dm', 'drugstore'),
  ('Dr Oetker Pudding Vanille', 'Pudding', 'Dr. Oetker', 'Vanille', null, null, 'chilled'),
  ('Ritter Sport Haselnuss', 'Schokolade', 'Ritter Sport', 'Haselnuss', null, null, 'sweets'),
  ('Shampoo Head & Shoulders', 'Shampoo', 'Head & Shoulders', null, null, 'dm', 'drugstore'),
  ('Zahnbürste Oral-B medium', 'Zahnbürste', 'Oral-B', 'medium', null, 'dm', 'drugstore'),
  ('Jacobs Kaffee gemahlen 500 g', 'Kaffee', 'Jacobs', 'gemahlen', '500 g', null, 'pantry'),
  ('Alpro Haferdrink', 'Haferdrink', 'Alpro', null, null, null, 'chilled'),
  ('Hafermilch Oatly', 'Hafermilch', 'Oatly', null, null, null, 'chilled'),
  ('Lenor Weichspüler', 'Weichspüler', 'Lenor', null, null, null, 'household'),
  ('Sekt Rotkäppchen', 'Sekt', 'Rotkäppchen', null, null, null, 'drinks'),
  ('Haferflocken Kölln zart', 'Haferflocken', 'Kölln', 'zart', null, null, 'pantry'),
  -- Store brands bring their store.
  ('Balea Duschgel', 'Duschgel', 'Balea', null, null, 'dm', 'drugstore'),
  ('alverde Shampoo', 'Shampoo', 'alverde', null, null, 'dm', 'drugstore'),
  ('Babylove Feuchttücher sensitiv', 'Feuchttücher', 'Babylove', 'sensitiv', null, 'dm', 'drugstore'),
  ('Milbona Skyr', 'Skyr', 'Milbona', null, null, 'lidl', 'chilled'),
  ('Dentalux Zahnpasta', 'Zahnpasta', 'Dentalux', null, null, 'lidl', 'drugstore'),
  ('Gut & Günstig Butter', 'Butter', 'Gut & Günstig', null, null, 'edeka', 'chilled'),
  ('Gut&Günstig Milch', 'Milch', 'Gut & Günstig', null, null, 'edeka', 'chilled'),
  ('Edeka Bio Eier', 'Eier', 'Edeka Bio', null, null, 'edeka', 'chilled'),
  -- Words that are not brands.
  ('Ja Milch', 'Ja Milch', null, null, null, null, 'chilled'),
  ('Bio Milch', 'Milch', null, 'Bio', null, null, 'chilled'),
  ('Kinder Zahnpasta', 'Kinder Zahnpasta', null, null, null, 'dm', 'drugstore'),
  ('Zahnpasta Kinder', 'Zahnpasta', null, 'Kinder', null, 'dm', 'drugstore'),
  -- Menge: leading numbers and number words, trailing amounts with a unit.
  ('zwei Gurken', 'Gurken', null, null, '2', null, 'produce'),
  ('Zwölf Eier', 'Eier', null, null, '12', null, 'chilled'),
  ('eine Packung Eier', 'Eier', null, null, '1 Packung', null, 'chilled'),
  ('3x Joghurt', 'Joghurt', null, null, '3', null, 'chilled'),
  ('500g Mehl', 'Mehl', null, null, '500 g', null, 'pantry'),
  ('Hack 500 g', 'Hack', null, null, '500 g', null, 'meat'),
  ('Mehl 1 kg', 'Mehl', null, null, '1 kg', null, 'pantry'),
  ('Äpfel 2 kg', 'Äpfel', null, null, '2 kg', null, 'produce'),
  ('Feta 2 Packungen', 'Feta', null, null, '2 Packungen', null, 'chilled'),
  ('Thunfisch 3 Dosen', 'Thunfisch', null, null, '3 Dosen', null, 'pantry'),
  ('Gouda jung 400 g', 'Gouda', null, 'jung', '400 g', null, 'chilled'),
  ('Zucker fein 1 kg', 'Zucker', null, 'fein', '1 kg', null, 'pantry'),
  ('Eis Vanille 2 Packungen', 'Eis', null, 'Vanille', '2 Packungen', null, 'frozen'),
  -- The counting nouns the voice splitter knows are units here too.
  ('3 Paar Socken', 'Socken', null, null, '3 Paar', null, 'other'),
  ('ein Paar Schnürsenkel', 'Schnürsenkel', null, null, '1 Paar', null, 'other'),
  ('ein Dutzend Eier', 'Eier', null, null, '1 Dutzend', null, 'chilled'),
  ('2 Kopf Salat', 'Salat', null, null, '2 Kopf', null, 'produce'),
  ('Brot 1 Laib', 'Brot', null, null, '1 Laib', null, 'bakery'),
  -- A further amount is an Eigenschaft.
  ('2 Milch 1 l', 'Milch', null, '1 l', '2', null, 'chilled'),
  ('Milch 1,5% 2 Liter', 'Milch', null, '1,5 %', '2 Liter', null, 'chilled'),
  -- Sizes, packs, percentages, rolls and plies.
  ('Windeln Größe 4', 'Windeln', null, 'Größe 4', null, 'dm', 'drugstore'),
  ('Windeln Gr. 5+ Big Pack', 'Windeln', null, 'Größe 5+, Big Pack', null, 'dm', 'drugstore'),
  ('4er Pack Joghurt', 'Joghurt', null, '4er Pack', null, null, 'chilled'),
  ('Joghurt 3,8 %', 'Joghurt', null, '3,8 %', null, null, 'chilled'),
  ('Milch 3,5% Fett', 'Milch', null, '3,5 % Fett', null, null, 'chilled'),
  ('Toilettenpapier 16 Rollen 3-lagig', 'Toilettenpapier', null, '16 Rollen, 3-lagig', null, null, 'household'),
  ('Klopapier 3 lagig', 'Klopapier', null, '3-lagig', null, null, 'household'),
  ('Mehl Typ 405', 'Mehl Typ 405', null, null, null, null, 'pantry'),
  ('Größe 3', 'Größe 3', null, null, null, null, 'other'),
  -- Descriptors and flavours after a name word; frozen markers stay in the name.
  ('Kaffee ganze Bohne', 'Kaffee', null, 'ganze Bohne', null, null, 'pantry'),
  ('Wasser still', 'Wasser', null, 'still', null, null, 'drinks'),
  ('Milch laktosefrei', 'Milch', null, 'laktosefrei', null, null, 'chilled'),
  ('Nudeln glutenfrei', 'Nudeln', null, 'glutenfrei', null, null, 'pantry'),
  ('Quark mager', 'Quark', null, 'mager', null, null, 'chilled'),
  ('Schokolade Zartbitter', 'Schokolade', null, 'Zartbitter', null, null, 'sweets'),
  ('Joghurt Erdbeere', 'Joghurt', null, 'Erdbeere', null, null, 'chilled'),
  ('Saft Multivitamin', 'Saft', null, 'Multivitamin', null, null, 'drinks'),
  ('Spinat TK', 'Spinat TK', null, null, null, null, 'frozen'),
  -- A brand with a product and one name word of another kind (food, drinks, non-food) or none
  -- the dictionary knows: the word is the variety.
  ('Whiskas Lachs', 'Katzenfutter', 'Whiskas', 'Lachs', null, null, 'household'),
  ('Sheba Thunfisch sensitiv', 'Katzenfutter', 'Sheba', 'Thunfisch, sensitiv', null, null, 'household'),
  ('Pedigree Dentastix', 'Hundefutter', 'Pedigree', 'Dentastix', null, null, 'household'),
  ('Animonda Rind', 'Katzenfutter', 'Animonda', 'Rind', null, null, 'household'),
  ('Hohes C Ananas', 'Saft', 'Hohes C', 'Ananas', null, null, 'drinks'),
  ('Persil Color', 'Waschmittel', 'Persil', 'Color', null, null, 'household'),
  ('Jacobs Krönung 500 g', 'Kaffee', 'Jacobs', 'Krönung', '500 g', null, 'pantry'),
  ('Haribo Phantasia', 'Gummibärchen', 'Haribo', 'Phantasia', null, null, 'sweets'),
  -- Of the same kind it is the product.
  ('Whiskas Trockenfutter', 'Trockenfutter', 'Whiskas', null, null, null, 'household'),
  ('Pampers Feuchttücher', 'Feuchttücher', 'Pampers', null, null, 'dm', 'drugstore'),
  ('Zewa Feuchttücher', 'Feuchttücher', 'Zewa', null, null, 'dm', 'drugstore'),
  ('Krombacher Radler', 'Radler', 'Krombacher', null, null, null, 'drinks'),
  ('Wagner Flammkuchen', 'Flammkuchen', 'Wagner', null, null, null, 'chilled'),
  ('Haribo Goldbären', 'Goldbären', 'Haribo', null, null, null, 'sweets'),
  ('Pampers Baby Dry', 'Windeln', 'Pampers', 'Baby Dry', null, 'dm', 'drugstore'),
  ('Rama Cremefine', 'Cremefine', 'Rama', null, null, null, 'chilled'),
  ('Teekanne Eistee', 'Eistee', 'Teekanne', null, null, null, 'drinks'),
  -- Review 0 and 1: leading descriptors, letter sizes, multipacks, the first amount is the Menge
  -- wherever it stands, halves, list punctuation kept in the name.
  ('Bio Eier Größe M 10er', 'Eier', null, 'Bio, Größe M, 10er', null, null, 'chilled'),
  ('T-Shirt Größe XL', 'T-Shirt', null, 'Größe XL', null, null, 'other'),
  ('Wasser still 6x1,5l', 'Wasser', null, 'still, 6x1,5 l', null, null, 'drinks'),
  ('Wasser 6 x 1,5 l', 'Wasser', null, '6x1,5 l', null, null, 'drinks'),
  ('Joghurt Erdbeere 4x125g', 'Joghurt', null, 'Erdbeere, 4x125 g', null, null, 'chilled'),
  ('Bier Krombacher 24x0,33l', 'Bier', 'Krombacher', '24x0,33 l', null, null, 'drinks'),
  ('Äpfel 1 kg bio', 'Äpfel', null, 'Bio', '1 kg', null, 'produce'),
  ('1 kg Mehl Type 405', 'Mehl Type 405', null, null, '1 kg', null, 'pantry'),
  ('Cola 0,5 l', 'Cola', null, null, '0,5 l', null, 'drinks'),
  ('2x Cola 0,5 l', 'Cola', null, '0,5 l', '2', null, 'drinks'),
  ('Cola Zero 0,5l', 'Cola', null, 'Zero', '0,5 l', null, 'drinks'),
  ('Duschgel Balea 300 ml', 'Duschgel', 'Balea', null, '300 ml', 'dm', 'drugstore'),
  ('Spülmittel Pril 2x', 'Spülmittel', 'Pril', null, '2', null, 'household'),
  ('ein halbes Brot', 'Brot', null, null, '1/2', null, 'bakery'),
  ('ein halbes Kilo Hack', 'Hack', null, null, '0,5 Kilo', null, 'meat'),
  ('anderthalb Liter Milch', 'Milch', null, null, '1,5 Liter', null, 'chilled'),
  ('eineinhalb Liter Milch', 'Milch', null, null, '1,5 Liter', null, 'chilled'),
  ('Tomaten, Gurke', 'Tomaten, Gurke', null, null, null, null, 'produce'),
  ('Tomaten , Gurke', 'Tomaten, Gurke', null, null, null, null, 'produce'),
  ('Milch und Brot', 'Milch und Brot', null, null, null, null, 'chilled'),
  ('Paprika rot', 'Paprika rot', null, null, null, null, 'produce'),
  ('Bio', 'Bio', null, null, null, null, 'other'),
  -- A brand without a product: as before.
  ('Milbona Lachs', 'Lachs', 'Milbona', null, null, 'lidl', 'meat');

select is(pg_temp.parsed((select id from hc), c.entry),
          row(c.name, c.brand, c.properties, c.quantity, c.store, c.category)::text,
          format('parse_item(%L)', c.entry))
from cases c order by c.ord;

select is((select name from public.parse_item((select id from hc), '   ')), '', 'a blank entry has an empty name');

-- A brand written on an item is learned for the household; a known brand is not.
insert into public.items (household_id, name, brand) select id, 'Windeln', 'Lillydoo' from hc;
insert into public.items (household_id, name, brand) select id, 'Windeln', 'Pampers' from hc;
select is(pg_temp.parsed((select id from hc), 'Windeln Lillydoo Größe 4'),
          row('Windeln', 'Lillydoo', 'Größe 4', null, 'dm', 'drugstore')::text,
          'a learned brand is split off');
select is(pg_temp.parsed((select id from hc), 'lillydoo'), row('lillydoo', null, null, null, null, 'other')::text,
          'a learned brand alone stays the name');
select is(pg_temp.parsed((select id from hc), 'Lillydoo sensitiv'),
          row('Lillydoo', null, 'sensitiv', null, null, 'other')::text,
          'a learned brand with only properties stays the name');

select results_eq(
  $$ select brand_key, brand, uses from public.household_brands $$,
  $$ values ('lillydoo', 'Lillydoo', 1) $$,
  'only the unknown brand is learned'
);
update public.items set brand = 'LillyDoo' where brand = 'Lillydoo';
select results_eq(
  $$ select brand, uses from public.household_brands $$,
  $$ values ('LillyDoo', 2) $$,
  'the latest spelling wins and uses count up'
);
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select is(pg_temp.parsed((select id from hd), 'Windeln Lillydoo Größe 4'),
          row('Windeln Lillydoo', null, 'Größe 4', null, 'dm', 'drugstore')::text,
          'another household has not learned it');
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');

-- A word the parser or the classifier knows is not learned as a brand; the item keeps it.
insert into public.items (household_id, name, brand)
select hc.id, b.name, b.brand from hc,
  (values ('Hafer', 'Milch'), ('Joghurt', 'Erdbeere'), ('Zucker', 'ohne Zucker'), ('Eier', 'zwei'),
          ('Wasser', '6er'), ('Gurken', 'Gurke'), ('Milch', 'Bio Milch'), ('Milch', 'Stück')) as b (name, brand);
select is((select count(*)::int from public.items where brand in ('Milch', 'Erdbeere', 'ohne Zucker', 'zwei', '6er',
           'Gurke', 'Bio Milch', 'Stück')), 8, 'the items keep the brand they were given');
insert into public.items (household_id, name, brand) select id, 'Windeln', 'Lillydoo Natur' from hc;
select results_eq(
  $$ select brand from public.household_brands order by brand $$,
  $$ values ('LillyDoo'), ('Lillydoo Natur') $$,
  'ordinary words are not learned; a brand with one ordinary word is'
);
select is(pg_temp.parsed((select id from hc), 'Hafer Milch'), row('Hafer Milch', null, null, null, null, 'chilled')::text,
          '"Hafer Milch" keeps its name');
-- A brand learned before its word reached the dictionary is passed over.
reset role;
insert into public.household_brands (household_id, brand_key, brand) select id, 'milch', 'Milch' from hc on conflict do nothing;
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
select is(pg_temp.parsed((select id from hc), 'Hafer Milch'), row('Hafer Milch', null, null, null, null, 'chilled')::text,
          'a learned brand that is an ordinary word is not split off');

-- Laden: the item's store memory beats the brand's store and the category hint.
insert into public.items (household_id, name) select id, 'Zahnpasta' from hc;
update public.items set store_id = pg_temp.store(household_id, 'edeka') where name = 'Zahnpasta';
select is(pg_temp.parsed((select id from hc), 'Zahnpasta Elmex'),
          row('Zahnpasta', 'elmex', null, null, 'edeka', 'drugstore')::text,
          'the remembered store beats the drugstore hint');
select is(pg_temp.parsed((select id from hc), 'Dentalux Zahnpasta'),
          row('Zahnpasta', 'Dentalux', null, null, 'edeka', 'drugstore')::text,
          'and the store brand');
delete from public.stores where id = pg_temp.store((select id from hc), 'dm');
select is(pg_temp.parsed((select id from hc), 'Windeln'), row('Windeln', null, null, null, null, 'drugstore')::text,
          'without a dm store the hint gives no store');

-- Brand keys fold spelling.
select is(public.brand_key(a), public.brand_key(b), format('%s = %s', a, b))
from (values ('Coca Cola', 'Coca-Cola'), ('Dr. Oetker', 'Dr Oetker'), ('Beck''s', 'Becks'),
             ('Müller', 'Mueller'), ('L''Oréal', 'LOREAL')) as t (a, b);
select isnt(public.brand_key('Ja!'), public.brand_key('Ja'), 'Ja! and Ja differ');

select throws_ok(
  $$ select * from public.parse_item((select id from hd), 'Milch') $$,
  '42501', 'not_a_member', 'parsing for another household is denied'
);

select * from finish();
rollback;
