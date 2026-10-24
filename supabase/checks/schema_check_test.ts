import { assertEquals, assertMatch } from '@std/assert';
import { checkHistory, checkIgnores, checkTables, compat, statements } from './schema_check.ts';

const root = new URL('../', import.meta.url);

async function readDir(dir: string, suffix: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  for await (const e of Deno.readDir(new URL(dir, root))) {
    if (e.name.endsWith(suffix)) {
      files.set(e.name, await Deno.readTextFile(new URL(`${dir}/${e.name}`, root)));
    }
  }
  return files;
}

const repoMigrations = await readDir('migrations', '.sql');
const repoTests = await readDir('tests', '.test.sql');

const messages = (findings: { file: string; message: string }[]) =>
  findings.map((f) => `${f.file}: ${f.message}`);

Deno.test('history: an unchanged tree and a newer migration pass', () => {
  const base = new Map([['20261022150000_foundation.sql', 'create table a ();']]);
  const tree = new Map([...base, ['20261024190000_next.sql', 'select 1;']]);
  assertEquals(checkHistory(base, tree), []);
});

Deno.test('history: a migration on main that is edited or deleted fails', () => {
  const base = new Map([
    ['20261022150000_foundation.sql', 'create table a ();'],
    ['20261022190000_more.sql', 'select 1;'],
  ]);
  const tree = new Map([['20261022150000_foundation.sql', 'create table a ();\n-- edit']]);
  const found = messages(checkHistory(base, tree));
  assertEquals(found.length, 2);
  assertMatch(found[0], /^20261022150000_foundation\.sql: is on main and was modified/);
  assertMatch(found[1], /^20261022190000_more\.sql: is on main and was deleted/);
});

Deno.test('history: a new migration older than main newest, a bad name or a twin fails', () => {
  const base = new Map([['20261023000000_b.sql', '']]);
  const tree = new Map([
    ...base,
    ['20261022000000_a.sql', ''],
    ['20261024000000_c.sql', ''],
    ['20261024000000_d.sql', ''],
    ['probe.sql', ''],
  ]);
  const found = messages(checkHistory(base, tree));
  assertEquals(found.length, 3);
  assertMatch(found[0], /^20261022000000_a\.sql: sorts before 20261023000000_b\.sql/);
  assertMatch(found[1], /^20261024000000_d\.sql: has the same version as 20261024000000_c\.sql/);
  assertMatch(found[2], /^probe\.sql: is not named/);
});

Deno.test("tables: the repository's own migrations and tests pass", () => {
  assertEquals(checkTables(repoMigrations, repoTests), []);
});

const crossHouseholdTest = new Map([[
  'rls.test.sql',
  `select public.create_household('A'); select public.create_household('B');
   select is((select count(*)::int from public.foo), 0, 'foo of another household is invisible');`,
]]);
const withMigration = (sql: string) =>
  new Map([...repoMigrations, ['20261024190000_foo.sql', sql]]);

Deno.test('tables: a household table needs RLS, a member policy and a cross-household test', () => {
  const found = messages(checkTables(
    withMigration('create table public.foo (id uuid primary key, household_id uuid not null);'),
    repoTests,
  ));
  assertEquals(found.length, 3);
  assertMatch(found[0], /public\.foo does not enable row level security/);
  assertMatch(found[1], /public\.foo has household_id but no policy using/);
  assertMatch(found[2], /add a cross-household case for public\.foo/);
});

const complete = `
create table public.foo (id uuid primary key, household_id uuid not null references public.households);
alter table public.foo enable row level security;
create policy foo_member on public.foo for select to authenticated
  using (public.is_household_member(household_id));`;

Deno.test('tables: a complete household table passes', () => {
  assertEquals(
    checkTables(withMigration(complete), new Map([...repoTests, ...crossHouseholdTest])),
    [],
  );
});

Deno.test('tables: a test with only one household does not count as cross-household', () => {
  const oneHousehold = new Map([[
    'foo.test.sql',
    `select public.create_household('A'); select count(*) from public.foo;`,
  ]]);
  const found = messages(
    checkTables(withMigration(complete), new Map([...repoTests, ...oneHousehold])),
  );
  assertEquals(found.length, 1);
  assertMatch(found[0], /no pgTAP test with two households touches it/);
});

Deno.test('tables: policies in comments, strings or function bodies do not count', () => {
  const found = messages(checkTables(
    withMigration(`
create table public.foo (id uuid, household_id uuid);
alter table public.foo enable row level security;
-- create policy foo_member on public.foo using (public.is_household_member(household_id));
/* create policy foo_member on public.foo using (public.is_household_member(household_id)); */
create function public.later() returns void language plpgsql as $fn$
begin
  execute 'create policy foo_member on public.foo using (public.is_household_member(household_id))';
end $fn$;
create policy foo_any on public.foo for select using (true);`),
    new Map([...repoTests, ...crossHouseholdTest]),
  ));
  assertEquals(found.length, 1);
  assertMatch(found[0], /no policy using/);
});

Deno.test('tables: later migrations that drop the policy or disable RLS fail', () => {
  const tree = new Map([
    ...withMigration(complete),
    [
      '20261024200000_undo.sql',
      'drop policy foo_member on public.foo; alter table public.foo disable row level security;',
    ],
  ]);
  const found = messages(checkTables(tree, new Map([...repoTests, ...crossHouseholdTest])));
  assertEquals(found.length, 2);
  assertMatch(found[0], /does not enable row level security/);
  assertMatch(found[1], /no policy using/);
});

Deno.test('tables: household_id added later, renames and drops are followed', () => {
  const tree = new Map([
    ...repoMigrations,
    [
      '20261024190000_bar.sql',
      'create table public.bar (id uuid); alter table public.bar enable row level security;',
    ],
    ['20261024200000_bar_household.sql', 'alter table public.bar add column household_id uuid;'],
    ['20261024210000_baz.sql', 'create table baz (id uuid); drop table if exists public.baz;'],
    ['20261024220000_rename.sql', 'alter table public.bar rename to foo;'],
    ['20261024230000_private.sql', 'create table private.secret (household_id uuid);'],
  ]);
  const found = messages(checkTables(tree, new Map([...repoTests, ...crossHouseholdTest])));
  assertEquals(found.length, 1);
  assertMatch(found[0], /^20261024190000_bar\.sql: public\.foo has household_id but no policy/);
});

Deno.test('statements: strings with quotes and semicolons stay inside one statement', () => {
  assertEquals(statements("insert into t values ('a;''b'); -- c;\nselect 1;"), [
    "insert into t values ('')",
    'select 1',
  ]);
});

async function squawk(sql: string) {
  const dir = await Deno.makeTempDir();
  const file = `${dir}/20261024190000_probe.sql`;
  await Deno.writeTextFile(file, sql);
  const { stdout } = await new Deno.Command('squawk', { args: ['--reporter', 'json', file] })
    .output();
  await Deno.remove(dir, { recursive: true });
  return messages(compat(JSON.parse(new TextDecoder().decode(stdout))));
}

Deno.test('squawk: dropping or renaming a column and a NOT NULL column without default fail', async () => {
  const found = await squawk(`
alter table items drop column quantity;
alter table public.items rename column name to title;
alter table public.items add column note text not null;`);
  assertEquals(found.length, 3);
  assertMatch(found[0], /_probe\.sql:2: ban-drop-column: /);
  assertMatch(found[1], /_probe\.sql:3: renaming-column: /);
  assertMatch(found[2], /_probe\.sql:4: adding-required-field: /);
});

Deno.test('squawk: lock, timeout and style rules are off', async () => {
  assertEquals(
    await squawk(`
create table public.foo (id serial primary key, name varchar(10));
create index foo_name on public.foo (name);
alter table public.items add column note text not null default '';
alter table public.items add constraint q check (quantity > 0);`),
    [],
  );
});

Deno.test('squawk: an inline ignore silences its rule', async () => {
  assertEquals(
    await squawk(
      '-- squawk-ignore ban-drop-column -- quantity moved to qty, no build reads it\n' +
        'alter table public.items drop column quantity;\n',
    ),
    [],
  );
});

Deno.test('ignores: a squawk-ignore needs its reason after the rule', () => {
  const found = messages(checkIgnores(
    new Map([[
      '20261024190000_probe.sql',
      '-- squawk-ignore ban-drop-column\nselect 1;\n' +
      '-- squawk-ignore ban-drop-column -- quantity moved to qty, no build reads it\nselect 2;',
    ]]),
  ));
  assertEquals(found.length, 1);
  assertMatch(found[0], /^20261024190000_probe\.sql:1: a squawk-ignore without its reason/);
  assertEquals(checkIgnores(repoMigrations), []);
});

Deno.test('tables: a copy made with like inherits household_id, but not RLS or policies', () => {
  const found = messages(checkTables(
    withMigration('create table public.items_archive (like public.items including all);'),
    new Map([...repoTests, ...crossHouseholdTest]),
  ));
  assertEquals(found.length, 3);
  assertMatch(found[0], /public\.items_archive does not enable row level security/);
  assertMatch(found[1], /public\.items_archive has household_id but no policy using/);
  assertMatch(found[2], /add a cross-household case for public\.items_archive/);
});
