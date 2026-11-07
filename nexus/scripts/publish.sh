#!/usr/bin/env bash
# Builds the nexus snapshot and static site into nexus/.vercel/output (Build Output API v3).
# Only with --deploy does it go on to deploy to production (nexus.hummlist.com): cron.sh passes it
# for main, and a by-hand deploy does. Without the flag it never reads the Vercel secrets.
# Usage: publish.sh [--deploy]. Env: NEXUS_OPS_DIR (default ~/groceries-ops).
set -euo pipefail
deploy=false
case "$#:${1:-}" in
  0:) ;;
  1:--deploy) deploy=true ;;
  *) echo "usage: publish.sh [--deploy]" >&2; exit 64 ;;
esac
# Children get fd 9 (the publish lock) closed, so none can outlive the run holding the lock.
run() { "$@" 9>&-; }
if $deploy && [[ -z ${NEXUS_PUBLISH_LOCKED:-} ]]; then
  # One deploy at a time with the cron (cron.sh holds this lock and sets NEXUS_PUBLISH_LOCKED).
  exec 9>/tmp/nexus-publish.lock
  flock -n 9 || { echo "another nexus publish is running (/tmp/nexus-publish.lock)" >&2; exit 75; }
fi
NEXUS="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$NEXUS/.." && pwd)"
OPS="${NEXUS_OPS_DIR:-$HOME/groceries-ops}"
OUT="$NEXUS/.vercel/output"
STATIC="$OUT/static"

rm -rf "$OUT"
mkdir -p "$STATIC/data" "$STATIC/fonts"
cd "$NEXUS"
run deno run --allow-all pipeline/main.ts --ops "$OPS" --repo "$REPO" --out "$STATIC/data/snapshot.json"
run deno bundle --quiet --platform browser --minify -o "$STATIC/app.js" web/main.ts
run deno run --allow-read --allow-write scripts/theme.ts "$REPO/site/public/tokens.css" "$STATIC/theme.css"
run deno run --allow-write scripts/vercel-config.ts "$OUT/config.json"
cp web/index.html web/styles.css "$STATIC/"
cp "$REPO/site/public/favicon.svg" "$STATIC/"
cp "$REPO/site/public/fonts/inter-latin-wght-normal.woff2" \
  "$REPO/site/public/fonts/bricolage-grotesque-latin-standard-normal.woff2" "$STATIC/fonts/"
echo "nexus: built $OUT"
if ! $deploy; then
  echo "skip deploy: no --deploy"
  exit 0
fi

# The token is loaded only here, in a subshell, so the pipeline above (gh, the ops dir) never has it.
NEXUS_ENV="${NEXUS_ENV:-$HOME/.config/agents/nexus.env}"
(
  if [[ -z ${VERCEL_TOKEN:-} && -f $NEXUS_ENV ]]; then
    set -a
    # shellcheck source=/dev/null # host file, not in the repo
    source "$NEXUS_ENV"
    set +a
  fi
  if [[ -z ${VERCEL_TOKEN:-} ]]; then
    echo "skip deploy: no VERCEL_TOKEN"
    exit 0
  fi
  : "${VERCEL_ORG_ID:?set VERCEL_ORG_ID with VERCEL_TOKEN}" "${VERCEL_PROJECT_ID:?set VERCEL_PROJECT_ID with VERCEL_TOKEN}"
  # Never publish an unprotected page: the project must have Vercel Authentication on all deployments.
  protection="$(run curl -sS -H "Authorization: Bearer $VERCEL_TOKEN" \
    "https://api.vercel.com/v9/projects/$VERCEL_PROJECT_ID?teamId=$VERCEL_ORG_ID" | jq -r '.ssoProtection.deploymentType // "none"')"
  if [[ $protection != all ]]; then
    echo "refuse deploy: project protection is '$protection', not 'all' (run setup-vercel.sh)" >&2
    exit 1
  fi
  # VERCEL_TOKEN is read from the environment, never passed on the command line.
  run npx --yes vercel@65.12.1 deploy --prebuilt --prod --non-interactive --cwd "$NEXUS"
)
