-- Job 68: account deletion warns the last member of an unlocked household (DECISIONS 68). True if
-- the caller is the only member of their household and it has premium now, the rule archiving
-- uses (DECISIONS 47.22); preview_invite's leaves_unlocked, without an invite.
create function public.leaves_unlocked() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select public.household_has_premium(m.household_id)
    from public.household_members m
    where m.user_id = auth.uid()
      and not exists (
        select from public.household_members o
        where o.household_id = m.household_id and o.user_id <> m.user_id
      )
  ), false)
$$;

revoke execute on function public.leaves_unlocked() from public, anon;
grant execute on function public.leaves_unlocked() to authenticated;
