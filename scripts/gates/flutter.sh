#!/usr/bin/env bash
# Generated l10n matches the ARB files, format, analyze with infos as errors, unit and widget tests.
set -euo pipefail
source "$(dirname "$0")/../lib.sh"
cd "$REPO_ROOT/app"
flutter pub get >/dev/null
flutter gen-l10n
git diff --exit-code -- lib/l10n
dart format --output=none --set-exit-if-changed lib test
flutter analyze --fatal-infos
flutter test
