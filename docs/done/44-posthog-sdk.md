# Job 44: all-in on PostHog: posthog_flutter, error tracking, feature flags

PR #152. Peter decided on 2026-10-31: PostHog only, no Sentry or other vendor; what PostHog lacks
goes upstream. The app's hand-written PostHog client (job 19) is replaced by PostHog's SDK, with
our consent gate, allow-list and scrubbing on top. Users see no change. Behavior:
[docs/ANALYTICS.md](../ANALYTICS.md). Calls and reasons: [docs/DECISIONS.md](../DECISIONS.md),
"Job 44" (18 entries). Open steps: [docs/NEEDS_LEAD.md](../NEEDS_LEAD.md), "Job 44".

## What was built

- **The SDK.** posthog_flutter 5.58.3, pinned. posthog-js 1.444.0 under it on the web, vendored
  in `app/web/posthog/` (`scripts/posthog-js.sh`). posthog-android pinned to 3.75.0;
  posthog-ios floats in 3.92.3 ..< 4.0.0 (no SwiftPM lockfile).
- **No yes, no SDK.** `Posthog().setup()` runs only after the install's yes and `close()` at a
  no. Native opt-out still fetches remote config and flags and writes ids, so it is not used.
  After the close the app deletes the native SDK's files (`forgetPostHogState`; on Android
  `MainActivity.forgetPostHog`), and a start with a stored no does it again. `AUTO_INIT` is off
  in the Android manifest and the iOS Info.plist.
- **Allow-list twice.** `track` and the SDK's `beforeSend` (`Analytics._admit`) check every
  event and the context; `$screen_name` is removed. On the web, posthog-js' `before_send`
  strips every key outside `webEventKeys`. Persistence is memory only, nothing loads from
  outside the app, and remote config stays blocked by the CSP.
- **Error tracking.** Our hooks (zone, `FlutterError.onError`, `PlatformDispatcher`) feed
  PostHog's `captureException`. `beforeSend` puts the scrubbed type and message into
  `$exception_list` and drops the SDK's `flutter_error_details`. Native exceptions and crashes
  are on. Gaps are in ANALYTICS.md "Error tracking".
- **Context as super properties**, so native crash reports carry `install_id`, `is_internal`
  and `$geoip_disable` too.
- **Feature flags.** `Analytics.flags.isOn(key)` (`Flags`, a cubit). Off before the yes, after a
  no, without a key and offline until a first answer. No flag exists yet.
  `releases/flags.json` stays for the changelog only (docs/CHANGELOG.md, releases/README.md).
- **Events during the SDK start** are kept: found on the Linux run, where an add right after
  the yes was lost.
- **Edge functions** keep their own sender: the posthog-node prototype results are in
  DECISIONS 44.16.
- **Lint.** `posthog-flutter-only-in-posthog-client`.
- **Verify skill.** `FG_POSTHOG_HOST` and `cli/posthog_collector.ts`, so fg's Linux app can run
  analytics against a local stand-in (features/analytics.md).
- **privacy_scan.sql** knows the SDKs' keys. The privacy data map has the new rows.

## Removed

`sink.dart`, `post.dart`, `post_io.dart`, `post_web.dart`, `chunk_ids*.dart`, and the
`$exception_list` frame builder in `exceptions.dart`: the in-memory queue, batching, retry
and backoff. There is no dual path and no toggle between old and new. In
`app/lib/analytics`, 383 lines went and 747 came: the gate, the scrubber and the device-state
deletion stay ours, and the web loader, flags and super properties are new. Code and tests
overall: +1716 / −750 (`git diff --numstat origin/main`, without the vendored posthog-js).

## Verified

- `scripts/verify.sh --only gitleaks,lint,functions,fg-cli,flutter,web-prod`: passed (flutter
  1058 tests).
- `e2e/tests/analytics.spec.ts` 6/6 on the web build against the posthog-js collector
  ([analytics-06-collector-accepted.png](../screenshots/44/analytics-06-collector-accepted.png),
  [analytics-03-collector-declined.png](../screenshots/44/analytics-03-collector-declined.png)).
  The full local e2e gate: 154 passed, 14 failed, none from this change. The OIDC and id-token
  specs fail on this host and pass in CI. The classifier, list and feedback specs that add
  several items fail the same way with `origin/main`'s own build on this host. CI `ci-ok` is the
  gate.
- The Linux native run against the local collector:
  [docs/screenshots/44/native-linux-collector.txt](../screenshots/44/native-linux-collector.txt)
  and its screenshots.
- iOS and Android: built by CI (`android`, `ios` gates), not run (no emulator on this runner).

## Open

- Legal Review sentences: device and app properties, native crash reports, flag requests,
  SDK storage, store labels (NEEDS_LEAD Job 44).
- Upstream issue drafts A to C, not filed (NEEDS_LEAD Job 44).
- The Lead creates flags in project 319492 when needed, and runs `privacy_scan.sql` after the
  first SDK events.
- Native symbol upload (dSYMs, Android mappings) is not set up.
