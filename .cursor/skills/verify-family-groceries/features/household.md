# Household

A list belongs to a household. A new user creates one on the welcome screen or joins one with an invite code. A member invites someone from the More tab ("Mitglied einladen"), which shows an 8-character code. A member can switch to another household with a code ("Anderem Haushalt beitreten").

## Sub-features

- `hh-create` creates a household from the welcome screen, with a name or the default "Unser Haushalt", and seeds its categories.
- `hh-invite` shows an invite code (8 characters from A–Z without I and O, and 2–9; valid 14 days, for any number of joins) with a copy button ("Kopiert"). Each opening of the dialog shows a new code; earlier ones stay valid.
- `hh-join-welcome` joins a household with a code from the welcome screen. Lowercase, spaces and dashes in the code are accepted.
- `hh-join-menu` switches a member to another household with a code from the More tab, after a warning.
- `hh-invalid-code` rejects a wrong code with "Dieser Code ist ungültig oder abgelaufen."
- `hh-isolation` keeps one household's items invisible to members of another.
- `hh-members` loads the members' display names with the list, so the title can name who added what is new; a new member's name loads with their first item (recipe in `features/live-sync.md`, `sync-new`).

## How to get to it (user POV)

- Sign up or sign in as a user without a household. The "Willkommen" screen offers "Name des Haushalts" with "Haushalt anlegen", and "Einladungscode" with "Beitreten".
- Tap "Mehr" in the tab bar, then "Mitglied einladen" or "Anderem Haushalt beitreten" under "Haushalt".
- Open an invite link (`/join/<code>`). The web build opens it. The release phone apps show the link too (`https://app.hummlist.com/join/<code>`, from `APP_URL`), but it opens the web app; in the phone app the user types the code. The fg debug build sets no `APP_URL`, so its invite dialog shows the code only.

## Driving it with fg

Preconditions:

- Baseline from `features/README.md`. Peter is signed in on the list.
- The lea client hosts a fresh user without a household: run `fg logout --client lea`, then `fg type --key login-email --input hh-$(date +%s)@fg.test --client lea`, `fg type --key login-password --input test-password-123 --client lea`, `fg tap --text Registrieren --client lea` and `fg wait --key household-name --client lea`.

- **Invite.** Run `fg tap --key tab-more`, `fg wait --key more-invite`, `fg tap --key more-invite` and `fg wait --text Code`. Read the code with `fg find --type Text | jq -r '[.elements[].text | select(test("^[A-Z2-9]{8}$"))][0]'`. `fg tap --tooltip Kopieren` shows the snackbar "Kopiert" below the dialog (screenshot it; see Gotchas). Close the dialog with `fg back`, then `fg tap --key tab-list`.
- **Join from welcome.** Run `fg type --key invite-code --input <code> --client lea` (`abcd-efgh` for `ABCDEFGH` works too) and `fg tap --text Beitreten --client lea`. `fg wait --key add-item-field --client lea` succeeds; the list shows no household name (job 29a), so check membership in the database: `fg db query "select u.email, m.role from household_members m join auth.users u on u.id = m.user_id join households h on h.id = m.household_id where h.name = 'Familie Test'"` lists the new user as `member`.
- **Invalid code.** On a welcome screen, run `fg type --key invite-code --input ZZZZZZZZ --client lea` and `fg tap --text Beitreten --client lea`. `fg wait --contains "ungültig oder abgelaufen" --client lea` succeeds.
- **Create.** On a welcome screen (another fresh user), run `fg type --key household-name --input "WG Test" --client lea` and `fg tap --text "Haushalt anlegen" --client lea`. `fg wait --key add-item-field --client lea` succeeds (the list names no household since job 29a), and `fg db query "select count(*) from categories c join households h on h.id = c.household_id where h.name = 'WG Test'"` returns 11.
- **Join from More.** As a member of another household, run `fg tap --key tab-more --client lea`, `fg wait --key more-join --client lea`, `fg tap --key more-join --client lea`, `fg wait --label Einladungscode --client lea`, `fg type --label Einladungscode --input <code> --client lea` and `fg tap --text Beitreten --client lea`. The confirm screen shows the code and "Du verlässt deinen aktuellen Haushalt …". Run `fg tap --text Beitreten --client lea` again, then `fg wait --key add-item-field --client lea` (the app returns to the list). The membership query above lists the user in Familie Test.
- **Isolation.** With the fresh user in its own household (after **Create**), add an item there: `fg type --key add-item-field --input Xylophon-WG --submit --client lea` and `fg wait --contains "Hinzugefügt: Xylophon-WG" --client lea`. Then `fg db query "select name from items where name = 'Xylophon-WG'" --as peter` returns no rows, while the same query without `--as` returns one. The pgTAP suite (`supabase/tests/rls.test.sql`) covers writes.
- **Proof.** Screenshot the invite dialog, the welcome screen before joining and the list after joining. Add the `household_members` query output.

## Gotchas

- `hh-join-menu` crashed on main until job 04's fix (2026-10-23): a red error screen after "Beitreten". If it comes back, `fg logs --client lea --grep EXCEPTION` names the cause.
- The release web build (the e2e tests, Vercel) strips Flutter's debug asserts, so the old join crash ("TextEditingController was used after being disposed", `_dependents.isEmpty`) never shows there. Only the debug app (fg) and `app/test/household/join_code_dialog_test.dart` catch that class of bug.
- After a join (or creating a household) the list must not show the crossed-out cloud ("Offline: …"). Until job 2b it stayed there until the first write: two overlapping resyncs shared one map and one threw. Check with `fg wait --contains Offline --gone --timeout 5 --client lea` after `fg wait --text "FAMILIE TEST"`.
- `--as peter` and `--as lea` mean the seeded users, not whoever is signed in on the client of that name.
- A snackbar shown while a dialog is open ("Kopiert") is visible in a screenshot but not to `fg find` or `fg wait`.
- A failed `fg tap` or `fg find` leaves an "EXCEPTION CAUGHT BY FLUTTER FRAMEWORK … ext.flutter.marionette" block in the app log. Skip those when you read `fg logs --grep EXCEPTION` for an app error.
- Users from these recipes stay members of "Familie Test" until `fg up --fresh`. Recipes that count its members (`journeys/account-deletion.sh`) compare with the count before their own join.
- Dialogs animate open. Tap inside one only after `fg wait` for its text or field, or the tap can miss.
- Joining a household leaves the previous one. If the leaver was its last member, that household and its list are deleted. Never run the join from More with the seeded lea or peter unless the recipe restores them (`fg up --fresh`).
- The invite dialog lists the code as plain text next to the label "Code". Pick it by its pattern, not by position.
- Labels on buttons ("Beitreten", "Haushalt anlegen") are invisible to `fg find`, but `fg tap --text` reaches them.
- Fresh sign-up users accumulate across runs. Use a timestamp in the email to stay unique.
