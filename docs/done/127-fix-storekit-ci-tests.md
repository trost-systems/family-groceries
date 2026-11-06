# Job 127: the StoreKit Lifetime tests in CI's ios gate (issue #130)

**What.** `LifetimeStoreKitTests` (product, purchase, restore, refund, Ask to Buy against
`app/ios/Hummlist.storekit`) assert in the `ios` gate again. They run on an iOS 26.2 simulator,
and every case must pass. They were left out of the gate since job 25.

**Root cause** (DECISIONS 127). The test host launches since #259. On iOS 26.4 and 26.5, storekitd
refuses StoreKit's local test store to CI's ad-hoc build (`com.hummlist.app is not installed for
development`). The `SKTestSession` calls fail silently, and StoreKit falls back to the US sandbox,
where `purchase()` hangs and the product test passed by accident. Five signing variants didn't
change that on 26.5, and neither did the scheme's StoreKit configuration. iOS 26.2's storekitd
takes the configuration from the same build (review 0's runtime probe). Once the tests ran, they
found a test bug: the refund reaches `currentEntitlements` a moment after `refundTransaction`. The
test now waits for it, as the Ask to Buy test does for the approval.

**Where.**
- `scripts/gates/ios.sh`: the main RunnerTests run is unchanged (newest runtime, StoreKit tests
  skipped, same flags). The new phases `storekit_boot` and `storekit_tests` boot an iOS 26.2
  iPhone after the main tests (the gate fails with a message if the image lacks it), run `LifetimeStoreKitTests`
  with test timeouts, print each case, and fail unless all pass.
- `app/ios/RunnerTests/RunnerTests.swift`: `XCTSkip` with the reason when storekitd refused the
  configuration (the storefront isn't the file's), a 60 s allowance, the refund wait.
- `scripts/ios-storekit-probe.sh <ios-version>... [--scheme-config]`: which runtimes' storekitd
  takes the configuration; rerun it on a new runner image.
- `scripts/ios-storekit-test.sh [--ios <version>]`: on a Mac, iOS 26.2 by default like the gate,
  keeps the result on failure, turns test timeouts on, and fails unless every test passed.
- `docs/DECISIONS.md` (Job 127, pointer in 25.16).

**Verify.** In the ios job log of PR #274: `passed 45, failed 0, skipped 0` (the same cases as
main), then `Passed LifetimeStoreKitTests/testAskToBuyIsPendingUntilApproved()`,
`.../testPurchaseRestoreRefund()`, `.../testTheProductIsANonConsumableAt2999WithoutFamilySharing()`.
Minutes per phase: `scripts/ci-ios-phases.sh <run>` (in the PR).

**Cost.** The ios job takes about 25 min, against a median of 13.4 before. The StoreKit phase
spends 6 to 10 min on the first install and launch on the unused 26.2 runtime, and the tests
themselves take seconds (DECISIONS 127.5).

**Open.** iOS 18.6 is untested: no test started within 6 min of its first boot. If a runner image
drops 26.2, the gate fails with a message naming `scripts/ios-storekit-probe.sh`. Warming the
runtime to cut the 6 to 10 min was not tried. No Supabase stack was started.
