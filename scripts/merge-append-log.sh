#!/usr/bin/env bash
# Git merge driver `append-log` for the logs every job appends to (.gitattributes; job 218).
#
# Two jobs that each add a section at the same place, usually the end of docs/DECISIONS.md, are a
# conflict to git and stopped four in ten jobs in a rebase (docs/hillclimb/fable-improvement-2026-11.md,
# job 218). Here both insertions stay, ours first: in a rebase onto main that is main's text, then
# the PR's. What git merges without a conflict stays that merge. Everything else exits 1 and
# leaves the file alone, and the driver's command (install_merge_driver, scripts/lib.sh) then
# merges as git would without a driver, conflict markers included. That is the case when
#   - a side edits or deletes lines, both sides created the file, or the merged file would not
#     end in a newline,
#   - an entry is there twice (a commit replayed after its section landed): a line ours added is
#     also the first line theirs adds, or a later heading of theirs of that level; where theirs
#     starts without a heading, any line of theirs that is none, or
#   - ours adds a heading above the level theirs starts at (`## Job 2` against a paragraph or a
#     `### Fix round`): theirs continues an older section and would end up under ours' new one.
# A heading is a line that starts with one to six `#` and a space, also where that is a comment
# in fenced code. Underlined and indented headings are not seen.
#
# Usage, by git: merge-append-log.sh %O %A %B   (base, ours and the result, theirs)
# Test: scripts/merge-append-log-test.sh. Replayed on main's history: tool/hotspots/replay.py.
set -euo pipefail
base="$1" ours="$2" theirs="$3"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# Both sides created the file: two logs, not two entries.
[[ -s "$base" ]] || exit 1

# diff3 conflicts are not trimmed to the differing lines: each side's part is its whole insertion,
# the blank line before a heading included, and the base part is empty exactly when both sides
# only inserted. The markers are longer than any run of marker characters a line starts with.
size="$(awk '
  match($0, /^[<|=>]+/) && RLENGTH > longest { longest = RLENGTH }
  END { print longest + 1 }
' "$base" "$ours" "$theirs")"
status=0
git merge-file -p --diff3 --marker-size="$size" "$ours" "$base" "$theirs" >"$tmp/diff3" || status=$?
# 128 and above: merge-file itself failed, as on a binary file. awk ends its last line with a
# newline, which a file without one would gain. What merged without a conflict has no markers and
# passes through.
((status < 128)) && [[ -z "$(tail -c 1 "$tmp/diff3")" ]] || exit 1
awk -v size="$size" '
  function bar(c,   s, i) { for (i = 0; i < size; i++) s = s c; return s }
  # The level of a heading, 7 for any other line.
  function level(line) { return match(line, /^#+ /) && RLENGTH <= 7 ? RLENGTH - 1 : 7 }
  BEGIN { start = bar("<") " "; middle = bar("|") " "; split_at = bar("="); stop = bar(">") " " }
  side == "" && index($0, start) == 1 {
    side = "ours"; top = 7; started = 0; split("", in_ours)
    next
  }
  side == "ours" && index($0, middle) == 1 { side = "base"; next }
  side == "base" { if ($0 != split_at) exit 1; side = "theirs"; next }
  side == "theirs" && index($0, stop) == 1 { side = ""; next }
  side == "ours" {
    if (level($0) < top) top = level($0)
    in_ours[$0] = 1
  }
  side == "theirs" && /[^ \t]/ {
    if (!started) {
      if (top < level($0)) exit 1
      entry = level($0)
      started = 1
    }
    # The lines that start an entry of theirs, not a subsection: `### Evidence` may repeat.
    if (level($0) == entry && ($0 in in_ours)) exit 1
  }
  { print }
' "$tmp/diff3" >"$tmp/merged"
cat "$tmp/merged" >"$ours"
