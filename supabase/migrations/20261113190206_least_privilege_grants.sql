-- Job 220: the API roles keep only the privileges something uses.
--
-- Supabase's default privileges hand anon and authenticated every privilege on a new public table
-- and sequence. Migrations revoke them per table ("revoke all ..., then grant"), but the tables
-- from before that convention still carry TRUNCATE, REFERENCES and TRIGGER for authenticated, and
-- all three sequences are open to both roles. Row level security does not cover TRUNCATE, and
-- setval on a sequence would make every later insert collide. PostgREST offers neither, so this
-- closes a second line, not an open door.

revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

-- All three back identity columns, which draw from their sequence without a privilege check, and
-- every insert into those tables runs in a security definer function (items_log_event,
-- check_invite, claim_invite, waitlist_end) or as service_role. A later serial column that clients
-- insert into needs its own "grant usage on sequence".
revoke all on all sequences in schema public from anon, authenticated;

-- The foundation's "alter default privileges in schema public revoke execute on functions from
-- public" cannot take away PUBLIC's built-in execute right (a per-schema default only adds to the
-- global one), so three functions created without their own revoke stayed callable signed out.
-- Two are trigger functions, one maps a timestamp to a date: nothing to gain, but the list of what
-- anon may call is now the one function meant for it (households_invites.test.sql).
revoke execute on function
  public.archive_deletes_at(timestamptz),
  public.items_rename_duplicate(),
  public.items_skip_duplicate()
from public, anon;

-- New tables and sequences start closed: a migration that forgets its revoke now fails its tests
-- (permission denied) instead of shipping with every privilege granted. Without "for role" the
-- default belongs to the role that runs this migration, which is the one that runs the next.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
