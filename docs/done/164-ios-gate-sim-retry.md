# Job 164: the ios gate's StoreKit tests find their simulator

PR #316. CI only, nothing in the app changes.

## What was wrong

The ios gate failed now and then in phase `storekit_tests` with "xcodebuild: error: Unable to
find a device matching the provided destination specifier", after the app tests had passed.
6 of 40 ios jobs from Nov 3 to 7 that reached the phase failed this way. After the iOS 26.2
simulator's first boot, an xcodebuild started on the loaded runner can see no simulator at all
for minutes, while `simctl` lists the device. The default destination search gave up after
about a minute. The id and the arch were right.

## What changed

`scripts/gates/ios.sh`: the StoreKit run passes `-destination-timeout 300`, and when xcodebuild
still finds no simulator the gate says so plainly. A test that runs and fails still fails the
gate. The reasons and the probes are in DECISIONS, "Job 164".

## How to verify

- The mutation: probe run 42372263213 (workflow `ios-probe-164`, branch `probe/164-dest7`). A
  26.2 simulator that joins xcodebuild's list 150 or 240 s late: the default search fails 4/4
  ("Unable to find a device"), `-destination-timeout 300` finds it 4/4.
- Green ios runs of the gate with the fix: the PR's ios job and its reruns, and the 6-job matrix
  of `scripts/gates/ios.sh` on `probe/164-gate`. The PR comment lists the run ids.

## Open

Nothing. The `probe/164-*` branches only carry the probe workflow, and they can be deleted.
