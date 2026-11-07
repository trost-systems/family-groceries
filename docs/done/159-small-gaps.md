# Job 159: three small gaps from vmaint-20261106

Branch `job/159-small-gaps`. The gaps came from the vmaint drive in #282.

## What changed

- **A store name you already have.** „Laden hinzufügen“ with a name the household has („lidl“
  while Lidl exists, „MÜLLER“ while Müller exists) closed the dialog without a word. The dialog
  now stays open and shows „Einen Laden „Lidl“ gibt es schon.“ / "A store named “Lidl” already
  exists." under the field. There is no snackbar. The check is the name dialog's `validate`,
  which renaming already used (`app/lib/list/stores_screen.dart`).
- **„Drei Glocken Nudeln“ said.** The voice splitter read it as 3x „Glocken Nudeln“. The German
  and English splitters now keep names that start with a number word, from the same table
  typing uses (`numberNames` in `supabase/functions/voice/parse.ts`, the `name` rows of
  `supabase/tests/number_words.tsv`). „drei Äpfel“ is still 3 Äpfel. Siri, Alexa and in-app
  dictation share this splitter.
- **Mouse wheel over the add field and the tab pill.** Neither scrolled the list on the web. Both
  bands are a Scaffold's bottom bar, beside the page rather than in it, so the wheel event stopped
  there. `ScrollThrough` (`app/lib/app/scroll_through.dart`) hands a band's wheel and trackpad
  scrolls to the page under it. Taps stay the band's. The vmaint drive found the add field; the
  tab pill turned up while driving the fix.

Reasons and rejected options: docs/DECISIONS.md, "Job 159".

## How to verify

- `cd app && flutter test test/list/stores_screen_test.dart test/list/list_screen_test.dart test/app/shell_pages_test.dart`
- `cd supabase/functions && deno test --allow-env --allow-net --allow-read=../tests voice/`
- e2e: `add-sheet.spec.ts`, "the mouse wheel over the floating field and the tab pill scrolls
  the list; a click still opens the field".
- On the web build (verify-hummlist): the journey in the job's evidence directory
  (`_job159.mjs`, not committed) logs how far the list moves per wheel, the store dialog and the
  splitter's answer. Screenshots are in `docs/screenshots/159/`.

## Results

- Flutter: all 2,079 tests pass. Before the fix, the new tests failed: the dialog closed, and the
  list stayed at 260 px (add field) and 0 px (tab pill) after a 120 px wheel.
- Functions: 368 voice tests pass, including the drift test against `number_words.tsv`.
- Web build (1366, 800 and 390 px wide, DE and EN): a 300 px wheel over the field, the band
  beside it and the tab pill moves the list 300 px. Before the shell fix, the tab pill moved it
  0 px. A click on the field opens the sheet. „lidl“ keeps the dialog open with the message, and
  the database still has one Lidl. The splitter answers „Verstanden: Drei Glocken Nudeln, 3
  Äpfel.“
- Local gates: gitleaks, lint, functions, flutter (full suite) pass. e2e runs in CI (the hz e2e
  lock was held by another job).

## Not covered

- An iPad trackpad sends pan-zoom gestures, not scroll events. Over the bands those still do not
  scroll the list. Desktop browsers send wheel events, which this fixes.
- A recognizer that writes digits („3 Glocken Nudeln“) still gives 3x, as typing does.
