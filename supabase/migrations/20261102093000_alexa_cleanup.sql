-- Alexa data retention (Legal Review 2026-11-02, N-24 and N-28; privacy §7). What the alexa
-- function keeps about a connection goes once the connection ends, or after 12 months unused:
--   * alexa_links (the Alexa id hash, the Hummlist session, last_seen),
--   * alexa_rate (the items counted in the current minute),
--   * Amazon Alexa's grant in auth.oauth_consents (the entry under Mehr › Zugänge).
--
-- Right away: a deleted Hummlist session takes its links with it, and the counter goes with the
-- user's last link (trigger below). Every way a connection ends deletes the session: "Amazon Alexa
-- trennen" (GoTrue revokes the grant and deletes the client's sessions), disabling the skill
-- (alexa_revoke, which now also deletes the grant), linking again, signing out everywhere,
-- deleting the account.
-- Daily (purge_alexa): whatever the trigger could not see (rows from before it), counters of a
-- past minute, connections unused for 12 months, and Alexa grants without a session (revoked in
-- Zugänge, or their sessions gone).

create index alexa_links_session on public.alexa_links (session_id);

-- The OAuth clients Alexa links with: their redirect URIs are Amazon's account linking URLs, the
-- three hosts scripts/alexa-oauth-client.sh registers (docs/ALEXA.md "Account linking"). A new
-- Amazon host belongs here too, or the purge skips its clients. A client registered with them is
-- useless to anyone but Amazon, since the authorization codes go there.
create function public.alexa_client_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select c.id from auth.oauth_clients c
  where c.redirect_uris ~ 'https://(layla\.amazon\.com|pitangui\.amazon\.com|alexa\.amazon\.co\.jp)/api/skill/link/'
$$;

revoke execute on function public.alexa_client_ids() from public, anon, authenticated;

create function public.alexa_sessions_deleted() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.alexa_links l using gone g where l.session_id = g.id;
  delete from public.alexa_rate r
  where r.user_id in (select g.user_id from gone g)
    and not exists (select from public.alexa_links l where l.user_id = r.user_id);
  return null;
end $$;

revoke execute on function public.alexa_sessions_deleted() from public, anon, authenticated;

create trigger alexa_sessions_deleted after delete on auth.sessions
  referencing old table as gone
  for each statement execute function public.alexa_sessions_deleted();

-- The trigger drops the links of sessions revoked elsewhere; the request path no longer has to.
create or replace function public.alexa_remember(
  p_hash text,
  p_user uuid,
  p_session uuid,
  p_relinked boolean default false
) returns integer
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.alexa_links (alexa_user_hash, session_id, user_id)
  values (p_hash, p_session, p_user)
  on conflict (alexa_user_hash, session_id) do update
    set user_id = excluded.user_id, last_seen = now();
  if p_relinked then
    return public.alexa_revoke(p_hash, p_session);
  end if;
  return 0;
end $$;

-- Disabling the skill (p_keep null) also deletes the grant of each user it leaves without a
-- session of that client, so Zugänge no longer lists Amazon Alexa. Linking again keeps it.
create or replace function public.alexa_revoke(p_hash text, p_keep uuid default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
  v_users uuid[];
begin
  with gone as (
    delete from public.alexa_links l
    where l.alexa_user_hash = p_hash and l.session_id is distinct from p_keep
    returning l.session_id, l.user_id
  ), revoked as (
    delete from auth.sessions s
    using gone g
    where s.id = g.session_id and s.user_id = g.user_id and s.oauth_client_id is not null
    returning s.user_id
  )
  select count(*), array_agg(distinct r.user_id) into v_count, v_users from revoked r;
  if p_keep is null then
    delete from auth.oauth_consents c
    where c.user_id = any(v_users)
      and c.client_id in (select public.alexa_client_ids())
      and not exists (
        select from auth.sessions s where s.user_id = c.user_id and s.oauth_client_id = c.client_id
      );
  end if;
  return v_count;
end $$;

-- Daily. Returns how many rows it deleted, all four kinds together.
create function public.purge_alexa() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_total integer := 0;
  v_count integer;
begin
  -- N-28: an Alexa session unused for 12 months. Alexa refreshes its token as it uses it, and
  -- every linked request moves last_seen.
  delete from auth.sessions s
  where s.oauth_client_id in (select public.alexa_client_ids())
    and greatest(
      s.created_at,
      s.updated_at,
      s.refreshed_at at time zone 'UTC',
      (select max(l.last_seen) from public.alexa_links l where l.session_id = s.id)
    ) < now() - interval '12 months';
  get diagnostics v_count = row_count;
  v_total := v_total + v_count;

  -- N-24 (a): links whose session is gone. A link unused for 12 months went with its session
  -- above; one whose session Alexa still refreshes stays, or disabling the skill could not
  -- revoke that session.
  delete from public.alexa_links l
  where not exists (select from auth.sessions s where s.id = l.session_id);
  get diagnostics v_count = row_count;
  v_total := v_total + v_count;

  -- N-24 (b): counters whose minute has passed (alexa_take_adds starts a new one anyway), so
  -- none outlives a day, and those of users with no link left.
  delete from public.alexa_rate r
  where r.window_start < now() - interval '1 minute'
    or not exists (select from public.alexa_links l where l.user_id = r.user_id);
  get diagnostics v_count = row_count;
  v_total := v_total + v_count;

  -- Alexa grants revoked in Zugänge, or left without a session. A day's grace for a link in
  -- progress: the grant (or GoTrue's reuse of an old one) comes a moment before the session.
  delete from auth.oauth_consents c
  where c.client_id in (select public.alexa_client_ids())
    and (
      c.revoked_at is not null
      or (
        c.granted_at < now() - interval '1 day'
        and not exists (
          select from auth.sessions s where s.user_id = c.user_id and s.oauth_client_id = c.client_id
        )
        and not exists (
          select from auth.oauth_authorizations a
          where a.user_id = c.user_id and a.client_id = c.client_id
            and a.created_at > now() - interval '1 day'
        )
      )
    );
  get diagnostics v_count = row_count;
  return v_total + v_count;
end $$;

revoke execute on function public.purge_alexa() from public, anon, authenticated;

select public.purge_alexa();

-- The same name replaces the job, so applying this again keeps one.
select cron.schedule('purge-alexa', '29 3 * * *', 'select public.purge_alexa()');
