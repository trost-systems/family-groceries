#!/usr/bin/env bash
# Tests scripts/checks/no-hummlist.sh on a scratch repository: a hit outside the allow list fails
# with file:line and the fix, a listed path or glob passes, untracked files and binaries are not
# read, a tracked path naming Hummlist fails, an entry without a reason fails, and a stale entry
# is reported. Run by scripts/lint.sh.
set -euo pipefail
check="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/no-hummlist.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
failures=0
fail() { echo "FAIL: $*" >&2; failures=$((failures + 1)); }
# expect <name> <exit code> <pattern in the output>
expect() {
  local code=0 out
  out="$("$check" "$tmp/repo" 2>&1)" || code=$?
  [[ $code == "$2" ]] || fail "$1: exit $code, expected $2"$'\n'"$out"
  grep -qF -- "$3" <<<"$out" || fail "$1: no '$3' in"$'\n'"$out"
}

git init -q "$tmp/repo"
cd "$tmp/repo"
mkdir -p scripts/checks docs/done app
printf 'Snacklist only\n' >app/ok.txt
printf 'see HummList here\n' >docs/done/20.md
printf 'line one\napp.hummlist.com\n' >app/old.txt
printf 'hummlist\0binary' >app/blob.bin
printf 'hummlist untracked\n' >app/untracked.txt
cat >scripts/checks/hummlist-allow.txt <<'EOF'
# history
docs/done/**  # 7: past jobs
scripts/checks/*  # 9: the guard itself

EOF
git add app/ok.txt docs/done/20.md app/old.txt app/blob.bin scripts/checks/hummlist-allow.txt

expect 'a hit outside the list' 1 'app/old.txt:2:app.hummlist.com'
expect 'the fix is named' 1 'hummlist-allow.txt'
out="$("$check" "$tmp/repo" 2>&1 || true)"
grep -q 'docs/done/20.md\|blob.bin\|untracked' <<<"$out" && fail "listed, binary or untracked file reported: $out"

printf 'app/old.txt  # 6: old store links\n' >>scripts/checks/hummlist-allow.txt
expect 'every hit listed' 0 'no-hummlist: ok (3 allow-list entries)'

printf 'app/gone.txt  # 8: retired\n' >>scripts/checks/hummlist-allow.txt
expect 'a stale entry' 0 "'app/gone.txt' in scripts/checks/hummlist-allow.txt has no hit any more"

printf 'clean\n' >app/rate-hummlist.md
git add app/rate-hummlist.md
expect 'a path naming Hummlist' 1 'app/rate-hummlist.md'
git rm -q --cached app/rate-hummlist.md

printf 'app/x.txt # no exception number\n' >>scripts/checks/hummlist-allow.txt
expect 'an entry without a reason' 1 "hummlist-allow.txt:7: 'app/x.txt # no exception number'"

((failures == 0)) || exit 1
echo "no-hummlist tests: ok"
