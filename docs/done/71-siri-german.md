# Job 71: German native Siri only opened the app

PR https://github.com/trost-systems/family-groceries/pull/194, branch `job/71-siri-german`,
merged 2026-11-02 (940a5ba3).

## What was broken

On Lea's iPhone (German system and Siri language, TestFlight build 1097), every German phrase from
the device test opened Hummlist. Nothing was added or read. The same build worked in English on
Peter's iPhone.

## Root cause

The phrase tables were fine. The app name was not.

- **The German phrases ship and are trained.** In the ios gate's build log on main (CI run
  41401075259, job 125132866442, Xcode 26.6), `appintentsnltrainingprocessor` trains every German
  phrase for `de`. One example is `Training 'Füge etwas zu ${+applicationName} hinzu|…' for de`.
  `de.lproj/AppShortcuts.strings` is copied into the app, and RunnerTests checks that its keys
  match the Swift phrases. So the build is not missing the German phrases.
- **The intents have no German-only code path.** `SiriCopy` falls back to the main bundle, and
  `VoiceLanguage.of` cannot crash. The read intent has no parameter and opened the app too.
- **The app-name slot only knew "Hummlist".** The same log trains
  `Application name 'Hummlist' for de` and nothing else. The ten German phrases share nothing but
  that slot, and all ten failed. Siri opened the app, so it recognized the app by name but matched
  no phrase. The likely cause is that German speech recognition writes "Hummlist" as a German word
  („Hummliste“, „Humm Liste“). App launch matches the name loosely, but an App Shortcut needs its
  app-name slot to match.

This is inferred, not observed: no iPhone reaches this runner. `docs/NEEDS_LEAD.md` "Job 71"
splits the remaining causes on a device. Type to Siri skips speech recognition, and Always Show
Speech shows the words Siri heard.

A second, smaller problem: „Füge etwas zu Hummlist hinzu“ has no article, which is not how German
speakers say it („zur Hummlist“). The app showed „Auf meine Hummlist“, which is not a sentence.

## Fix

- **Localized alternative app names (`INAlternativeAppNames`).** They are Info.plist variables
  filled from `app/ios/Runner/{de,en,Base}.lproj/InfoPlist.strings`. German: Hummliste, Humm
  Liste, Hummelliste. English and Base: Humm List, Hum List, Humlist. An Apple engineer confirms
  they apply to App Shortcuts (developer forums thread 832258). After the change, the ios run of
  PR #194 trains `Application name 'HummlistHummlisteHumm ListeHummelliste' for de`.
- **German phrases with articles.** `HummlistIntents.swift` and both `AppShortcuts.strings` tables
  went from 10 to 18 phrases. Examples: „Füge etwas zur Hummlist hinzu“, „Setz etwas auf meine
  Hummlist“, „Füge <Eintrag> zur Hummlist hinzu“, „Etwas zur Hummlist hinzufügen“, „Lies die
  Hummlist vor“, „Was steht auf der Hummlist“. The old phrases still work.
- **The app shows full sentences.** The Zugänge Siri card and the „Siri-Sätze“ dialog
  (`app/lib/siri/siri_phrases.dart`, `siriWorksWithoutSetup`) now show these sentences. The draft
  guide section (held, `since=1.0.0`) shows them too.
- **The voice parser drops the same spellings.** These are `parse.ts` (hummliste, hummelliste)
  and `parse_en.ts` (humm list, hum list, humlist). Before, „Füge Milch zur Hummliste hinzu“
  added an item named „Milch zur Hummliste“.

## Guards

- `scripts/siri-phrases.ts`, run by the lint gate on every PR on Linux, checks that:
  - every Swift phrase has an en and a de translation;
  - each translation keeps `${applicationName}` and the parameter;
  - no German value is left in English;
  - no two phrases say the same thing;
  - the alternative names resolve in en, de and Base, at most three;
  - every phrase the app shows is one Siri knows.

  Each of these mutations made it fail: a dropped app name, a missing translation, an English
  value, a shown phrase Siri lacks, main's Info.plist, and a missing Base file.
- **RunnerTests** `testEachLanguageNamesTheAppTheWaySiriWritesIt` (macOS, the ios gate) reads the
  built app's `INAlternativeAppNames` and `InfoPlist.strings` per language.
- **The ios gate** fails if the built `Metadata.appintents/root.ssu.yaml` lacks „Hummliste“ or
  trains an unresolved `HUMMLIST_NAME_*` variable. The first run showed the variables trained for
  `Base`. That is fixed with `Base.lproj/InfoPlist.strings`.
- **Parser tests.** `parse_test.ts` covers „Füge Milch zur Hummliste hinzu“, „…auf die
  Hummelliste“, „Karotten 2“ and „zwei Karotten“. `parse_en_test.ts` covers "Humm List", "hum
  list" and "Humlist". These tests were committed failing before the fix.
- **e2e.** `voice.spec.ts` "native Siri in German…" uses the Siri credential the app mints to
  send „Füge Milch zur Hummliste hinzu“ and „Karotten 2 und Brot auf die Hummelliste“. The list
  then shows Milch, 2× Karotten and Brot
  (`docs/screenshots/71/voice-05-native-siri-german.png`).

## How to verify

- `deno run --allow-read scripts/siri-phrases.ts`
- `cd supabase/functions && deno test --allow-read voice/`
- `scripts/verify.sh --only e2e -- tests/voice.spec.ts`
- The ios gate on CI (macOS) prints the SSU training. Look for
  `Application name '…Hummliste…' for de`.
- On a German iPhone: `docs/NEEDS_LEAD.md` "Job 71".

## Results

- Local on hz: lint gate passed. voice tests: 301 passed (7 German and 3 English cases new). e2e `voice.spec.ts`: 13 passed.
  `flutter analyze` and `test/settings/access_screen_test.dart` pass.
- CI on PR #194: the ios job passed with RunnerTests 24 passed, 0 failed, and the German names
  trained. The final head's run is linked in the PR.

## Open

- **Device test.** Only an iPhone with German Siri can confirm the fix (`docs/NEEDS_LEAD.md`
  "Job 71"). If the typed phrase works but the spoken one opens the app, add the word Siri showed
  as an alternative name. If the typed phrase also opens the app, do "Job 51" section 2 (the Siri
  capability on the App ID and the entitlement). That needs the Apple account and is not possible
  from this runner.
- **native-siri stays held.** Changelog `none`.
