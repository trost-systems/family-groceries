#!/usr/bin/env bash
# Playwright drives the release web build against the local stack. Arguments go to
# `playwright test` (a file or -g to run a subset).
#
# One e2e run at a time on the box: two overlapping runs (stack, web build, browsers) froze it
# (COORDINATION.md, Memory). The lock is box-wide, not per checkout, and the kernel drops it
# when the holder exits, however it exits.
set -euo pipefail
source "$(dirname "$0")/../lib.sh"

LOCK="${FG_E2E_LOCK:-/tmp/fg-e2e.lock}"
exec 9>>"$LOCK"
if ! flock -n 9; then
  log "waiting for the box-wide e2e lock $LOCK; last recorded holder (a plain 'flock $LOCK <cmd>' records nothing): $(grep . "$LOCK" || echo none recorded)"
  flock 9
  log "got the e2e lock"
fi
holder="$REPO_ROOT (pid $$, since $(date '+%H:%M:%S'))"
echo "$holder" >"$LOCK"
# Clear the record on the way out, so the next waiter isn't told about a run that has ended.
trap '[[ "$(cat "$LOCK" 2>/dev/null)" == "$holder" ]] && : >"$LOCK"' EXIT

supabase_up
log "web build against the local stack"
cd "$REPO_ROOT/app"
flutter pub get >/dev/null
# shellcheck disable=SC2046 # flutter_defines prints several arguments
flutter build web --release --no-web-resources-cdn --no-wasm-dry-run $(flutter_defines) --dart-define-from-file=config/e2e.json

log "playwright"
cd "$REPO_ROOT/e2e"
[[ -d node_modules ]] || npm ci
npx playwright test "$@"
