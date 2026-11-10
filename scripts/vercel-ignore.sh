#!/usr/bin/env bash
# Vercel's Ignored Build Step for the web app (vercel.json's ignoreCommand, which overrides the
# project setting): exit 0 skips the build, 1 builds, and any other code fails the deployment.
# Only release builds, and only when the app changed since the last production deployment. A
# previous commit that is empty or missing from Vercel's 10-commit clone builds (job 180).
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

case "${VERCEL_GIT_COMMIT_REF:-}" in
  release | "") ;;
  *) echo "vercel-ignore: skip, only release builds"; exit 0 ;;
esac
prev="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [[ -z $prev ]] || ! git cat-file -e "$prev^{commit}" 2>/dev/null; then
  echo "vercel-ignore: build, previous commit '${prev}' is not in the clone"
  exit 1
fi
if git diff --quiet "$prev" HEAD -- app ':!app/test' vercel.json scripts/vercel.sh scripts/vercel-ignore.sh scripts/join-config.sh; then
  echo "vercel-ignore: skip, the app is unchanged since $prev"
  exit 0
fi
echo "vercel-ignore: build, the app changed since $prev"
exit 1
