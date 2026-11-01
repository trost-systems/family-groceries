# Account: data export and deletion

Every signed-in user can export their data as a JSON file and delete their account. Both are on the Konto page (Mehr → Konto), which also shows the signed-in email address. Deleting asks first what happens to the household, and only deletes after the user types LÖSCHEN (German app) or DELETE (English app) and taps „Endgültig löschen“. A shared household stays for the other members with the leaving user's items, now without their name; a household whose last member deletes goes with everything in it. Single pieces of data (an item, an access key, a connected app, usage data) can be removed without deleting the account; the public page app.hummlist.com/konto-loeschen.html explains this.

## Sub-features

- `acct-entry` the Konto page: the email, „Meine Daten exportieren“ and „Konto löschen“.
- `acct-export` saves a JSON file `einkauf-daten-YYYY-MM-DD.json` (on web a browser download) and shows „Daten exportiert“ (on platforms that report a path: „Daten exportiert: <path>“).
- `acct-fate-kept` for a member of a shared household the dialog says the household stays for the others.
- `acct-fate-deleted` for the last member the dialog says the household is deleted too.
- `acct-confirm-word` „Endgültig löschen“ stays disabled until the field holds LÖSCHEN, LOESCHEN or DELETE (any case, spaces around ignored, in either language).
- `acct-deleted` after deletion the sign-in screen shows „Dein Konto wurde gelöscht.“
- `acct-welcome` a user without a household deletes the account from the welcome screen.
- `acct-offline` offline, deletion and export are refused with a message; nothing is deleted.
- `acct-partial` deleting single data without deleting the account: an item (edit sheet → „Löschen“, with „Rückgängig“), an access key (revoke) and a connected app (disconnect) on Zugänge, and usage data (switch off „Nutzungsdaten und Fehlerberichte senden“ in Mehr). History entries and „Zuletzt verwendet“ entries cannot be deleted in the app.
- `acct-apple` iOS only: after the typed confirmation Apple asks again, and the app revokes the Apple sign-in. Not drivable on web.

## How to get to it (user POV)

- Tab „Mehr“ / "More" → section „Konto“ / "Account" → row „Konto“ / "Account" (hint „Daten exportieren, Konto löschen“ / "Export your data, delete your account"). On the Konto page: „Meine Daten exportieren“ / "Export my data" (hint „Alles, was über dich gespeichert ist, als JSON-Datei.“ / "Everything stored about you, as a JSON file.") and „Konto löschen“ / "Delete account".
- Signed in without a household, the welcome screen has a „Konto löschen“ / "Delete account" button below the onboarding choices.
- Dialog „Konto löschen?“ / "Delete account?". It says: „Dein Konto, dein Profil, deine Zugangs-Tokens und deine verbundenen Apps werden endgültig gelöscht. Das lässt sich nicht rückgängig machen.“ (EN: "Your account, profile, access tokens and connected apps will be deleted for good. This can't be undone."). Then one of:
  - shared household: „Der Haushalt „<Haushalt>“ bleibt für <Namen> mit der ganzen Liste erhalten. Deine Einträge bleiben dort, aber ohne deinen Namen.“ (two or more others: „Lea und Max“, „Anna, Lea und Max“; names unavailable: „… bleibt für die anderen Mitglieder mit der ganzen Liste erhalten. …“). EN: "The household “<household>” stays with <names>, list and all. Your items stay there, but without your name."
  - last member: „Du bist das letzte Mitglied. Deshalb wird der Haushalt „<Haushalt>“ mit Liste, Verlauf, Kategorien und Geschäften gelöscht.“ (EN: "You're the last member, so the household “<household>” will be deleted with its list, history, categories and stores.")
  - no household: „Du bist in keinem Haushalt, geteilte Daten gibt es nicht.“ (EN: "You're not in a household, so there's no shared data.")
  - with a household also: „Mit „Meine Daten exportieren“ unter Konto kannst du vorher eine Kopie sichern.“ (EN: "To keep a copy first, use “Export my data” under Account.")
  - field „Zum Bestätigen LÖSCHEN eingeben“ (EN "Type DELETE to confirm"), buttons „Abbrechen“ / "Cancel" and „Endgültig löschen“ / "Delete for good".
- Public page (no sign-in): app.hummlist.com/konto-loeschen.html, title „Hummlist: Konto und Daten löschen“. Headings (h1/h2/h3, exact): h1 „Hummlist: Konto und Daten löschen“; h2 „So löschst du dein Konto in der App“; h2 „Was gelöscht wird“; h2 „Was mit eurem gemeinsamen Haushalt passiert“; h2 „Was bleibt und wie lange“; h2 „Einzelne Daten löschen, ohne das Konto zu löschen“ (anchor `#einzelne-daten`) with h3 „Einträge und Verlauf“, h3 „Zugänge für Siri und KI-Assistenten“, h3 „Nutzungsdaten“; h2 „Kein Zugang mehr zur App?“. Link to it: app.hummlist.com/konto-loeschen.html#einzelne-daten.
- What the page says on single data, word for word: „Wische auf der Liste einen Eintrag nach links (oder halte ihn gedrückt, im Browser auch Rechtsklick). Es öffnet sich das Fenster zum Bearbeiten.“ / „Tippe auf Löschen. Der Eintrag verschwindet von der Liste für alle im Haushalt; direkt danach kannst du das mit Rückgängig noch zurücknehmen.“ / „Einträge unter Zuletzt verwendet kannst du nur wieder auf die Liste setzen, nicht einzeln löschen. Den Verlauf (…) kannst du in der App nicht löschen. Er wird mit dem Haushalt gelöscht, wenn das letzte Mitglied sein Konto löscht. Einzelne Verlaufseinträge löschen wir auf Anfrage (siehe unten).“ / Zugänge: „Tippe auf Mehr und dann auf Zugänge. Unter Siri und Zugriffstoken: Tippe beim Zugang auf das Papierkorb-Symbol und bestätige mit Widerrufen. …“ and „Unter Verbundene Apps (zum Beispiel ein KI-Assistent): Tippe auf das Symbol zum Trennen und bestätige mit Trennen.“ / Nutzungsdaten: „Tippe auf Mehr und scrolle zu Nutzungsdaten. Schalte Nutzungsdaten und Fehlerberichte senden aus.“ Everything else (feedback notes, data already at PostHog) is deleted on request by email to support@hummlist.com within 30 days.
- Export file content (top-level keys): format (`family-groceries-export`), version, exported_at, account, profile, household, items_added (with brand and properties), history, access_tokens (names and hints, never a hash), invites_created, feedback, connected_apps, analytics_decisions, alexa_links, purchases, archived_households.

## Driving it with Playwright

Preconditions:

- Never delete the seeded demo users. Sign up a throwaway through the UI (`signUpWithHousehold(page, newEmail('acct'))` from e2e/tests/helpers.ts) or, for the shared case, a second browser context that signs up and uses `joinWithCode(b, await createInviteCode(a))`.
- Local stack up; `apiAs(email)` / `adminClient()` from helpers give a second view of the database.
- Spec: `e2e/tests/account.spec.ts`, run with `scripts/verify.sh --only e2e -- tests/account.spec.ts`.

- **Open the Konto page.** `await openMore(page, 'Konto')`. `page.getByRole('button', { name: 'Konto löschen', exact: true })` is visible; URL `/more/account`.
- **Export.** `const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^Meine Daten exportieren/ }).click()])`. `download.suggestedFilename()` is `einkauf-daten-<YYYY-MM-DD, Europe/Berlin>.json`; parse the file: `format` is `family-groceries-export`, `account.email` the user's, `items_added` the items they added, the text contains no `token_hash`.
- **Open the dialog.** Click `getByRole('button', { name: 'Konto löschen', exact: true })`, wait for `getByRole('textbox', { name: 'Zum Bestätigen LÖSCHEN eingeben' })` (a spinner shows while the household's fate loads). Shared case: `getByText(/bleibt für/)`; last member: `getByText(/Du bist das letzte Mitglied/)`; no household (user stuck on welcome screen): `getByText('Du bist in keinem Haushalt, geteilte Daten gibt es nicht.')`.
- **Confirm word.** `typeInto(confirmField, 'LÖSCHEN')` (never `fill`/`type`: umlauts drop), then `getByRole('button', { name: 'Endgültig löschen' }).click()`. Observable: `getByText('Dein Konto wurde gelöscht.')` on the sign-in screen; `adminClient().auth.admin.getUserById(id)` returns no user; shared case: the other context still sees the deleted user's items (`itemRow(b, 'Milch')`) and `items.added_by` is null; last member: zero rows left for the household in households, household_members, invites, categories, stores, items, item_events and the other household tables.
- **Offline.** `const network = await cutOff(page)`, click „Endgültig löschen“: `getByText(/^Keine Internetverbindung\. Dein Konto wurde nicht gelöscht/)`, user still exists. `await network.restore()`, click again: the account is deleted.
- **From the welcome screen.** `signUp(page, newEmail('acct-welcome'))`, then `getByRole('button', { name: 'Konto löschen', exact: true })` and the same dialog.
- **Partial deletion (item).** See `e2e/tests/list.spec.ts`: `openEdit(page, 'Milch')` (right click), `editSheet(page).getByRole('button', { name: 'Löschen' }).click()`, the row disappears, `actionSnackBar` offers „Rückgängig“.
- **Public page.** `page.goto('/konto-loeschen.html')` returns 200; `toHaveTitle('Hummlist: Konto und Daten löschen')`; `page.locator('#einzelne-daten')` has text „Einzelne Daten löschen, ohne das Konto zu löschen“; link `support@hummlist.com` has an href starting `mailto:support@hummlist.com`; link „Datenschutzerklärung“ points to `https://hummlist.com/datenschutz`; no „ENTWURF“ text and no robots meta tag.

## Gotchas

- Deleting the last member deletes the household: do not use a throwaway that created its own household to test the shared case.
- Exact accessible name `Konto löschen` is both the Konto-page tile and the welcome-screen button; with `exact: true` it does not match „Konto“ alone. In More, the row's name starts with „Konto“ and continues with its hint, so use `openMore(page, 'Konto')`.
- Type the confirmation word with `typeInto`, not synthetic keys. DE app accepts LÖSCHEN, LOESCHEN and DELETE.
- The dialog cannot be dismissed by clicking outside; use „Abbrechen“. While deleting, the buttons are disabled.
- On web the export is a browser download; the success snackbar reads „Daten exportiert“ (no path).
- The billing warning „Dein Jahresabo für Hummlist Premium läuft weiter und wird über dein Apple- bzw. Google-Konto abgerechnet, bis du es kündigst. Löschen oder Verlassen kündigt es nicht.“ appears before the dialog only for someone who pays a renewing yearly plan; nothing is sold today (premium-launch hold), so a normal user never sees it.
- Apple revocation (iOS) and the hint „Falls du dich mit Apple angemeldet hattest: Entferne „Hummlist“ auf deinem iPhone unter Einstellungen › [dein Name] › Anmelden & Sicherheit › Mit Apple anmelden.“ cannot be driven on web. unverified (no iOS surface).
- Legal texts (page, dialog) are quoted, never edit them; the page is static HTML served by the web build, not a Flutter route.
- The Zugänge partial-deletion paths are in the ai-assistants map. The „Nutzungsdaten“ section (switch „Nutzungsdaten und Fehlerberichte senden“ / "Send usage data and error reports") shows in Mehr only when analytics is enabled in the build; unverified whether the e2e build shows it.
