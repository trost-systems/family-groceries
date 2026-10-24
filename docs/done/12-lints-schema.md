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
    (BOARD 07:20, f454567).
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
git show f454567^:app/lib/household/invite_dialog.dart > app/lib/household/invite_dialog.dart
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
