-- Job 225 review 0: feedback_digest_set takes only an https URL (plain http only for the local
-- stack: localhost, 127.0.0.1, kong), so a mistyped prod URL can't send the vault secret header in
-- clear text every hour. Otherwise as in 20261114001000_feedback_digest.sql.

create or replace function public.feedback_digest_set(p_on boolean, p_url text default null) returns text
language plpgsql security definer set search_path = '' as $$
begin
  if not p_on then
    update public.app_switches set enabled = false, changed_at = now() where key = 'feedback_digest';
    perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'feedback-digest';
    return 'off';
  end if;
  if p_url is null
     or p_url !~ '^(https://|http://(localhost|127\.0\.0\.1|kong)(:[0-9]+)?/)' then
    raise exception 'feedback_digest_set(true, url) needs the feedback-digest function''s https URL'
      using errcode = '22023';
  end if;
  if not exists (select from vault.decrypted_secrets where name = 'feedback_digest_secret') then
    raise exception 'vault secret feedback_digest_secret is missing'
      using errcode = '22023',
        hint = 'select vault.create_secret(''<FEEDBACK_DIGEST_SECRET>'', ''feedback_digest_secret'');';
  end if;
  update public.feedback_digest_state
  set since_created_at = now(), since_id = '00000000-0000-0000-0000-000000000000'
  where since_created_at is null;
  -- Healthy until the first hourly run, so the watch doesn't report a fresh switch-on as failed.
  update public.feedback_digest_state set last_ok_at = now(), last_error = null;
  insert into public.app_switches (key, enabled) values ('feedback_digest', true)
  on conflict (key) do update set enabled = true, changed_at = now();
  perform cron.schedule('feedback-digest', '0 * * * *', format(
    $cmd$select net.http_post(url := %L, headers := jsonb_build_object('content-type', 'application/json', 'x-feedback-digest-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'feedback_digest_secret')), body := '{}'::jsonb, timeout_milliseconds := 60000)$cmd$,
    p_url));
  return 'on';
end $$;

revoke execute on function public.feedback_digest_set(boolean, text)
  from public, anon, authenticated, service_role;
