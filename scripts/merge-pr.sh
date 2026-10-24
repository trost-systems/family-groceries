#!/usr/bin/env bash
# Lands a PR on main as one commit authored with the required noreply email.
# GitHub's squash merge authors the commit with the account's default email
# and rejects the noreply address as --author-email, so the squash happens
# locally and the single commit is rebase-merged, which keeps its author.
#
# Usage: scripts/merge-pr.sh [--wait] [--dry-run] <pr-number>
#   Pushed with scripts/push-pr.sh, the PR head is already that one commit: this checks ci-ok
#   on it and rebase-merges it (with --wait, it first waits for ci-ok to finish).
#   Otherwise (pushed with plain git push), it squashes the PR, force-pushes the PR branch and
#   exits 2: wait for ci-ok on the new head, then rerun. That costs a second CI run.
#   If main moved since the push, the head is no longer on top of main: rerun
#   scripts/push-pr.sh (one rebase, one push, one CI run), then this.
#   --dry-run checks everything and stops before the merge.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

wait=0 dry_run=0
while [[ ${1:-} == --* ]]; do
  case "$1" in
    --wait) wait=1 ;;
    --dry-run) dry_run=1 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done
PR="${1:?usage: scripts/merge-pr.sh [--wait] [--dry-run] <pr-number>}"

cd "$REPO_ROOT"
branch="$(gh pr view "$PR" --json headRefName -q .headRefName)"
head="$(gh pr view "$PR" --json headRefOid -q .headRefOid)"
title="$(gh pr view "$PR" --json title -q .title)"
subject="$title (#$PR)"
git fetch -q origin main "$branch"

if [[ "$(git merge-base origin/main "$head")" != "$(git rev-parse origin/main)" ]]; then
  echo "$branch is behind main; run scripts/push-pr.sh on it (rebases and squashes), wait for ci-ok, then rerun" >&2
  exit 1
fi
problem="$(landing_problem "$head" "$subject")"
if [[ -n $problem ]]; then
  [[ $dry_run == 1 ]] && { log "dry run: would squash and push because $problem"; exit 2; }
  log "squashing $branch into one commit ($problem): $subject"
  squashed="$(squash_commit "$head" "$subject")"
  git push -q --force-with-lease="$branch:$head" origin "$squashed:refs/heads/$branch"
  log "pushed $squashed; rerun once ci-ok passes on it (scripts/push-pr.sh saves this second CI run)"
  exit 2
fi

# gh pr checks exits 8 while checks are pending; the bucket says the same.
ci_ok() { gh pr checks "$PR" --json name,bucket -q '.[] | select(.name=="ci-ok") | .bucket' || true; }
state="$(ci_ok)"
if [[ $wait == 1 ]]; then
  log "waiting for ci-ok on $head"
  while [[ $state != pass && $state != fail && $state != cancel ]]; do
    sleep 20
    state="$(ci_ok)"
  done
fi
if [[ $state != pass ]]; then
  echo "ci-ok is '${state:-pending or missing}' on $head; not merging" >&2
  exit 1
fi
if [[ $dry_run == 1 ]]; then
  log "dry run: #$PR is $head, one compliant commit on top of main with ci-ok green; would merge it now"
  exit 0
fi
gh pr merge "$PR" --rebase --match-head-commit "$head"
log "merged #$PR as $head ($AUTHOR_EMAIL)"
