-- Access key retention (Legal Review 2026-11-01, N-4 option (b); privacy §7): an access key of any
-- kind ('pat' and 'siri') is deleted 30 days after it ended. `revoked_at` is the moment it ended.
--
-- A key works (authenticate_access_token) while all of these hold:
--   1. revoked_at is null,
--   2. its creator is a member of the key's household,
--   3. kind 'siri' only: its session exists in auth.sessions for that user and not_after has not
--      passed.
-- It has ended once one fails. 1 is a timestamp already. 2 is set here by a trigger when the
-- membership row goes, so leaving ends the key for good (before, rejoining the same household
-- brought it back). 3 has no event we can hook: GoTrue deletes the session on sign-out and
-- not_after just passes, and auth.sessions is Supabase's table. So the daily job first sets
-- revoked_at on every active key that fails 2 or 3 (at most a day late), then deletes keys whose
-- revoked_at is more than 30 days ago. Both rules only ever end keys that no longer work.

-- Clients choose when to revoke, not the timestamp: their revoked_at is now(). Server code (the
-- RPCs, this job, tests as postgres) sets its own. Revocation stays one-way.
create or replace function public.personal_access_tokens_keep_revoked() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.revoked_at is not null then
    new.revoked_at := old.revoked_at;
  elsif new.revoked_at is not null and current_user in ('authenticated', 'anon') then
    new.revoked_at := now();
  end if;
  return new;
end $$;

-- Leaving a household ends the keys made for it. Not when the household or the account goes with
-- it (cascades): the keys are deleted then anyway.
create function public.household_member_end_access_tokens() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select from public.households h where h.id = old.household_id)
    and exists (select from auth.users u where u.id = old.user_id) then
    update public.personal_access_tokens t set revoked_at = now()
    where t.user_id = old.user_id and t.household_id = old.household_id and t.revoked_at is null;
  end if;
  return null;
end $$;

revoke execute on function public.household_member_end_access_tokens() from public, anon, authenticated;

create trigger household_members_end_access_tokens after delete on public.household_members
  for each row execute function public.household_member_end_access_tokens();

-- Daily: end keys that stopped working (rules 2 and 3 above), then delete keys that ended more
-- than 30 days ago. Returns how many were deleted.
create function public.purge_access_tokens() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  update public.personal_access_tokens t set revoked_at = now()
  where t.revoked_at is null
    and (
      not exists (
        select from public.household_members m
        where m.user_id = t.user_id and m.household_id = t.household_id
      )
      or (t.kind = 'siri' and not exists (
        select from auth.sessions s
        where s.id = t.session_id and s.user_id = t.user_id
          and (s.not_after is null or s.not_after > now())
      ))
    );
  delete from public.personal_access_tokens t where t.revoked_at < now() - interval '30 days';
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke execute on function public.purge_access_tokens() from public, anon, authenticated;

-- Keys that already stopped working end now; their 30 days start today.
select public.purge_access_tokens();

-- The same name replaces the job, so applying this again keeps one.
select cron.schedule('purge-access-tokens', '23 3 * * *', 'select public.purge_access_tokens()');
