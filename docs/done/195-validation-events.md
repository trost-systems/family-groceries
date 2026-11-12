# Job 195: validation events F2, F3 and F5 (2026-11-12)

PR: https://github.com/trost-systems/family-groceries/pull/380. Started 20:20 Europe/Berlin, after
the lead brought the 13 Nov 01:00 start forward (BOARD 20:13, Peter t803u).

## Events added

| Event | Side | Sent today | Properties |
| --- | --- | --- | --- |
| `shop_started` | app | no, no prices UI yet | none |
| `price_entered` | app | no, no prices UI yet | `confirmed` (bool) |
| `trip_total_viewed` | app | no, no prices UI yet | `final` (bool) |
| `scan_started` | app | no, no scanner yet | none |
| `off_miss` | app | no, no scanner yet | none |
| `item_added` `source: scan` | app | no, no scanner yet | existing `actor_role`, `household_size` |
| `mcp_tool_call` | mcp function | yes, from the next functions deploy | `tool` (one of the 8 registered tools), `result` (`success`, `fail`), `reason` (`done`, `tool_error`, `premium_required`, `server`) |
| `api_key_used` | api function | yes, from the next functions deploy | `scope` (`read`, `write`) |

The jobs that build the prices and scanner UIs send the F2 and F3 events from their flagged code
paths. The catalog refuses anything else, so they cannot add a price, total, EAN, product or store
name (tests in `app/test/analytics/events_test.dart`).

## Consent, privacy, `is_internal`

- App events go through the existing consent gate (`Analytics`, `checkEvent`), as before.
- Server events go through `userEvents` (`supabase/functions/_shared/user_events.ts`). It sends
  only while the user's newest answer is a yes to the current consent text (the Alexa lookup,
  `analyticsSubject`). `integration_blocked` now uses it too.
- Every event carries `install_id`, `household_id`, `is_internal` and `$geoip_disable: true`. No
  arguments, item, store, list or household names, tokens, token hints, routes or amounts.
- `is_internal` is set as before. In the app it comes from `isInternal`
  (`app/lib/analytics/internal.dart`). On the server it is the `ANALYTICS_INTERNAL` secret, or the
  install's internal mark from its consent record.

## Found and fixed: MCP events were never flushed

The MCP SDK answers `tools/call` with an SSE stream at once and runs the tool afterwards. The
flush that `withTelemetry` ran before the response returned found an empty queue. A tool's
event then waited for a later request in the same isolate, or was lost with it. This already
affected `integration_blocked` from MCP. `withTelemetry` now also flushes when an event stream
ends. Other answers are returned untouched.

## PostHog test-account cohort 293017

Not checked directly: the repository's PostHog key has the error-tracking scope only (no
`cohort:read`, `project:read` or `query:read`). Both sides send without person profiles
(`$process_person_profile: false`). A cohort holds persons, so by PostHog's documented behaviour
the default "filter test accounts" (cohort 293017) removes none of these events, internal ones
included. The gate queries do not depend on it: they filter through `internal.sql`. Peter's
optional step (an `is_internal` event-property filter) is in `docs/NEEDS_PETER.md`, job 195. No
project setting was changed and no person profiles were created.

## Verification

- `scripts/verify.sh --only db,functions,flutter,lint,gitleaks` passed on hz (port block 627xx).
- New tests: the catalog cases on both sides; one `mcp_tool_call` per call with its reason;
  `mcpTools` equals the server's `tools/list`; no `api_key_used` for a missing or unknown key, the
  API switched off, a missing scope, a locked household or an unknown path; the API answer
  waits for the event; and an MCP event reaches the PostHog fetch through
  `withTelemetry` and the SDK's SSE answer. Each fails with its fix removed (checked by hand).
- `premium_integration_test.ts` (real database): an MCP add sends
  `mcp_tool_call {add_items, success, done}` for the consenting install. Locked calls send
  `premium_required` every time, not once an hour.
- Local edge runtime, fake `phc_` key (no project, nothing ingested), temporary log lines (not
  committed):
  - MCP `list_stores` sent `mcp_tool_call {tool: list_stores, result: success, reason: done,
    is_internal: true, $geoip_disable: true}` when the stream ended. With the fix removed, the
    event was queued and never sent.
  - Two API reads sent two `api_key_used {scope: read}`. A read key on a write route sent none.
  - After the consent was withdrawn, neither function sent anything.
- Opus review: nothing must-fix. Applied: wrap only SSE answers (a wrapped body lost its
  Content-Length), run the API's consent lookup next to the operation, narrow instead of
  asserting, and doc and scan-list nits. Kept: one consent lookup before each MCP tool result,
  because the event has to be queued before the stream ends.

## Not touched

No UI, copy, paywall, flags, Vercel, store prices or legal terms. No job 182 or PR #363 files. No
PostHog settings.

## Open

- Peter sets the pass bars for F2, F3 and F5.
- The F2 and F3 events start once the prices and scanner UIs ship.
- Cohort 293017 check and the optional `is_internal` filter: `docs/NEEDS_PETER.md`.
