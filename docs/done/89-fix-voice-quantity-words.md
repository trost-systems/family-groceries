# Job 89: a count said after the item is its quantity again (PR #215)

Bug (Peter, 2026-11-03 20:07): dictating „Gurken zwei“ created the item „Gurken 2“ with no
quantity. Regression from job 61 (#183).

## Root cause

Job 61 made the voice splitter (`supabase/functions/voice/parse.ts`) hand a bare count after the
item back into the name as digits, so that `public.parse_item`'s typed rule (1 to 20 after a known
name) would decide. Only `add_item` runs `parse_item`. In-app dictation calls the voice function
with `mode: parse` and adds the returned name and quantity itself, so it stored „Gurken 2“ as the
name. Siri and Alexa went through `add_item` and so got the typed rule, which also lost „Eier
dreißig“, „Büroklammern hundert“ and any count after a name the dictionary doesn't know. The
English splitter (`parse_en.ts`) never read a count after the item at all.

## Fix

- `voice/parse.ts`: a count said after the item, as a word or digits, is the quantity again. Size
  words (Größe, Typ, Nr., Stufe, …) still keep their number in the name, and units are unchanged.
- `voice/parse_en.ts`: the same for English („cucumbers two“, „cucumbers 2“), with English size
  words (size, type, no, number, stage).
- Siri, Alexa and in-app dictation share these splitters. Alexa's „drauf“ filler (job 69) still
  goes first („Gurken zwei drauf“ → 2 Gurken).
- Typed input is unchanged (job 61's rule in `parse_item` and the app's `parseEntry`).

## Tests (failing on main, passing now)

- `voice/parse_test.ts`: „Gurken zwei“, „Gurken 2“, „Eier 10“, „Büroklammern hundert“, „Gurken
  zwei drauf“, in a sentence, with Siri's phrasing, and eins … zwölf, zwanzig, dreißig as words
  and digits. Units („Hack 500 Gramm“, „Milch zwei Liter“) pass before and after.
- `voice/parse_en_test.ts`: one … twelve, twenty, thirty after and before the item, „cucumbers
  2“, „diapers size 4“ stays whole.
- `voice/handler_test.ts`: `mode: parse` (in-app dictation) returns Gurken/2 and cucumbers/2.
- `alexa/handler_test.ts`: „Gurken zwei drauf“ (de-DE) and „cucumbers three“ (en-GB) store the
  quantity.
- `supabase/tests/quantity_parse.tsv`: new `mode` (typed/spoken) and `lang` columns. Typed rows
  run through the app's `parseEntry` and MCP. Spoken rows run through the real voice add code
  against the database (`_shared/add_paths_integration_test.ts`, db gate).

## Verified on the local stack (served voice function)

Before (main's splitter):

```
parse | Gurken zwei -> [{"name":"Gurken 2","quantity":null}]
parse | Eier zwölf -> [{"name":"Eier 12","quantity":null}]
```

After: see `docs/screenshots/89/voice-function.txt`.

## Not done / for the lead

- No Alexa skill model change; nothing to deploy or certify.
- Typed „zwei Gurken“ offline: the app's `parseEntry` keeps it as the name, while the server
  reads Gurken ×2. This predates the bug and is on the typed path, so it is out of scope.
  NEEDS_LEAD „Job 89“.
- Dictation on a real phone was not driven (no device here). The function's `mode: parse`
  answer, which the app adds as is, was.
