# Job 73: the Hummlist API

People can automate their Hummlist list over HTTP: a curl call, an iOS Shortcut, n8n, Zapier or
Home Assistant adds, lists, ticks and moves items with an API key made in the app. The API sits
next to the MCP server and runs the same list code. It ships dark: the app shows the API section
only while the PostHog flag `public-api` is on, and the flag does not exist yet (NEEDS_LEAD
"Job 73").

## What was built

| Part | Where |
| --- | --- |
| Guide (auth, resources, endpoints, idempotency, errors, limits, versioning, privacy) | `docs/API.md` |
| OpenAPI 3.1 contract, validated in the lint gate and compared with the route table | `docs/api/openapi.yaml`, `supabase/checks/openapi_test.ts` |
| Edge function `api`: route table, limits, error envelope, operations, request pipeline | `supabase/functions/api/` |
| One list module for MCP and API (moved from `mcp/list.ts`) | `supabase/functions/_shared/list.ts` |
| API keys (kind `api`, scopes), `api_begin` (address throttle, key, token bucket, household day), idempotency records, `api` in the integration lock, daily purge | `supabase/migrations/20261102130000_public_api.sql` |
| App: Mehr → Zugänge → API (URL, docs link, create with "Nur lesen" or "Lesen und schreiben", shown once, revoke, Premium line) | `app/lib/settings/access_*.dart`, `app/l10n/` |
| `FLAGS_ON` define to force a flag in builds that cannot reach PostHog | `app/lib/app/environment.dart`, `docs/ANALYTICS.md` |

Endpoints: `GET /v1/items` (aisle order, `store`/`category` filters, cursor pages, whole-list
counts), `GET /v1/items/{id}`, `POST /v1/items` (1 to 50, the shared name parsing),
`POST /v1/items/{id}/tick` and `/untick`, `PATCH /v1/items/{id}` (category and/or store),
`GET /v1/categories`, `GET /v1/stores`.

Limits (`supabase/functions/api/limits.ts`): 20 burst per key refilled at 60 a minute, 1000 a day
per household, 20 unknown keys per address (the gateway's `X-Real-IP`) in 10 minutes, 50 items per batch, 64 KiB
bodies, pages of 1 to 100, idempotency 24 hours, 10 keys per member. Every response carries
`X-RateLimit-Limit`, `-Remaining`, `-Reset` and `X-Request-Id`; a 429 adds `Retry-After`.

Premium: the API is a Premium integration (Addendum 1). While `integration_lock` is on, a household
without Premium gets `402 premium_required`; it is off until the paywall release.

## How to verify

- `supabase test db supabase/tests/api.test.sql`: 56 checks on keys, scopes, the bucket, the day,
  the throttle, RLS, the lock and the purge.
- `FG_DB_TEST=1 SUPABASE_DB_URL=… deno test --allow-env --allow-net --allow-read api/` in
  `supabase/functions`: the handler with fake dependencies (19 cases) and the real database
  through `handle()` (5 cases: endpoints, pagination, households, idempotency including
  concurrent twins, the real 429 and throttle, revoked keys, the lock).
- `scripts/verify.sh --only e2e -- tests/public-api.spec.ts`: over HTTP through the local gateway.
  A key adds items the open list shows, ticks one off the list, moves one, pages; a read key gets
  403; a burst of 30 ends in 429 with `Retry-After` and the rate headers; unknown keys from one
  address end in `auth_throttled` whatever `X-Forwarded-For` says, while a revoked key polling 30
  times is never throttled and a valid key from the blocked address still gets 200.
- The MCP tests are unchanged apart from import paths, and green.
- Screenshots: `docs/screenshots/73/`.

## Review 0 fixes (2026-11-02)

- The migration is now `20261102130000_public_api.sql`, after job 72's `alexa_free`, and its
  `integration_gate` keeps Alexa free while gating `api`; pgTAP checks the final function (Alexa
  open and MCP locked without Premium, the API open with Premium).
- The address is the gateway's `X-Real-IP`, verified on the hosted project (a forged
  `X-Forwarded-For` reaches the function unchanged; `X-Real-IP` is overwritten; DECISIONS 8).
- Only unknown keys count and get blocked; revoked, missing and valid keys never (DECISIONS 14).
  Ended failure windows are pruned on write.
- 503 carries `Retry-After`; API.md says that 4xx answers count against the limits and that a 429
  does not.

## Missing or blocked

- The PostHog flag `public-api` (project 319492) is for the lead to create; it stays off.
- A short domain such as `api.hummlist.com` needs Peter's OK; webhooks and OAuth for third-party
  apps are v2 ideas (`docs/API.md`, "Later").
- Copy: the integration-lock card does not name the API, and the API's Premium line is a
  placeholder for Hummlist Launch.
