#!/usr/bin/env bash
# Tests scripts/vercel-ignore.sh (vercel.json's ignoreCommand) in a Vercel-like clone: depth 10, so
# an older VERCEL_GIT_PREVIOUS_SHA is missing, as on the release pushes of 2026-11-10 that ended in
# ERROR (job 180). Exit 0 skips the build, 1 builds; any other code fails the deployment. Run by the
# lint gate.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
failures=0
fail() { echo "FAIL: $*" >&2; failures=$((failures + 1)); }

git init -q -b release "$tmp/origin"
commit() {
  mkdir -p "$tmp/origin/$(dirname "$1")"
  echo "$2" >>"$tmp/origin/$1"
  git -C "$tmp/origin" add -A
  git -C "$tmp/origin" -c user.name=t -c user.email=t@t commit -q -m "$1"
  git -C "$tmp/origin" rev-parse HEAD
}
outside="$(commit app/lib/main.dart 1)"
for i in $(seq 1 10); do before_app="$(commit "docs/$i.md" "$i")"; done
before_test="$(commit app/lib/main.dart 2)"
before_docs="$(commit app/test/main_test.dart 1)"
commit docs/after.md 1 >/dev/null
git clone -q --depth 10 --branch release "file://$tmp/origin" "$tmp/clone"
git -C "$tmp/clone" cat-file -e "$outside^{commit}" 2>/dev/null && fail "the clone should not hold $outside"
mkdir -p "$tmp/clone/scripts"
cp "$REPO_ROOT/scripts/vercel-ignore.sh" "$tmp/clone/scripts/"

expect() {
  local want="$1" ref="$2" prev="$3" why="$4" got=0
  (cd "$tmp/clone" && VERCEL_GIT_COMMIT_REF="$ref" VERCEL_GIT_PREVIOUS_SHA="$prev" bash scripts/vercel-ignore.sh >/dev/null 2>&1) || got=$?
  [[ $got == "$want" ]] || fail "$why: exit $got, want $want"
}
expect 0 main "$before_docs" "a main push skips"
expect 0 job/1-x "" "a branch push skips"
expect 1 release "" "release without a previous deployment builds"
expect 1 "" "" "a CLI deployment without a previous one builds"
expect 1 release "$outside" "release builds when the previous commit is outside the clone"
expect 1 release 0123456789abcdef0123456789abcdef01234567 "release builds when the previous commit is unknown"
expect 1 release "$before_app" "release builds when app/ changed"
expect 0 release "$before_test" "release skips when only app/test changed"
expect 0 release "$before_docs" "release skips a docs-only push"
for path in vercel.json scripts/vercel.sh scripts/join-config.sh scripts/vercel-ignore.sh; do
  base="$(git -C "$tmp/clone" rev-parse HEAD)"
  echo "# $path" >>"$tmp/clone/$path"
  git -C "$tmp/clone" add -A
  git -C "$tmp/clone" -c user.name=t -c user.email=t@t commit -q -m "$path"
  expect 1 release "$base" "release builds when $path changed"
done

((failures == 0)) || exit 1
echo "vercel-ignore-test: ok"
