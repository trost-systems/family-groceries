# Job 37: stale "Menü" directions, health comment, debug-entrypoint Zone mismatch

## What changed

- **Debug-entrypoint Zone mismatch.** `app/test_driver/main_marionette.dart` initialized the Marionette binding in the root zone. `runApp` then ran inside the `runZonedGuarded` zone of `lib/main.dart`, so every debug launch logged "EXCEPTION CAUGHT BY FLUTTER FRAMEWORK … Zone mismatch." Now `lib/main.dart` has `bootstrap(WidgetsBinding Function() binding)`. `main()` is `bootstrap(WidgetsFlutterBinding.ensureInitialized)` and initializes at the same step as before, in the same zone, with the same error reporting. The debug entrypoint calls `bootstrap(MarionetteBinding.ensureInitialized)` and sets `BindingBase.debugZoneErrorsAreFatal = true`, so a regression stops the launch instead of logging quietly. The verify skill's `SKILL.md` names that symptom.
- **Voice 401.** No change. `supabase/functions/voice/handler.ts` already says "… unter Mehr, Zugänge einen neuen." (job 24). It is the only 401 text that tells a user where to create a token. The MCP and Alexa auth errors name no screen. The tab is "Mehr" (`tabMore`) and the page is "Zugänge" (`accessTitle`).
- **Docs.** `docs/MCP.md` and `docs/NEEDS_PETER.md` (two places) now say Mehr → Zugänge. `docs/SIRI_SHORTCUT.md` already said Mehr → Zugänge. It now says that "Siri widerrufen" is the trash icon next to the token (the label is a tooltip), and the lost-iPhone note names the whole path. `docs/done/*`, `docs/DECISIONS.md` history and job 20's screenshot README keep their wording because they are records.
- **Health comment.** `supabase/functions/health/index.ts` refers to `handler.ts` for status and body, so it does not copy the shape.
- **l10n.** `menu` ("Menü"/"Menu") was unused after the More tab (job 29d). It is removed from both ARB files, and the localizations are regenerated.

## How it was verified

- Before, on main's code: `fg up --clients peter` (linux, ports 566xx), then `fg logs --grep "EXCEPTION|Zone mismatch"` printed the EXCEPTION header and "Zone mismatch.".
- After: a fresh build, `fg login peter` (screen `list`), and `fg restart` all ran. Then `fg logs --grep "EXCEPTION|Zone mismatch|Uncaught"` printed `"lines": []`. Screenshot: `docs/screenshots/37-voice-error-copy/fg-logs-zone.png`.
- Guard: with the old `MarionetteBinding.ensureInitialized()` call put back in front of `bootstrap`, the app logged `Uncaught: Zone mismatch.` and showed no screen. `fg login peter` failed with `not_on_login`. The file was then restored and rebuilt.
- The Siri guide's steps on the real app: Mehr, Zugänge, "Token erstellen", name `Siri`, "Erstellen", "Fertig", the trash icon (tooltip "Siri widerrufen"), "Token widerrufen?", "Widerrufen". Each `fg` step returned ok. Screenshots: `zugaenge.png`, `token-row.png`, `revoke-dialog.png`.
- `fg fn call voice --method POST --bearer fgp_revoked_or_wrong` returned 401 with the speech "… unter Mehr, Zugänge einen neuen." `fg fn call health --as anon` returned 200 `{ok: true, service: "family-groceries", database: true}`.
- `scripts/verify.sh --only gitleaks,lint,functions,fg-cli,flutter` passed (the flutter gate after the commit: generated l10n current, analyze clean, 1011 tests). `deno test voice/ health/` passed: 217 tests.
- No unit test for `bootstrap`. It needs Supabase and the platform plugins, so a test would only fake them. The fatal-zone flag is the check, and it failed the launch when the old mistake was put back (above).

## Ops (not in the repo)

- `~/groceries-ops/jobs/37-voice-error-copy/merge-lock.patch` is a proposal for `bin/merge-lock`. Bash unsets the coproc's `ML` and `ML_PID` when it reaps an exited coproc. Under `set -u`, the cleanup's `${ML[1]}` then stops the wrapper. It prints "ML[1]: unbound variable" and exits 1 even when the merge succeeded, so the error is not harmless for a caller that checks the exit code. The patch copies the fds and pid right after `coproc`, with defaults. Stub test (fake `ssh` that prints LOCKED and exits after 1 s, wrapped command `sleep 2; exit 0`): the original exits 1 with the message, and the patched copy exits 0. The live script is not edited. The lead applies the patch.

## Missing or blocked

Nothing.
