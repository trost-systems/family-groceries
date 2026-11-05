# Job 118: the ios gate builds once (flaky #258)

**What.** The ios CI job hit its 40-minute limit on a slow macOS runner (run 42024315158, PR
#248) because the gate built the app twice: `flutter build ios`, then `xcodebuild test`, which
resolved the Swift packages again and rebuilt everything into its own DerivedData. Now one
`xcodebuild build-for-testing` serves the app checks and the tests (`test-without-building`).
Same 42 test cases as main, same skip, same pass criteria, same checks on the built app.

**Where.**
- `scripts/gates/ios.sh`: `flutter build ios --config-only`, one build into `build/ios/derived`,
  checks on that `Runner.app`, boot, `test-without-building`; `[ios] phase <name>` log markers.
- `scripts/ci-ios-phases.sh <run-id>...`: minutes per phase of every ios job (all attempts) of
  the given runs, from the job logs; reads old and new logs.
- `docs/DECISIONS.md` (Job 118), `docs/CI.md` (Measuring, what a PR waits for).

**Measurements** (`scripts/ci-ios-phases.sh`, minutes).

| | n | ios job | build phase(s) | boot |
| --- | --- | --- | --- | --- |
| Before (19 jobs of 2026-11-05) | 19 | median 20.0 (12.5-40.8) | 8.1-25.8 (median 14) | 2.2-10.9 |
| After (one build, boot after it) | 6 | median 13.4 (8.5-21.5) | 2.7-5.5 | 1.9-8.5 |

The timed-out job: build 8.4, boot 10.9, resolve 4.7, test build 12.4. Rejected: booting during
the build (A/B in run 42044865628: the build took 6.9 and 11.1 min against 4.0 and 4.0, same mean
job time, more spread) and booting before `--config-only` (its xcodebuild calls took 4.5 min
instead of 40 s). No cache: nothing left to warm that pays for a restore and save (DECISIONS
118.4). So there is no cold/warm split; every run had flutter-action's SDK cache. Timeout stays
40 min.

The tests phase is not comparable before and after: after, it also holds xcodebuild's start
and the app's install and launch. Compare job totals.

**Review 0.** `scripts/ci-ios-phases.sh` deduped rerun copies on the start time alone and so
dropped matrix jobs that started in the same second (run 42044865628 showed 2 of 4 jobs); it
keys on start time and job name now and prints all four. Docs carry n=6 (the final head's 8.5),
`evidence/baseline.tsv` is deduped to the 19 jobs.

**Verify.** `scripts/ci-ios-phases.sh 42024315158 42047651436` (before and after); PR #259's ios
job. Raw phase output: the job's ops dir, `evidence/`.

**Open.** A slow runner still spends up to ~11 min on the simulator's first boot; that is the
runner image, not the gate.
