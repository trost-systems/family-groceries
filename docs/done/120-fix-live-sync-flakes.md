# Job 120: live-sync.spec.ts channel recovery and join-flow flakes (#65, #66, #67)

**What.** A root-cause hunt for three flaky tests in `e2e/tests/live-sync.spec.ts`. All three are
host pauses: they fail only when a stall outlasts the budget it lands in, which is 2 s (the `within`
live windows), about 6.7 s (`reveal`'s scroll steps), 10 s (an `expect`), 20 s (`typeInto`) or
60 s (the test). A 2 s window fails whenever a stall longer than 2 s lands in it, whether of the
runner, Chromium or the stack, and only a runner stall gets the retry. No test, app or fixture
changes. The evidence is in DECISIONS "Job 120", and the close-or-keep call for
the lead is in NEEDS_LEAD "Job 120". The PR references the issues as `Refs #n (host-pause only)`.

- #65, "the list recovers when Realtime closes the list channel": 60 s while setting up `page`
  (2026-10-25), before the stall detector existed. Setting up `page` is one new context and page.
  In the 12 s stall arms' traces, `page` took at most 0.06 s and `context` at most 0.59 s. A
  host pause inferred, with no direct record: CI never failed it on main, and the box's VM was
  then paused for minutes at a time. The BOARD's 21:50 mem-guard line stopped job 15, not this
  run, for under a minute, so it isn't evidence for this failure.
- #66, "an invite link takes a new user ...", and #67, "a member of another household joins ...":
  the 20 s predicate is `typeInto`'s `toPass`, the type-and-check-value loop. It does not wait
  on the household switch, the Realtime resubscribe or the list reload. The stall detector
  measured pauses of 75 s and 505 s (#66) and 199 s (#67). #67's 2026-10-26 failure has no
  detector line. Its 1053 s gap comes from the verify loop's own mem-guard record.
- Job 126's hand-off (a row from `add_items` that "never reached the open list" after 8 s stack
  pauses): a late row, not a lost one. In review 2's trace, `reveal` gave up inside the stack
  pause that held the row in Realtime (DECISIONS "Job 120" item 6).

**Stressed repro (main 1ba6dc51, release web build, retries off).**

Each pause arm repeats a cycle: S s paused, then P s running.

| Arm | Runs | Result |
| --- | --- | --- |
| No stress (whole spec) | 32 | all passed |
| CPU: runner and Chromium on 2 cores with 4 or 8 busy loops | 39 | all passed |
| Runner and Chromium: 5 s paused, 7 s running; and 8 s paused, 6 s running | 38 | all passed |
| Chromium alone stopped 5 s at a time, 7 s running between | 15 | all passed |
| Stack (Realtime, Kong, GoTrue, PostgREST) paused 5 s at a time, 10 s running between | 15 | all passed |
| 9 s paused: stack (12 s running), runner (10 s running), Chromium alone (10 s running) | 45 | all passed |
| Stack paused 12 s at a time, 15 s running between | 15 | 8 failed: 10 s `expect`s across the stall |
| Runner stopped 12 s at a time, 10 s running between | 15 | 4 failed, each named by the stall detector |
| Review 0: Chromium alone 9 s paused, 10 s running, two runs | 19 | 2 failed: the invite test's 2 s live window |
| Review 0: Chromium alone 1 s paused, 2 s running | 10 | all passed |
| Review 2: stack 8 s paused, 6 s running, whole spec x3 | 24 | 5 failed, all in a 2 s live window |
| Review 2: stack 12 s paused, 15 s running | 15 | 7 failed: six 10 s `expect`s, one 2 s live window |
| Review 2: `classifier.spec.ts` learning, stack 8 s paused, 6 s running, x12 | 12 | 1 failed: `reveal` ran out inside the pause |
| Review 3: stack 1 s paused, 3 s running, whole spec x3 | 24 | all passed |
| Review 3: stack 3 s paused, 6 s running, whole spec x3 | 24 | 2 failed, both in a 2 s live window |

The 12 builder failures' page snapshots and screenshots are in the ops dir,
`~/groceries-ops/jobs/120-fix-live-sync-flakes/evidence/` (the traces stayed in `/tmp/fg120` on
hz). None of the snapshots shows the Offline marker.

**CI.** In 1,215 readable e2e logs (2026-10-28 to 2026-11-05), live-sync had no flaky test. Each
of the five failures was caused by its own branch: job/33c, job/22, job/25, and job/78 twice.
The scan is `evidence/ci-scan/scan.sh` in the ops dir (read-only `gh`, caches logs in
`/tmp/fg120-ci/logs`). It reports the counts. List the failing logs with
`grep -l '✘.*live-sync' /tmp/fg120-ci/logs/*.log`, since its own failure list missed three of
the five.

**20x on the release web build** (under `flock /tmp/fg-e2e.lock`):

```
npx playwright test tests/live-sync.spec.ts --repeat-each=20 --workers=1 --retries=0
head 522e2f67 (main 02cc9da8), release --wasm build, 2026-11-06 20:13:  160 passed (28.4m)  (review 3)
head a9a7e0eb (main 02cc9da8), release --wasm build, 2026-11-06 19:03:  160 passed (24.2m)
head 8880f8a0 (main aae7fb34), release --wasm build, 2026-11-06 17:17:  160 passed (24.4m)
head d3c5fe65 (main 5062100c), release --wasm build, 2026-11-06 15:09:  160 passed (24.6m)  (review 1)
head ca5b8864 (main 694114ee), release --wasm build, 2026-11-06 09:42:  160 passed (24.7m)
head 4150ef85 (main 4a103f67), release --wasm build, 2026-11-06 04:30:  160 passed (38.9m)
```

**Rerun.** Save the script below outside the repo, for example as `/tmp/stress.sh`. Bring the
stack up with the job's ports and put the release web build in `app/build/web`. Then, from
inside the checkout, run
`flock /tmp/fg-e2e.lock /tmp/stress.sh pause-stack 12 15 /tmp/stack12.log -- tests/live-sync.spec.ts -g 'invite link takes|joins with a code|closes the list channel' --workers=1 --retries=0 --repeat-each=5 --trace retain-on-failure --output /tmp/out-stack12`.
Use one `--output` directory per arm, or the next arm overwrites the failure traces. The exit
status is 1 when the run's summary line has a failed or flaky count.

```bash
#!/usr/bin/env bash
# Runs Playwright in e2e/ under one kind of stress and logs every pause it makes.
#   none                 no stress
#   cpu                  runner + Chromium pinned to CPUS (default 2 cores), BURNERS busy loops pinned there too
#   pause-browser S P    SIGSTOP the runner and Chromium for S s, then lets them run P s (the stack keeps running)
#   pause-chromium S P   SIGSTOP only Chromium (the runner's clock keeps running)
#   pause-stack S P      docker pause this job's realtime, kong, auth and rest for S s, then lets them run P s
set -uo pipefail
# Usage: stress.sh <mode> [S P] <log> -- <playwright args>
mode=$1; shift
S=0 P=0
case $mode in pause-*) S=$1 P=$2; shift 2 ;; esac
log=$1; shift
[[ $S =~ ^[0-9]+$ && $P =~ ^[0-9]+$ && $log == /* ]] || { echo "bad args: mode=$mode S=$S P=$P log=$log" >&2; exit 2; }
[[ ${1:-} == -- ]] && shift
# Run from inside the checkout; it uses that checkout's e2e/ and supabase/config.toml.
cd "$(git rev-parse --show-toplevel)/e2e" || exit 2
CPUS=${CPUS:-10,11} BURNERS=${BURNERS:-4}
project=$(sed -n 's/^project_id = "\(.*\)"$/\1/p' ../supabase/config.toml)
burners=()
note() { echo "[stress $(date +%T.%3N)] $*" >>"$log"; }
note "mode=$mode S=$S P=$P args=$*"
first=$(wc -l <"$log")
if [[ $mode == cpu ]]; then
  for _ in $(seq "$BURNERS"); do taskset -c "$CPUS" bash -c 'while :; do :; done' & burners+=($!); done
  taskset -c "$CPUS" npx playwright test "$@" >>"$log" 2>&1 &
else
  npx playwright test "$@" >>"$log" 2>&1 &
fi
runner=$!
tree() { local p; for p in $(pgrep -P "$1"); do echo "$p"; tree "$p"; done; }
targets() {
  case $mode in
    pause-browser) tree "$runner" ;;
    pause-chromium) for p in $(tree "$runner"); do [[ $(cat /proc/"$p"/comm 2>/dev/null) == *chrom* ]] && echo "$p"; done ;;
  esac
}
cleanup() {
  [[ ${#burners[@]} -gt 0 ]] && kill "${burners[@]}" 2>/dev/null
  if [[ $mode == pause-stack ]]; then docker unpause "${containers[@]}" >/dev/null 2>&1; fi
  local all; all=$(tree "$runner")
  [[ -n $all ]] && kill -CONT $all 2>/dev/null
  kill -0 "$runner" 2>/dev/null && { kill $all "$runner" 2>/dev/null; }
  true
}
trap cleanup EXIT
containers=()
for c in realtime kong auth rest; do containers+=("supabase_${c}_$project"); done
if [[ $mode == pause-* ]]; then
  # Let the runner start and the first page boot before the first pause.
  sleep 8
  while kill -0 "$runner" 2>/dev/null; do
    if [[ $mode == pause-stack ]]; then
      docker pause "${containers[@]}" >/dev/null 2>&1; note "paused stack ${S}s"
      sleep "$S"; docker unpause "${containers[@]}" >/dev/null 2>&1
    else
      pids=$(targets); kill -STOP $pids 2>/dev/null; note "paused $(wc -w <<<"$pids") pids ${S}s"
      sleep "$S"; kill -CONT $pids 2>/dev/null
    fi
    note resumed
    sleep "$P"
  done
fi
wait "$runner"; rc=$?
# The verdict is Playwright's summary line: a failed or flaky count fails the run whatever the
# exit status said. A caller that writes "$(date) rc=$?" loses $? to the date: take rc=$? first.
tail -n +"$first" "$log" | grep -qE '^ +[0-9]+ (failed|flaky)$' && rc=1
note "exit $rc"
cleanup; trap - EXIT
exit "$rc"
```

**Missing or blocked.** Nothing. The lead decides whether to close #65, #66 and #67.
