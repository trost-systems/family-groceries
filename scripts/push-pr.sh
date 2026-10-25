#!/usr/bin/env bash
# Pushes the current branch to its open PR as the one commit main takes: rebased onto
# origin/main, squashed, subject "<PR title> (#n)", the noreply author and the trailers. The CI
# run on this push is then the one scripts/merge-pr.sh merges on, with no second squash and run.
# Use it for every push once the PR exists, fix rounds included. Before that, push the branch
# once with `git push -u origin HEAD` and open the PR with `gh pr create`.
#
# Usage: scripts/push-pr.sh
#   A rebase conflict stops the script; resolve it, `git rebase --continue`, and rerun.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
cd "$REPO_ROOT"

branch="$(git symbolic-ref --short HEAD)"
if [[ $branch == main ]]; then
  echo "push-pr.sh pushes PR branches only, never main" >&2
  exit 1
fi
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "commit or drop your changes first; push-pr.sh pushes commits only" >&2
  exit 1
fi
read -r pr title < <(gh pr view "$branch" --json number,title,state -q 'select(.state == "OPEN") | "\(.number) \(.title)"') || true
if [[ -z ${pr:-} ]]; then
  echo "$branch has no open PR; push it once (git push -u origin HEAD), run gh pr create, then rerun" >&2
  exit 1
fi
subject="$title (#$pr)"

git fetch -q origin main "$branch"
if [[ "$(git merge-base origin/main HEAD)" != "$(git rev-parse origin/main)" ]]; then
  log "rebasing $branch onto origin/main"
  rebase_onto_main
fi
if [[ "$(git rev-list --count origin/main..HEAD)" == 0 ]]; then
  echo "nothing to push: $branch has no commits on top of origin/main" >&2
  exit 1
fi
if [[ -n "$(landing_problem HEAD "$subject")" ]]; then
  squashed="$(squash_commit HEAD "$subject")"
  git reset -q --soft "$squashed"
  log "squashed $branch into $(git rev-parse --short HEAD): $subject"
fi

remote="$(git rev-parse "origin/$branch")"
if [[ "$(git rev-parse HEAD)" == "$remote" ]]; then
  log "origin/$branch is already $(git rev-parse --short HEAD); nothing to push"
  exit 0
fi
git push -q --force-with-lease="$branch:$remote" origin "HEAD:refs/heads/$branch"
log "pushed $(git rev-parse --short HEAD) to #$pr; once ci-ok passes, scripts/merge-pr.sh $pr merges it"
