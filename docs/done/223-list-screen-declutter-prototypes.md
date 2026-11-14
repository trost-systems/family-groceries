# Job 223: more room for the list, five prototypes (2026-11-13)

Draft PR https://github.com/trost-systems/snacklist/pull/414 (DO NOT MERGE). This is the prototype gate only. Nothing in the app changed.

## Paths

- Sandbox: `docs/design/list-declutter/`. `index.html`, `proto.js` and `proto.css` hold the page and the six phones (today, LD1 to LD5). `model.js` has the seed data and the German and English strings, `variants.js` the notes, and `icons.js` the app's Material glyphs.
- `shoot.mjs <url> <out>` takes the screenshots, writes `items-visible.tsv` and runs the reachability, touch and regression checks. It exits 1 on any miss.
- `build.sh <dir>` builds the static folder for the preview. This runner's copy is `/tmp/dist223` (hz only).
- Recommendation: `RECOMMENDATION.md` (English) and `RECOMMENDATION.de.md` (German). The page shows them under "Empfehlung" / "Recommendation".
- Screenshots: `docs/screenshots/223/`, including two shots of the real app today (`baseline-real-app-*.png`).

## The five labels

1. LD1 `slim-chrome`: same structure with every band thinner. Job 205's two-line bar, First steps as a one-line nudge, a quiet € mark instead of "+ Preis", and a 28 px total line. On the first tick it asks job 217's "Kaufst du gerade ein?", and during a trip the trip bar replaces the total line.
2. LD2 `collapsing-header`: everything on top at first, collapsing to a 48 px bar on scroll. "+ Preis" is offered after a tick.
3. LD3 `plan-and-shop-modes`: planning shows no prices, total or counts. Shopping (the button, or the 217 prompt) brings the chips and 217's trip bar with stopwatch, pause, end and total.
4. LD4 `bottom-dock`: no top bar. One dock holds the add field and More, with a handle (tap or drag up) for list, household, Anpassen, totals and First steps.
5. LD5 `list-owns-the-chrome`: header, First steps and total are rows of the list. A quick-return header comes back on scroll-up, and a left swipe shows "Preis".

## Items visible (whole rows, 390 × 844 with the iPhone status bar and home indicator)

| | Today | LD1 | LD2 | LD3 | LD4 | LD5 |
| --- | --- | --- | --- | --- | --- | --- |
| Screenshot set (10 items) | 3 | 6 | 5 | 7 | 8 | 6 |
| 25 items, top | 3 | 7 | 5 | 7 | 9 | 7 |
| 25 items, scrolled 420 px | 5 | 9 | 8 | 10 | 11 | 10 |
| During a trip (screenshot set) | | 6 | | 6 | | |

The numbers are the same in German and English, light and dark. Today's rebuild matches a drive of the real web build within 4 px per band, and rows within 1 px. The web build shows 4 items, because it has no status bar or home indicator. On the phone it shows 3, as on Peter's screenshot.

## Recommendation

LD1 `slim-chrome`, with the total moving into job 217's trip bar while a trip runs. It goes from 3 to 6 items (7 with 25 items) with no new gesture and no new state. LD4 fits more (8 and 9), but it replaces the tab pill and hides list switching, Anpassen and the total behind a handle. Open questions LQ-D1 to LQ-D8 are in the recommendation.

## Preview

- Vercel **preview** on the existing `family-groceries-design` project, deployed 13 Nov 2026 at 21:21 CET from head ae5739af: `https://family-groceries-design-cpd9n0310-peter-trost.vercel.app` (`dpl_8EZ1F1zMhpr3RoDZQ6kDUyuDirP3`, READY, target preview). Open `/#/LD1` for one variant, `/#/rec` for the recommendation, `?lang=en&theme=dark&data=big` for English, dark and 25 items.
- Don't share the earlier deploys `3o5s2rs6c` (20:48) and `lgtigyx2w` (20:35): they predate the lead review's fix (44 × 40 px € target).
- All 11 deployed files have the same SHA-1 as the build. SSO protects the bare URL (302 to Vercel sign-in).
- **The share link is still open.** This runner has no Vercel connector for `get_access_to_vercel_url`. The lead mints the 23-hour link and sends it to Peter. The preview is not ready for Peter until then.
- No Vercel project, domain, protection or setting changed. Nothing went to production.

## Verified

- `node docs/design/list-declutter/shoot.mjs <url> <out>`: all checks passed. It checks:
  - each variant in both languages: the list and household switch, Anpassen, First steps open and hide, the mic, the nav or More, the store count, a total;
  - price entry in each variant;
  - the LD1 and LD3 prompt and trip (the snapshot count, end trip);
  - the LD2 collapse and the LD5 quick return, which also stays after a tick;
  - a typed price survives the timers;
  - a mouse drag doesn't tick;
  - no element sticks out of the phone;
  - **real touch** (CDP touch events): hold to edit in all six phones, the LD5 swipe and the LD4 handle drag;
  - LD1's 217 prompt sits at least 8 px above the total line;
  - at 390 px wide, LD5's quick-return header sits flush on the list's top;
  - LD1's € mark and the price chips are 48 px tap targets, measured with the browser's hit test.
- The touch checks fail on the first head (all six holds and the LD4 drag). The prompt and header checks fail on be98ed8d (−6 px and 47 px). All of them pass now.
- `scripts/verify.sh --only lint,gitleaks,changelog`: passed.
- Review 0 (Opus, screenshots and touch drives): VERDICT FIX. Six must-fixes, all fixed: touch hold, chip contour, typed price lost to timers, LD1 trip state, LD4 dock, LD5 header.
- Review 1: all six confirmed fixed, VERDICT FIX on two new ones (prompt over the total line, LD5 header offset on phones). Both are fixed, and so are its nice-to-haves.
- Review 2: VERDICT PASS on 1ecbbae7. Review 1's two must-fixes and four nice-to-haves are confirmed, with no new must-fix. Two cosmetic leftovers: a half row shows cut above LD1's bottom bar, and a hold drops a price typed in another row's inline editor.
- CI: `ci-ok` green on 1ecbbae7. The final commit only adds this file.

## Found on the way

The baseline drive saw the sign-in email and password text boxes still in the web build's accessibility tree on the list screen after sign-in. They were seeded test credentials. This is unrelated to this job and was not reproduced beyond that drive. It is passed to the lead as its own job.

## Not done

There is no Flutter prototype and no production change, by design. The data is synthetic and there are no backend calls.

## Lead review 0 (2026-11-13, 21:10–21:45)

VERDICT FIX, one must-fix: the recommended LD1 € mark was 44 × 40 px, while the docs said 48 px and today's price button is 48 px. A miss ticks the row.

- **Fixed.** The € target is now 48 × 48 px and the glyph has not moved. The price chips' hit area is 48 px tall in every phone, so taps just above or below a chip no longer tick the row. LD2's mini-bar list button is 44 px tall. The docs say "48 × 48 px, as large as today's price button".
- **Check.** `shoot.mjs` measures the targets with `elementFromPoint`, 23 px from the centre. On 8a7ef03c it fails with today 73×30, LD1 € 44×40 and chips 71×30 and 73×30. Now it passes. The items-visible table is byte-identical, so the counts don't change.
- **Nice to haves done.** The README says LQ-D1 to LQ-D8. On a phone the page hides the intro and puts the switchers in single scrolling rows, so the first phone starts about 140 px down instead of about 400. The NEEDS_LEAD entry lists all five labels.
- **Still open, cosmetic.** A half row shows cut above LD1's bottom bar (reviews 1, 2 and the lead review).
- **Gates and CI.** `scripts/verify.sh --only lint,gitleaks,changelog` passed. CI on the new head: see the BOARD line.

