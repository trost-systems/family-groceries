# Job 112: Siri reply for branded open items, English Alexa single leftover

## What changed

1. **Siri and Alexa, plain name with its branded item open (Peter Q79).** With „Butter“ (brand
   Weihenstephan) open, saying „Butter“ added a second, plain Butter and answered „Hinzugefügt:
   Butter. Schon auf der Liste: Butter.“ Now, when the open item has a brand or only the note Bio,
   the add is held and Siri (native) and Alexa ask one yes/no question: „Butter Weihenstephan steht
   schon drauf. Soll ich Butter trotzdem dazuschreiben?“ Yes adds a second Butter, no or no answer
   adds nothing and says it is already there. The Shortcut cannot ask: it answers „Schon auf der
   Liste: Butter Weihenstephan.“ and adds nothing. Singular and plural count as the same name
   („Tomate“ with „Tomaten Bio“ open). Any other detail is another product and the plain name adds:
   „Butter“ with „Butter gesalzen“ open answers „Hinzugefügt: Butter. Schon auf der Liste: Butter
   gesalzen.“ (the same for passiert, laktosefrei, flavours; review 3). Voice adds never change an
   open item. Root cause of the old reply: `add_item` keys on name plus brand, so the plain name
   inserted a new row, and `similar_items` then named the branded one by its bare name. Code:
   `voice/items.ts` (`held`, `noteWords`, `addVariants`, similar items named in full),
   `voice/handler.ts` (`ask`, `confirmed`, outcome `confirm`), `alexa/handler.ts`
   (`Dialog.ConfirmIntent`, reply kind `ask`), `app/ios/Runner/AppIntents` (`requestConfirmation`).
   The app and MCP are unchanged.
2. **Alexa read-back with eleven items.** It read ten and said "and 1 more" („und eine weitere“).
   Both voices now read all eleven; twelve and more still end with the count
   (`alexa/speech.ts`, `alexa/speech_en.ts`). The brief said German already did this; it did not,
   so both changed (docs/DECISIONS.md, "Job 112").

Feature map: `siri.md`, `alexa.md` and both sections of `FEATURES-FOR-WRITERS.md`.

## How to verify

- `cd supabase/functions && deno test --allow-env --allow-net alexa voice` (422 passed).
- Q79: `voice/handler_siri_test.ts` and `alexa/handler_test.ts` (`Q79: …`), the yes, no and
  no-answer paths. `_shared/voice_variants_integration_test.ts` (db gate, review 3) creates the open
  items through `add_item` and sends every request through the real Shortcut, native Siri and
  Alexa handlers, de and en: Butter gesalzen, Tomaten passiert, Milch laktosefrei, Butter
  Weihenstephan gesalzen and Bio Milch laktosefrei add with no question and name the open item in
  full (30 cases, all failed before); Butter Weihenstephan and Bio Tomaten ask, and yes, no and no
  answer behave. The db gate's integration files: 72 passed. `flutter analyze` clean, `flutter test` 1819 passed.
  Swift (`SiriTests.swift`) compiles and runs only in the `ios` CI job.
- Review 0 fix: `dedupe_integration_test.ts` „Tomate“ / „Gurken“ with Tomaten (Bio) / Gurke (Bio)
  open failed before (`Hinzugefügt: Tomate. Schon auf der Liste: Tomaten.`), pass after; the db
  gate's integration files: 35 passed.
- With a local stack: `FG_DB_TEST=1 SUPABASE_DB_URL=… deno test --allow-env --allow-net --allow-read
  _shared/dedupe_integration_test.ts` (the db gate runs it in CI).
- `scripts/verify.sh --only functions,lint`.
- Over HTTP against the local stack (job's 612xx block), a fresh household with Butter
  (Weihenstephan) open and a personal access token, POST `/functions/v1/voice`:

  | Request | Before | After |
  | --- | --- | --- |
  | `Butter` (Shortcut) | „Hinzugefügt: Butter. Schon auf der Liste: Butter.“ | „Schon auf der Liste: Butter Weihenstephan.“ |
  | `butter` (`lang: en`) | "Already on the list: Butter." (the plain row from the first request) | "Already on the list: Butter Weihenstephan." |
  | `Butter Kerrygold` | „Hinzugefügt: Butter Kerrygold. Schon auf der Liste: Butter.“ | „Hinzugefügt: Butter Kerrygold.“ |
  | open items afterwards | Weihenstephan, plain, Kerrygold | Weihenstephan, Kerrygold |

- Q79 over HTTP on the local stack, review 3: one fresh household per row, the open item created
  through `add_item` (the parser), POST `/functions/v1/voice`:

  | Open (stored) | Request | Answer | Open after |
  | --- | --- | --- | --- |
  | Butter gesalzen (Butter / gesalzen) | `Butter` (Shortcut) | „Hinzugefügt: Butter. Schon auf der Liste: Butter gesalzen.“ | + Butter |
  | Butter gesalzen | `Butter`, `de`, `ask` | `added`, same sentence, no question | + Butter |
  | Butter gesalzen | `butter`, `en`, `ask` | `added`: "Added butter to Hummlist. Already on the list: Butter gesalzen." | + butter |
  | Tomaten passiert (Tomaten / passiert) | `Tomaten` (Shortcut, de `ask`, en `ask`) | added, „… Schon auf der Liste: Tomaten passiert.“, no question | + Tomaten |
  | Milch laktosefrei (Milch / laktosefrei) | `Milch` (Shortcut, de `ask`, en `ask`) | added, „… Schon auf der Liste: Milch laktosefrei.“, no question | + Milch |
  | Butter Weihenstephan (Butter / Weihenstephan) | `Butter` (Shortcut) | „Schon auf der Liste: Butter Weihenstephan.“ | unchanged |
  | Butter Weihenstephan | `Butter`, `de`, `ask`, then yes | `confirm`: „Butter Weihenstephan steht schon drauf. Soll ich Butter trotzdem dazuschreiben?“; yes: „Hinzugefügt: Butter.“ | + Butter |
  | Butter Weihenstephan | `butter`, `en`, `ask`, then yes | `confirm`: "Butter Weihenstephan is already on the list. Should I add butter anyway?"; yes: "Added butter to Hummlist." | + butter |
  | Bio Tomaten (Tomaten / Bio) | `Tomaten` (Shortcut) | „Schon auf der Liste: Tomaten Bio.“ | unchanged |
  | Bio Tomaten | `Tomaten`, `de` / `en`, `ask`, then yes | `confirm`: „Tomaten Bio steht schon drauf. Soll ich Tomaten trotzdem dazuschreiben?“ / "… Should I add tomaten anyway?"; yes adds | + Tomaten |

  Alexa runs the same rows in `voice_variants_integration_test.ts` through its handler (a local
  Alexa request needs a linked OAuth token and cannot send a yes; `scripts/alexa-say.sh` has no
  confirmation option).

## NEEDS_COPY_REVIEW

Four new spoken sentences (Siri and Alexa, one and several items, DE and EN) in
`site/COPY_NEEDED.md`, section "Voice replies (Siri, Alexa)", from
`supabase/functions/voice/copy_needed.json`, and old -> new in the PR body. Peter waived the copy
check-in (Addendum 2): the lead merges after an Opus MERGE and green CI.

## Open

- „2 Butter“ with a branded Butter open answers „Schon auf der Liste: Butter Weihenstephan.“ and
  drops the spoken amount, as a plain open Butter already does on main (`add_item` returns the
  open row unchanged).
- Siri's own read (`voice/copy.ts`, `listing`) still says „und eine weitere“ / "and 1 more" for an
  eleventh item. Left for the voice owner (job 111 is on truncated voice lists).
- The question flow is unverified on a real iPhone and a real Alexa device (none here).
  `requestConfirmation` and `Dialog.ConfirmIntent` follow Apple's and Amazon's documented APIs.
- After the merge, delete the helper branches `job/112-fix-speech-replies-ordered` and
  `-review0-ordered`; they only show the test-before-fix order for review.
- No screenshots: server replies only, no UI changed; the evidence is the table above and the tests.
