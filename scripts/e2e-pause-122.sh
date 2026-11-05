#!/usr/bin/env bash
# Runs a command (a Playwright run) while pausing its test runner and browsers: every RUN seconds
# they get SIGSTOP for STOP seconds, then SIGCONT. The local stack and the web server keep running,
# like a server while a phone sleeps or a host that stalls one process (docs/DECISIONS.md 18.23,
# job 122). Optional BURN CPU burners add load for the whole run.
#
#   scripts/e2e-pause.sh [--stop S] [--run S] [--burn N] -- <command...>
#
# Locally the command still goes under the e2e lock:
#   flock /tmp/fg-e2e.lock scripts/e2e-pause.sh --stop 4 --run 6 -- npx playwright test ...
set -euo pipefail
stop=4 run=6 burn=0
while [[ $# -gt 0 ]]; do
  case $1 in
    --stop) stop=$2; shift 2 ;;
    --run) run=$2; shift 2 ;;
    --burn) burn=$2; shift 2 ;;
    --) shift; break ;;
    *) echo "unknown argument $1" >&2; exit 2 ;;
  esac
done
[[ $# -gt 0 ]] || { echo "usage: $0 [--stop S] [--run S] [--burn N] -- <command...>" >&2; exit 2; }

burners=()
for ((i = 0; i < burn; i++)); do
  (while :; do :; done) &
  burners+=($!)
done

"$@" &
root=$!

# The runner's workers and the browsers below them, not serve.mjs or fake-oidc.mjs.
targets() {
  local pids=("$1") all=() pid
  while [[ ${#pids[@]} -gt 0 ]]; do
    pid=${pids[0]}
    pids=("${pids[@]:1}")
    all+=("$pid")
    mapfile -t -O "${#pids[@]}" pids < <(pgrep -P "$pid" || true)
  done
  for pid in "${all[@]}"; do
    [[ $pid == "$root" ]] && continue
    case "$(tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null)" in
      *serve.mjs* | *fake-oidc.mjs* | '') ;;
      *) echo "$pid" ;;
    esac
  done
}

paused=()
resume() {
  if [[ ${#paused[@]} -gt 0 ]]; then kill -CONT "${paused[@]}" 2>/dev/null || true; fi
  paused=()
}
# shellcheck disable=SC2317 # runs from the EXIT trap
cleanup() {
  resume
  if [[ ${#burners[@]} -gt 0 ]]; then kill "${burners[@]}" 2>/dev/null || true; fi
}
trap cleanup EXIT

pauses=0
while kill -0 "$root" 2>/dev/null; do
  sleep "$run"
  kill -0 "$root" 2>/dev/null || break
  mapfile -t paused < <(targets "$root")
  [[ ${#paused[@]} -gt 0 ]] || continue
  kill -STOP "${paused[@]}" 2>/dev/null || true
  pauses=$((pauses + 1))
  sleep "$stop"
  resume
done
status=0
wait "$root" || status=$?
echo "e2e-pause: $pauses pauses of ${stop} s every ${run} s, $burn burners, exit $status" >&2
exit "$status"
