#!/usr/bin/env bash
# Keeps one open issue "Weekly release failed" in step with the Release runs, like backup.yml.
#   report.sh decide   prints open, close or none (pure, from the environment below)
#   report.sh apply    does it with gh
# EVENT, SIMULATE (true/false), UPLOAD (plan output; empty when plan failed), BLOCKED and REASON
# (plan outputs), PLAN, IOS, ANDROID, UPLOADED, WEB (the jobs' results: success, failure, cancelled,
# skipped), ANDROID_UPLOADED (the android job's uploaded output), plus GITHUB_* for links.
# Scheduled runs, and dispatches with simulate_failure, report failures; a run that uploaded, or
# found main unchanged since the last upload, closes the issue. A dry run (upload=false) never
# touches it.
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

# What this run delivered, from each job's own result, so it holds for any mix of failures.
outcome() {
  if [[ ${UPLOAD:-} == false ]]; then
    echo "This was a dry run: nothing was uploaded and app.hummlist.com did not move."
    return
  fi
  local stores=() web
  case "${IOS:-}" in
    success) stores+=("TestFlight got this build") ;;
    failure | cancelled) stores+=("the iOS job stopped, so TestFlight may not have this build") ;;
  esac
  if [[ ${ANDROID_UPLOADED:-} == true ]]; then
    stores+=("Play internal got this build")
  else
    case "${ANDROID:-}" in
      success) stores+=("no Play upload (the Android job says why)") ;;
      failure | cancelled) stores+=("the Android job stopped, so Play internal may not have this build") ;;
    esac
  fi
  if [[ ${UPLOADED:-} != success ]]; then
    web="The web app (app.hummlist.com) stays on the last store release."
  elif [[ ${WEB:-} == success ]]; then
    web="The web app (app.hummlist.com) moves to this commit."
  elif [[ ${WEB:-} == cancelled ]]; then
    # A cancel can land after the push, so this run cannot tell.
    web="The web app (app.hummlist.com) may not have moved to this commit"
    web+=" (check the release branch, docs/DEPLOY.md, section Web app)."
  else
    web="The web app (app.hummlist.com) was not moved to this commit (release branch, docs/DEPLOY.md, section Web app)."
  fi
  if [[ ${#stores[@]} -eq 0 ]]; then
    echo "Nothing new reached TestFlight or the Play internal track from this run. $web"
  else
    local IFS=';' joined
    joined="${stores[*]}"
    joined="${joined//;/; }"
    echo "${joined^}. $web"
  fi
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
      local body failed
      failed="$(failing)"
      body="Release run $run ($EVENT) on ${GITHUB_SHA:0:7} failed: ${failed//;/; }. $(outcome) docs/RELEASE.md, section Failures, says what to do; the next green upload run closes this issue."
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
