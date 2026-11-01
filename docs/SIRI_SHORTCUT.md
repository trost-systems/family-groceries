# Siri: „Hey Siri, Einkaufsliste“

> **Seit Job 51 gibt es natives Siri ohne Einrichtung** (iOS 17 und neuer,
> Englisch und Deutsch): „Füge etwas zu Hummlist hinzu“. Wie das gebaut
> ist, steht unten unter [Natives Siri](#natives-siri-job-51). Der
> Kurzbefehl hier funktioniert weiter, für ältere iPhones und eigene Sätze.

Mit diesem Kurzbefehl diktierst du Einträge per Siri auf dem iPhone.
Auf der Apple Watch, mit AirPods und in CarPlay kann es über Siri
ebenfalls klappen, das haben wir aber noch nicht getestet.

> **Du:** Hey Siri, Einkaufsliste.
> **Siri:** Was soll auf die Liste?
> **Du:** Milch, zwei Gurken und Klopapier.
> **Siri:** Hinzugefügt: Milch, 2 Gurken, Klopapier.

Siri schickt den Satz an die Hummlist-App. Der Server teilt ihn in
Einträge auf, sortiert jeden Eintrag in seine Kategorie ein und antwortet
mit dem Satz, den Siri vorliest. Die Einträge erscheinen sofort auf allen
Geräten im Haushalt.

> **Voraussetzung:** Die Server-Funktion `voice` muss auf dem
> Supabase-Projekt laufen. Solange sie dort noch nicht eingerichtet ist
> (`docs/NEEDS_PETER.md`, Abschnitt 1), antwortet die Adresse unten mit
> einem Fehler.

Die Einrichtung dauert etwa fünf Minuten. Du brauchst die Hummlist-App
(angemeldet, in deinem Haushalt) und die App **Kurzbefehle** auf dem
iPhone.

## 1. Zugriffstoken in der App erstellen

Der Kurzbefehl meldet sich mit einem persönlichen Zugriffstoken an, nicht
mit deinem Passwort.

1. Öffne die Hummlist-App.
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
und Siri sagt zusätzlich „Möhren steht schon auf der Liste.“ Zusammenführen
geht in der App.

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

Der Quellcode liegt in `supabase/functions/voice/`; die Zerlegung des
Satzes in `parse.ts`, die Beispielsätze als Tests in `parse_test.ts`.

## Natives Siri (Job 51)

Engineering notes; the reasons are in `docs/DECISIONS.md`, "Job 51".

- **Intents** in the Runner target, `app/ios/Runner/AppIntents/`: `AddItemsIntent` (asks for the
  items when the phrase has none; the `ItemSuggestion` entity makes "Add milk to Hummlist" one
  utterance for names the app sent), `ReadListIntent`, `HummlistShortcuts` (the App Shortcuts
  provider), `VoiceClient` (URLSession, 8 s in all, branches on `outcome`), `SiriCredentialStore`
  (Keychain) and the `hummlist/siri` method channel (`SiriBridge.swift`). iOS 17 and newer, always
  in the background. Phrases: `en.lproj` and `de.lproj` `AppShortcuts.strings`; dialogs:
  `Localizable.xcstrings`. The app's list of the phrases for Zugänge is
  `app/lib/siri/siri_phrases.dart`; keep both in step.
- **Credential.** After sign-in in a household the app (`app/lib/siri/siri_credentials.dart`)
  calls `create_siri_credential()` and stores `{token, id, userId, sessionId, url}` in the Keychain
  (service `com.hummlist.app.siri`, this device only). The row is kind `siri` in
  `personal_access_tokens`, bound to the Supabase session; it ends with sign-out, account deletion
  or leaving the household. Only `voice` accepts it (`authenticate(req, deps, { siri: true })`).
  Zugänge lists it as "Siri (dieses iPhone)".
- **Request** from the intents: `POST /functions/v1/voice` with `Authorization: Bearer fgp_…` and
  JSON `{"text", "mode": "add"|"read", "lang": "de"|"en"}`. `lang` comes from the dictated text
  (`NLLanguageRecognizer`, English or German), else the app's language.
- **Answer.** A request with `lang` gets `outcome` in every JSON answer: `added`, `nothing_added`,
  `parsed`, `read`, or the failure code (also in `error`): `method`, `unauthorized`,
  `no_household`, `no_text`, `too_long`, `nothing_understood`, `server`, and `premium_required`
  (job 50's lock; not returned yet). `mode: "read"` answers `{outcome, speech, items: [{name,
  quantity}], total}`, the speech naming the first ten. Requests without `lang`, like this
  Shortcut, get exactly the answers from before job 51.
- **English** splitting is `supabase/functions/voice/parse_en.ts` (cases in `parse_en_test.ts`), every
  sentence in both languages `copy.ts`.
- **Tests.** Deno: `voice/*_test.ts`, `_shared/auth_test.ts`, `_shared/telemetry_test.ts`. pgTAP:
  `siri_credentials.test.sql`, `english_groceries.test.sql`. e2e: `e2e/tests/voice.spec.ts`. Swift:
  `app/ios/RunnerTests/SiriTests.swift`, run by `scripts/gates/ios.sh` on CI's macOS runner.
  Real Siri voice only on a device (NEEDS_LEAD, "Job 51").

