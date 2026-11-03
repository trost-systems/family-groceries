# Job 92: German Siri routing (PRs #221, #222)

Peter's device test on build 1119 (2026-11-03): German Siri put „Füge … zur Hummliste hinzu“ on a
Reminders list, or answered „Hummlist unterstützt das nicht“. The `native-siri` hold stays on until
a German device retest passes.

## Root cause

1. **Name not recognised, Reminders wins.** Siri writes the spoken name as common words. „Füge X
   zur <…>liste hinzu“, „Einkaufsliste“ and the fragment „Auf meine Hummlist“ are Reminders'
   grammar. The alternative names had no pronunciation hints, and the app had no spoken name.
2. **Name recognised, „unterstützt das nicht“.** An `${item}` phrase matches only the item names
   the app registered, and only after a list loaded. Any other item fell through to SiriKit's Lists
   domain, which the app did not handle (no entitlement, no `INIntentsSupported`).

## What was built

- **#221 (addendum 1, landed first).**
  - `certificates.yml` gets a `lane` input: `certificates`, `renew_profile` (confirm `renew`) and
    read-only `profiles`.
  - `fastlane ios renew_profile` takes `MATCH_TYPES` (`appstore`, or `appstore,adhoc`). It
    refuses `development`, because the match repo has no development certificate. It stops when
    certificate `GN85KDC962` is missing or expired. It lists both App IDs' profiles before and
    after.
  - `Runner.entitlements` gets `com.apple.developer.siri`.
- **#222.**
  - German phrases name the app first or as the object: „Hummlist, füge etwas hinzu“, „Etwas auf
    Hummlist setzen“, „Mit Hummlist einkaufen“, „Hummlist, was steht drauf“. „Hummlist
    Einkaufsliste“ and „Auf meine Hummlist“ are gone. The parameterless add phrases come first.
  - German spoken names are „Humm Liste“, „Hummliste“ and „Ham Liste“. English: Humm List, Hum
    List, Humlist. Each has a pronunciation hint, and `CFBundleSpokenName` is „Humm List“.
  - `updateAppShortcutParameters()` now runs at launch.
  - SiriKit Lists runs in-app (`AppIntents/SiriKitLists.swift`, `AppDelegate`
    `application(_:handlerFor:)`). Add (`INAddTasksIntent`) sends the titles to `voice`. Read
    (`INSearchForNotebookItemsIntent`) returns the open items as tasks.
  - `INIntentsSupported` and `NSSiriUsageDescription` (DE/EN) are added. The app asks once for
    Siri permission after sign-in.
  - Zugänge and the site guide show the app-first German phrases.

## How to verify

- `deno run --allow-read scripts/siri-phrases.ts` (in `scripts/lint.sh`).
  - Against main's `app/ios` before #222 it reports 12 problems. Among them are „Hummlist
    Einkaufsliste“, „Auf meine Hummlist“, the item-first order, missing hints, and missing
    `INIntentsSupported`, `CFBundleSpokenName` and `NSSiriUsageDescription`.
  - On #222 it reports `20 phrases in en and de, 3 spoken app names per language`.
- CI `ios` on #222 (run 41724467373):
  - RunnerTests: 34 passed, 0 failed. This covers `AppShortcutPhraseTests` (Reminders grammar,
    parameterless first, hints) and `SiriKitListsTests` (titles to the voice request, response
    codes, read items, and the app delegate handing out the handlers).
  - Training log: `Application name 'HummlistHumm ListeHummlisteHam Liste' for de`, and `Training
    'Füge etwas zu ${+applicationName} hinzu|${+applicationName}, füge etwas hinzu|Etwas auf
    ${+applicationName} setzen|Mit ${+applicationName} einkaufen|…'`.
- `flutter test test/settings/access_screen_test.dart`: 26 passed. `scripts/gates/flutter.sh`:
  green.
- A German device test is still needed: docs/SIRI_SHORTCUT.md „Gerätetest Deutsch“, and
  docs/NEEDS_PETER.md „Job 92“.

## Signing (addendum 1)

- Certificates run 41733105879 (`profiles`): `match AppStore com.hummlist.app` was INVALID and
  the widget's profile was ACTIVE. Neither App ID has a development or ad hoc profile on the
  portal.
- Certificates run 41733197123 (`renew_profile`, appstore) recreated both profiles with
  `GN85KDC962`. Both were ACTIVE afterwards. match pushed only the two profiles, and the
  certificates repo still holds one certificate.
- Release run 41733364290 (iOS, upload off): preflight passed with the new profiles. It shipped
  nothing because main's CI on 151134d had not finished yet. The signed build of main with the
  Siri entitlement is the first Release run after that CI (see PR #221).

## Missing or blocked

- Real German Siri on a device (Peter, NEEDS_PETER „Job 92“ 1, 2, 3 and 5). The three German
  names should be revisited once his transcripts are in.
- #222 merges on lead review (NEEDS_LEAD „Job 92“).
- No screenshots. The only visible change is the iOS-only Zugänge phrase text, covered by the
  widget tests. Siri itself cannot be filmed from this box.
