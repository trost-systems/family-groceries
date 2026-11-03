-- Job 80: Mehr › Zugänge names the device a connected app was approved on ("Chrome · macOS") and
-- when it was last active, instead of listing the granted scopes.
--
-- The device: the sessions Supabase Auth keeps for an OAuth client carry the client's own HTTP
-- library as user agent ("undici", "python-httpx/0.28.1", "Apache-HttpClient"), which names no
-- device. So the consent page records a short label of the browser it was approved in, derived on
-- the device from its platform and user agent (app/lib/oauth/device_label.dart). Only that label
-- is stored, never the user agent itself, an IP address or a location. It goes when the grant
-- goes (trigger below) or with the account (foreign key). NEEDS_LEAD "Job 80" (privacy policy).
--
-- Last active: the newest refresh of the client's sessions in auth.sessions. An app refreshes its
-- token about hourly while in use, so this is exact to the day the screen shows.

create table public.oauth_app_devices (
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null,
  device text not null check (device ~ '^[A-Za-z0-9 .()·-]{1,40}$'),
  recorded_at timestamptz not null default now(),
  primary key (user_id, client_id)
);

comment on table public.oauth_app_devices is
  'Job 80: the device (a short label like "Chrome · macOS", never a user agent) an OAuth client was approved on, per user. Written by record_oauth_device, read by connected_app_details, gone with the grant.';

-- Not household-owned: one row per user and client. Only the functions below touch it.
alter table public.oauth_app_devices enable row level security;
revoke all on public.oauth_app_devices from anon, authenticated;

-- The app's own session (not a connected app) records where the user just approved [p_client].
-- An unknown or revoked grant records nothing.
create function public.record_oauth_device(p_client uuid, p_device text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_claims jsonb := coalesce(auth.jwt(), '{}'::jsonb);
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_claims ? 'client_id' then
    raise exception 'session_required' using errcode = '42501';
  end if;
  if not exists (
    select from auth.oauth_consents c
    where c.user_id = auth.uid() and c.client_id = p_client and c.revoked_at is null
  ) then
    return;
  end if;
  insert into public.oauth_app_devices (user_id, client_id, device)
  values (auth.uid(), p_client, btrim(p_device))
  on conflict (user_id, client_id) do update
    set device = excluded.device, recorded_at = now();
end $$;

revoke execute on function public.record_oauth_device(uuid, text) from public, anon;
grant execute on function public.record_oauth_device(uuid, text) to authenticated;

-- The signed-in user's active grants with their device label and last activity, for Zugänge.
create function public.connected_app_details()
returns table (client_id uuid, device text, last_used_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select
    c.client_id,
    d.device,
    (
      select max(greatest(s.updated_at, s.refreshed_at at time zone 'UTC'))
      from auth.sessions s
      where s.user_id = c.user_id and s.oauth_client_id = c.client_id
    )
  from auth.oauth_consents c
  left join public.oauth_app_devices d on d.user_id = c.user_id and d.client_id = c.client_id
  where c.user_id = auth.uid() and c.revoked_at is null
$$;

revoke execute on function public.connected_app_details() from public, anon;
grant execute on function public.connected_app_details() to authenticated;

-- Every way a grant ends (Trennen in Zugänge, alexa_revoke, the Alexa purge) revokes or deletes
-- its consent row; the label goes with it.
create function public.oauth_consent_ended() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.oauth_app_devices d
  where d.user_id = old.user_id and d.client_id = old.client_id;
  return null;
end $$;

revoke execute on function public.oauth_consent_ended() from public, anon, authenticated;

create trigger oauth_consent_revoked after update of revoked_at on auth.oauth_consents
  for each row when (new.revoked_at is not null)
  execute function public.oauth_consent_ended();

create trigger oauth_consent_deleted after delete on auth.oauth_consents
  for each row execute function public.oauth_consent_ended();

-- 20261101150000's export_my_data, its connected_apps with the device label.
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
        'revoked_at', c.revoked_at,
        'device', d.device
      ) order by c.granted_at, c.id)
      from auth.oauth_consents c
      join auth.oauth_clients oc on oc.id = c.client_id
      left join public.oauth_app_devices d on d.user_id = c.user_id and d.client_id = c.client_id
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
    'archived_households', coalesce((
      select jsonb_agg(jsonb_build_object('id', h.id, 'name', h.name, 'archived_at', h.archived_at)
        order by h.archived_at, h.id)
      from public.households h where h.archived_by = v_user
    ), '[]'::jsonb)
  );
end $$;
