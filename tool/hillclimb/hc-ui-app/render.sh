#!/usr/bin/env bash
# Preview: renders the hc-ui-app screenshot set (screens_golden_test.dart)
# into OUT_DIR (default /tmp/hc102/preview) without changing the committed
# goldens. Serialised with measure.sh through the same lock.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"
if [ -z "${HC_LOCKED:-}" ]; then
  HC_LOCKED=1 exec flock /tmp/fg-hc-measure.lock "$0" "$@"
fi
out="${OUT_DIR:-/tmp/hc102/preview}"
goldens="$repo/app/test/design/goldens"
backup="$(mktemp -d)"
cp -a "$goldens/." "$backup/"
trap 'rm -rf "$goldens" && mkdir -p "$goldens" && cp -a "$backup/." "$goldens/" && rm -rf "$backup"' EXIT
mkdir -p "$out"
(cd "$repo/app" && flutter test --update-goldens test/design/screens_golden_test.dart) >"$out/render.log" 2>&1 ||
  { tail -40 "$out/render.log" >&2; exit 1; }
cp "$goldens/"*.png "$out/"
echo "rendered into $out"
