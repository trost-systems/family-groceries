#!/usr/bin/env bash
# Decides whether a Release run ships, and which commit (docs/RELEASE.md, "When a run ships").
#   plan.sh gather            facts as JSON on stdout, from git, the Actions API and ASC (network)
#   plan.sh decide <facts>    ship/blocked/current/reason/sha as key=value lines for $GITHUB_OUTPUT (pure)
#   plan.sh ships-app         true when a changed path on stdin (one per line) goes into the app
#                             builds, else false (pure; push-pr.sh's changelog check, job 39)
# gather reads EVENT, FORCE, UPLOAD, MAIN_SHA (main's tip: now, or for a dispatch when it was
# started), TRIGGER_SHA (the commit whose CI started a workflow_run run, else empty), BUILD_NUMBER, GITHUB_REPOSITORY, GH_TOKEN and
# TESTFLIGHT_JSON (the `ios preflight` lane's output, absent without iOS), and runs in a clone
# that has main's history.
# decide exits 1 with an ::error:: line when the run must fail instead of skipping.
set -euo pipefail

# What ships when only these paths are unchanged is the same app, so a run skips it.
app_paths=(app .github/workflows/release.yml)
# How far back from main's tip a run looks for the newest green commit.
max_candidates=30

# A run "uploaded" when its Uploaded job succeeded; that job only runs after a real upload. Its
# name carries the commit it shipped ("Uploaded <sha>"): a workflow_run run's own head_sha is
# main's tip when it started, not necessarily what it shipped. Runs from before job 30 named it
# "Uploaded" and shipped their head_sha.
last_upload() {
  local id ids job shipped
  # On its own line, so an API error stops the script instead of reading as "no upload".
  ids="$(gh api "repos/$GITHUB_REPOSITORY/actions/workflows/release.yml/runs?branch=main&status=success&per_page=100" \
    --jq ".workflow_runs[].id")"
  for id in $ids; do
    job="$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$id/jobs?per_page=100" \
      --jq '[.jobs[] | select((.name == "Uploaded" or (.name | startswith("Uploaded "))) and .conclusion == "success")] | first | .name // empty')"
    if [[ -n $job ]]; then
      shipped="${job#Uploaded}"
      gh api "repos/$GITHUB_REPOSITORY/actions/runs/$id" --jq '{sha: .head_sha, created_at, url: .html_url}' |
        jq -c --arg sha "${shipped# }" 'if $sha != "" then .sha = $sha else . end'
      return
    fi
  done
  echo null
}

# The newest push-triggered CI run on a commit (a green rerun beats the red first attempt).
ci_run() {
  gh api "repos/$GITHUB_REPOSITORY/actions/workflows/ci.yml/runs?head_sha=$1&event=push&per_page=20" \
    --jq '.workflow_runs | sort_by(.created_at) | last | if . then {status, conclusion, url: .html_url} else null end'
}

# Did anything that goes into the store builds change between the two commits?
app_changed() {
  if [[ -n $1 ]] && git cat-file -e "$1^{commit}" 2>/dev/null && git diff --quiet "$1" "$2" -- "${app_paths[@]}"; then
    echo false
  else
    echo true
  fi
}

# main's commits newer than the last upload, newest first, each with its CI run. A dispatch
# looks at the tip only; any other run stops at the first green commit, which is what it ships.
# None when MAIN_SHA is the last upload or older (a dispatch that waited while a newer commit
# shipped), so a run never ships an older commit after a newer one.
gather() {
  local last prev sha ci candidates='[]' testflight=null trigger_shipped=false shas=()
  local trigger="${TRIGGER_SHA:-$MAIN_SHA}"
  last="$(last_upload)"
  prev="$(jq -r '.sha // empty' <<<"$last")"
  if [[ -z $prev ]] || ! git merge-base --is-ancestor "$MAIN_SHA" "$prev" 2>/dev/null; then
    mapfile -t shas < <(git rev-list --first-parent -n "$max_candidates" "$MAIN_SHA")
  fi
  for sha in "${shas[@]}"; do
    [[ $sha == "$prev" ]] && break
    ci="$(ci_run "$sha")"
    candidates="$(jq -c --arg sha "$sha" --argjson ci "${ci:-null}" --argjson changed "$(app_changed "$prev" "$sha")" \
      '. + [{sha: $sha, ci: $ci, app_changed: $changed}]' <<<"$candidates")"
    [[ $EVENT == workflow_dispatch ]] && break
    [[ $(jq -r '"\(.status)/\(.conclusion)"' <<<"${ci:-null}") == completed/success ]] && break
  done
  if [[ -n $prev && $trigger != "$prev" ]] && git merge-base --is-ancestor "$trigger" "$prev" 2>/dev/null; then
    trigger_shipped=true
  fi
  if [[ -n ${TESTFLIGHT_JSON:-} && -s $TESTFLIGHT_JSON ]]; then testflight="$(cat "$TESTFLIGHT_JSON")"; fi
  jq -n --arg event "$EVENT" --argjson force "$FORCE" --argjson upload "$UPLOAD" \
    --arg main_sha "$MAIN_SHA" --arg trigger_sha "$trigger" --argjson trigger_shipped "$trigger_shipped" \
    --argjson build_number "$BUILD_NUMBER" --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --argjson candidates "$candidates" --argjson last_upload "$last" --argjson testflight "$testflight" \
    '$ARGS.named'
}

# A dispatch ships main's tip and only if its CI is green. Every other run (after a green CI on
# main, or the weekly catch-up) ships the newest green commit since the last upload: newer
# commits whose CI still runs get their own run, red ones never ship. So when CI finishes out
# of order, or a newer run replaced a pending one in the concurrency queue, the newest green
# commit still ships, and an older commit never follows a newer one.
# TestFlight builds expire after 90 days, so an unchanged main still ships after 60.
decide() {
  jq -r '
    def days_since($t): (((.now | fromdateiso8601) - ($t | fromdateiso8601)) / 86400 | floor);
    def short: .[0:7];
    def green: .ci != null and .ci.status == "completed" and .ci.conclusion == "success";
    . as $f
    | (.last_upload.sha // null) as $last
    | (if .event == "workflow_dispatch" then
         (.candidates[0] // null) as $c
         | if $c == null then {target: $last}
           elif $c.ci == null or $c.ci.status != "completed" then
             {stop: {ship: false, blocked: true, reason: "CI has not finished on \($c.sha | short), so main is not known to be green"}}
           elif $c.ci.conclusion != "success" then
             {stop: {ship: false, blocked: true, reason: "CI concluded \($c.ci.conclusion) on \($c.sha | short) (\($c.ci.url)); only green main ships"}}
           else {target: $c.sha, changed: $c.app_changed} end
       else
         ([.candidates[] | select(green)] | first) as $c
         | [.candidates[] | select(green | not) | "\(.sha | short) (\(.ci.conclusion // .ci.status // "no CI run"))"] as $newer
         | {target: ($c.sha // $last), changed: ($c.app_changed // false),
            note: ((if ($newer | length) > 0 then "; not green yet or red, so not shipped: \($newer | join(", "))" else "" end)
              )}
       end) as $p
    | ($p.note // "") as $n
    | ($p | .note = $n + (if $f.trigger_shipped then "; \($f.trigger_sha | short), which started this run, is older than the last upload" else "" end)) as $p
    | ($p.note // "") as $note
    | if $p.stop then $p.stop
      elif $p.target == null then {ship: false, blocked: false, reason: "no green commit on main to ship yet\($note)"}
      elif .testflight != null and .build_number <= .testflight.max_build then
        {error: "Build number \(.build_number) is not above TestFlight'"'"'s highest build \(.testflight.max_build); raise BUILD_NUMBER_OFFSET in release.yml (docs/RELEASE.md)"}
      elif .upload | not then {ship: true, reason: "dry run: build, sign and validate \($p.target | short) without uploading"}
      elif .force then {ship: true, reason: "forced (\($p.target | short))"}
      elif $last == null then {ship: true, reason: "no earlier upload run (\($p.target | short))\($note)"}
      elif $p.target != $last and $p.changed then
        {ship: true, reason: "main moved since the last upload (\($last | short) -> \($p.target | short))\($note)"}
      elif .testflight != null and (.testflight.installable | not) then
        {ship: true, reason: "TestFlight has no installable build (expired), so \($p.target | short) ships again"}
      elif ($f | days_since($f.last_upload.created_at)) >= 60 then
        {ship: true, reason: "the last upload is \($f | days_since($f.last_upload.created_at)) days old (TestFlight expires builds after 90), so \($p.target | short) ships again"}
      elif $p.target != $last then
        {ship: false, current: true, reason: "nothing under \("app/ or release.yml") changed since the last upload (\($last | short) -> \($p.target | short)), so the testers already have this app (\(.last_upload.url))\($note)"}
      elif (.candidates | length) > 0 then
        {ship: false, current: true, reason: "no green commit on main is newer than the last upload (\($last | short), \(.last_upload.url))\($note)"}
      else
        {ship: false, current: true, reason: "main is unchanged since the last upload (\($last | short), \(.last_upload.url))\($note)"}
      end
    | if .error then "error=\(.error)"
      else "ship=\(.ship)\nblocked=\(.blocked // false)\ncurrent=\(.current // false)\nreason=\(.reason)\nsha=\($p.target // "")\nprevious_sha=\($last // "")" end
  ' "$1" | {
    out="$(cat)"
    if [[ $out == error=* ]]; then
      echo "::error::${out#error=}"
      exit 1
    fi
    printf '%s\n' "$out"
  }
}

ships_app() {
  local path app
  while IFS= read -r path; do
    for app in "${app_paths[@]}"; do
      if [[ $path == "$app" || $path == "$app"/* ]]; then
        echo true
        return
      fi
    done
  done
  echo false
}

case "${1:-}" in
  gather) gather ;;
  decide) decide "$2" ;;
  ships-app) ships_app ;;
  *) echo "usage: $0 gather | decide <facts.json> | ships-app <paths" >&2; exit 2 ;;
esac
