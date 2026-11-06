# Feedback

Mehr → „Feedback senden“ opens a sheet for a free-text note to Peter; on iOS and Android shaking the phone opens the same sheet (job 138). The user writes the note (up to 2000 characters), optionally picks a kind (Bug, Idee, Sonstiges) and may tick that Peter may contact them. The note is sent with app version, build, platform, OS/browser family, device model (`web` in a browser), language, the screen (after a shake the one on display, from More the one the user came from), how the form was opened (`more`/`shake`), theme, orientation, a text-size bucket, whether the list was connected and the household's Premium status, never list items. After sending, the sheet closes with the snackbar „Danke!“. If sending fails the note stays and the button becomes „Erneut senden“.

## Sub-features

- `fb-open` the sheet from More; heading „Feedback senden“, close button „Schließen“.
- `fb-message` multiline field „Deine Nachricht“ (hint „Was ist dir aufgefallen?“), required.
- `fb-kind` three optional chips: „Bug“, „Idee“, „Sonstiges“ under „Art (optional)“; tapping the chosen one again clears it.
- `fb-contact` checkbox „Peter darf mich dazu kontaktieren“, off by default.
- `fb-shake` iOS and Android only: a shake on any signed-in screen opens the sheet about that screen (`entry_point` `shake`); not while a dialog or sheet is open, at most once per 1.5 s, never on sign-in or onboarding. The sheet then shows the teach line „Einen Fehler gefunden? Geh zurück zu dem Bildschirm, stell ihn nach und schüttle das Handy — der Bericht enthält diesen Bildschirm plus App- und Gerätedaten. Keine Listeneinträge.“ (key `feedback-shake-hint`). Not on the web: no line there, and Playwright can't shake.
- `fb-attached` fixed line „Wird mitgeschickt: App-Version, Gerät und Modell, Sprache, Bildschirm, Darstellung (hell/dunkel, Ausrichtung, Textgröße), Verbindung, Premium-Status und wie du das Formular geöffnet hast. Keine Listeneinträge.“
- `fb-limit` at 1800 characters a counter „{count} / 2000“ shows; above 2000 the field shows „Höchstens 2000 Zeichen“ and Send is disabled.
- `fb-send` „Senden“ (disabled while empty, too long or sending; spinner labelled „Wird gesendet …“), then sheet closes, snackbar „Danke!“.
- `fb-fail` „Nicht gesendet. Prüfe die Verbindung und versuch es noch einmal.“ with the note kept and „Erneut senden“; a retry of an unchanged note stores one row, an edited note counts as a new one.
- `fb-draft` an unsent note survives closing the sheet; a sent note, or another account signing in, starts blank.

EN labels: "Send feedback", "Close", "Your message", "What did you notice?", "Kind (optional)", "Bug", "Idea", "Other", "Peter may contact me about this", "Found a bug? Go back to that screen, reproduce it, then shake your phone — the report includes that screen plus app and device details. No list items." (phones only), "Sent along: App version, device and model, language, screen, display (light/dark, orientation, text size), connection, Premium status and how you opened this form. No list items.", "{count} / 2000", "{max} characters at most" ("2000 characters at most"), "Send", "Sending …", "Thanks!", "Not sent. Check your connection and try again.", "Retry".

## How to get to it (user POV)

- „Mehr“ / "More" → row „Feedback senden“ / "Send feedback" (first in the group with „Hilfe & Kontakt“, above the „Rechtliches“ rows; no hint since job 85). On iOS and Android shaking the phone is the second way in (job 138); there is no button on the list.
- Works from a phone and beside an open More page on wide screens; from More the note's "screen" is the page the user was on before More (e.g. the list), or the open More page on wide layouts. After a shake it is the screen on display.

## Driving it with Playwright

Preconditions:

- Seeded household, signed in, consent declined, on the list.
- To read the stored row: service-role client (`adminClient()` in `e2e/tests/helpers.ts`) on table `feedback`, filtered by the user's id.

- **Open.** `openMore(page, 'Feedback senden')` (it wheels the lazy list to the row; in a journey `openTab(page, L, 'tabMore')` plus `reveal`). Observable: `getByRole('group',{name:'Feedback senden', exact:true})` visible; `getByRole('button',{name:'Senden', exact:true})` disabled.
- **Write.** `typeInto(page.getByRole('textbox',{name:'Deine Nachricht'}), 'Beim Abhaken springt die Liste nach oben.')`. Use `typeInto` (umlauts). Send becomes enabled.
- **Kind.** `getByRole('checkbox',{name:'Idee', exact:true}).click()`; contact: `getByRole('checkbox',{name:'Peter darf mich dazu kontaktieren'})`.
- **Send.** `getByRole('button',{name:'Senden', exact:true}).click()`. Observable: sheet group gone; snackbar text „Danke!“ (find with `page.locator('[id^="flt-semantic-node-"]').getByText('Danke!',{exact:true}).first()`); one `feedback` row: message, category (`bug`/`idea`/`other`/null), contact_ok, platform `web`, locale `de`, screen `list`, entry_point `more`, device_model `web`, theme `light`, text_scale `1.0`, orientation, online (`yes`/`no`/`unknown`), entitlement (`free` for the seeded household).
- **Limits.** Fill 2001 characters: `getByText('Höchstens 2000 Zeichen')`, `getByText('2001 / 2000')`, Send disabled; at 2000 `getByText('2000 / 2000')` and Send enabled.
- **Offline / retry.** `context.setOffline(true)`, Send: `getByText('Nicht gesendet. Prüfe die Verbindung und versuch es noch einmal.').first()` visible, textbox keeps its value, `getByRole('button',{name:'Erneut senden', exact:true})` enabled; `setOffline(false)`, click it: „Danke!“, exactly one row.
- **Double tap** on Send stores one row.
- Specs: `scripts/verify.sh --only e2e -- tests/feedback.spec.ts`.

## Gotchas

- Kind chips are checkboxes in the accessibility tree, not buttons or radios.
- The message is trimmed; length is counted in characters as trimmed, 1 to 2000.
- A feedback row is stored with or without analytics consent; the analytics event `feedback_submitted` (category, screen, contact_ok, no text) goes out only with consent. Accounts on test domains are marked internal (`.test`, `.invalid`, `.example`, `.localhost`, example.com/net/org), so the baseline's `fg-test.invalid` members store `is_internal: true` (driven 2026-11-04).
- The e2e build and this skill's build both point analytics at a fake collector (posthog.invalid); feedback itself goes to Supabase.
- Rows older than 12 months are deleted by the server (migration); that is not visible in the app.
- The sender cannot read notes back in the app, but Konto → „Meine Daten exportieren“ (EN "Export my data") includes their own notes (section `feedback` of the export).
- Whether Peter actually gets a notification of a new note is not in the app: unverified (outside app code).
