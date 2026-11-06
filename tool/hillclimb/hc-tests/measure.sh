#!/usr/bin/env bash
# Job 98 (hc-tests): score = line coverage x mutation score / suite wall seconds, higher is better.
# Prints one JSON line on stdout; progress goes to stderr. docs/hillclimb/hc-tests.md explains it.
#   WALL_RUNS=3 (timed plain `flutter test` runs, median), SKIP_MUTATION=1 for a quick look.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"
app="$repo/app"
export PATH="${FLUTTER_DIR:-$HOME/flutter}/bin:$PATH"
export PYTHONDONTWRITEBYTECODE=1
wall_runs="${WALL_RUNS:-3}"
work="$(mktemp -d /tmp/hc98-measure.XXXXXX)"
trap 'rm -rf "$work"' EXIT

cd "$app"
flutter pub get >/dev/null 2>&1

# Compact reporter's last line, e.g. "01:43 +1737 ~88 -4: Some tests failed."
counts() { tr '\r' '\n' <"$1" | grep -E '^[0-9:]+ \+[0-9]+' | tail -1 |
  sed -E 's/^[0-9:]+ \+([0-9]+)( ~([0-9]+))?( -([0-9]+))?:.*/\1 \3 \5/'; }

walls=()
guard_log="$HOME/groceries-ops/mem-guard.log"
paused_during() { tail -n +"$(($1 + 1))" "$guard_log" 2>/dev/null | grep -qE 'paused (newest job 98-hc-tests|all)'; }
for i in $(seq "$wall_runs"); do
  log="$work/wall$i.log"
  # mem-guard SIGSTOPs this job's processes under memory pressure, which the clock would count:
  # a run it paused is timed again (at most 3 tries).
  for try in 1 2 3; do
    mark=$(wc -l <"$guard_log" 2>/dev/null || echo 0)
    # Monotonic clock: the VM gets frozen now and then, and wall-clock time jumps over it.
    secs=$(flock /tmp/fg-hc-measure.lock python3 -c '
import subprocess, sys, time
t = time.monotonic()
with open(sys.argv[1], "w") as log:
    subprocess.run(["flutter", "test", "--no-pub", "--reporter=compact"], stdout=log, stderr=log)
print(round(time.monotonic() - t, 2))
' "$log")
    paused_during "$mark" || break
    echo "wall run $i try $try: ${secs}s, paused by mem-guard, timing again" >&2
  done
  walls+=("$secs")
  echo "wall run $i: ${secs}s ($(counts "$log"))" >&2
done
read -r passed skipped failed <<<"$(counts "$work/wall$wall_runs.log")"
failed_names=$(tr '\r' '\n' <"$work/wall$wall_runs.log" | grep -E ' \[E\] *$' |
  sed -E 's/^.*\/app\/test\///; s/ \[E\] *$//' | sort -u | paste -sd ';' - || true)

rm -rf coverage
flutter test --no-pub --coverage --reporter=compact >"$work/cov.log" 2>&1 || true
cov=$(python3 - "$app/coverage/lcov.info" <<'EOF'
import json, sys
files, lf, lh = 0, 0, 0
for line in open(sys.argv[1]):
    if line.startswith('SF:'):
        files += 1
    elif line.startswith('DA:'):
        lf += 1
        lh += int(line.strip().split(',')[1]) > 0
print(json.dumps({'lines_found': lf, 'lines_hit': lh, 'lcov_files': files,
                  'coverage_pct': round(100 * lh / lf, 2)}))
EOF
)
echo "coverage: $cov" >&2

if [[ "${SKIP_MUTATION:-}" == 1 ]]; then
  mut='{"mutation_score": 1, "skipped": true}'
else
  # The mutants' fate depends only on these inputs, so an unchanged tree reuses its result.
  key=$(cd "$repo" && git ls-files --cached --others --exclude-standard -- app/lib app/test \
    app/pubspec.lock tool/hillclimb/hc-tests/mutants.tsv tool/hillclimb/hc-tests/equivalent.tsv \
    tool/hillclimb/hc-tests/mutate.py |
    LC_ALL=C sort | while read -r f; do [[ -f "$f" ]] && sha256sum "$f"; done | sha256sum | cut -c1-16)
  cache="/tmp/hc98-mutation-cache/$key.json"
fi
if [[ "${SKIP_MUTATION:-}" == 1 ]]; then :
elif [[ -s "$cache" ]]; then
  mut=$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); d["mutation_cached"]=sys.argv[2]; print(json.dumps(d))' "$cache" "$key")
else
  # The whole repository: tests read fixtures beside app/ (../supabase/tests, ../docs, ...).
  mkdir -p "$work/repo" /tmp/hc98-mutation-cache
  (cd "$repo" && tar cf - --exclude=./.git --exclude=./app/build --exclude=./app/coverage \
    --exclude=./app/ios --exclude=./app/android --exclude=./app/linux --exclude=./app/widgetbook \
    --exclude=node_modules --exclude=./app/test/design/failures . ) | tar xf - -C "$work/repo"
  mut=$(python3 "$here/mutate.py" run "$work/repo/app")
  echo "$mut" >"$cache"
fi
echo "mutation: $mut" >&2

python3 - "$cov" "$mut" "$passed" "${skipped:-0}" "${failed:-0}" "$failed_names" \
  "$(git -C "$repo" rev-parse --short HEAD)" "${walls[@]}" <<'EOF'
import datetime, json, statistics, sys
cov, mut = json.loads(sys.argv[1]), json.loads(sys.argv[2])
passed, skipped, failed, failed_names, sha = sys.argv[3:8]
walls = [float(w) for w in sys.argv[8:]]
wall = statistics.median(walls)
score = cov['coverage_pct'] / 100 * mut['mutation_score'] / wall * 1000
print(json.dumps({
    'goal': 'hc-tests', 'score': round(score, 4), 'higher_is_better': True,
    'parts': {'coverage_pct': cov['coverage_pct'], 'lines_hit': cov['lines_hit'],
              'lines_found': cov['lines_found'], 'lcov_files': cov['lcov_files'],
              'wall_s': wall, 'wall_runs': walls,
              'tests_passed': int(passed), 'tests_skipped': int(skipped or 0),
              'tests_failed': int(failed or 0), 'failed_tests': failed_names,
              **{k: v for k, v in mut.items()}, 'score_unit': 'cov x mut / wall_s x 1000'},
    'git': sha, 'at': datetime.datetime.now().astimezone().isoformat(timespec='seconds')}))
EOF
