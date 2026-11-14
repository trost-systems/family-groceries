-- The join page's answer no longer carries the household's kind (Legal N-151, job 216). The page
-- never showed it, and the privacy policy (§5) and the invite hint now name exactly what a link
-- holder sees: the inviter's first name, the household's name, the member and open-item counts
-- and Premium. Otherwise unchanged from 20261108133253_households_invite_loop.sql: {status,
-- household, inviter, members, open_items, premium, invite_kind}. join.js never read kind; the
-- app's signed-in preview_invite is untouched. Grants stay (create or replace keeps them).
create or replace function public.preview_invite_public(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_code text := upper(regexp_replace(left(coalesce(p_code, ''), 64), '[^A-Za-z0-9]', '', 'g'));
  v_client text := coalesce(
    nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-real-ip', '');
  v_invite public.invites;
  v_household public.households;
  v_status text;
begin
  delete from public.invite_preview_rate r where r.window_start < date_trunc('hour', now());
  if public.invite_preview_hit('client:' || v_client, 30) then
    v_status := 'rate_limited';
  elsif public.invite_preview_hit('code:' || v_code, 60) then
    v_status := 'rate_limited';
  else
    select * into v_invite from public.invites i where i.code = v_code;
    select * into v_household from public.households h where h.id = v_invite.household_id;
    if v_household.id is null or v_household.archived_at is not null
       or v_invite.revoked_at is not null or v_invite.expires_at <= now() then
      v_status := 'invalid';
    elsif v_invite.use_count >= v_invite.max_uses then
      v_status := case v_invite.kind when 'group' then 'full' else 'invalid' end;
    else
      v_status := 'ok';
    end if;
  end if;

  if v_status <> 'ok' then
    return jsonb_build_object(
      'status', v_status, 'household', null, 'inviter', null, 'members', null,
      'open_items', null, 'premium', null, 'invite_kind', null
    );
  end if;
  update public.invites i set preview_count = i.preview_count + 1 where i.id = v_invite.id;
  return jsonb_build_object(
    'status', 'ok',
    'household', v_household.name,
    -- A profile's name starts as the email's local part (handle_new_user): that one is not shown.
    'inviter', (
      select nullif(split_part(btrim(p.display_name), ' ', 1), '')
      from public.profiles p join auth.users u on u.id = p.id
      where p.id = v_invite.created_by
        and p.display_name is distinct from left(split_part(u.email, '@', 1), 80)
    ),
    'members', (
      select count(*)::int from public.household_members m where m.household_id = v_household.id
    ),
    'open_items', (
      select count(*)::int from public.items i
      where i.household_id = v_household.id and i.status = 'active'
    ),
    'premium', public.household_has_premium(v_household.id),
    'invite_kind', v_invite.kind
  );
end $$;
