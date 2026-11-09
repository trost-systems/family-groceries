# Job 173: partner news on phones, the household cap on joins (2026-11-09)

PR [#338](https://github.com/trost-systems/family-groceries/pull/338). Two product gaps from
vmaint-20261109 (gaps 1 and 2). Reasons: docs/DECISIONS.md, "Job 173".

## What was built

- **„1 neu von Lea“ on phones.** Since the household chip (#327) the line got no room in the bar
  on a phone and showed as an empty capsule. The bar now measures its room for the line
  (`_statusRoom` in `app/lib/list/list_screen.dart`). Where the whole line doesn't fit, the same
  capsule shows right below the household chip, floating over the top of the list (`_StatusBelow`,
  in the list screen's stack so it takes its own taps). Where it fits (tablet, web) it stays in
  the bar. The chip keeps its width. Below the chip it ends before the column under „Anpassen“
  (a store divider's count and fold key stay usable; a long name takes a second line while two
  fit at the text size, else ellipsizes), and a screen reader
  reads it before the list. No new copy.
- **The 10-household cap on every way in.** Migration
  `supabase/migrations/20261109174625_households_join_cap.sql`: a before-insert trigger on
  `household_members` and on `join_requests` raises `too_many_households` at 10 under the user's
  memberships lock (joins of new and old builds, `join_household`, restores, approvals, future
  paths); `decide_join_request` closes the request of a requester who reached 10 since asking as
  `cancelled`. Old builds' joins move out of the default household first, so they still work at
  10; the oldest builds' `join_household` still answers null for a household with approval on;
  the pre-169b builds' `accept_invite` into such a household at 10 now gets the error instead of
  `requested`, the same generic error to them. The app's existing message shows.

## How to verify

- `supabase test db supabase/tests/households_join_cap.test.sql` (or the whole `supabase test db`):
  38 checks, 10 refused and 9 joins per path.
- `cd app && flutter test test/household/switcher_test.dart test/list/list_screen_test.dart
  test/household/join_approval_test.dart test/session/session_cubit_test.dart`.
- `scripts/verify.sh --only e2e -- tests/partner-news.spec.ts` (the phone case at 390 and 360 px).
- Live: verify-hummlist `launch.sh`, then `node /workspace/hummlist/research/173/live.mjs`
  (scratch drive: Noah adds, Mia's phone at 390/360/1366 px; Ida at 10 joins through the join
  screen).

## Test results

- pgTAP: new file failed before the migration (`accept_invite add at 10` joined, count 11), 38/38
  after; whole suite 50 files PASS.
- Widget: the two phone tests fail on the old `list_screen.dart` ("the whole line shows"), pass
  now; list, switcher, join approval and session tests pass; full flutter gate PASS.
- e2e: partner-news, list, list-header, live-sync and households specs, 21 passed locally. Gates
  lint, flutter, db, changelog, gitleaks: PASS.
- Live on the release web build (commit 161a8496): PASS (evidence
  /workspace/hummlist/research/173/evidence/fx-1109-2004-cqp7/).
- Opus review 0 (`jobs/173-fix-phone-news-join-cap/review.0.md`): FIX with three must-fixes, all
  done in the PR (capsule clear of a divider's controls, the old-build answer documented and
  `join_household` kept, gaps 3-6 stated as open). Review 1: PASS; its nice-to-haves are in too
  (a second line for long names, doc fixes), except the reading order chip-then-news (the line is
  read first, before the chip). Review 2 (that delta): FIX, two lines were cut at 1.5x text;
  fixed (a second line only while two fit, tested on the text's own height). Review 3: PASS.

## Screenshots

`docs/screenshots/173/`: news-390.png, news-360.png, news-1366.png, join-at-10.png.

## Missing or blocked

- Where the line sits on a phone is a design call for Peter (docs/NEEDS_PETER.md, job 173):
  while it shows it covers the left end of the first store divider, as the sync card does.
- Gaps 3-6 of vmaint-20261109 (copy items): not checked. The summary file stays on the box and
  never reached hz (asked on BOARD at 18:44 and again after review 1; no copy arrived). Listed as open in
  docs/NEEDS_PETER.md (job 173, item 4).
- A copy item: an approval for a requester who reached 10 meanwhile reads as a decline
  (docs/NEEDS_PETER.md, job 173, item 3).

## Post-merge review 0 (docs follow-up, job/173b-news-cover-docs)

The post-merge Opus review (FIX, one must-fix) found that docs/NEEDS_PETER.md (job 173 item 1)
understated what the phone placement covers: the line stays until each new row has been on
screen for 3 s, which for an add below the fold means until the user scrolls to it (still
showing after 60 s in the review's drive), covering the first store divider's badge and name
and, once scrolled, the start of the top rows. Item 1 and DECISIONS now say so; item 3 also
notes the oldest builds' `join_household` and the restore wording. Docs only.
