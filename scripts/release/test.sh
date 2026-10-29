#!/usr/bin/env bash
# Tests scripts/release/*.sh offline: when a Release run ships or skips (fixture facts), how it
# finds the last upload (fake gh), the TestFlight notes (scratch repo), the failure issue
# (fake gh) and the AAB signer check (throwaway keystore). Run by the lint gate.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
failures=0
fail() { echo "FAIL: $*" >&2; failures=$((failures + 1)); }
expect_eq() {
  if [[ "$2" != "$3" ]]; then fail "$1"$'\n'"--- expected"$'\n'"$3"$'\n'"--- got"$'\n'"$2"; fi
}
expect_match() {
  if ! grep -qE -- "$3" <<<"$2"; then fail "$1: expected /$3/ in"$'\n'"$2"; fi
}

# --- plan.sh decide -------------------------------------------------------------------------
head=aaaaaaa1111111111111111111111111111111111
prev=bbbbbbb2222222222222222222222222222222222
facts() {
  jq -n --arg head "$head" --arg prev "$prev" \
    '{event: "schedule", force: false, upload: true, head_sha: $head, build_number: 1010,
      now: "2026-11-02T03:00:05Z",
      ci: {status: "completed", conclusion: "success", url: "https://ci/1"},
      last_upload: {sha: $prev, created_at: "2026-10-26T03:20:00Z", url: "https://release/9"},
      testflight: {max_build: 1009, installable: true}}' | jq "$1" >"$tmp/facts.json"
}
decide() { "$here/plan.sh" decide "$tmp/facts.json" 2>&1; }
field() { sed -n "s/^$1=//p" <<<"$2"; }

facts .
out="$(decide)"
expect_eq "main moved: ships" "$(field ship "$out")" true
expect_match "main moved: names both commits" "$(field reason "$out")" 'bbbbbbb -> aaaaaaa'
expect_eq "main moved: notes start after the last upload" "$(field previous_sha "$out")" "$prev"

facts '.last_upload.sha = .head_sha'
out="$(decide)"
expect_eq "unchanged: skips" "$(field ship "$out")" false
expect_eq "unchanged: not a failure" "$(field blocked "$out")" false
expect_match "unchanged: says so" "$(field reason "$out")" '^main is unchanged since the last upload'

facts '.last_upload.sha = .head_sha | .event = "workflow_dispatch"'
expect_eq "unchanged dispatch without force: skips like the schedule" "$(field ship "$(decide)")" false

facts '.last_upload.sha = .head_sha | .force = true'
out="$(decide)"
expect_eq "force: ships" "$(field ship "$out")" true
expect_eq "force: reason" "$(field reason "$out")" forced

facts '.last_upload.sha = .head_sha | .upload = false'
out="$(decide)"
expect_eq "dry run on unchanged main: still builds" "$(field ship "$out")" true
expect_match "dry run: reason" "$(field reason "$out")" '^dry run'

facts '.last_upload = null'
out="$(decide)"
expect_eq "first upload: ships" "$(field ship "$out")" true
expect_eq "first upload: notes from recent history" "$(field previous_sha "$out")" ""

facts '.last_upload.sha = .head_sha | .testflight.installable = false'
out="$(decide)"
expect_eq "unchanged but every TestFlight build expired: ships" "$(field ship "$out")" true
expect_match "expired: reason" "$(field reason "$out")" 'no installable build'

facts '.last_upload.sha = .head_sha | .last_upload.created_at = "2026-09-02T03:00:00Z"'
out="$(decide)"
expect_eq "unchanged for 61 days: ships before TestFlight expires it" "$(field ship "$out")" true
expect_match "61 days: reason" "$(field reason "$out")" '61 days old'

facts '.last_upload.sha = .head_sha | .last_upload.created_at = "2026-09-04T03:00:00Z"'
expect_eq "unchanged for 59 days: skips" "$(field ship "$(decide)")" false

facts '.last_upload.sha = .head_sha | .testflight = null'
expect_eq "unchanged without iOS secrets: skips" "$(field ship "$(decide)")" false

facts '.ci.conclusion = "failure"'
out="$(decide)"
expect_eq "red CI: does not ship" "$(field ship "$out")" false
expect_eq "red CI: blocked (the schedule reports it)" "$(field blocked "$out")" true
expect_match "red CI: links the CI run" "$(field reason "$out")" 'failure on aaaaaaa \(https://ci/1\)'

facts '.ci.conclusion = "failure" | .force = true'
expect_eq "red CI: force does not override" "$(field ship "$(decide)")" false

facts '.ci = {status: "in_progress", conclusion: null, url: "https://ci/2"}'
out="$(decide)"
expect_eq "CI still running: blocked" "$(field blocked "$out")" true
expect_match "CI still running: reason" "$(field reason "$out")" 'has not finished'

facts '.ci = null'
expect_eq "no CI run on the commit: blocked" "$(field blocked "$(decide)")" true

facts '.testflight.max_build = 1010'
if out="$(decide)"; then fail "a build number TestFlight already has must fail the run"; fi
expect_match "stale build number: names the fix" "$out" '^::error::Build number 1010 is not above .*BUILD_NUMBER_OFFSET'

# --- plan.sh gather: the last upload is the newest successful run with an Uploaded job -------
mkdir -p "$tmp/bin"
cat >"$tmp/bin/gh" <<'GH'
#!/usr/bin/env bash
# Answers `gh api <path> [--jq <filter>]` from $FAKE_API/<path with / and ? as _>.json.
set -euo pipefail
path="$2" filter=.
[[ ${3:-} == --jq ]] && filter="$4"
file="$FAKE_API/$(tr '/?&=' '____' <<<"$path").json"
[[ -f $file ]] || { echo "fake gh: no fixture for $path" >&2; exit 1; }
jq -r "$filter" "$file"
GH
chmod +x "$tmp/bin/gh"
api="$tmp/api" && mkdir -p "$api"
fixture() { cat >"$api/$(tr '/?&=' '____' <<<"$1").json"; }
r=repos/o/r
fixture "$r/actions/workflows/ci.yml/runs?head_sha=$head&event=push&per_page=20" <<'JSON'
{"workflow_runs": [
  {"created_at": "2026-11-01T10:00:00Z", "status": "completed", "conclusion": "failure", "html_url": "https://ci/old"},
  {"created_at": "2026-11-01T11:00:00Z", "status": "completed", "conclusion": "success", "html_url": "https://ci/rerun"}]}
JSON
fixture "$r/actions/workflows/release.yml/runs?branch=main&status=success&per_page=50" <<'JSON'
{"workflow_runs": [{"id": 41}, {"id": 40}, {"id": 30}]}
JSON
fixture "$r/actions/runs/41/jobs?per_page=100" <<'JSON'
{"jobs": [{"name": "plan", "conclusion": "success"}, {"name": "Uploaded", "conclusion": "skipped"}]}
JSON
fixture "$r/actions/runs/40/jobs?per_page=100" <<'JSON'
{"jobs": [{"name": "plan", "conclusion": "success"}, {"name": "Uploaded", "conclusion": "success"}]}
JSON
fixture "$r/actions/runs/40" <<JSON
{"head_sha": "$prev", "created_at": "2026-10-26T03:20:00Z", "html_url": "https://release/40"}
JSON
echo '{"max_build": 1009, "installable": true}' >"$tmp/testflight.json"
gathered="$(PATH="$tmp/bin:$PATH" FAKE_API="$api" GITHUB_REPOSITORY=o/r EVENT=schedule \
  FORCE=false UPLOAD=true HEAD_SHA="$head" BUILD_NUMBER=1010 TESTFLIGHT_JSON="$tmp/testflight.json" \
  "$here/plan.sh" gather)"
expect_eq "gather: the last upload skips runs without a successful Uploaded job" \
  "$(jq -c .last_upload <<<"$gathered")" "{\"sha\":\"$prev\",\"created_at\":\"2026-10-26T03:20:00Z\",\"url\":\"https://release/40\"}"
expect_eq "gather: the newest CI run on the commit counts (a green rerun)" "$(jq -r .ci.conclusion <<<"$gathered")" success
expect_eq "gather: TestFlight state passes through" "$(jq -c .testflight <<<"$gathered")" '{"max_build":1009,"installable":true}'
expect_eq "gather: inputs are typed" "$(jq -c '[.force, .upload, .build_number]' <<<"$gathered")" '[false,true,1010]'

fixture "$r/actions/workflows/release.yml/runs?branch=main&status=success&per_page=50" <<<'{"workflow_runs": [{"id": 41}]}'
gathered="$(PATH="$tmp/bin:$PATH" FAKE_API="$api" GITHUB_REPOSITORY=o/r EVENT=schedule \
  FORCE=false UPLOAD=true HEAD_SHA="$head" BUILD_NUMBER=1010 TESTFLIGHT_JSON='' "$here/plan.sh" gather)"
expect_eq "gather: no earlier upload" "$(jq -c '[.last_upload, .testflight]' <<<"$gathered")" '[null,null]'

# --- notes.sh -------------------------------------------------------------------------------
repo="$tmp/repo"
git init -q -b main "$repo"
commit() { git -C "$repo" -c user.name=t -c user.email=t@example.com commit -q --allow-empty -m "$1"; }
commit "Job 20: rename the app to Hummlist (com.hummlist.app) (#46)"
base="$(git -C "$repo" rev-parse HEAD)"
commit "Job 21: feedback button on the list (#60)"
commit "docs(done): job 21 summary (#61)"
commit "Verify skill upkeep 2026-11-01: drift fixed (#62)"
commit "Job 22 review 1: onboarding mail from peter@example.com no longer shows (#63)"
commit "ci: faster e2e (#64)"
commit "Job 11: one CI run per merge, one gate definition (#59)"
commit "Job 13b: nightly encrypted database backups (#58)"
commit "the list keeps its sort order (#65)"
to="$(git -C "$repo" rev-parse HEAD)"
notes() { (cd "$repo" && "$here/notes.sh" "$@"); }
expect_eq "notes (de): user-facing PRs since the last upload, newest first, no repo machinery" "$(notes de "$base" "$to")" \
"Neu in diesem Build von Hummlist:
- the list keeps its sort order
- onboarding mail from  no longer shows
- feedback button on the list"
expect_eq "notes (en): same list, English heading" "$(notes en "$base" "$to" | head -1)" "New in this Hummlist build:"
expect_eq "notes: unknown previous commit falls back to recent history" "$(notes en "$prev" "$to" | tail -1)" \
  "- rename the app to Hummlist (com.hummlist.app)"
commit "docs: only docs (#66)"
expect_eq "notes: nothing user-facing" "$(notes de "$to" HEAD)" "Kleine Verbesserungen und Fehlerbehebungen."
for i in $(seq 1 15); do commit "change $i (#$((70 + i)))"; done
out="$(notes en "$to" HEAD)"
expect_eq "notes: at most 12 lines" "$(grep -c '^- change' <<<"$out")" 12
expect_eq "notes: the rest is counted" "$(tail -1 <<<"$out")" "- and 3 more changes"
if notes en "$base" "$to" | grep -qE '@|#[0-9]|Job [0-9]'; then fail "notes leak an email, PR number or job prefix"; fi

# --- report.sh decide -----------------------------------------------------------------------
report() {
  env -i PATH="$PATH" EVENT="$1" SIMULATE="$2" UPLOAD="$3" PLAN="$4" IOS="$5" ANDROID="$6" UPLOADED="$7" \
    BLOCKED="${8:-false}" REASON="${9:-}" WEB="${10:-}" "$here/report.sh" decide
}
expect_eq "scheduled iOS failure opens the issue" "$(report schedule false true success failure success skipped)" open
expect_eq "scheduled plan failure (no outputs) opens the issue" "$(report schedule false '' failure skipped skipped skipped)" open
expect_eq "scheduled red-CI skip opens the issue" "$(report schedule false true success skipped skipped skipped true 'CI concluded failure')" open
expect_eq "cancelled Android job opens the issue" "$(report schedule false true success success cancelled skipped)" open
expect_eq "dispatch failure leaves the issue alone" "$(report workflow_dispatch false true success failure success skipped)" none
expect_eq "simulated dispatch failure opens the issue" "$(report workflow_dispatch true true failure skipped skipped skipped)" open
expect_eq "green upload closes the issue" "$(report schedule false true success success success success)" close
expect_eq "green dispatched upload closes the issue" "$(report workflow_dispatch false true success success skipped success)" close
expect_eq "unchanged main closes the issue" "$(report schedule false true success skipped skipped skipped false 'main is unchanged since the last upload (x)')" close
expect_eq "green dry run leaves the issue alone" "$(report workflow_dispatch false false success success success skipped)" none
expect_eq "green run that uploaded nothing leaves the issue alone" "$(report schedule false true success skipped success skipped)" none
expect_eq "scheduled web production failure opens the issue" "$(report schedule false true success success skipped success false '' failure)" open
expect_eq "green upload and web production closes the issue" "$(report schedule false true success success skipped success false '' success)" close

# --- report.sh apply ------------------------------------------------------------------------
cat >"$tmp/bin/gh" <<'GH'
#!/usr/bin/env bash
# Records issue commands; `issue list` answers with the open issue numbers in $FAKE_OPEN.
echo "$*" >>"$FAKE_LOG"
[[ "$1 $2" == "issue list" ]] && printf '%s\n' $FAKE_OPEN
exit 0
GH
apply() {
  : >"$tmp/gh.log"
  env -i PATH="$tmp/bin:$PATH" FAKE_LOG="$tmp/gh.log" FAKE_OPEN="$1" EVENT=schedule SIMULATE=false UPLOAD=true \
    PLAN=success IOS="$2" ANDROID=success UPLOADED="$3" GITHUB_SERVER_URL=https://github.com GITHUB_REPOSITORY=o/r \
    GITHUB_RUN_ID=77 GITHUB_SHA="$head" "$here/report.sh" apply >/dev/null
  grep -v '^issue list' "$tmp/gh.log" || true
}
expect_match "first failure creates the issue with the run link and platform" "$(apply '' failure skipped)" \
  '^issue create --repo o/r --title Weekly release failed --body Release run https://github.com/o/r/actions/runs/77 \(schedule\) on aaaaaaa failed: ios \(failure\)'
expect_match "next failure comments on the open issue" "$(apply 12 failure skipped)" '^issue comment 12 '
expect_eq "green upload closes every open copy" "$(apply '12 13' success success | cut -d' ' -f1-3)" $'issue close 12\nissue close 13'
expect_match "web-only failure says the stores got the build" \
  "$(: >"$tmp/gh.log"; env -i PATH="$tmp/bin:$PATH" FAKE_LOG="$tmp/gh.log" FAKE_OPEN='' EVENT=schedule SIMULATE=false UPLOAD=true \
    PLAN=success IOS=success ANDROID=skipped UPLOADED=success WEB=failure GITHUB_SERVER_URL=https://github.com GITHUB_REPOSITORY=o/r \
    GITHUB_RUN_ID=77 GITHUB_SHA="$head" "$here/report.sh" apply >/dev/null; grep '^issue create' "$tmp/gh.log")" \
  'failed: web \(failure\)\. The store upload went through, but app.hummlist.com was not moved'

# --- check-aab.sh ---------------------------------------------------------------------------
if command -v keytool >/dev/null && command -v jarsigner >/dev/null && command -v jar >/dev/null; then
  for name in upload other; do
    keytool -genkeypair -storetype PKCS12 -keystore "$tmp/$name.p12" -alias "$name" -keyalg RSA -keysize 2048 \
      -validity 1 -dname "CN=$name" -storepass testpass -keypass testpass >/dev/null 2>&1
  done
  fingerprint="$(keytool -list -v -keystore "$tmp/upload.p12" -storepass testpass | sed -n 's/^[[:space:]]*SHA256: //p')"
  (cd "$tmp" && echo x >f && jar cf unsigned.aab f)
  cp "$tmp/unsigned.aab" "$tmp/upload.aab" && cp "$tmp/unsigned.aab" "$tmp/other.aab"
  jarsigner -keystore "$tmp/upload.p12" -storepass testpass "$tmp/upload.aab" upload >/dev/null 2>&1
  jarsigner -keystore "$tmp/other.p12" -storepass testpass "$tmp/other.aab" other >/dev/null 2>&1
  "$here/check-aab.sh" "$tmp/upload.aab" "${fingerprint,,}" >/dev/null || fail "check-aab: the upload key's bundle passes (any case)"
  if out="$("$here/check-aab.sh" "$tmp/other.aab" "$fingerprint" 2>&1)"; then fail "check-aab: another key's bundle must fail"; fi
  expect_match "check-aab: names the signer" "$out" 'is signed by .*, not by the upload key'
  if "$here/check-aab.sh" "$tmp/unsigned.aab" "$fingerprint" >/dev/null 2>&1; then fail "check-aab: an unsigned bundle must fail"; fi
else
  echo "check-aab: skipped, no keytool/jarsigner"
fi

if [[ $failures -gt 0 ]]; then
  echo "release tests: $failures failed" >&2
  exit 1
fi
echo "release tests: all passed"
