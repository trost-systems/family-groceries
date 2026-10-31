#!/usr/bin/env bash
# Tests push-pr.sh and merge-pr.sh against a scratch remote and a fake gh: the landed message is
# the PR title and description with the co-author trailers (MODEL_CO_AUTHOR optional, Peter's
# last), the description's `## Changelog` section (job 39; "none" added when no app build
# changes), and MERGE_WAIT_MINUTES takes whole minutes only. Run by the lint gate.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
failures=0
fail() { echo "FAIL: $*" >&2; failures=$((failures + 1)); }
expect_eq() {
  if [[ "$2" != "$3" ]]; then fail "$1"$'\n'"--- expected"$'\n'"$3"$'\n'"--- got"$'\n'"$2"; fi
}

git init -q --bare -b main "$tmp/origin.git"
git clone -q "$tmp/origin.git" "$tmp/work" 2>/dev/null
mkdir -p "$tmp/work/scripts/release" "$tmp/work/site" "$tmp/bin" "$tmp/pr"
cp "$REPO_ROOT"/scripts/{lib,push-pr,merge-pr}.sh "$tmp/work/scripts/"
cp "$REPO_ROOT"/scripts/release/{changelog.mjs,plan.sh} "$tmp/work/scripts/release/"
cp "$REPO_ROOT"/site/releases.mjs "$tmp/work/site/"
export GIT_AUTHOR_NAME=dev GIT_AUTHOR_EMAIL=dev@example.com GIT_COMMITTER_NAME=dev GIT_COMMITTER_EMAIL=dev@example.com
cd "$tmp/work"
git commit -q --allow-empty -m init
git push -q origin HEAD:main

# The fake gh answers for one open PR, #7, from files in $tmp/pr; merging fast-forwards main.
cat >"$tmp/bin/gh" <<'GH'
#!/usr/bin/env bash
set -euo pipefail
pr="$FAKE_PR"
branch="$(cat "$pr/branch")"
case "$1 $2" in
  "pr view")
    fields="$(sed -n 's/.*--json \([^ ]*\).*/\1/p' <<<"$*")"
    case "$fields" in
      number,title,state) echo "7 $(cat "$pr/title")" ;;
      headRefName) echo "$branch" ;;
      headRefOid) git --git-dir="$FAKE_REMOTE" rev-parse "refs/heads/$branch" ;;
      title) cat "$pr/title" ;;
      body) cat "$pr/body" ;;
      *) echo "fake gh: no answer for $*" >&2; exit 1 ;;
    esac ;;
  "pr checks") cat "$pr/ci" ;;
  "pr edit")
    cp "${*: -1}" "$pr/body"
    echo edited >>"$pr/edited" ;;
  "pr merge")
    head="${*: -1}"
    git --git-dir="$FAKE_REMOTE" update-ref refs/heads/main "$head"
    echo "merged $head" >>"$pr/merged" ;;
  *) echo "fake gh: no answer for $*" >&2; exit 1 ;;
esac
GH
chmod +x "$tmp/bin/gh"
export PATH="$tmp/bin:$PATH" FAKE_PR="$tmp/pr" FAKE_REMOTE="$tmp/origin.git"
unset MODEL_CO_AUTHOR MERGE_WAIT_MINUTES

# A branch whose commits carry working-commit leftovers and co-author lines, and a PR
# description as the GitHub API returns it (CRLF line ends).
open_pr() {
  git checkout -q -B "$1" origin/main
  echo "$1" >"$tmp/pr/branch"
  echo "Make lists faster" >"$tmp/pr/title"
  printf 'Lists load in one query.\r\n\r\n## Tests\r\n- list.spec.ts\r\n\r\nCo-authored-by: Bob <bob@example.com>\r\n' >"$tmp/pr/body"
  echo pending >"$tmp/pr/ci"
  echo a >a && git add a && git commit -q -m "wip" -m "Co-authored-by: Alice <alice@example.com>"
  echo b >b && git add b && git commit -q -m "done: PR number" -m "$(printf 'changelog line\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nCo-authored-by: Alice <alice@example.com>')"
  git push -q -u origin HEAD 2>/dev/null
}
body_of() { git --git-dir="$tmp/origin.git" log -1 --format=%B "refs/heads/$1"; }

open_pr p1
scripts/push-pr.sh >/dev/null
expect_eq "push-pr.sh lands the PR description, not the commit messages" "$(body_of p1)" "Make lists faster (#7)

Lists load in one query.

## Tests
- list.spec.ts

## Changelog
none

Co-authored-by: Bob <bob@example.com>
Co-authored-by: Alice <alice@example.com>
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Co-authored-by: Peter Trost <peter@petertrost.com>"
expect_eq "push-pr.sh pushes one commit by the noreply author" \
  "$(git --git-dir="$tmp/origin.git" log --format=%ae refs/heads/main..refs/heads/p1)" "$AUTHOR_EMAIL"

out="$(scripts/push-pr.sh 2>&1)"
[[ $out == *"nothing to push"* ]] || fail "a second push-pr.sh run was not a no-op: $out"
printf 'Lists load in one query, now cached.\r\n' >"$tmp/pr/body"
scripts/push-pr.sh >/dev/null
expect_eq "push-pr.sh after a description edit lands the new description" "$(body_of p1 | sed -n 3p)" \
  "Lists load in one query, now cached."

open_pr p2
MODEL_CO_AUTHOR="Claude Fable 5.1 <noreply@anthropic.com>" scripts/push-pr.sh >/dev/null
expect_eq "MODEL_CO_AUTHOR joins the trailers ahead of Peter's" "$(body_of p2 | sed '/^$/d' | tail -n 2)" \
  "Co-authored-by: Claude Fable 5.1 <noreply@anthropic.com>
Co-authored-by: Peter Trost <peter@petertrost.com>"

open_pr p3
MODEL_CO_AUTHOR="claude opus 5.5 <noreply@anthropic.com>" scripts/push-pr.sh >/dev/null
expect_eq "a MODEL_CO_AUTHOR a commit already names appears once" \
  "$(body_of p3 | grep -ic 'claude opus 5.5')" 1

open_pr p4
printf '' >"$tmp/pr/body"
scripts/push-pr.sh >/dev/null
expect_eq "an empty description leaves subject, the added changelog and trailers" "$(body_of p4)" "Make lists faster (#7)

## Changelog
none

Co-authored-by: Alice <alice@example.com>
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Co-authored-by: Peter Trost <peter@petertrost.com>"

open_pr p5
before="$(git rev-parse HEAD)"
if MODEL_CO_AUTHOR="Claude" scripts/push-pr.sh >/dev/null 2>"$tmp/err"; then
  fail "push-pr.sh accepted MODEL_CO_AUTHOR=Claude"
fi
grep -q "MODEL_CO_AUTHOR must look like 'Name <email>'" "$tmp/err" || fail "no MODEL_CO_AUTHOR error: $(cat "$tmp/err")"
expect_eq "a bad MODEL_CO_AUTHOR pushes nothing" "$(git --git-dir="$tmp/origin.git" rev-parse refs/heads/p5)" "$before"

# Job 39: the changelog section. p1 above had none and only non-app files: "none" was added.
expect_eq "push-pr.sh adds none once, also after a description edit" "$(body_of p1 | grep -c '^## Changelog$')" 1
app_pr() {
  open_pr "$1"
  mkdir -p app && echo x >app/main.dart && git add app && git commit -q -m "app change"
  printf '%s' "$2" >"$tmp/pr/body"
  rm -f "$tmp/pr/edited"
}
expect_refused() {
  local before
  before="$(git --git-dir="$tmp/origin.git" rev-parse "refs/heads/$(git symbolic-ref --short HEAD)")"
  if scripts/push-pr.sh >/dev/null 2>"$tmp/err"; then fail "$1: push-pr.sh pushed"; fi
  grep -qF -- "$2" "$tmp/err" || fail "$1: expected '$2' in: $(cat "$tmp/err")"
  grep -qF -- "en: Add items by voice with Alexa." "$tmp/err" || fail "$1: no format example in: $(cat "$tmp/err")"
  expect_eq "$1: nothing pushed" "$(git --git-dir="$tmp/origin.git" rev-parse "refs/heads/$(git symbolic-ref --short HEAD)")" "$before"
  [[ ! -e $tmp/pr/edited ]] || fail "$1: the PR description was edited"
}
app_pr c1 $'Adds a screen.\r\n'
expect_refused "an app change without a section" "this PR changes the app or its backend: add a ## Changelog section"
open_pr c1b
mkdir -p supabase/functions/alexa && echo x >supabase/functions/alexa/index.ts && git add supabase && git commit -q -m "alexa"
printf 'Alexa learns a word.\n' >"$tmp/pr/body"
rm -f "$tmp/pr/edited"
expect_refused "a backend change without a section" "this PR changes the app or its backend"
app_pr c2 $'Adds a screen.\n\n## Changelog\nnew\nde: Ein neuer Bildschirm.\n'
expect_refused "an item without en:" 'invalid: new item "Ein neuer Bildschirm." has no "en:" line'
app_pr c3 $'Adds a screen.\n\n## Changelog\nnone\n\nfixed\nde: A.\nen: B.\n'
expect_refused "none with items" '"none" and items in one section'
app_pr dependabot/npm/x $'Bumps x.\n'
scripts/push-pr.sh >/dev/null 2>&1 || fail "a Dependabot PR without a section was refused"
expect_eq "a Dependabot PR gets none" "$(body_of dependabot/npm/x | sed -n '3,6p')" "Bumps x.

## Changelog
none"
app_pr c4 $'Adds a screen.\n\n## Changelog\nnew\nde: Ein neuer Bildschirm.\nen: A new screen.\n'
scripts/push-pr.sh >/dev/null
expect_eq "a valid section lands unchanged" "$(body_of c4 | sed -n '3,8p')" "Adds a screen.

## Changelog
new
de: Ein neuer Bildschirm.
en: A new screen."
[[ ! -e $tmp/pr/edited ]] || fail "a valid section: the PR description was edited"

open_pr p6
scripts/merge-pr.sh 7 >/dev/null 2>&1 && status=0 || status=$?
expect_eq "merge-pr.sh squashes a two-commit PR and exits 2" "$status" 2
expect_eq "merge-pr.sh squashes to the PR description too" "$(body_of p6 | sed -n 3p)" "Lists load in one query."

for minutes in 0.5 abc -1 "1 2"; do
  out="$(MERGE_WAIT_MINUTES="$minutes" scripts/merge-pr.sh --wait 7 2>&1)" && status=0 || status=$?
  expect_eq "MERGE_WAIT_MINUTES='$minutes' exits 2" "$status" 2
  [[ $out == *"MERGE_WAIT_MINUTES must be a whole number of minutes (like 30), not '$minutes'"* ]] \
    || fail "MERGE_WAIT_MINUTES='$minutes' gave: $out"
  [[ $out != *"syntax error"* ]] || fail "MERGE_WAIT_MINUTES='$minutes' hit bash arithmetic: $out"
done
if out="$(MERGE_WAIT_MINUTES=0 scripts/merge-pr.sh --wait 7 2>&1)"; then fail "merged with ci-ok pending"; fi
[[ $out == *"after 0 min; not merging"* ]] || fail "MERGE_WAIT_MINUTES=0 gave: $out"
echo pass >"$tmp/pr/ci"
cp "$tmp/pr/body" "$tmp/pr/body.pushed"
printf 'Edited after the push.\r\n' >"$tmp/pr/body"
out="$(scripts/merge-pr.sh --wait 7 2>&1)" && status=0 || status=$?
expect_eq "merge-pr.sh refuses a head whose body is not the current description" "$status" 1
[[ $out == *"the PR description changed since the last push; run scripts/push-pr.sh"* ]] || fail "edited description gave: $out"
[[ ! -e $tmp/pr/merged ]] || fail "merge-pr.sh merged a stale description"
mv "$tmp/pr/body.pushed" "$tmp/pr/body"
out="$(MERGE_WAIT_MINUTES=08 scripts/merge-pr.sh --wait 7 2>&1)" || fail "MERGE_WAIT_MINUTES=08 did not merge: $out"
expect_eq "MERGE_WAIT_MINUTES=08 merges once ci-ok passes" "$(cat "$tmp/pr/merged" 2>/dev/null)" \
  "merged $(git --git-dir="$tmp/origin.git" rev-parse refs/heads/p6)"

if [[ $failures -gt 0 ]]; then
  echo "landing-test: $failures failed" >&2
  exit 1
fi
log "push-pr.sh and merge-pr.sh: all cases pass"
