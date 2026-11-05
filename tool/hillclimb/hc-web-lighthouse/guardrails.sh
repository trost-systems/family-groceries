#!/usr/bin/env bash
# The regression gate for a hill-climb step (job 129): analyze, the whole app test suite, the
# generated icon and splash files against their generator, and no edit under the paths this
# goal must not touch.
set -euo pipefail
root="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$root"
forbidden='^(app/l10n/|legal/|site/|alexa/|app/lib/siri/|app/ios/|app/fastlane/|releases/flags.json|supabase/|vercel.json|app/pubspec.yaml)'
if git diff --name-only origin/main -- | grep -E "$forbidden"; then
  echo "guardrails: the files above are off limits for this goal" >&2
  exit 1
fi
node design/app-icon/build.mjs --check
cd app
flutter analyze
flutter test --reporter=compact 2>&1 | tr '\r' '\n' | grep -v '^\s*$' | tail -3
