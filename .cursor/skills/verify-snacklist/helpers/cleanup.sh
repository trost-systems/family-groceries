#!/usr/bin/env bash
# Tears down what launch.sh started and nothing else: the seeded run's users and data (fg
# teardown proves every leftover count is 0), the web server it started (by recorded pid and
# command line, never by name) and, if launch.sh started it, this checkout's Supabase stack.
# Evidence under $VH_EVIDENCE_DIR stays; the last line lists it.
#
#   cleanup.sh [--keep-stack] [--purge-build]
set -euo pipefail
source "$(dirname "$0")/env.sh"

keep_stack=0 purge_build=0
for arg in "$@"; do
  case "$arg" in
    --keep-stack) keep_stack=1 ;;
    --purge-build) purge_build=1 ;;
    *) echo "unknown argument $arg (cleanup.sh [--keep-stack] [--purge-build])" >&2; exit 64 ;;
  esac
done
[[ -f $VH_INSTANCE ]] || { echo "no instance at $VH_INSTANCE; nothing to clean up"; exit 0; }

run="$(vh_json run)"
evidence="$(vh_json evidenceDir)"
if [[ -n $run ]] && stack_running; then
  if "$REPO_ROOT/scripts/fg" teardown "$run" | grep -q '^  "ok": true'; then echo "teardown $run: ok (leftovers 0)"; else echo "teardown $run failed: rerun scripts/fg teardown $run with FG_STATE_DIR=$FG_STATE_DIR" >&2; fi
fi

pid="$(vh_json serverPid)"
if [[ -n $pid && -r /proc/$pid/cmdline ]] && tr '\0' ' ' <"/proc/$pid/cmdline" | grep -q "serve.mjs $VH_BUILD_DIR $VH_WEB_PORT"; then
  kill "$pid"
  echo "stopped web server pid $pid"
fi

if [[ "$(vh_json startedStack)" == true && $keep_stack == 0 ]]; then
  (cd "$REPO_ROOT" && supabase stop --no-backup >/dev/null)
  echo "stopped Supabase stack $VH_PROJECT_ID"
fi
[[ $purge_build == 1 ]] && rm -rf "$VH_BUILD_DIR" && echo "removed $VH_BUILD_DIR"
rm -f "$VH_INSTANCE"
echo "evidence kept: $evidence ($(find "$evidence" -type f 2>/dev/null | wc -l) files)"
