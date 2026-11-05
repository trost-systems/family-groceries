#!/usr/bin/env bash
# The app's own Kotlin (the on-device speech check, job 4b) compiles in a debug APK, and its JVM
# unit tests (the home widget's payload, job 63) pass.
set -euo pipefail
source "$(dirname "$0")/../lib.sh"
cd "$REPO_ROOT/app"
flutter build apk --debug
# The Flutter build writes the Gradle wrapper (not committed).
(cd android && ./gradlew --no-daemon :app:testDebugUnitTest)
