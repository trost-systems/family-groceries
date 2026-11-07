#!/usr/bin/env bash
# Job 164 probe v2: does -destination-timeout ride out the empty simulator list? Does shutting the
# main simulator down first shorten it? MODE=keep|shutdown
set -uo pipefail
cd app
flutter build ios --config-only --simulator --debug >/dev/null
udid="$(xcrun simctl list devices available -j | python3 -c '
import json, re, sys
devices = json.load(sys.stdin)["devices"]
def version(runtime):
    return [int(n) for n in re.findall(r"\d+", runtime.rsplit("iOS", 1)[-1])]
ios = sorted((r for r in devices if ".SimRuntime.iOS-" in r), key=version, reverse=True)
print(next(d["udid"] for r in ios for d in devices[r] if d["name"].startswith("iPhone")))')"
derived=build/ios/derived
xcodebuild build-for-testing -workspace ios/Runner.xcworkspace -scheme Runner -configuration Debug \
  -destination "id=$udid" -derivedDataPath "$derived" COMPILER_INDEX_STORE_ENABLE=NO >/tmp/build.log 2>&1 || { tail -30 /tmp/build.log; exit 1; }
probe() {
  local tag=$1 want=$2 s e out
  s=$(date +%s)
  out="$(xcodebuild -showdestinations -workspace ios/Runner.xcworkspace -scheme Runner 2>&1)"
  e=$(date +%s)
  echo "PROBE $tag t=$(date +%H:%M:%S) took=$((e-s))s sims=$(grep -c 'platform:iOS Simulator, arch' <<<"$out") want=$(grep -c "arch:arm64, id:$want" <<<"$out") simctl=$(xcrun simctl list devices | grep -c "$want") load=$(sysctl -n vm.loadavg)"
}
run() {
  local tag=$1 s e rc out
  s=$(date +%s)
  out="$(xcodebuild test-without-building -workspace ios/Runner.xcworkspace -scheme Runner \
    -destination "id=$sk,arch=arm64" -derivedDataPath "$derived" -only-testing:RunnerTests/LifetimeStoreKitTests \
    -parallel-testing-enabled NO -test-timeouts-enabled YES ${@:2} 2>&1)"; rc=$?
  e=$(date +%s)
  verdict=other
  grep -q "Unable to find a device" <<<"$out" && verdict=NODEVICE
  grep -q "Test Suite 'LifetimeStoreKitTests' started" <<<"$out" && verdict=TESTS_RAN
  echo "RUN $tag ${*:2} t=$(date +%H:%M:%S) took=$((e-s))s rc=$rc $verdict load=$(sysctl -n vm.loadavg)"
  [[ $verdict == other ]] && tail -15 <<<"$out"
}
xcrun simctl boot "$udid"; xcrun simctl bootstatus "$udid" -b >/dev/null
probe main-booted "$udid"
[[ $MODE == shutdown ]] && { xcrun simctl shutdown "$udid"; probe main-shutdown "$udid"; }
read -r runtime devicetype <<<"$(xcrun simctl list runtimes -j | python3 -c '
import json, sys
for r in json.load(sys.stdin)["runtimes"]:
    if r["platform"] == "iOS" and r["isAvailable"] and r["version"].split(".")[:2] == ["26","2"]:
        iphones = {t["name"]: t["identifier"] for t in r["supportedDeviceTypes"] if t["productFamily"] == "iPhone"}
        name = next((n for n in ("iPhone 17 Pro", "iPhone 16 Pro", "iPhone 16") if n in iphones), list(iphones)[-1])
        print(r["identifier"], iphones[name]); break')"
sk="$(xcrun simctl create "Hummlist StoreKit" "$devicetype" "$runtime")"
xcrun simctl boot "$sk"
xcrun simctl bootstatus "$sk" -b >/dev/null
echo "PROBE bootstatus-done t=$(date +%H:%M:%S)"
for i in 1 2 3 4; do
  probe "pre$i" "$sk"; run "default$i"
  probe "pre$i" "$sk"; run "long$i" -destination-timeout 300
done
