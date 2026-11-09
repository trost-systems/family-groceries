-- Job 168b: who a household shops with, from onboarding's „Mit wem kaufst du ein?“. Members may
-- set it (like the name); null for households from before, and when the question was skipped.
-- Job 169b's households_multi added the column first, without „other“: this finds it and
-- widens its check. Every statement can run again.
alter table public.households add column if not exists kind text;
alter table public.households drop constraint if exists households_kind_check;
alter table public.households add constraint households_kind_check
  check (kind in ('partner', 'family', 'flat', 'club', 'solo', 'other'));

grant update (kind) on public.households to authenticated;

-- The onboarding invite step shows „beigetreten“ as soon as someone accepts one of its invites
-- (used_at set by accept_invite). Realtime applies invites_select, so members see their own
-- household's invites only.
do $$
begin
  if not exists (
    select from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'invites'
  ) then
    alter publication supabase_realtime add table public.invites;
  end if;
end $$;
