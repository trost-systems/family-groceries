# Job 111: dictation brand split, truncated voice lists, offline parse, test hygiene (2026-11-05)

PR: https://github.com/trost-systems/family-groceries/pull/247 (ready for review, not merged; the lead
merges).
`family-groceries-111`. Decisions: `docs/DECISIONS.md`, "Job 111".

## Fixed

1. **Dictated items get brand and details.** `mode: parse` with `split: true` runs each heard
   item through `public.parse_item` (`supabase/functions/voice/items.ts` `splitItems`), the parser
   `add_item` and the typed add use, and answers brand, details and store. The app sends
   `split: true` and adds what comes back with every field (`SupabaseListRepository.splitSpoken`,
   `ListCubit.addSpoken` via `addParsed`). Without `split` the answer stays as before, so installed
   apps (which read only name and quantity) keep the whole line. The dictation summary names an
   item as Siri reads it back ("Windeln Pampers Größe 3").
2. **More than 30 dictated items.** The app reads `truncated` and ends the summary with Siri's
   sentence for it (new string `dictationTooMany`, NEEDS_COPY_REVIEW below).
3. **Offline adds get the server parse.** The add sheet's device-made row is `deviceParsed`; the
   queued `AddItem` keeps the flag (op JSON `device_parsed`, survives restarts) and the
   repository runs `parse_item` before `put_item`, so "Windeln Pampers Größe 3" typed offline
   syncs as Windeln / Pampers / Größe 3 (and gets parse_item's store and category). The device's
   quantity (with #236's number words, reused, not duplicated) and the user's chips win. A rename
   of such an add before it syncs is parsed too (`EditItem.deviceParsed`).
4. **Hygiene.** `e2e/tests/live-sync.spec.ts` expects "Bananen 6( Neu)?"; the android gate runs
   `:app:testDebugUnitTest` (WidgetPayloadTest) after the debug build, and a change to the
   android/ios gate script runs those gates; `docs/done/63-home-widgets.md` and
   `docs/done/71-siri-german.md` say their PRs (#185, #194) merged on 2026-11-02.

## Tests (each failing before its fix)

- deno: `voice/handler_test.ts` (split answer, no split for old apps, split failure 500),
  `voice/split_integration_test.ts` (db gate: split equals what `add_item` stores, store dm).
- Flutter: `list_repository_test.dart` (split read, `split: true` sent, old answer still adds,
  truncated, offline add and offline rename go through parse_item), `dictation_test.dart`
  (brand split, 30-item message), `add_sheet_test.dart` (offline add synced split),
  `list_cubit_test.dart` (offline rename before sync), `model_test.dart` (flags round-trip).
- e2e: `voice.spec.ts` (mode parse with split over HTTP), `offline-start.spec.ts` (offline
  "Windeln Pampers Größe 3" reaches the server as Windeln / Pampers / Größe 3).
- Android: WidgetPayloadTest 6/6 in the gate; a broken assertion turns the gate red (checked,
  reverted).

## Results

Review round 1 / lead ADDENDUM 1 (2026-11-05), on main 1ba6dc51, all local, hz:

- „Ohne Laden“ picked offline: the parsed store is no longer taken (`ParsedEntry.onto(noStore:)`,
  repository and fake; `list_repository_test.dart`, `model_test.dart`; removing the guard turns 2
  tests red).
- A failing `splitItems` no longer fails dictation: it is logged and reported, and mode parse
  answers 200 with the items as heard (`handler_test.ts`).
- The `keyBefore` test asserts a real key: the add's answer was lost, realtime brought the keyed
  row, the add is still queued; the rename carries `keyBefore: 'windel pampers grosse 3'` and
  `deviceParsed`.
- English `dictationTooMany` checked: identical to Siri's English `tooMany` (`voice/copy.ts`).
- e2e `offline-start.spec.ts` now also renames an offline "Shampoo Nivea Größe 4" to "… Größe 5"
  before the sync: it reaches the server as Shampoo / Nivea / Größe 5.
- `flutter test` 1833 passed, analyze clean; deno voice 349 passed; lint, functions, changelog
  gates passed; db gate pgTAP 1785 + 35 integration passed; e2e offline-start, voice, live-sync
  25 passed.


Review round 0 (2026-11-05): rebased onto main 29d505fb (#236, #243 and #220 landed). All local, hz:

- `flutter test`: 1833 passed, 90 skipped; `flutter analyze`: no issues (on 29d505fb).
- On 0bf5d45b: `deno test` (supabase/functions): 601 passed, 0 failed, 35 ignored (db-only).
- `scripts/verify.sh --only lint,functions,changelog`: passed (on 29d505fb).
- `scripts/verify.sh --only db` (on 29d505fb): pgTAP 37 files, 1785 tests PASS; integration 35 passed
  (with `voice/split_integration_test.ts`, now through #236's `parse_item`).
- `scripts/verify.sh --only e2e -- tests/offline-start.spec.ts tests/voice.spec.ts
  tests/live-sync.spec.ts`: 25 passed (on 0bf5d45b, 7ef53947 and 29d505fb). The offline case now types "zwei Windeln Pampers Größe 3":
  the device reads 2 with #236's number words, the server splits Pampers / Größe 3 at the sync.
- `scripts/gates/android.sh` (first round): WidgetPayloadTest 6 tests, 0 failures; CI android job
  log shows `:app:testDebugUnitTest`.
- Live repro against the local voice function, before: `{"name":"Windeln Pampers Größe 3",
  "quantity":null}`; after (split): `{"name":"Windeln","brand":"Pampers","properties":"Größe 3",
  ...}`.

Rebase with #236: `EditItem` carries both `keyBefore` and `deviceParsed` (JSON round trip
tested); `ListCubit.edit` keeps #236's rename merge and marks a rename of a still-queued offline
add `deviceParsed`. A queued offline add renamed onto an open item with the same split name is
refused by #236's `items_rename_duplicate` at the sync: the app shows „… steht schon auf der
Liste“ (`RenameTaken`), the item stays with its first name, no duplicate (`list_cubit_test.dart`).
Also: an item whose parse comes back without a name keeps the heard or typed name instead of being
dropped (`splitItems`, `ParsedEntry.onto`/`ontoRename`).

Screenshots (web build, offline-start.spec.ts): `docs/screenshots/111/offline-01-cold-start-from-cache.png`
(queued offline, whole line as the name), `docs/screenshots/111/offline-02-synced-split.png`
(after the sync: 2× Windeln, Pampers · Größe 3, under Drogerie).

## NEEDS_COPY_REVIEW

| key | de | en |
| --- | --- | --- |
| `dictationTooMany` | Mehr als dreißig auf einmal gehen nicht; sag den Rest bitte noch einmal. | More than thirty at once doesn't work; please say the rest again. |

The words are Siri's existing answer for the same case (`supabase/functions/voice/copy.ts`
`tooMany`, de and en identical), now also shown in the app.

Also for copy review: the dictation summary names an added item as `[quantity] name [brand]
[details]` (before: `[quantity] name`), e.g. „Hinzugefügt: 2 Gurken, Windeln Pampers Größe 3.“;
the three changelog lines in the PR. Peter approved all of these on 2026-11-05 (Q80 = DT1).

## Not done / open

- The microphone itself needs a phone (no device on hz): the dictation UI is proven by widget
  tests, the server split over HTTP and in the db gate.
- `splitItems` makes one `parse_item` query per item (at most 30 per sentence); one query over
  `unnest(...)` would do. Not needed at dictation sizes.
