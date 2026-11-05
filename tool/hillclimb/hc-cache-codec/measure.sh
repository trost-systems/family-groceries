#!/usr/bin/env bash
# hc-cache-codec score, lower is better: the list-cache snapshot codec through
# DeviceCache.list (save/load), on a 5,000-item and a 300-open-item snapshot.
# score = 0.4 * encode + 0.4 * decode + 0.2 * bytes, each the mean over both
# snapshots of p50 / baseline p50 (baseline.json, 1.0 = baseline). A snapshot
# that does not load back equal fails the run. docs/hillclimb/hc-cache-codec.md
# explains it.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
export PATH="${FLUTTER_DIR:-$HOME/flutter}/bin:$PATH"
report="$(mktemp)"
out="$(mktemp)"
trap 'rm -f "$report" "$out"' EXIT
cd "$root/app"
flutter pub get >/dev/null 2>&1
# A stale incremental test kernel made the same code 15-25 % slower (attempt
# 9's A/A check), so every run compiles the bench afresh.
rm -rf build/test_cache
if ! flock /tmp/fg-hc-measure.lock env HC_CODEC_REPORT="$report" \
  flutter test test/hillclimb/cache_codec_bench_test.dart --plain-name 'cache codec bench' >"$out" 2>&1; then
  cat "$out" >&2
  exit 1
fi
python3 - "$report" "$here/baseline.json" "$(git -C "$root" rev-parse --short HEAD)" <<'PY'
import json, os, sys, datetime
report, baseline_path, sha = sys.argv[1:]
r = json.load(open(report))
cases = ("full", "open")
if not all(r[c]["round_trip"] for c in cases):
    sys.exit("round trip failed: " + json.dumps(r))
base = json.load(open(baseline_path)) if os.path.exists(baseline_path) else {c: r[c] for c in cases}
def ratio(part):
    return sum(r[c][part] / base[c][part] for c in cases) / len(cases)
parts = {"encode": ratio("encode_ms"), "decode": ratio("decode_ms"), "bytes": ratio("bytes")}
score = 0.4 * parts["encode"] + 0.4 * parts["decode"] + 0.2 * parts["bytes"]
print(json.dumps({
    "goal": "hc-cache-codec",
    "score": round(score, 4),
    "higher_is_better": False,
    "parts": {
        **{f"{k}_ratio": round(v, 4) for k, v in parts.items()},
        **{f"{c}_{k}": r[c][k] for c in cases for k in
           ("encode_ms", "decode_ms", "bytes", "server_items", "pending_ops", "usuals", "round_trip")},
        "seed": r["seed"],
        "open_seed": r["open_seed"],
        "iterations": r["iterations"],
        "baseline_file": os.path.exists(baseline_path),
    },
    "git": sha,
    "at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
}))
PY
