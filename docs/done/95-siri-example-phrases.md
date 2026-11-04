# Job 95: SiriKit example phrases (ITMS-90626)

PR #229. Not merged, as the brief asks.

## What was built

- `app/ios/Runner/de.lproj/AppIntentVocabulary.plist` and `en.lproj/AppIntentVocabulary.plist`
  give two examples each for `INAddTasksIntent` and `INSearchForNotebookItemsIntent`. Every
  example names Hummlist. No retailer names. The files are a variant group in the Runner
  target's Copy Bundle Resources. The app handles the intents in-app (no Intents extension), so
  Apple reads the files from the app bundle.
- `scripts/siri-vocabulary.py` collects the intents that the app and extension `Info.plist`
  files declare (`INIntentsSupported`, `IntentsSupported`, `IN…Intent` in
  `NSUserActivityTypes`). For each intent and each language (de, en, every other non-Base
  `.lproj`), it requires an example that names the app. It reads a source tree, a `.app` or an
  `.ipa`. Built plists can be binary, and `plistlib` reads both formats.
- The lint gate (`scripts/lint.sh`) runs it on `app/ios` and runs
  `scripts/siri-vocabulary-test.py` (11 fixture tests). The ios gate runs it on the built
  simulator app. The Fastfile runs it on the signed IPA before an upload or a validation.
- German examples leave out „Einkaufsliste“, which the brief suggested. Job 92 found that German
  Siri gives the word to Reminders (`docs/DECISIONS.md`, Job 95).

## How to verify

- `scripts/siri-vocabulary.py app/ios` and `python3 scripts/siri-vocabulary-test.py`.
- CI run 41788559517, ios job: the check passes on the built `Runner.app`, and xcodebuild copies
  both plists into `Runner.app/{de,en}.lproj` (`docs/screenshots/95/ci-ios-evidence.txt`).

## Test results

- `scripts/verify.sh --only lint,fastlane,gitleaks` passes on hz. ci-ok is green on 651ef921.
- The fixture tests fail on each gap and pass on complete bundles. Two mutations of the check
  (no de/en requirement, no app-name rule) each turn one test red.

## Missing or blocked

- Proof that App Store Connect no longer sends ITMS-90626 needs the next TestFlight build after
  the merge. The release workflow builds it, and this job does not upload anything. The Fastfile
  check stops that build if the files are missing.
- No screenshots, because nothing in the UI changed. The CI evidence is in
  `docs/screenshots/95/ci-ios-evidence.txt`.
