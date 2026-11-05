# Job 97: Siri fix-now, iOS 17 minimum, App Shortcuts catalog

PR #232, merged 2026-11-05 (6cbef21a). Peter approved the work as Q66 = VF1. The
reasons are in `docs/DECISIONS.md`, "Job 97".

## What was built (one commit per item)

1. **iOS 17.0 minimum.** Runner, RunnerTests and the project-level setting move from 15.0 to
   17.0. HomeWidget was already on 17.0. The six now-dead `@available`/`#available` checks are
   gone. `scripts/ios-deployment-target.py` runs in the lint gate with 8 fixture tests. It fails
   when a target, the widget generator, a Podfile or AppFrameworkInfo disagree with 17.0, or when
   Swift asks for an iOS version the minimum already guarantees. The app has no Podfile (Flutter
   SwiftPM), and CI uses the newest simulator, so nothing else needed pinning.
2. **SiriKit Lists failures stay in Siri.** Signed out, no household and the integration lock
   answered `failureRequiringAppLaunch`, which opened the app. Every failure now answers
   `failure`. A Lists response carries only a code (Apple's docs), so Siri speaks its own
   localized sentence. The app's own reason is spoken on the App Shortcuts path.
3. **German spoken name „Hummlist“.** `CFBundleSpokenName` is „Hummlist“ in every language.
   German drops Hummliste, Humm Liste and Ham Liste and now uses Humlist, Hamlist and Homlist.
   English keeps its names. The lint gate, RunnerTests and the ios gate reject a German name
   ending in „Liste“, a bare „Humm“, and any other spoken name.
4. **App Shortcuts.** `AppShortcuts.xcstrings` replaces the `.strings` tables, with a phrase set
   per language: 30 German and 24 English phrases for four Swift phrases. Other changes:
   - New `OpenListIntent` („Zeig meine Hummlist“ / "Show my Hummlist") opens the app on the list.
   - Negative phrases send the system shopping-list and reminders requests elsewhere.
   - The item entity has synonyms: the household's other names with the same `canonical_key`,
     at most two per item and 100 spoken values in all.
   - `updateAppShortcutParameters()` runs at launch and on every change.
5. **The built app is checked.** `scripts/app-shortcuts-bundle.py` checks the following in the
   ios gate (simulator build) and in the Fastfile (signed IPA, next to `siri-vocabulary.py`):
   `Metadata.appintents`, the three App Shortcuts, phrase templates that name the app, the
   negative phrases, the item entity, and the compiled de/en phrase sets. It also checks the
   spoken name „Hummlist“, that no German alternative name ends in „Liste“, and that the
   negative phrases are localized and never name the app. It has 16 fixture tests in the lint
   gate.
6. **Docs.** DECISIONS, SIRI_SHORTCUT.md (engineering notes and the job 97 device test), the
   verify-hummlist Siri feature file and its writers' section, and NEEDS_PETER "Job 97".

Unchanged: the SiriKit Lists handlers (iOS 17 to 26), job 95's IntentExamples and their check,
the `native-siri` hold, `NATIVE_SIRI_LIVE` (default off), and the website.

## How to verify

- `scripts/lint.sh` runs four checks:
  - `scripts/ios-deployment-target.py` and its tests.
  - `deno run --allow-read scripts/siri-phrases.ts` (catalog against Swift, both languages, the
    Reminders grammar, negative phrases, spoken names).
  - `scripts/siri-vocabulary.py`.
  - `scripts/app-shortcuts-bundle-test.py`.
- CI's ios gate builds the app, runs the bundle checks, and runs RunnerTests on the simulator.
- `cd app && flutter test test/siri` covers the suggestions with synonyms and the channel payload.
- Evidence from the built app: `docs/screenshots/97/ci-ios-bundle.txt`. It holds the compiled
  `#!SET#!_…` phrase tables, `extract.actionsdata`, and the trained app names (de
  „HummlistHumlistHamlistHomlist“).

## Test results

- CI run 41908061886 (commit 4 head), ios job: build OK, and RunnerTests "passed 42, failed 0".
  The run includes the new SiriKit failure tests, the catalog tests, the synonym store tests and
  the Open intent tests.
- Local runs on the box:
  - `flutter analyze`: no issues.
  - `flutter test test/siri`: 25 passed.
  - `siri-phrases.ts`: passes, and fails on 8 mutations: a phrase without the app name, „Liste“
    in German, a missing German set, a negative phrase naming the app, a leftover `.strings`
    table, a Swift phrase without the app name, a lost `${item}`, and „Hummliste“ as a name.
  - `ios-deployment-target-test.py`: 8 OK.
  - `app-shortcuts-bundle-test.py`: 16 OK.
- The final head's ci-ok run is linked in the PR body.

## Screenshots

Nothing visual changed. The Zugänge Siri card and its phrases are as before. The evidence is the
text dump of the built bundle in `docs/screenshots/97/`.

## Missing or blocked

- **What Siri hears is only provable on an iPhone.** Peter's device test (German and English
  table in docs/SIRI_SHORTCUT.md „Gerätetest (job 97)“) runs on the first TestFlight build with
  this PR, through the normal release pipeline after merge. The German alternative names are
  informed guesses until then. NEEDS_PETER "Job 97" has the steps.
- **Siri can't speak the app's own failure sentence on the SiriKit Lists path.** Apple's API has
  no field for it. Siri says its own localized failure instead and no longer opens the app.
- **Phrase budget, unconfirmed.** The lint counts 6 German item phrases × 100 values against
  Apple's 1,000. If Apple also multiplies by the three alternative app names, Siri could drop
  phrases. The CI trainer reported no error, and Apple's docs don't say. Lowering
  `ItemSuggestionStore.spokenLimit` is the lever if the device test shows missing item phrases.
- SiriKit Lists are deprecated in iOS 27 ("adopt the Notes or Reminders AppSchema domain").
  Migrating is a later job.

## Review 0 fixes (2026-11-05)

- Must fix: `docs/NEEDS_LEAD.md` "Job 51" known gaps no longer says iOS 15 and 16 get the
  Shortcut recipe as supported users; since job 97 they stay on their last build. Swept docs/,
  README and `.cursor/skills` for "iOS 15", "iOS 16" and "older iPhones": the rest are SDK facts
  (StoreKit 1 on iOS 15 in PURCHASES, NEEDS_LEAD H-68 and PRIVACY_DATA_MAP, already marked as
  unused in PURCHASES) or correct (NEEDS_PETER "Job 97").
- `scripts/app-shortcuts-bundle.py` now gives the signed IPA the checks only the ios gate had:
  localized negative phrases that never name the app, `CFBundleSpokenName` „Hummlist“, and no
  German alternative name ending in „Liste“ (16 fixture tests).
- `scripts/ios-deployment-target.py` says in its header what it skips (untracked plugin Swift,
  xcconfig files).
- The SiriKit Lists path still can't speak the app's own sentence (Apple's response has only a
  code); the brief's spoken-message item is fully met on the App Shortcuts path only. The device
  test checks that Siri's generic sentence is acceptable.
