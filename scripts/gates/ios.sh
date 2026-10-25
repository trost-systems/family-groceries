#!/usr/bin/env bash
# The app's own Swift (the on-device speech check, job 4b) compiles for the simulator. Needs macOS.
set -euo pipefail
source "$(dirname "$0")/../lib.sh"
cd "$REPO_ROOT/app"
flutter build ios --simulator --debug
