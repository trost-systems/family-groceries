#!/usr/bin/env bash
# Job 164 probe v4: does xcodebuild pick up a simulator that joins its device list after it
# started looking, and does -destination-timeout decide how long it looks? The device is created
# DELAY s after xcodebuild starts. No build: a found destination ends in a different error.
set -uo pipefail
cd app
flutter build ios --config-only --simulator --debug >/dev/null
read -r runtime devicetype <<<"$(xcrun simctl list runtimes -j | python3 -c '
import json, sys
for r in json.load(sys.stdin)["runtimes"]:
    if r["platform"] == "iOS" and r["isAvailable"] and r["version"].split(".")[:2] == ["26","2"]:
        iphones = {t["name"]: t["identifier"] for t in r["supportedDeviceTypes"] if t["productFamily"] == "iPhone"}
        name = next((n for n in ("iPhone 17 Pro", "iPhone 16 Pro", "iPhone 16") if n in iphones), list(iphones)[-1])
        print(r["identifier"], iphones[name]); break')"
xb() { xcodebuild test-without-building -workspace ios/Runner.xcworkspace -scheme Runner \
  -destination "platform=iOS Simulator,name=$1" -derivedDataPath build/ios/derived "${@:2}" >/tmp/$1.log 2>&1; }
report() {
  local verdict=FOUND
  grep -q "Unable to find a device" /tmp/$1.log && verdict=NODEVICE
  echo "TRY $1 $2 took=$3s $verdict"
  grep -E "error:|platform:iOS Simulator.*name:(Late|Pre)" /tmp/$1.log | cut -c1-200 | head -4
}
before() {
  xcrun simctl create "$1" "$devicetype" "$runtime" >/dev/null; sleep 5
  local s=$(date +%s); xb "$@"; report "$1" "created-before ${*:2}" $(( $(date +%s)-s ))
}
after() {
  local name=$1 delay=$2 s=$(date +%s); shift 2
  xb "$name" "$@" & local pid=$!
  sleep "$delay"; xcrun simctl create "$name" "$devicetype" "$runtime" >/dev/null
  wait $pid; report "$name" "created-after=${delay}s $*" $(( $(date +%s)-s ))
}
before Pre1
before Pre2long -destination-timeout 120
after Late0 0
after Late20long 20 -destination-timeout 120
before Pre3
