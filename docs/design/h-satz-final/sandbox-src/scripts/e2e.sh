#!/usr/bin/env bash
# Builds dist/ and runs Playwright against `vite preview` on :4189.
# One browser run at a time: flock serialises runs from this sandbox, the pgrep loop waits out other jobs on the box.
set -euo pipefail
cd "$(dirname "$0")/.."
exec 9>/tmp/fg-design-sandbox-e2e.lock
flock 9
# Match real runners and browsers only: other jobs' wrapper shells mention "playwright test" in their command line.
# A CDP-attached runtime daemon (sand-playwright-runtime) lives for the whole session and owns no browser; it is not a run.
while pgrep -f '^node .*playwright|chrome-headless-shell|ms-playwright/chromium' | grep -vxE "$(pgrep -f sand-playwright-runtime | paste -sd'|' -)" | grep -q .; do
  echo "another Playwright run is active; waiting 60s"
  sleep 60
done
npx vite build --logLevel warn
npx playwright test "$@"
