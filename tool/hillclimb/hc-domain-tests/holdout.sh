#!/usr/bin/env bash
# The mutation part on holdout.tsv: 100 mutants from the sites mutants.tsv does not hold, so no
# test was written against them. Informational; not the score. Prints mutate.py's JSON line.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"
export PATH="${FLUTTER_DIR:-$HOME/flutter}/bin:$PATH"
export PYTHONDONTWRITEBYTECODE=1
work="$(mktemp -d /tmp/hc128-holdout.XXXXXX)"
trap 'rm -rf "$work"' EXIT
(cd "$repo/app" && flutter pub get >/dev/null 2>&1)
mkdir -p "$work/repo"
(cd "$repo" && tar cf - --exclude=./.git --exclude=./app/build --exclude=./app/coverage \
  --exclude=./app/ios --exclude=./app/android --exclude=./app/linux --exclude=./app/widgetbook \
  --exclude=node_modules --exclude=./app/test/design/failures . ) | tar xf - -C "$work/repo"
HC128_MUTANTS="$here/holdout.tsv" HC128_EQUIVALENT="$here/holdout-equivalent.tsv" \
  python3 "$here/mutate.py" run "$work/repo/app"
