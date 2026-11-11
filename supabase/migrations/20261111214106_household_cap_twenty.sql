-- Job 200 (household-limit, approved 11 Nov 2026): a user is in at most 20 households, Free and
-- Premium alike. Job 173's cap stays where it is (the membership and join request triggers,
-- create_household, decide_join_request); only the number moves from 10 to 20, and it lives in
-- household_cap() so the three checks can't drift apart. A user already above the cap keeps
-- every household and can't add one until they are below it again.

create function public.household_cap() returns integer
language sql immutable set search_path = '' as $$ select 20 $$;
revoke execute on function public.household_cap() from public, anon, authenticated;

create function public.refuse_household_over_cap() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.lock_memberships(new.user_id);
  if (select count(*) from public.household_members m where m.user_id = new.user_id)
      >= public.household_cap() then
    raise exception 'too_many_households' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.refuse_household_over_cap() from public, anon, authenticated;
create or replace trigger household_members_cap before insert on public.household_members
  for each row execute function public.refuse_household_over_cap();
create or replace trigger join_requests_cap before insert on public.join_requests
  for each row execute function public.refuse_household_over_cap();
-- squawk-ignore ban-drop-function -- trigger only, no client may call it; both triggers moved off
drop function public.refuse_eleventh_household();

-- Unchanged but for the cap.
create or replace function public.create_household(
  p_request_id uuid,
  p_name text default 'Unser Haushalt',
  p_default_stores boolean default false,
  p_stores text[] default '{}',
  p_kind text default null
) returns public.households
language plpgsql security definer set search_path = '' as $$
declare
  v_household public.households;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_request_id is null then
    raise exception 'request_id_required' using errcode = '22023';
  end if;
  perform public.lock_memberships(auth.uid());
  select * into v_household from public.households h
  where h.created_by = auth.uid() and h.request_id = p_request_id;
  if found then
    return v_household;
  end if;
  if (select count(*) from public.household_members m where m.user_id = auth.uid())
      >= public.household_cap() then
    raise exception 'too_many_households' using errcode = 'P0001';
  end if;
  insert into public.households (name, created_by, request_id, kind, join_approval)
  values (coalesce(nullif(btrim(p_name), ''), 'Unser Haushalt'), auth.uid(), p_request_id, p_kind,
          p_kind is not distinct from 'club')
  returning * into v_household;
  insert into public.household_members (household_id, user_id, role)
  values (v_household.id, auth.uid(), 'owner');
  perform public.seed_household(v_household.id, coalesce(p_default_stores, false));
  for v_name in select t.name from unnest(coalesce(p_stores, '{}')) with ordinality as t (name, ord) order by t.ord
  loop
    perform public.add_store(v_household.id, v_name);
  end loop;
  return v_household;
end $$;

-- Unchanged but for the cap.
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
    -- The requester reached the cap since asking, so the membership trigger would refuse
    -- the join. The request closes as cancelled: the admins' list drops it and the requester's
    -- app shows it as not approved. A new link asks again once they have room.
    if (select count(*) from public.household_members m where m.user_id = v_request.user_id)
        >= public.household_cap() then
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
