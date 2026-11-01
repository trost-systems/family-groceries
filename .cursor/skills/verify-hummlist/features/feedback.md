# Feedback

Mehr → „Feedback senden“ opens a sheet for a free-text note to Peter. The user writes the note (up to 2000 characters), optionally picks a kind (Bug, Idee, Sonstiges) and may tick that Peter may contact them. The note is sent with app version, build, platform, OS/browser family, language and the screen the user came from, never list items. After sending, the sheet closes with the snackbar „Danke!“. If sending fails the note stays and the button becomes „Erneut senden“.

## Sub-features

- `fb-open` the sheet from More; heading „Feedback senden“, close button „Schließen“.
- `fb-message` multiline field „Deine Nachricht“ (hint „Was ist dir aufgefallen?“), required.
- `fb-kind` three optional chips: „Bug“, „Idee“, „Sonstiges“ under „Art (optional)“; tapping the chosen one again clears it.
- `fb-contact` checkbox „Peter darf mich dazu kontaktieren“, off by default.
- `fb-attached` fixed line „Wird mitgeschickt: App-Version, Gerät, Sprache und aktueller Bildschirm. Keine Listeneinträge.“
- `fb-limit` at 1800 characters a counter „{count} / 2000“ shows; above 2000 the field shows „Höchstens 2000 Zeichen“ and Send is disabled.
- `fb-send` „Senden“ (disabled while empty, too long or sending; spinner labelled „Wird gesendet …“), then sheet closes, snackbar „Danke!“.
- `fb-fail` „Nicht gesendet. Prüfe die Verbindung und versuch es noch einmal.“ with the note kept and „Erneut senden“; a retry of an unchanged note stores one row, an edited note counts as a new one.
- `fb-draft` an unsent note survives closing the sheet; a sent note, or another account signing in, starts blank.

EN labels: "Send feedback", "Close", "Your message", "What did you notice?", "Kind (optional)", "Bug", "Idea", "Other", "Peter may contact me about this", "Sent along: App version, device, language and current screen. No list items.", "{count} / 2000", "{max} characters at most" ("2000 characters at most"), "Send", "Sending …", "Thanks!", "Not sent. Check your connection and try again.", "Retry".

## How to get to it (user POV)

- „Mehr“ / "More" → section „Feedback“ → row „Feedback senden“ / "Send feedback" (hint „Fehler, Ideen und Fragen an Peter“ / "Bugs, ideas and questions for Peter"). It is the only entry point (no shake gesture, none from the list).
- Works from a phone and beside an open More page on wide screens; the note's "screen" is the page the user was on before More (e.g. the list), or the open More page on wide layouts.

## Driving it with Playwright

Preconditions:

- Seeded household, signed in, consent declined, on the list.
- To read the stored row: service-role client (`adminClient()` in `e2e/tests/helpers.ts`) on table `feedback`, filtered by the user's id.

- **Open.** `openMore(page, 'Feedback senden')` (on phones scroll the lazy list first). Observable: `getByRole('group',{name:'Feedback senden', exact:true})` visible; `getByRole('button',{name:'Senden', exact:true})` disabled.
- **Write.** `typeInto(page.getByRole('textbox',{name:'Deine Nachricht'}), 'Beim Abhaken springt die Liste nach oben.')`. Use `typeInto` (umlauts). Send becomes enabled.
- **Kind.** `getByRole('checkbox',{name:'Idee', exact:true}).click()`; contact: `getByRole('checkbox',{name:'Peter darf mich dazu kontaktieren'})`.
- **Send.** `getByRole('button',{name:'Senden', exact:true}).click()`. Observable: sheet group gone; snackbar text „Danke!“ (find with `page.locator('[id^="flt-semantic-node-"]').getByText('Danke!',{exact:true}).first()`); one `feedback` row: message, category (`bug`/`idea`/`other`/null), contact_ok, platform `web`, locale `de`, screen `list`.
- **Limits.** Fill 2001 characters: `getByText('Höchstens 2000 Zeichen')`, `getByText('2001 / 2000')`, Send disabled; at 2000 `getByText('2000 / 2000')` and Send enabled.
- **Offline / retry.** `context.setOffline(true)`, Send: `getByText('Nicht gesendet. Prüfe die Verbindung und versuch es noch einmal.').first()` visible, textbox keeps its value, `getByRole('button',{name:'Erneut senden', exact:true})` enabled; `setOffline(false)`, click it: „Danke!“, exactly one row.
- **Double tap** on Send stores one row.
- Specs: `scripts/verify.sh --only e2e -- tests/feedback.spec.ts`.

## Gotchas

- Kind chips are checkboxes in the accessibility tree, not buttons or radios.
- The message is trimmed; length is counted in characters as trimmed, 1 to 2000.
- A feedback row is stored with or without analytics consent; the analytics event `feedback_submitted` (category, screen, contact_ok, no text) goes out only with consent. Test accounts on @example.test are marked internal.
- Only the e2e build points analytics at a fake collector; feedback itself goes to Supabase.
- Rows older than 12 months are deleted by the server (migration); that is not visible in the app.
- Whether Peter actually gets a notification of a new note is not in the app: unverified (outside app code).
