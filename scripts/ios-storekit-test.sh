#!/usr/bin/env bash
# Job 25: Snacklist Lifetime against StoreKit's local test store (app/ios/RunnerTests/RunnerTests.swift,
# LifetimeStoreKitTests, with app/ios/Snacklist.storekit): product, purchase, restore, refund, Ask to
# Buy. Needs a Mac with Xcode and an iPhone simulator of the given iOS version (default 26.2, the
# one the ios gate uses): from iOS 26.4 on, storekitd refuses the local test store to an ad-hoc
# signed build (DECISIONS 127). It fails unless every test passed, a skip included. Writes the
# result bundle to /tmp/snacklist-storekit.xcresult for `xcrun xcresulttool`.
#
# Usage: scripts/ios-storekit-test.sh [--ios <version>]
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT/app"
ios=26.2
[[ ${1:-} == --ios ]] && { ios=${2:?usage: $0 [--ios <version>]}; shift 2; }
flutter build ios --simulator --debug
udid="$(xcrun simctl list devices available -j | python3 -c '
import json, sys
want = sys.argv[1].replace(".", "-")
for runtime, ds in json.load(sys.stdin)["devices"].items():
    if runtime.endswith(".iOS-" + want):
        print(next((d["udid"] for d in ds if d["name"].startswith("iPhone")), "")); break' "$ios")"
[[ -n $udid ]] || { echo "no iPhone simulator on iOS $ios: add the runtime (xcodebuild -downloadPlatform iOS -buildVersion $ios) and a device, or pass --ios" >&2; exit 1; }
xcrun simctl boot "$udid" 2>/dev/null || true
xcrun simctl bootstatus "$udid" -b
result=/tmp/snacklist-storekit.xcresult
rm -rf "$result"
xcodebuild test -workspace ios/Runner.xcworkspace -scheme Runner -destination "id=$udid" \
  -only-testing:RunnerTests/LifetimeStoreKitTests -parallel-testing-enabled NO -test-timeouts-enabled YES \
  -resultBundlePath "$result" || status=$?
[[ -d $result ]] || exit "${status:-1}"
xcrun xcresulttool get test-results summary --path "$result" | python3 -c '
import json, sys
s = json.load(sys.stdin)
print("passed %s, failed %s, skipped %s" % (s.get("passedTests"), s.get("failedTests"), s.get("skippedTests")))
sys.exit(0 if s.get("passedTests", 0) == s.get("totalTestCount", -1) > 0 else 1)'
