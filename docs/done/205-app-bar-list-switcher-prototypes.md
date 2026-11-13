# Job 205: household and list in the top bar, five prototypes (2026-11-13)

Draft PR https://github.com/trost-systems/snacklist/pull/401 (DO NOT MERGE). Prototype gate only (t777u). Nothing in the app changed, and none of this is approval to implement. The PR is a draft marked DO NOT MERGE.

## Paths

- Sandbox: `docs/design/app-bar-switcher/`. `index.html` and `proto.js` hold the page and the switcher. `variants.js` has the notes and the recommendation page, `model.js` the synthetic households, `proto.css` the hex look from `site/public/tokens.css`, and `icons.js` the app's Material glyphs.
- `build.sh` builds the self-contained static folder for the preview. `shoot.mjs` drives the variants and checks them.
- Recommendation: `docs/design/app-bar-switcher/RECOMMENDATION.md`, also on the page under "Empfehlung".
- Screenshots: `docs/screenshots/205/`.

## The five slugs

1. `breadcrumb-in-bar`
2. `stacked-two-line`
3. `single-chip-truncate`
4. `list-first-chip`
5. `hide-household-when-solo`

`current` shows today's bar with the list tabs row as the reference.

## Preview

- The current Vercel **preview** is on the existing `family-groceries-design` project. It was redeployed after review 2, on 13 Nov 2026 at 20:08 CET, after inner review 1: `https://family-groceries-design-94ramtvo0-peter-trost.vercel.app` (`dpl_4gEcK9gB19psb71iY9AiKen1DsRw`, READY, target preview).
- All 9 deployed files hash the same as the build.
- SSO protects it, so the bare URL redirects to a Vercel sign-in.
- Earlier deploys are outdated, so don't share them: `36a0b4sju` (16:09), `6zgiy05gd` (16:28, review 0), `d8mphs94b` (`dpl_2TsoETYUwhcJtJSLkyHT3TJs4xch`, 16:41, review 1) and `6y9412bci` (`dpl_Hw9HbAEctEjAdg1ZdzRn3PkPNCad`, 19:59, before inner review 1).
- **The share link is still open.** The Hetzner runner has no Vercel connector for `get_access_to_vercel_url`. The lead needs to mint the 23-hour share link for `dpl_4gEcK9gB19psb71iY9AiKen1DsRw` and send it to Peter. The preview is not ready for Peter until then.
- To rebuild the static output, run `docs/design/app-bar-switcher/build.sh <dir>` from any checkout. This runner's copy is `/tmp/dist205b`, which exists only on hz.
- No Vercel project, domain, protection or setting changed, and nothing was deployed to production.

## Recommendation

Use `stacked-two-line`, and always show the household.

- **The bar.** The household sits small above the list, in one raised hex button left of Anpassen.
- **The sheet.** The households are chips on top, and the picked household's lists are below them.
- **Short names.** It keeps them whole longest. The test used three households ("Trost", "Geburtstag") in 12 settings: 390, 360 and 320 px, 100 and 130 % text, online and offline. Both names stay whole in 8 settings with `stacked-two-line`, 7 with `list-first-chip`, and 4 each with `breadcrumb-in-bar` and `single-chip-truncate`. The household stays whole in 11 of the 12.
- **Where it stops.** At 390 px with 130 % text and offline, the two-line button (variants 2 and 5) is the only bar that doesn't cut "Geburtstag" (`docs/screenshots/205/grid-390-offline-big.png`, `bars-130-offline.png`). At 320 px with 130 % text and offline, every variant cuts both names. The table is in `docs/design/app-bar-switcher/bar-names.tsv`.
- **Always show the household.** The bar keeps the same shape when someone joins a second household. The name is the visible way to create or join one. Siri, Alexa and AI write to the default household, not the one shown.
- **Long names.** Every variant cuts them in the bar. Every sheet shows each name in full, wrapped and hyphenated over as many lines as needed. That includes the household chips and the "Listen in …" headings, and it was measured, not assumed.
- **Open question for Peter.** Should the sheet show households as chips or as rows?

## Verified

`node shoot.mjs <url> <out>` checks the following and fails on any miss:

- All six bars in the five scenarios at 390, 360 and 320 px, 100 and 130 % text, online and offline: Anpassen is present, no control sticks out of the phone or the bar, and there is no tabs row.
- The household is always shown in variants 1 to 4, and variant 5 shows it only with several households. "Shown" is measured: the name's visible glyphs must be at least as wide as its first two letters and an ellipsis in the same font. The visible width is the text box cut by every overflow or clip-path box above it. Each list needs one letter and an ellipsis.
- Every header is 68 px or less. Today's header is 120 px.
- Each of the five variants opens its sheet, switches the list and switches the household.
- After a switch, the notice keeps Siri, Alexa & KI on Trost, and the sheet's default row doesn't change.
- **Long names in the sheet.** These checks are new after review 0. Every page of every sheet is checked at 390 and 320 px, at 100 and 130 % text. The check fails when a text element, or any ancestor that hides overflow, is cut: `scrollWidth`/`scrollHeight` larger than the box with overflow hidden, an ellipsis or a line clamp. It also fails unless each of the three long names appears uncut in at least one element. On the old head (dbae4a42) the check reports 25 failures, the same cuts review 0 found. Now it passes.
- The bar-name table is measured too. `innerText` keeps CSS-cut text, so the check doesn't use it.
- Large text with the offline pill fits.

Result: "all checks passed", with no page errors, on the source and on the rebuilt `/tmp/dist205` (no 404s). The lint gate and gitleaks pass.

Review 0 nice-to-haves done:

- The single chip gives the list priority. Since review 1 the household really shrinks to a two-letter stub first. Even so, "Geburtstag" is cut at 390 px with 130 % text and offline, because the list alone doesn't fit.
- The fixed `max-width` limits on the bars are gone, which made no measured difference.
- Escape closes the sheet.
- The recommendation page now says "zwei Tipps".
- The static path is given as `build.sh <dir>`.
- Not done: accessible names with both full names in the bars. The sandbox doesn't need them, but production will.

Review 1 must-fix:

- `grid-390-offline-big.png` was taken at 320 px, because the script never switched back to 390 px. `shoot.mjs` now presses 390 px first. It asserts that the phone is 390 px wide and that `stacked-two-line` shows both names whole before it takes the shot.
- The committed image now shows "Trost / Geburtstag" whole in variants 2 and 5.

Review 1 nice-to-haves:

- `shoot.mjs` now produces `bars-130-offline.png`.
- Unselected household chips in the sheet draw their full hex outline.
- The breadcrumb's list crumb keeps at least 64 px, and the household crumb shrinks first.
- The notes give the small tap targets: breadcrumb 36 and 32 px, list-first tag 26 px, against 48 px recommended.
- The Current reference follows `HouseholdChip.widest`. The chip steps aside under 96 px (320 px, 130 % text, offline), and the pill drops its word while the chip's name is cut.
- The measured counts are unchanged: 8, 7, 4 and 4 of 12. `bar-names.tsv` is regenerated.
- Accessible names stay deferred to production.

Review 2 must-fix (job 205b):

- Review 1's fix let the breadcrumb's household crumb shrink to its 8 px padding. The old check read `innerText`, which keeps CSS-cut text, and never ran the bar with large text offline. The new measure, run in every scenario at 390, 360 and 320 px, reports 49 failures on head b0117a23. They fall in all five variants: breadcrumb 24, list-first 10, single chip 8, stacked 5, hide-when-solo 2. At 320 px, 130 % and offline, the other bars kept only one letter of "Trost".
- Every always-on variant now keeps a measured floor: two letters and "…" of the household, one letter and "…" of the list. Where that floor doesn't fit beside the offline icon and Anpassen, the switcher drops its chevron. It only happens offline. The breadcrumb does it at 320 px, and with long names and large text already at 360 px. The single chip does it at 320 px with large text or long names, list-first at 320 px with large text, and stacked only at 320 px with large text and long names (measured over all five scenarios at 390, 360 and 320 px). Once the single chip cuts its list, its household stays at the two-letter stub. The breadcrumb also drops its separator and slims its padding, and the single chip drops its dot. At that setting the breadcrumb reads "Tr… G…" (`docs/screenshots/205/bars-130-offline.png`). The empty spacer before Anpassen is gone. It cost an 8 px gap.
- Today's bar is exempt from the floors, because its chip steps aside under 96 px by design. The overflow check no longer counts hidden buttons.
- `bar-names.tsv`, `bars-130-offline.png` and the other changed screenshots are regenerated. The counts still read 8, 7, 4 and 4 of 12. One cell changed: the single chip keeps its list whole at 320 px, 100 %, online. The breadcrumb cuts its household in 8 of the 12 settings, and the notes in `variants.js` and `RECOMMENDATION.md` now say so.
- Inner review 1 (Opus, FIX): the breadcrumb card named the wrong condition for dropping the separator, and the PR body said every bar drops its chevron. Both now say where it happens. The check also runs at 360 px.
- Nice to have: the single chip's card says it gets only the width the sync icon and Anpassen leave. That is why "Geburtstag" is cut at 390 px with 130 % text and offline.

## Not done

There is no Flutter prototype route and no production header change, by design. The data is synthetic and the sandbox makes no backend calls.
