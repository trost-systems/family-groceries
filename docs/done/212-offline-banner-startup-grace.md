# Job 212: a 10 s grace before "Offline" on start and resume (2026-11-13)

Peter (t827u): the offline banner sometimes showed right after opening the app on a slow
network. It now waits up to 10 s for the server after a start or a return to the app.

## What shipped (PR #408)

- **The grace:** `startGrace = 10 s`, `app/lib/list/list_cubit.dart:214`.
  - It starts in `start()` and in `resumed()` (`:420`), after the app was hidden (`hidden()`,
    `:414`). It is wired in `app/lib/list/list_scope.dart:234-235` (`onHide`, `onResume`).
  - While it runs, failed reads and dropped or slow realtime joins are retried unseen (`_holding`,
    `:256`; `_goOffline`; `_onChannelStatus`).
  - When it ends with no answer and no live channel, the list says offline (`_graceOver`, `:437`).
  - The first answer ends it (`onChange`, `:1917`). After that, failures show at once as before.
  - A realtime join begun in the grace keeps its whole 10 s timeout.
- **Hide on a successful request:** `_showSnapshot` sets `online` after any answered resync,
  even while realtime is still joining (`:1576`). It does not do so while the OS reports no
  network. The one channel error of a socket renewal is held (`:587`), so the reconnect doesn't
  flicker.
- **OS offline:** job 166's `NetworkWatch` (`app/lib/app/network.dart:20`, `connectivity_plus`:
  the browser's online/offline events on the web, NWPathMonitor on iOS, the network callback on
  Android; none on Linux). Reported down, it shows offline at once, also during the grace.
- **Unchanged:**
  - The banner's look, copy and placement.
  - The REST reads get no new timeout, and PostgREST retries stay off.
  - The realtime timeout stays at its 10 s default.
  - No feature flag: it reaches every install with the next green main build on TestFlight and
    Play internal.
  - "Sync gestört" (5xx) has no grace.

## Proof

- **Fake-clock tests:** `app/test/list/list_cubit_test.dart:937`, group "the start grace (job 212)".
  - **Slow first request:** "a first fetch still in flight stays connecting through the grace,
    then shows offline" (`:964`). The read is held open: no banner at 9.9 s, the banner at
    10.1 s, hidden once it answers.
  - **Failed, then answered:** "a first fetch that fails and answers on a retry in the grace
    never shows offline" (`:981`).
  - **Realtime drops in the grace:** "a channel that drops in the grace shows nothing; it comes up
    before the grace is over" (`:1011`).
  - **No answer:** "no answer in the whole grace shows offline once it is over" (`:999`).
  - **OS offline:** "the OS saying no network shows offline at once, in the grace" (`:1070`).
  - **Also covered:** the join timing out just after the grace, failures after the list was
    online, the background hold, resume, a web refocus, and an answer while the OS says no network.
- **Mutation checks:** with the grace off, 6 tests fail. With "online only with the channel up",
  9 tests fail. Removing each review fix (renewal hold, OS-down check, keep a seen offline,
  background hold) fails its test.
- **Full `flutter test`:** passed (2875). The goldens are unchanged.
- **e2e on the web build, local stack, port block 612:** `offline-start`, `connectivity`,
  `live-sync` and `list-header`, 15/15 passed on both branch commits. After a reload with the
  server cut off, the cached list shows within 3 s, there is no banner at 8 s, and the banner
  appears 9 s or more after the reload.
- **Opus reviews:** review.0 FAIL (2 must-fixes, both fixed). review.1 PASS (docs line and the
  web-focus note, both fixed).

## Not done

- **A resume doesn't resubscribe a down channel at once.** The resubscribe backoff (up to 30 s)
  runs on. On a phone, supabase_flutter rejoins joined channels itself on resume.
- **Catalog changes during a grace on a dead network** say "could not be saved" instead of
  "needs connection".
- Nothing needs Peter.
