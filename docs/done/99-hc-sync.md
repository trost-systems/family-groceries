# Job 99: hc-sync, offline and sync robustness (HC1 hill-climb)

**What.** A seeded fuzz harness for the list's sync layer, and eight fixes in `ListCubit` (one
needs a two-line interface change in `ListRepository.watch`). Score: failing seeds of 1..1000,
from 175 to 0. Log, conflict rule and harness: [`docs/hillclimb/hc-sync.md`](../hillclimb/hc-sync.md).

**Where.**
- `app/test/fuzz/`: `fake_backend.dart` (an in-memory Postgres behind a fake `http.Client`, so the
  real `SupabaseListRepository` and `supabase_flutter` run; fake Realtime per device),
  `sim.dart` (3 devices, 60 random steps per seed, network drops, restarts; oracle; shrinker),
  `sync_fuzz_test.dart` (self-tests and seeds 1..100 in every `flutter test`; `FUZZ_SEEDS`,
  `FUZZ_REPRO`, `FUZZ_STRICT`, `FUZZ_MODEL=join-gap`, `FUZZ_PROPOSAL=delete-wins`, `FUZZ_STEPS`).
- `tool/hillclimb/hc-sync/measure.sh`: the score as one JSON line.
- `app/lib/list/list_cubit.dart`, `list_repository.dart`: the fixes.
- `app/test/list/sync_regressions_test.dart`: one test per bug, named after its seed.
- NEEDS_LEAD: a delete should win over a replayed add (`put_item` overload,
  `docs/hillclimb/hc-sync-proposals/put_item_delete_wins.sql`, `docs/NEEDS_LEAD.md` "Job 99").

**The bugs, as a user would have seen them** (all races; the normal online case is unchanged):
1. A partner's tick or edit arriving during a reload was undone on screen by the reload's older
   snapshot; an item ticked between the reload's two queries vanished (175 to 6).
2. Two overlapping reloads (reconnect and retry) landing in the wrong order showed older values
   (6 to 2).
3. A slow answer to your own tick or edit put back an item a partner had just deleted (2 to 0).
4. The same, when the answer came during a reload while the live connection was down (sweep).
5. An item added offline on a first start, before the list ever loaded, was lost if the app was
   closed (sweep).
6. A "gone" answer removed an item a partner had just restored (sweep).
7. Fix 3 missed writes the phone never heard live; a delete's commit time now bounds them (sweep).
8. The same, when the answer came after a reload that already showed the delete (sweep).

**Verify.** `cd app && flutter test test/fuzz test/list/sync_regressions_test.dart`;
`tool/hillclimb/hc-sync/measure.sh` prints `"failures_per_1000": 0.0`. A failing seed:
`FUZZ_REPRO=<seed> FUZZ_REPORT=/tmp/r.txt flutter test test/fuzz/sync_fuzz_test.dart --plain-name 'sync fuzz repro'`.

**Tests.** `flutter test`: 1751 passed, 90 skipped, 4 failed. The 4 failures are the wide
goldens, 13 px each, the same as on main on this box (1737 passed, 88 skipped, 4 failed).
`flutter analyze`: no issues. `scripts/lint.sh`: ok.

**Open.** The NEEDS_LEAD proposal (not applied; its SQL has not run against Postgres, since
there is no Docker on the box). Sweeps 6001..60000 were not re-run on the final commit.
