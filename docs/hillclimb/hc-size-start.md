# HC1 hill-climb: hc-size-start

Start: 2026-11-04 21:48:29 CET (epoch 1793825309)

Job 100, HC1 (Peter Q68). Branch `job/100-hc-size-start`, runner: box. Harness:
`tool/hillclimb/hc-size-start/measure.sh` (repo root, next to the other HC1 jobs' tools).

## Score

Lower is better. Each part is normalised to its baseline median (`baseline.json`), so the
baseline scores 1.0:

    score = 0.4 × android_download_bytes / 13021964
          + 0.3 × first_frame_ms / 291.6
          + 0.3 × list_interactive_ms / 445.3

- `android_download_bytes`: `flutter build appbundle --release --analyze-size
  --target-platform android-arm64` (the debug-key signing a local release build uses without
  `android/key.properties`), then bundletool 1.18.1 `build-apks --device-spec` and `get-size
  total` for one phone: arm64-v8a, de-DE, 420 dpi, Android 14 (SDK 34). That is the size Play
  serves that phone. Nothing is uploaded or signed with release keys. `aab_bytes` is
  informational.
- `first_frame_ms`, `list_interactive_ms` (and `list_shown_ms`, informational): the real app
  (`lib/main.dart`'s `bootstrap`) built in profile mode for Linux desktop with the entrypoint
  `app/test_driver/startup_probe.dart`, launched under `xvfb-run` (1280×800) against
  `tool/hillclimb/hc-size-start/fake_supabase.py` (fixed household "Zuhause", 6 categories,
  24 items; the realtime socket answers 404). Every launch gets a fresh `HOME` and data
  directory holding only a signed-in supabase session (a returning user whose app was killed;
  the JWT expires in 2100, so no token request). The cache directory (`XDG_CACHE_HOME`: Mesa's
  shader cache, fontconfig's cache) is shared by the launches of one measurement and filled by
  the warm-up launch, as that user's would be (since 2d8d7491, see the third baseline). Times count from just before the process is spawned
  (`startup.py`, wall clock), to:
  - `first_frame`: `waitUntilFirstFrameRasterized` resolves.
  - `list_shown`: the first frame in which the row keyed with item 0's id (Äpfel) is laid out
    and a hit test at its centre reaches its render box.
  - `list_interactive`: the probe then sends a pointer down and up at that point; the first
    frame after which that row's `Semantics` says `checked: true` (the tick's tap handler ran
    and rebuilt the row). The probe prints its marks and exits.
  One discarded warm-up launch, then 15 launches; each timing part is the median. The
  launches run under `flock /tmp/fg-hc-measure.lock` (shared by the HC1 jobs).
- `seed`: 0. Nothing is random: the fake household, the device spec and the flags are fixed.

Why it is deterministic: the size parts are a pure function of the source (three builds gave
the same byte count). The timing parts are wall times on a shared box, so they are noisy; the
median of 15 launches and the noise band below absorb that. Other jobs' builds and tests run
outside the lock and still load the CPU (box: 8 cores, 16 GB, shared with 98-hc-tests and
97-siri-app-shortcuts).

iOS IPA size: not part of the score. This box is Linux, without Xcode, so no IPA can be built
here. CI's `ios` job builds an unsigned app for checks but uploads no IPA artifact, so there
is no number to read either.

## Box setup (done once, outside the repo)

- No JDK on the box: Temurin 17 (as CI's `setup-java`) unpacked to `~/opt/jdk-17.0.21+9`.
- bundletool 1.18.1 in `~/opt/bundletool/` (sha256 pinned in measure.sh).
- `flutter build linux` needed clang, CMake, ninja, pkg-config and the GTK 3 headers (what
  `scripts/fg setup` installs). apt itself got HTTP 500 from the egress proxy, so the index
  was fetched with curl (InRelease files cross-checked over HTTPS), the 151 packages
  downloaded with curl, each checked against the index's SHA256, and installed with `dpkg -i`.

## Baseline

First baseline at 7 launches (commit da4a9373), dropped because its band (0.057) would hide
any size change under 14 %; measure.sh then went to 15 launches (601ae3f3, re-baselined):

| time | git | launches | download B | first frame ms | list shown ms | interactive ms | score |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 23:41 | da4a9373 | 7 | 13021964 | 916.8 | 1025.2 | 1241.0 | (n/a) |
| 23:42 | da4a9373 | 7 | 13021964 | 924.6 | 1054.3 | 1336.7 | (n/a) |
| 23:44 | da4a9373 | 7 | 13021964 | 987.1 | 1095.7 | 1395.2 | (n/a) |
| 00:43 | 601ae3f3 | 15 | 13021964 | 1011.6 | 1493.1 | 1576.7 | 0.9940 |
| 01:40 | 601ae3f3 | 15 | 13021964 | 1033.4 | 1429.1 | 1544.7 | 0.9942 |
| 01:42 | 601ae3f3 | 15 | 13021964 | 1032.3 | 1680.7 | 1771.3 | 1.0370 |

Re-baseline (harness bug): `list_shown` was bimodal, some launches about 1 s late. The fake
server kept Python's default listen backlog of 5 while the app opens about eight connections at
once, so the kernel dropped SYNs and the client resent them a second later. Proof:
`TcpExtListenOverflows` rose by 11 over 6 launches with the old server and by 0 with
`request_queue_size = 128` (77f53606). The three runs above (601ae3f3) are void; the baseline
is these three:

| time | git | launches | download B | first frame ms | list shown ms | interactive ms | score |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 04:12 | 77f53606 | 15 | 13021964 | 942.0 | 1044.2 | 1272.8 | 1.0016 |
| 04:13 | 77f53606 | 15 | 13021964 | 922.2 | 1041.0 | 1278.9 | 0.9967 |
| 04:15 | 77f53606 | 15 | 13021964 | 936.9 | 1042.8 | 1271.1 | 0.9996 |

Baseline: the per-part medians (13021964 B, 936.9 ms, 1272.8 ms), score 1.0 by construction.
Noise band: max − min = 0.0049, below 2 % of the median, so the band is 0.02. A step is kept
only if its score is below the current best by more than 0.02. The size part moves the score by
0.4 × its relative change, so a size-only step must cut the download by more than 5 %; a step
that only moves one timing part must cut it by more than 6.7 %.

Where the time goes (temporary marks in `main.dart`, not committed, 6 launches): `main()` starts
at about 860 ms. Engine and GTK start-up (Xvfb, software GL) take the bulk; the app's own code
before `runApp` takes 20 to 60 ms (`startAnalytics` most of it); `runApp` to the first
rasterized frame (the session spinner) 120 to 170 ms; the list then shows about 110 ms later.

Clock: the box froze several times (box-recover restarted slot-filler): wall gaps with no
progress at 22:51 to 23:38, 00:43 to 01:40, 01:42 to 02:36 and about 02:45 to 03:42. They are
excluded from the 6 h, as the protocol says.

Third baseline (harness bug, 2d8d7491): every launch had a fresh `XDG_CACHE_HOME`, so Mesa
re-linked every Impeller shader (the startup timeline showed 72 `LinkProgram` calls, 264 ms) and
fontconfig rebuilt its cache (`Engine::SetupDefaultFontManager`, 107 ms) on each launch. A
returning user has both caches warm, like a phone's persistent shader cache. On the unchanged app,
9 launches each: fresh caches 939.5 / 1353.9 ms (first frame / interactive), a shared cache
289.9 / 446.0 ms. Every baseline and attempt above this line used fresh caches; attempts 1 to 3
are compared against the second baseline (the same method). From here on:

| time | git | load (1 min, before → after) | download B | first frame ms | list shown ms | interactive ms | score |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 05:35 | 2d8d7491 | (not recorded) | 13021964 | 291.6 | 399.9 | 445.3 | 1.0000 |
| 05:40 | 2d8d7491 | (not recorded) | 13021964 | 229.4 | 382.0 | 421.8 | 0.9202 |
| 06:36 | 2d8d7491 | 8.2 → 10.4 | 13021964 | 313.5 | 440.5 | 483.6 | 1.0483 |

Baseline: 13021964 B, 291.6 ms, 445.3 ms (`baseline.json`). Noise band: max − min = 0.128. The
app's share of each timing part is larger now (the pre-`runApp` 20 to 60 ms is 7 to 20 % of the
first frame), but so is the relative noise, because the absolute times are three times shorter
and the box load was 5 to 10 (other jobs' builds and tests run outside the measure lock).
Because a band this wide hides any real change, attempts from here are measured A/B/A/B: the
unchanged baseline (A) and the candidate (B) alternate, so load drift hits both. A step is kept
only if its median beats 1.0 by more than the band and beats the interleaved A runs.

## Attempts

| # | time | change | score | kept/reverted | why |
| --- | --- | --- | --- | --- | --- |
| 1 | 04:43 | Font subset (`subset-fonts.sh`): drop private-use code points and the OpenType features no style asks for (cv/ss alternates, aalt, salt, dlig, frac, ...) from the six bundled TTFs; every other code point, default features, tnum and hinting kept; all kept glyph outlines identical (checked with fontTools) | 1.0759, 1.0594, 1.0261 (download 12884142 B, −1.06 %) | reverted | Size gain is 0.004 of score, under the 0.02 band. Timings rose with box load (6 to 8); the unchanged baseline measured back to back at 04:53 and 04:56 scored 1.0288 and 1.0167, so no timing effect is visible. |
| 2 | 05:00 | `main.dart`: run `Supabase.initialize`, `startAnalytics` and the language, theme and pending-invite reads concurrently (one record `.wait`) instead of one after another; all still finish before `runApp` | 1.0486, 1.0176, 1.0078 | reverted | Not below 1.0 − 0.02. The marks put the app's own pre-`runApp` work at 20 to 60 ms of a ~940 ms first frame, so even a full overlap is about 2 %; the load was 8 to 10 during these runs. |
| 3 | 05:17 | Iterations 1 and 2 together (font subset plus concurrent start-up reads) | 0.9982, 1.0200, 1.0789 (download 12883969 B) | reverted | Median 1.02, not below 0.98. Load 5 to 9; the timing parts swung by ±8 % between runs. |
| 4 | 06:41 | Iterations 1 and 2 together, on the shared-cache harness (`subset-fonts.sh` plus `attempts/concurrent-start-reads.patch`), A/B | A 1.0064 (06:41, load 4.6 → 7.3); B 1.0133 (06:58, load 7.3 → 6.5; download 12883969 B) | reverted | B is no better than the interleaved A, and nowhere near 1.0 − 0.128. Only one A/B round ran: the second was cut off by the shell's 10 min background limit, and the tree was already back on the baseline. |

## Stop

Stopped on the 6 h rule (frozen time excluded): at 07:00 about 5 h 25 min were used, and a
fifth attempt (two A/B rounds, about 25 min, plus the full test suite for a keep) would not have
fit before the write-up. Four attempts ran, none kept. Claude weekly usage was 0.31 to 0.34 at
every check (21:48, 23:38, 01:42, 04:57, 05:30), far below the 0.60 stop.

## Result

| part | baseline (third, shared cache) | final (= baseline, nothing kept) |
| --- | --- | --- |
| score | 1.0 (band 0.128) | 1.0 |
| android_download_bytes | 13021964 | 13021964 |
| first_frame_ms | 291.6 | 291.6 |
| list_interactive_ms | 445.3 | 445.3 |
| list_shown_ms (info) | 399.9 | 399.9 |
| aab_bytes (info) | 28526547 | 28526547 |

## What the numbers say, and what was looked at

- Size. In the arm64 split, `libflutter.so` (11.8 MB) and `libapp.so` (9.3 MB) dominate, then
  `classes.dex` (4.7 MB) and the fonts (2.1 MB raw, 1.1 MB compressed). R8 and resource
  shrinking are already on (Flutter's Gradle plugin turns both on for release). The largest kept
  Java/Kotlin code is RevenueCat with the Amazon Appstore SDK it pulls in (1515 + 360 classes)
  and PostHog's surveys module: IAP and analytics config, both off limits for this job. The font
  subset saves 137995 B (1.06 %). Trimming the material/cupertino/widgets localizations to de and
  en would save at most the 273 KB of AOT code they take (about 0.8 % compressed) and would need
  hand-kept date symbols. Images are 2 KB. `--split-debug-info` or `--obfuscate` would change the
  stack traces error tracking gets. So no allowed size step reaches the 5 % one size-only step
  needs, even before the band went to 0.128.
- Start-up (temporary marks and a `--trace-startup` timeline, not committed). `main()` starts
  about 860 ms after spawn on fresh caches. That is engine and GTK start-up, Impeller shader
  linking on llvmpipe and the fontconfig scan, and the shared-cache harness removes about
  650 ms of it. The app's own work before `runApp` is 20 to 60 ms (`startAnalytics` most of it),
  and the first frame's build is 3 to 5 ms. The list frame takes 55 to 75 ms to build (text layout
  without traced children, so native shaping and font matching) and about 340 ms to raster on
  software GL. The ~230 ms between "list shown" and "interactive" is mostly the tap's frame
  waiting for that raster, not the tap handler. The 300 ms hold delay (`Hold.holdDelay`) is a
  long-press setting and does not delay taps.
- Not tried: deferred components (Play feature delivery, a release change), lazy RevenueCat
  init (already lazy: no store call until Buy or Restore), deferring `startAnalytics` past
  `runApp` (changes when the consent decision is known).

## Limits of this harness

- Profile mode on Xvfb with Mesa llvmpipe (software GL). It is not a phone's first frame: shader
  linking and rasterizing cost far more on the CPU, and the box is shared (load 4 to 10 during
  the runs from other jobs' builds and tests, which run outside the measure lock).
- The size part is a pure function of the source. Debug-key signing (no `key.properties`) only
  adds the signature block; all 15 builds of the unchanged app gave 13021964 B.
- `measure.sh` builds into the checkout's `app/build`, overwriting what was there. Its two
  `flutter build` calls are not under a lock; only the launches are.
