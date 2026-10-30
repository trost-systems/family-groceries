# Job 29d: More: Zugänge and Konto on separate pages

PR: https://github.com/trost-systems/family-groceries/pull/106

Peter, 2026-10-29: "In 'More' access and account lead to the same page. Split them up."

## What changed for users

- **Zugänge is its own page** (`/more/access`): MCP-Server, Zugriffstoken, Verbundene Apps. Nothing about the account is on it anymore.
- **Konto is its own page** (`/more/account`, titled "Konto"): the signed-in email address, "Meine Daten exportieren" and "Konto löschen". It used to open the Zugänge page scrolled down to its Konto section.
- **Back goes to More.** Both pages are routes below `/more`, so the app bar's back arrow and the system back return to the More list, also after opening a link straight to a page. From 840 px wide, More shows the list and the picked page side by side; the pane switches between Zugänge and Konto and has no back arrow.
- **Old links keep working.** `/settings` redirects to `/more/access`, `/settings?section=account` to `/more/account`. An invite on an old link still opens the join page; signed out, the login.

## Where

- `app/lib/settings/access_screen.dart` (was `settings_screen.dart`, renamed with history): `AccessScreen`, without the account section and its scroll-to code.
- `app/lib/settings/account_screen.dart` (new): `AccountScreen`, email row (`account-email`), export, delete.
- `app/lib/settings/account_repository.dart`: `AccountRepository.email`.
- `app/lib/app/router.dart`: `accessPath`, `accountPath`, `legacySettingsRedirect`, `moreTabRoutes()` (the More branch, shared with the widget-test harness).
- `app/lib/more/more_screen.dart`: the entries go to the new paths, the page title is "Konto" for the account page, no `PopScope` workaround, no back arrow in the two-pane layout.
- Keys unchanged: `more-access`, `menu-account`, `account-export`, `account-delete`. New: `access-screen`, `account-screen`, `account-email`.
- Tests: `app/test/more/more_screen_test.dart` (each page alone with its route and back to More, system back, the links `/more/access`, `/more/account`, `/settings`, `/settings?section=account`, `/settings?section=other` with back, the wide panes), `app/test/app/router_test.dart` (auth cases for the new paths, `legacySettingsRedirect`), `app/test/settings/account_test.dart` (the account page, a sign-in without email), `access_screen_test.dart` (renamed).
- e2e `e2e/tests/shell-more.spec.ts`: both pages with their URLs, contents and back; old links redirect, back from a deep link; English walk through both pages; wide panes switch. `helpers.ts` `openMore` expects `/more…` only.
- Recipes: `features/shell-more.md` (`sm-access`, `sm-account`, new `sm-old-links`, the `fg back` gotcha is gone for these pages), `features/account.md`, `features/mcp-access.md`, `features/README.md`, `SKILL.md`. `docs/ACCOUNT_DELETION.md`.
- Decisions: `docs/DECISIONS.md`, "Job 29d".

## How to verify

```bash
(cd app && flutter analyze && flutter test test/more test/settings test/app/router_test.dart)
scripts/ci-e2e.sh --spec tests/shell-more.spec.ts --no-db
```

## Results

- Local (Mac): `flutter analyze` clean, flutter gate 535 tests passed; gitleaks and web-prod gates passed; lint: ast-grep rule tests and scan pass (shellcheck 0.11 on macOS reports the known SC2218 noise in scripts it doesn't touch; CI's lint is green). A mutation (old account link to Zugänge) fails the widget tests.
- CI on the PR head 997c233 (run 41019021504): every job green including db and both e2e shards (53 + 53 passed), ci-ok green. The first run's only other failure, `classifier.spec.ts:59` (seed spot check), is the known flake that also hit #100 and #101 on main; untouched here, green on the rerun.
- Not driven with fg on the Linux desktop client: this job runs on the Mac (no local Supabase). Widget tests cover the system back that `fg back` sends.

## Screenshots

`docs/screenshots/29d-more-access-account/`: before (Konto opened the Zugänge page, phone and wide), after (Zugänge, Konto on a phone, Konto in the wide pane).

## Left out / for others

- `accountDeleteExportHint` still says "in den Einstellungen" (ARB, 29b's/29e's files): it is now on the same Konto page. Left for 29e, which builds the settings page.
- The Siri docs and the voice function's 401 text still say "Menü, Zugänge" (from before job 17's More tab); vmaint-20261030 already reported it.
