#!/usr/bin/env bash
# The guides site on hummlist.com (site/, job 24a): build checks and tests, a production build
# (fails on a `[PETER:` placeholder), and no real access token anywhere in the repo.
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
VERCEL_ENV=production npm run build
