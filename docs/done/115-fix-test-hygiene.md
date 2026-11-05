# Job 115: test and docs hygiene from the daily verification, 2026-11-05

PR #254, titled "chore: test and docs hygiene from daily verification". It is ready for review and
not merged: the lead reviews and merges. Source: vmaint-20261105 product gap #10, all three items
still present on origin/main (1ba6dc51). Decisions: `docs/DECISIONS.md` "Job 115".

## What was built

1. **e2e asserts the row name the app renders.** `item_row.dart` reads a row as name, details,
   quantity, then „Neu“. `live-sync.spec.ts` and `alexa.spec.ts` (Hafermilch, same mistake)
   allowed „Neu“ only before the quantity. Both now allow it only at the end (`( Neu)?$`).
2. **`WidgetPayloadTest.kt` runs in CI.** `scripts/gates/android.sh`, the existing `android` job,
   runs `./gradlew :app:testDebugUnitTest` after the debug APK. It fails without a test report
   and prints each suite's counts.
3. **docs/done status lines.** 24 files said "not merged", "waits", "before merge", "Open." or
   "still open" for 24 merged PRs (#20, #35, #105, #107, #108, #156, #157, #163, #185, #187,
   #191, #194, #195, #199, #207, #213, #217, #220, #223, #229, #230, #232, #235, #236;
   `53-homepage-v1` names two, `78` and `80` share #207). They now name the merge date and commit, checked with
   `gh pr view` and `git merge-base --is-ancestor` on origin/main. #153 is still open and keeps
   its line; `60-feature-map`'s "#176 was still open at the end of the 2-hour watch" is true of
   that moment and stays.
4. **The android gate's descriptions** (`docs/CI.md`, the comment in `ci.yml`,
   `scripts/ci-changes.sh`) now mention the JVM unit tests.

## How to verify

- `ANDROID_HOME=~/android-sdk JAVA_HOME=~/jdk17 scripts/gates/android.sh` ends with
  `android unit tests: name="com.hummlist.app.widget.WidgetPayloadTest" tests="6" ... failures="0"`.
  With `open = 9` changed to `open = 8` in the test it fails (`6 tests completed, 1 failed`, exit 1).
- CI run 42023250869 (head 270f4b5f, ci-ok green), `android` job 127231773744, printed the same
  line. The run for the review fixes is linked in a PR comment.
- `scripts/verify.sh --only e2e -- tests/live-sync.spec.ts tests/alexa.spec.ts` on hz: 11 passed.
- `grep -rniE "not\s+merged|before merg|merge waits|PR only|still open|not on main" docs/done`
  leaves only lines that are still true: #153 (open), quantities, a closed PR, remaining tasks.

## Not done

- `deno run -A tool/lint/ts/strict.ts` was skipped: #237 is not merged, so the tool is not on main.
- No screenshots: nothing users see changed.
- Job 80's "Anpassen" tip is still not in `app/lib/tips/tips.dart`, although job 78's button
  landed (#207). It needs new UI copy, which this brief forbids; `80-polish-access-tips-account.md`
  says so. A follow-up job with copy can add it.

## Review 0

Must fix: the sweep missed #217, #199 and #207 (phrased "before merge", "Open.", "merge waits").
Fixed, and the sweep widened (item 3). Also done from the nice-to-haves: #20, #35, the 33b tense,
the 80 follow-up note, the android gate descriptions (item 4), and the CI run citation.
