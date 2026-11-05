# Job 134: no hint text inside the store name pill

PR: https://github.com/trost-systems/family-groceries/pull/275 (ci-ok pending at writing; the lead merges).

## What was built
- `app/lib/list/store_details_screen.dart`: the `store-rename` HexPill on a store's details holds only the store badge, vertically centered, and the trailing pencil. „Tippen zum Umbenennen“ / "Tap to rename" is gone. The semantics label „<Store> umbenennen“ and the tap target stay.
- `storeRenameHint` is deleted from `app/l10n/app_de.arb` and `app_en.arb`, and l10n is regenerated.
- The test `app/test/list/store_details_screen_test.dart` adds "its name pill holds the badge centered, no hint inside". It fails on main (badge center 86 px vs face center 96 px) and passes here.
- The goldens `store-details-{light,dark}.png` are updated. Before and after are in `docs/screenshots/134/`.
- `docs/DECISIONS.md`, "Job 134", records the rule that hint copy never goes inside a HexPill or hex badge. `~/groceries-ops/COMMON.md` already had the note ("UI: hints outside controls"), so nothing was added there.
- The feature files are updated: verify-family-groceries `stores.md`, verify-hummlist `stores-walk-order.md`, and the stores section of FEATURES-FOR-WRITERS.

## How to verify
`cd app && flutter test test/list/store_details_screen_test.dart test/design/screens_golden_test.dart`, then look at `docs/screenshots/134/store-details-light-{before,after}.png`.

## Results
`flutter analyze` is clean. The full `flutter test` run failed only the two store-details goldens before they were updated. After the update, the touched files pass 58 of 58. `scripts/lint.sh` is ok and gitleaks found no leaks.

## Missing or blocked
Peter's original screenshot (`sources/store-rename-hint-before.png`) is not on hz, because research and sources sync only from the box to hz. The PR uses the golden from main as the before image.
