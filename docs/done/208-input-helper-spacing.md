# Job 208: more space between a field and its helper, error and counter

Peter (t823u): on "Neuer Haushalt" the error and the `0/80` counter sat tight against the hex name field.

## What changed

- **Spacing.** `app/lib/design/field_border.dart:133` defines `fieldSubtextGap = HlFocus.ringGap + HlFocus.ringWidth + HlSpace.s2` (13 dp). `fieldTheme` applies it at `app/lib/design/field_border.dart:172` as `supportingTextPadding` (top), with start and end equal to the shape's content padding.
- **Token step `HlSpace.s2`.** Material's gap was 4 dp, which ends inside the focus or error ring (2 dp gap + 3 dp ring = 5 dp outside the contour). The row now starts past the ring's outer edge, plus s2, the next step after s1. The brief named that step. The row sits in the same place idle and focused, so focus never moves text.
- **App-wide.** It lives in the field theme (`inputDecorationTheme` in `app/lib/app/theme.dart`) and in `RoundedFields`. Every field with a helper, error or counter gets it: New household, the name dialogs, store fields, access, feedback and the price editor. No screen got its own padding. The two fields that set their own `contentPadding` (the narrow edit-sheet fields, trip sheet rows) show no subtext. DECISIONS job 208 explains that a field doing both would need its own `supportingTextPadding`.

## Verification

- `app/test/design/fields_test.dart` checks that the error and counter sit at ring + s2 = 13 dp below the contour, for the hex field and the multi-line field. Without the change the test fails with "Actual: <4.0>".
- Real web release build with a local stack, on New household. These screenshots show the error and counter clear of the focus ring: `docs/screenshots/208/new-household-{error,idle}-de{,-dark}.png`.
- Goldens updated: `components-{light,dark}` (field cells 110 to 120 dp so the error fits) and `name-dialog-keyboard-{de,en}-{light,dark}`. No other golden changed.
- Full `flutter test` (app 2865 passed, widgetbook 340 passed), analyze, format and the lint gate pass locally. `ci-ok` was green on the merged head.
- Sonnet review: PASS, no must-fix.

## Landed

PR https://github.com/trost-systems/snacklist/pull/403, merged as fe620c94 (PR head 4a4f7fd1, same tree). No flag: it ships to everyone with the next green main build on TestFlight and Play internal. Nothing blocked.

## Review 0 (2026-11-13)

- **SHA corrected.** The record quoted the PR heads. On main, #403 is `fe620c94` and the done-summary PR #412 is `d3c01d09`.
- **Test.** `fields_test.dart` now covers `helperText` as well as the error. It also checks that the row's start lines up with the field's text and the counter's end with the text's end, and fails when the row shifts sideways.
- **Peter's screenshot** (`peter-t823u-new-household.png`) is not in the job dir. Its source is on the box and the Hetzner runner cannot reach it.
- **Not changed.** An empty submit on New household shows the validation message twice, under the field and above "Haushalt erstellen". This predates job 208. It is a copy and flow question for Peter, and the brief rules out flow changes.
