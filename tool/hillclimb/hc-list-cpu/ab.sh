#!/usr/bin/env bash
# hc-list-cpu (job 130): the paired keep decision from attempt 8 on (docs/hillclimb/hc-list-cpu.md,
# "Decision rule under load"). Alternates measure.sh on HEAD and on the working tree's diff
# of app/, waiting up to 3 min before each run for a 1-minute load below 10.
#
#   tool/hillclimb/hc-list-cpu/ab.sh <label> [pairs]    # pairs: default 3
#
# Appends "<label>-head<i>|cand<i> load=<before>/<after> <json>" lines to $HC130_RUNS
# (default /tmp/hc130-runs.jsonl) and prints both medians and the pair deltas. Leaves the
# candidate applied.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
label="$1"
pairs="${2:-3}"
runs="${HC130_RUNS:-/tmp/hc130-runs.jsonl}"
patch="$(mktemp /tmp/hc130-cand.XXXXXX)"
trap 'rm -f "$patch"' EXIT
cd "$root"
git diff -- app >"$patch"
[ -s "$patch" ] || { echo "ab: no candidate diff under app/" >&2; exit 1; }

measure() {
  for _ in $(seq 36); do
    awk '{exit !($1 < 10)}' /proc/loadavg && break
    sleep 5
  done
  local before out
  before="$(cut -d' ' -f1 /proc/loadavg)"
  out="$("$here/measure.sh" 2>/dev/null)"
  echo "$1 load=$before/$(cut -d' ' -f1 /proc/loadavg) $out" >>"$runs"
}

for i in $(seq "$pairs"); do
  git apply -R "$patch"
  measure "$label-head$i"
  git apply "$patch"
  measure "$label-cand$i"
done

python3 - "$label" "$runs" <<'PY'
import json, statistics, sys
label, path = sys.argv[1], sys.argv[2]
head, cand = [], []
for line in open(path):
    name, _, js = line.split(" ", 2)
    if name.startswith(label + "-head"):
        head.append(json.loads(js)["score"])
    elif name.startswith(label + "-cand"):
        cand.append(json.loads(js)["score"])
h, c = statistics.median(head), statistics.median(cand)
print(f"head {head} median {h}")
print(f"cand {cand} median {c} ({100 * (c / h - 1):+.1f} %)")
print("pair deltas", [round(b - a, 4) for a, b in zip(head, cand)])
PY
