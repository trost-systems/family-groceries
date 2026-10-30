# Job 25b: Hummlist Lifetime review follow-ups

Job 25's review 0 passed with no must-fix items. Its nice-to-haves 1, 2, 3 and 5 are real behavior
gaps, so this job fixes them. The calls and their reasons are in docs/DECISIONS.md, "Job 25b".
Purchases stay sandbox-only and inert on the hosted project. No secrets, store products or
App Store Connect or Play changes were touched.

## What changed

1. **The server refuses a transaction for good: the app finishes it** (review item 1).
   - `purchase_api.dart`: a 400 or 422 answer is now `VerificationRefused(code)`, a final word
     next to `Verified`. `VerifyProblem.refused` is gone.
   - `purchase_cubit.dart`: on a refusal the cubit finishes the transaction with the store and
     shows `FlowNotAccepted`. `FailureKind.refused` is gone.
   - The page shows one note (`lifetime-not-accepted`): "Der Beleg des Stores wurde nicht
     angenommen (…). Falls du Hummlist Lifetime gekauft hast, tippe später auf „Käufe
     wiederherstellen“." It has no Retry button.
   - A refused transaction is not sent again on retry, on a session change, or at the next start.
     Only a restore the user asks for sends it again, and a grant then unlocks.
   - Transient failures (offline, 429, 401/403, 5xx, 503 inert) stay unfinished and are retried.
   - DECISIONS 25b.1 explains why finishing can't lose a purchase that would verify later.
2. **Production without Sandbox is inert** (from thinking through the App Review case).
   `configFrom` turns `PURCHASES_ENVIRONMENTS=Production` without Sandbox into "not configured"
   (503). App Review's and TestFlight's sandbox purchases then stay queued in the app and verify
   by themselves once the list is fixed, instead of being refused for good (DECISIONS 25b.2).
3. **Apple notifications** (review item 2). A notification whose `signedTransactionInfo` has
   another `environment` than its `data.environment` is refused: 400 `environment_mismatch`,
   nothing changed.
4. **`docs/done/25-iap-sandbox.md`** (review item 3) has the landing record of the ops copy (run
   41124293915 after one rerun of the classifier flake #111, issue #130). The two copies are now
   identical (`diff` prints nothing).
5. **`scripts/gates/e2e.sh -- <spec>` runs only that spec** (review item 5). Playwright ignores
   every argument after a `--`, so the gate now drops a leading one. The new
   `scripts/e2e-gate-test.sh` (lint gate) runs the real gate with its stack, build and Playwright
   stubbed out, and checks what Playwright gets.

Docs: `docs/PURCHASES.md` (flow step 4, the cases table, the secret row) and the verify skill's
`features/purchases.md` (`iap-refused`).

## How it was verified

- Cubit tests, group "a refused proof":
  - A refusal is finished and gets one call; retry and a session change add none.
  - Next to an offline one, only the offline one goes again.
  - A restore after the refusal sends it again, and the grant unlocks.
  - A failing finish still isn't re-sent.
  - Across two launches over the app's own `FakeStore` (it re-delivers unfinished transactions
    like StoreKit 2), the second launch sends nothing.
  - With the old refused branch put back, the "never sent again", "only the offline one",
    "failing finish" and "next start" tests fail.
- API test: 400 and 422 map to `VerificationRefused`. Screen test: `lifetime-not-accepted` shows,
  and `lifetime-retry` doesn't.
- Deno: `handler_test.ts` "an Apple notification whose transaction is from another environment is
  refused" covers both directions, and nothing is revoked. It fails with the check taken out.
  `config_test.ts` covers Production-only being inert.
- `scripts/e2e-gate-test.sh`: 6 cases. With main's `e2e.sh` it fails (`npx playwright test --
  tests/purchases.spec.ts`). Playwright itself, on a scratch config: `test --list -- a.spec.ts`
  lists both files, and `test --list a.spec.ts` lists one.
- Live, against the served function on a local stack (ports 553xx):
  - A forged JWS (one signature character changed) gets 422 `bad_signature`, and the
    `purchases` table has 0 rows.
  - The app's real `SupabasePurchaseApi` inside the cubit (a throwaway test, not committed) gets
    `VerificationRefused bad_signature`. The cubit shows `FlowNotAccepted` and finishes the
    transaction once. After `retry()` and a session change, the live function had still been
    called once.
  - A REFUND notification signed by the test CA, Sandbox outside and Production inside, gets
    400 `environment_mismatch`, and the purchase stays active. The matching REFUND gets
    `revoked`, and the unlock goes.

## Screenshots

`docs/screenshots/25b/job25b-app-not-accepted-{de,en}-{390,1366}.png`, rendered by
`app/test/purchases/screenshots_test.dart` (the real page in More with the fake store). This
runner can't build the Linux desktop app.

## Not in this job

- StoreKit XCTests in CI (issue #130): they need macOS runner minutes, so they stay with Peter.
- Privacy section 5a waits on Peter (NEEDS_PETER Job 25). NEEDS_LEAD Job 25 is unchanged; its
  P2 already says `Production,Sandbox` from review on, which is now also the only accepted
  production setting.

## Landing record

- Merged #132 on 2026-10-31 under the Mac merge lock: PR head d16bdf8, main 2f2176b (rebase-merge
  re-commits; same tree).
- CI on d16bdf8: run https://github.com/trost-systems/family-groceries/actions/runs/41141239253,
  `ci-ok` green on the first attempt (both e2e shards, db, functions, flutter, ios, android). No
  reruns, no flakes.
