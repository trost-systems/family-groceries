#!/usr/bin/env bash
# HC hc-web-lighthouse (job 129): Lighthouse Performance of the Flutter web app (higher is
# better). Builds the app like Vercel (--wasm, no CDN), serves it on 127.0.0.1 with vercel.json's
# headers and brotli, signs in against fake_supabase.py, and runs Lighthouse (desktop preset,
# simulated throttling) on the list and the /add sheet. Prints one JSON line on stdout; logs go
# to stderr. docs/hillclimb/hc-web-lighthouse.md explains the score.
#
#   tool/hillclimb/hc-web-lighthouse/measure.sh [runs]     # runs: Lighthouse runs per page, default 3
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
runs="${1:-3}"
web_port=62980
supabase_port=62981
export PATH="$HOME/flutter/bin:$PATH"

work="$(mktemp -d /tmp/hc129-measure.XXXXXX)"
# The final screenshots of the last measurement, to check by eye that each page reached its state.
shots=/tmp/hc129-last
rm -rf "$shots" && mkdir -p "$shots"
fake=""
cleanup() {
  if [[ -n $fake ]]; then kill "$fake" 2>/dev/null || true; fi
  rm -rf "$work"
}
trap cleanup EXIT

(cd "$here" && npm ci --no-audit --no-fund --silent >&2)
cd "$root/app"
flutter pub get >/dev/null
echo "measure: building the web app" >&2
flock /tmp/flutter-build-web.lock flutter build web --release --no-web-resources-cdn --wasm --base-href / \
  --output build/web-hc \
  --dart-define=SUPABASE_URL="http://127.0.0.1:$supabase_port" \
  --dart-define=SUPABASE_PUBLISHABLE_KEY=sb_publishable_probe \
  --dart-define-from-file=config/auth.json >"$work/build.log" 2>&1 || { tail -40 "$work/build.log" >&2; exit 1; }

python3 -I "$here/fake_supabase.py" "$supabase_port" 2>"$work/fake.log" &
fake=$!
echo "measure: $runs Lighthouse runs per page under /tmp/fg-hc-measure.lock" >&2
results="$(flock /tmp/fg-hc-measure.lock node "$here/lighthouse.mjs" "$root/app/build/web-hc" \
  "$web_port" "$supabase_port" "$runs" "$shots")"
if [[ -s $work/fake.log ]]; then cat "$work/fake.log" >&2; fi

python3 -I - "$results" "$runs" \
  "$(git -C "$root" rev-parse --short HEAD)$(git -C "$root" diff --quiet HEAD -- app || echo -dirty)" <<'EOF'
import datetime, json, statistics, sys
results, runs, sha = json.loads(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
for page, rows in results.items():
    for row in rows:
        if not row["ready"] or row["runtime_error"] or row["performance"] is None:
            sys.exit(f"measure: {page} did not reach its state: {row}")
# One run's score is the mean of its pages' Performance; the score is the median run.
per_run = [statistics.mean(results[p][i]["performance"] for p in results) for i in range(runs)]
parts = {"runs": per_run, "seed": 0, "profile": "lighthouse 13.6.0 desktop, simulated throttling"}
for page, rows in results.items():
    for key in rows[0]:
        if key in ("ready", "runtime_error"):
            continue
        parts[f"{page}_{key}"] = round(statistics.median(r[key] for r in rows), 4)
print(json.dumps({
    "goal": "hc-web-lighthouse",
    "score": statistics.median(per_run),
    "higher_is_better": True,
    "parts": parts,
    "git": sha,
    "at": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
}))
EOF
