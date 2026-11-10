#!/usr/bin/env bash
# The Snacklist mails (emails/, job 55): type checks (2 to 4 steps, snacklist.app images only),
# every mail renders under 100 KB with plain text, the auth mails keep the hosted wording and
# Supabase's template variables, the footers Legal Review asked for, and supabase/templates/ plus
# config.toml's template block are exactly what emails/ builds.
set -euo pipefail
source "$(dirname "$0")/../lib.sh"
cd "$REPO_ROOT/emails"
npm ci --no-audit --no-fund
npm test
