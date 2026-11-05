#!/usr/bin/env bash
# hc-ui-app guardrails for a step: copy and forbidden paths untouched since
# main, flutter analyze clean, the whole app test suite green (goldens
# included, as committed). Exits non-zero on the first failure.
set -euo pipefail

repo="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$repo"
base="$(git merge-base HEAD origin/main)"

forbidden='^(app/l10n/|app/lib/l10n/|legal/|site/|alexa/|app/lib/siri/|app/ios/|app/android/|app/fastlane/|releases/|supabase/|app/lib/purchases/revenuecat_repository.dart|app/lib/analytics/flags.dart)'
touched="$( (git diff --name-only "$base"; git diff --name-only; git ls-files --others --exclude-standard) | sort -u)"
if bad="$(grep -E "$forbidden" <<<"$touched")"; then
  echo "guardrail: forbidden path changed:" >&2
  echo "$bad" >&2
  exit 1
fi

# User-visible string literals: no added or removed line in app/lib may carry
# a quoted literal with letters other than keys, imports and asset paths.
if git diff "$base" -- app/lib | grep -E '^[+-][^+-]' |
  grep -vE "import |ValueKey\(|Key\(|assets/|//" |
  grep -E "'[^']*[A-Za-zÄÖÜäöüß]{2,}[^']*'" >/tmp/hc102-strings.txt; then
  echo "guardrail: changed lines with string literals (check them by hand):" >&2
  cat /tmp/hc102-strings.txt >&2
  [ -n "${HC_STRINGS_OK:-}" ] || exit 1
fi

cd app
flutter analyze --no-pub 2>&1 | tail -3
flutter test --no-pub -r failures-only 2>&1 | tail -5
cd widgetbook
flutter test -r failures-only 2>&1 | tail -3
