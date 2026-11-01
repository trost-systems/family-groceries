#!/usr/bin/env bash
# The app's own Swift (the on-device speech check, job 4b; the Siri intents, job 51) compiles for
# the simulator, which also validates the App Shortcut phrases. The built app carries the app icon
# (light, dark, tinted, and the Icon Composer layered icon) and the launch screen's colour and mark
# from design/app-icon/build.mjs. Then RunnerTests runs on the newest iPhone simulator installed,
# without the StoreKit tests (scripts/ios-storekit-test.sh, DECISIONS 25.16). Needs macOS.
set -euo pipefail
source "$(dirname "$0")/../lib.sh"
cd "$REPO_ROOT/app"
flutter build ios --simulator --debug
xcrun --sdk iphonesimulator assetutil --info build/ios/iphonesimulator/Runner.app/Assets.car >build/ios/assets.json
# Each wanted asset needs a rendition whose JSON mentions every listed word (the appearance).
python3 - build/ios/assets.json <<'PY'
import json, sys
entries = json.load(open(sys.argv[1]))
want = {'AppIcon': ['Dark', 'Tint'], 'LaunchBackground': ['Dark'], 'LaunchImage': ['Dark']}
missing = []
for name, words in want.items():
    found = [json.dumps(e) for e in entries if e.get('Name') == name]
    missing += [f'{name} ({w})' for w in words if not any(w in f for f in found)] if found else [name]
# The Icon Composer bundle (AppIcon.icon, the iOS 26 layered icon) compiles to icon stacks.
stacks = {e.get('Appearance') for e in entries if e.get('Name') == 'AppIcon' and e.get('AssetType') == 'IconImageStack'}
missing += [f'AppIcon.icon stack ({a})' for a in ('UIAppearanceLight', 'UIAppearanceDark', 'ISAppearanceTintable') if a not in stacks]
if missing:
    sys.exit('Assets.car lacks ' + ', '.join(missing) + '; build/ios/assets.json has the catalog')
print('Assets.car has', ', '.join(want), 'and the AppIcon.icon stacks')
PY

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
