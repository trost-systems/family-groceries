#!/usr/bin/env bash
# Job 39: the changelog drafts in releases/changelog/ (valid, store texts current), and the
# `## Changelog` section of the commit main takes (docs/CHANGELOG.md), structure only, never wording. On a pull_request run, ci.yml checks out the merge commit (HEAD^1 the base, HEAD^2
# the PR head): it checks the PR head's message, which scripts/push-pr.sh writes from the PR
# description. A head pushed without push-pr.sh has no section in its message yet; then the PR
# description in the event counts, which merge-pr.sh would land. Without a pull_request event
# (verify.sh) it checks HEAD's message, if that has a section; push-pr.sh checks the description.
set -euo pipefail
source "$(dirname "$0")/../lib.sh"
cd "$REPO_ROOT"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
node scripts/release/changelog.mjs drafts
has_section() { node scripts/release/changelog.mjs check --file "$1" >/dev/null 2>&1 || [[ $? != 3 ]]; }

if [[ ${GITHUB_EVENT_NAME:-} == pull_request ]]; then
  git log -1 --format=%B HEAD^2 >"$tmp/message"
  git diff --name-only HEAD^1 HEAD >"$tmp/changed"
  if ! has_section "$tmp/message"; then
    log "the PR head's message has no ## Changelog section (not pushed with scripts/push-pr.sh); checking the PR description"
    jq -r '.pull_request.body // ""' "$GITHUB_EVENT_PATH" >"$tmp/message"
  fi
else
  git log -1 --format=%B HEAD >"$tmp/message"
  if ! has_section "$tmp/message"; then
    log "HEAD's message has no ## Changelog section; scripts/push-pr.sh checks the PR description when it pushes"
    exit 0
  fi
  git diff --name-only origin/main HEAD >"$tmp/changed"
fi
verdict="$(changelog_verdict "$tmp/message" "$tmp/changed")"
if [[ $verdict == add-none ]]; then
  log "no ## Changelog section, and nothing here ships in an app build: scripts/push-pr.sh adds \"none\""
else
  log "$(node scripts/release/changelog.mjs check --file "$tmp/message")"
fi
