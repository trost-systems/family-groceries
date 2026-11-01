#!/usr/bin/env bash
# Re-films add-tick and household-sync with the demo household „Unser Haushalt“ (Anna, Jonas) and
# rebuilds their site files (site/public/media). Runs inside scripts/store-screenshots.sh --videos,
# which has the stack up and the fg variables set (verify-hummlist env.sh).
#
#   marketing/videos/remake.sh [video ...]     default: add-tick household-sync
#
# Needs the Linux toolchain of README.md: Xvfb, ffmpeg, Deno, xdotool ($XDOTOOL or on PATH),
# the marionette CLI, and `flutter build linux` (the linux-build container where CMake is missing).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
source "$here/../../.claude/skills/verify-hummlist/helpers/env.sh"
videos=("$@")
[[ ${#videos[@]} -gt 0 ]] || videos=(add-tick household-sync)

if [[ -z ${XDOTOOL:-} ]]; then
  XDOTOOL="$(command -v xdotool || echo "$HOME/tools/xdo/xdotool")"
  export XDOTOOL
fi
[[ -x $XDOTOOL ]] || { echo "no xdotool (set XDOTOOL)" >&2; exit 1; }
supabase_up >/dev/null
command -v cmake >/dev/null || export PATH="$REPO_ROOT/.cursor/skills/verify-family-groceries/linux-build:$PATH"

bundle="$REPO_ROOT/app/build/linux/x64/profile/bundle"
stamp="$( { git -C "$REPO_ROOT" rev-parse HEAD:app; git -C "$REPO_ROOT" diff HEAD -- app; echo "$SUPABASE_URL"; } | sha256sum | cut -c1-16)"
if [[ "$(cat "$bundle/.capture-stamp" 2>/dev/null)" != "$stamp" ]]; then
  log "flutter build linux --profile (Marionette entry point) against $SUPABASE_URL"
  (cd "$REPO_ROOT/app" && flutter build linux --profile -t test_driver/main_marionette.dart \
    --dart-define=SUPABASE_URL="$SUPABASE_URL" --dart-define=SUPABASE_PUBLISHABLE_KEY="$SUPABASE_PUBLISHABLE_KEY" \
    --dart-define=FAKE_STORE=ok >"$VH_STATE_DIR/linux-build.log" 2>&1) \
    || { echo "linux build failed; see $VH_STATE_DIR/linux-build.log" >&2; exit 1; }
  echo "$stamp" >"$bundle/.capture-stamp"
fi

export CAPTURE_BUNDLE="$bundle/family_groceries"
for v in "${videos[@]}"; do
  for lang in de en; do
    log "take: $v $lang"
    deno run -A "$here/capture/take.ts" "$v" "$lang"
  done
done
(cd "$here" && { [[ -d node_modules ]] || npm ci --no-audit --no-fund >/dev/null; } && node build.mjs "${videos[@]}")
