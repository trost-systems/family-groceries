#!/usr/bin/env bash
# The app's own Kotlin (the on-device speech check, job 4b) compiles in a debug APK.
set -euo pipefail
source "$(dirname "$0")/../lib.sh"
cd "$REPO_ROOT/app"
flutter build apk --debug
