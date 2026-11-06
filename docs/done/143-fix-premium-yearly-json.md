# Job 143: premium-yearly.spec.ts "Unexpected end of JSON input" (issue #265)

**What.** No code change. Issue #265 is job 124's empty-503 race (issue #226), and PR #260 fixes
it (merged as 5062100c). This PR adds the proof on `premium-yearly.spec.ts`.

**Root cause** (DECISIONS 124, 143). Under `[edge_runtime] policy = "oneshot"` the local edge
runtime sometimes drops an answer the function already sent and returns its own empty 503. It
logs `connection aborted (uri: ...)` when that happens. Before #260 the spec read the purchases claim
and the RevenueCat webhook answers with `res.json()` (`e2e/tests/iap.ts`), so an empty body
failed as `SyntaxError: Unexpected end of JSON input`.

**Verify.** Run on hz with the stack on 643xx, the release web build, and
`npx playwright test tests/premium-yearly.spec.ts --workers=1 --retries=0` under
`flock /tmp/fg-e2e.lock`. The edge runtime was pinned to one CPU
(`docker update --cpuset-cpus 11 supabase_edge_runtime_<project_id>`), as in job 124.

| Code | Runs | Failed | `Unexpected end of JSON input` | `connection aborted` in the runtime log |
| --- | --- | --- | --- | --- |
| main 6da42673 (`oneshot`), pinned, `--repeat-each=10` | 50 | 12 | 11 | 12 |
| main 6da42673 + #260's `config.toml` policy, `iap.ts`, `helpers.ts` (`per_worker`), pinned, `--repeat-each=20` | 100 | 0 | 0 | 0 |
| the same, pinned, `--repeat-each=20`, second run | 100 | 0 | 0 | 0 |
| main with #260 merged + this PR, d65ce43e, pinned, `--repeat-each=20` (review 3) | 100 | 0 | 0 | 0 |
| PR #260 a9dcb625 on GitHub Actions, unpinned, `--repeat-each=20` (run 42154588914) | 100 | 0 | 0 | n/a |
| main 9a1dec19 (`oneshot`) on GitHub Actions, unpinned, `--repeat-each=20` (run 42185909564, review 0) | 100 | 0 | 0 | n/a |

The two unpinned CI rows don't tell main from #260: the race shows only under the one-CPU pin.
The pinned rows are the evidence for the fix.

On main, every failure matches a `connection aborted` line. 4 were on `/purchases/claim`, 7 on
`/purchases/revenuecat/webhook`, and 1 on `/account/delete`. The `/account/delete` drop is the
one failure that isn't a JSON error: the app showed its error and never reached the sign-in
screen, so the `toBeVisible` check failed.

**What's left.** With `per_worker`, a retiring worker can still drop an answer (job 124 counted 2
in 8000 under the pin). Under #260 it now fails with a message that names the runtime.
#260 merged as 5062100c and closed #265.

Raw evidence (run summaries, `connection aborted` lines, the lock script and logs) is kept in the
ops job dir `jobs/143-fix-premium-yearly-json/evidence/`.
