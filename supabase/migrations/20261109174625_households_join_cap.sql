-- Job 173: a user is in at most 10 households on every way in, not only on create (vmaint-20261109
-- gap 2: accept_invite(code, 'add') made an 11th). The cap moves from create_household into the
-- memberships table: a membership insert at 10 raises too_many_households, so a join (both
-- accept_invite signatures, join_household), a restore (unarchive_household_add) and an approval
-- all stop there. Old builds' joins leave their default household before they insert, so a user
-- at 10 still moves as before. A join request at 10 is refused the same way, and an approval for a
-- requester who got to 10 meanwhile closes the request instead of failing in the admin's hands.
-- Into a household with approval on, the pre-169b store builds' accept_invite now gets the error
-- instead of 'requested': both are the same generic error there. The oldest builds'
-- join_household keeps answering null, as for a filed request.

-- Under the user's memberships lock, so two joins at once can't both see 9. claim_invite and
-- decide_join_request take that lock before they insert anyway.
create function public.refuse_eleventh_household() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.lock_memberships(new.user_id);
  if (select count(*) from public.household_members m where m.user_id = new.user_id) >= 10 then
    raise exception 'too_many_households' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.refuse_eleventh_household() from public, anon, authenticated;
-- Named to fire before household_members_first_default (triggers run in name order).
create trigger household_members_cap before insert on public.household_members
  for each row execute function public.refuse_eleventh_household();
create trigger join_requests_cap before insert on public.join_requests
  for each row execute function public.refuse_eleventh_household();

create or replace function public.decide_join_request(p_request uuid, p_approve boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_request public.join_requests;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_approve is null then
    raise exception 'invalid_value' using errcode = '22023';
  end if;
  select * into v_request from public.join_requests r where r.id = p_request;
  if not found or not public.is_household_member(v_request.household_id) then
    raise exception 'request_not_found' using errcode = 'P0002';
  end if;
  if not public.is_household_admin(v_request.household_id) then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  -- claim_invite's lock order. Under the memberships lock the request's invite can't move
  -- (claim_invite moves it under that lock), only go null with a deleted invite.
  perform from public.households h where h.id = v_request.household_id for share;
  perform public.lock_memberships(v_request.user_id);
  perform from public.invites i
  where i.id = (select r.invite_id from public.join_requests r where r.id = p_request)
  for no key update;
  select * into v_request from public.join_requests r where r.id = p_request for update;
  -- Gone while waiting for the locks: the requester deleted their account.
  if not found then
    raise exception 'request_not_found' using errcode = 'P0002';
  end if;
  if v_request.decision is not null then
    return jsonb_build_object(
      'status', v_request.decision, 'household_id', v_request.household_id,
      'user_id', v_request.user_id);
  end if;

  -- Removed since asking: the removal was the admins' answer. A member has no open request (the
  -- membership trigger closes it), but a removal can postdate one: the user joined and was
  -- removed between claim_invite's check_invite and its locks.
  if exists (
    select from public.household_removals x
    where x.household_id = v_request.household_id and x.user_id = v_request.user_id
      and x.removed_at >= v_request.created_at
  ) then
    update public.join_requests r set decision = 'cancelled', decided_at = now(), decided_by = auth.uid()
    where r.id = p_request;
    return jsonb_build_object(
      'status', 'cancelled', 'household_id', v_request.household_id,
      'user_id', v_request.user_id);
  end if;

  if p_approve then
    -- The requester reached 10 households since asking, so the membership trigger would refuse
    -- the join. The request closes as cancelled: the admins' list drops it and the requester's
    -- app shows it as not approved. A new link asks again once they have room.
    if (select count(*) from public.household_members m where m.user_id = v_request.user_id) >= 10 then
      update public.join_requests r set decision = 'cancelled', decided_at = now(), decided_by = auth.uid()
      where r.id = p_request;
      return jsonb_build_object(
        'status', 'cancelled', 'household_id', v_request.household_id,
        'user_id', v_request.user_id);
    end if;
    if v_request.invite_id is not null then
      update public.invites i set
        use_count = i.use_count + 1,
        used_at = case when i.use_count + 1 = i.max_uses then now() end,
        used_by = case when i.kind = 'person' then v_request.user_id end
      where i.id = v_request.invite_id and i.use_count < i.max_uses;
      if not found then
        return jsonb_build_object(
          'status', 'invite_full', 'household_id', v_request.household_id,
          'user_id', v_request.user_id);
      end if;
      insert into public.invite_uses as u (invite_id, household_id, user_id)
      values (v_request.invite_id, v_request.household_id, v_request.user_id)
      on conflict (invite_id, user_id) do update set joined_at = now();
    end if;
    insert into public.household_members (household_id, user_id, role)
    values (v_request.household_id, v_request.user_id, 'member');
    -- The request came through an invite check_invite let through: a removal is over.
    delete from public.household_removals r
    where r.household_id = v_request.household_id and r.user_id = v_request.user_id;
  end if;

  update public.join_requests r set
    decision = case when p_approve then 'approved' else 'declined' end,
    decided_at = now(),
    decided_by = auth.uid()
  where r.id = p_request
  returning * into v_request;
  return jsonb_build_object(
    'status', v_request.decision, 'household_id', v_request.household_id,
    'user_id', v_request.user_id);
end $$;

-- The oldest builds' join: a user at 10 asking into a household with approval on gets null, as
-- the filed request answered before; the cap only stops filing it.
create or replace function public.join_household(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_result jsonb;
begin
  begin
    v_result := public.accept_invite(p_code);
  exception when raise_exception then
    if sqlerrm = 'too_many_households' then
      return null;
    end if;
    raise;
  end;
  if v_result ->> 'status' = 'too_many_attempts' then
    raise exception 'too_many_attempts' using errcode = 'P0001';
  end if;
  if v_result ->> 'status' = 'requested' then
    return null;
  end if;
  return (v_result ->> 'household_id')::uuid;
end $$;
