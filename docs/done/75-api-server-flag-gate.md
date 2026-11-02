# Job 75: the public API's server switch (2026-11-02)

## What was built

- `supabase/migrations/20261102200000_public_api_switch.sql`: the row `public_api` in
  `public.app_switches`, seeded `false`. `create_api_token` raises `api_disabled` (42501) while it
  is off. `api_begin` returns the outcome `disabled` as its first step, so nothing is read or
  counted. Both function bodies are job 73's with only these checks added.
- `supabase/functions/api/handler.ts`: `Begin` gains `{ outcome: 'disabled' }`. The request
  answers `404 {"error":{"code":"not_found","message":"No such endpoint."}}`, the unknown-path
  answer (`noSuchEndpoint()` in `errors.ts`), without rate-limit headers. CORS, `X-Request-Id` and
  OPTIONS stay.
- App: `api_disabled` shows `apiDisabled` („Die API ist noch nicht freigeschaltet.“, EN "The API
  isn't available yet.") in Zugänge.
- Docs: `docs/API.md` "Switched off", `docs/NEEDS_LEAD.md` "Job 75" (how to turn it on),
  `docs/DECISIONS.md` "Job 75" (supersedes job 73's decision 10), the verify-hummlist feature map.

## How to verify

- `scripts/verify.sh --only db,functions,lint`: pgTAP `public_api_switch.test.sql` (off by
  default, refusals, nothing written while off) and `api.test.sql` (switch on inside its
  transaction); Deno `api/handler_test.ts` (404 without rate headers, Premium and execute never
  called) and `api/api_integration_test.ts` (off, 404, on again, 200, against the local stack,
  test households only).
- `scripts/verify.sh --only e2e -- tests/public-api.spec.ts` (turns the switch on for the local
  stack).
- Over HTTP through the local gateway: `docs/screenshots/75/http-proof.txt`.
- In the app (verify-hummlist, `FLAGS_ON=public-api` build): `docs/screenshots/75/`.

## Test results (local, hz)

- db gate: pgTAP 34 files, 1704 tests; DB integration 33; all pass.
- functions gate: 554 passed, 33 ignored. lint: pass.
- `flutter analyze` clean; `flutter test test/settings/` 124 passed.
- e2e `tests/public-api.spec.ts`: 3/3.
- HTTP proof: off gives `api_disabled` and 404 for no key, a bogus key and a real key, with 0
  failures counted; on gives 200 with the rate headers.

## Missing or blocked

Nothing. Production gets the switch's default (off) from the migration through
`supabase-deploy.yml` after the merge; turning it on is the lead's step (NEEDS_LEAD "Job 75").
