# Job 206: joining only from the list's household sheet (2026-11-13)

Peter (t820u, 12 Nov 2026): More no longer offers „Anderem Haushalt beitreten“ / "Join another
household"; joining happens through the household button on the list. Merged as `364ad5df` (PR
[#402](https://github.com/trost-systems/snacklist/pull/402)). It reaches TestFlight and Play
internal with the next green `main` build; no flag.

## What changed for users

- More's household group is the household's name, „Partner einladen“ (and „Archivierte
  Haushalte“ where the archive is on). No join row.
- Joining from a household: tap the household's name top left of the list, „Mit Code
  beitreten“, enter the code. Back, „Abbrechen“ and Android's back return to the list.
- Invite links, typed codes and deep links work as before: `/join/<code>`, `?invite=`, the
  install referrer and pasted links all go to the join screen, signed in, without a household,
  or after sign-in. An old `/more/join` link lands on `/join`.
- Android's back on the join screen and „Neuer Haushalt“ (and every onboarding-style page) runs
  the page's back action: before, on the join screen and „Neuer Haushalt“ it closed the app; in
  the guided start it jumped to the start screen instead of one step back.

## Where

- Row removed: `app/lib/more/more_screen.dart` (`_Item.join`, its group entry and row).
- Sheet: `app/lib/household/household_switcher.dart` („Mit Code beitreten“ → `joinCodePath`).
- Old link: `app/lib/app/router.dart` (`moreJoinPath` documented as an old link, kept in
  `inMoreTab` so `authRedirect` lets it through, route redirect to `/join`).
- Android back: `app/lib/household/onboarding_page.dart` (`PopScope` running `onBack`).
- String `joinOtherHousehold` removed from both ARBs; `joinWithCode` stays.
- Docs: `docs/DECISIONS.md` (Job 206), verify-snacklist `household-invites.md`, `more-help.md`,
  `app-links.md`, `onboarding.md`, `FEATURES-FOR-WRITERS.md`; verify-family-groceries
  `SKILL.md`, `household.md`, `shell-more.md`; the support FAQ (de, en).

## How it was verified

- New verify-snacklist journey `journeys/household-join-paths.mjs` on the release web build,
  German and English, both PASS: the sheet's „Mit Code beitreten“ opens `/join`, Abbrechen back
  to `/`; More's ARIA tree top to end has no join entry; `/more/join` → `/join`; a typed code
  joins (old household kept); a `/join/<code>` link joins signed in; signed out the link leads to
  `/login?invite=…`, sign-in, the prefilled join screen, joined (database checked). Evidence:
  `docs/screenshots/206/`.
- Widget tests: navigation (sheet → join → back to the list; system back on join and Neuer
  Haushalt; old `/more/join`), More menu (no join row), switcher, guided start (system back one
  step), regenerated More goldens. The system-back tests fail on the old `OnboardingPage`.
- Local gates: lint, changelog, site, flutter, and e2e for shell-more, live-sync, purchases
  (18 passed). CI `ci-ok` green on the PR head 41ad2d89, merged to main as 364ad5df.
- Opus review: FIX (Android back closed the app from `/join`), fixed; re-review FIX on the
  changelog wording for the guided start, fixed.

## Not done

- Without a household, a signed-out `/more/join` link carries `next=/more/join` through sign-in,
  so after joining via the welcome screen the join screen shows once more. Same as before this
  job; left alone (an old link that no current build produces).
