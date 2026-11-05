# Job 112: Siri reply for branded open items, English Alexa single leftover

## What changed

1. **Siri and Alexa, plain name with its branded item open.** With „Butter“ (brand Weihenstephan)
   open, saying „Butter“ added a second, plain Butter and answered „Hinzugefügt: Butter. Schon auf
   der Liste: Butter.“ Now nothing is added and the answer is „Schon auf der Liste: Butter
   Weihenstephan.“ (EN "Already on the list: Butter Weihenstephan."; Alexa „Schon auf der
   Hummlist: …“). Root cause: `add_item` keys on name plus brand, so the plain name inserted a new
   row, and `similar_items` then named the branded one. Fix in `supabase/functions/voice/items.ts`
   (Siri and Alexa share it): a request the server parser reads without brand or properties
   resolves to the open item of the same name, singular or plural alike („Tomate“ with „Tomaten
   Bio“ open; review 0). Another brand („Butter Kerrygold“) is still added. The app and MCP are
   unchanged (they add and offer the merge).
2. **Alexa read-back with eleven items.** It read ten and said "and 1 more" („und eine weitere“).
   Both voices now read all eleven; twelve and more still end with the count
   (`alexa/speech.ts`, `alexa/speech_en.ts`). The brief said German already did this; it did not,
   so both changed (docs/DECISIONS.md, "Job 112").

Feature map: `siri.md`, `alexa.md` and both sections of `FEATURES-FOR-WRITERS.md`.

## How to verify

- `cd supabase/functions && deno test --allow-env --allow-net alexa voice` (414 passed).
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

## NEEDS_COPY_REVIEW

None. Both fixes use existing strings and the existing enumeration.

## Open

- „2 Butter“ with a branded Butter open answers „Schon auf der Liste: Butter Weihenstephan.“ and
  drops the spoken amount, as a plain open Butter already does on main (`add_item` returns the
  open row unchanged).
- Siri's own read (`voice/copy.ts`, `listing`) still says „und eine weitere“ / "and 1 more" for an
  eleventh item. Left for the voice owner (job 111 is on truncated voice lists).
- No screenshots: server replies only, no UI changed; the evidence is the table above and the tests.
