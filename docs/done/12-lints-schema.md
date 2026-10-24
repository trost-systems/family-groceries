# Job 12: structural lints and migration/RLS guards (2026-10-24)

Branch `job/12-lints-schema`, PR #22. Agents in this repo made the same
mistakes more than once. The mistakes compiled and passed review. Each one
is now a check that fails with an error naming the fix, and
`scripts/lint.sh` runs them all, locally and in CI.

## What was built

- **ast-grep rules** (`ast-grep/rules/`, tests and snapshots in
  `ast-grep/tests/`, runner `scripts/ast-grep.sh`, config `sgconfig.yml`):
  - `dispose-after-dialog`: a local controller or FocusNode disposed in a
    function that awaits a dialog or sheet. This was the join dialog crash
    (BOARD 07:20, fixed in 1177b52; bad code at 26e9d06).
  - `shared-preferences-only-in-device-cache` and `device-cache-own-file`:
    one store owner, with its own Linux file. This was the Linux relaunch
    sign-out (BOARD 09:08, c4ed2e4).
  - `no-from-environment`, `auth-navigation-only-in-router`,
    `no-hardcoded-ui-text`: the CLAUDE.md conventions.
  - `ignore-needs-reason`: an `ast-grep-ignore` carries ` -- <reason>`.
- **Schema check** (`supabase/checks/schema_check.ts`, 15 Deno tests):
  - Migrations on main are never edited or deleted.
  - New migrations sort after main's newest, with valid names and unique
    versions.
  - Every public table enables RLS.
  - A `household_id` table has an `is_household_member(household_id)`
    policy and a pgTAP test that sets up two households.
  - squawk runs on new migrations with the backward-compatibility rules
    only.
  - A `squawk-ignore` carries a reason.
- **pgTAP**: `supabase/tests/item_events.test.sql`, 13 cases. Every trigger
  action is recorded with its name, category, actor, item and household.
  Clients cannot insert, update or delete, and signed-out clients cannot
  read.
- **Wiring**:
  - A `lint` job in `ci.yml`, part of `ci-ok`, and a step in `verify.sh`.
  - ast-grep 0.51.0 and squawk 2.70.0 are pinned in `ci.yml` env and
    installed by `bootstrap.sh`. `lint.sh` refuses other versions.
- **Docs**:
  - The rule table in `AGENTS.md` (`CLAUDE.md`), one row per rule with what
    fails and why.
  - `docs/DECISIONS.md` section Job 12.
  - `docs/REUSED_FROM_EMOTELY.md` section job 12.

Main had no violations, so no code was changed and no ignores were added.

## How to verify

```
scripts/bootstrap.sh          # installs the pinned ast-grep and squawk
scripts/lint.sh               # passes on main
```

To see a rule fail on historical code:

```
git show 26e9d06:app/lib/household/invite_dialog.dart > app/lib/household/invite_dialog.dart
git show c4ed2e4^:app/lib/main.dart > app/lib/main.dart
scripts/ast-grep.sh; git checkout -- app/lib
```

The PR body shows the output of these commands, the probes, and four
schema-check probes. The schema-check probes are a household table without
RLS or a policy, an edit to `foundation.sql`, `alter table items drop
column quantity`, and a migration older than main's newest.

## Test results

- ast-grep rule tests: 7 of 7 pass. The scan of every tracked file is clean.
- `supabase/checks`: 15 of 15 Deno tests pass.
- pgTAP: 526 tests pass. Two mutations were caught: dropping the history
  trigger failed tests 1 and 2, and granting UPDATE/DELETE failed tests 9
  and 10.
- `scripts/verify.sh` on the branch passed every gate: lint, pgTAP, Deno,
  Flutter (242 tests), the web build and Playwright (66 of 66).

## Open

- Job 11 (#20) moves CI to gate scripts. Whichever PR lands second moves
  the lint step into `scripts/gates/lint.sh` and drops the separate `lint`
  job (BOARD 20:25).

## Review 0 fixes (PR #25)

- **Must fix.** `no-hardcoded-ui-text` now reaches the text position through
  the expressions that pass a value on unchanged: a ternary's branches, `??`,
  `+`, parentheses and switch-expression arms. The reviewer's probes
  `Text(done ? 'Erledigt' : 'Offen')` and `Text(a + 'abc')` now fail
  (3 findings). New test cases cover those five shapes and a same-file
  constant in a ternary. Valid cases cover a literal used as a condition or
  a switch pattern, which is not shown and stays unreported. Main still
  scans clean.
- **Schema check.** `create table ... (like public.items ...)` inherits the
  source's `household_id`. The copy now needs its own RLS, policy and test.
  There is a new Deno test, so the suite has 16 tests.
- **Documented limits.** `dispose-after-dialog` does not check order within
  the function, and it does not follow a dialog that a helper opens. Both
  limits are now in the rule comment and DECISIONS 12.4. DECISIONS 12.3 and
  12.7 cover the new shapes.
- **Job 11.** #20 is still open. It rebased onto f6f03f8 (BOARD 21:02) and
  folds the `lint` job into its gate, keeping `lint` in `ci-ok`'s needs
  (BOARD 20:42).

## Review 1 fixes (PR #26)

- **Must fix.** `no-hardcoded-ui-text` now follows a value up from the
  literal field by field, with a recursive `shown-as-text` util. A value
  passes through a receiver of a method call, property or index, list and
  set elements, map values, `!`, ternary branches, `??`, `+`, parentheses
  and switch arms. The reviewer's probes `Text('Hallo'.toUpperCase())`,
  `Text(['Eins','Zwei'][c])`, `Text(<String>['Eins'].join(', '))` and
  `Text(n ?? 'Lea'.toString())` all fail (5 findings). Index keys, map keys,
  conditions, switch patterns and other calls' arguments (`json['name']`,
  `DateFormat('dd.MM.')`) stay unreported, and valid test cases cover them.
  Two cases are stated as the limit of a syntactic rule, in the rule comment
  and DECISIONS 12.3. One is a value that comes back from another call (a
  closure, a helper). The other is a constant imported from another file.
  Main still scans clean, and the pre-fix dialog (`26e9d06`) still fails `dispose-after-dialog`.
- **Named arguments.** Added the date, time, about and search dialogs'
  texts (`confirmText`, `cancelText`, `helpText`, `fieldLabelText`,
  `fieldHintText`, `errorFormatText`, `errorInvalidText`, `barrierLabel`,
  `searchFieldLabel`, `applicationName`, `applicationLegalese`,
  `semanticsValue`), with a `showDatePicker(confirmText: ...)` test case.

## Fix round 2 (after the box loss, 2026-10-24)

- Re-verified #26 on the rebuilt box against review 1. `scripts/lint.sh`
  passes. The reviewer's probes `Text('Hallo'.toUpperCase())`,
  `Text(['Eins', 'Zwei'][c])`, `Text(<String>['Eins'].join(', '))`,
  `Text(n ?? 'Lea'.toString())`, a ternary and
  `showDatePicker(confirmText: 'Fertig')` all fail (8 findings).
  `Text(json['name']!)` and `DateFormat('dd.MM.')` stay unreported.
- Fixed a reference problem. The docs cited the join-dialog fix as
  `f454567`, which is a PR-branch commit that a fresh clone of main cannot
  show. The rule, its test, AGENTS.md and this summary now cite main's
  commits: the bad dialog at `26e9d06`, fixed in `1177b52`. The proof
  `git show 26e9d06:app/lib/household/invite_dialog.dart` with the scan
  still fails `dispose-after-dialog`.
- Five green full runs on the #26 head, all under `/tmp/fg-e2e.lock` with
  `--workers=1`:
  - `scripts/verify.sh` passed every gate (Flutter 245 tests, pgTAP PASS,
    Playwright 66/66);
  - four more Playwright runs passed 66/66 each.
