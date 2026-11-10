#!/usr/bin/env bash
# Drives one mapped feature on the launched instance and keeps its evidence: runs
# journeys/<feature-id>.mjs, which logs each step, captures PNG + ARIA snapshots and a video, and
# checks the stored result through the API. Prints the evidence dir; exit 0 only on PASS.
# A feature without a journey prints the e2e specs its feature file names instead (exit 3).
#
#   drive.sh <feature-id> [journey args, e.g. --lang en]
set -euo pipefail
source "$(dirname "$0")/env.sh"

feature="${1:-}"
[[ -n $feature ]] || { echo "usage: drive.sh <feature-id> [args]; ids: $(find "$VH_SKILL/features" -name '[a-z]*.md' -printf '%f\n' | sed 's/\.md$//' | sort | tr '\n' ' ')" >&2; exit 64; }
shift
[[ -f $VH_SKILL/features/$feature.md ]] || { echo "no feature $feature in $VH_SKILL/features/" >&2; exit 64; }
"$VH_HELPERS/doctor.sh" >/dev/null || { echo "doctor fails; run helpers/doctor.sh to see why" >&2; exit 1; }

journey="$VH_SKILL/journeys/$feature.mjs"
if [[ ! -f $journey ]]; then
  echo "no journey for $feature yet. Follow features/$feature.md by hand on $VH_WEB_URL, or run its e2e specs:"
  grep -o 'e2e/tests/[a-z0-9-]*\.spec\.ts' "$VH_SKILL/features/$feature.md" | sort -u | sed 's#^e2e/#  scripts/verify.sh --only e2e -- #'
  exit 3
fi

out="$VH_EVIDENCE_DIR/$(vh_json run)/$feature-$(date +%H%M%S)"
mkdir -p "$out"
echo "evidence: $out"
node "$journey" "$out" "$@"
