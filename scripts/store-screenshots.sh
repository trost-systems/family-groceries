#!/usr/bin/env bash
# The Play and App Store screenshots, the Play feature graphic and icon, and (with --videos) the
# hummlist.com demo loops, all from the real app against this checkout's local stack with the
# demo household „Unser Haushalt“ (docs/STORE_SCREENSHOTS.md).
#
#   scripts/store-screenshots.sh [--locale de-DE|en-US|all] [--store play|appstore|all] [--videos] [--keep]
#     --locale  default de-DE (the approved texts); en-US renders the draft English set
#     --store   default all
#     --videos  also re-film add-tick and household-sync for site/public/media (marketing/videos)
#     --keep    leave the stack and the web server running afterwards
#
# Writes marketing/store-screenshots/out/ (git-ignored): <locale>/<device>/<n>-<scene>.png,
# <locale>/play/feature-graphic.png and icon-512.png, <locale>/contact-sheet.png, manifest.json.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
# CI runs on the canonical 543xx ports; locally a job uses its own block (COORDINATION.md).
[[ -n ${CI:-} ]] && export VH_ALLOW_543=1
source "$here/../.claude/skills/verify-hummlist/helpers/env.sh"

locales=de-DE stores=play,appstore videos=0 keep=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --locale) locales="$2"; shift 2 ;;
    --store) stores="$2"; shift 2 ;;
    --videos) videos=1; shift ;;
    --keep) keep=1; shift ;;
    *) echo "unknown argument $1 (store-screenshots.sh [--locale de-DE|en-US|all] [--store play|appstore|all] [--videos] [--keep])" >&2; exit 64 ;;
  esac
done
[[ $locales == all ]] && locales=de-DE,en-US
[[ $stores == all ]] && stores=play,appstore
for l in ${locales//,/ }; do [[ $l == de-DE || $l == en-US ]] || { echo "unknown locale $l (de-DE, en-US)" >&2; exit 64; }; done
for s in ${stores//,/ }; do [[ $s == play || $s == appstore ]] || { echo "unknown store $s (play, appstore)" >&2; exit 64; }; done

shots="$REPO_ROOT/marketing/store-screenshots"
cleanup() { [[ $keep == 1 ]] || "$VH_HELPERS/cleanup.sh" >/dev/null || true; }
trap cleanup EXIT

log "stack, web build and server (verify-hummlist launch.sh)"
"$VH_HELPERS/launch.sh" --scenario demo-haushalt | tail -1

(cd "$shots" && { [[ -d node_modules ]] || npm ci --no-audit --no-fund >/dev/null; })
rm -rf "$shots/out"
log "capture ($locales; $stores), one browser under /tmp/fg-e2e.lock"
(cd "$shots" && STORE_SHOTS_LOCALES="$locales" STORE_SHOTS_STORES="$stores" \
  flock /tmp/fg-e2e.lock npx playwright test --workers=1)
log "compose"
(cd "$shots" && node compose.mjs --locales "$locales" --stores "$stores")

if [[ $videos == 1 ]]; then
  log "demo videos (marketing/videos)"
  "$REPO_ROOT/marketing/videos/remake.sh"
fi
log "done: $shots/out ($(find "$shots/out" -name contact-sheet.png -printf '%P ' ))"
