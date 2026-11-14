# Job 230: subtotals per store, five prototypes (2026-11-14)

Draft PR https://github.com/trost-systems/snacklist/pull/414 (DO NOT MERGE), on job 223's sandbox branch, rebased onto main 5c83230d. This is the prototype gate only. Nothing in the app changed.

## Preview

- Vercel **preview** on `family-groceries-design`, after review 1: `https://family-groceries-design-r2gs9zc6r-peter-trost.vercel.app` (`dpl_EiJ2RGvMeNWPWC7FuzhNMTFwKFhX`, READY, target preview, built from the review 1 fix on 14 Nov 2026 at 13:09 CET). It opens in English; `?lang=de` gives German. All 16 files' SHA-1s match the build. SSO protects the bare URL (302). Superseded, don't share: `6nwtheqfm` (`dpl_Cmiwk7sx3kJuChzVMuVKveSDqyHh`, German by default) and `9odjzo3fj` (`dpl_LFEpBYJbzjmipqCd816vPEiinhnw`, says "4 Läden" with "Ohne Laden").
- **The share link is not minted yet.** This runner has no Vercel connector, so the lead mints the 23-hour link (NEEDS_LEAD "Job 230"). Write the expiry next to it.
- The ST set is the first view (`/`), in English. Paths: `/#/st`, `/#/recst` (the recommendation), single phones `/#/ST1` … `/#/ST5`. Options: `?data=one|three|mixed&lang=de&theme=dark&ts=130|160`. Rounds 1 and 2 stay on the page.

## What was built

Five ways to show subtotals per store and a final total, on Peter's round 2 pick: R2's phone (fixed see-through header, First steps as today, total as a row above "Zuletzt verwendet", today's bottom, three tabs). Its switcher opens SS5, and there is no trip prompt (job 217 is not on main).

1. **ST1 `subtotal-on-divider`.** The subtotal sits on each store's divider, with "4 offen · 2 ohne Preis" above it.
2. **ST2 `section-foot`.** A "Summe Lidl 10,05 €" line closes each store's section, as in today's app. Folded, the sum moves into the divider.
3. **ST3 `summary-block`.** One block above "Zuletzt verwendet" has a line per store (name, "2 ohne Preis", subtotal), then "Gesamt". A store line jumps to its section.
4. **ST4 `expandable-total`.** R2's total row with an arrow. A tap unfolds the store lines.
5. **ST5 `chip-line`.** Hex chips "Lidl 10,05 €" wrap under the total. A chip jumps to its section.

The rules shared by all five:
- A subtotal sums the store's priced items, open or ticked (job 190's total rule).
- "N ohne Preis" counts open items without a price, per store and for the list ("3 Läden · 10 mit Preis · 4 ohne Preis").
- Weighed items show their line total.
- "Ohne Laden" is a group of its own.
- One store means no subtotal, only the total.
- A store ticked off in full stays (marked "alles gekauft"), so the subtotals always add up to the total.

The data covers one store, three stores (Lidl, dm, "Wochenmarkt am Kollwitzplatz (Samstag)"), and three plus "Ohne Laden". The page has German and English, light and dark, and text at 100, 130 and 160 %.

## Recommendation: ST3 `summary-block`

It shows what Peter asked for, intermediate sums then the final one, together and easy to check. It costs no row at the top of the list (equal to R2 in every case measured), only 190 px at the end with three stores at 100 % (331 px at 160 %, where the long store name wraps). R2's divider already showed a subtotal and Peter still asked for one, so a small number per section is not enough. Runner-up: ST1, if the sum must sit next to the store while shopping. It costs one row at 100 %. Full text (DE and EN): `docs/design/list-declutter/RECOMMENDATION-ST*.md`.

## Rows fully visible, 390 × 844 (German, light; same in English and dark)

| | Today | R2 | ST1 | ST2 | ST3 | ST4 | ST5 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3 stores, 100 %, top | 3 | 6 | 5 | 6 | 6 | 6 | 6 |
| 3 stores, First steps hidden | 6 | 8 | 8 | 7 | 8 | 8 | 8 |
| 3 stores, 130 %, top | 2 | 5 | 5 | 5 | 5 | 5 | 5 |
| 3 stores, 160 %, First steps hidden | 6 | 8 | 7 | 7 | 8 | 8 | 8 |
| 1 store, 100 %, top | 3 | 6 | 6 | 6 | 6 | 6 | 6 |
| List height over R2, 3 stores, 100 % | +93 | 0 | +24 | +108 | +190 | +10 | +96 |

Full tables: `docs/screenshots/230/st-items-visible.tsv`, `st-height-vs-r2.tsv`.

## Open questions

- **ST-Q1.** With items still unpriced, should the total read as a floor ("mind. 32,08 €" or "32,08 € + 4 ohne Preis")?
- **ST-Q2.** Should the block split bought and still open ("12,40 € gekauft · 19,68 € offen")? Subtotals count ticked items now.
- **ST-Q3.** Keep "Ohne Laden" as a group with its own subtotal, or count it in the total only?
- **ST-Q4.** Should a weighed item's line total from the planned weight be marked as an estimate ("≈ 1,51 €") until it is weighed?
- **ST-Q5.** With ST3, should the dividers keep R2's small sum too (the same number twice), or only the count?
- **ST-Q6.** "10 mit Preis · 4 ohne Preis" instead of the app's "… · 4 offen": clearer, but it wraps at 160 % (+29 px). Worth it? The two counts also use different bases ("mit Preis" counts ticked items, "ohne Preis" only open ones). Keep that?
- **ST-Q7.** ST3's store line jumps to its section, but nothing jumps back to the total. Worth a way back?

## How to verify

From the repo root: `python3 -m http.server 64230 --bind 127.0.0.1`, then `node docs/design/list-declutter/shoot-st.mjs http://127.0.0.1:64230/docs/design/list-declutter/index.html /tmp/out [playwright-module-dir]`. The Playwright module directory defaults to `~/family-groceries/e2e/node_modules/`; in a fresh clone, run `npm ci` in `e2e/` and pass `e2e/node_modules/`. It prints the tables and "all checks passed", or exits 1.

## Test results

- `shoot-st.mjs`: all checks passed. It runs one, three and mixed data × 100, 130 and 160 % × de, en × light, dark. It checks:
  - the subtotals add up to the total, one store shows none, and the per-store and list "ohne Preis" counts;
  - after ticking dm in full, the subtotals still add up and dm says "alles gekauft";
  - ST4 folds and unfolds;
  - ST3's and ST5's jump lands the section 0 to 12 px under the header;
  - 48 px hit-tested targets;
  - nothing sticks out of or overlaps in a phone;
  - there is no trip prompt, and the switcher opens SS5;
  - each ST phone fits a 390 × 664 phone, and `#/recst` fits in both languages;
  - there are no page errors.
- The first run caught two bugs, both fixed: the jump measured a detached node (it landed 22 to 112 px off), and ST5 did not mark a store bought in full.
- Round 2's `shoot.mjs`: all checks passed (no regressions in rounds 1 and 2).
- `scripts/verify.sh --only lint,gitleaks`: passed.
- CI on the pushed head: see the BOARD line (draft PR, not for merge).

## Screenshots

`docs/screenshots/230/`: the set scrolled to the totals (`st-three-de-light-end.png`, `st-three-en-dark-end.png`, `st-three-130-de-light-end.png`, `st-three-160-en-dark-end.png`, `st-one-*`, `st-mixed-de-light-end.png`, `st-three-de-light-dm-bought.png`), one phone per variant (`ST*-three-de-light-end.png`, `ST4-three-de-light-open.png`, `ST1-one-de-light-end.png`, `R2-…`), and `phone-390x664-ST3-end.png`.

## Also fixed

A long store name now cuts at 168 px in every slim divider. Before, R2's badge ran over its subtotal with the market's name.

## Missing or blocked

- Share link: the lead mints it (no Vercel connector on hz).
- Nothing else is blocked. The building job would put the ST pick on top of job 229 (R2 with SS5), behind the same `list-declutter` flag.

## Review 0 (2026-11-14)

- **Must fix, done: "Ohne Laden" is not a store.** With three stores plus "Ohne Laden", every ST variant said "4 Läden" / "4 stores". The total's line now counts named stores only and adds the group: "3 Läden + ohne Laden" / "3 stores + no store" ("1 Laden" in the singular). `shoot-st.mjs` asserts the store wording for one, three and mixed data in both languages. On the reviewed head 18cb9b2e that check fails 60 times (every mixed combination × five variants). On the fix it passes.
- **Nice to have, done.**
  - ST3's and ST4's store lines show a long name in full as plain text that wraps, with "ohne Preis" under it. Only the dividers cut at 168 px. `shoot-st.mjs` checks that the full market name shows. This makes ST3's block 190 px at 100 % (was 185) and 331 px at 160 %. The rows visible at the top are unchanged.
  - ST2's line for the no-store group says "Summe: ohne Laden" / "Total: no store".
  - The recommendation now gives the one-store cost at 160 % (+29 px) and the mixed wrap (+18 px).
  - ST-Q6 names the two counts' different bases.
  - The missing way back from ST3's jump is the new ST-Q7.
- `shoot-st.mjs`: all checks passed. The screenshots in `docs/screenshots/230/` are retaken. The preview is redeployed (see "Preview" above).

## Review 1 (2026-11-14)

- **Must fix, done: the page opens in English (lead note t870u).** Without `lang` the page, the ST set, `#/recst` and the phone view on a narrow screen render English (`<html lang="en">`, "English" selected). `?lang=de` and the Deutsch switch give German. `shoot-st.mjs` checks the bare URL for `#/st`, `#/recst` and `#/ST3`, the phone view's strip at 390 × 664 (`phone-390x664-ST3-end-en.png`), and `?lang=de`. On the reviewed head 5476c34f that check fails 4 times. On the fix all checks pass. Rounds 1 and 2 pass their tests: `shoot.mjs` reports all checks passed, and it passes `lang` explicitly.
- Nice to have, done: the README says ST-Q1 to ST-Q7 and that English is the default. "How to verify" names the Playwright module directory.
- The preview is redeployed (see "Preview"). The share link should be minted for that build only.
