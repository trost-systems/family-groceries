#!/usr/bin/env bash
# The app's own Kotlin (the on-device speech check, job 4b) compiles in a debug APK, and its JVM
# unit tests (the home widget's payload parser, job 63) pass.
set -euo pipefail
source "$(dirname "$0")/../lib.sh"
cd "$REPO_ROOT/app"
flutter build apk --debug
# The Flutter build writes the Gradle wrapper (not committed).
results=build/app/test-results/testDebugUnitTest
rm -rf "$results"
(cd android && ./gradlew --no-daemon --console=plain :app:testDebugUnitTest)
# A task that ran no test leaves no report; say which suites ran, so the log proves it.
shopt -s nullglob
reports=("$results"/*.xml)
[[ ${#reports[@]} -gt 0 ]] || { echo "android: no JVM unit test reports in app/$results" >&2; exit 1; }
grep -ho '<testsuite name="[^"]*" tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' "${reports[@]}" \
  | sed 's/^<testsuite /android unit tests: /'
