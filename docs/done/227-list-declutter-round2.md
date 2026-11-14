# Job 227: list declutter round 2 prototypes (2026-11-13)

Draft PR https://github.com/trost-systems/family-groceries/pull/414 (DO NOT MERGE), on job 223's sandbox branch. This is the prototype gate only. Nothing in the app changed.

## What was built

Peter's fixed base (B1 to B6) is in every round 2 phone. The combined switcher sits in a fixed see-through header that the list scrolls under. First steps is today's card. The total is a row after the open items, above "Zuletzt verwendet". Every phone has three tabs (Liste, Verlauf, Mehr) and no plan/shop toggle. LD1's shopping prompt and trip bar stay. Three sets:

1. SS1 to SS5, the switcher sheet. Today's household sheet with every action, plus list switching and management (rename, move up, move down, delete, new):
   - SS1 `nested-tree`: lists indented under their household.
   - SS2 `lists-on-top`: "Listen in Brandt" above today's sheet.
   - SS3 `two-tabs`: a "Listen | Haushalte" switch at the top of the sheet.
   - SS4 `chips-in-row`: today's list tabs in the shown household's row, management on a second page.
   - SS5 `drill-in`: a household page with its lists, "‹ Haushalte" back to today's sheet.
2. BB1 to BB5, the bottom area. Each has a fake keyboard that shows the field above it:
   - BB1 `tight-stack`: the same two parts, tighter.
   - BB2 `field-and-icon-tabs`: one row, the field plus three icon tabs.
   - BB3 `one-slab`: one block with the field on top and named tabs below.
   - BB4 `field-is-the-list-tab`: the List tab is the field.
   - BB5 `tabs-hide-on-scroll`: the tabs slide away on scroll down.
3. LD4-3T `bottom-dock-three-tabs`: LD4's dock, full bleed, with the field and three named tabs. The switcher stays in the header.

The page switches between German and English, light and dark, 100, 130 and 160 % text, the screenshot set and 25 items, and one household, two, or many lists with long names. Round 1 stays under "Runde 1".

## Rows fully visible, 390 × 844

| | Today | LD1 | R2 (= SS1 to SS5) | BB1 | BB2 | BB3 | BB4 | BB5 | LD4-3T |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Screenshot set | 4 | 7 | 5 | 6 | 6 | 6 | 6 | 5 | 6 |
| Same, First steps hidden | 5 | 7 | 8 | 8 | 8 | 8 | 8 | 8 | 8 |
| 25 items, top | 4 | 7 | 5 | 6 | 7 | 6 | 7 | 5 | 6 |
| 25 items, scrolled 420 px | 5 | 9 | 9 | 9 | 10 | 10 | 10 | 10 | 9 |
| Screenshot set, 130 % text | 3 | 7 | 5 | 5 | 6 | 5 | 6 | 5 | 5 |
| 25 items scrolled, 130 % | 6 | 9 | 9 | 10 | 11 | 10 | 11 | 10 | 10 |
| Bottom (field and tabs) | 150 px | 150 | 150 | 128 | 86 | 122 | 86 | 150 (88 scrolling) | 134 |

The counts are the same in both languages and themes. During a job 217 trip, LD1 shows 6, R2 4, BB4 5 and LD4-3T 4. Today shows 4, not round 1's 3: round 1 stacked a 34 px home indicator under the pill. The app folds it into a 26 px gap (`shell.dart`, `_bandHeight`), so today's bottom is 150 px. LQ-R1 asks where Peter's 3 came from.

## Recommendation

- **SS4 `chips-in-row`.** It keeps today's sheet row for row and grows it by 114 px however many lists there are. With seven lists SS1 and SS2 grow by about 590 px.
- **BB4 `field-is-the-list-tab`.** It takes the bottom from 150 px to 86 px. History and More show icons only while on the list, and the hint fits at 100 % and shortens from 130 %.
- **LD4-3T does not beat the base with BB4.** Its bottom is 134 px, and it shows one row fewer with 25 items.

The runner-ups are SS1 and BB1. Open questions LQ-R1 to LQ-R6. The full text is in `docs/design/list-declutter/RECOMMENDATION.md` and `.de.md`, and the page shows it under "Empfehlung".

## Preview

- This is a Vercel **preview** on the existing `family-groceries-design` project, built from 20a235d3 (the lead review 1 fix) on 14 Nov 2026 at 00:46 CET: `https://family-groceries-design-b9fbc2wsp-peter-trost.vercel.app` (`dpl_7kf9JxSUYTgfeAtpQoo5vijxaAvR`, READY, target preview).
- It replaces two earlier previews. Share neither:
  - `ius2xho2k` (`dpl_q1E5cemXFRvTCN6YxixeBDPPsC9u`): the recommendation ran off a phone's screen.
  - `8f981nh0a` (`dpl_22QN39FJ7AeLmzGq7iHfcnCwKgSw`): it hid the bottom area on a phone.
- All 14 files' SHA-1s match the build (checked again for each redeploy). SSO protects the bare URL (302).
- Open `/` for the SS set, `/#/bb`, `/#/ld4` and `/#/rec`. Use `?lang=en&theme=dark&data=big&scen=many&ts=130` for the other data and settings.
- **The share link is still open.** This runner has no Vercel connector, so the lead mints the 23-hour link.
- **A stray preview is on the wrong project.** The first deploy, `dpl_3F43FoZrRcZV6Hhmf7HKP3GjDtfX` on `hummlist-nexus`, used the project ID that `nexus.env` exports. It is a preview behind SSO with no alias and nothing else changed. Don't share it. The lead can delete it.

## Verified

- `node docs/design/list-declutter/shoot.mjs <url> <out>`: all checks passed. The checks cover:
  - in every SS sheet: list pick, household switch, today's actions (invite on each row, pending request, Neuer Haushalt, Mit Code beitreten, Siri, Alexa & KI), move, delete, new list, and "Neuer Haushalt" with one household;
  - in every round 2 phone:
    - the header layer: fixed and see-through;
    - the total row: after the open items and above "Zuletzt verwendet";
    - First steps as today's card;
    - three tabs, each a 48 × 48 px hit-tested target, and a 48 px mic;
    - the History tab;
    - the field sitting above the keyboard;
    - the shopping prompt and trip bar;
  - BB5 shrinking and returning;
  - the app's tab labels kept at 130 %, and BB4's hint fitting at 100 %;
  - nothing sticking out of a phone at 100, 130 and 160 % with many lists;
  - touch holds, round 1's checks, and no page errors.
- `scripts/verify.sh --only lint,gitleaks,changelog`: passed.
- Review 0 (Opus, screenshots and touch drives): VERDICT FIX. Four must-fixes, all fixed:
  - tab labels dropped at 130 %;
  - BB4's hint cut at 100 %;
  - SS4's "one row" claim;
  - LD1 with two tabs.

  Its nice-to-haves were done as well.
- Review 1: VERDICT PASS. All four fixes are confirmed and there is no new must-fix. Its four nice-to-haves are done: the label fit after fonts load, a 48 px "+", a fade on the chip track, and the header edge in dark mode.

## Not done

There is no Flutter prototype and no production change, by design. The data is synthetic: the household "Brandt" replaced Peter's surname.

## Lead review 0 (2026-11-14, 00:00 to 00:20): fixed

VERDICT FIX, one must-fix, M1: on a phone the preview hid the very thing round 2 is about.

- **Problem.** Under 440 px the page put about 218 px of switches above a full-height phone. Swipes on the phone only scrolled its own list, so the BB bottom areas and the SS sheets' last actions were below the fold.
- **Fix.** On a phone the page shows one phone at a time. It fills the screen under a two-row strip (set and variant), and "Optionen" unfolds the rest. An open sheet also keeps its scroll place through toasts and list actions; the old code threw it back to the top.
- **Check.** `shoot.mjs` drives 390 × 664 with real touch:
  - every BB phone and LD4-3T: the field, the mic and the three tabs are on screen and pass the hit test, and a touch on a tab switches it;
  - every SS sheet with many lists: swipes on the phone alone reach its last action ("Siri, Alexa & KI"), a touch on it works, and the sheet stays in place.

  The same checks fail 54 times on 8c443909 ("the phone ends 882 of 664", "add field off screen 742..794") and pass now. Every count and bottom height is unchanged.
- **Nice-to-haves done.**
  - N1: the shown household row looks as in the app, with no fill and brand-coloured text.
  - N2: SS4 chips stop at 184 px with an ellipsis, and the recommendation names the trade.
  - N3: LD4-3T is described as BB3 at full width.
  - N4: the recommendation lists what the base takes from LD1.
  - N5: a note explains LD1's 7.
  - N6: the README says how the phone view works and where the counts come from.
- **Left to the lead.** N7, deleting the stray hummlist-nexus preview.

## Lead review 1 (2026-11-14, 00:28 to 00:40): fixed

VERDICT FIX, one must-fix, M1: on a phone the recommendation page ran off the right edge.

- **Problem.** The row-count table stretched the page to 476 px in German and 405 px in English.
- **Fix.** The recommendation's column can't grow past the screen any more, and the table scrolls in its own box.
- **Check.** `shoot.mjs` checks that `#/rec` and `#/rec1` fit 390 × 664 in German and English. On a7226fa0 it fails with exactly the reviewer's 476 and 405 px. It passes now, and every count is unchanged.
- **Nice-to-haves done.**
  - N1: on a phone the variant's label and name sit under the strip and open to its notes (`phone-390x664-SS4-notes.png`). This also corrects SS4's notes, which still said "one row".
  - N2: the first NEEDS_LEAD entry now points to the update.
  - N3: the LD5 quick-return check passed 10 of 10 runs alone and now waits for the header state instead of a fixed 300 ms.
  - N4: deleting the stray hummlist-nexus preview stays with the lead.
