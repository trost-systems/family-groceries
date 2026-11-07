-- Job 151: a Baumarkt store seeds seven DIY categories, walks them first and takes DIY items as
-- dm takes drugstore items; without one, DIY words go to Haushalt.
begin;
select plan(42);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000151a01', 'sara@example.com'),
  ('00000000-0000-0000-0000-000000151b01', 'ben@example.com'),
  ('00000000-0000-0000-0000-000000151c01', 'cleo@example.com'),
  ('00000000-0000-0000-0000-000000151d01', 'dora@example.com');

-- A household's categories in route order, as seed keys (a name where there is none).
create function pg_temp.route(p_household uuid) returns text[] language sql as $$
  select array_agg(coalesce(seed_key, name) order by sort_order, name) from public.categories where household_id = p_household;
$$;
-- A store's walk as seed keys, hidden ones marked.
create function pg_temp.walk(p_store uuid) returns text[] language sql as $$
  select array_agg(coalesce(c.seed_key, c.name) || case when o.hidden then ' (hidden)' else '' end order by o.sort_order)
  from public.store_category_order o join public.categories c on c.id = o.category_id
  where o.store_id = p_store;
$$;
create function pg_temp.store(p_household uuid, p_name text) returns uuid language sql as $$
  select id from public.stores where household_id = p_household and name = p_name;
$$;
create function pg_temp.category(p_household uuid, p_seed text) returns uuid language sql as $$
  select id from public.categories where household_id = p_household and seed_key = p_seed;
$$;

-- Onboarding with a Baumarkt.
select pg_temp.login('00000000-0000-0000-0000-000000151a01');
select lives_ok(
  $$ create temp table hs as select id from public.create_household(p_name => 'Sara', p_stores => array['Lidl', 'Baumarkt']) $$,
  'onboarding creates a Baumarkt'
);
grant select on hs to authenticated;
create temp table baumarkt as select pg_temp.store((select id from hs), 'Baumarkt') as id;
grant select on baumarkt to authenticated;

select is((select seed_key from public.stores where id = (select id from baumarkt)), 'hardware', 'a Baumarkt is a hardware store');
select is(
  pg_temp.route((select id from hs)),
  array['produce', 'bakery', 'chilled', 'meat', 'pantry', 'sweets', 'drinks', 'frozen', 'household', 'drugstore',
    'paint', 'plumbing', 'electrical', 'tools', 'fasteners', 'building', 'garden', 'other'],
  'the seven DIY categories join the route in walk order, before Sonstiges'
);
select results_eq(
  $$ select name from public.categories where household_id = (select id from hs) and seed_key in
       (select seed_key from public.hardware_categories()) order by sort_order $$,
  $$ values ('Farben & Lacke'), ('Sanitär'), ('Elektro & Leuchtmittel'), ('Werkzeug'), ('Schrauben & Befestigung'),
       ('Holz & Baustoffe'), ('Garten & Pflanzen') $$,
  'with their German names'
);
select is(
  pg_temp.walk((select id from baumarkt)),
  array['paint', 'plumbing', 'electrical', 'tools', 'fasteners', 'building', 'garden', 'household', 'drinks', 'sweets',
    'other', 'produce (hidden)', 'bakery (hidden)', 'chilled (hidden)', 'meat (hidden)', 'pantry (hidden)',
    'frozen (hidden)', 'drugstore (hidden)'],
  'the Baumarkt walks paint first and hides the food and Drogerie'
);
select is(
  pg_temp.walk(pg_temp.store((select id from hs), 'Lidl')),
  array['bakery', 'produce', 'chilled', 'meat', 'pantry', 'sweets', 'drinks', 'frozen', 'household', 'drugstore',
    'paint', 'plumbing', 'electrical', 'tools', 'fasteners', 'building', 'garden', 'other'],
  'a store from before keeps its order, the new categories before Sonstiges'
);

-- Chains added after the Baumarkt.
create temp table chains as select public.add_store((select id from hs), 'Edeka') as edeka, public.add_store((select id from hs), 'dm') as dm;
grant select on chains to authenticated;
select is(
  pg_temp.walk((select edeka from chains)),
  array['produce', 'bakery', 'meat', 'chilled', 'pantry', 'sweets', 'frozen', 'drinks', 'household', 'drugstore',
    'paint', 'plumbing', 'electrical', 'tools', 'fasteners', 'building', 'garden', 'other'],
  'EDEKA lists the DIY categories in the Baumarkt walk before Sonstiges, as Lidl from before has them'
);
select is(
  pg_temp.walk((select dm from chains)),
  array['drugstore', 'pantry', 'sweets', 'household', 'drinks', 'paint', 'plumbing', 'electrical', 'tools', 'fasteners',
    'building', 'garden', 'other', 'produce (hidden)', 'bakery (hidden)', 'chilled (hidden)', 'meat (hidden)',
    'frozen (hidden)'],
  'dm lists them before Sonstiges too'
);


-- Idempotent.
select is(public.add_store((select id from hs), 'baumarkt '), (select id from baumarkt), 'adding "baumarkt " finds the Baumarkt');
select is((select count(*)::int from public.categories where household_id = (select id from hs)), 18, 'and seeds nothing again');
create temp table second as select public.add_store((select id from hs), 'Heimwerkermarkt') as id;
grant select on second to authenticated;
select is((select seed_key from public.stores where id = (select id from second)), null,
  'a second hardware-named store is an own store');
select is((select count(*)::int from public.categories where household_id = (select id from hs)), 18, 'and seeds nothing');
select is(pg_temp.walk((select id from second)), pg_temp.route((select id from hs)), 'it starts from the route order');
select lives_ok($$ select public.seed_hardware_categories((select id from hs)) $$, 'seeding again');
select is((select count(*)::int from public.categories where household_id = (select id from hs)), 18, 'changes nothing');

-- Classification: a household with the Baumarkt, one without.
select pg_temp.login('00000000-0000-0000-0000-000000151b01');
create temp table hb as select id from public.create_household(p_name => 'Ben', p_stores => array['dm', 'Lidl']);
grant select on hb to authenticated;
select pg_temp.login('00000000-0000-0000-0000-000000151a01');
set local role postgres;
select set_config('request.jwt.claims', '', true);

create temp table diy (name, seed) as values
  ('Wandfarbe', 'paint'), ('Lack', 'paint'), ('Pinsel', 'paint'), ('Farbrolle', 'paint'), ('Malerkrepp', 'paint'),
  ('Abdeckband', 'paint'), ('Tapete', 'paint'), ('Spachtelmasse', 'paint'), ('Lackspray', 'paint'), ('Holzlasur', 'paint'),
  ('Wasserhahn', 'plumbing'), ('Duschkopf', 'plumbing'), ('Mischbatterie', 'plumbing'), ('Silikon', 'plumbing'),
  ('Siphon', 'plumbing'), ('Klobrille', 'plumbing'), ('Duschschlauch', 'plumbing'), ('Dichtungsringe', 'plumbing'),
  ('Glühbirnen', 'electrical'), ('LED Birne', 'electrical'), ('LED', 'electrical'), ('LEDs', 'electrical'),
  ('Maurerkelle', 'tools'), ('Feile', 'tools'), ('Rigipsplatte', 'building'), ('Ösen', 'fasteners'), ('Stahlnägel', 'fasteners'), ('Drahtstifte', 'fasteners'), ('Verlängerungskabel', 'electrical'),
  ('Steckdosenleiste', 'electrical'), ('Kabelbinder', 'electrical'), ('Lichterkette', 'electrical'),
  ('Rauchmelder', 'electrical'), ('Taschenlampe', 'electrical'),
  ('Hammer', 'tools'), ('Akkuschrauber', 'tools'), ('Schraubenzieher', 'tools'), ('Schraubendreher', 'tools'),
  ('Rohrzange', 'tools'), ('Säge', 'tools'), ('Wasserwaage', 'tools'), ('Arbeitshandschuhe', 'tools'),
  ('Schrauben', 'fasteners'), ('Holzschrauben', 'fasteners'), ('Dübel', 'fasteners'), ('Nägel', 'fasteners'),
  ('Haken', 'fasteners'), ('Unterlegscheiben', 'fasteners'), ('Spanngurt', 'fasteners'),
  ('Dachlatten', 'building'), ('Holzlatte', 'building'), ('Zement', 'building'), ('Spanplatte', 'building'),
  ('Fliesenkleber', 'building'), ('Montageschaum', 'building'), ('Brennholz', 'building'),
  ('Blumenerde', 'garden'), ('Rasensamen', 'garden'), ('Dünger', 'garden'), ('Blumenzwiebeln', 'garden'),
  ('Gartenschlauch', 'garden'), ('Gießkanne', 'garden'), ('Tomatenpflanze', 'garden'), ('Gartenschere', 'garden');
create temp table controls (name, seed) as values
  ('Milch', 'chilled'), ('Nagellack', 'drugstore'), ('Nagelfeile', 'drugstore'), ('Nagelschere', 'drugstore'),
  ('Leinsamen', 'pantry'), ('Haarfarbe', 'drugstore'), ('Lebensmittelfarbe', 'pantry'), ('Pflanzenöl', 'pantry'),
  ('Birnen', 'produce'), ('Frühlingszwiebeln', 'produce'), ('Grillzange', 'household'), ('Käsehobel', 'household'),
  ('Backpinsel', 'household'), ('Rasierpinsel', 'drugstore'), ('Muttermilch', 'chilled'), ('Lampenöl', 'household'),
  ('Batterien', 'household'), ('Grillkohle', 'household'), ('Klebeband', 'household'), ('Gummihandschuhe', 'household'),
  ('Rasierschaum', 'drugstore'), ('Kehrschaufel', 'household'), ('Wäscheseil', 'household'), ('Haarlack', 'drugstore'),
  ('Wimpernfarbe', 'drugstore'), ('Bartfarbe', 'drugstore'), ('Eierfarbe', 'pantry'), ('Speisefarbe', 'pantry'),
  ('Puderpinsel', 'drugstore'), ('Grillpinsel', 'household'), ('Tortenschaufel', 'household'),
  ('Gurkenhobel', 'household'), ('Nagelzange', 'drugstore'), ('Hornhauthobel', 'drugstore'), ('Süßholz', 'sweets'),
  ('Basilikumpflanze', 'produce'), ('Kosmetikpinsel', 'drugstore'), ('Makeup-Pinsel', 'drugstore'),
  ('Rougepinsel', 'drugstore'), ('Kabukipinsel', 'drugstore'), ('Nagelpinsel', 'drugstore'),
  ('Schraubverschluss', 'household'), ('Silikonbackform', 'household'), ('Silikonspatel', 'household'),
  ('Blushpinsel', 'drugstore'), ('Lippenpinsel', 'drugstore'), ('Fächerpinsel', 'drugstore'), ('Teigspachtel', 'household'),
  ('Schraubgläser', 'household'), ('Fleischhammer', 'household'), ('Küchenzange', 'household'), ('Schokoglasur', 'pantry'),
  ('Lockenzange', 'drugstore'), ('Acrylnägel', 'drugstore'), ('Nudelholz', 'household'), ('Holzlöffel', 'household'),
  ('Holzbrett', 'household'), ('Holzschneidebrett', 'household'), ('Bilderrahmen', 'household'),
  ('Nagelhautöl', 'drugstore'), ('Nagelset', 'drugstore'), ('Nagelpolierer', 'drugstore'), ('Tellerlinsen', 'pantry'),
  ('Holzpfannenwender', 'household');

-- "name: got" for every row whose category's seed key is not the expected one.
create function pg_temp.misses(p_household uuid, p_rows text, p_without_diy boolean default false) returns text[]
language plpgsql as $$
declare
  v_misses text[];
begin
  execute format($q$
    select coalesce(array_agg(r.name || ': ' || coalesce(c.seed_key, '-') order by r.name), '{}')
    from %s r
    join public.categories c on c.id = public.classify_item($1, r.name)
    where c.seed_key is distinct from case
      when $2 and r.seed in (select seed_key from public.hardware_categories()) then 'household' else r.seed end
  $q$, p_rows) into v_misses using p_household, p_without_diy;
  return v_misses;
end $$;

select cmp_ok((select count(*)::int from diy), '>=', 40, 'the DIY table has 40+ items');
select is(pg_temp.misses((select id from hs), 'diy'), '{}', 'with a Baumarkt, DIY items take their DIY category');
select is(pg_temp.misses((select id from hb), 'diy', true), '{}', 'without one, they take Haushalt');
select is(
  (select array_agg(distinct d.via) from diy r cross join lateral public.classify_item_detail((select id from hb), r.name) d),
  array['exact'], 'found as dictionary words, not as the fallback'
);
select is(pg_temp.misses((select id from hs), 'controls'), '{}', 'groceries next to DIY words keep their category');
select is(pg_temp.misses((select id from hb), 'controls'), '{}', 'in a household without a Baumarkt too');
select is(
  (select count(*)::int from (values ('Latte Macchiato'), ('Fahrradschlauch'), ('Rote Bete')) r (name)
   join public.categories c on c.id = public.classify_item((select id from hs), r.name)
   where c.seed_key in (select seed_key from public.hardware_categories())),
  0, 'Latte Macchiato, Fahrradschlauch and Rote Bete are no DIY items'
);

-- The default store.
select pg_temp.login('00000000-0000-0000-0000-000000151a01');
select is((select store_id from public.parse_item((select id from hs), '10 Schrauben')), (select id from baumarkt),
  'a parsed DIY item goes to the Baumarkt');
select is((select store_id from public.parse_item((select id from hs), 'Zahnpasta')), (select dm from chains),
  'a drugstore item still goes to dm');
select is((select store_id from public.parse_item((select id from hs), 'Milch')), null, 'a grocery to no store');
select is(
  public.guess_store((select id from hs), 'Dübel', null, pg_temp.category((select id from hs), 'fasteners')),
  (select id from baumarkt), 'guess_store picks the Baumarkt for a DIY category'
);
select ok(
  'Holz' = any (select s.name from public.suggest_entries((select id from hs), 'Hol', 20) s where s.source = 'catalog'),
  'the catalog suggests DIY words in a household with the Baumarkt'
);
select pg_temp.login('00000000-0000-0000-0000-000000151b01');
select ok(
  'Holz' <> all (select s.name from public.suggest_entries((select id from hb), 'Hol', 20) s where s.source = 'catalog'),
  'and not to one without for a short prefix'
);
select ok(
  'Glühbirne' = any (select s.name from public.suggest_entries((select id from hb), 'Glühbi', 20) s where s.source = 'catalog'),
  'which still finds them from four letters on'
);
select pg_temp.login('00000000-0000-0000-0000-000000151a01');

-- Renaming.
select lives_ok($$ select public.rename_store((select id from baumarkt), 'Baumarkt Nord') $$, 'the Baumarkt is renamed');
select is((select seed_key from public.stores where id = (select id from baumarkt)), 'hardware', 'and stays a hardware store');
select lives_ok($$ select public.rename_store((select dm from chains), 'Rossmann') $$, 'dm is renamed');
select is((select seed_key from public.stores where id = (select dm from chains)), null, 'and is no longer dm');

-- A deleted DIY category stays deleted.
select lives_ok($$ select public.delete_category(pg_temp.category((select id from hs), 'paint')) $$, 'Farben & Lacke is deleted');
select lives_ok($$ select public.delete_store((select id from baumarkt)) $$, 'and the Baumarkt');
create temp table diy_store as select public.add_store((select id from hs), 'DIY Store') as id;
grant select on diy_store to authenticated;
select is((select seed_key from public.stores where id = (select id from diy_store)), 'hardware',
  'a store named "DIY Store" is the new hardware store');
select ok(
  not exists (select from public.categories where household_id = (select id from hs) and name = 'Farben & Lacke')
  and (select count(*)::int from public.categories where household_id = (select id from hs)) = 17,
  'without Farben & Lacke again'
);

-- A household's own categories: "Werkzeug" is adopted where it stands, a name taken by another
-- seeded category is left alone.
select pg_temp.login('00000000-0000-0000-0000-000000151c01');
create temp table hc as select id from public.create_household(p_name => 'Cleo');
grant select on hc to authenticated;
create temp table werkzeug as select (public.create_category((select id from hc), 'Werkzeug')).id;
grant select on werkzeug to authenticated;
update public.categories set name = 'Sanitär' where id = pg_temp.category((select id from hc), 'household');
select public.add_store((select id from hc), 'Hardware Store');
select is(
  pg_temp.route((select id from hc)),
  array['produce', 'bakery', 'chilled', 'meat', 'pantry', 'sweets', 'drinks', 'frozen', 'household', 'drugstore',
    'tools', 'paint', 'electrical', 'fasteners', 'building', 'garden', 'other'],
  'the own Werkzeug becomes tools in its place; Sanitär stays Haushalt and no plumbing comes'
);
select is(pg_temp.category((select id from hc), 'tools'), (select id from werkzeug), 'the same category, not a copy');

-- Stores named Baumarkt before (the migration's rule): seeding keeps the store's own order.
select pg_temp.login('00000000-0000-0000-0000-000000151d01');
create temp table hd as select id from public.create_household(p_name => 'Dora', p_stores => array['Rewe']);
grant select on hd to authenticated;
insert into public.stores (household_id, name, sort_order) select id, 'Baumarkt', 20 from hd;
select public.apply_store_layout(pg_temp.store((select id from hd), 'Baumarkt'));
select public.set_store_layout(
  pg_temp.store((select id from hd), 'Rewe'),
  (select array_agg(id order by seed_key = 'other', sort_order desc) from public.categories where household_id = (select id from hd)),
  '{}'
);
select pg_temp.login('00000000-0000-0000-0000-000000151a01');
select throws_ok($$ select public.seed_hardware_categories((select id from hd)) $$, '42501', 'not_a_member',
  'only a member seeds');
select pg_temp.login('00000000-0000-0000-0000-000000151d01');
update public.stores set seed_key = 'hardware' where id = pg_temp.store((select id from hd), 'Baumarkt');
select public.seed_hardware_categories((select id from hd));
select is(
  pg_temp.walk(pg_temp.store((select id from hd), 'Rewe')),
  array['drugstore', 'household', 'frozen', 'drinks', 'sweets', 'pantry', 'meat', 'chilled', 'bakery', 'produce',
    'paint', 'plumbing', 'electrical', 'tools', 'fasteners', 'building', 'garden', 'other'],
  'an ordered store keeps its order, the DIY categories before Sonstiges'
);
select is(pg_temp.walk(pg_temp.store((select id from hd), 'Baumarkt')), pg_temp.route((select id from hd)),
  'the old Baumarkt keeps its layout too: the walk is not re-applied');

select * from finish();
rollback;
