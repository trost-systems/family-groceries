#!/usr/bin/env bash
# hc-ui-app score: the app's core screens rendered by the golden harness
# (test/design/screens_golden_test.dart, real fonts, DPR 1), rated by
# HC_JUDGES fresh `claude -p --model opus` sessions with judge-prompt.md.
# Score = min over categories of the judges' median. Prints one JSON line.
# Usage: tool/hillclimb/hc-ui-app/measure.sh   (HC_RUN_DIR to keep the run)
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"

if [ -z "${HC_LOCKED:-}" ]; then
  HC_LOCKED=1 exec flock /tmp/fg-hc-measure.lock "$0" "$@"
fi

judges="${HC_JUDGES:-3}"
run="${HC_RUN_DIR:-/tmp/hc102/runs/$(date +%Y%m%d-%H%M%S)-$$}"
mkdir -p "$run/shots"

shots=(
  login-light login-dark
  list-light list-dark
  list-empty-light list-empty-dark
  add-sheet-light add-sheet-dark
  add-sheet-compact-light
  edit-sheet-light edit-sheet-dark
  list-wide-light
  more-light more-dark
  settings-light settings-dark
  stores-light stores-dark
  store-details-light store-details-dark
)

goldens="$repo/app/test/design/goldens"
backup="$run/goldens-backup"
cp -a "$goldens" "$backup"
restore() { rm -rf "$goldens" && cp -a "$backup" "$goldens"; }
trap restore EXIT

render_ok=1
(cd "$repo/app" && flutter test --update-goldens test/design/screens_golden_test.dart) \
  >"$run/render.log" 2>&1 || render_ok=0
for s in "${shots[@]}"; do
  cp "$goldens/$s.png" "$run/shots/$s.png"
done
restore
trap - EXIT
rm -rf "$backup"

printf '%s.png\n' "${shots[@]}" >"$run/shots.txt"
schema="$(python3 - <<'PY'
import json
cats = ["contrast", "typography", "hierarchy", "spacing", "design_system", "accessibility", "layout"]
cat = {"type": "object", "additionalProperties": False, "required": ["score", "issues"],
       "properties": {"score": {"type": "number", "minimum": 1, "maximum": 10},
                      "issues": {"type": "array", "maxItems": 3, "items": {"type": "string"}}}}
print(json.dumps({"type": "object", "additionalProperties": False, "required": cats,
                  "properties": {c: cat for c in cats}}))
PY
)"

judge() {
  local k="$1" dir="$run/judge-$1"
  mkdir -p "$dir"
  cp "$run/shots/"*.png "$run/shots.txt" "$dir/"
  cp "$repo/docs/DESIGN.md" "$repo/design/tokens/hummlist.tokens.json" "$dir/"
  for attempt in 1 2; do
    (cd "$dir" && env -u CLAUDECODE -u CLAUDE_CODE_SESSION_ID -u CLAUDE_CODE_CHILD_SESSION \
      -u CLAUDE_CODE_MESSAGING_SOCKET -u CLAUDE_CODE_MESSAGING_TOKEN -u CLAUDE_CODE_ENTRYPOINT \
      timeout 900 "$HOME/groceries-ops/bin/cc" -p --model opus --no-session-persistence \
      --setting-sources '' --tools Read --output-format json --json-schema "$schema" \
      "$(cat "$here/judge-prompt.md")") >"$dir/out.json" 2>"$dir/err.log" || true
    if python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); assert d.get("structured_output")' \
      "$dir/out.json" 2>/dev/null; then return 0; fi
    echo "judge $k attempt $attempt failed" >>"$dir/err.log"
  done
}

for k in $(seq 1 "$judges"); do judge "$k" & done
wait

python3 - "$run" "$judges" "$render_ok" "$(git -C "$repo" rev-parse --short HEAD)" <<'PY'
import datetime, hashlib, json, os, statistics, sys
run, n, render_ok, sha = sys.argv[1], int(sys.argv[2]), sys.argv[3] == "1", sys.argv[4]
cats = ["contrast", "typography", "hierarchy", "spacing", "design_system", "accessibility", "layout"]
raw, errors = {}, 0
for k in range(1, n + 1):
    try:
        out = json.load(open(f"{run}/judge-{k}/out.json"))["structured_output"]
        raw[f"j{k}"] = {c: out[c]["score"] for c in cats}
    except Exception:
        errors += 1
digest = hashlib.sha256()
shots = open(f"{run}/shots.txt").read().split()
for s in shots:
    digest.update(open(f"{run}/shots/{s}", "rb").read())
medians = {c: statistics.median(j[c] for j in raw.values()) for c in cats} if raw else {}
score = min(medians.values()) if medians and render_ok else 0
print(json.dumps({
    "goal": "hc-ui-app",
    "score": score,
    "higher_is_better": True,
    "parts": {
        "medians": medians,
        "judges": raw,
        "judge_errors": errors,
        "render_ok": render_ok,
        "shots": len(shots),
        "shots_sha256": digest.hexdigest()[:16],
        "seed": "none: fixed shot order and prompt; LLM sampling has no seed flag",
        "run_dir": run,
    },
    "git": sha,
    "at": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
}, separators=(",", ":")))
PY
