# Job 144: the tabs float as a hex pill (V2, Q89 = N2)

PR: https://github.com/trost-systems/family-groceries/pull/288

## What was built

- `app/lib/app/shell.dart`: on phones, a raised hex capsule replaces the Material `NavigationBar`, with the tabs "Liste" and "Mehr". The pill is centred, 52 px tall, and the selected tab sits on a honey hex. It floats `max(12, bottom view padding - 8)` above the bottom edge.
- The shell's Scaffold has `extendBody`, so every page scrolls on behind the pill.
- The whole band takes taps, so a near miss beside a tab never ticks a row behind it.
- While the add sheet is open the band shows the adding hint. With the keyboard up the band goes. From 840 px the rail is unchanged.
- Pages with their own list padding now end above the pill: More, Lifetime, Zugänge, Nutzungsdaten, Stores, store details and Join.
- `test/app/shell_pages_test.dart` checks every shell route.
- The NavigationBar theme, components sample and Widgetbook story are removed.
- Decisions: `docs/DECISIONS.md`, "Job 144".

## How to verify

- Run `cd app && flutter test test/app/shell_tabs_test.dart test/app/shell_pages_test.dart test/design/screens_golden_test.dart`.
- Run `.cursor/skills/verify-hummlist/helpers/launch.sh`, then open the app at 390x844 in light and dark. Scroll the list and the More tab, then open the add sheet.

## Results

- `scripts/verify.sh --only gitleaks,lint,flutter` passes.
- The app suite has 1906 passed and 90 skipped. The Widgetbook suite has 334 passed.
- On the web release build, at 390x844, 412x915, 844x390 and 820x1180 in light and dark, there were 0 page errors. The ARIA tree keeps the tablist with tab "Liste" [selected] and tab "Mehr".
- Screenshots are in `docs/screenshots/144/`.
- e2e ran on CI, because the local e2e lock had 6 jobs queued.

## Open

- iOS and Android devices were not driven: there are no simulators on the runners. The device insets are covered by goldens (iPhone 34 px, Android 24 px) and widget tests.
- After the merge, close draft #277 (the lead does this).
