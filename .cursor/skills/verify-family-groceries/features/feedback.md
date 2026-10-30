# Feedback

Mehr → "Feedback senden" (`more-feedback`) opens a sheet where the user writes a short note (1 to 2,000 characters), optionally picks Bug, Idee or Sonstiges and ticks "Peter darf mich dazu kontaktieren", and sends it. The note goes into `public.feedback` with the app version, build, platform, OS version, app language and the screen the user came from (`list` when they opened More from the list), and nothing from the list. Clients can only insert; reading is for the service role (`docs/FEEDBACK.md`). On success the sheet closes and "Danke!" shows; on a failure the note stays with "Erneut senden".

## Sub-features

- `fb-open` `more-feedback` (section "Feedback", between Konto/Abmelden and Sprache) opens `feedback-sheet`.
- `fb-send` `feedback-message` takes the note; `feedback-send` ("Senden") is enabled once it has a non-blank character. One row lands; the sheet closes; the snackbar `feedback-thanks` reads "Danke!".
- `fb-options` `feedback-category-bug` / `-idea` / `-other` (a second tap unpicks), `feedback-contact` (off by default). `feedback-attached` names what goes along.
- `fb-limits` from 1,800 characters `feedback-counter` shows "N / 2000"; over 2,000 the field says "Höchstens 2000 Zeichen" and Send is disabled. Blank notes can't be sent.
- `fb-retry` without a connection `feedback-error` ("Nicht gesendet. …") shows, the note stays, and `feedback-retry` ("Erneut senden") replaces Send. Closing (`feedback-close`) keeps the note for the next open.
- `fb-screen` the row's `screen` is the last screen before More (`list`), or the More page the form sat beside on a wide screen (`account`).

## How to get to it (user POV)

- Tap "Mehr", scroll to "Feedback senden", tap it, type, tap "Senden".

## Driving it with fg

Preconditions: the baseline from `features/README.md`; peter signed in on the list.

- **`fb-open`, `fb-send`.** From the list: `fg tap --key tab-more`, `fg wait --key more-screen`, `fg marionette -- scroll-to --key more-feedback`, `fg screenshot --name fb-more`, `fg tap --key more-feedback`, `fg wait --key feedback-sheet`, `fg screenshot --name fb-empty`. `fg tap --key feedback-message`, `fg type --input "Beim Abhaken springt die Liste."`, `fg screenshot --name fb-filled`, `fg tap --key feedback-send`, `fg wait --text Danke!`, `fg screenshot --name fb-thanks`. Check: `fg db query "select message, category, contact_ok, screen, platform, locale, app_version, build, os_version, is_internal, household_id is not null as has_household from feedback order by created_at desc limit 1"` returns the text, category null, contact_ok false, screen `list`, platform `linux`, locale `de`, is_internal true (fg.test and a debug build).
- **`fb-options`.** Open the sheet again (it is blank after a send), type a note, `fg tap --key feedback-category-bug`, `fg tap --key feedback-contact`, `fg tap --key feedback-send`; the newest row has category `bug`, contact_ok true.
- **`fb-limits`.** `fg tap --key feedback-message`, `fg type --input "   "`: `fg find --key feedback-send` is disabled. A 2,001-character input (`fg type --input "$(printf 'a%.0s' {1..2001})"`) shows `feedback-counter` "2001 / 2000" and "Höchstens 2000 Zeichen".
- **`fb-retry`.** Not reliably drivable on linux (fg can't cut one client off the local stack); the web e2e tests "offline: …" and "a lost answer: …" (`e2e/tests/feedback.spec.ts`) and the widget test `test/feedback/feedback_sheet_test.dart` cover it. Report it as skipped with that pointer.
- **RLS.** `fg db query "select count(*) from feedback" --as peter` fails with permission denied: the sender can't read their own notes.
- **Proof.** Screenshots `fb-more`, `fb-empty`, `fb-filled`, `fb-thanks` and the db query output.

## Gotchas

- The sheet covers the tabs: close it (`feedback-close` or `fg back`) before `fg tap --key tab-list`.
- The note is kept when the sheet is closed without sending; a recipe that expects a blank form sends first or types over it (`fg type` replaces the field's text only after `fg tap --key feedback-message` and a select-all).
- `screen` is taken when the sheet opens: go to the list first, then More, to get `list`.
