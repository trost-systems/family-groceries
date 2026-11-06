# DONE_SUMMARY: Job 123, voice.spec.ts flakes #78 and #79 (2026-11-05, Hetzner runner)

PR: https://github.com/trost-systems/family-groceries/pull/266 (ready for review, **not merged**; the lead merges).

## Outcome

Both flakes are host pauses only, so nothing in the app, the voice function, the test or the
fixtures changes. The PR adds the evidence: `docs/DECISIONS.md` ("Job 123") and
`docs/NEEDS_LEAD.md` ("Job 123", closing #78 and #79 is the lead's call). The PR body says
`Refs #78 (host-pause only)` and `Refs #79 (host-pause only)`, and both issues stay open.

- Every recorded failure fell in a host pause of 177 to 1801 s. #79's one failure without a
  stall line ran 29.6 min inside a 1801 s mem-guard hole (job 18's failure table).
- The voice path is fast on the local runtime. A call takes 220 to 490 ms warm and 230 ms as the
  first call after a runtime restart. A PAT mint takes 6 ms. The list resyncs on every channel
  subscribe, so it does not depend on Realtime arriving before the write.
- Stressed repro on origin/main 1ba6dc51 (release web build, `--retries=0`, one worker, under
  `/tmp/fg-e2e.lock`). Under CPU load and stack-only pauses of up to 8 s every 14 s, 90 of 90
  runs passed. Failures came only when the runner and Chromium were stopped for most of a 10 s
  wait. All 11 failing attempts printed `[host-stall]` (7 to 9 s), and the 18.23 stall retry
  covers those.

| Stress | Passed | Failed (dictated / token) | Stall marks in failing attempts |
| --- | --- | --- | --- |
| none | 10/10 | 0 / 0 | |
| cpu (8 busy loops) | 10/10 | 0 / 0 | |
| client 8/6 (runner + Chromium SIGSTOP 8 s every 14 s) | 10/10 | 0 / 0 | |
| stack 3/7 (`docker pause` of the stack 3 s every 10 s) | 10/10 | 0 / 0 | |
| stack 8/6 | 20/20 | 0 / 0 | |
| cpu + stack 3/7 | 20/20 | 0 / 0 | |
| cpu + stack 8/6 | 20/20 | 0 / 0 | |
| cpu + client 8/6 + stack 3/7 | 18/20 | 2 / 0 | 2 of 2, 7 to 8 s |
| cpu + client 9.5/3 + stack 9/4 | 11/20 | 5 / 4 | 9 of 9, 9 s |

No fix, so there is no "after" row: the code under test is origin/main's.

20x on the release web build, under the lock, retries off:

```
npx playwright test tests/voice.spec.ts --repeat-each=20 --workers=1 --retries=0
  260 passed (17.7m)        # origin/main 1ba6dc51, hz
  280 passed (20.0m)        # main 694046e0 (after #248 and #257) + this PR, hz
```

On GitHub Actions, the same 20x on the PR head a05a7b40 (main 694046e0, after #248 and #257,
14 tests): `280 passed (13.9m)`,
https://github.com/trost-systems/family-groceries/actions/runs/42111182934.

ci-ok on a05a7b40: success,
https://github.com/trost-systems/family-groceries/actions/runs/42105019691. A docs-only PR
skips the e2e gate, which is why the 20x ran on demand.

## How to rerun

Stack on the checkout's own port block, `scripts/gates/e2e.sh`'s web build, then
`flock /tmp/fg-e2e.lock ./matrix2.sh <label> <repeat> <mode>...`, for example
`... before 10 none cpu client8/6 stack8/6 cpu+client8/6+stack3/7`. Each mode runs the two tests
with retries off and prints passed, failed and the `[host-stall]` count. The latency numbers
come from `latency.mjs`, run from `e2e/` with the stack's `SUPABASE_URL` and
`SUPABASE_PUBLISHABLE_KEY` exported (`scripts/lib.sh` `supabase_up`). Neither script talks to a
hosted service.

<details><summary>matrix2.sh</summary>

```bash
#!/usr/bin/env bash
# Stressed repro for voice.spec.ts (job 123), after job 18c's method (DECISIONS 18.23).
# Run under the lock: flock /tmp/fg-e2e.lock matrix2.sh <label> <repeat> <mode>...
#   mode: none, or [cpu+][client<on>/<off>+][stack<on>/<off>], e.g. stack8/6, cpu+client8/6+stack3/7
# Each mode: the two flaky tests, retries off, one worker; stress runs only inside the lock.
set -uo pipefail
label=$1 repeat=$2; shift 2
grep=${FG123_GREP:-'dictated sentence|own household'}
wt=${FG123_WT:-/home/agents/fg-wt/123-fix-voice-spec-flakes}
project=family-groceries-123
root=/home/agents/fg123/runs/$(date +%m%d-%H%M%S)-$label
mkdir -p "$root"
cd "$wt/e2e"
source "$wt/scripts/lib.sh" >/dev/null
supabase_up >/dev/null 2>&1

descendants() { local p; for p in $(pgrep -P "$1"); do echo "$p"; descendants "$p"; done; }

run_mode() {
  # mode: [cpu+][client<on>/<off>+][stack<on>/<off>]   e.g. stack8/6, cpu+stack3/7, none
  local mode=$1 out="$root/${1//\//_}" helpers=() runner rc part
  mkdir -p "$out"
  npx playwright test tests/voice.spec.ts -g "$grep" --repeat-each="$repeat" --workers=1 --retries=0 --output="$out/results" \
    --reporter=line >"$out/playwright.log" 2>&1 &
  runner=$!
  IFS=+ read -ra parts <<<"$mode"
  for part in "${parts[@]}"; do
    case $part in
      cpu) for _ in 1 2 3 4 5 6 7 8; do (while :; do :; done) & helpers+=($!); done ;;
      client*) local on=${part#client}; local off=${on#*/}; on=${on%/*}
        ( sleep 8; while kill -0 "$runner" 2>/dev/null; do
            pids=$(descendants "$runner"); echo "$runner $pids" >>"$out/stopped.pids"; kill -STOP "$runner" $pids 2>/dev/null
            echo "$(date +%T.%N) stop client" >>"$out/pauses.log"; sleep "$on"
            kill -CONT "$runner" $pids 2>/dev/null; sleep "$off"; done ) & helpers+=($!) ;;
      stack*) local son=${part#stack}; local soff=${son#*/}; son=${son%/*}
        ( sleep 8; while kill -0 "$runner" 2>/dev/null; do
            ids=$(docker ps -q --filter "name=_${project}\$" --filter status=running)
            docker pause $ids >/dev/null; echo "$(date +%T.%N) pause stack" >>"$out/pauses.log"; sleep "$son"
            docker unpause $ids >/dev/null; sleep "$soff"; done ) & helpers+=($!) ;;
    esac
  done
  wait "$runner"; rc=$?
  for p in "${helpers[@]}"; do pkill -P "$p" 2>/dev/null; kill "$p" 2>/dev/null; done
  wait 2>/dev/null
  [[ -f $out/stopped.pids ]] && kill -CONT $(cat "$out/stopped.pids") 2>/dev/null
  docker unpause $(docker ps -q --filter "name=_${project}\$" --filter status=paused) >/dev/null 2>&1
  { echo "== $label $mode rc=$rc $(grep -cE 'stop client|pause stack' "$out/pauses.log" 2>/dev/null || echo 0) events"
    grep -E "^\s+[0-9]+ (passed|failed|flaky)" "$out/playwright.log"
    grep -E "^\s+[0-9]+\) |^\s+Error:|Received string|^\s+> [0-9]+ \|" "$out/playwright.log" | head -30
    grep -c "host-stall" "$out/playwright.log" | sed 's/^/host-stall lines: /'
  } | tee -a "$root/summary.txt"
}
for mode in "$@"; do run_mode "$mode"; done
echo "summary: $root/summary.txt"
```

</details>

<details><summary>latency.mjs</summary>

```js
// Times the voice call (warm and right after an edge-runtime restart) and PAT minting.
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_PUBLISHABLE_KEY;
const project = 'family-groceries-123';
async function user() {
  const c = createClient(url, key, { auth: { persistSession: false } });
  const email = `lat-${Math.random().toString(36).slice(2, 10)}@example.test`;
  const { error } = await c.auth.signUp({ email, password: 'test-password-123' });
  if (error) throw error;
  const h = await c.rpc('create_household', { p_name: 'Unser Haushalt' });
  if (h.error) throw new Error(JSON.stringify(h.error));
  return c;
}
async function say(token, text) {
  const t = performance.now();
  const r = await fetch(`${url}/functions/v1/voice?format=text`, { method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
  const body = await r.text();
  return { ms: Math.round(performance.now() - t), status: r.status, body };
}
const c = await user();
let t = performance.now();
const { data, error } = await c.rpc('create_personal_access_token', { p_name: 'Siri' });
if (error) throw error;
console.log('mint pat ms', Math.round(performance.now() - t));
const token = data[0].token;
for (let i = 0; i < 3; i++) console.log('warm', await say(token, 'Milch, zwei Gurken und Klopapier'));
for (let i = 0; i < 3; i++) {
  execSync(`docker restart supabase_edge_runtime_${project}`);
  t = performance.now();
  let r; do { r = await fetch(`${url}/functions/v1/health`).catch(() => ({ status: 0 })); await r.body?.cancel?.(); } while (r.status >= 500 || r.status === 0);
  console.log('runtime up ms', Math.round(performance.now() - t));
  console.log('cold voice', await say(token, `Zahnpasta${i}`));
  console.log('second voice', (await say(token, `Seife${i}`)).ms);
}
```

</details>

## Not done

- Nothing in `supabase/functions/voice/` changed, so #247 and #248 don't conflict.
- `deno run -A tool/lint/ts/strict.ts`: not needed. #237 has landed (9a1dec19), but the PR has no TS or JS.

## Review 0 (2026-11-06)

The lead asked for a rebase only: the PR conflicted with main. The conflicts were end-of-file appends in `docs/DECISIONS.md` and `docs/NEEDS_LEAD.md`, and both sides are kept. The PR still only adds lines (46, 16 and the done doc). Nothing under test changed, so the stress evidence above still applies.

## Review 1 (2026-11-06)

Another rebase only. The conflict was again an end-of-file append in `docs/DECISIONS.md`, and both sides are kept. The PR still only adds lines.

## Review 2 (2026-11-06)

- Rebased onto main 5e639d3a. The conflict was again an end-of-file append in `docs/DECISIONS.md`, and both sides are kept. The PR still only adds lines.
- The reviewer ran its own 20x on 31e0a65a, with the release web build under the lock: `280 passed (20.0m)`, 0 `[host-stall]` lines. The newer main commits touch nothing under `e2e/`, `app/lib/list/` or `supabase/functions/voice/`.
- The DECISIONS point 3 arithmetic is now spelled out. The `matrix2.sh` header names its real mode syntax. The #237 note is corrected.
- The ci-ok runs cited above are for earlier heads. The final head and its ci-ok run are in the ops-dir DONE_SUMMARY and on the PR checks.

## Review 3 (2026-11-06)

Rebased onto main 598291fc, rebase only. The conflicts were end-of-file appends in `docs/DECISIONS.md` and `docs/NEEDS_LEAD.md`, and both sides are kept. The PR still only adds lines.
