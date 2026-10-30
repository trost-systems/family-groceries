#!/usr/bin/env bash
# Job 25: Hummlist Lifetime against StoreKit's local test store (app/ios/RunnerTests/RunnerTests.swift,
# LifetimeStoreKitTests, with app/ios/Hummlist.storekit): product, purchase, restore, refund, Ask to
# Buy. Needs a Mac with Xcode and an iOS simulator. Not in CI yet: on GitHub's macOS runner the test
# host app failed to launch (DECISIONS 25.16, issue linked there). Writes the result bundle to
# /tmp/hummlist-storekit.xcresult for `xcrun xcresulttool`.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT/app"
flutter build ios --simulator --debug
udid="$(xcrun simctl list devices available -j | python3 -c '
import json, sys
devices = json.load(sys.stdin)["devices"]
ios = [d for runtime, ds in sorted(devices.items(), reverse=True) if "iOS" in runtime for d in ds]
print(next(d["udid"] for d in ios if d["name"].startswith("iPhone")))')"
xcrun simctl boot "$udid" 2>/dev/null || true
xcrun simctl bootstatus "$udid" -b
rm -rf /tmp/hummlist-storekit.xcresult
xcodebuild test -workspace ios/Runner.xcworkspace -scheme Runner -destination "id=$udid" \
  -only-testing:RunnerTests/LifetimeStoreKitTests -parallel-testing-enabled NO \
  -resultBundlePath /tmp/hummlist-storekit.xcresult
