# Job 121: mcp.spec.ts flakes (#68, #69, #70)

**What.** The three tests failed only inside host pauses (VM holes of 417 to 2754 s). No test
wait, app race or server problem caused them. No test or code changed, and the PR is docs only.
The repro harness and every arm's log are in the job's ops dir, `proof/`. The harness runs CPU
burners, stops the runner and Chromium with SIGSTOP, runs `docker pause` on the stack, and logs
each pause. A pause `S/P` means stopped S s, then running P s. Job 119's `scripts/e2e-stress.sh`
(#261, not on main) does the same job with different flag semantics, so this job doesn't commit
a third stress tool; job 122 has `scripts/e2e-pause.sh`. Evidence is in DECISIONS "Job 121",
and the close-or-keep call for the Lead is in NEEDS_LEAD "Job 121". PR #264 says
`Refs #68 #69 #70 (host-pause only)` and closes nothing.

**Findings.**
- With retries off on main's release web build, the three tests passed 90 of 90 stressed runs.
  That is 6 arms of 15, each with every stall under 10 s: load, runner stops up to 8 s, stack
  stops up to 9 s, and all three together.
- They fail at 10 s. The stack stopped 11 s, then up 15 s, failed 4 of 15. The runner stopped
  15 s, then up 20 s, failed 1 of 15, and the stall detector named it. The stack stopped 20 s,
  then up 20 s, failed 3 of 15. Each failure is a 10 s `expect` across one server round trip.
  A 30 s `expect` passes 11/15 (15 of 15, review 1), but the budgets stay: no real stall under
  10 s fails, and a longer wait would hide stalls the retry should see.
- GoTrue's 504 at 10.0 s (#70's "Processing this request timed out") comes only when the
  database stalls under a running GoTrue. Paused alone, the db gave a 504 after 12 s and 20 s
  and a 200 after 9 s. A whole-stack pause of 12 s or 20 s gave 200 (11.6 s, 19.6 s).
- CI: `mcp.spec.ts` ran in 679 of 1,629 e2e jobs from 2026-10-28 to 2026-11-05. None failed or
  retried.
- Ruled out:
  - A learned-correction read before its commit: it is one transaction, and the triggers learn
    inside it.
  - OAuth setup in #68 and #70: they connect with a token.
  - GoTrue's sign-in rate limit: not enforced locally.

**Verify.** The steps are in NEEDS_LEAD "Job 121": copy `proof/e2e-stress-121.sh` to
`scripts/`, then run `--stack 11/15` and `--stack 9/12` on "another household" x5.
Run on head a030ac03 (2026-11-06, under the lock): `--stack 11/15` gave 2 failed, 3 passed, both at `answerConsent`'s 10 s `toHaveURL`. `--stack 9/12` gave 5 passed. Logs: `proof/recipe-11-15.log`, `proof/recipe-9-12.log`.

**20x.**
- On hz, `npx playwright test tests/mcp.spec.ts --repeat-each=20 --workers=1 --retries=0` ran
  under `flock /tmp/fg-e2e.lock` on the release web build of main 698ebeba's app with its
  migrations: `160 passed (22.7m)`.
- On GitHub Actions, the same 20x passed on 5fb77f7 (run 42115596149: 160 passed, 0 failed,
  0 flaky). On head a030ac0 (app of main 4a103f67), run 42179165845 gave 160 passed, 0 failed, 0 flaky.
- Review 1, on head 94171550 (main 45a40cbe's app): CI run 42200609227 gave 160 passed, 0
  failed, 0 flaky, and the local hz run gave `160 passed (19.7m)`.

**Review 0.**
- The rerun recipe pointed at #261's flags, which count pauses differently, and its "passing"
  arm failed. The docs now give the arms as they ran, and the recipe uses the script that ran
  them.
- "105 of 105" was a miscount, and is now 90 of 90.

**Review 1.** The reason for keeping the 10 s budgets claimed that GoTrue's 10 s limit capped
them. It doesn't: a whole-stack stall gives no 504, and a 30 s `expect` passes. The reason is
now "a longer wait hides stalls; none under 10 s fails". GoTrue's 504 is described as what it
is, a database stalled under a running GoTrue, rechecked on hz (db only: 504 at 10.0 s; five
containers: 200 after 11.6 s and 19.6 s). The recipe also says to wait for the db's
healthcheck between runs.

**Open.** Whether to close #68, #69 and #70 is the Lead's call (NEEDS_LEAD). The fixtures'
stall retry cannot see a stall of the stack alone. Neither CI nor this repro showed one outside
a pause made on purpose. Treating GoTrue's `request_timeout` 504 as a stall mark in
`e2e/tests/fixtures.ts` would cover only a database stalled under a live GoTrue, not a
whole-stack stall.
