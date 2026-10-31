#!/usr/bin/env bash
# Vendors posthog-js <version> into app/web/posthog/ (job 44, docs/ANALYTICS.md): the web app
# loads it from its own origin after the user's yes, so no PostHog script is fetched before
# consent and the version is pinned. npm checks the tarball's integrity.
# Usage: scripts/posthog-js.sh 1.444.0
set -euo pipefail
source "$(dirname "$0")/lib.sh"
version="${1:?usage: scripts/posthog-js.sh <posthog-js version>}"
dest="$REPO_ROOT/app/web/posthog"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
(cd "$tmp" && npm pack --silent "posthog-js@$version" >/dev/null && tar xzf "posthog-js-$version.tgz")
cp "$tmp/package/dist/array.js" "$dest/array.js"
cp "$tmp/package/LICENSE" "$dest/LICENSE"
printf 'posthog-js %s\nsha256 %s\n' "$version" "$(sha256sum "$dest/array.js" | cut -d' ' -f1)" >"$dest/VERSION"
log "app/web/posthog: posthog-js $version"
