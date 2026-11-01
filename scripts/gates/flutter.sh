#!/usr/bin/env bash
# Generated l10n matches the ARB files, format, analyze with infos as errors, unit and widget tests;
# the same for the Widgetbook (app/widgetbook/).
set -euo pipefail
source "$(dirname "$0")/../lib.sh"
no_posthog_in_ci
cd "$REPO_ROOT/app"
flutter pub get >/dev/null
flutter gen-l10n
git diff --exit-code -- lib/l10n
dart format --output=none --set-exit-if-changed lib test
flutter analyze --fatal-infos
flutter test

# Job 52: the Widgetbook (app/widgetbook/, its own package) under the same rules; its tests render
# every story in light and dark. scripts/widgetbook.sh builds it for the web.
cd "$REPO_ROOT/app/widgetbook"
flutter pub get >/dev/null
dart format --output=none --set-exit-if-changed lib test
flutter analyze --fatal-infos
flutter test
