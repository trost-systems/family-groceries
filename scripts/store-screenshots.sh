#!/usr/bin/env bash
# The Play and App Store screenshots, the Play feature graphic and icon, from the real Snacklist
# web build against this checkout's local stack with the demo household „Unser Haushalt“
# (docs/STORE_SCREENSHOTS.md). Nothing is uploaded anywhere.
#
#   scripts/store-screenshots.sh [--locale de-DE|en-US|all] [--store play|appstore|all]
#                                [--assistants neutral|named|named_api] [--videos] [--keep]
#     --locale      default all
#     --store       default all
#     --assistants  the voice and assist captions: neutral (default), named (Siri, Alexa, MCP;
#                   waits for Legal) or named_api (also the API; waits for the public-api flag)
#     --videos      then re-film the site demo loops add-tick and household-sync (marketing/videos)
#     --keep        leave the stack, the web server and the seeded runs up afterwards
#
# Writes marketing/store-screenshots/out/ (git-ignored): <locale>/<set>/<n>-<shot>.png,
# <locale>/play/feature-graphic.png and icon-512.png, <locale>/contact-sheet.png, manifest.json,
# summary.md. Exits non-zero when a check fails.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
# CI runs on the canonical 543xx ports; locally a job uses its own block (COORDINATION.md).
[[ -n ${CI:-} ]] && export VH_ALLOW_543=1
source "$here/../.claude/skills/verify-snacklist/helpers/env.sh"

usage="store-screenshots.sh [--locale de-DE|en-US|all] [--store play|appstore|all] [--assistants neutral|named|named_api] [--videos] [--keep]"
locales=all stores=all assistants=neutral videos=0 keep=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --locale) locales="${2:?$usage}"; shift 2 ;;
    --store) stores="${2:?$usage}"; shift 2 ;;
    --assistants) assistants="${2:?$usage}"; shift 2 ;;
    --videos) videos=1; shift ;;
    --keep) keep=1; shift ;;
    *) echo "unknown argument $1 ($usage)" >&2; exit 64 ;;
  esac
done
[[ $locales == all ]] && locales=de-DE,en-US
[[ $stores == all ]] && stores=play,appstore
for l in ${locales//,/ }; do [[ $l == de-DE || $l == en-US ]] || { echo "unknown locale $l ($usage)" >&2; exit 64; }; done
for s in ${stores//,/ }; do [[ $s == play || $s == appstore ]] || { echo "unknown store $s ($usage)" >&2; exit 64; }; done
[[ $assistants =~ ^(neutral|named|named_api)$ ]] || { echo "unknown assistants variant $assistants ($usage)" >&2; exit 64; }

shots="$REPO_ROOT/marketing/store-screenshots"
started=$SECONDS
cleanup() {
  [[ $keep == 1 ]] && return
  (cd "$shots" && node teardown.mjs) || true
  "$VH_HELPERS/cleanup.sh" >/dev/null || true
}
trap cleanup EXIT

log "stack, web build and server (verify-snacklist launch.sh)"
first="${locales%%,*}"
scenario=store-screenshots
[[ $first == en-US ]] && scenario=store-screenshots-en
# -o: the web server launch.sh leaves running must not inherit the e2e lock (job 73).
flock -o /tmp/fg-e2e.lock "$VH_HELPERS/launch.sh" --scenario "$scenario" --fresh | tail -1

(cd "$shots" && { [[ -d node_modules ]] || npm ci --no-audit --no-fund >/dev/null; })
# Runs a killed capture left behind are listed in out/runs.txt: remove them before out/ goes.
(cd "$shots" && node teardown.mjs)
rm -rf "$shots/out"
log "capture ($locales; $stores), compose and check ($assistants), Chromium under /tmp/fg-e2e.lock"
args=(--locales "$locales" --stores "$stores" --assistants "$assistants")
(cd "$shots" && flock /tmp/fg-e2e.lock bash -c 'node capture.mjs "$@" && node compose.mjs "$@"' _ "${args[@]}")

if [[ $videos == 1 ]]; then
  log "demo videos (marketing/videos/remake.sh add-tick household-sync)"
  "$REPO_ROOT/marketing/videos/remake.sh" add-tick household-sync
fi
log "done in $((SECONDS - started)) s: $shots/out ($(cd "$shots/out" && echo */contact-sheet.png))"
