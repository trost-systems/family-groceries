#!/usr/bin/env bash
# The guides site on hummlist.com (site/, job 24a): build checks and tests, a build, and no real
# access token anywhere in the repo. The build only warns on a `[PETER:` placeholder; Vercel's
# production build fails on one, so a page with open facts never reaches hummlist.com (job 33a).
set -euo pipefail
source "$(dirname "$0")/../lib.sh"
cd "$REPO_ROOT"
if git grep -nE 'fgp_[A-Za-z0-9_-]{43}'; then
  echo "site: a real personal access token (fgp_ + 43 characters) is committed; use fgp_… instead" >&2
  exit 1
fi
cd site
npm ci --no-audit --no-fund
npm test
npm run build
