# family-groceries

Shared shopping list for one household (Peter and Lea). Flutter app (iOS,
Android, web) on Supabase (Postgres + RLS, Auth, Realtime, Edge Functions).
The product spec is [`docs/SPEC.md`](docs/SPEC.md); decisions and their
reasons are in [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Layout

- `app/`: the Flutter app. `lib/list/` is the list feature (model, cubit,
  repository, screen), `lib/session/` auth and household state,
  `lib/household/` onboarding and invites, `lib/app/` router, environment
  and app shell. UI strings live in `app/l10n/app_de.arb` (German template).
- `supabase/`: `config.toml` for the local stack, `migrations/`, pgTAP tests
  in `tests/`, Deno edge functions in `functions/` (`_shared/` for helpers).
- `e2e/`: Playwright tests that drive the Flutter web build against the local
  stack.
- `app/fastlane/`, `.github/workflows/release.yml`: TestFlight and Play
  internal releases, manual, signing from secrets (`docs/RELEASE.md`).
- `vercel.json`, `scripts/vercel.sh`: Vercel builds and hosts the web app on
  every push (`scripts/vercel-local.sh` runs the same build in Vercel's base
  image). `supabase-deploy.yml` deploys migrations (`supabase/deploy/`,
  Management API) and edge functions (`--use-api`) from main.
- `supabase/functions/voice/`: the Siri and in-app dictation endpoint; the
  German sentence splitter is `parse.ts`, its table of sentences
  `parse_test.ts` (`docs/SIRI_SHORTCUT.md` for the Shortcut).
- `scripts/`: `bootstrap.sh` (toolchain), `dev.sh` (local stack + web dev
  server), `verify.sh` (every CI gate, locally), `lint.sh` (the lint rules
  below), `merge-pr.sh` (land a PR as one commit with the required author
  and trailers).

## Conventions

- Prove behavior with the verify-family-groceries skill
  (`.cursor/skills/verify-family-groceries/`, also `.claude/skills/`): it
  drives the real app through `scripts/fg` (start with `scripts/fg help`)
  and keeps one recipe per feature in `features/`. A PR that changes a
  feature updates its `features/<feature>.md`.
- Run `scripts/verify.sh` before pushing. It runs what CI runs: gitleaks,
  pgTAP and `db lint`, Deno fmt/lint/test, Flutter l10n/format/analyze/test,
  the web build and Playwright.
- Public repo: never commit secrets. Only the project URL and the publishable
  key may appear in code. gitleaks runs as a pre-commit hook
  (`.githooks/pre-commit`) and as a required CI job.
- Lints follow emotely: `flutter_agent_lints` (experimental set), every rule
  an error. Fix the code, not the rule; `dart fix --apply` handles most
  primary-constructor and style findings.
- Build-time defines are read only in `app/lib/app/environment.dart`.
- Auth gating happens only in `authRedirect` (`app/lib/app/router.dart`).
- Every household-owned table carries `household_id` and the RLS policy
  `is_household_member(household_id)`. A new table gets the same policy and a
  cross-household case in `supabase/tests/rls.test.sql`.
- Item writes from the app are idempotent ops (`ItemOp` in
  `app/lib/list/model.dart`) applied optimistically and retried until the
  server acknowledges them; the screen shows server rows with pending ops
  folded on top. Add new mutations as new `ItemOp` variants.
- Categorization runs server-side in `public.classify_item(household, name)`
  (called by the items insert trigger). The app, MCP and Siri all go through
  it; change the function, not the callers.
- Flutter web e2e: semantics are enabled on web, so Playwright finds widgets
  by role and label. Type with `typeInto` (`e2e/tests/helpers.ts`); synthetic
  key events drop umlauts.
- `main` takes one commit per PR with `ci-ok` green. Merge with
  `scripts/merge-pr.sh <n>` (run it, wait for `ci-ok`, run it again): it
  squashes the PR into one commit authored with the required noreply email
  and rebase-merges that commit. GitHub's own squash merge authors the
  commit with the account's default email and rejects the noreply address.

## Lint rules

`scripts/lint.sh` runs these locally and in CI, and each error names the fix.
Rules live in `ast-grep/rules/` with tests in `ast-grep/tests/`, the schema
guards in `supabase/checks/schema_check.ts`. Silence one finding only on the
line above it, with the reason: `// ast-grep-ignore: <rule-id> -- <reason>` or
`-- squawk-ignore <rule> -- <reason>`.

| Rule | What fails | Why |
| --- | --- | --- |
| `no-from-environment` | `String/bool/int.fromEnvironment` outside `app/lib/app/environment.dart` | One inventory of build-time defines |
| `dispose-after-dialog` | A local controller or FocusNode disposed after `await showDialog`/`showModalBottomSheet` | The route still animates out with it; the join dialog crashed (fixed in 1177b52) |
| `shared-preferences-only-in-device-cache`, `device-cache-own-file` | A shared-preferences store outside `DeviceCache`, or one without its own Linux file | A second store on supabase's file signed Linux users out (c4ed2e4) |
| `auth-navigation-only-in-router` | Navigation to `/login` or `/welcome` outside `router.dart` | Auth gating happens only in `authRedirect` |
| `no-hardcoded-ui-text` | A string literal with letters in `Text(...)` or a `label`/`tooltip`/`hintText`-style argument in `app/lib` | UI text lives in `app/l10n/app_de.arb` |
| schema check: history | Editing or deleting a migration on `main`; a new one sorting before main's newest | Production already ran it; deploys refuse older migrations |
| schema check: RLS | A public table without RLS; a `household_id` table without an `is_household_member(household_id)` policy or a two-household pgTAP case | PostgREST serves every public table |
| squawk compat rules | Dropping or renaming a column or table, NOT NULL without default, type changes, dropping a function or view | TestFlight and Play builds lag `main`; old apps must keep working |
| `ignore-needs-reason`, schema check: ignores | An `ast-grep-ignore` or `squawk-ignore` without ` -- <reason>` | An exception a reviewer cannot judge gets copied |
