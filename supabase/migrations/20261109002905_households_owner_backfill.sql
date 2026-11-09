-- Job 169b review.0: before 169b, leaving (leave_current_household, also called by the old
-- accept_invite and create_household) deleted an owner's membership without passing the owner
-- role on, so a household its creator left kept members only. Since wave 2 only an owner names
-- admins, and only owner and admins make group links, remove members and decide join requests:
-- such a household could never use them. Each gets an owner by hand_over_ownership's rule (an
-- admin first, then the earliest joined). Idempotent; a no-op without such households.
create function public.repair_ownerless_households() returns integer
language sql security definer set search_path = '' as $$
  with fixed as (
    update public.household_members m set role = 'owner'
    where (m.household_id, m.user_id) in (
      select distinct on (o.household_id) o.household_id, o.user_id
      from public.household_members o
      where not exists (
        select from public.household_members w
        where w.household_id = o.household_id and w.role = 'owner'
      )
      order by o.household_id, o.role = 'admin' desc, o.joined_at, o.user_id
    )
    returning 1
  )
  select count(*)::int from fixed
$$;
revoke execute on function public.repair_ownerless_households() from public, anon, authenticated;

select public.repair_ownerless_households();
