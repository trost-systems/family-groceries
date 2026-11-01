#!/usr/bin/env bash
# Runs the CI gates (scripts/gates/<gate>.sh, the same scripts the ci.yml jobs run) locally.
# Usage: scripts/verify.sh [--only <gate>[,<gate>...]] [--skip-e2e] [--screenshots <dir>] [-- <playwright args>]
#   --only e2e -- tests/list.spec.ts   runs one spec file under the box-wide e2e lock
set -euo pipefail
source "$(dirname "$0")/lib.sh"

# Every gate, in the order a local run takes them: cheap and independent first, e2e last.
GATES=(gitleaks lint changelog site emails db functions fg-cli flutter web-prod fastlane e2e)
# CI-only: iOS needs macOS, and a Gradle build takes more RAM than the shared box spares.
# They still run on request with --only.
CI_ONLY=(android ios)

only=""
skip_e2e=0
e2e_args=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --only) only="$2"; shift 2 ;;
    --skip-e2e) skip_e2e=1; shift ;;
    --screenshots) SCREENSHOT_DIR="$(realpath -m "$2")"; export SCREENSHOT_DIR; shift 2 ;;
    --) shift; e2e_args=("$@"); break ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [[ -n $only ]]; then
  IFS=, read -ra run <<<"$only"
  for gate in "${run[@]}"; do
    [[ -x "$REPO_ROOT/scripts/gates/$gate.sh" ]] || { echo "no gate '$gate'; gates: ${GATES[*]} ${CI_ONLY[*]}" >&2; exit 2; }
  done
else
  run=("${GATES[@]}")
fi

passed=()
for gate in "${run[@]}"; do
  if [[ $gate == e2e && $skip_e2e == 1 ]]; then
    log "skipping e2e"
    continue
  fi
  log "gate: $gate"
  if [[ $gate == e2e ]]; then
    "$REPO_ROOT/scripts/gates/e2e.sh" "${e2e_args[@]}"
  else
    "$REPO_ROOT/scripts/gates/$gate.sh"
  fi
  passed+=("$gate")
done
log "passed: ${passed[*]}"
