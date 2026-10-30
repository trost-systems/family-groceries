# Job 34: the add field kept dropping the first key after Schließen

Branch `job/34-add-sheet-first-key`. Decisions: `docs/DECISIONS.md`, "Job 34".

## What was wrong

After the sheet closed with Schließen, a tap on "Was brauchst du?" and quick typing sometimes
gave "rot" for "Brot". On the web (semantics always on) a tap focuses the field's DOM `<input>`
at once, but the Flutter web engine connects that input to the app only with the next frame's
semantics update, and then writes the app's text over it. A key typed before that frame was
erased. A user who taps and types at once lost the first letter, in the wasm and the js build,
and in every other text field of the app too (the login page loses its first key the same way).

## What was built

- `app/lib/app/early_keys.dart`: `EarlyKeys`, started in `main.dart` next to
  `ensureSemantics()` (web only). From a text field's focus to the end of the next frame, it types
  printable keys that arrive as Flutter key events into that field, through the field's own
  editing path (formatters, `maxLength`, `onChanged`). The engine then writes them back instead
  of erasing them. After the frame it does nothing, so no key is typed twice. Shortcuts (Ctrl,
  Cmd) and control keys are skipped; AltGr (@, €) is typed.
- `e2e/tests/add-sheet.spec.ts`: "after Schließen, a key typed before the next frame still
  reaches the app" (wasm and js) holds the frames back between the tap and the "B", so the race
  happens every time. The original test is unchanged.
- `e2e/tests/auth.spec.ts`: the same on the login page's Passwort field (wasm and js).
  `holdFrames` is in `e2e/tests/helpers.ts`.
- `app/test/app/early_keys_test.dart`: 6 widget tests (gap, formatters, after the frame,
  refocus, shortcuts, AltGr).
- `features/quick-add.md` (verify skill): a note on the kept first key.

## How it was verified

| Run | Commit | Repeats | Original test | New tests |
|---|---|---|---|---|
| [41062722302](https://github.com/trost-systems/family-groceries/actions/runs/41062722302), before | 5c07a0b | 30 | 1 of 30 failed ("rot") | add sheet: 60 of 60 failed ("rot" or "ot") |
| [41063065757](https://github.com/trost-systems/family-groceries/actions/runs/41063065757), add field only | 1ac2a11 | 40 | 0 of 40 failed | add sheet: 0 of 80 failed |
| [41066142423](https://github.com/trost-systems/family-groceries/actions/runs/41066142423), app-wide fix | d95bc72 | 40 | 0 of 40 failed | add sheet 0 of 80, login 0 of 80 failed |

On the box (js build against no Supabase): the login test failed 5 of 5 without the fix
("heim-123" for "geheim-123") and passed 5 of 5 with it. Widget tests: with the handler off, the
4 gap tests fail. Local gates lint and flutter (834 tests) pass. Full PR CI: PR #122.

Screenshots: `docs/screenshots/34-add-sheet-first-key/` (the CI failure "rot" before, "Brot" after in wasm and js).

## Not done / open

Nothing known.
