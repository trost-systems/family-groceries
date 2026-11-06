# 124-fix-functions-empty-body: the local edge runtime drops finished answers (2026-11-05)

Issue #226 (`public-api.spec.ts:118`) and the purchases claim in `household-bound.spec.ts`
(PR #253) failed with `SyntaxError: Unexpected end of JSON input`. Issue #265 is the same claim
line through `premium-yearly.spec.ts:113`. Its CI log step kept only the last 300 runtime log
lines, so the `connection aborted` line is not in it. PR #260 fixes #226 and #265.

What it was:

- The local edge runtime sent its own 503 with an empty body (`x-served-by: base/server`, log
  line `connection aborted (uri: ...)`) for a request the function had already answered. Both CI
  logs have that line for the failing request.
- Cause: under the `oneshot` policy the runtime ends a worker as soon as its answer is read, and
  that end cancels the request's connection token. If the token is cancelled before the answer's
  head reaches the outer server, the outer server drops the answer. The race is in edge-runtime
  (v1.77.x and upstream `main`), not in the app, the tests or the fixtures. Details and source
  references: `docs/DECISIONS.md`, "Job 124".

What changed:

- `supabase/config.toml`: `[edge_runtime] policy = "per_worker"` (was `oneshot`, DECISIONS 3.11).
- `e2e/tests/helpers.ts`: `functionJson(res)`. The function calls in `public-api.spec.ts`,
  `iap.ts`, `voice.spec.ts` and `item-details.spec.ts` use it instead of `res.json()`. A non-JSON
  answer fails with its URL, status, `x-served-by` and body. Assertions are unchanged.
- `e2e/runtime-drop-probe.mjs`: counts dropped answers (unknown-key requests to the api function).
- `docs/NEEDS_LEAD.md`: whether to report the race upstream.

How to verify:

- `docker update --cpuset-cpus 11 supabase_edge_runtime_<project_id>`, turn on
  `app_switches.public_api`, then `node e2e/runtime-drop-probe.mjs http://127.0.0.1:<port>/functions/v1 300`.
  Pinned `oneshot` dropped 6 to 23 of 200 to 300 requests. Pinned `per_worker` dropped 0 of 300
  GET, 0 of 300 POST, 0 of 5000 GET and 2 of 8000 POST at 8 parallel (at worker retirements).
- Spec, same pin, `--repeat-each=10 --workers=1 --retries=0`: `oneshot` 23 of 30 failed (27
  `connection aborted`), `per_worker` 30 of 30 passed (0). Unpinned `per_worker`,
  `npx playwright test tests/public-api.spec.ts --repeat-each=20 --workers=1 --retries=0` under
  `flock /tmp/fg-e2e.lock` on the release web build: `60 passed (4.1m)`. Review 1 reran it:
  `60 passed (5.4m)`.
- The purchases claim path, stressed by job 143 (PR #289) with `premium-yearly.spec.ts`: pinned
  `oneshot` 12 of 50 failed (12 `connection aborted`), pinned `per_worker` 200 of 200 passed.
- Full e2e on GitHub Actions with `per_worker`: on-demand runs 42061214665 and 42064017398 and
  PR CI runs 42061190881 and 42134251924 (earlier heads), 201 tests each, 0 failed, 0 flaky. ci-ok
  on the pushed head comes from the PR's latest CI run (see the PR).
- Reviews: review 0 FIX (#265, ci-ok cite), review 1 PASS.

What is left:

- A retiring `per_worker` worker can still drop an answer (2 in 8000 under the pin). It now
  fails with a message that names the runtime. A POST on a retiring worker can also get a JSON
  500 (`WorkerAlreadyRetired`), which fails on the test's status assertion.
- Follow-ups in `docs/NEEDS_LEAD.md`: the CI edge log step's 300-line tail, and narrowing
  `timedFetch`'s retry in `mcp-helpers.ts` to bodiless calls. The upstream report is the Lead's call
  (`docs/NEEDS_LEAD.md`).
- Unknown: whether hosted Supabase drops answers the same way.
