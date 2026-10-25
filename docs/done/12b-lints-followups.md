# Job 12b: lint and schema-guard follow-ups (2026-10-25)

Branch `job/12b-lints-followups`, PR #37. Job 12 ran out of fix rounds with
review 2 at FIX. This job closes every item from that review. Each rule
change carries rule tests. Review 2's probes, rerun against the committed
rules, are in [`probes.txt`](../screenshots/12b-lints-followups/probes.txt).
[`probes.sh`](../screenshots/12b-lints-followups/probes.sh) produced them:
it writes the probes into a throwaway worktree, scans them, and removes them.

## What changed

1. **`no-hardcoded-ui-text` follows same-file declarations**
   (`ast-grep/rules/no-hardcoded-ui-text.yml`). If a name reaches a text
   position, the rule reports the literals behind it: a constant, a final,
   a local, a field or a `static const`, including list and map constants
   (`Text(_labels[0])`, `Text(_m['a']!)`). It also reports an assigned
   value, a parameter's default value, an enum constant's arguments, and a
   getter's, function's or method's result. Collection `if` and `for`
   elements are walked. `toString` overrides are skipped. What stays out of
   reach is stated in the rule header and DECISIONS 12.3: values passed
   through another call's argument, `const _b = _a`, and imported
   constants.
2. **`schema_check.ts` reads names with one parser** (`qualifiedName`). It
   splits on the dot and unquotes each part. `statements()` keeps the case
   inside double quotes, so `"public"."items2"` is `public.items2`, and
   `public."Mixed"` keeps its case in the hint. The scanner also handles:
   - `E'...'` escapes and nested block comments, which used to swallow the
     DDL after them;
   - test SQL read without its comments;
   - `alter policy`, `rename column household_id`, and `set schema`.
3. **The partner-news flake was a VM freeze, not the test.** Review 2's
   trace shows Lea's click inside `typeInto` stalled from 01:43:35 to
   01:50:17. mem-guard has no sample from 01:42:58 to 01:50:18, so the box
   was frozen for those 7 minutes. `toPass`'s 20 s deadline ran out inside
   the freeze, and Lea's realtime socket dropped, which is why the page
   shows the offline banner. Under the board's 06:34 ruling the run is
   void. A real flake showed up in my first full run, though:
   `auth.spec.ts:4` sent the old password after a failed sign-in, with no
   freeze. Root cause: Flutter web attaches its editor to a focused field
   only with the next frame. Text typed before that frame is lost, while
   the DOM briefly shows it, so `typeInto`'s check passed. `typeInto` now
   waits for that frame and checks the value after the next one
   (DECISIONS 12b.6). A probe holding frames back 1.5 s shows the old
   helper losing the text and the new one keeping it
   ([`typeinto-frame-probe.txt`](../screenshots/12b-lints-followups/typeinto-frame-probe.txt)).
4. **Port clash: the kernel reserves the block.** Every port block
   (543xx-561xx) lies inside Linux's 32768-60999 source-port range. Before
   the fix, 9 of 3000 loopback connections drew a port in 55500-55599.
   After `ip_local_reserved_ports`, none did, and explicit binds still
   work. `reserve_port_block` in `scripts/lib.sh` reserves the checkout's
   `<prefix>00-99` before `supabase start` and `db reset`, locally and in
   CI. I posted the box-wide reservation (54300-56199 in `box-recover`) on
   the BOARD for the lead. No other job's block was renumbered.
5. **`dispose-after-dialog`** also catches:
   - `.then(...)` and `.whenComplete(...)` callbacks, the tear-off
     `.whenComplete(c.dispose)` included;
   - pickers, `showMenu`, `showSearch`, `showAboutDialog`,
     `showLicensePage` and `showCupertinoSheet`;
   - `push*` on Navigator, GoRouter, `context` or `router`.
6. **`auth-navigation-only-in-router`** reports the auth routes' names: any
   `/login` or `/welcome` path literal, `loginPath` and `welcomePath`, and
   `'login'` or `'welcome'` in `goNamed`, `pushNamed` or `namedLocation`.
   A `const` path and `Uri(path: ...)` are caught too. A path built at run
   time is the stated limit.
7. **`lint.sh` runs the schema check before its unit tests**, so a bad
   migration's message comes first.
8. **A table finding names the migration that last changed the table**, so
   a rename is reported against the rename.

Decisions: DECISIONS 12.3, 12.4 and 12.7 (updated), 12b.1 to 12b.5.

## Verification

- Every probe from review 2 fails with a fix hint, and so do the extra
  shapes from my own adversarial review (`probes.txt`). `scripts/lint.sh`
  is clean on the repository. The rule tests pass, and `schema_check` has
  23 Deno tests.
- `scripts/verify.sh --skip-e2e`: all gates passed (gitleaks, lint, db,
  functions, fg-cli, flutter with 245 tests, web-prod, fastlane).
- Playwright under `/tmp/fg-e2e.lock`, `--workers=1`, port block 555xx:
  partner-news alone ×5 passed. Full run 1 (10:36) failed
  `auth.spec.ts:4` with no freeze, which led to the `typeInto` fix. With
  the fix (69ca4b2), five consecutive full runs passed 66/66 (12:21 to
  13:08), and mem-guard sampled throughout with no gap over 70 s
  ([`e2e-runs.txt`](../screenshots/12b-lints-followups/e2e-runs.txt)). No
  run was voided.
- `scripts/verify.sh --skip-e2e` passed again on the final code.

## Missing or blocked

- The box-wide port reservation is the lead's call (BOARD, 09:27). Until
  then, only stacks started through `scripts/lib.sh` are protected. The
  verify skill's `fg` stacks are not.
