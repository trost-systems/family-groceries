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
try() {
  local name=$1 delay=$2; shift 2
  local s=$(date +%s) out
  xcodebuild test-without-building -workspace ios/Runner.xcworkspace -scheme Runner \
    -destination "platform=iOS Simulator,name=$name" -derivedDataPath build/ios/derived "$@" >/tmp/$name.log 2>&1 &
  local pid=$!
  sleep "$delay"; xcrun simctl create "$name" "$devicetype" "$runtime" >/dev/null
  wait $pid; local rc=$?
  verdict=FOUND
  grep -q "Unable to find a device" /tmp/$name.log && verdict=NODEVICE
  echo "TRY $name delay=${delay}s $* took=$(( $(date +%s)-s ))s rc=$rc $verdict"
  [[ $verdict == FOUND ]] && grep -m3 -E "error|Error" /tmp/$name.log | cut -c1-200
}
try Late0 0
try Late45 45
try Late45long 45 -destination-timeout 300
try Late120long 120 -destination-timeout 300
try Late90 90
