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

# Job 132: the list-cache codec also on the JS web build, which Safari, every iOS browser and
# Firefox run (main.dart.js): its integers past 32 bits broke there while the VM tests passed.
# CI has google-chrome; elsewhere Playwright's Chromium stands in.
if [[ -z "${CHROME_EXECUTABLE:-}" ]] && ! command -v google-chrome >/dev/null; then
  for c in "$HOME"/.cache/ms-playwright/chromium-*/chrome-linux*/chrome \
    "$HOME"/Library/Caches/ms-playwright/chromium-*/chrome-mac*/Chromium.app/Contents/MacOS/Chromium; do
    [[ -x "$c" ]] && export CHROME_EXECUTABLE="$c"
  done
fi
flutter test --platform chrome test/list/snapshot_codec_test.dart

# Job 52: the Widgetbook (app/widgetbook/, its own package) under the same rules; its tests render
# every story in light and dark. scripts/widgetbook.sh builds it for the web.
cd "$REPO_ROOT/app/widgetbook"
flutter pub get >/dev/null
dart format --output=none --set-exit-if-changed lib test
flutter analyze --fatal-infos
flutter test
