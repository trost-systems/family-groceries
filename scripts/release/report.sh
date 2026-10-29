#!/usr/bin/env bash
# Keeps one open issue "Weekly release failed" in step with the Release runs, like backup.yml.
#   report.sh decide   prints open, close or none (pure, from the environment below)
#   report.sh apply    does it with gh
# EVENT, SIMULATE (true/false), UPLOAD (plan output; empty when plan failed), BLOCKED and REASON
# (plan outputs), PLAN, IOS, ANDROID, UPLOADED, WEB (the jobs' results: success, failure, cancelled,
# skipped), plus GITHUB_* for links. Scheduled runs, and dispatches with simulate_failure,
# report failures; a run that uploaded, or found main unchanged since the last upload, closes
# the issue. A dry run (upload=false) never touches it.
set -euo pipefail
title='Weekly release failed'

failing() {
  local pair list=()
  for pair in "plan=${PLAN:-}" "ios=${IOS:-}" "android=${ANDROID:-}" "web=${WEB:-}"; do
    case "${pair#*=}" in failure | cancelled) list+=("${pair%%=*} (${pair#*=})") ;; esac
  done
  [[ ${BLOCKED:-} == true ]] && list+=("main is not green: ${REASON:-}")
  local IFS=';'
  echo "${list[*]}"
}

decide() {
  local failed
  failed="$(failing)"
  if [[ -n $failed ]]; then
    if [[ $EVENT == schedule || ${SIMULATE:-false} == true ]]; then echo open; else echo none; fi
  elif [[ ${UPLOAD:-} == true && ($UPLOADED == success || ${REASON:-} == "main is unchanged since"*) ]]; then
    echo close
  else
    echo none
  fi
}

apply() {
  local action run open n
  action="$(decide)"
  run="$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID"
  open="$(gh issue list --repo "$GITHUB_REPOSITORY" --state open --limit 500 --json number,title \
    --jq "map(select(.title == \"$title\")) | .[].number")"
  case "$action" in
    open)
      local body failed outcome
      failed="$(failing)"
      if [[ $failed == "web ("* ]]; then
        outcome="The store upload went through, but app.hummlist.com was not moved to this commit (release branch, docs/DEPLOY.md, section Web app)."
      else
        outcome="Nothing new reached TestFlight or the Play internal track from this run."
      fi
      body="Release run $run ($EVENT) on ${GITHUB_SHA:0:7} failed: ${failed//;/; }. $outcome docs/RELEASE.md, section Failures, says what to do; the next green upload run closes this issue."
      if [[ -n $open ]]; then
        gh issue comment "${open%%$'\n'*}" --repo "$GITHUB_REPOSITORY" --body "$body"
      else
        gh issue create --repo "$GITHUB_REPOSITORY" --title "$title" --body "$body"
      fi ;;
    close)
      for n in $open; do
        gh issue close "$n" --repo "$GITHUB_REPOSITORY" --comment "Release run $run is green again (${REASON:-uploaded})."
      done ;;
    none) ;;
  esac
  echo "report: $action"
}

case "${1:-}" in
  decide) decide ;;
  apply) apply ;;
  *) echo "usage: $0 decide | apply" >&2; exit 2 ;;
esac
