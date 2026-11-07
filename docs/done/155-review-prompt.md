# Job 155: native store rating prompt (Peter Q96=R1)

PR: https://github.com/trost-systems/family-groceries/pull/298 (not merged, the Lead merges).

## What was built

- **Rating prompt.** `app/lib/review/`:
  - `review_counters.dart`: the device counters, one JSON value `review.state` in DeviceCache, counts and dates only.
  - `review_gates.dart`: the gate table.
  - `review_prompt.dart`: counts, gates, `isAvailable`, `requestReview`, and the `review_prompt_requested` event, sent only with consent.
  - `review_prompt_trigger.dart`: waits 3 s after a completed trip of 3 or more own ticks, then asks. A tap, a key press, the keyboard, a dialog or sheet, dictation, or the app going to the background holds it back.
  - `store_review.dart`: the only file that imports `in_app_review` (2.0.12).
- **ListCubit** reports `activity`: `OwnItemAdded` and `TripCompleted(ticked)`.
- **Gates.** All of these must hold:
  - a `STORE_RELEASE` build;
  - first start 7 or more days ago;
  - 3 or more active days;
  - 2 or more completed trips;
  - 25 or more items added;
  - no sync failure, going offline or uncaught error in this session, the last session or the last 24 h;
  - `isAvailable()`;
  - 120 or more days since the last request;
  - at most 2 requests per version and 3 per 365 days.
- **More row.** „Hummlist bewerten“ / "Rate Hummlist" opens the store listing (App Store id 6826922741). It shows on iOS and Android only.
- **Defines.**
  - `STORE_RELEASE`: only the future public release build passes it (docs/RELEASE.md).
  - `REVIEW_PROMPT_FORCE`: the QA override. A store build ignores it.
- **Lints.**
  - `in-app-review-only-in-store-review`
  - `request-review-only-in-review-prompt`
- **Docs.**
  - docs/DECISIONS.md "Job 155"
  - docs/ANALYTICS.md row
  - verify-hummlist `features/rate-hummlist.md`, its journey, more-help.md and FEATURES-FOR-WRITERS.md

## How to verify

- `cd app && flutter test test/review test/more test/list/list_cubit_test.dart`
- `.cursor/skills/verify-hummlist/helpers/launch.sh --fresh && helpers/drive.sh rate-hummlist`
- On a device: `flutter run --dart-define=REVIEW_PROMPT_FORCE=true`, tick off a whole list, then wait 3 s.

## Results

- `scripts/verify.sh --only gitleaks,lint,changelog,site,fg-cli,flutter` passed.
- Flutter: 2080 passed, 90 skipped. Widgetbook: 334 passed.
- The web journey passed. 15 ticks counted one trip, nothing was requested, and More shows no rate row.
- e2e runs in CI on the PR.
- Screenshots: `docs/screenshots/155/`.

## Missing or blocked

- **No device proof.** The runner has no iPhone and no Android emulator (no KVM access), so the native dialog and the store listing opening are unverified on a device.
- **No research note.** `~/groceries-ops/reading/review-prompt-timing.md` is not on this runner. The work follows the brief, and a threshold change is one constant.
- **No public release path yet.** Nobody is asked until a public release build passes `STORE_RELEASE=true`.

## Review 0 fixes (2026-11-06)

1. **Offline blips no longer block the prompt.** The trigger counts the list as a sync failure only
   when it stays offline for 60 s (`ReviewPromptTrigger.offlineGrace`); a tick in a dead spot that
   goes out a moment later does not count. Sessions are now foreground sessions (start or resume),
   so an error weeks ago on an iPhone that never cold-starts no longer counts as "the last session".
   Tests: an add sent after 5 s offline still asks, 60 s offline holds it back, two resumes put an
   old error out of reach; the first fails with a zero grace (mutation checked). Web build: a tick
   10 s offline (indicator shown) leaves no `last_error_at`; an add 70 s offline sets it about 60 s
   after the list went offline (`drive.sh rate-hummlist`).
2. **An undo no longer counts a second trip.** A tick that empties the list again within
   `ListCubit.undoWindow` (10 min) of this device's last completed trip is the same trip. Tests:
   tick 3, put back and re-tick twice gives one trip `[3]` (fails without the rule); a new trip
   after the window counts. Web build: `completed_trips` stays 1 after a put-back and re-tick (the
   reviewer saw 1 → 2 on the old head).
3. Nice to have, done: the prompt's chain cannot fail any more (a failing version read loses that
   ask, not later counts; tested), the App Store id points at `scripts/iap/apple_product.ts`, and
   the `STORE_RELEASE` step plus the device check are in docs/NEEDS_PETER.md. Not changed: the
   `STORE_RELEASE` design itself (a lead/Peter call, see NEEDS_PETER) and the per-version cap
   counting only the last 365 days (harmless with the 120-day cooldown).

Results: `scripts/verify.sh --only gitleaks,lint,changelog,fg-cli,flutter` passed; review, cubit
and More tests green.

## Review 1 fixes (2026-11-06)

1. **An inactive bounce no longer starts a session.** Sessions start at launch and on
   `AppLifecycleListener.onShow` (back from hidden), through `ReviewPrompt.followLifecycle()`, not
   on every `onResume`; Control Center, Face ID or a permission prompt keep "the last session".
   Test: an error 3 days back in the last session still blocks after inactive→resumed and stops
   blocking after a real background round trip; it fails with `onResume` (mutation checked).
2. **The offline grace counts only in the foreground with changes waiting.** Leaving the
   foreground stops it, nothing queued never starts it. Tests: 61 s offline in the background
   with an add queued, and 60 s offline in the foreground with nothing to send, both still ask;
   each fails with its condition taken out. The web journey still records an add left 70 s
   offline in the foreground.
3. **iOS no longer needs `STORE_RELEASE`.** `BuildChannel.of`: an iPhone release build is a
   store build (StoreKit never shows the prompt in TestFlight, and the build the testers had is
   the one App Store review gets); Android and others still need the define, which only the
   future Play production rebuild of the tested commit gets. docs/RELEASE.md, NEEDS_PETER and
   DECISIONS (Job 155, item 2) no longer contradict "a build that the internal testers have had".
   Test: the channel table; it fails with the iOS rule removed.
4. Nice to have, done: a trip counts distinct items (an untick and re-tick counts once), and a
   note in `review_gates.dart` on the per-version cap's 365-day window. Not done: the snackbar
   point (a tick has no undo snackbar since job 29b, so nothing to wait for), a native-crash
   "running" flag (documented in DECISIONS), the research-note diff (the note is box-only).

Results: `scripts/verify.sh --only gitleaks,lint,changelog,fg-cli,flutter` passed (fresh
test_cache); `drive.sh rate-hummlist` PASS on a fresh web build.

## Review 2 fixes (2026-11-07)

1. **A tap anywhere cancels the 3 s wait, and a hidden List tab never asks.** The trigger hears
   every pointer down through a global pointer route (the tab bar and the rail included), and
   when it fires it stays quiet while the List branch is offstage (`TickerMode` off) or a page
   is pushed over the list. Tests in `app/test/app/shell_tabs_test.dart` pump the real shell
   with the real list screen and a due store-build install: left alone it asks once; a tap on
   „Mehr“ within the 3 s asks nothing; with the List tab hidden it asks nothing. The second
   fails without the global route, the third without the visibility check (mutation checked).
2. Nice to have, done: only a queued write the server refused counts as an error (a taken
   name or an order change refused offline up front does not; tested both ways, mutation
   checked); a launch into the background no longer starts a second session on its first
   showing (tested, mutation checked); TestFlight's phantom requests are documented in
   docs/ANALYTICS.md and DECISIONS (Job 155, item 10). Not done: a native-crash flag
   (documented), the research-note diff (box-only, for the lead), device proof (NEEDS_PETER).

Results: `scripts/verify.sh --only gitleaks,lint,changelog,fg-cli,flutter` passed (fresh
test_cache); `drive.sh rate-hummlist` PASS on a fresh web build.

## Review 4 fixes (2026-11-07)

0. Rebased onto main after #296 (dialog spacing); DECISIONS conflict was two appended sections,
   both kept.
1. **The first return from the background after a launch in the foreground starts a session.**
   `followLifecycle()` now starts as shown when the app is already resumed (the listener does
   not replay the current state), so that return counts an active day and makes the launch
   session the previous one. A launch into the background keeps review 2's behaviour. Test: one
   round trip on a new day gives +1 active day and a new `session_start`; it failed on the old
   head (1 vs 2 active days). Web build: `drive.sh rate-hummlist` now also hides and shows the
   page once after sign-in and sees `session_start` move with the launch's as
   `previous_session_start`.
   Nice to have, not done: a sandbox-receipt check for TestFlight (needs native code; the cost
   is two testers' cooldown, DECISIONS item 10), a native-crash flag (documented), device proof
   (NEEDS_PETER). Android stays off until the Play production build passes `STORE_RELEASE`
   (NEEDS_PETER).

Results: `scripts/verify.sh --only gitleaks,lint,changelog,fg-cli,flutter` passed (fresh
test_cache); `drive.sh rate-hummlist` PASS on a fresh web build.

## Review 7 fixes (2026-11-07)

1. Rebased onto main after #309, #295 and #310: DECISIONS and DONE_SUMMARY conflicts were
   appended sections, both kept.
2. **A root-navigator dialog holds the prompt back, proven in the real shell.** `pumpShell` now
   wires `Popups` and `NoticesHost` as `App` does; a test opens a dialog over the list after a due
   trip and sees no request. It fails when `(_popups?.open ?? false)` is replaced with `false`.
3. **„Hummlist bewerten“ survives a listing that does not open.** The failure is caught and told
   with the existing `lifetimeStoreOffline` string („Der Store ist gerade nicht erreichbar. Prüfe
   die Verbindung.“), no new copy; it never reaches the zone handler, so it does not hold the
   prompt back. Test: a throwing listing shows the snackbar and no exception; it fails without the
   catch.
4. **The App Store id matches `scripts/iap/apple_product.ts`** (`appAppleId`), checked by a test.
5. **Rebased again onto #311 (sync indicator), which needed a behaviour fix.** #311 added a
   "sync failing" state: a 5xx write now stays queued and retries instead of being refused, so a
   server that kept failing would no longer have counted as a sync failure. The 60 s grace now
   runs while the list is offline or failing (`ListState.trouble`) with changes waiting, in the
   foreground. Tests: a server in trouble past the grace holds the prompt back (fails with the old
   offline-only rule); a 503 the next retry gets past still asks. Two older tests passed for the
   wrong reason (a lone first tick completed a trip, so the same-trip rule suppressed the ask);
   both now tick that item last and fail without their fix. The web journey uses #311's
   „Offline: …“ indicator button and passes.
Nice-to-haves 1 and 5 stay as documented decisions.

Results: `scripts/verify.sh --only gitleaks,lint,changelog,fg-cli,flutter` passed (fresh
test_cache).
