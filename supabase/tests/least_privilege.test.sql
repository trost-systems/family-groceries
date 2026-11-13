-- Job 220: anon and authenticated hold no privilege that row level security does not cover, on
-- today's tables and on the next one a migration creates.
begin;
select plan(9);

select is(
  (select array_agg(c.relname::text order by c.relname) from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm')
     and (has_table_privilege('anon', c.oid, 'truncate') or has_table_privilege('authenticated', c.oid, 'truncate')
       or has_table_privilege('anon', c.oid, 'references') or has_table_privilege('authenticated', c.oid, 'references')
       or has_table_privilege('anon', c.oid, 'trigger') or has_table_privilege('authenticated', c.oid, 'trigger'))),
  null, 'no table lets a client role truncate it, reference it or put a trigger on it'
);
select is(
  (select array_agg(c.relname::text order by c.relname) from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm')
     and (has_any_column_privilege('anon', c.oid, 'select, insert, update, references')
       or has_table_privilege('anon', c.oid, 'delete'))),
  null, 'signed out, no table or column is readable or writable'
);
select is(
  (select array_agg(c.relname::text order by c.relname) from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relkind = 'S'
     and (has_sequence_privilege('anon', c.oid, 'usage, select, update')
       or has_sequence_privilege('authenticated', c.oid, 'usage, select, update'))),
  null, 'no sequence is open to a client role'
);

-- What a signed-in SQL session could do before: empty a table past its policies, and rewind a
-- sequence so that the next insert collides.
set local role authenticated;
select throws_ok('truncate public.item_events', '42501', null, 'a signed-in user cannot truncate a table');
select throws_ok($$select setval('public.item_events_id_seq', 1, false)$$, '42501', null,
  'nor rewind a sequence');
reset role;

-- The event log still fills: its trigger function draws from the sequence as its owner.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000220a01', 'ada220@example.com');
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-000000220a01", "role": "authenticated"}', true);
set local role authenticated;
create temp table home as select id from public.create_household('Zweihundertzwanzig');
select lives_ok('insert into public.items (household_id, name) select id, ''Milch'' from home',
  'a member still adds an item');
reset role;
select is((select count(*)::int from public.item_events where household_id = (select id from home)), 1,
  'and the add is logged');

-- A table from a migration that forgets "revoke all ... from anon, authenticated".
create table public.job220_forgotten (id bigint generated always as identity primary key, note text);
select is(
  (select array_agg(g.grantee || ':' || g.privilege_type order by g.grantee, g.privilege_type)
   from information_schema.role_table_grants g
   where g.table_schema = 'public' and g.table_name = 'job220_forgotten' and g.grantee in ('anon', 'authenticated', 'PUBLIC')),
  null, 'a new table starts with nothing granted to the client roles'
);
select ok(
  not has_sequence_privilege('anon', 'public.job220_forgotten_id_seq', 'usage, select, update')
  and not has_sequence_privilege('authenticated', 'public.job220_forgotten_id_seq', 'usage, select, update'),
  'and so does its sequence'
);

select * from finish();
rollback;
