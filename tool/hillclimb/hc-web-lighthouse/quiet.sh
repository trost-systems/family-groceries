#!/usr/bin/env bash
# Runs measure.sh once the host is about as quiet as during the baseline (1-minute load below
# $HC129_MAX_LOAD, default 6, twice 20 s apart), and adds the load before and after to its JSON
# line. The gate is read before measure.sh builds, so the 1-2 min build adds to the load between
# the gate and Lighthouse; build the tree once beforehand to keep that build short.
#
#   tool/hillclimb/hc-web-lighthouse/quiet.sh [runs]
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
max="${HC129_MAX_LOAD:-6}"
(cd "$here/../../../app" && flock /tmp/flutter-build-web.lock true)
quiet() { awk -v max="$max" '{ exit !($1 < max) }' /proc/loadavg; }
until quiet && sleep 20 && quiet; do sleep 15; done
before="$(cut -d' ' -f1 /proc/loadavg)"
line="$("$here/measure.sh" "$@")"
after="$(cut -d' ' -f1 /proc/loadavg)"
python3 -I -c 'import json, sys; d = json.loads(sys.argv[1]); d["parts"]["load_before"] = float(sys.argv[2]); d["parts"]["load_after"] = float(sys.argv[3]); print(json.dumps(d))' "$line" "$before" "$after"
