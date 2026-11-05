# hc-cache-codec

Started: 2026-11-05 21:13:11 CET (epoch 1793909591)

Goal: make the local list-cache snapshot encode/decode faster and smaller,
without dropping fields, changing what the list shows, or touching the
Supabase/realtime wire format. Job 132, runner hz.

## The persistence path on main (72334ea9)

- `ListCubit` holds a `ListCache` (`app/lib/list/list_cache.dart`) and calls
  `save(ListSnapshot)` / `load()`.
- The only implementation is `_PrefsListCache` in
  `app/lib/app/device_cache.dart`: `save` checks the remembered household
  (`DeviceCache.household`, a small `jsonDecode`), then
  `SharedPreferencesAsync.setString('list.<user>.<household>',
  jsonEncode(snapshot.toJson()))`. `load` is `getString` then
  `ListSnapshot.fromJson(jsonDecode(s))`, which upgrades v1/v2 snapshots to
  v3 first. A value that cannot be read counts as missing.
- So the stored value is a `String`: on Android DataStore, on iOS/macOS
  UserDefaults, on Linux one JSON file (`device_cache.json`, the whole store
  re-encoded on every write), on web localStorage. Any tighter format still
  has to be a String.
- `ListSnapshot.toJson` builds maps through `Catalog/Item/ItemOp/Usual.toJson`
  with server column names; items carry 15 keys each, including nulls and
  ISO-8601 timestamps.

## Measurement

`tool/hillclimb/hc-cache-codec/measure.sh` runs
`app/test/hillclimb/cache_codec_bench_test.dart` under
`flock /tmp/fg-hc-measure.lock`. The test builds two seeded snapshots
(seed 132 and 133, `Random`): **full** = 5,000 server items (6 % open),
**open** = 300 open items; both with a 15-category, 5-store catalog
(75 layout rows), 2 members, 12 queued ops covering all 8 op kinds and 40
usuals. Ids are v4 uuids, times are UTC with microseconds, as PostgREST
sends them. It saves and loads each through `DeviceCache.list(...)` with
the in-memory `SharedPreferencesAsync` platform (the real `_PrefsListCache`
code; the platform store itself is out of scope), 10 discarded warm-up
iterations, then N=30 timed ones.

- `encode_ms` / `decode_ms`: p50 of the `save()` / `load()` wall times.
- `bytes`: UTF-8 length of the stored string.
- `round_trip`: every load's `jsonEncode(toJson())` equals the original's.
  `toJson` is the reference field list (independent of the stored format), so
  a dropped or altered field fails it. A false round trip exits non-zero.

score = 0.4 * encode + 0.4 * decode + 0.2 * bytes, where each part is the
mean over full and open of p50 / baseline p50 (`baseline.json`, the per-part
medians of the 3 baseline runs). Lower is better; the baseline is 1.0 by
construction. Averaging the two ratios keeps the 300-item case (what most
starts load) from being drowned by the 5,000-item one.

Deterministic: fixed seeds and data, fixed iteration counts; bytes are exact.
Timings run in the flutter test VM (JIT after warm-up, not AOT), so absolute
ms differ from a release build; ratios are what the score uses.

## Baseline (72334ea9 + harness)

| run | score | full enc | full dec | open enc | open dec | load avg |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 0.9219 | 28.89 | 43.02 | 1.995 | 1.900 | 16.5 |
| 2 | 0.9846 | 33.24 | 51.00 | 1.842 | 2.119 | 14.1 |
| 3 | 1.0940 | 37.21 | 53.66 | 2.237 | 2.494 | 9.6 |

Bytes: full 2,333,023, open 151,962 (466 B per item). Median score 0.9846;
noise band 0.172 (max minus min). A fourth check run scored 1.1507: the host
runs up to 11 jobs and timings swing about 20 %. A step near the band is
judged with alternating candidate/HEAD pairs (`/tmp/hc132/ab.sh`: HEAD in a
detached worktree, each run under the lock).

The band is applied as a relative one: 0.172 / 0.985 = 17.5 % of the current
best. An absolute 0.172 could never be cleared once the score is below 0.29,
and the noise is multiplicative (host load slows every timing alike). The
bytes part is exact and needs no band. With A/B pairs, a step is kept when
every pair favours it and the median candidate/HEAD ratio is below 0.825.
Tie-break (set before attempt 5's extra runs): when one of 4 pairs
ties, run 4 more and keep only if 7 of 8 favour it and the median of all 8
ratios is below 0.825.

Guardrails at baseline: `flutter analyze` no issues; `flutter test` 1853
passed, 91 skipped, 76 s.

## Re-baseline after a harness bug (22:20)

After attempt 9, an A/A check (the same commit in this worktree and in a
detached one) put this worktree 7-27 % slower in all 9 pairs, in either
order. Deleting `app/build/test_cache` removed it: the bench ran from a stale
incremental test kernel left by many edit-and-test rounds. Every candidate
had run from that worktree and every HEAD from the clean one, so kept steps
were judged against a handicap (they stand), and attempts 7-9 may have been
rejected by it.

Fix: `measure.sh` deletes `app/build/test_cache` before each run (the only
change). Re-baselined on 921fa383 (main + harness) in a clean worktree:

| run | score | full enc | full dec | open enc | open dec | load avg |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 1.0136 | 28.41 | 44.08 | 1.594 | 1.798 | 10.0 |
| 2 | 1.0287 | 32.00 | 46.48 | 1.483 | 1.741 | 8.1 |
| 3 | 0.9812 | 27.68 | 41.05 | 1.536 | 1.746 | 6.5 |

Median 1.0136, band 0.0475 (4.7 % relative). `baseline.json` now holds these
medians; all later scores use it. HEAD (8a9145e6, attempts 1-6) re-measured:
0.1790, 0.2034, 0.1491 (median 0.1790). A/A with the fixed harness: ratios
0.954, 1.007, 1.244, so no side bias now; single runs still swing about
15 %, mostly the 300-item case's sub-millisecond timings.

Decision rule from here: A/B pairs as before, kept when all 4 pairs favour
the candidate and the median ratio is below 0.953 (1 minus the new band).

## Attempts

Scores in rows 1-9 use the first baseline; from row 10 the second.


| # | time | change | score | kept | why |
| --- | --- | --- | --- | --- | --- |
| 1 | 21:29 | v4 binary snapshot (`b4:` + base64): one string table, varints, UTC times as µs, sort keys as half steps; JSON v1-v3 still read (main fixture) | 0.2897 (0.2822, 0.2897, 0.3050) | kept | enc 0.36x, dec 0.25x, bytes 0.23x; round trip true; 1857 tests green |
| 2 | 21:36 | string table as raw text after the base64 part (`.` splits; lengths in the binary part), no UTF-8 or base64 work on strings | 0.1708 (0.2416, 0.1580, 0.1708); A/B pairs head 0.2802/0.1981/0.2526 vs cand 0.1655/0.1970/0.1864 | kept | pooled medians 0.281 -> 0.179 (-36 %); bytes 0.233 -> 0.206 exact; decode wins every pair |
| 3 | 21:41 | an item's updated and bought times relative to the time before (same-instant tag reuses the DateTime; else a UTC delta) | A/B 4 pairs: head 0.1827/0.1859/0.2126/0.1897 vs cand 0.1359/0.1510/0.1584/0.1584; single 0.1669 | kept | median pair ratio 0.78; decode -30 % (14,700 fewer large varints, ~4,700 DateTimes shared), bytes 0.206 -> 0.187 |
| 4 | 21:44 | item ids skip the dedupe map (appended to the table list), `??=` instead of a putIfAbsent closure | A/B 4 pairs: head 0.1880/0.2118/0.1943/0.2278 vs cand 0.1768/0.1814/0.1864/0.1583 | reverted | median pair ratio 0.90 (> 0.825): full encode -30..55 % every pair, but the 300-item case did not move; patch kept as a near-miss |
| 5 | 21:50 | no base64: numbers written straight as base64-alphabet digits (5 bits + continuation), decode reads codeUnitAt on the stored string | A/B 8 pairs (tie-break): ratios 0.849, 1.000, 0.762, 0.688, 0.969, 1.007, 0.881, 0.893; bytes 0.187 -> 0.184 | reverted | median 0.887 (> 0.825), 6 of 8 favour it; the gain shrank as load rose; near-miss patch kept |
| 6 | 21:54 | attempts 4 + 5 together: digits instead of base64, and item ids skip the dedupe map | A/B 4 pairs: head 0.1966/0.1828/0.2008/0.2094 vs cand 0.1120/0.1520/0.1513/0.1702; single 0.1250 | kept | median pair ratio 0.78, all 4 favour; full encode 6.3 -> 3.8 ms, decode -20 %; bytes 0.184; 1857 tests green |
| 7 | 22:00 | writers sized to the snapshot (body 1 KB + 64 per item, head 3 per string) instead of 64 KB each | A/B 4 pairs: head 0.1669/0.1154/0.1147/0.1131 vs cand 0.1645/0.1210/0.1282/0.1357 | reverted | worse: open encode 0.25 -> 0.35 ms; the 64 KB buffers were not the fixed cost the noisy split suggested |
| 8 | 22:06 | one header per item: status and the sort-key and time tags in one number (2 digits open, 3 bought) | A/B 4 pairs: head 0.1212/0.1244/0.1324/0.1147 vs cand 0.1271/0.1205/0.1313/0.1532; bytes 0.184 -> 0.179 | reverted | no time gain; 3 fewer calls per item are lost in noise; patch kept |
| 9 | 22:09 | indexed loop in the writer's list(), List.generate in the reader's | A/B 4 pairs: head 0.1209/0.1248/0.1192/0.1264 vs cand 0.1187/0.1455/0.1526/0.1434 | reverted | worse in 3 of 4 pairs |
| 10 | 22:30 | attempt 8 (one header per item) again, fixed harness | A/B 4 pairs: head 0.1277/0.1301/0.1402/0.1316 vs cand 0.1240/0.1511/0.1413/0.1534 | reverted | 1 of 4 favour; open case slower (0.33-0.38 vs 0.25-0.28 ms encode); bytes 0.184 -> 0.179 not enough |
| 11 | 22:36 | attempt 7 (writers sized to the snapshot) again, fixed harness | A/B 4 pairs: head 0.1245/0.1287/0.1303/0.1688 vs cand 0.1821/0.1275/0.1730/0.1253 | reverted | 2 of 4 favour; the fifth iteration in a row without a kept step: stop |
| 12 | 23:00 | guardrail fix, not a climb step: v4 becomes a JSON object (`{"version":4,"head":…,"catalog":…,"server":[one digit string per row],"pending":[…],"usuals":[…],"strings":"…"}`) | 0.1563, 0.1637, 0.1852 (median 0.1637) | kept | CI's e2e failed on PR #270: offline-start.spec and suggestions.spec `JSON.parse` the stored snapshot and count `server`, `pending`, `usuals` (offline-start belongs to running job 122, not editable). Same score within noise; bytes 0.184 -> 0.191 |
| 13 | 23:50 | guardrail fix after review 0: varints with `%`, `~/` and `*` in place of `&`, `|`, `<<`, `>>`; `_maxHalves` as a literal | 0.2244, 0.2356, 0.1721 (load 17-20); A/B vs b8ec254a 4 pairs: ratios 1.28, 0.80, 1.45, 0.80 | kept | on the JS web build (Firefox, Safari, every iOS browser) the bit operators cut numbers to 32 bits: every UTC time decoded as about 26 minutes after 1970. `flutter test --platform chrome test/list/snapshot_codec_test.dart` failed 3 of 5 on b8ec254a and passes now; it runs in `scripts/gates/flutter.sh`. No VM cost measurable |
| 14 | 00:43 | guardrail fix after review 1: `test/list/snapshot_fields_test.dart` pins the fields each record holds (toJson keys of full records, and the keys every `fromJson` reads); UTC times and deltas of 2^51 µs or more go as ISO text | 0.1841, 0.2143, 0.1686 (load 9-12) | kept | a model field the codec did not know would have been dropped on the device with every test green; a throwaway `note` in `Item.toJson` and an `urgent` flag read by `AddItem` each fail the new test (then reverted). Times 1850/2200/1922 failed on the JS build at 05bc7147 and pass now |

## Result

Weekly usage (`usage-gate --json`, `weekly_util`): 0.60 at the start
(21:13), 0.61 at 21:41, 0.62 at 22:06, 0.63 at 22:41 and 23:02; the stop rule
at 95 % never came close. After the Friday reset: 0.01 (review 1 round).

Stopped by the rule "5 consecutive iterations without a kept improvement"
(attempts 7-11), at 22:36, 1 h 23 min after the start. Two guardrail fixes
came after, neither a climb step:

- Row 12: CI's e2e gate showed that steps 1-6 broke two e2e specs that read
  the stored value as JSON. I had run `flutter test`, analyze and lint at
  each step but not the e2e gate (it needs a local stack; CI runs it). The
  JSON envelope keeps the specs' contract (`server`, `pending`, `usuals`
  arrays with one element per row) at the same score.
- Row 13 (review 0): the varint code used bit operators, which the JS web
  build cuts to 32 bits, so every UTC time came back wrong in Firefox,
  Safari and every iOS browser. Steps 1-6 had been checked on the Dart VM
  only. The codec tests now also run on the web compiler in the flutter
  gate, and `web.sh` times the real web path (below).

- Row 14 (review 1): the codec writes every field by hand, apart from
  `toJson`/`fromJson`, so `snapshot_fields_test.dart` now fails, naming
  `snapshot_codec.dart`, when the model persists a field the codec does not
  know. Times 2^51 µs or more from 1970 (or from the time before) are
  written as ISO text, since their number would not stay exact on JS.

Final HEAD (attempts 1, 2, 3, 6 and rows 12-14), second baseline. Row 14's
runs: 0.1841, 0.2143, 0.1686 at load 9-12 (bytes and parts as below).

| | baseline (median of 3) | final (3 runs at load 17-20) |
| --- | --- | --- |
| score | 1.0136 (band 0.0475) | 0.2244 (0.1721-0.2356) |
| encode ratio | 1.0 | 0.19 |
| decode ratio | 1.0 | 0.19 |
| bytes ratio | 1.0 | 0.191 (exact) |
| full encode / decode ms | 28.41 / 44.08 | 4.3-5.0 / 4.5-5.5 |
| open encode / decode ms | 1.536 / 1.746 | 0.35-0.64 / 0.33-0.48 |
| full / open bytes | 2,333,023 / 151,962 | 432,288 / 29,961 |
| round trip | true | true |

The same code (row 12, before the fix) scored 0.156-0.185 at load 5-6; the
A/B pairs against it put the fix within noise. The host load explains the
higher final runs.

### Web (release build, `tool/hillclimb/hc-cache-codec/web.sh`)

`web.sh` builds `app/test/hillclimb/web_codec_probe.dart` with
`flutter build web --release --wasm`, as `scripts/vercel.sh` builds the app,
and runs it in Playwright's Chromium (loads `main.dart.wasm`), Firefox and
WebKit (load `main.dart.js`). It saves and loads the two bench snapshots
through `SharedPreferencesAsync` (localStorage, which JSON-encodes each value
once more), as main stored them (`jsonEncode(toJson())`, `fromJson(jsonDecode())`)
and as v4. p50 of 30 after 10 warm-up rounds, one run at 23:40 under the lock:

| engine | snapshot | main save / load ms | v4 save / load ms | round trip (both) |
| --- | --- | --- | --- | --- |
| Chromium (wasm) | 5,000 | 124.7 / 115.7 | 13.5 / 9.4 | true |
| Chromium (wasm) | 300 | 6.12 / 4.65 | 0.92 / 0.57 | true |
| Firefox (js) | 5,000 | 141.2 / 52.5 | 18.5 / 6.9 | true |
| Firefox (js) | 300 | 6.58 / 2.74 | 1.46 / 0.62 | true |
| WebKit (js) | 5,000 | 79.7 / 43.7 | 15.4 / 3.9 | true |
| WebKit (js) | 300 | 4.08 / 2.48 | 1.36 / 0.44 | true |

So v4 is also faster on the JS build: save 3-8x, load 4-11x. main's JSON
parse runs on the browser's native `JSON.parse`, but it then builds every
map and parses every ISO time in Dart; v4's per-character loop over a string
a fifth the size wins anyway.

### Kept steps as patches

The branch lands as one squashed commit (`scripts/push-pr.sh`), so each kept
step's diff (app/ and tool/) is in `docs/hillclimb/hc-cache-codec-steps/`,
named after its pre-squash commit, plus the rejected near-misses 4, 5 and 8.

### What limits it now

Profiled before rows 12-13, 5,000 items, Dart VM JIT: decode spends about
40 % in `DateTime` construction (about 130 ns each: the VM's `_validate`
computes the calendar parts), the rest in reading digits and building
`Item`s, plus one `jsonDecode` of the joined string table; encode spends
about 40 % in looking strings up in the dedupe map. The id strings are about
42 % of the bytes.

Next ideas, not tried: share `DateTime`s for items whose created and updated
times are equal (real rows that were never edited; the generator never makes
them, so the bench cannot show it); a per-field last-string cache in the
writer (the bench's shared string instances would flatter it).
