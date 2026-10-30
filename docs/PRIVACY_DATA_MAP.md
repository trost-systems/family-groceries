# Hummlist privacy data map

What Hummlist stores or sends about people, where, why, on which legal basis, for how long and how
it goes away, with the code that does it. It is the single source for the store forms (job 14:
App Store "App Privacy", Play "Data safety") and the fact base behind the privacy policy
(`site/content/legal/datenschutz.md` and `privacy.md`, job 33a). Not legal advice: Peter approves
the policy text. Written in job 24 (2026-10-30) against `main` 0b47f91 (after jobs 33a-g, 31 and 32b). A job that adds, sends or
keeps new personal data updates its row here in the same PR.

Legal bases: (b) Art. 6(1)(b) GDPR, the contract (running the app you signed up for);
(a) Art. 6(1)(a), consent; (c) Art. 6(1)(c), legal obligation; (f) Art. 6(1)(f), legitimate
interest.

## Account and sign-in

| Data | Where | Purpose | Basis | Kept | Processor / region | Deletion | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Email, password hash, sign-in timestamps, provider identities (Apple, Google: provider user id, email the provider shares) | Supabase Auth `auth.users`, `auth.identities` | Sign-in | (b) | While the account exists | Supabase, eu-central-1 (Frankfurt) | Konto löschen deletes the auth user (cascades) | `supabase/functions/account/handler.ts`, `supabase/migrations/20261024130534_account_deletion.sql`, `docs/SPEC.md` (region) |
| Magic-link and confirmation emails | Sent by Supabase Auth | Sign-in | (b) | Mail logs per Supabase | Supabase | n/a | `supabase/config.toml` `[auth.email]` |
| Sign in with Apple / Google | Apple, Google | Sign-in via the provider | (b); Apple and Google act as independent controllers for their sign-in | Per provider | Apple, Google | Provider account settings; Apple token revoked on deletion | `supabase/functions/account/apple.ts`, `app/lib/session/` |
| Display name | `public.profiles.display_name` (max 80) | Shown to household members ("who added") | (b) | While the account exists | Supabase EU | Deleted with the account | `20261022150000_foundation.sql` |
| Session tokens on the device | Supabase client storage on the device | Stay signed in | (b) | Until sign-out | Device only | Sign out / uninstall | `app/lib/session/` |

## Household data

| Data | Where | Purpose | Basis | Kept | Processor / region | Deletion | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Household name, members, role, joined date | `households`, `household_members` | Sharing one list | (b) | While the household exists | Supabase EU | Last member's deletion deletes the household; otherwise the membership goes | `20261022150000_foundation.sql`, `..._account_deletion.sql` |
| List items: name, quantity, brand, properties, category, store, status, added_by, bought_by, timestamps, `canonical_key`, `categorized_via` | `public.items` | The shopping list | (b) | While the household exists | Supabase EU | Item delete; account deletion nulls `added_by`/`bought_by` (names stay visible to the others) | `20261022150000_foundation.sql`, `20261030110000_classifier_variants.sql` |
| History: action, item name, category, actor | `public.item_events` | "Recently bought", undo, history | (b) | While the household exists (no purge) | Supabase EU | Account deletion nulls `actor`; household deletion cascades | `..._account_deletion.sql` line 122 |
| Merges of duplicate items (job 32b): both items' rows before and after (names, quantities, who added), who merged, when, undone | `public.item_merges` (members read, no client writes) | Undo a merge ("Rückgängig") | (b) | 30 days (older rows of the household are deleted on the next merge) | Supabase EU | Household deletion cascades; a deleted user's id is cleared from the stored rows (trigger on `auth.users`) | `20261030160000_dedupe_merge.sql` |
| Stores, categories, store/category order, learned category and store memory | `stores`, `categories`, `store_category_order`, `category_memory`, `item_store_memory`, `household_brands` | Sorting the list | (b) | While the household exists | Supabase EU | Household deletion cascades | `supabase/migrations/` |
| Invites: 8-character code, creator, created/expires (7 days), used_at/used_by, revoked_at | `public.invites` | Joining a household; single use | (b) | Rows stay after expiry while the household exists | Supabase EU | Household deletion cascades; creator/user nulled on account deletion | `20261030120000_onboarding_invites.sql` |
| Failed join attempts (user, time) | `public.invite_attempts` (no client access) | Rate limit 10 failures per hour | (f) abuse protection | Rows older than 1 day are deleted whenever a new failure is recorded (line 70) | Supabase EU | Cascades with the account | `20261030120000_onboarding_invites.sql` |
| Realtime changes | Supabase Realtime (in transit) | Live sync between devices | (b) | Not stored beyond the tables | Supabase EU | n/a | `app/lib/list/` |

## AI assistants, Siri, Alexa, voice

| Data | Where | Purpose | Basis | Kept | Processor / region | Deletion | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Personal access tokens: name, SHA-256 hash, last 4 characters, created/last used/revoked | `public.personal_access_tokens` (the token itself is shown once, never stored) | MCP and Siri Shortcut access | (b) | Until revoked or account deletion | Supabase EU | Mehr → Zugänge; deleted with the account | `20261022205008_personal_access_tokens.sql` |
| OAuth grants for MCP clients (client, consent date) | Supabase Auth OAuth server | "Connected apps" for AI assistants | (b) | Until revoked | Supabase EU | Mehr → Zugänge → Verbundene Apps; deleted with the account | `supabase/config.toml` `[auth.oauth_server]`, `docs/MCP.md` |
| Siri sentence ("Milch, zwei Gurken") | Request body to the `voice` function; only the parsed items are written to `items` | Add items by voice | (b) | The sentence is not stored. On a failure the function logs the error (`console.error`, Supabase logs, max. 1 day; a database error can name an item) and sends a scrubbed exception without the request | Supabase EU (functions may run outside the EU, see the policy) | n/a | `supabase/functions/voice/handler.ts` lines 123, 150 |
| Alexa link: SHA-256 of Alexa's user id for the skill (never the id), Supabase session id, user, last seen | `public.alexa_links` (service only) | "Alexa, sag Hummlist, …" (job 31) | (b) | Until the skill is disabled, the link revoked or the account deleted | Supabase EU | `alexa_revoke` deletes the row and the session; cascades with the account | `20261030140000_alexa.sql`, `docs/ALEXA.md` |
| Alexa rate window (user, window start, count) | `public.alexa_rate` (service only) | Abuse limit for adds by voice | (f) | One row per user, overwritten each minute | Supabase EU | Cascades with the account | `20261030140000_alexa.sql` |
| What the user says to Alexa | Amazon | Speech recognition, the skill request | User's choice | Per Amazon | Amazon (independent controller) | Alexa app | `docs/ALEXA.md` |
| Speech recognition | The phone's OS (Siri, Android, browser) | Dictation | User's choice | Per OS vendor | Apple / Google (independent controllers) | OS settings | `docs/SIRI_SHORTCUT.md` |
| What an AI assistant reads or writes through MCP | The assistant's provider | The user's own choice | (b) / the user's own relationship with the provider | Per provider | Claude, ChatGPT, … (independent controllers) | In the assistant | `supabase/functions/mcp/` |

## Feedback (job 21)

| Data | Where | Purpose | Basis | Kept | Processor / region | Deletion | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Message (max 2000), category, contact OK, app version, build, platform, OS version, locale, screen name, user id, household id, internal flag | `public.feedback` | Bug reports and ideas | (b)/(f) | 12 months (`purge-old-feedback`, daily 03:17) | Supabase EU | Daily purge; cascades with the account | `20261030070000_feedback.sql` |
| Support email (support@hummlist.com) | Google Workspace mailbox | Answering requests | (b)/(f) | 6 months after the request is closed (policy §10) | Google Cloud EMEA Limited (policy §10) | Manual | `site/content/legal/impressum.md` |

## Analytics and error tracking (job 19, consent)

| Data | Where | Purpose | Basis | Kept | Processor / region | Deletion | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Events from `eventCatalog`: first_open, household_created, invite_accepted, invite_sent, item_added, item_ticked, category_reordered, store_reordered, item_categorized, dedupe_hint_*, feedback_submitted, with only the listed properties (no item names, no text) | PostHog EU | Product decisions | (a) consent on the consent screen after sign-in; TDDDG §25 for the install id on the device | 1 year at PostHog (policy) | PostHog, EU cloud (Frankfurt) | Withdraw: Mehr → Nutzungsdaten switch off (stops sending, drops the queue) | `app/lib/analytics/events.dart` |
| Context on every event: random install id (`distinct_id`), household id, platform, app version, internal flag; `$geoip_disable: true`, `$process_person_profile: false` | PostHog EU | Counting installs and households | (a) | 1 year | PostHog EU | As above | `app/lib/analytics/analytics.dart` `_enqueue` |
| App errors (`$exception`, scrubbed stack) | PostHog EU | Fixing crashes | (a), only when consent is yes (`_live`) | 1 year | PostHog EU | As above | `app/lib/analytics/analytics.dart` `captureException`, `exceptions.dart` |
| Server function errors (function, error type, scrubbed message, stack; no user, household, install id or IP) | PostHog EU | Fixing server errors | (f) | 1 year | PostHog EU | n/a | `supabase/functions/_shared/telemetry.ts` |
| Purchase events (planned, job 25): product, store, revenue | PostHog EU | Revenue | to be decided in job 25 | | PostHog EU | | `serverEventCatalog` in `telemetry.ts` |
| Consent decision per install (user, install id, yes/no, internal, decided at) | `public.analytics_consents` (service only) | Server events (e.g. Alexa adds) follow the user's newest answer; proof of consent | (c)/(f) proof of consent (Art. 7(1)) | 20 newest installs per user; deleted with the account | Supabase EU | Cascades with the account; in the export as `analytics_decisions` | `20261030140000_alexa.sql` |
| On the device: install id, consent decision, first_open sent, internal flag | `DeviceCache` (shared preferences) | Remember the choice | (a)/§25(2) TDDDG for the decision | Until uninstall | Device | Uninstall; no install id is made without a yes, and an old one is deleted on "no" (33b, `analytics.dart`) | `app/lib/app/device_cache.dart` |

## Other data on the device

`DeviceCache` (`app/lib/app/device_cache.dart`) keeps the last household (id, name), a list cache
for offline start, list preferences (folded stores, hints), language, theme and a pending invite
code. Device only, needed for the app to work (TDDDG §25(2) no. 2), gone on sign-out or uninstall.

## Backups and hosting

| Data | Where | Purpose | Basis | Kept | Processor / region | Deletion | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Nightly `pg_dump` of `public` plus `auth.users`, `auth.identities`, age-encrypted | GitHub Actions artifacts | Restore after an error | (f) security (Art. 32) | 90 days (`retention-days: 90`); deleted rows stay in older backups up to 90 more days | GitHub Inc., USA (ciphertext only) | Expires automatically | `.github/workflows/backup.yml`, `docs/BACKUP.md` |
| Web hosting request logs (IP, time, path, user agent) for app.hummlist.com and hummlist.com | Vercel | Serving the site, security | (f) | Max. 30 days (policy §2) | Vercel Inc., USA | Automatic | `vercel.json`, `site/vercel.json` |
| Database and API logs | Supabase | Operation | (f) | Max. 1 day on the free plan (policy §14) | Supabase EU | Automatic | `docs/DEPLOY.md` |

## In-app purchases (planned, job 25)

Apple and Google process payments as independent controllers; Hummlist stores only the verified
entitlement (product, store, validity), no payment data. Not built yet: job 25 updates this row and
the policy section if its design differs.

## Processors and regions

| Recipient | Role | Region | Transfer basis (verified in job 33d, DECISIONS "Job 33d") |
| --- | --- | --- | --- |
| Supabase Pte. Ltd., Singapore (database, auth, functions) | Processor | eu-central-1 Frankfurt (`docs/SPEC.md`, `docs/BACKUP.md`); edge functions may run elsewhere | SCCs (2021, module 2) in the Supabase DPA; not DPF-listed |
| Vercel Inc. (app.hummlist.com, hummlist.com, mcp.hummlist.com) | Processor | USA | EU-US Data Privacy Framework; SCCs in the DPA (Pro) |
| PostHog Inc. (analytics, error tracking) | Processor | EU cloud, Frankfurt; US sub-processors possible (DPA 10.2) | DPF and SCCs (DPA 10.3, 10.4) |
| GitHub (encrypted backups) | Processor | USA | DPF |
| Google Cloud EMEA Limited, Dublin (Workspace, support mail) | Processor | EU/US | DPF; SCCs if Google stops relying on it |
| Apple (App Store, TestFlight, Sign in with Apple), Google (Play, Google sign-in), Amazon (Alexa) | Independent controllers | | |

## Account deletion and export (job 9)

- Mehr → Konto → Konto löschen: the account function deletes the auth user, profile,
  memberships, tokens and OAuth grants; the last member takes the household with them; otherwise
  items and history stay with `added_by`/`bought_by`/`actor` nulled. Without the app:
  `app/web/konto-loeschen.html` or support@hummlist.com.
- Mehr → Konto → Meine Daten exportieren (`export_my_data`, latest definition in
  `20261030120000_onboarding_invites.sql`): profile, providers, name, household, items_added,
  history, access_tokens, connected_apps, feedback, invites_created, and since job 31
  analytics_decisions and alexa_links (`20261030140000_alexa.sql`).

## Not collected

No advertising, no sale of data, no location (PostHog GeoIP off), no contacts, no tracking or
analytics without consent, no cookies or trackers on hummlist.com (`site/test/preview.test.mjs`).

## Differences to the privacy policy (`site/content/legal/datenschutz.md`)

None found (Alexa is in the policy since job 33f; 33g removed the AI support assistant). Not named
in the policy, both short-lived: the `invite_attempts` rate-limit rows (deleted after about a day)
and the function error logs.
