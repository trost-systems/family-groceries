# Job 138: shake to send feedback, teach copy, richer non-PII context

PR: https://github.com/trost-systems/family-groceries/pull/281. Not merged: the lead merges.

## What was built

- **Shake** (`app/lib/feedback/shake.dart`). On iOS and Android, a shake opens the feedback
  form about the screen on display. `ShakeDetector` fires on three swings above 2.7 g within
  800 ms, then stays quiet for 1.5 s. `ShakeToFeedback` sits inside `ListScope` in `AppShell`,
  so sign-in, onboarding and consent screens never trigger it. It listens only while the app is
  in front. A shake while the feedback form or any other popup is open does nothing. Web and
  desktop never subscribe. The new dependency is `sensors_plus`.
- **Screen rule.** A shake reports the live screen (`ScreenTracker.current`). More keeps the last
  screen before More.
- **Context**, taken when the form opens (`FeedbackScene` in `feedback_context.dart`):
  `entry_point`, `device_model`, `theme`, `orientation`, `text_scale`, `online` and
  `entitlement`. The fixed value sets are in DECISIONS "Job 138" and `docs/FEEDBACK.md`.
- **Migration** `supabase/migrations/20261113160000_feedback_context.sql` adds 7 nullable
  columns with checks, an insert grant and `export_my_data` with the fields. The pgTAP tests are
  in `feedback.test.sql` and `account_deletion.test.sql`.
- **Copy.** The approved teach line (DE/EN) shows on phones only. The „Wird mitgeschickt:“ line
  lists every field.
- **Analytics.** `feedback_submitted.entry_point` is `more` | `shake`.
- **Docs.** FEEDBACK.md (columns, Monday SQL, which `scripts/feedback-monday.sh` checks),
  ANALYTICS.md, PRIVACY_DATA_MAP.md, DECISIONS, NEEDS_PETER, both feature maps and
  FEATURES-FOR-WRITERS.

## How to verify

- `cd app && flutter test test/feedback`. The key files:
  - `shake_to_feedback_test.dart` feeds accelerometer samples into the real shell.
  - `feedback_sheet_test.dart` covers the context values, the strings and the no-list-PII scan.
- `supabase test db` (`feedback.test.sql`), then `scripts/feedback-monday.sh`.
- Screenshots: `SCREENSHOT_DIR=/tmp/shots flutter test --update-goldens
  test/feedback/feedback_screenshots_test.dart`. Copies are in `docs/screenshots/138/`.
- e2e: `scripts/verify.sh --only e2e -- tests/feedback.spec.ts`. It checks the new columns on the
  stored row and that the web form has no teach line.

## Results

- Local gates: gitleaks, lint, flutter (1901 passed) and web-prod passed.
- pgTAP: 1966 tests passed.
- feedback-monday: PASS.
- The local db gate's suggest-latency bench missed by 1.7 ms (51.7 ms against a 50 ms limit) at
  load 29.9 on 12 cores. The code it times is untouched here.
- e2e ran in CI, not locally: job 126's 2-hour stress run held `/tmp/fg-e2e.lock` with 11
  waiters.

## Missing or blocked

- **Privacy policy.** It needs the new fields before the public release (Legal through the PM).
  Suggested wording is in NEEDS_PETER "Job 138".
- **Shake on a real phone.** It is not tried yet: this host has no phone or emulator (no KVM
  access). Widget tests prove the path. Peter's check is in NEEDS_PETER.

## Review 0 fixes (2026-11-06)

- **iOS purpose string.** `NSMotionUsageDescription` is now in `app/ios/Runner/Info.plist`,
  localized DE/EN in `InfoPlist.strings`. sensors_plus links CoreMotion, and its README requires
  the key. The accelerometer still shows no prompt. NEEDS_PETER 138.3 is corrected.
- **Merge gate.** #281 waits for the PM's privacy policy update, or for Peter to say that
  testers may get the build first. A merge auto-releases to TestFlight and Play internal. This
  is recorded in NEEDS_PETER 138.1, on BOARD and in the PR body.
- **Rebased onto main** after #278. DECISIONS and DONE_SUMMARY keep Job 135's section, then
  Job 138's.
- **One popup guard.** `FeedbackCubit.showing` is gone, and `Popups.openAbove` covers both the
  open feedback form and any other dialog. The new test "a shake under another dialog opens
  nothing" fails when the guard is removed, and so does "a shake while the form shows".
- **Results.** `flutter analyze` is clean, and `flutter test` passes 1907 on the rebased tree.
- **Not done.** The support pages (nice-to-have 3) stay as they are. They sit under
  `site/content/legal`, where `since:` is refused, so they would announce the shake on the live
  site before any store build has it. They go with the PM's privacy update, and NEEDS_PETER
  138.1 drafts the sentence.
