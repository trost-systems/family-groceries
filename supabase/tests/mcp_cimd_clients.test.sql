-- Job 94: the Client ID Metadata Document mapping (migration 20261104080000_mcp_cimd_clients.sql)
-- belongs to the mcp function's service connection. No client role reads or writes it, and only
-- https document URLs with at least one redirect URI fit.
begin;
select plan(13);

insert into public.oauth_cimd_clients (client_id, auth_client_id, client_name, redirect_uris, fresh_until)
values ('https://client.example/mcp.json', '00000000-0000-0000-0000-000000009401', 'Example',
  array['http://127.0.0.1:8976/callback'], now() + interval '1 hour');

select throws_ok($$ insert into public.oauth_cimd_clients (client_id, auth_client_id, client_name,
    redirect_uris, fresh_until) values ('http://client.example/mcp.json',
    '00000000-0000-0000-0000-000000009402', 'Plain', array['http://127.0.0.1/cb'], now()) $$,
  '23514', null, 'only https document URLs');
select throws_ok($$ insert into public.oauth_cimd_clients (client_id, auth_client_id, client_name,
    redirect_uris, fresh_until) values ('https://client.example/none.json',
    '00000000-0000-0000-0000-000000009403', 'None', array[]::text[], now()) $$,
  '23514', null, 'at least one redirect URI');
select throws_ok($$ insert into public.oauth_cimd_clients (client_id, auth_client_id, client_name,
    redirect_uris, fresh_until) values ('https://other.example/mcp.json',
    '00000000-0000-0000-0000-000000009401', 'Twin', array['http://127.0.0.1/cb'], now()) $$,
  '23505', null, 'one document URL per Supabase client');

-- The front's hourly limits: every key counts, the answer is false once any is over.
select is(public.oauth_cimd_rate_hit(array['fetch:a.example', 'fetch:all'], array[2, 10]), true, 'first fetch within limits');
select is(public.oauth_cimd_rate_hit(array['fetch:a.example', 'fetch:all'], array[2, 10]), true, 'second fetch within limits');
select is(public.oauth_cimd_rate_hit(array['fetch:a.example', 'fetch:all'], array[2, 10]), false, 'third fetch of a host is over');
select is(public.oauth_cimd_rate_hit(array['fetch:b.example', 'fetch:all'], array[2, 10]), true, 'another host still fetches');
insert into public.oauth_cimd_rate (key, window_start, hits) values ('new:old.example', now() - interval '3 hours', 9);
select public.oauth_cimd_rate_hit(array['new:c.example'], array[1]);
select is((select count(*)::int from public.oauth_cimd_rate where key = 'new:old.example'), 0, 'counters go after 2 hours');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000009404", "role": "authenticated"}', true);
select throws_ok($$ select * from public.oauth_cimd_clients $$, '42501', null,
  'a signed-in user reads no mapping');
select throws_ok($$ update public.oauth_cimd_clients set client_name = 'x' $$, '42501', null,
  'nor changes one');
select throws_ok($$ select public.oauth_cimd_rate_hit(array['token:x'], array[1000]) $$, '42501', null,
  'nor counts against the limits');

set local role anon;
select throws_ok($$ select * from public.oauth_cimd_clients $$, '42501', null, 'nor does anon');
select throws_ok($$ insert into public.oauth_cimd_clients (client_id, auth_client_id, client_name,
    redirect_uris, fresh_until) values ('https://evil.example/m.json',
    '00000000-0000-0000-0000-000000009405', 'Evil', array['https://evil.example/cb'], now()) $$,
  '42501', null, 'or registers one');

select * from finish();
rollback;
