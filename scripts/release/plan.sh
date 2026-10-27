#!/usr/bin/env bash
# Decides whether a Release run ships (docs/RELEASE.md, "When a run ships").
#   plan.sh gather            facts as JSON on stdout, from the Actions API and ASC (network)
#   plan.sh decide <facts>    ship/reason/blocked as key=value lines for $GITHUB_OUTPUT (pure)
# gather reads EVENT, FORCE, UPLOAD, HEAD_SHA, BUILD_NUMBER, GITHUB_REPOSITORY,
# GH_TOKEN and TESTFLIGHT_JSON (the `ios preflight` lane's output, absent without iOS).
# decide exits 1 with an ::error:: line when the run must fail instead of skipping.
set -euo pipefail

# A run "uploaded" when its Uploaded job succeeded; that job only runs after a real upload.
last_upload() {
  local id ids
  # On its own line, so an API error stops the script instead of reading as "no upload".
  ids="$(gh api "repos/$GITHUB_REPOSITORY/actions/workflows/release.yml/runs?branch=main&status=success&per_page=50" \
    --jq ".workflow_runs[].id")"
  for id in $ids; do
    if gh api "repos/$GITHUB_REPOSITORY/actions/runs/$id/jobs?per_page=100" \
      --jq '.jobs[] | select(.name == "Uploaded" and .conclusion == "success") | .name' | grep -q .; then
      gh api "repos/$GITHUB_REPOSITORY/actions/runs/$id" --jq '{sha: .head_sha, created_at, url: .html_url}'
      return
    fi
  done
  echo null
}

gather() {
  local ci testflight=null
  ci="$(gh api "repos/$GITHUB_REPOSITORY/actions/workflows/ci.yml/runs?head_sha=$HEAD_SHA&event=push&per_page=20" \
    --jq '.workflow_runs | sort_by(.created_at) | last | if . then {status, conclusion, url: .html_url} else null end')"
  if [[ -n ${TESTFLIGHT_JSON:-} && -s $TESTFLIGHT_JSON ]]; then testflight="$(cat "$TESTFLIGHT_JSON")"; fi
  jq -n --arg event "$EVENT" --argjson force "$FORCE" --argjson upload "$UPLOAD" --arg head_sha "$HEAD_SHA" \
    --argjson build_number "$BUILD_NUMBER" --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --argjson ci "${ci:-null}" --argjson last_upload "$(last_upload)" --argjson testflight "$testflight" \
    '$ARGS.named'
}

# TestFlight builds expire after 90 days, so an unchanged main still ships after 60.
decide() {
  jq -r '
    def days_since($t): (((.now | fromdateiso8601) - ($t | fromdateiso8601)) / 86400 | floor);
    def short: .[0:7];
    . as $f
    | if .ci == null or .ci.status != "completed" then
        {ship: false, blocked: true, reason: "CI has not finished on \(.head_sha | short), so main is not known to be green"}
      elif .ci.conclusion != "success" then
        {ship: false, blocked: true, reason: "CI concluded \(.ci.conclusion) on \(.head_sha | short) (\(.ci.url)); only green main ships"}
      elif .testflight != null and .build_number <= .testflight.max_build then
        {error: "Build number \(.build_number) is not above TestFlight'"'"'s highest build \(.testflight.max_build); raise BUILD_NUMBER_OFFSET in release.yml (docs/RELEASE.md)"}
      elif .upload | not then {ship: true, reason: "dry run: build, sign and validate without uploading"}
      elif .force then {ship: true, reason: "forced"}
      elif .last_upload == null then {ship: true, reason: "no earlier upload run"}
      elif .last_upload.sha != .head_sha then
        {ship: true, reason: "main moved since the last upload (\(.last_upload.sha | short) -> \(.head_sha | short))"}
      elif .testflight != null and (.testflight.installable | not) then
        {ship: true, reason: "main is unchanged, but TestFlight has no installable build (expired)"}
      elif ($f | days_since($f.last_upload.created_at)) >= 60 then
        {ship: true, reason: "main is unchanged, but the last upload is \($f | days_since($f.last_upload.created_at)) days old (TestFlight expires builds after 90)"}
      else
        {ship: false, blocked: false, reason: "main is unchanged since the last upload (\(.head_sha | short), \(.last_upload.url))"}
      end
    | if .error then "error=\(.error)"
      else "ship=\(.ship)\nblocked=\(.blocked // false)\nreason=\(.reason)\nprevious_sha=\($f.last_upload.sha // "")" end
  ' "$1" | {
    out="$(cat)"
    if [[ $out == error=* ]]; then
      echo "::error::${out#error=}"
      exit 1
    fi
    printf '%s\n' "$out"
  }
}

case "${1:-}" in
  gather) gather ;;
  decide) decide "$2" ;;
  *) echo "usage: $0 gather | decide <facts.json>" >&2; exit 2 ;;
esac
