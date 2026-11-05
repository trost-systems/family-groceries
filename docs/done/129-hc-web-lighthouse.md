# Job 129: hill-climb hc-web-lighthouse (2026-11-05)

Goal: a faster Flutter web app (the `--wasm` release build) under Lighthouse, without changing
what users see. PR marked DO NOT MERGE; the lead reviews and merges.

## Result

No kept step: baseline 74.5 (band 8.5), final 74.5. Five attempts, all reverted; the stop rule
"5 consecutive iterations without a kept improvement" ended the run at 22:18 CET, 2 h 33 min
after the start, at 62 % weekly usage. The branch changes no app code.

## What was built

- `tool/hillclimb/hc-web-lighthouse/measure.sh`: builds the web app like Vercel, serves it on
  127.0.0.1:62980 with vercel.json's headers and brotli (`lighthouse.mjs`), signs in against
  `fake_supabase.py` (127.0.0.1:62981, no Docker), and runs Lighthouse 13.6.0 (desktop preset)
  3 times on the list (`/`) and the add sheet (`/add`). One JSON line.
- `quiet.sh`: runs `measure.sh` once the host's load is below a gate and records the load.
- `profile.mjs`: CPU profile of one cold load with skwasm symbol names, frame raster times,
  long tasks, request timing and per-task attribution. `frametrace.mjs`: what each Flutter frame
  built and laid out (needs a throwaway profile build). `diag.mjs`: `lighthouse.mjs` that also
  writes the full report.
- `guardrails.sh`: forbidden paths, the generated icon files, analyze, the app test suite.
- `attempts/05-drawn-list.patch`: attempt 5 with its widget test, for the lead.
- `docs/hillclimb/hc-web-lighthouse.md`: the baseline, every attempt, what limits the score and
  the next steps; `docs/DECISIONS.md`, Job 129.

## How to verify

```
tool/hillclimb/hc-web-lighthouse/measure.sh          # one JSON line; screenshots in /tmp/hc129-last/
HC129_MAX_LOAD=6 tool/hillclimb/hc-web-lighthouse/quiet.sh
tool/hillclimb/hc-web-lighthouse/guardrails.sh
```

## Review 0

Must fix 1 fixed: the `add` page's ready check passed on the plain list (the add bar is an input
too). It now requires the sheet's hint and no list rows; checked to be false on `/` and true on
`/add`, and a confirming `measure.sh 1` passed (75). Also: the `quiet.sh` comment corrected, the
gating difference between the baseline and attempts 1/3 stated, the attempt-5 patch marked as a
proposal.

## Findings for the lead

1. Cross-origin isolation headers let skwasm raster off the main thread (side run: TBT about
   halved, list performance up to 91); a deploy-header change that needs the sign-in popups
   checked first.
2. `ListCubit._onChannelStatus` re-emits an unchanged connection status on every failed
   resubscribe, a frame each; guard it at the source.
3. Attempt 5's patch removes the list relayouts those emits cause; attempt 1 (inline splash
   marks) makes LCP stable.

## Missing or blocked

Nothing blocked. The fixes in findings 2 and 4 of the log touch files that queued fix rounds
owned during this job (#253, #237).
