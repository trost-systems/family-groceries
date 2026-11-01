-- Legal Review 2026-11-01, addendum 12:35 (N-2 follow-up): every analytics decision is stored with
-- the version of the consent text it was given under (the app's consentTextVersion,
-- app/lib/analytics/consent_version.dart; the texts are in docs/consent/), so we can show which
-- text a yes was given under (Art. 7(1) DSGVO). A yes with no version (an older build) or an older
-- one is no decision: server events (Alexa adds, purchases, voice, the integration lock) go out
-- only while the user's newest answer is a yes to the current text
-- (supabase/functions/alexa/store.ts analyticsSubject, CONSENT_TEXT_VERSION in
-- supabase/functions/_shared/consent_version.ts).

alter table public.analytics_consents add column consent_text_version text;

comment on column public.analytics_consents.consent_text_version is
  'The consent text version (YYYY-MM-DD, docs/consent/<version>.md) the decision was given under; null for one an app build before 2026-11-01 recorded, which counts as no decision for a yes.';

-- The table keeps its RLS (enabled, no policy) and its revokes: only this function and the
-- service role reach it.

-- The app since 2026-11-01 calls this one, with the version. No defaults, so PostgREST tells it
-- apart from the older four-argument function by its parameter names.
create function public.record_analytics_consent(
  p_install uuid,
  p_consent boolean,
  p_internal boolean,
  p_answered boolean,
  p_text_version text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_install uuid := coalesce(p_install, '00000000-0000-0000-0000-000000000000');
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  -- An app connected over OAuth (MCP, Alexa) does not decide for the user's installs.
  if auth.jwt() ->> 'client_id' is not null then
    raise exception 'session_required' using errcode = '42501';
  end if;
  -- A yes always names its install: events go out under it.
  if p_consent is null or (p_consent and p_install is null) then
    raise exception 'invalid_consent' using errcode = '22023';
  end if;
  if p_text_version is not null and p_text_version !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'invalid_consent_text_version' using errcode = '22023';
  end if;
  insert into public.analytics_consents as a (user_id, install_id, consent, internal, consent_text_version)
  values (v_user, v_install, p_consent, coalesce(p_internal, false), p_text_version)
  on conflict (user_id, install_id) do update
    set consent = excluded.consent,
        internal = excluded.internal,
        consent_text_version = excluded.consent_text_version,
        decided_at = case
          when coalesce(p_answered, false)
            or a.consent <> excluded.consent
            or a.consent_text_version is distinct from excluded.consent_text_version then now()
          else a.decided_at
        end;
  -- Reinstalls make new install ids; the 20 newest answers are plenty.
  delete from public.analytics_consents
  where user_id = v_user and install_id not in (
    select install_id from public.analytics_consents
    where user_id = v_user order by decided_at desc, install_id limit 20
  );
end $$;

revoke execute on function public.record_analytics_consent(uuid, boolean, boolean, boolean, text) from public, anon;
grant execute on function public.record_analytics_consent(uuid, boolean, boolean, boolean, text) to authenticated;

-- Builds from before 2026-11-01 still call the four-argument function: their answer is stored
-- without a version, so a yes from them is no decision on the server either.
create or replace function public.record_analytics_consent(
  p_install uuid,
  p_consent boolean,
  p_internal boolean default false,
  p_answered boolean default false
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.record_analytics_consent(p_install, p_consent, p_internal, p_answered, null::text);
end $$;

revoke execute on function public.record_analytics_consent(uuid, boolean, boolean, boolean) from public, anon;
grant execute on function public.record_analytics_consent(uuid, boolean, boolean, boolean) to authenticated;

-- Data export ------------------------------------------------------------------------------------
-- 20261031214500_premium_yearly.sql's body; each analytics decision also names the consent text
-- version it was given under (GDPR Art. 15). The addition keeps version 1.
create or replace function public.export_my_data() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  -- An app connected over OAuth (MCP) acts on the list, not on the account.
  if auth.jwt() ->> 'client_id' is not null then
    raise exception 'session_required' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'format', 'family-groceries-export',
    'version', 1,
    'exported_at', now(),
    'account', (
      select jsonb_build_object(
        'id', u.id,
        'email', u.email,
        'created_at', u.created_at,
        'last_sign_in_at', u.last_sign_in_at,
        'providers', coalesce(
          (select jsonb_agg(distinct i.provider) from auth.identities i where i.user_id = u.id),
          '[]'::jsonb
        )
      )
      from auth.users u where u.id = v_user
    ),
    'profile', (
      select jsonb_build_object('display_name', p.display_name, 'created_at', p.created_at)
      from public.profiles p where p.id = v_user
    ),
    'household', (
      select jsonb_build_object('id', h.id, 'name', h.name, 'role', m.role, 'joined_at', m.joined_at)
      from public.household_members m
      join public.households h on h.id = m.household_id
      where m.user_id = v_user
    ),
    'items_added', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', i.name,
        'brand', i.brand,
        'properties', i.properties,
        'quantity', i.quantity,
        'status', i.status,
        'category', c.name,
        'store', s.name,
        'created_at', i.created_at,
        'bought_at', i.bought_at
      ) order by i.created_at, i.id)
      from public.items i
      join public.household_members m on m.household_id = i.household_id and m.user_id = v_user
      left join public.categories c on c.id = i.category_id
      left join public.stores s on s.id = i.store_id
      where i.added_by = v_user
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'action', e.action,
        'item_name', e.item_name,
        'category', c.name,
        'created_at', e.created_at
      ) order by e.created_at, e.id)
      from public.item_events e
      left join public.categories c on c.id = e.category_id
      where e.actor = v_user
    ), '[]'::jsonb),
    'access_tokens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', t.name,
        'token_hint', t.token_hint,
        'created_at', t.created_at,
        'last_used_at', t.last_used_at,
        'revoked_at', t.revoked_at
      ) order by t.created_at, t.id)
      from public.personal_access_tokens t
      where t.user_id = v_user
    ), '[]'::jsonb),
    'invites_created', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', iv.code,
        'created_at', iv.created_at,
        'expires_at', iv.expires_at,
        'used_at', iv.used_at,
        'revoked_at', iv.revoked_at
      ) order by iv.created_at, iv.id)
      from public.invites iv
      where iv.created_by = v_user
    ), '[]'::jsonb),
    'feedback', coalesce((
      select jsonb_agg(jsonb_build_object(
        'created_at', f.created_at,
        'message', f.message,
        'category', f.category,
        'contact_ok', f.contact_ok,
        'screen', f.screen,
        'platform', f.platform,
        'app_version', f.app_version,
        'build', f.build,
        'os_version', f.os_version,
        'locale', f.locale,
        'household_id', f.household_id,
        'is_internal', f.is_internal
      ) order by f.created_at, f.id)
      from public.feedback f
      where f.user_id = v_user
    ), '[]'::jsonb),
    'connected_apps', coalesce((
      select jsonb_agg(jsonb_build_object(
        'client_name', oc.client_name,
        'scopes', c.scopes,
        'granted_at', c.granted_at,
        'revoked_at', c.revoked_at
      ) order by c.granted_at, c.id)
      from auth.oauth_consents c
      join auth.oauth_clients oc on oc.id = c.client_id
      where c.user_id = v_user
    ), '[]'::jsonb),
    'analytics_decisions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'install_id', a.install_id,
        'consent', a.consent,
        'internal', a.internal,
        'decided_at', a.decided_at,
        'consent_text_version', a.consent_text_version
      ) order by a.decided_at, a.install_id)
      from public.analytics_consents a
      where a.user_id = v_user
    ), '[]'::jsonb),
    'alexa_links', coalesce((
      select jsonb_agg(jsonb_build_object('last_seen', l.last_seen) order by l.last_seen)
      from public.alexa_links l
      where l.user_id = v_user
    ), '[]'::jsonb),
    'purchases', coalesce((
      select jsonb_agg(jsonb_build_object(
        'store', p.store,
        'product_id', p.product_id,
        'plan', p.plan,
        'transaction_id', p.transaction_id,
        'environment', p.environment,
        'purchased_at', p.purchased_at,
        'expires_at', p.expires_at,
        'auto_renew', p.auto_renew,
        'revoked_at', p.revoked_at,
        'price', p.price,
        'currency', p.currency,
        'country', p.country,
        'unlocks_household', (select e.household_id from public.entitlements e where e.purchase_id = p.id),
        'belongs_to_household', p.bound_household
      ) order by p.purchased_at, p.id)
      from public.purchases p
      where p.user_id = v_user
    ), '[]'::jsonb),
    'lifetime_tester', (
      select jsonb_build_object('added_at', t.added_at, 'note', t.note, 'grants', t.grants,
        'used_in_households', coalesce((
          select jsonb_agg(e.household_id order by e.granted_at, e.id)
          from public.entitlements e where e.source = 'tester' and e.tester = v_user
        ), '[]'::jsonb))
      from public.lifetime_testers t where t.user_id = v_user
    ),
    'archived_households', coalesce((
      select jsonb_agg(jsonb_build_object('id', h.id, 'name', h.name, 'archived_at', h.archived_at)
        order by h.archived_at, h.id)
      from public.households h where h.archived_by = v_user
    ), '[]'::jsonb)
  );
end $$;
