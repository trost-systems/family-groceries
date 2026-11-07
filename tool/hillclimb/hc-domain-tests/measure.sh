#!/usr/bin/env bash
# Job 128 (hc-domain-tests): score = line coverage of the scoped domain files x mutation score on
# a seeded sample of their mutants, higher is better. Prints one JSON line on stdout; progress goes
# to stderr. docs/hillclimb/hc-domain-tests.md explains it.
#   NO_CACHE=1 re-runs the mutants even when the tree's mutation result is cached.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"
app="$repo/app"
export PATH="${FLUTTER_DIR:-$HOME/flutter}/bin:$PATH"
export PYTHONDONTWRITEBYTECODE=1
work="$(mktemp -d /tmp/hc128-measure.XXXXXX)"
trap 'rm -rf "$work"' EXIT
scope=$(python3 -c 'import sys; sys.path.insert(0, sys.argv[1]); import mutate; print(" ".join(mutate.TARGETS))' "$here")

cd "$app"
flutter pub get >/dev/null 2>&1

# Compact reporter's last line, e.g. "01:43 +1737 ~88 -4: Some tests failed."
counts() { tr '\r' '\n' <"$1" | grep -E '^[0-9:]+ \+[0-9]+' | tail -1 |
  sed -E 's/^[0-9:]+ \+([0-9]+)( ~([0-9]+))?( -([0-9]+))?:.*/\1 \3 \5/'; }

rm -rf coverage
# Informational only: the suite's wall time, on the monotonic clock, under the shared lock.
wall=$(flock /tmp/fg-hc-measure.lock python3 -c '
import subprocess, sys, time
t = time.monotonic()
with open(sys.argv[1], "w") as log:
    subprocess.run(["flutter", "test", "--no-pub", "--coverage", "--reporter=compact"], stdout=log, stderr=log)
print(round(time.monotonic() - t, 2))
' "$work/cov.log")
read -r passed skipped failed <<<"$(counts "$work/cov.log")"
# grep exits 1 on a suite without failures, which pipefail would turn into an exit.
failed_names=$(tr '\r' '\n' <"$work/cov.log" | { grep -E ' \[E\] *$' || true; } |
  sed -E 's/^.*\/app\/test\///; s/ \[E\] *$//' | sort -u | paste -sd ';' -)

cov=$(python3 - "$app/coverage/lcov.info" $scope <<'EOF'
import json, sys
lcov, scope = sys.argv[1], sys.argv[2:]
per, cur = {}, None
for line in open(lcov):
    if line.startswith('SF:'):
        path = line[3:].strip()
        cur = next((s for s in scope if path.endswith(s)), None) or ('*' + path)
        per.setdefault(cur, [0, 0])
    elif line.startswith('DA:'):
        per[cur][0] += 1
        per[cur][1] += int(line.strip().split(',')[1]) > 0
missing = [s for s in scope if s not in per]
if missing:
    sys.exit(f'scoped files missing from lcov: {missing}')
lf = sum(per[s][0] for s in scope)
lh = sum(per[s][1] for s in scope)
alf = sum(v[0] for v in per.values())
alh = sum(v[1] for v in per.values())
print(json.dumps({'coverage_pct': round(100 * lh / lf, 2), 'lines_found': lf, 'lines_hit': lh,
                  'per_file': {s: f'{per[s][1]}/{per[s][0]}' for s in scope},
                  'app_coverage_pct': round(100 * alh / alf, 2), 'app_lcov_files': len(per)}))
EOF
)
echo "coverage: $cov" >&2

# The mutants' fate depends only on these inputs, so an unchanged tree reuses its result.
key=$(cd "$repo" && git ls-files --cached --others --exclude-standard -- app/lib app/test \
  app/pubspec.lock tool/hillclimb/hc-domain-tests/mutants.tsv \
  tool/hillclimb/hc-domain-tests/equivalent.tsv tool/hillclimb/hc-domain-tests/mutate.py |
  LC_ALL=C sort | while read -r f; do [[ -f "$f" ]] && sha256sum "$f"; done | sha256sum | cut -c1-16)
cache="/tmp/hc128-mutation-cache/$key.json"
if [[ "${NO_CACHE:-}" != 1 && -s "$cache" ]]; then
  mut=$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); d["mutation_cached"]=sys.argv[2]; print(json.dumps(d))' "$cache" "$key")
else
  # The whole repository: tests read fixtures beside app/ (../supabase/tests, ../docs, ...).
  # Without app/ios and app/android the test/app/ config tests fail in the copy; mutate.py
  # subtracts failures the unmutated tree has, and no scoped file's tests reach them.
  mkdir -p "$work/repo" /tmp/hc128-mutation-cache
  (cd "$repo" && tar cf - --exclude=./.git --exclude=./app/build --exclude=./app/coverage \
    --exclude=./app/ios --exclude=./app/android --exclude=./app/linux --exclude=./app/widgetbook \
    --exclude=node_modules --exclude=./app/test/design/failures . ) | tar xf - -C "$work/repo"
  mut=$(python3 "$here/mutate.py" run "$work/repo/app")
  echo "$mut" >"$cache"
fi
echo "mutation: $mut" >&2

python3 - "$cov" "$mut" "$passed" "${skipped:-0}" "${failed:-0}" "$failed_names" \
  "$(git -C "$repo" rev-parse --short HEAD)" "$wall" "$scope" <<'EOF'
import datetime, json, sys
cov, mut = json.loads(sys.argv[1]), json.loads(sys.argv[2])
passed, skipped, failed, failed_names, sha, wall, scope = sys.argv[3:10]
score = cov['coverage_pct'] * mut['mutation_score']
print(json.dumps({
    'goal': 'hc-domain-tests', 'score': round(score, 3), 'higher_is_better': True,
    'parts': {**cov, **mut, 'scoped_files': scope.split(),
              'suite_wall_s': float(wall), 'tests_passed': int(passed),
              'tests_skipped': int(skipped or 0), 'tests_failed': int(failed or 0),
              'failed_tests': failed_names,
              'score_unit': 'domain coverage_pct x mutation_score (killed / (total - equivalent - invalid))'},
    'git': sha, 'at': datetime.datetime.now().astimezone().isoformat(timespec='seconds')}))
EOF
