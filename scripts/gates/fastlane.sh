#!/usr/bin/env bash
# The Gemfile.lock installs and the Fastfile parses (job 4).
set -euo pipefail
source "$(dirname "$0")/../lib.sh"
cd "$REPO_ROOT/app"
bundle check >/dev/null || bundle install
bundle exec fastlane lanes
