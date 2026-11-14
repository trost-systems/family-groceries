-- Job 229: each user's own order of their households, as the switcher sheet shows them after a
-- long-press drag. Per membership, so Peter's order is not Lea's; null (never reordered, or joined
-- since) sorts after the ordered ones, oldest membership first as before.

alter table public.household_members add column position integer;

comment on column public.household_members.position is
  'Job 229: where this household sits in its member''s switcher; null: after the ordered ones, by joined_at. Set through reorder_households.';

-- Puts the caller's households in the order [p_households]: each listed membership of the caller
-- gets its index. Ids the caller is not a member of are skipped; memberships not listed keep their
-- position.
create function public.reorder_households(p_households uuid[]) returns void
language sql security definer set search_path = '' as $$
  update public.household_members m set position = o.ord::int
  from unnest(p_households) with ordinality as o (household_id, ord)
  where m.household_id = o.household_id and m.user_id = auth.uid()
    and m.position is distinct from o.ord::int
$$;
revoke execute on function public.reorder_households(uuid[]) from public, anon;
grant execute on function public.reorder_households(uuid[]) to authenticated;

-- Same answer as before (20261108144412_households_join_approval.sql), in the user's own order.
create or replace function public.my_households()
returns table (
  id uuid, name text, kind text, role text, is_default boolean, member_count integer,
  open_count integer, premium boolean, joined_at timestamptz, join_approval boolean
)
language sql stable security definer set search_path = '' as $$
  select h.id, h.name, h.kind, m.role, m.is_default,
    (select count(*)::int from public.household_members o where o.household_id = h.id),
    (select count(*)::int from public.items i where i.household_id = h.id and i.status = 'active'),
    public.household_has_premium(h.id),
    m.joined_at,
    h.join_approval
  from public.household_members m
  join public.households h on h.id = m.household_id
  where m.user_id = auth.uid()
  order by m.position nulls last, m.joined_at, h.id
$$;
