# Job 117: no snackbar for what the screen already shows (2026-11-05)

Peter asked to remove every snackbar that only confirms an action whose result the screen already
shows. Every `showSnackBar` in `app/lib` was audited (table below, also in the PR).

## What changed

- Putting an item back from „Zuletzt verwendet“, revoking an invite and the internal-install long
  press no longer show a snackbar.
- Dictation keeps its summary („Hinzugefügt: … Schon auf der Liste: …“): dictated items can land
  off screen (lead decision, review 1).
- ARB keys deleted from `app_de.arb` and `app_en.arb`: `itemReadded`, `inviteRevoked`,
  `internalInstallOn`, `internalInstallOff`. No new strings.
- Widget tests now assert no snackbar (each one failed on the old code), the e2e AC8 spec drops
  the revoke snackbar line, feature files and FEATURES-FOR-WRITERS updated, DECISIONS
  "Job 117".

## Audit

| Where (main 1ba6dc51) | Old text DE / EN | Call | Reason |
| --- | --- | --- | --- |
| `app/lib/list/list_view/shopping_list_view.dart:315` | „{name} steht wieder auf der Liste“ / "{name} is back on the list" | REMOVE | The row comes back in its old place. Replaces job 29b's point 5 |
| `app/lib/household/invites_page.dart:104` | „Einladung widerrufen. Link und Code gelten nicht mehr.“ / "Invite revoked. Its link and code no longer work." | REMOVE | The card goes from „Offene Einladungen“ |
| `app/lib/more/more_screen.dart:690` | „Diese Installation zählt jetzt als intern.“ / „… nicht mehr als intern.“ ("This installation now counts / no longer counts as internal.") | REMOVE | „Interne Installation“ and „Testfehler senden“ appear or go under the version |
| `app/lib/list/dictation_button.dart:105` (via `list_screen.dart:302`) | „Hinzugefügt: {items}.“ / "Added: {items}." | KEEP | Dictated items can land off screen, so the confirmation is not redundant (lead decision) |
| `app/lib/list/dictation_button.dart:106` | „Schon auf der Liste: {items}.“ / "Already on the list: {items}." | KEEP | No new row, so nothing on screen says it was heard |
| `app/lib/list/dictation_button.dart:46,63,66,75,82` | „Ich habe nichts gehört.“, „Ich habe nichts verstanden …“, „Keine Verbindung. …“, dictation unavailable / no offline German | KEEP | Errors |
| `app/lib/list/list_view/shopping_list_view.dart:306` | „{name} gelöscht“ + Rückgängig / "{name} deleted" + Undo | KEEP | Undo is the only full way back. A deleted item is not in „Zuletzt verwendet“ (bought items only); a suggestion brings back name and quantity only, not note, brand or store |
| `app/lib/list/list_screen.dart:227` | „{name} steht schon auf der Liste“ + Zusammenführen | KEEP | Duplicate hint: the twin went on the list anyway; the offer is not visible otherwise |
| `app/lib/list/list_screen.dart:272` | „Zusammengeführt: {item}“ + Rückgängig | KEEP | The merged row doesn't show what went into it; Rückgängig is the only way to split it again |
| `app/lib/list/list_scope.dart:107` / `list_screen.dart:302` (rejections) | syncFailed, categoryNameTaken, catalogSaveFailed, reorderNeedsConnection, storeNameTaken, storesNeedConnection, mergeRefused, alreadyOnList (rename) | KEEP | Errors and refusals |
| `app/lib/household/invite_share.dart:218` | „Link kopiert“ / „Code kopiert“ | KEEP | Clipboard is not visible |
| `app/lib/settings/account_screen.dart:43` | „Kopiert“ (email) | KEEP | Clipboard |
| `app/lib/settings/account_screen.dart:93` | Export saved (with path) / offline / failed | KEEP | The file is not on screen; errors |
| `app/lib/settings/access_screen.dart:240` | „Kopiert“ (server URL, key) | KEEP | Clipboard |
| `app/lib/settings/access_screen.dart:294` | too many keys/tokens, session required, API disabled, generic error | KEEP | Errors |
| `app/lib/feedback/feedback_sheet.dart:55` | „Danke!“ (feedback sent) | KEEP | Sending is not visible |
| `app/lib/session/login_screen.dart:137,146` | sign-in canceled / failed; magic link sent | KEEP | Errors; the mail is not visible |

Not snackbars, unchanged: the add sheet's „✓ Hinzugefügt: <name>“ note with Rückgängig (the sheet covers the list, and the note carries the add's undo); Siri's and Alexa's spoken „Hinzugefügt: …“. Ticking and editing an item already showed no snackbar. Store and category renames show none either; their refusals go through `list_scope.dart` above.

## Verification

- `flutter analyze`: no issues. `flutter test`: 1819 passed (90 skipped); after review 1, rebased
  on main with #256 and #247: 1845 passed.
- The three changed widget tests (put back, revoke, internal install) fail on main's `lib/` and
  pass on the branch.
- e2e under `/tmp/fg-e2e.lock`, `--workers=1`: onboarding, list-walk-order, list, analytics,
  voice: 45 passed, 4 skipped, 2 failed: AC6 Google/Apple fake-provider sign-in, which always
  time out on the Hetzner runner (its containers can't reach host ports); CI runs them.
- verify-hummlist on the release web build: `drive.sh tick-and-undo` PASS, put back shows no
  snackbar (`docs/screenshots/117/put-back-*.png`); an invite revoke script: card gone, no
  snackbar, the invite revoked in the database (`docs/screenshots/117/revoke-*.png`).
- `scripts/lint.sh` passes.

## Not verified

- The internal-install long press is touch only; covered by `test/analytics/more_toggle_test.dart`.

## Review 1 (fix)

- Dictation's „Hinzugefügt: …“ restored with its key, tests and docs (lead decision: dictated
  items can land off screen). The open question for Peter about it is dropped.
- Rebased onto main with #256 (Notices): the delete snackbar keeps main's `_snack` through
  `Notices.of`, so no `ScaffoldMessenger.of` comes back; the removed `_revoke` and
  `_toggleInternal` took their Notices calls with them.
- „Last verified“ for the tick section names main 610ec94d with PR #257.
- Not done: an announcement assertion in the `tick-and-undo` journey. Proving that it catches a
  put-back snackbar needs a second web build under `/tmp/fg-e2e.lock`, which job 125's two-hour
  stress run held with nine jobs waiting. The widget test `list_screen_test.dart` proves no
  snackbar; the journey still proves the row comes back.
