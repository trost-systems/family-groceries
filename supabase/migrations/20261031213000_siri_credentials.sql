-- Job 51: a "Siri on this iPhone" credential. The app mints it from its signed-in session and
-- keeps it in the iOS Keychain; the native Siri intents send it to the voice function. It is a
-- personal access token of kind 'siri', bound to the Supabase session that created it: signing
-- out on that iPhone (GoTrue deletes the session), deleting the account (cascade) or leaving the
-- household ends it. Only functions that opt in accept it (_shared/auth.ts).

alter table public.personal_access_tokens
  add column kind text not null default 'pat' check (kind in ('pat', 'siri')),
  add column session_id uuid;

grant select (kind) on public.personal_access_tokens to authenticated;

-- PATs are limited to 20; Siri credentials have their own cap in create_siri_credential.
create or replace function public.create_personal_access_token(p_name text)
returns table (id uuid, name text, token text)
language plpgsql security definer set search_path = '' as $$
declare
  v_household uuid;
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select m.household_id into v_household from public.household_members m where m.user_id = auth.uid();
  if v_household is null then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  if (select count(*) from public.personal_access_tokens t
      where t.user_id = auth.uid() and t.revoked_at is null and t.kind = 'pat') >= 20 then
    raise exception 'too_many_tokens' using errcode = 'P0001';
  end if;
  -- 32 random bytes, base64url without padding: 43 characters after the prefix.
  v_token := 'fgp_' || rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  return query
  insert into public.personal_access_tokens as t (household_id, user_id, name, token_hash, token_hint)
  values (
    v_household,
    auth.uid(),
    coalesce(nullif(btrim(p_name), ''), 'Token'),
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    right(v_token, 4)
  )
  returning t.id, t.name, v_token;
end $$;

-- The app's own session only: no OAuth client, no token. p_replace (this iPhone's previous
-- credential) is revoked; a user keeps at most five active Siri credentials, the newest.
create function public.create_siri_credential(p_replace uuid default null)
returns table (id uuid, token text)
language plpgsql security definer set search_path = '' as $$
declare
  v_claims jsonb := coalesce(auth.jwt(), '{}'::jsonb);
  v_session uuid;
  v_household uuid;
  v_token text;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_claims ? 'client_id' then
    raise exception 'session_required' using errcode = '42501';
  end if;
  v_session := nullif(v_claims ->> 'session_id', '')::uuid;
  if v_session is null then
    raise exception 'session_required' using errcode = '42501';
  end if;
  select m.household_id into v_household from public.household_members m where m.user_id = auth.uid();
  if v_household is null then
    raise exception 'not_a_member' using errcode = '42501';
  end if;

  update public.personal_access_tokens t set revoked_at = now()
  where t.id = p_replace and t.user_id = auth.uid() and t.kind = 'siri' and t.revoked_at is null;

  v_token := 'fgp_' || rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  -- clock_timestamp: several credentials made in one transaction still sort by age for the cap.
  insert into public.personal_access_tokens as t
    (household_id, user_id, name, token_hash, token_hint, kind, session_id, created_at)
  values (
    v_household,
    auth.uid(),
    'Siri',
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    right(v_token, 4),
    'siri',
    v_session,
    clock_timestamp()
  )
  returning t.id into v_id;

  update public.personal_access_tokens t set revoked_at = now()
  where t.id in (
    select s.id from public.personal_access_tokens s
    where s.user_id = auth.uid() and s.kind = 'siri' and s.revoked_at is null and s.id <> v_id
    order by s.created_at desc, s.id desc
    offset 4
  );

  return query select v_id, v_token;
end $$;

-- For edge functions: a token hash to its user, household and kind, or nothing when the token is
-- unknown, revoked, its creator left that household, or (kind siri) its session has ended.
create function public.authenticate_access_token(p_token_hash text)
returns table (user_id uuid, household_id uuid, kind text)
language sql security definer set search_path = '' as $$
  update public.personal_access_tokens t
  set last_used_at = now()
  from public.household_members m
  where t.token_hash = p_token_hash
    and t.revoked_at is null
    and m.user_id = t.user_id
    and m.household_id = t.household_id
    and (t.kind = 'pat' or exists (
      select from auth.sessions s
      where s.id = t.session_id and s.user_id = t.user_id
        and (s.not_after is null or s.not_after > now())
    ))
  returning t.user_id, t.household_id, t.kind;
$$;

-- The PAT-only lookup older function versions call (a rollback) must not take a Siri credential
-- without its session check.
create or replace function public.authenticate_personal_access_token(p_token_hash text)
returns table (user_id uuid, household_id uuid)
language sql security definer set search_path = '' as $$
  update public.personal_access_tokens t
  set last_used_at = now()
  from public.household_members m
  where t.token_hash = p_token_hash
    and t.revoked_at is null
    and t.kind = 'pat'
    and m.user_id = t.user_id
    and m.household_id = t.household_id
  returning t.user_id, t.household_id;
$$;

revoke execute on function public.create_siri_credential(uuid) from public, anon;
grant execute on function public.create_siri_credential(uuid) to authenticated;
revoke execute on function public.authenticate_access_token(text) from public, anon, authenticated;
grant execute on function public.authenticate_access_token(text) to service_role;
