# Job 125: account and auth spec flakes (#57 #58 #59 #60)

**What.** A root-cause pass over four flaky e2e tests: account.spec.ts:154 (the last member
deletes their account, #57), :200 (offline deletion is refused, then goes through, #58), :220
(Meine Daten exportieren, #59) and auth.spec.ts:8 (sign out and back in, #60). Verdict: #57, #58 and
#59 are host-pause only. #60 is host-pause too for its issue's failure, but on main 4a103f67 it
also failed once under an 8 s stack pause (a statement timeout, below), so it is not labelled
host-pause only. No app or spec code changes. The evidence is in DECISIONS "Job 125", and
the decision to close the issues is in NEEDS_LEAD "Job 125".

**How.** Job 18c's method (DECISIONS 18.23) with job 119's pause harness `scripts/e2e-stress.sh`
(#261 at 72aafe88, not yet on main; the runs used a copy named `scripts/e2e-pause.sh`). Each condition ran the four tests with retries off, `--workers=1`, under
`/tmp/fg-e2e.lock`, on the release web build against the job's own stack (625xx):

```
flock /tmp/fg-e2e.lock scripts/e2e-stress.sh --target runner|browser|stack --on <s> --every <s> \
  -- tests/account.spec.ts:154 tests/account.spec.ts:200 tests/account.spec.ts:220 tests/auth.spec.ts:8 \
  --retries=0 --workers=1 --repeat-each=5
```

`--target none --cpus 0` is the one-CPU condition.

**Results** (origin/main 1ba6dc51). Up to 9 s pauses of the runner, the browser or the stack,
and under one-CPU starvation, 220 of 220 runs passed. At 12 to 25 s pauses, 20 runs failed. Each
failure was one 10 s `expect`, or `typeInto`'s 20 s predicate, whose budget the pause used up,
with the step before still on screen. A 25 s runner pause reproduces the issues' signature
"Timeout 20000ms exceeded while waiting on the predicate" in `typeInto`, and the stall detector
names that pause. On current main (4a103f67, after #256 and #257 changed the login and account
screens) the same pattern held, with one more finding. An 8 s `docker pause` of the stack made
`create_household` answer 500 (`57014`, the `authenticated` role's 8 s statement timeout), and
the app showed its error on the form, as it should (DECISIONS Job 125 item 5). The per-test
tables are in DECISIONS Job 125.

**Proof.** `npx playwright test tests/account.spec.ts tests/auth.spec.ts --repeat-each=20
--workers=1 --retries=0` under `flock /tmp/fg-e2e.lock` on the release web build:
`200 passed (17.8m)` on 1ba6dc51 (host load 10 to 12), and `200 passed (16.9m)` on the PR's
head over main 4a103f67. Review 0 reran it on bd200377 (main 76a56b18): `200 passed
(23.3m)`. Review 1 ran the two specs 10x with retries off on GitHub Actions on 8ede8a7c
(`scripts/ci-e2e.sh`, run 42167201185): 100 passed. ci-ok on 8ede8a7c: run 42166681274; the
final head's run is in the PR comments.

**Not done, by the brief.** The issues stay open. The PR says `Refs #n (host-pause only)` for
#57 to #59 and a qualified `Refs #60`. The lead decides whether to close them.

**Review 0.** #60's label and the NEEDS_LEAD headline now carry the current-main result (the
8 s stack failure). Not done: the diagnostic run showing each flow finishes after a long pause
(another multi-hour wait on the e2e lock); the "never an error" claim still rests on the
snapshots taken during the pause.

**Review 1.** DECISIONS item 4 no longer says no sub-budget pause broke a wait: it names the
8 s statement-timeout failure (item 5) as the one exception, and item 5 says the budget that ran
out is the server's production setting. The PR body's conclusion says the same.

**Requeue (review 2).** Rebased onto main 9a1dec19 after #237 landed. The only conflict was
DECISIONS, where both sections were appended at the end: main's Job 101 entry and this job's
are both kept, and the diff against main still only adds lines. No wording changed.

**Review 3 (pass).** Rebased again onto main after #260 made the PR conflict. Review 3 ran the
brief's 20x command on 4b0a4b26 (post-#237 specs) on GitHub Actions: `200 passed (16.1m)`, run
42189832035; it is now in the PR's Proof list. DECISIONS item 3 cites review 3's direct check
that deletion finishes 0.7 s after a 12 s stack pause ends; export and sign-in recovery after
pauses over 10 s stay inferred.
