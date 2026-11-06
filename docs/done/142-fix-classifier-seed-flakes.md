# Job 142: classifier.spec.ts seed dictionary and add-sheet flakes (issues #111, #159)

**What.** Both issues are one flake: in `seed dictionary spot checks` (and once `SPELLING
VARIANTS`), `enterItem` clicked the add field and the add sheet never opened. No run got as far
as a seed category assertion. The cause is in the app, and job 52 (#156, c4d4090d) fixed it on
main on 2026-11-01. On the web a click can reach the field as a semantics focus, which never
calls `TextField.onTap`, and only `onTap` opened the sheet. Every reported run is older than
that commit. This PR adds the proof and no code (DECISIONS 142).

**Evidence.**
- CI since the fix: 438 `ci.yml` runs ran e2e from 2026-11-01 06:15Z to 2026-11-06 02:46Z, 426
  of them on commits containing c4d4090d. None failed on the add sheet opening, in any spec. The
  two later classifier.spec failures of this kind are on `job/54-demo-videos` commits based
  before the fix.
- Stressed before/after on hz (`--workers=1 --retries=0`): the seed test 5 times per mode. Before
  (8e72815f, the commit #159 failed on) failed 15 of 20: 0/5 with no pauses, 0/5 with browser
  pauses, 0/5 with runner pauses, 5/5 on one CPU, every failure #159's `helpers.ts:526`. After
  (main a94d46c5) passed 28 of 28: no pauses, one CPU, browser, runner and stack pauses (3 s of
  8), browser pauses of 9 s.
- Isolation (review 0): on #156 itself the seed test passed 5/5; with only the line that arms
  `_openOnFocus` in `_close` set to false it failed 0/5 with #159's signature. So that focus
  route is the fix.
- Guard on today's main: the widget tests "after closing, a semantics tap (and focus) on the
  field opens the sheet again" in `app/test/list/add_sheet_test.dart` (pass on main, fail
  without the route per review 0). The e2e spec alone no longer catches it: Playwright's click
  now arrives as a real tap. No retry was added to `enterItem` (DECISIONS 142.6).
- 20x on main: `npx playwright test tests/classifier.spec.ts --repeat-each=20 --workers=1
  --retries=0` under the e2e lock: 60 passed (17.2 min). On GitHub Actions
  (`scripts/ci-e2e.sh --spec "tests/classifier.spec.ts --repeat-each=20 --retries=0" --no-db`,
  run 42159601563): 60 passed, 0 failed, 0 flaky. Again on this PR's later heads, each 60/60:
  42190369390 (93d2417a), 42204782964 (9037665c), 42226320986 (2ee83a34), 42244189033 (b222c76c).

**Where.** `docs/DECISIONS.md` (Job 142), this file. The stress harness is job 119's
`scripts/e2e-stress.sh` from its open PR #261 (not on main), run from a copy.

**Verify.** `scripts/ci-e2e.sh --spec "tests/classifier.spec.ts --repeat-each=20 --retries=0"
--no-db`, or locally under `flock /tmp/fg-e2e.lock` the 20x command above.

**Open.** Nothing for these issues. Stack 642xx stopped.
