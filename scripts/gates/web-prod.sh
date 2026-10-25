#!/usr/bin/env bash
# The web app builds with the production config (what Vercel ships), into its own directory so
# it never replaces the e2e build in app/build/web.
set -euo pipefail
source "$(dirname "$0")/../lib.sh"
cd "$REPO_ROOT/app"
flutter pub get >/dev/null
flutter build web --release --no-web-resources-cdn --no-wasm-dry-run --output build/web-prod
