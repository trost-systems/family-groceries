#!/usr/bin/env bash
# hc-list-cpu (job 130): in-memory list model CPU on a large household, as one score (lower is
# better). Prints one JSON line on stdout; logs go to stderr. docs/hillclimb/hc-list-cpu.md
# explains the benches, the score and the noise band.
#
#   tool/hillclimb/hc-list-cpu/measure.sh
#
# The suite is app/benchmark/list_cpu/ (fixture generator with seed 130, and the benches), run
# with `flutter test` under /tmp/fg-hc-measure.lock.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
export PATH="$HOME/flutter/bin:$PATH"

cd "$root/app"
flutter pub get >/dev/null
log="$(mktemp /tmp/hc130-bench.XXXXXX)"
trap 'rm -f "$log"' EXIT
echo "measure: list cpu bench under /tmp/fg-hc-measure.lock" >&2
flock /tmp/fg-hc-measure.lock flutter test --no-pub benchmark/list_cpu/list_cpu_bench.dart \
  >"$log" 2>&1 || { tail -40 "$log" >&2; exit 1; }
line="$(grep -o 'HC130_RESULT .*' "$log" | head -1 | cut -d' ' -f2-)"
[ -n "$line" ] || { tail -40 "$log" >&2; echo "measure: no result line" >&2; exit 1; }

python3 - "$line" \
  "$(git -C "$root" rev-parse --short HEAD)$(git -C "$root" diff --quiet HEAD -- app || echo -dirty)" <<'PY'
import datetime, json, math, sys
result, sha = json.loads(sys.argv[1]), sys.argv[2]
parts = result["parts"]
p50s = [b["p50_ms"] for b in parts.values()]
score = math.exp(sum(math.log(v) for v in p50s) / len(p50s))
parts["items"] = result["items"]
parts["seed"] = result["seed"]
parts["samples"] = result["samples"]
parts["isolate"] = ("all benches on the flutter test isolate (JIT, after warm-up); in the app "
                    "this code runs on the UI isolate")
print(json.dumps({
    "goal": "hc-list-cpu",
    "score": round(score, 4),
    "higher_is_better": False,
    "parts": parts,
    "git": sha,
    "at": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
}))
PY
