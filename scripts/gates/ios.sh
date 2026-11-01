#!/usr/bin/env bash
# The app's own Swift (the on-device speech check, job 4b; the Siri intents, job 51) compiles for
# the simulator, which also validates the App Shortcut phrases. Then RunnerTests runs on the
# newest iPhone simulator installed, without the StoreKit tests (scripts/ios-storekit-test.sh,
# DECISIONS 25.16). Needs macOS.
set -euo pipefail
source "$(dirname "$0")/../lib.sh"
cd "$REPO_ROOT/app"
flutter build ios --simulator --debug

udid="$(xcrun simctl list devices available -j | python3 -c '
import json, re, sys
devices = json.load(sys.stdin)["devices"]
def version(runtime):
    return [int(n) for n in re.findall(r"\d+", runtime.rsplit("iOS", 1)[-1])]
ios = sorted((r for r in devices if ".SimRuntime.iOS-" in r), key=version, reverse=True)
print(next(d["udid"] for r in ios for d in devices[r] if d["name"].startswith("iPhone")))')"
log "simulator $udid"
xcrun simctl boot "$udid" 2>/dev/null || true
xcrun simctl bootstatus "$udid" -b

result=/tmp/hummlist-runner-tests.xcresult
rm -rf "$result"
xcodebuild test -workspace ios/Runner.xcworkspace -scheme Runner -destination "id=$udid" \
  -skip-testing:RunnerTests/LifetimeStoreKitTests -parallel-testing-enabled NO \
  -resultBundlePath "$result" || status=$?
[[ -d $result ]] || exit "${status:-1}"
xcrun xcresulttool get test-results summary --path "$result" | tee /tmp/hummlist-runner-tests.json
python3 -c '
import json, sys
s = json.load(open("/tmp/hummlist-runner-tests.json"))
print("passed %s, failed %s, skipped %s" % (s.get("passedTests"), s.get("failedTests"), s.get("skippedTests")))
sys.exit(0 if s.get("result") == "Passed" and s.get("passedTests", 0) > 0 else 1)'
exit "${status:-0}"
