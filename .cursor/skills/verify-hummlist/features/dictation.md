# Dictation

In the iOS and Android apps a microphone button sits at the right end of the add bar. Tapping it starts listening, in German, on the device only (the audio never leaves the phone). The words appear in the field while the user speaks. When the speaker pauses, Hummlist sends the text to its sentence splitter, which turns "Milch, zwei Gurken und Klopapier" into separate items, adds them, and shows a short message at the bottom. On the web and on desktop there is no microphone button.

## Sub-features

- `di-button` the microphone (icon button, tooltip „Diktieren“ / "Dictate") appears only on iOS and Android builds, never on web or desktop. While listening it turns into a red stop button with the tooltip „Diktat beenden“ / "Stop dictation".
- `di-listening` while listening the field's hint reads „Ich höre zu …“ / "Listening …" and the recognised words fill the field live.
- `di-language` always German (de_DE), on the device only, whatever language the app is set to; listening stops after a 3 s pause or 30 s.
- `di-split` after the sentence the server splits it into items (the same splitter Siri uses; commas, "und", number words, units) and the app adds them. The field empties on success.
- `di-summary` a snackbar says „Hinzugefügt: <items>.“ / "Added: <items>." and, for items already open, „Schon auf der Liste: <items>.“ / "Already on the list: <items>." (both, joined by a space, when both apply). Items are named with their quantity, for example „Hinzugefügt: Milch, 2 Gurken, Klopapier.“
- `di-errors` snackbar messages: „Ich habe nichts gehört.“ / "I didn't hear anything."; „Ich habe nichts verstanden, was auf die Liste soll.“ / "I didn't catch anything for the list."; „Keine Verbindung. Der Text steht im Feld; prüfe ihn und tippe auf Hinzufügen.“ / "No connection. The text is in the field; check it and tap Add."; „Spracheingabe ist nicht verfügbar. Erlaube Mikrofon und Spracherkennung in den Einstellungen.“ / "Voice input isn't available. Allow microphone and speech recognition in Settings."; „Diktieren geht nur offline, damit deine Stimme auf dem Gerät bleibt. Dafür fehlt hier die deutsche Offline-Spracherkennung. Lade sie in den Systemeinstellungen herunter oder tippe den Eintrag ein.“ / "Dictation only works offline, so your voice stays on the device. This device is missing German offline speech recognition. Download it in the system settings or type the item instead."
- `di-permissions` the first use makes the phone ask for the microphone and for speech recognition. iOS texts (German): „Hummlist braucht das Mikrofon, damit du Einträge diktieren kannst.“ and „Hummlist wandelt deine Sprache in Text um, damit du Einträge diktieren kannst.“ Android asks for the microphone permission.

## How to get to it (user POV)

- On a phone app, open the „Liste“ / "List" tab and tap the microphone at the right end of the bar „Was brauchst du?“ / "What do you need?" („Diktieren“ / "Dictate"), then speak.
- Tap the red stop button („Diktat beenden“ / "Stop dictation") to end early.

## Driving it with Playwright

Preconditions:

- The Flutter web build has no dictation: the button is never built there, by design, because the browser's speech API sends audio to a cloud service. A Playwright run can therefore only prove its absence and the typed path that dictation feeds.

- **The button is absent on web.** On the list tab: `await expect(page.getByRole('button', { name: 'Diktieren' })).toHaveCount(0)` and `getByRole('button', { name: 'Diktat beenden' })` count 0. Observable result: no microphone next to `addField(page)` (`getByRole('textbox', { name: 'Was brauchst du?' })`).
- **The splitter it feeds.** The same server sentence splitter is reachable over HTTP: the voice endpoint with `{ text, mode: 'parse' }` returns the items without adding them; without `mode` it adds them and answers with `speech`. `e2e/tests/item-details.spec.ts` (test "voice: …") posts "Windeln Pampers Größe 3 und zwei Liter Milch" with a signed-in user's bearer token and expects the speech „Hinzugefügt: Windeln Pampers Größe 3, 2 l Milch.“, then checks the rows `itemRow(page, 'Windeln')` named `Windeln Pampers · Größe 3` and `itemRow(page, 'Milch')` named `Milch 2 l`. That proves the splitting, not the microphone.
- **Not drivable.** Microphone permission prompts, the on-device recognizer, the listening hint, the stop button and the snackbar messages above need a real iPhone or an Android device with German offline speech data. Report them as skipped, never as passed.

## Gotchas

- Do not look for the microphone in a browser, not even a mobile browser or iPhone emulation: the choice is by platform (iOS or Android app only, `kIsWeb` false), so Chromium and WebKit never show it. Unverified: a native Android or iOS run (no such surface is part of this map's harness).
- Dictated text is always split by the German splitter even when the app language is English (the app sends no language to the splitter for dictation). Unverified on a device.
- A split failure (offline) leaves the recognised text in the field so the user can add it with Enter or a tap.
- No flag or Premium gate: the integration lock is off and dictation is not part of it.
