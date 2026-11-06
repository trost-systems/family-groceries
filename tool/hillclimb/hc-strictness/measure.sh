#!/usr/bin/env bash
# hc-strictness score: findings left under the Dart pack (flutter_agent_lints, experimental) and the
# TypeScript pack (tool/lint/ts/pack.ts, every non-off rule). Lower is better; 0 is the target.
# Prints one JSON line. HC_SUITES=0 skips the guardrail suites (suites_green is then null).
set -euo pipefail
cd "$(dirname "$0")/../../.."
log=$(mktemp -d)
trap 'rm -rf "$log"' EXIT

# The target rule set frozen at the baseline; turning a rule off to win fails the measurement.
target_sha=9ef068bcb2b4cb7a

dart_issues() {
  (cd "$1" && flutter pub get >/dev/null 2>&1 && flutter analyze --no-fatal-infos --no-fatal-warnings 2>&1 || true) |
    grep -cE '^ *(error|warning|info) • ' || true
}
dart_app=$(dart_issues app)
dart_widgetbook=$(dart_issues app/widgetbook)
dart_ignores=$(git grep -nE '// ?ignore(_for_file)?:' -- 'app/*.dart' ':!app/lib/l10n/app_localizations*.dart' | wc -l || true)
dart_pack=$(grep -c '^include: package:flutter_agent_lints/experimental.yaml' app/analysis_options.yaml app/widgetbook/analysis_options.yaml | awk -F: '{s+=$2} END {print s}')

ts_json=$(deno run -A tool/lint/ts/strict.ts --target)
ts_sha=$(jq -r '.target_rules | join(",")' <<<"$ts_json" | sha256sum | cut -c1-16)
if [[ "$ts_sha" != "$target_sha" ]]; then
  echo "measure: the TypeScript pack's target rules changed ($ts_sha, baseline $target_sha); re-baseline" >&2
  exit 1
fi

suites=null
if [[ "${HC_SUITES:-1}" != 0 ]]; then
  suites=true
  for gate in flutter functions fg-cli site lint; do
    scripts/gates/$gate.sh >"$log/$gate.log" 2>&1 || { suites=false; echo "measure: gate $gate failed ($log kept)" >&2; trap - EXIT; }
  done
  # The pack's own enforced rules, as the lint gate runs them.
  deno run -A tool/lint/ts/strict.ts >"$log/strict.log" 2>&1 || { suites=false; echo "measure: tool/lint/ts enforced rules fail" >&2; }
fi

dart_violations=$((dart_app + dart_widgetbook + dart_ignores + (2 - dart_pack)))
ts_violations=$(jq .violations <<<"$ts_json")
jq -cn \
  --argjson dart "$dart_violations" --argjson ts "$ts_violations" \
  --argjson dart_app "$dart_app" --argjson dart_widgetbook "$dart_widgetbook" \
  --argjson dart_ignores "$dart_ignores" --argjson dart_pack "$dart_pack" \
  --argjson tsj "$ts_json" --arg sha "$ts_sha" --argjson suites "$suites" \
  --arg git "$(git rev-parse --short HEAD)" --arg at "$(date -Iseconds)" \
  '{goal: "hc-strictness", score: ($dart + $ts), higher_is_better: false,
    parts: {dart_violations: $dart, ts_violations: $ts,
      dart: {app: $dart_app, widgetbook: $dart_widgetbook, handwritten_ignores: $dart_ignores, packages_on_pack: $dart_pack},
      ts_files: $tsj.files, ts_target_rules: ($tsj.target_rules | length), ts_enforced_rules: $tsj.enforced,
      ts_target_sha: $sha, rule_counts: $tsj.rule_counts, suites_green: $suites, seed: null},
    git: $git, at: $at}'
