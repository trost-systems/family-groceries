# Account (export and deletion)

Every signed-in user can export their data and delete their account. Both live in the "Konto" section at the bottom of the settings screen ("Zugänge"); a user without a household also finds "Konto löschen" on the welcome screen. The deletion dialog says what happens to the household before anything is deleted, and deletes only after the user types `LÖSCHEN` (or `LOESCHEN`) and taps "Endgültig löschen". Afterwards the app shows the sign-in screen with "Dein Konto wurde gelöscht." A shared household stays for the other members with the deleted user's items, now without their name. A household whose last member deletes goes with everything in it.

## Sub-features

- `acct-entry` opens settings scrolled to "Konto" from the list menu entry "Konto", with "Meine Daten exportieren" and "Konto löschen".
- `acct-fate-kept` tells a member of a shared household that "Der Haushalt „<name>“ bleibt für <other members> mit der ganzen Liste erhalten."
- `acct-fate-deleted` tells the last member "Du bist das letzte Mitglied. Deshalb wird der Haushalt „<name>“ … gelöscht."
- `acct-confirm-word` keeps "Endgültig löschen" disabled until the field holds `LÖSCHEN` or `LOESCHEN` (any case).
- `acct-delete-shared` deletes the account; the other member keeps the list and the deleted user's items lose their initial, live and after a reload. The user can no longer sign in, and their access tokens get 401.
- `acct-delete-last` deletes the account and the household with its items, history, categories, stores, invites, learned memory and tokens.
- `acct-offline` refuses without a connection ("Keine Internetverbindung. Dein Konto wurde nicht gelöscht. …") and deletes nothing.
- `acct-export` saves `einkauf-daten-YYYY-MM-DD.json` (format `family-groceries-export`) with the user's account, profile, household, their items and history, token names and hints, never a token hash. The snackbar says "Daten exportiert: <path>" on desktop.
- `acct-welcome` deletes an account that has no household from the welcome screen ("Du bist in keinem Haushalt, geteilte Daten gibt es nicht.").
- `acct-apple` asks Apple for a fresh authorization after the typed confirmation and revokes the Apple tokens (iOS only). Not drivable on the box: there is no iOS surface. Elsewhere the sign-in screen adds the hint to remove "Einkauf" from the Apple ID only when the server could not revoke.

## How to get to it (user POV)

- On the list, open "Menü" (top right), then "Konto". Settings open scrolled to the "Konto" section.
- On the list, open "Menü", then "Zugänge", and scroll to "Konto" at the bottom.
- Signed in without a household, the welcome screen shows "Konto löschen" below the onboarding form.
- The public page `/konto-loeschen.html` on the web build explains the steps for Google Play (a draft with an "ENTWURF" banner until Peter approves it).

## Driving it with fg

Preconditions:

- Baseline from `features/README.md`. Peter is signed in on the list.
- Never delete the seeded peter or lea. The lea client hosts a throwaway user: run `fg logout --client lea`, then `fg type --key login-email --input konto-$(date +%s)@fg.test --client lea`, `fg type --key login-password --input test-password-123 --client lea`, `fg tap --text Registrieren --client lea` and `fg wait --key household-name --client lea`. Its display name is the part before `@`.

- **Journey: a throwaway member joins Familie Test, adds an item and deletes the account.**
  1. Invite as peter: `fg tap --tooltip Menü`, `fg wait --text "Mitglied einladen"`, `fg tap --text "Mitglied einladen"`, read the code with `fg find --type Text | jq -r '[.elements[].text | select(test("^[A-Z2-9]{8}$"))][0]'`, then `fg back`.
  2. Join as the throwaway: `fg type --key invite-code --input <code> --client lea`, `fg tap --text Beitreten --client lea`, `fg wait --text "Familie Test" --client lea`.
  3. Add an item: `fg type --key add-item-field --input Xylophon-Konto --submit --client lea`. On peter, `fg wait --text Xylophon-Konto` succeeds. Read its id with `fg db query "select id, added_by from items where name = 'Xylophon-Konto'"`. `fg wait --key added-by-<id>` on peter finds the initial.
  4. `acct-entry`: `fg tap --tooltip Menü --client lea`, `fg wait --key menu-account --client lea`, `fg tap --key menu-account --client lea`, `fg wait --key account-delete --client lea`. Screenshot `acct-entry-settings`.
  5. `acct-fate-kept`: `fg tap --key account-delete --client lea`, `fg wait --key account-delete-confirm-field --client lea`, `fg wait --contains "bleibt für" --client lea`. The sentence names both other members (peter and lea, joined with "und").
  6. `acct-confirm-word`: `fg tap --key account-delete-confirm --client lea`, then `fg wait --key account-delete-dialog --client lea` still succeeds (the disabled button did nothing). `fg type --key account-delete-confirm-field --input LÖSCHEN --client lea`. Screenshot `acct-confirm-dialog`.
  7. `acct-delete-shared`: `fg tap --key account-delete-confirm --client lea`, `fg wait --key account-deleted-notice --client lea` (text "Dein Konto wurde gelöscht."). Screenshot `acct-deleted-sign-in`.
  8. Peter, without reload: `fg wait --key added-by-<id> --gone` and `fg wait --text Xylophon-Konto` both succeed. Screenshot `acct-partner-list-after`.
  9. Database: `fg db query "select count(*) from auth.users where email = '<throwaway email>'"` returns 0. `fg db query "select added_by from items where name = 'Xylophon-Konto'"` returns null. `fg db query "select u.email from household_members m join auth.users u on u.id = m.user_id join households h on h.id = m.household_id where h.name = 'Familie Test'"` lists only peter and lea.
  10. Sign-in refused: `fg type --key login-email --input <throwaway email> --client lea`, `fg type --key login-password --input test-password-123 --client lea`, `fg tap --text Anmelden --client lea` (the button, not the app bar title), `fg wait --contains "Anmeldung fehlgeschlagen" --client lea`.
- **Tokens die with the account.** Before step 7, create a token for the throwaway in its settings ("Token erstellen", see `features/mcp-access.md`). After step 7, a POST to `$(fg env | jq -r .apiUrl)/functions/v1/voice` with `Authorization: Bearer <token>` returns 401, and `fg db query "select count(*) from personal_access_tokens where name = '<token name>'"` returns 0.
- **`acct-delete-last`.** With a fresh throwaway on the welcome screen: `fg type --key household-name --input "WG Konto" --client lea`, `fg tap --text "Haushalt anlegen" --client lea`, `fg type --key add-item-field --input Milch --submit --client lea`. Note the id from `fg db query "select id from households where name = 'WG Konto'"`. Open the dialog as in steps 4 and 5; `fg wait --contains "Du bist das letzte Mitglied" --client lea`. Type `LÖSCHEN`, confirm, `fg wait --key account-deleted-notice --client lea`. Then `fg db query "select (select count(*) from households where id = '<id>') + (select count(*) from items where household_id = '<id>') + (select count(*) from categories where household_id = '<id>') + (select count(*) from stores where household_id = '<id>') + (select count(*) from item_events where household_id = '<id>') as left"` returns 0.
- **`acct-welcome`.** With a fresh throwaway on the welcome screen: `fg tap --key account-delete --client lea`, `fg wait --contains "Du bist in keinem Haushalt" --client lea`, `fg type --key account-delete-confirm-field --input LÖSCHEN --client lea`, `fg tap --key account-delete-confirm --client lea`, `fg wait --key account-deleted-notice --client lea`.
- **`acct-export`.** As peter (export reads only): `fg tap --tooltip Menü`, `fg wait --key menu-account`, `fg tap --key menu-account`, `fg wait --key account-export`, `fg tap --key account-export`, `fg wait --contains "Daten exportiert"`. The snackbar text ends in the file path. `jq '.format, .account.email' <path>` prints `"family-groceries-export"` and `"peter@fg.test"`, and `grep -c token_hash <path>` prints 0.
- **Cancel.** In the dialog, `fg tap --key account-delete-cancel --client lea` closes it and `fg wait --key account-delete-dialog --gone --client lea` succeeds. The user still exists.
- **`acct-offline`.** fg cannot take a client offline yet, so this is not drivable here. Report it as skipped on this surface. The web e2e test "offline, deletion is refused and the account stays; back online it goes through" (`e2e/tests/account.spec.ts`) covers it.
- **`acct-apple`.** iOS only. Report it as skipped on the box.
- **Proof.** Screenshots `acct-entry-settings`, `acct-confirm-dialog`, `acct-deleted-sign-in` (lea) and `acct-partner-list-after` (peter), a recording across steps 5 to 8 (`fg record start --name acct-delete-shared --client lea`), and the step 9 query outputs.

## Gotchas

- Never delete the seeded peter or lea. Deleting lea (or peter) breaks the baseline, and only `fg up --fresh` restores it. Use a throwaway user on the lea client.
- Deleting the last member deletes the household. Never let a throwaway that created its own household stand in for a test of the shared case.
- On the Linux desktop the export writes the file to the Downloads folder (`xdg-user-dir DOWNLOAD`), or to the temp directory when there is none: on the build box that is `/tmp/einkauf-daten-<date>.json`. Read the path from the snackbar instead of guessing it, and delete the file afterwards; it holds the user's email.
- The list menu animates open. Wait for `menu-account` before tapping it.
- The dialog loads the household's fate from the server first. Wait for `account-delete-confirm-field` before typing; until then the dialog shows a spinner.
- Button labels inside the dialog ("Endgültig löschen", "Abbrechen") are not listed by `fg find`. Use the keys `account-delete-confirm` and `account-delete-cancel`.
- `account-delete` is the key on both the settings tile and the welcome screen button.
- `--as lea` in `fg db query` means the seeded lea, not the throwaway signed in on the lea client.
- A fresh partner item's text carries the semantics label "<name>\nNeu" (job 8). Marionette prints it across two lines; `fg` before job 9 failed every `find`/`wait` on such a screen with "Unterminated string in JSON". Fixed in `cli/marionette.ts` (`parseElements`).
- `journeys/account-deletion.sh` runs this whole recipe (shared and last-member deletion, export) and prints `PASS` or `FAIL: <step>`. Clean throwaways from aborted runs with `fg db query "delete from auth.users where email like 'konto-%@fg.test'" --write`.
