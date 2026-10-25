#!/usr/bin/env bash
# Proof journey for features/account.md: a throwaway member of "Familie Test" deletes their
# account on lea's client while peter watches the list; then a throwaway that is the last member
# of its own household deletes theirs; then peter exports his data. The seeded peter and lea are
# never deleted. Needs `fg up --clients peter,lea`.
# Usage: journeys/account-deletion.sh   Evidence: the run directory printed at the end.
set -euo pipefail
fg="$(dirname "$(readlink -f "$0")")/../fg"
stamp="$(date +%s)"
item="Xylophon-$stamp"

step() { printf '\n== %s\n' "$*" >&2; }
fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
run() {
  local out
  out="$("$fg" "$@")" || { echo "$out" >&2; fail "fg $*"; }
  echo "$out" | jq -c . >&2
  echo "$out"
}
sql() { run db query "$1" | jq -r ".rows[0].${2:-count}"; }

api="$("$fg" env | jq -r .apiUrl)"
key="$(supabase status -o json --workdir "$("$fg" env | jq -r .stateDir)/stack" 2>/dev/null | jq -r .PUBLISHABLE_KEY)"
password=test-password-123

# A fresh user signs up on lea's client and lands on the welcome screen.
sign_up() {
  run logout --client lea >/dev/null
  run wait --key login-email --client lea >/dev/null
  run type --key login-email --input "$1" --client lea >/dev/null
  run type --key login-password --input "$password" --client lea >/dev/null
  run tap --text Registrieren --client lea >/dev/null
  run wait --key household-name --client lea >/dev/null
}

open_delete_dialog() {
  run tap --tooltip Menü --client lea >/dev/null
  run wait --key menu-account --client lea >/dev/null
  run tap --key menu-account --client lea >/dev/null
  run wait --key account-delete --client lea >/dev/null
  run tap --key account-delete --client lea >/dev/null
  run wait --key account-delete-confirm-field --client lea >/dev/null
}

confirm_delete() {
  run type --key account-delete-confirm-field --input LÖSCHEN --client lea >/dev/null
  run tap --key account-delete-confirm --client lea >/dev/null
  run wait --key account-deleted-notice --client lea --timeout 20 >/dev/null
}

step "both apps are healthy; peter is on the list"
run doctor >/dev/null
[[ "$("$fg" find --key login-email --client peter | jq -r .count)" == 0 ]] || run login peter >/dev/null
run wait --key add-item-field --client peter >/dev/null
step "earlier items are bought, so the new item's row is on screen (find and wait see built rows only)"
run db query "update items set status = 'bought' where status = 'active' and household_id = (select id from households where name = 'Familie Test')" --write >/dev/null

member="konto-$stamp@fg.test"
members_before="$(sql "select count(*) from household_members m join households h on h.id = m.household_id where h.name = 'Familie Test'")"
step "a throwaway member ($member) joins Familie Test and adds $item"
sign_up "$member"
run tap --tooltip Menü --client peter >/dev/null
run wait --text "Mitglied einladen" --client peter >/dev/null
run tap --text "Mitglied einladen" --client peter >/dev/null
run wait --text Code --client peter >/dev/null
code="$("$fg" find --type Text --client peter | jq -r '[.elements[].text | select(test("^[A-Z2-9]{8}$"))][0]')"
[[ "$code" =~ ^[A-Z2-9]{8}$ ]] || fail "no invite code on peter's screen"
run back --client peter >/dev/null
run type --key invite-code --input "$code" --client lea >/dev/null
run tap --text Beitreten --client lea >/dev/null
run wait --text "Familie Test" --client lea >/dev/null
run type --key add-item-field --input "$item" --submit --client lea >/dev/null
run wait --text "$item" --client peter >/dev/null
item_id="$(sql "select id from items where name = '$item'" id)"
run wait --key "added-by-$item_id" --client peter >/dev/null

step "precondition: the member has a personal access token that works"
access="$(curl -fsS "$api/auth/v1/token?grant_type=password" -H "apikey: $key" \
  -H 'content-type: application/json' -d "{\"email\":\"$member\",\"password\":\"$password\"}" | jq -r .access_token)"
pat="$(curl -fsS "$api/rest/v1/rpc/create_personal_access_token" -H "apikey: $key" \
  -H "authorization: Bearer $access" -H 'content-type: application/json' -d '{"p_name":"Journey"}' | jq -r '.[0].token')"
voice() {
  curl -s -o /dev/null -w '%{http_code}' "$api/functions/v1/voice" -H "authorization: Bearer $pat" \
    -H 'content-type: application/json' -d '{"text":"Zahnbürste"}'
}
[[ "$(voice)" == 200 ]] || fail "the member's token does not work before deletion"

step "the member opens Konto › Konto löschen: the household stays for peter and lea"
run record start --name "acct-delete-shared-$stamp" --client lea >/dev/null
open_delete_dialog
run screenshot --name 01-delete-dialog-kept --client lea >/dev/null
run wait --contains "bleibt für" --client lea >/dev/null
run tap --key account-delete-confirm --client lea >/dev/null
run wait --key account-delete-dialog --client lea --timeout 3 >/dev/null
[[ "$(sql "select count(*) from auth.users where email = '$member'")" == 1 ]] ||
  fail "the disabled button deleted the account"

step "typing LÖSCHEN enables Endgültig löschen; deletion signs out with the notice"
run type --key account-delete-confirm-field --input LÖSCHEN --client lea >/dev/null
run screenshot --name 02-delete-dialog-confirmed --client lea >/dev/null
run tap --key account-delete-confirm --client lea >/dev/null
run wait --key account-deleted-notice --client lea --timeout 20 >/dev/null
run screenshot --name 03-deleted-sign-in --client lea >/dev/null
run record stop >/dev/null

step "peter still has the list and the item, now without an initial, without reloading"
run wait --text "$item" --client peter >/dev/null
run wait --key "added-by-$item_id" --gone --client peter >/dev/null
run screenshot --name 04-peter-list-after --client peter >/dev/null

step "server state after the shared deletion"
[[ "$(sql "select count(*) from auth.users where email = '$member'")" == 0 ]] || fail "user still exists"
[[ "$(sql "select count(*) from items where name = '$item' and added_by is null")" == 1 ]] ||
  fail "the item is gone or still has an author"
[[ "$(sql "select count(*) from household_members m join households h on h.id = m.household_id where h.name = 'Familie Test'")" == "$members_before" ]] ||
  fail "Familie Test does not have its $members_before members from before the join"
[[ "$(sql "select count(*) from personal_access_tokens where name = 'Journey'")" == 0 ]] || fail "token row left"
[[ "$(voice)" == 401 ]] || fail "the deleted member's token still works"
status="$(curl -s -o /dev/null -w '%{http_code}' "$api/auth/v1/token?grant_type=password" -H "apikey: $key" \
  -H 'content-type: application/json' -d "{\"email\":\"$member\",\"password\":\"$password\"}")"
[[ "$status" == 400 ]] || fail "the deleted member can still sign in ($status)"

last="konto-last-$stamp@fg.test"
step "a throwaway ($last) is the last member of 'WG $stamp' and deletes the account"
sign_up "$last"
run type --key household-name --input "WG $stamp" --client lea >/dev/null
run tap --text "Haushalt anlegen" --client lea >/dev/null
run wait --key add-item-field --client lea >/dev/null
run type --key add-item-field --input Milch --submit --client lea >/dev/null
run wait --text Milch --client lea >/dev/null
hh="$(sql "select id from households where name = 'WG $stamp'" id)"
open_delete_dialog
run wait --contains "Du bist das letzte Mitglied" --client lea >/dev/null
run screenshot --name 05-delete-dialog-last --client lea >/dev/null
confirm_delete
left="$(sql "select (select count(*) from households where id = '$hh') + (select count(*) from household_members where household_id = '$hh')
  + (select count(*) from items where household_id = '$hh') + (select count(*) from item_events where household_id = '$hh')
  + (select count(*) from categories where household_id = '$hh') + (select count(*) from stores where household_id = '$hh')
  + (select count(*) from store_category_order where household_id = '$hh') + (select count(*) from invites where household_id = '$hh')
  + (select count(*) from category_memory where household_id = '$hh') + (select count(*) from item_store_memory where household_id = '$hh')
  + (select count(*) from personal_access_tokens where household_id = '$hh') as left" left)"
[[ "$left" == 0 ]] || fail "$left rows of the deleted household are left"

step "peter exports his data from Konto"
run tap --tooltip Menü --client peter >/dev/null
run wait --key menu-account --client peter >/dev/null
run tap --key menu-account --client peter >/dev/null
run wait --key account-export --client peter >/dev/null
run screenshot --name 06-settings-konto --client peter >/dev/null
run tap --key account-export --client peter >/dev/null
path="$(run wait --contains "Daten exportiert" --client peter | jq -r '[.elements[]?.text // empty | select(startswith("Daten exportiert"))][0] // empty' | sed 's/^Daten exportiert: //')"
run screenshot --name 07-export-done --client peter >/dev/null
if [[ -z "$path" ]]; then
  path="$("$fg" find --contains "Daten exportiert" --client peter | jq -r '[.elements[].text | select(startswith("Daten exportiert"))][0]' | sed 's/^Daten exportiert: //')"
fi
[[ -f "$path" ]] || fail "no export file at '$path'"
[[ "$(jq -r .format "$path")" == family-groceries-export ]] || fail "export has the wrong format"
[[ "$(jq -r .account.email "$path")" == peter@fg.test ]] || fail "export is not peter's"
! grep -q token_hash "$path" || fail "export contains token hashes"

dir="$("$fg" env | jq -r .evidenceDir)"
printf '\nPASS: shared deletion kept Familie Test and %s (no author, token 401, sign-in 400); last-member deletion left 0 rows; export at %s.\nEvidence: %s\n' \
  "$item" "$path" "$dir"
