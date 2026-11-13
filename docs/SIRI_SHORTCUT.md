# Siri: „Hey Siri, Einkaufsliste“

> **Seit Job 51 gibt es natives Siri ohne Einrichtung** (iOS 17 und neuer,
> Englisch und Deutsch): „Füge etwas zu Snacklist hinzu“. Wie das gebaut
> ist, steht unten unter [Natives Siri](#natives-siri-job-51). Der
> Kurzbefehl hier funktioniert weiter, für eigene Sätze und für iPhones ohne
> die App (die App selbst braucht seit Job 97 iOS 17).

Mit diesem Kurzbefehl diktierst du Einträge per Siri auf dem iPhone.
Auf der Apple Watch, mit AirPods und in CarPlay kann es über Siri
ebenfalls klappen, das haben wir aber noch nicht getestet.

> **Du:** Hey Siri, Einkaufsliste.
> **Siri:** Was soll auf die Liste?
> **Du:** Milch, zwei Gurken und Klopapier.
> **Siri:** Hinzugefügt: Milch, 2 Gurken, Klopapier.

Siri schickt den Satz an die Snacklist-App. Der Server teilt ihn in
Einträge auf, sortiert jeden Eintrag in seine Kategorie ein und antwortet
mit dem Satz, den Siri vorliest. Die Einträge erscheinen sofort auf allen
Geräten im Haushalt.

> **Voraussetzung:** Die Server-Funktion `voice` muss auf dem
> Supabase-Projekt laufen. Solange sie dort noch nicht eingerichtet ist
> (`docs/NEEDS_PETER.md`, Abschnitt 1), antwortet die Adresse unten mit
> einem Fehler.

Die Einrichtung dauert etwa fünf Minuten. Du brauchst die Snacklist-App
(angemeldet, in deinem Haushalt) und die App **Kurzbefehle** auf dem
iPhone.

## 1. Zugriffstoken in der App erstellen

Der Kurzbefehl meldet sich mit einem persönlichen Zugriffstoken an, nicht
mit deinem Passwort.

1. Öffne die Snacklist-App.
2. Tippe auf **Mehr** und dann auf **Zugänge**.
3. Tippe unter **Zugriffstoken** auf **Token erstellen**.
4. Gib als Name `Siri` ein und tippe auf **Erstellen**.
5. Kopiere den Token. Er beginnt mit `fgp_`.

   Die App zeigt den Token nur dieses eine Mal an. Füge ihn direkt im
   nächsten Schritt in den Kurzbefehl ein, oder lege ihn kurz in einer
   Notiz ab und lösche die Notiz danach.

Wenn das iPhone verloren geht, widerrufe den Token in der App unter
**Mehr** → **Zugänge**: Tippe neben dem Token auf den Papierkorb
(**Siri widerrufen**) und bestätige mit **Widerrufen**. Der Kurzbefehl
bekommt danach keinen Zugriff mehr.

> **Achtung:** Teile den fertigen Kurzbefehl nicht mit anderen. Er
> enthält deinen persönlichen Token. Wenn er doch in fremde Hände gerät,
> widerrufe den Token in der App unter **Mehr** → **Zugänge** (der
> Papierkorb neben dem Token, **<Tokenname> widerrufen**, zum Beispiel
> **Siri widerrufen**).

## 2. Kurzbefehl anlegen

1. Öffne die App **Kurzbefehle** und tippe oben rechts auf **+**.
2. Tippe oben auf den Namen und nenne den Kurzbefehl **Einkaufsliste**.
   Dieser Name ist der Satz, auf den Siri hört.

Füge dann die drei Aktionen in dieser Reihenfolge hinzu. Suche jede über
**Aktion hinzufügen** bzw. das Suchfeld unten.

### Aktion 1: Text diktieren

1. Füge **Text diktieren** hinzu.
2. Tippe in der Aktion auf den Pfeil (**>**) und stelle ein:
   - **Sprache:** Deutsch (Deutschland)
   - **Aufnahme beenden:** Nach Pause
   - **Eingabeaufforderung:** `Was soll auf die Liste?`

### Aktion 2: Inhalte von URL abrufen

1. Füge **Inhalte von URL abrufen** hinzu.
2. Tippe auf **URL** und gib genau diese Adresse ein:

   ```text
   https://jdwqrallbpdbshrdhenk.supabase.co/functions/v1/voice?format=text
   ```

3. Tippe auf den Pfeil (**>**) und stelle ein:
   - **Methode:** POST
   - **Header:** Tippe auf **Neuen Header hinzufügen**.
     - Schlüssel: `Authorization`
     - Text: `Bearer ` (mit Leerzeichen) und danach dein Token, also
       zum Beispiel `Bearer fgp_…`

       > **Achtung:** Teile den fertigen Kurzbefehl nicht mit anderen. Er
       > enthält deinen persönlichen Token. Wenn er doch in fremde Hände gerät,
       > widerrufe den Token in der App unter **Mehr** → **Zugänge** (der Knopf
       > heißt **<Tokenname> widerrufen**, zum Beispiel **Siri widerrufen**).
   - **Hauptteil der Anfrage:** JSON
     - Tippe auf **Neues Feld hinzufügen** und wähle **Text**.
     - Schlüssel: `text`
     - Wert: Tippe in das Feld und wähle über der Tastatur die Variable
       **Diktierter Text** aus.

### Aktion 3: Ergebnis sprechen

1. Füge **Text sprechen** hinzu.
2. Als Text muss die Variable **Inhalte der URL** dastehen. Kurzbefehle
   setzt sie meist von selbst ein; sonst tippe auf das Feld und wähle sie
   aus.
3. Optional: Tippe auf den Pfeil (**>**) und wähle als **Sprache**
   Deutsch (Deutschland).

Tippe oben rechts auf **Fertig**.

Der fertige Kurzbefehl sieht so aus:

```text
Text diktieren          (Deutsch, nach Pause, „Was soll auf die Liste?“)
↓ Diktierter Text
Inhalte von URL abrufen (POST …/functions/v1/voice?format=text,
                         Authorization: Bearer fgp_…,
                         JSON { text: Diktierter Text })
↓ Inhalte der URL
Text sprechen           (Inhalte der URL)
```

## 3. Ausprobieren

1. Tippe in der Kurzbefehle-App auf den Kurzbefehl **Einkaufsliste**.
   Beim ersten Mal fragt iOS, ob der Kurzbefehl Daten an
   `jdwqrallbpdbshrdhenk.supabase.co` senden darf. Tippe auf
   **Immer erlauben**.
2. Sag „Milch, zwei Gurken und Klopapier“.
3. Siri antwortet „Hinzugefügt: Milch, 2 Gurken, Klopapier.“, und die
   Einträge stehen in der App.

Danach geht es ohne Hände: „Hey Siri, Einkaufsliste“.

## So kannst du sprechen

Sag mehrere Dinge in einem Satz. Trenne sie mit einer Pause (Komma),
„und“, „sowie“, „noch“ oder „auch“.

| Du sagst | Auf der Liste |
| --- | --- |
| Milch, zwei Gurken und Klopapier | Milch · Gurken (2) · Klopapier |
| Wir brauchen noch Butter und Eier | Butter · Eier |
| Schreib bitte Windeln auf die Liste | Windeln |
| Ein Kilo Äpfel und 500 Gramm Hackfleisch | Äpfel (1 kg) · Hackfleisch (500 g) |
| Eine Packung Eier sowie zwei Flaschen Wein | Eier (1 Packung) · Wein (2 Flaschen) |
| Einen Kasten Wasser, auch Kaffee | Wasser (1 Kasten) · Kaffee |

Füllwörter wie „bitte“, „wir brauchen“, „schreib auf“, „noch“, „auf die
Liste“ und Artikel lässt der Server weg. Zahlwörter werden zu Ziffern
(„zwei“ → 2). Mengen mit Einheit bleiben als Menge am Eintrag
(„1 kg“, „2 Flaschen“). Was schon auf der Liste steht, kommt nicht doppelt
dazu; Siri sagt dann „Schon auf der Liste: Milch.“
Steht eine andere Schreibweise oder ein Synonym schon auf der Liste
(„Karotten“, während „Möhren“ offen ist), kommt der Eintrag trotzdem dazu,
und Siri nennt ihn bei dem, was schon da ist: „Hinzugefügt: Karotten. Schon
auf der Liste: Möhren.“ Zusammenführen geht in der App.

## Was Siri bei Problemen sagt

| Siri sagt | Ursache | Lösung |
| --- | --- | --- |
| „Der Zugriffstoken fehlt oder ist ungültig …“ | Token fehlt, ist falsch kopiert oder widerrufen | Header prüfen: `Bearer `, Leerzeichen, dann der ganze Token. Sonst neuen Token erstellen (Schritt 1). |
| „Du bist noch in keinem Haushalt …“ | Das Konto, zu dem der Token gehört, ist in keinem Haushalt | In der App einen Haushalt anlegen oder beitreten. |
| „Ich habe nichts verstanden, was auf die Liste soll …“ | Das Diktat war leer oder bestand nur aus Füllwörtern | Noch einmal versuchen, zum Beispiel „Milch und Brot“. |
| „Das war zu lang …“ | Mehr als 1000 Zeichen | Weniger auf einmal sagen (höchstens 30 Dinge). |
| „Das hat leider nicht geklappt …“ | Server nicht erreichbar | Später noch einmal versuchen. |

Hört Siri auf „Einkaufsliste“ nicht auf den Kurzbefehl, sondern öffnet
die Erinnerungen-App, gib dem Kurzbefehl einen eindeutigeren Namen, etwa
**Einkauf notieren**, und sag „Hey Siri, Einkauf notieren“.

## Für Technikinteressierte

- Endpunkt: `POST https://jdwqrallbpdbshrdhenk.supabase.co/functions/v1/voice`
- Anmeldung: `Authorization: Bearer <Zugriffstoken>` (oder ein Sitzungstoken
  der App).
- Anfrage: JSON `{"text": "Milch, zwei Gurken und Klopapier"}`; ein
  reiner Text-Hauptteil geht auch.
- Antwort ohne `?format=text`: JSON mit `speech` (der Satz für Siri) und
  `items` (Name, Marke, Eigenschaften, Menge, Kategorie, `alreadyOnList`, `similarOnList`). Mit `?format=text`
  nur der Satz als `text/plain`. Fehler haben einen HTTP-Status
  (400, 401, 403, 405, 413, 422, 500) und ebenfalls einen deutschen Satz.
- Test von der Kommandozeile:

  ```bash
  curl -X POST 'https://jdwqrallbpdbshrdhenk.supabase.co/functions/v1/voice?format=text' \
    -H 'Authorization: Bearer fgp_…' \
    -H 'Content-Type: application/json' \
    -d '{"text": "Milch, zwei Gurken und Klopapier"}'
  ```

- Integration lock (Job 50, docs/PURCHASES.md „Integration lock“): Siri
  ist frei wie Alexa (Job 184). Der Endpunkt fragt das Schloss nicht, auch
  wenn der Server-Schalter `integration_lock` an ist und der Haushalt kein
  Snacklist Premium hat; `public.integration_gate` antwortet für `siri`
  offen, auch einer älteren voice-Funktion.
  Mit `"split": true` (die App seit Job 111) kommt jeder Eintrag zusätzlich
  mit Marke, Eigenschaften und Laden zurück, wie `add_item` sie speichert
  (`brand`, `properties`, `storeId`); ohne bleibt die Antwort wie bisher.
  Der Schalter ist aus.

Der Quellcode liegt in `supabase/functions/voice/`; die Zerlegung des
Satzes in `parse.ts`, die Beispielsätze als Tests in `parse_test.ts`.

## Natives Siri (Job 51)

Engineering notes; the reasons are in `docs/DECISIONS.md`, "Job 51".

- **Intents** in the Runner target, `app/ios/Runner/AppIntents/`: `AddItemsIntent` (asks for the
  items when the phrase has none; the `ItemSuggestion` entity makes "Add milk to Snacklist" one
  utterance for names the app sent), `ReadListIntent`, `SnacklistShortcuts` (the App Shortcuts
  provider), `VoiceClient` (URLSession, 8 s in all, branches on `outcome`), `SiriCredentialStore`
  (Keychain) and the `snacklist/siri` method channel (`SiriBridge.swift`). iOS 17 and newer, always
  in the background. Phrases: `Runner/AppShortcuts.xcstrings` (a phrase set per language, job
  97); dialogs:
  `Localizable.xcstrings`. The app's list of the phrases for Zugänge is
  `app/lib/siri/siri_phrases.dart`; keep both in step.
- **Credential.** After sign-in in a household the app (`app/lib/siri/siri_credentials.dart`)
  calls `create_siri_credential()` and stores `{token, id, userId, sessionId, url}` in the Keychain
  (service `com.snacklist.app.siri`, this device only). The row is kind `siri` in
  `personal_access_tokens`, bound to the Supabase session; it ends with sign-out, account deletion
  or leaving the household. Like every access key, its row is deleted 30 days after it ended
  (`purge_access_tokens`, see docs/MCP.md "Retention"). Only `voice` accepts it (`authenticate(req, deps, { siri: true })`).
  Zugänge lists it as "Siri (dieses iPhone)".
- **Request** from the intents: `POST /functions/v1/voice` with `Authorization: Bearer fgp_…` and
  JSON `{"text", "mode": "add"|"read", "lang": "de"|"en"}`. `lang` comes from the dictated text
  (`NLLanguageRecognizer`, English or German), else the app's language.
- **Answer.** A request with `lang` gets `outcome` in every JSON answer: `added`, `nothing_added`,
  `parsed`, `read`, or the failure code (also in `error`): `method`, `unauthorized`,
  `no_household`, `no_text`, `too_long`, `nothing_understood` and `server`. Since job 184 Siri
  is free, so the function no longer answers `premium_required` (the app still understands it).
  `mode: "read"` answers `{outcome, speech, items: [{name,
  quantity}], total}`, the speech naming the first ten. Requests without `lang`, like this
  Shortcut, get exactly the answers from before job 51.
- **English** splitting is `supabase/functions/voice/parse_en.ts` (cases in `parse_en_test.ts`), every
  sentence in both languages `copy.ts`.
- **Tests.** Deno: `voice/*_test.ts`, `_shared/auth_test.ts`, `_shared/telemetry_test.ts`. pgTAP:
  `siri_credentials.test.sql`, `english_groceries.test.sql`. e2e: `e2e/tests/voice.spec.ts`. Swift:
  `app/ios/RunnerTests/SiriTests.swift`, run by `scripts/gates/ios.sh` on CI's macOS runner.
  Real Siri voice only on a device (NEEDS_LEAD, "Job 51").


## Request log (job 170)

`voice` writes one line per request (`requestLine` in `supabase/functions/voice/handler.ts`), so
a Siri test can be followed live with `scripts/voice/tail.sh`:

```
voice: <via> <mode> <lang> client=<client> -> <outcome> status=<n> count=<n> ms=<n>
voice: siri add de client=ios-1210.AddItems -> added status=200 count=2 ms=640
voice: siri add de client=ios-1210.Lists.add -> added status=200 count=1 ms=702
voice: none read de client=ios-1210.ReadList -> unauthorized status=401 count=0 ms=95
```

- `via`: `siri` (the app's Siri credential), `pat` (the Shortcut recipe), `session` (in-app
  dictation), `none` (no valid sign-in).
- `client`: the iPhone's `x-snacklist-client` header (`x-hummlist-client` from installed Hummlist
  builds, still read), `ios-<build>.<path>`. The path is
  `AddItems` (a phrase without an item), `AddItems.item` (a known item in the phrase), `ReadList`,
  or `Lists.add` / `Lists.read` (SiriKit's list grammar). `-` without the header (the Shortcut,
  older builds), `other` for a value that isn't one token.
- `count`: the items understood (add, parse) or open (read).
- Never in the line: the text, item names, tokens, user or household ids.

On the iPhone the intents log to Console.app (subsystem `com.snacklist.app`, category `siri`):
which intent ran, whether a credential was there, and the HTTP status. A request the server
never logs and the phone never logs never reached Snacklist: Siri sent it elsewhere.

## Routing auf Deutsch (Job 92)

Engineering notes; the reasons are in `docs/DECISIONS.md`, "Job 92".

Build 1119 trained every German phrase, yet German Siri failed two ways:

1. **Name not recognised, Reminders wins.** Siri writes the spoken name as common words („Ham
   Liste“, „Home-Liste“). „Füge X zur <…>liste hinzu“ and „Einkaufsliste“ are the built-in
   Reminders grammar, so Siri put the item on a Reminders list.
2. **Name recognised, „Hummlist unterstützt das nicht“.** An App Shortcut phrase with `${item}`
   matches only the item names the app registered. Any other item fell through to SiriKit's Lists
   domain, which the app did not handle.

The fix:

- **Phrases** (since job 97 `AppShortcuts.xcstrings`): German phrases name the app first or as the
  object: „Snacklist, füge etwas hinzu“, „Etwas auf Snacklist setzen“, „Mit Snacklist einkaufen“,
  „Snacklist, was steht drauf“. „Snacklist Einkaufsliste“ and „Auf meine Snacklist“ are gone. The
  add phrases without an item come first, so Siri asks „Was soll auf die Liste?“ and any item
  works. `scripts/siri-phrases.ts` (lint gate) and RunnerTests reject „Einkaufsliste“, a phrase
  that starts with a preposition and ends with the app name, and an item phrase before a
  parameterless one.
- **Spoken names** (`INAlternativeAppNames`, three per language, Apple's limit, keys
  `SNACKLIST_NAME_*` in `Runner/<lang>.lproj/InfoPlist.strings`): since job 174 German
  „Snack List“, „Snäcklist“, „Snecklist“ (hint „snäcklist“), English „Snack List“, „Snack-list“,
  „Snack Lists“ (hint "snack list"). None ends in „Liste“, because German Siri gives
  „zur … Liste“ to Reminders (job 97 dropped Hummlist's „Humm Liste“, „Hummliste“ and „Ham Liste“
  for that). `CFBundleSpokenName` is „Snacklist“ everywhere (Hummlist's was „Hummlist“; job 92
  had „Humm List“). Apple documents no key that prefers one alternative name for App Shortcuts,
  so there is none.
- **Parameters at launch.** `AppDelegate` calls `SnacklistShortcuts.updateAppShortcutParameters()`
  in `didFinishLaunching`, so every install or update refreshes the item phrases, not only once a
  list has loaded.
- **SiriKit Lists fallback** (`AppIntents/SiriKitLists.swift`): `AppDelegate`'s
  `application(_:handlerFor:)` handles `INAddTasksIntent` (the task titles go to `voice`, mode
  `add`, as one sentence) and `INSearchForNotebookItemsIntent` (mode `read`, the open items come
  back as tasks Siri reads). In-app, no Intents extension. Needs `com.apple.developer.siri`
  (`Runner.entitlements`, the App ID capability and match profiles from #221),
  `INIntentsSupported` and `NSSiriUsageDescription`. SiriKit routes intents only after the user
  allowed Siri for the app: `SiriBridge` asks once (`INPreferences.requestSiriAuthorization`)
  when the app stores the Siri credential after sign-in. A list name the user says is ignored;
  the household has one list. Siri speaks its own confirmation here, not `voice`'s sentence.
  Every failure, signed out and no household included, answers `failure`:
  Siri says its own localized sentence and stays in its sheet (job 97; `failureRequiringAppLaunch`
  opened the app). A Lists response has no field for the app's own words, so the reason ("open
  Snacklist and sign in") is spoken only on the App Shortcuts path.
- **Example phrases** (`Runner/<lang>.lproj/AppIntentVocabulary.plist`): App Store Connect wants
  at least one example per SiriKit intent in each language (ITMS-90626 on build 1130), and the Siri
  Guide shows them. Every example names the app. German examples avoid
  „Einkaufsliste“. `scripts/siri-vocabulary.py` checks the source tree (lint gate), the built app
  (ios gate) and the signed IPA (Fastfile) against every intent an `Info.plist` declares.

### Gerätetest (job 97)

Before the `native-siri` hold ends, on an iPhone with iOS 17 or newer and the first build that
contains job 97 (build N). German first, then the same with Siri in English.

1. Einstellungen › Siri › Sprache: **Deutsch (Deutschland)** (then **English (United States)**).
2. Einstellungen › Siri › Antworten › **Transkription immer anzeigen**: on.
3. Einstellungen › Apps › Snacklist › Siri: **Mit Siri verwenden** and **Von dieser App lernen**
   on. After the first start in a household, iOS asked once whether Snacklist may use Siri.
4. Open Snacklist once, signed in, in a household, and let the list load. Have „Karotten“ bought
   once and „Möhren“ added once (same item, so „Möhren“ becomes a synonym).
5. Kurzbefehle app: the Snacklist tile shows **Zu Snacklist hinzufügen**, **Meine Snacklist
   vorlesen** and **Snacklist öffnen**.
6. Say each phrase (then Type to Siri for the ones that fail by voice):

   | Siri | Phrase | Expected |
   | --- | --- | --- |
   | de | Snacklist, füge etwas hinzu | Siri asks „Was soll auf die Liste?“; „Milch und Brot“: „Hinzugefügt: Milch, Brot.“ |
   | de | Füge etwas zu meiner Snacklist hinzu | as above |
   | de | Schreib etwas auf die Snacklist | as above |
   | de | Füge Karotten zu Snacklist hinzu | Karotten added in one sentence, no question |
   | de | Füge Möhren zur Snacklist hinzu | the household's „Karotten“ added (synonym) |
   | de | Füge Zahnpasta zu Snacklist hinzu | Zahnpasta on the list (SiriKit Lists), not Reminders |
   | de | Was steht auf meiner Snacklist | Siri reads the open items |
   | de | Snacklist, was brauchen wir | as above |
   | de | Zeig meine Snacklist | the app opens on the list, from any screen |
   | de | Füge Milch zur Einkaufsliste hinzu | Reminders, not Snacklist (negative phrase) |
   | de | signed out: Snacklist, füge etwas hinzu | Siri says „Öffne Snacklist und melde dich an. Ich habe nichts hinzugefügt.“, app stays closed |
   | de | signed out: Füge Zahnpasta zu Snacklist hinzu | Siri says it could not do it, app stays closed |
   | en | Add something to my Snacklist | Siri asks for the items, then "Added …" |
   | en | Add carrots to Snacklist | added in one sentence (if "carrots" was used before) |
   | en | What's on my Snacklist | Siri reads the open items |
   | en | Show my Snacklist | the app opens on the list |
   | en | Add milk to my shopping list | Reminders, not Snacklist |
   | en | signed out: Add to Snacklist | "Open Snacklist and sign in. I didn't add anything.", app stays closed |

7. Per phrase record the build number, what Siri wrote (screenshot of the transcript), and the
   outcome (added, Reminders, „unterstützt das nicht“, app opened). A transcript that spells the
   name another way („Snack Liste“, „Snecklist“) is the input for the German alternative names.
