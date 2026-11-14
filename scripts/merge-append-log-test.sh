#!/usr/bin/env bash
# Tests the merge driver of the append-only logs as git runs it: the command push-pr.sh's rebase
# (rebase_onto_main, scripts/lib.sh) stores, on three files, and through a real rebase and merge in
# a scratch repository with this checkout's .gitattributes and scripts/merge-append-log.sh. A file
# without the attribute, and the log itself before the driver is installed, must stop the rebase,
# or the test proves nothing. Run by the lint gate.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
failures=0
fail() { echo "FAIL: $*" >&2; failures=$((failures + 1)); }

repo="$tmp/repo"
git init -q -b main "$repo"
cd "$repo"
git config user.name t && git config user.email t@t
mkdir -p docs scripts
cp "$REPO_ROOT/.gitattributes" .
cp "$REPO_ROOT/scripts/merge-append-log.sh" scripts/
log_start=$'# Decisions\n\n## Job 1: first\n\n1. One.\n'
job2=$'\n## Job 2: second\n\n1. Two.\n'
job3=$'\n## Job 3: third\n\n1. Three.\n'
printf '%s' "$log_start" >docs/DECISIONS.md
printf '%s' "$log_start" >docs/other.md
git add -A && git commit -q -m base
append() { # <branch> <section>
  git checkout -q "$1"
  printf '%s' "$2" >>docs/DECISIONS.md
  printf '%s' "$2" >>docs/other.md
  git commit -q -am "$1"
}
git branch pr
append main "$job2"
append pr "$job3"

if git rebase -q main >/dev/null 2>&1; then
  fail "the rebase did not stop without the driver in the config: the test would prove nothing"
fi
git rebase --abort

# push-pr.sh's rebase, from a subdirectory: it stores the command, also over an older one, and git
# runs it from the top of the working tree.
git update-ref refs/remotes/origin/main main
git config merge.append-log.driver false
if (cd docs && TMPDIR="$tmp" rebase_onto_main >/dev/null 2>&1); then
  fail "docs/other.md has no merge attribute and must stop the rebase"
fi
[[ "$(git diff --name-only --diff-filter=U)" == docs/other.md ]] ||
  fail "conflicted after the rebase: $(git diff --name-only --diff-filter=U | tr '\n' ' '), want only docs/other.md"
[[ "$(<docs/DECISIONS.md)" == "$(printf '%s' "$log_start$job2$job3")" ]] ||
  fail "docs/DECISIONS.md after the rebase:"$'\n'"$(<docs/DECISIONS.md)"
git rebase --abort
command="$(git config --get merge.append-log.driver)"

for log in docs/DECISIONS.md docs/NEEDS_LEAD.md docs/NEEDS_PETER.md DONE_SUMMARY.md \
  docs/hillclimb/fable-improvement-2026-11.md; do
  [[ "$(git check-attr merge -- "$log")" == "$log: merge: append-log" ]] || fail "$log has no driver"
done
[[ "$(git check-attr merge -- docs/design/x/DONE_SUMMARY.md)" == *": unspecified" ]] ||
  fail "only the DONE_SUMMARY.md at the top is a log"

# run_command <directory>: the stored command on $tmp/{base,ours,theirs}, as git runs it there.
run_command() {
  local filled="${command//%O/$tmp/base}"
  filled="${filled//%A/$tmp/ours}"
  filled="${filled//%B/$tmp/theirs}"
  (cd "$1" && sh -c "$filled")
}
# driven <directory> <base> <ours> <theirs>
driven() {
  printf '%s' "$2" >"$tmp/base"
  printf '%s' "$3" >"$tmp/ours"
  printf '%s' "$4" >"$tmp/theirs"
  run_command "$1"
}
# merged <why> <want: kept|stops> <base> <ours> <theirs> [<result when kept>]
merged() {
  local why="$1" want="$2" code=0
  driven "$repo" "$3" "$4" "$5" || code=$?
  if [[ $want == kept ]]; then
    [[ $code == 0 ]] || fail "$why: exit $code, want 0"
    printf '%s' "$6" | cmp -s - "$tmp/ours" || fail "$why: got"$'\n'"$(<"$tmp/ours")"
  else
    [[ $code == 1 ]] || fail "$why: exit $code, want 1"
    grep -q '^<<<<<<< ours$' "$tmp/ours" || fail "$why: no conflict markers left in the file"
    grep -q '^>>>>>>> theirs$' "$tmp/ours" || fail "$why: the conflict does not end with theirs"
    ! grep -q '^||||||| ' "$tmp/ours" || fail "$why: the conflict shows the base, which git's does not"
    printf '%s' "$3" >"$tmp/git-base"
    printf '%s' "$4" >"$tmp/git-ours"
    printf '%s' "$5" >"$tmp/git-theirs"
    git merge-file -q -L ours -L base -L theirs "$tmp/git-ours" "$tmp/git-base" "$tmp/git-theirs" || true
    cmp -s "$tmp/git-ours" "$tmp/ours" || fail "$why: the file is not git's merge of the three"
  fi
}

fix1=$'\n### Fix round 1\n\n2. Fix.\n'
merged "two sections added at the end both stay, ours first, blank lines kept" kept \
  "$log_start" "$log_start$job2" "$log_start$job3" "$log_start$job2$job3"
merged "two single lines added at the end both stay" kept \
  $'- Job 1\n' $'- Job 1\n- Job 2\n' $'- Job 1\n- Job 3\n' $'- Job 1\n- Job 2\n- Job 3\n'
merged "two sections added at the same place in the middle both stay" kept \
  $'# Log\n\n## End\n' $'# Log\n\n## Job 2\n\n## End\n' $'# Log\n\n## Job 3\n\n## End\n' \
  $'# Log\n\n## Job 2\n\n## Job 3\n\n## End\n'
merged "two places with two sections each: all four stay" kept \
  $'# A\n\ntext\n\n# B\n\ntext\n' $'# A\n\n## A2\n\ntext\n\n# B\n\ntext\n\n## B2\n' \
  $'# A\n\n## A3\n\ntext\n\n# B\n\ntext\n\n## B3\n' \
  $'# A\n\n## A2\n\n## A3\n\ntext\n\n# B\n\ntext\n\n## B2\n\n## B3\n'
merged "a merge that is clean without the driver is that merge" kept \
  "$log_start" "$log_start$job2" "${log_start/Decisions/Calls}" "${log_start/Decisions/Calls}$job2"
merged "a clean merge of a file without a final newline gains none" kept \
  $'A\nb\nc\nd\ne\nf\ng\nlast' $'A2\nb\nc\nd\ne\nf\ng\nlast' $'A\nb\nc\nd\ne\nf\nG\nlast' \
  $'A2\nb\nc\nd\ne\nf\nG\nlast'
merged "two sections in a file without a final newline stop" stops \
  $'# Log\n\n## End' $'# Log\n\n## Job 2\n\n## End' $'# Log\n\n## Job 3\n\n## End'
merged "theirs' last line without a newline gets one" kept \
  $'- Job 1\n' $'- Job 1\n- Job 2\n' $'- Job 1\n- Job 3' $'- Job 1\n- Job 2\n- Job 3\n'
merged "ours' last line without a newline gets one" kept \
  $'- Job 1\n' $'- Job 1\n- Job 2' $'- Job 1\n- Job 3\n' $'- Job 1\n- Job 2\n- Job 3\n'
merged "lines that look like conflict markers stay" kept \
  $'Log\n=======\n- Job 1\n' $'Log\n=======\n- Job 1\n<<<<<<<< ours\n' \
  $'Log\n=======\n- Job 1\n>>>>>>>> theirs\n' $'Log\n=======\n- Job 1\n<<<<<<<< ours\n>>>>>>>> theirs\n'
merged "a table row and a quote in a quote stay" kept \
  $'- Job 1\n' $'- Job 1\n| a | b |\n' $'- Job 1\n>> quoted\n' $'- Job 1\n| a | b |\n>> quoted\n'
merged "an older line that starts with << stays" kept \
  $'<< back\n- Job 1\n' $'<< back\n- Job 1\n| a | b |\n' $'<< back\n- Job 1\n> quoted\n' \
  $'<< back\n- Job 1\n| a | b |\n> quoted\n'
merged "a line of ours that starts with || stays" kept \
  $'- Job 1\n' $'- Job 1\n|| or\n' $'- Job 1\n> quoted\n' $'- Job 1\n|| or\n> quoted\n'
merged "marker characters inside a line stay" kept \
  $'a << b\n- Job 1\n' $'a << b\n- Job 1\n| a | b |\na || b\n' $'a << b\n- Job 1\na >> b\n' \
  $'a << b\n- Job 1\n| a | b |\na || b\na >> b\n'
merged "an edited line of = signs, one longer than any other run, is not taken for a marker" stops \
  $'Title\n========\nZ\nend\n' $'Title\nours\nZ\nend\n=======\n' $'Title\ntheirs\nZ\nend\n'
merged "an edit of the same line on both sides stops" stops \
  "$log_start" "${log_start/One/Uno}" "${log_start/One/Eins}"
merged "an edit of the last line next to an added section stops" stops \
  "$log_start" "$log_start$job2" "${log_start/One/Eins}"
merged "an edited line of seven = signs is not taken for a conflict marker" stops \
  $'Title\n=======\nold\nZ\n' $'Title\nours\nZ\n' $'Title\ntheirs\nZ\n'
merged "both sides created the file: stops" stops "" "$log_start" "${log_start/Decisions/Calls}"
merged "the same section added twice with different text stops" stops \
  "$log_start" "$log_start$job2" "$log_start${job2/Two/Zwei}"
merged "the same subsection added twice with different text stops" stops \
  "$log_start" "$log_start$fix1" "$log_start${fix1/Fix./Other.}"
merged "a section ours already holds further down stops" stops \
  "$log_start" "$log_start$job3$job2" "$log_start$job2"
merged "a section of ours that theirs holds further down stops" stops \
  "$log_start" "$log_start$job2" "$log_start$job3$job2"
merged "a section both hold after different first sections stops" stops \
  "$log_start" "$log_start$fix1$job2" "$log_start$job3$job2"
merged "a line ours already holds further down stops" stops \
  $'- Job 1\n' $'- Job 1\n- Job 3\n- Job 2\n' $'- Job 1\n- Job 2\n'
merged "a line of ours that theirs holds further down stops" stops \
  $'- Job 1\n' $'- Job 1\n- Job 2\n' $'- Job 1\n- Job 3\n- Job 2\n'
merged "two sections may hold the same subheading and the same lines" kept \
  "$log_start" "$log_start$job2"$'\n### Cost\n\nNone.\n' "$log_start$job3"$'\n### Cost\n\nNone.\n' \
  "$log_start$job2"$'\n### Cost\n\nNone.\n'"$job3"$'\n### Cost\n\nNone.\n'
merged "a paragraph for an older section stops when ours added a section" stops \
  "$log_start" "$log_start$job2" "$log_start"$'2. Fix 1.\n'
merged "a subsection for an older section stops when ours added a section" stops \
  "$log_start" "$log_start$job2" "$log_start$fix1"
merged "a paragraph for an older section stops when ours added a subsection" stops \
  "$log_start" "$log_start$fix1" "$log_start"$'2. Fix 1.\n'
merged "a paragraph stops after a heading of six # of ours" stops \
  "$log_start" "$log_start"$'\n###### Deep\n' "$log_start"$'2. Fix 1.\n'
merged "a first line of blanks is not where theirs starts" kept \
  "$log_start" "$log_start$job2" "$log_start"$' \t\n## Job 3: third\n' \
  "$log_start$job2"$' \t\n## Job 3: third\n'
merged "the same top heading added twice stops" stops \
  $'- Job 1\n' $'- Job 1\n# Top\nours\n' $'- Job 1\n# Top\ntheirs\n'
merged "a section stays after ours' subsection for the older section" kept \
  "$log_start" "$log_start$fix1" "$log_start$job3" "$log_start$fix1$job3"
fix2=$'\n### Fix round 2\n\n3. Fix.\n'
merged "ours' highest heading counts, not its last" stops \
  "$log_start" "$log_start$job2"$'\n### Cost\n\nNone.\n' "$log_start$fix2"
merged "ours' highest heading counts, not its first" stops \
  "$log_start" "$log_start$fix1$job2" "$log_start$fix2"
merged "a line that starts with a PR number is no heading" kept \
  $'It was\n' $'It was\n#386 and others.\n' $'It was\nnot only that.\n' \
  $'It was\n#386 and others.\nnot only that.\n'
merged "a comment in ours' fenced code counts as a heading: stops" stops \
  "$log_start" "$log_start"$'\n### Fix round 1\n\n```bash\n# a comment\n```\n' "$log_start$fix2"
merged "eight # are text, not a heading below every heading" kept \
  $'- Job 1\n' $'- Job 1\n- Job 2\n' $'- Job 1\n######## Job 3\n' $'- Job 1\n- Job 2\n######## Job 3\n'
merged "one place stopping stops the whole file" stops \
  $'top\nmiddle\nend\n' $'TOP\nmiddle\nend\n## Job 2\n' $'Top\nmiddle\nend\n## Job 3\n'
merged "the second place stopping stops the whole file" stops \
  $'# A\n\ntext\n\n# B\n\ntext\n' $'# A\n\n## A2\n\ntext\n\n# B\n\ntext\n\n## B2\n' \
  $'# A\n\n## A3\n\ntext\n\n# B\n\ntext\nmore\n'
merged "a line of ours at one place may be theirs at another" kept \
  $'# A\n\ntext\n\n# B\n\ntext\n' $'# A\n\ntext\n- None.\n\n# B\n\ntext\n- ours\n' \
  $'# A\n\ntext\n- theirs\n\n# B\n\ntext\n- None.\n' \
  $'# A\n\ntext\n- None.\n- theirs\n\n# B\n\ntext\n- ours\n- None.\n'
merged "a heading at the first place does not count at the second" kept \
  $'# A\n\ntext\n\n# B\n\ntext\n' $'# A\n\n## A2\n\ntext\n\n# B\n\ntext\nours\n' \
  $'# A\n\n## A3\n\ntext\n\n# B\n\ntext\ntheirs\n' $'# A\n\n## A2\n\n## A3\n\ntext\n\n# B\n\ntext\nours\ntheirs\n'

# A file git cannot merge stays ours and conflicts, as without a driver.
printf '%s' "$log_start" >"$tmp/base"
printf '%s' "$log_start$job2" >"$tmp/ours"
printf '%s\n## Job 3 \0\n' "$log_start" >"$tmp/theirs"
code=0
run_command "$repo" 2>/dev/null || code=$?
[[ $code == 1 ]] || fail "a binary file: exit $code, want 1"
[[ "$(<"$tmp/ours")" == "$(printf '%s' "$log_start$job2")" ]] || fail "a binary file: ours changed"

# Where the script is missing, the command merges as git does without a driver.
mkdir "$tmp/empty"
code=0
driven "$tmp/empty" "$log_start" "$log_start$job2" "$log_start$job3" 2>/dev/null || code=$?
[[ $code == 1 ]] || fail "without the script two added sections: exit $code, want 1"
grep -q '^<<<<<<< ours$' "$tmp/ours" || fail "without the script two added sections: no conflict markers"
driven "$tmp/empty" "$log_start" "$log_start$job2" "${log_start/Decisions/Calls}" 2>/dev/null ||
  fail "without the script a clean merge must stay clean"
[[ "$(<"$tmp/ours")" == "$(printf '%s' "${log_start/Decisions/Calls}$job2")" ]] ||
  fail "without the script a clean merge: got"$'\n'"$(<"$tmp/ours")"

# A merge of main into the branch: ours is the branch then, so its section comes first.
git checkout -q pr
git merge -q main >/dev/null 2>&1 && fail "docs/other.md must stop the merge too"
[[ "$(<docs/DECISIONS.md)" == "$(printf '%s' "$log_start$job3$job2")" ]] ||
  fail "docs/DECISIONS.md after the merge:"$'\n'"$(<docs/DECISIONS.md)"
git merge --abort

# A branch stacked on one whose section landed replays that section after main moved on: it must
# stop, with markers, instead of adding the section a second time.
git checkout -q -b stacked pr
printf '%s' $'\n## Job 4: fourth\n\n1. Four.\n' >>docs/DECISIONS.md
git commit -q -am stacked
git checkout -q main
printf '%s' "$job3" >>docs/DECISIONS.md
git commit -q -am "pr, landed as one commit after job 2"
git checkout -q stacked
git rebase -q main >/dev/null 2>&1 && fail "a replayed section that main already holds must stop the rebase"
git diff --name-only --diff-filter=U | grep -qx docs/DECISIONS.md ||
  fail "the replayed section: docs/DECISIONS.md is not conflicted"
grep -q '^<<<<<<< ours$' docs/DECISIONS.md || fail "the replayed section: no conflict markers in the file"

((failures == 0)) || exit 1
echo "merge-append-log-test: ok"
