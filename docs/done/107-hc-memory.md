# Job 107: hill-climb hc-memory (app memory, Linux profile build)

**Status:** PR open, marked DO NOT MERGE; the lead reviews and merges.

**What it is.** A measurement harness for the app's memory and one kept step that lowers the
score (0.5 × peak RSS + 0.5 × steady RSS, MB) from **413.7 to 381.0 (−7.9 %)** over a fixed
session: sign in, a 300-item list scrolled 3× each way, 20 adds, 20 ticks, the add sheet, Mehr,
Premium, back to the list, 60 s idle.

**Where.**

- Harness: `tool/hillclimb/hc-memory/` (`measure.sh`, `session.mjs`, `gen-scenario.mjs`,
  `hc-memory-300.yaml`) and `app/test_driver/main_hc_memory.dart`.
- Attempt log, method, baseline, result: `docs/hillclimb/hc-memory.md`.
- Kept change: `app/linux/runner/my_application.cc` gives freed native memory back every 5 s
  (`malloc_trim`). Skia instead of Impeller (−43) was removed by the lead (addendum 3), and a
  4 MB Skia resource cache was reverted after review 0 as noise.
- Only the Linux build gains: the verification surface and the harness. No shipped app runs the
  Linux runner.
- Renderer screenshots of the removed Skia attempt: `docs/screenshots/107/`, numbers from
  `tool/hillclimb/hc-memory/pixel-diff.py`.

**How to verify.** With the checkout's local stack running (`supabase start` on your port block):
`tool/hillclimb/hc-memory/measure.sh` prints one JSON line in about 3 minutes of session plus the
build and any wait for `/tmp/fg-hc-measure.lock`. It restores the local `premium_offer` switch
and tears its fixture run down on exit.

**Tests.** `flutter test` 1819 passed, 90 skipped (66 s wall) on the final branch (main at
`1ba6dc51`); `flutter analyze --fatal-infos` clean; `scripts/lint.sh` ok. No goldens changed.

**Stop.** Five attempts in a row without a keep (attempts 7-11), after 4 h 03 min. Weekly usage
47 % at the last check (stop at 95 %).

**Review fixes.** Review 0: reverted the Skia cache cap and re-measured. Review 1 / addendum 3:
removed the Skia switch (Impeller stays), re-measured trim only with 3 runs interleaved with 2
runs of main's runner (381.0 against 413.9 / 411.0), committed the pixel-diff script, made the
harness restore `premium_offer` and tear down in an EXIT trap, removed its debug branches, and
explained why the launch RSS sample is not compared (`docs/hillclimb/hc-memory.md`).
`malloc_trim` cost: median 0.82 ms per call, max 2.2 ms, every 5 s; frame times not measured.
