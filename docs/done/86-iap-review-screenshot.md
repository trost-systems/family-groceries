# Job 86: iOS paywall screenshots for the App Store in-app purchase review

**Result (ADDENDUMS 1 and 2: PW-P4 as on main 84e8da41).** Two screenshots of PW-P4, job 87's
Premium page as merged with Legal's N-67..N-71, on the box and on Hetzner at the same path:

- `/workspace/hummlist/research/iap-check/paywall-ios-de.png`: yearly picked, "Jährlich
  abschließen" (for `com.hummlist.app.yearly`).
- `/workspace/hummlist/research/iap-check/paywall-ios-de-lifetime.png`: Lifetime picked, "Lifetime
  kaufen" (for `com.hummlist.app.lifetime`).

Both are 1290x2796, German, light, with the status bar at 9:41, taken with `simctl io screenshot`
on an iPhone 16 Plus simulator on GitHub's `macos-26` runner (run 41792307363). Each shows both
products, "9,99 € pro Jahr, inkl. MwSt." and "29,99 € einmalig, inkl. MwSt.", inside the app's
shell. PW-P4 has one Buy button, for the picked plan, so each product gets its own screenshot.
Copies are in `docs/screenshots/86/` and this job's ops dir. The first round's screenshot (the
old page) is replaced.

**How.**
- `app/test_driver/paywall_review.dart` is a debug-only entrypoint: the real `AppShell`, More tab
  and `PremiumScreen` at `/more/lifetime?from=integrations`, with the server and the store faked
  by the test fakes. After the first screenshot it picks Lifetime the way a tap on its tile does.
- `scripts/ios-paywall-shot.sh` builds it, makes a fresh 6.7" simulator in de-DE and light,
  installs, launches, takes both screenshots and checks their size.
- `.github/workflows/paywall-shot.yml` runs it by hand; the artifact is `paywall-ios-de`.
- No release vars, app switches or flags were changed. Nothing was bought or uploaded.

**Prices.** Set by the entrypoint to the German storefront's, as StoreKit formats them. StoreKit's
own answer on the runner is the sandbox's US storefront ($9.99 / $29.99, both products found,
`docs/screenshots/86/paywall-ios-de.storekit.txt`). StoreKit's local test store failed with
`SKInternalErrorDomain Code=3` in four runs, also with the file in the scheme (DECISIONS, job 86).
That is likely also why job 25's StoreKit tests never ran in CI.

**Also fixed.** `LifetimeStoreKitTests` expected Lifetime at 9.99; now 29.99.

**PR.** #213 is rebased onto main after #217 merged (84e8da41); one commit, pushed with
`scripts/push-pr.sh`. Not merged: lead review.

**StoreKit retry.** The first retake (run 41790415523) got no StoreKit answer within the page's
10 s timeout right after the simulator booted, and the guard stopped it. The entrypoint now asks
up to six times before recording the answer; the page's own timeout is unchanged.

**Verify.** Run the workflow "Paywall screenshot" and compare the artifact. Locally
`flutter analyze test_driver`, `scripts/lint.sh`, `shellcheck scripts/ios-paywall-shot.sh` and
`actionlint` are clean. A throwaway widget test rendered both picks of the merged page before the
macOS run (since deleted).

**Open.** Uploading to App Store Connect after Legal Review signs off PW-P4 (NEEDS_LEAD "Job 86").
