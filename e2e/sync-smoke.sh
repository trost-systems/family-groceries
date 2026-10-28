#!/usr/bin/env bash
# Two-client fg sync smoke test: one add, one tick, then the artifacts and the
# index must exist and the run must be torn down. Then two stops: SIGTERM while
# fg sync waits for the e2e lock (exits 143 at once, nothing seeded), and
# SIGTERM while the browser runs (exits 143, the run torn down, the web server
# gone). CI runs it in the Playwright job; locally fg sync takes
# /tmp/fg-e2e.lock itself.
# Usage: e2e/sync-smoke.sh [extra fg sync flags, e.g. --web-build app/build/web]
set -euo pipefail
repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
script="$(mktemp --suffix .fgs)"
out="$(mktemp)"
trap 'rm -f "$script" "$out"' EXIT
cat >"$script" <<'FGS'
A add "Sync-Smoke"
expect B see "Sync-Smoke" within 5000ms
B tick "Sync-Smoke"
expect A gone "Sync-Smoke" within 5000ms
FGS

status=0
"$repo/scripts/fg" sync household-3-mid-shop --clients 2 --script "$script" "$@" >"$out" || status=$?
fail() { echo "sync-smoke: FAIL: $*" >&2; cat "$out" >&2; exit 1; }
[[ $status -eq 0 ]] || fail "fg sync exited $status"
dir="$(jq -r '.evidence.dir' "$out")"
for f in index.html index.md result.json videos/A.webm videos/B.webm videos/composite.webm; do
  [[ -s "$dir/$f" ]] || fail "missing $f"
done
[[ "$(jq '[.frames[] | select(.kind == "step")] | length' "$dir/result.json")" -ge 5 ]] || fail "fewer than 5 step frames"
[[ "$(jq '.changeFrames' "$dir/result.json")" -ge 2 ]] || fail "no change frames: the observer saw nothing"
for f in $(jq -r '.frames[].composite' "$dir/result.json"); do [[ -s "$dir/$f" ]] || fail "missing frame $f"; done
grep -q 'PASS' "$dir/index.html" || fail "index.html does not say PASS"
[[ "$(jq '[.latency.perClient[].fromAckMs.n // 0] | add' "$out")" -ge 2 ]] || fail "no latency measured"
[[ "$(jq '[.teardown.leftovers[]] | add' "$out")" -eq 0 ]] || fail "teardown left rows"
if grep -rqiE 'password|sb_secret_|eyJhbGci' "$dir"/*.json "$dir"/*.md "$dir"/*.html; then fail "a secret-looking string in the artifacts"; fi
echo "sync-smoke: add/tick PASS ($dir)"
jq -c '{latency: .latency.all.fromAckMs, frames: .evidence.frames, changeFrames: .evidence.changeFrames}' "$out"

fg() { "$repo/scripts/fg" "$@"; }
runs() { fg runs | jq -r '.runs[].run' | sort; }
# Starts fg sync in the background, waits until its log shows $1, sends SIGTERM; prints the exit code.
stop_when() {
  local marker=$1; shift
  local log; log="$(mktemp)"
  # scripts/fg execs deno, so $! is the fg process itself (a shell function here would be a subshell).
  "$repo/scripts/fg" sync household-3-mid-shop --clients 2 "$@" >"$out" 2>"$log" &
  local pid=$!
  # Until the marker shows or fg exits; fg itself bounds the time it may wait for the e2e lock.
  until grep -q "$marker" "$log" || ! kill -0 "$pid" 2>/dev/null; do sleep 0.2; done
  grep -q "$marker" "$log" || { cat "$log" >&2; rm -f "$log"; fail "fg sync never reached: $marker"; }
  sleep "${STOP_DELAY:-0}"
  local sent; sent=$(date +%s)
  kill -TERM "$pid"
  local code=0; wait "$pid" || code=$?
  # Copy before echoing: the caller reads the echo and then greps the log at once.
  cp "$log" "$out.log"; rm -f "$log"
  echo "$code $(( $(date +%s) - sent ))"
}

# 1. Stopped while waiting for the e2e lock: nothing is seeded yet, so nothing is left.
before="$(runs)"
lock="$(mktemp --suffix .lock)"
flock "$lock" sleep 600 &
holder=$!
sleep 0.5
read -r code secs < <(FG_E2E_LOCK="$lock" stop_when "waiting for $lock" --script "$script" --lock-wait 600 "$@")
kill "$holder" 2>/dev/null; wait "$holder" 2>/dev/null || true; rm -f "$lock"
[[ $code -eq 143 ]] || fail "SIGTERM in the lock wait: exit $code, not 143"
[[ $secs -le 10 ]] || fail "SIGTERM in the lock wait took ${secs}s"
[[ "$(runs)" == "$before" ]] || fail "a run was left after a stop in the lock wait"
grep -q "SIGTERM: stopping" "$out.log" || fail "no stop message"
echo "sync-smoke: SIGTERM in the lock wait PASS (exit 143 after ${secs}s, nothing seeded)"

# 2. Stopped while the browser runs: the seeded run is torn down, the server and driver are gone.
cat >"$script" <<'FGS'
A add "Sync-Stop"
wait 120s
FGS
port="${FG_PORT_PREFIX:-543}80"
# fg logs "running" right before it starts the driver; 8 s later the browsers are signed in.
read -r code secs < <(STOP_DELAY=8 stop_when 'running 2 steps in 2 clients' --script "$script" "$@")
[[ $code -eq 143 ]] || fail "SIGTERM in the browser run: exit $code, not 143"
grep -q "SIGTERM: tearing down run" "$out.log" || { cat "$out.log" >&2; fail "no teardown after SIGTERM"; }
[[ "$(runs)" == "$before" ]] || fail "the run was not torn down after SIGTERM"
if ss -ltn | grep -q ":$port "; then fail "the web server on :$port is still listening"; fi
if pgrep -f "e2e/sync/engine.mjs" >/dev/null; then fail "the sync driver is still running"; fi
[[ $secs -le 15 ]] || fail "SIGTERM in the browser run took ${secs}s to exit"
echo "sync-smoke: SIGTERM in the browser run PASS (exit 143 after ${secs}s, run torn down, :$port free, no driver)"
echo "sync-smoke: PASS"
