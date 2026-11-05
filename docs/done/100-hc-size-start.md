# Job 100: HC1 hill-climb hc-size-start (Android download size and cold start)

What was built: a measurement harness, `tool/hillclimb/hc-size-start/measure.sh`, which prints one
JSON line with the score (lower is better). It weights three parts, each normalised to its
baseline:
- 0.4 × the Play download size for an arm64, de-DE, 420 dpi, Android 14 phone (bundletool
  `get-size total` on the release AAB).
- 0.3 × time to first frame.
- 0.3 × time until the list is interactive (a tap on the first item has ticked it).

The two times come from the real app (`main.dart`'s `bootstrap`) in a Linux profile build
(`app/test_driver/startup_probe.dart`) under Xvfb, against a fake Supabase
(`fake_supabase.py`), median of 15 launches under `/tmp/fg-hc-measure.lock`. The attempt log, the
baselines and every number are in [docs/hillclimb/hc-size-start.md](../hillclimb/hc-size-start.md).

Result: nothing kept, final score 1.0 = baseline (13021964 B, 291.6 ms, 445.3 ms). Four attempts,
all reverted:
1. A font subset (−1.06 % download, identical outlines).
2. Concurrent start-up reads in `main.dart`.
3. Attempts 1 and 2 together.
4. Attempts 1 and 2 together again, measured A/B on the corrected harness.

Stop reason: the 6 h rule (frozen time excluded). Claude weekly usage stayed at 0.31 to 0.34.

Harness bugs found and fixed, each followed by a re-baseline with 3 runs:
- The fake server's listen backlog of 5 dropped SYNs, adding 1 s to some launches.
- Per-launch fresh caches re-linked every shader and rebuilt fontconfig's cache, adding about
  650 ms.

Why nothing cleared the band:
- No allowed size step comes near the 5 % a size-only step needs. R8 and resource shrinking are
  already on. The big Java/Kotlin code is RevenueCat (with the Amazon SDK) and PostHog surveys,
  which are off limits.
- The app's own start-up work is 20 to 60 ms before `runApp`. Box load (4 to 10 from parallel
  jobs) swings the timing parts by more than that.

How to verify: run `tool/hillclimb/hc-size-start/measure.sh`. It needs JDK 17 in `~/opt`,
bundletool (downloaded and checked by sha256), and clang, CMake and the GTK headers for
`flutter build linux`. `subset-fonts.sh` and `attempts/concurrent-start-reads.patch` reproduce
the reverted attempts.

Guardrails (nothing under `app/lib`, assets or l10n changed; only `app/test_driver/startup_probe.dart`
was added):
- `flutter analyze --fatal-infos`: no issues.
- `flutter test`: 1737 passed, 88 skipped, 4 failed. The 4 failures are pre-existing golden
  diffs on this box (13 px, `list wide` and `add sheet wide`, dark and light), present on the
  untouched tree.
- Lint gate: passed.
- No forbidden path changed.

Box setup outside the repo: Temurin 17 in `~/opt/jdk-17.0.21+9`, bundletool 1.18.1 in
`~/opt/bundletool`, and clang, CMake, ninja, pkg-config and libgtk-3-dev installed with
`dpkg -i` (apt was blocked by the proxy). Details are in the log.

Missing or blocked: the iOS IPA size. No Xcode on the box, and CI uploads no IPA artifact.
