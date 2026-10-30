-- Job 25: Hummlist Lifetime, a one-time in-app purchase that unlocks the buyer's household
-- (docs/PURCHASES.md). The edge function `purchases` verifies each store transaction (Apple's signed
-- JWS, Google Play's Developer API) and only then writes here, through the service connection:
--   * purchases: one row per store transaction, unique by (store, transaction_id), so a replayed
--     or repeated transaction never counts twice. Service connection only.
--   * entitlements: which household a purchase unlocks. Members read their household's rows (the
--     app shows "Freigeschaltet"); nobody but the function writes. A purchase unlocks at most one
--     household at a time (purchase_id is the key).
--   * purchase_rate: a per-user limit on verification calls.
-- Decision 2 (DECISIONS 25.2): the unlock stays with the household it was bought in, also after
-- the buyer leaves or deletes their account. A purchase restored in another household moves there
-- only while it unlocks none (its household was deleted).

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  store text not null check (store in ('apple', 'google')),
  -- Apple's originalTransactionId, Google's orderId (or token:<hash> for a test purchase without).
  transaction_id text not null check (length(transaction_id) between 1 and 200),
  product_id text not null check (product_id ~ '^[a-z0-9_.]{1,64}$'),
  -- Sandbox: Apple's sandbox and TestFlight, Google's license testers. Never real money.
  environment text not null check (environment in ('Production', 'Sandbox')),
  -- Who verified it first, the buyer as far as we know. Null once that account is deleted: the
  -- row stays for refunds and against replays, without a person (DECISIONS 25.9).
  user_id uuid references auth.users (id) on delete set null,
  purchased_at timestamptz not null,
  verified_at timestamptz not null default now(),
  -- The store took it back (refund, revoke, voided); no entitlement while set.
  revoked_at timestamptz,
  -- What the store reported, for purchase_refunded (Google's voided list carries no price).
  price numeric(10, 2) check (price >= 0),
  currency text check (currency ~ '^[A-Z]{3}$'),
  country text check (country ~ '^[A-Z]{2}$'),
  unique (store, transaction_id)
);

comment on table public.purchases is
  'Job 25: store transactions of Hummlist Lifetime the purchases function verified. Service connection only; members see the entitlement, not this.';

alter table public.purchases enable row level security;
revoke all on public.purchases from anon, authenticated;

create index purchases_user on public.purchases (user_id);

create table public.entitlements (
  -- One household per purchase: restoring it elsewhere is refused while this row exists.
  purchase_id uuid primary key references public.purchases (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  product_id text not null check (product_id ~ '^[a-z0-9_.]{1,64}$'),
  store text not null check (store in ('apple', 'google')),
  -- The purchase's: a Sandbox unlock is a tester's (TestFlight, App Review, Play license testers),
  -- told apart from paid ones and droppable at launch (DECISIONS 25.27).
  environment text not null check (environment in ('Production', 'Sandbox')),
  -- The member whose purchase or restore unlocked it; null after they deleted their account.
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now()
);

comment on table public.entitlements is
  'Job 25: households unlocked by a verified Hummlist Lifetime purchase. Members read; only the purchases function (service connection) writes.';

alter table public.entitlements enable row level security;
revoke all on public.entitlements from anon, authenticated;
grant select on public.entitlements to authenticated;

create index entitlements_household on public.entitlements (household_id);

create policy entitlements_select on public.entitlements
  for select to authenticated
  using (public.is_household_member(household_id));

-- The partner's phone sees the unlock as soon as the buyer's purchase is verified.
alter publication supabase_realtime add table public.entitlements;

-- Grant ------------------------------------------------------------------------------------------

-- Records a verified transaction for [p_user] in [p_household] and unlocks the household, unless
-- the purchase already unlocks another one. Safe to call again with the same transaction (a retry,
-- a double tap, the app restarting mid-purchase): the row is locked, nothing counts twice.
-- Returns one of:
--   granted         first time this transaction is seen; the household is unlocked now
--   restored        seen before; it unlocks this household (again, or still)
--   used_elsewhere  it unlocks another household that still exists; nothing changed
--   revoked         the store has taken it back (refund, revoke); nothing unlocked
--   refunded        it was active until now: the store reports it revoked, the unlock is gone
create function public.purchase_grant(
  p_store text,
  p_transaction text,
  p_product text,
  p_environment text,
  p_purchased_at timestamptz,
  p_revoked_at timestamptz,
  p_price numeric,
  p_currency text,
  p_country text,
  p_user uuid,
  p_household uuid
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_new boolean;
  v_revoked timestamptz;
  v_bound uuid;
begin
  if not exists (
    select from public.household_members m where m.user_id = p_user and m.household_id = p_household
  ) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;

  insert into public.purchases as p (store, transaction_id, product_id, environment, user_id,
                                     purchased_at, revoked_at, price, currency, country)
  values (p_store, p_transaction, p_product, p_environment, p_user, p_purchased_at, p_revoked_at,
          p_price, p_currency, p_country)
  on conflict (store, transaction_id) do nothing
  returning p.id into v_id;
  v_new := v_id is not null;

  select p.id, p.revoked_at into v_id, v_revoked
  from public.purchases p
  where p.store = p_store and p.transaction_id = p_transaction
  for update;

  if v_new then
    if p_revoked_at is not null then
      return 'revoked';
    end if;
  else
    if v_revoked is not null then
      return 'revoked';
    end if;
    -- The store now says it was taken back; we had not heard yet.
    if p_revoked_at is not null then
      update public.purchases set revoked_at = p_revoked_at where id = v_id;
      delete from public.entitlements where purchase_id = v_id;
      return 'refunded';
    end if;
    update public.purchases p
    set user_id = coalesce(p.user_id, p_user),
        price = coalesce(p.price, p_price),
        currency = coalesce(p.currency, p_currency),
        country = coalesce(p.country, p_country)
    where p.id = v_id;
  end if;

  select e.household_id into v_bound from public.entitlements e where e.purchase_id = v_id;
  if v_bound is not null and v_bound <> p_household then
    return 'used_elsewhere';
  end if;
  if v_bound is null then
    insert into public.entitlements (purchase_id, household_id, product_id, store, environment, granted_by)
    select v_id, p_household, p.product_id, p.store, p.environment, p_user
    from public.purchases p where p.id = v_id;
  end if;
  return case when v_new then 'granted' else 'restored' end;
end $$;

-- Revoke -----------------------------------------------------------------------------------------

-- The store took [p_transaction] back (Apple REFUND/REVOKE, a Google voided purchase): the unlock
-- goes, the row stays revoked. A transaction not seen yet is recorded as revoked right away, so
-- its receipt can never unlock later (a refund that beats the first verification, or races it).
-- Returns what purchase_refunded needs, once: the first call for an active purchase. Unknown (now
-- recorded) or already revoked: null.
create function public.purchase_revoke(
  p_store text,
  p_transaction text,
  p_revoked_at timestamptz,
  p_product text,
  p_environment text,
  p_purchased_at timestamptz
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.purchases;
  v_household uuid;
  v_at timestamptz := coalesce(p_revoked_at, now());
begin
  -- Waits for a concurrent first grant of the same transaction, then finds its row below.
  insert into public.purchases (store, transaction_id, product_id, environment, purchased_at, revoked_at)
  values (p_store, p_transaction, p_product, p_environment, coalesce(p_purchased_at, v_at), v_at)
  on conflict (store, transaction_id) do nothing;
  update public.purchases p set revoked_at = v_at
  where p.store = p_store and p.transaction_id = p_transaction and p.revoked_at is null
  returning * into v_row;
  if v_row.id is null then
    return null;
  end if;
  delete from public.entitlements e where e.purchase_id = v_row.id
  returning e.household_id into v_household;
  return jsonb_build_object(
    'user_id', v_row.user_id,
    'household_id', v_household,
    'product_id', v_row.product_id,
    'environment', v_row.environment,
    'price', v_row.price,
    'currency', v_row.currency,
    'country', v_row.country
  );
end $$;

-- Apple's REFUND_REVERSED: the purchase stands again. The household it unlocked is not known any
-- more, so it unlocks none until someone restores it (Käufe wiederherstellen). True if it changed.
create function public.purchase_reinstate(p_store text, p_transaction text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.purchases p set revoked_at = null
  where p.store = p_store and p.transaction_id = p_transaction and p.revoked_at is not null;
  return found;
end $$;

-- Rate limit -------------------------------------------------------------------------------------

create table public.purchase_rate (
  user_id uuid primary key references auth.users (id) on delete cascade,
  window_start timestamptz not null,
  calls integer not null check (calls >= 0)
);

comment on table public.purchase_rate is
  'Job 25: purchase verifications in the current one-minute window, per user. Service connection only.';

alter table public.purchase_rate enable row level security;
revoke all on public.purchase_rate from anon, authenticated;

-- Takes one call from [p_user]'s allowance of [p_limit] a minute (a fixed window). False when
-- that would go over it.
create function public.purchase_take_call(p_user uuid, p_limit integer default 20) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_start timestamptz;
  v_calls integer;
begin
  insert into public.purchase_rate (user_id, window_start, calls)
  values (p_user, now(), 0)
  on conflict (user_id) do nothing;
  select r.window_start, r.calls into v_start, v_calls
  from public.purchase_rate r where r.user_id = p_user for update;
  if v_start <= now() - interval '1 minute' then
    v_start := now();
    v_calls := 0;
  end if;
  if v_calls + 1 > p_limit then
    update public.purchase_rate set window_start = v_start, calls = v_calls where user_id = p_user;
    return false;
  end if;
  update public.purchase_rate set window_start = v_start, calls = v_calls + 1 where user_id = p_user;
  return true;
end $$;

revoke execute on function public.purchase_grant(text, text, text, text, timestamptz, timestamptz, numeric, text, text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.purchase_revoke(text, text, timestamptz, text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.purchase_reinstate(text, text) from public, anon, authenticated;
revoke execute on function public.purchase_take_call(uuid, integer) from public, anon, authenticated;

-- Data export ------------------------------------------------------------------------------------
-- The user's purchases are their data (GDPR Art. 15): the body is job 31's plus `purchases`; the
-- addition keeps version 1.
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
        'decided_at', a.decided_at
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
        'transaction_id', p.transaction_id,
        'environment', p.environment,
        'purchased_at', p.purchased_at,
        'revoked_at', p.revoked_at,
        'price', p.price,
        'currency', p.currency,
        'country', p.country,
        'unlocks_household', (select e.household_id from public.entitlements e where e.purchase_id = p.id)
      ) order by p.purchased_at, p.id)
      from public.purchases p
      where p.user_id = v_user
    ), '[]'::jsonb)
  );
end $$;
