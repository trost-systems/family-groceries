-- Job 82, Legal Review 2026-11-04 (N-73, N-74): only the person's own press of „E-Mail bestätigen“
-- on the confirmation page is consent. That press records which confirmation-page text it answered
-- (confirm_text_version, waitlist-confirm-<locale>-v<n>, site/content/legal/consent/) and the
-- launch-news box shown there, unticked. A sign-up (possibly an assistant's) never sets launch
-- news. consent_text_version stays: it records the form text the sign-up request answered.

alter table public.waitlist
  add column confirm_text_version text
  check (confirm_text_version ~ '^waitlist-confirm-(de|en)-v[0-9]+$');

comment on column public.waitlist.confirm_text_version is
  'The confirmation-page text the button press answered (waitlist-confirm-de-v1, site/content/legal/consent/); null until confirmed, and on rows confirmed before 2026-11-04.';

alter table public.waitlist_consent_proof
  add column confirm_text_version text
  check (confirm_text_version ~ '^waitlist-confirm-(de|en)-v[0-9]+$');

comment on column public.waitlist_consent_proof.confirm_text_version is
  'Copied from waitlist.confirm_text_version when the row ended: the text the consent was given under.';

create or replace function public.waitlist_end(p_ids uuid[], p_reason text, p_now timestamptz)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  with gone as (
    delete from public.waitlist w where w.id = any(p_ids) returning w.*
  ), proof as (
    insert into public.waitlist_consent_proof
      (email_hmac, consent_text_version, confirm_text_version, locale, launch_news, created_at,
       confirmed_at, last_mail_at, ended_at, end_reason)
    select g.email_hmac, g.consent_text_version, g.confirm_text_version, g.locale, g.launch_news,
           g.created_at, g.confirmed_at, g.last_mail_at, p_now, p_reason
    from gone g where g.confirmed_at is not null
  )
  select count(*) into v_count from gone;
  return v_count;
end $$;

-- As in 20261102213606_waitlist.sql, but launch_news is false on insert and on the 24 h re-send
-- whatever p_launch_news says (N-74): the form may be an assistant's. The parameter stays so the
-- deployed function version's call keeps working; "p_launch_news and false" is false either way.
create or replace function public.waitlist_signup(
  p_email text,
  p_email_hmac text,
  p_platform text,
  p_locale text,
  p_launch_news boolean,
  p_consent_version text,
  p_token_hash text,
  p_now timestamptz
)
returns table (id uuid, email text, locale text, launch_news boolean)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  return query
  insert into public.waitlist as w
    (email, email_hmac, platform, locale, launch_news, consent_text_version, created_at,
     confirm_token_hash, confirm_expires_at, last_mail_at)
  values (btrim(p_email), p_email_hmac, p_platform, p_locale, p_launch_news and false, p_consent_version,
          p_now, p_token_hash, p_now + interval '48 hours', p_now)
  on conflict ((lower(email))) do nothing
  returning w.id, w.email, w.locale, w.launch_news;
  if found then return; end if;

  return query
  update public.waitlist w set
    platform = p_platform,
    locale = p_locale,
    launch_news = false,
    consent_text_version = p_consent_version,
    confirm_token_hash = p_token_hash,
    confirm_expires_at = p_now + interval '48 hours',
    last_mail_at = p_now
  where lower(w.email) = lower(btrim(p_email))
    and w.confirmed_at is null
    and w.last_mail_at <= p_now - interval '24 hours'
  returning w.id, w.email, w.locale, w.launch_news;
end $$;

-- The button press: confirms the row with this unexpired token and records the page text it
-- answered and the launch-news box. The token is gone after, so a second press finds nothing.
-- The caller checks p_confirm_version against the current texts. Returns what the welcome mail
-- needs, or no row.
create function public.waitlist_confirm(
  p_token_hash text,
  p_now timestamptz,
  p_confirm_version text,
  p_launch_news boolean
)
returns table (id uuid, email text, locale text, launch_news boolean)
language sql security definer set search_path = '' as $$
  update public.waitlist w set
    confirmed_at = p_now,
    confirm_text_version = p_confirm_version,
    launch_news = p_launch_news,
    confirm_token_hash = null,
    confirm_expires_at = null
  where w.confirm_token_hash = p_token_hash and w.confirm_expires_at > p_now
  returning w.id, w.email, w.locale, w.launch_news;
$$;

comment on function public.waitlist_confirm(text, timestamptz) is
  'Superseded by waitlist_confirm(text, timestamptz, text, boolean), which records the confirmation text and launch news. Kept only while the first waitlist function version may still call it.';

revoke execute on function public.waitlist_confirm(text, timestamptz, text, boolean) from public, anon, authenticated;
grant execute on function public.waitlist_confirm(text, timestamptz, text, boolean) to service_role;
