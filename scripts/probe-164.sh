#!/usr/bin/env bash
# Job 164 probe: does xcodebuild's destination list drop simulators right after the 26.2 sim boots?
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
probe() {
  local tag=$1 want=$2 s e out
  s=$(date +%s)
  out="$(xcodebuild -showdestinations -workspace ios/Runner.xcworkspace -scheme Runner ${3:-} 2>&1)"
  e=$(date +%s)
  sims=$(grep -c "platform:iOS Simulator, arch" <<<"$out")
  has=$(grep -c "id:$want" <<<"$out")
  echo "PROBE $tag t=$(date +%H:%M:%S) took=$((e-s))s sims=$sims want=$has load=$(sysctl -n vm.loadavg)"
  [[ $sims -eq 0 ]] && echo "$out" | tail -8
}
probe pre "$udid"
xcrun simctl boot "$udid"; xcrun simctl bootstatus "$udid" -b >/dev/null
probe main-booted "$udid"
read -r runtime devicetype <<<"$(xcrun simctl list runtimes -j | python3 -c '
import json, sys
for r in json.load(sys.stdin)["runtimes"]:
    if r["platform"] == "iOS" and r["isAvailable"] and r["version"].split(".")[:2] == ["26","2"]:
        iphones = {t["name"]: t["identifier"] for t in r["supportedDeviceTypes"] if t["productFamily"] == "iPhone"}
        name = next((n for n in ("iPhone 17 Pro", "iPhone 16 Pro", "iPhone 16") if n in iphones), list(iphones)[-1])
        print(r["identifier"], iphones[name]); break')"
sk="$(xcrun simctl create "Hummlist StoreKit" "$devicetype" "$runtime")"
probe created "$sk"
xcrun simctl boot "$sk"
probe boot-returned "$sk"
( xcrun simctl bootstatus "$sk" -b >/dev/null; echo "PROBE bootstatus-done t=$(date +%H:%M:%S)" ) &
for i in $(seq 1 40); do probe "loop$i" "$sk"; sleep 3; done
wait
for i in $(seq 1 5); do probe "after$i" "$sk"; done
