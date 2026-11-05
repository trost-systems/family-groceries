#!/usr/bin/env bash
# hc-sync score: failures per 1,000 seeded sync fuzz runs (seeds 1..1000), lower is better,
# plus the harness runtime as a tiebreak: score = failures_per_1000 + runtime_s / 100000.
# Prints one JSON line. docs/hillclimb/hc-sync.md explains the harness and the oracle.
set -euo pipefail
root="$(cd "$(dirname "$0")/../../.." && pwd)"
export PATH="${FLUTTER_DIR:-$HOME/flutter}/bin:$PATH"
seeds="${HC_SYNC_SEEDS:-1-1000}"
report="$(mktemp)"
out="$(mktemp)"
trap 'rm -f "$report" "$out"' EXIT
cd "$root/app"
flutter pub get >/dev/null 2>&1
start="$(date +%s.%N)"
if ! flock /tmp/fg-hc-measure.lock env FUZZ_SEEDS="$seeds" FUZZ_REPORT="$report" \
  flutter test test/fuzz/sync_fuzz_test.dart --plain-name 'sync fuzz over FUZZ_SEEDS' >"$out" 2>&1; then
  cat "$out" >&2
  exit 1
fi
end="$(date +%s.%N)"
python3 - "$report" "$start" "$end" "$seeds" "$(git -C "$root" rev-parse --short HEAD)" <<'PY'
import json, sys, datetime
report, start, end, seeds, sha = sys.argv[1:]
r = json.load(open(report))
per_1000 = r["failed"] * 1000 / r["seeds"]
runtime_s = r["runtime_ms"] / 1000
print(json.dumps({
    "goal": "hc-sync",
    "score": round(per_1000 + runtime_s / 100000, 6),
    "higher_is_better": False,
    "parts": {
        "failures_per_1000": per_1000,
        "failed_seeds": r["failed"],
        "seeds": seeds,
        "runs": r["seeds"],
        "runtime_s": runtime_s,
        "wall_s": round(float(end) - float(start), 1),
        "first_failing": [f["seed"] for f in r["failures"][:20]],
    },
    "git": sha,
    "at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
}))
PY
