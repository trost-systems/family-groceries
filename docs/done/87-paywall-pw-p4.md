# Job 87: PW-P4 „Haushalt“ as the real Hummlist Premium page (2026-11-03)

**Needs Legal Review sign-off before merge** (PR #217, NEEDS_LEAD "Job 87": every paywall string DE and EN,
questions Q1, Q3, Q4, Q6, the renewal price in the terms, Restore). The beta texts are Legal's final
texts (Peter, 2026-11-03 20:32), used verbatim.

## What was built

- `app/lib/purchases/premium_screen.dart`: the page at `/more/lifetime` in PW-P4's layout, on job
  43 and 49's real states. In every state it shows a hero: member hexes, „Einer kauft. Alle haben
  es.“, the household sentence and the benefits (Siri, AI assistants, and the API while the
  `public-api` flag is on). Under it come job 49's status lines and notes, unchanged. When the
  page offers a plan with its store price, the plans follow: two tiles side by side, yearly picked
  when the page opens. Each tile shows the store's price large, with „pro Jahr / einmalig inkl.
  MwSt.“ under it. Then the household binding line, one Buy button for the picked plan, that
  plan's terms, Restore, Terms and Privacy. The refund link stays at the bottom. A household with
  Premium sees a honey status card.
- `app/lib/purchases/premium_page_cubit.dart`: `PremiumPage.launch` (the switch as read) and `PremiumPage.picked` (the picked plan, so it survives scrolling). The page reads
  `premium_offer` in every build, so a promotional grant shows the approved beta title „In der Beta
  kostenlos freigeschaltet, bis Hummlist Premium startet“ while the switch is off.
- The web gets the same hero. Its note that Premium is bought in the iPhone or Android app shows
  only once sales start. It never shows a price, Buy or Restore.
- l10n: 9 new keys. `premiumBody`, `premiumYearlyPrice` and `premiumLifetimePrice` are gone.
  `publicApiFlag` moved to `analytics/flags.dart`.
- Tests: `test/purchases/premium_screen_test.dart` covers every offer state:
  - unknown
  - both plans
  - yearly only
  - N-53 with the define off and with the switch off: no price and no Buy
  - the beta text DE and EN
  - „Wird freigeschaltet …“
  - both two-purchases notes
  - the flag
  - 358 px at 130 % text

  `test/design/premium_golden_test.dart` has 10 goldens: offer DE and EN, light and dark; beta
  light and dark; web; compact; Lifetime picked DE and EN. `e2e/tests/purchases.spec.ts` checks
  the hero on the web, no price there, and a new beta-grant test.
- Docs: DECISIONS "Job 87", NEEDS_LEAD "Job 87", the feature maps (`verify-hummlist/features/premium.md`,
  FEATURES-FOR-WRITERS „Hummlist Premium“, `verify-family-groceries/features/purchases.md`).

## Review 0 fixes (Legal's final texts, 2026-11-03)

- A free unlock (promotional grant) shows one of three titles:
  - While `premium_offer` is off: „In der Beta kostenlos freigeschaltet, bis Hummlist Premium
    startet“ / "Free in the beta, until Hummlist Premium launches".
  - Once it is on: „Kostenlos freigeschaltet (Test und App-Prüfung)“ / "Unlocked free of charge
    (testing and app review)".
  - Until the switch is read: „Freigeschaltet“.

  Under every title: „Du zahlst nichts, und nichts verlängert sich automatisch. Bevor die
  kostenlose Freischaltung endet, sagen wir dir mindestens 4 Wochen vorher Bescheid.“ (EN as
  approved), and „Mehr dazu in der Datenschutzerklärung“, which links to `/datenschutz#premium-beta`
  (EN `/en/privacy#premium-beta`).
- Hidden before sales start: „bald verfügbar“ (`premiumComingSoon`, deleted), „… Danke!“
  (`premiumUnlockedBody`, deleted) and, on the web, „Hummlist Premium kaufst du in der iPhone- oder
  Android-App …“ (until `premium_offer` is on). The old „geschenkt“ lines are deleted.
- Tiles read „{period}, inkl. MwSt.“ (handoff 5(c)).
- Tests:
  - Widget tests for the beta strings, the link targets in DE and EN, the testers' line, the hidden
    texts, and the web before sales start.
  - New goldens `premium-beta-en-{light,dark}`; every premium golden regenerated.
  - e2e: `purchases.spec.ts`, `household-bound.spec.ts` and `premium-yearly.spec.ts` updated, 15 of 15
    pass on hz. On the web, the card's texts are their own semantics nodes, so the link next to them
    doesn't turn them into an aria-label only.

## Addendum 2: Legal Review N-67 to N-71 (2026-11-04)

- N-67: the AI line reads „KI-Assistenten, die MCP unterstützen, mit eurer Liste verbinden“ /
  "Connect AI assistants that support MCP to your list". No assistant brand is on the page.
- N-68: „Einer kauft. Alle haben es.“ shows only when `premium_offer` is on and the build sells,
  so never in the beta and never on the web.
- N-69: the refund link shows only once sales are on, or for a household that bought Lifetime
  twice.
- N-70: the grant picks the free-unlock line. No end or to 2100-01-01 (testers, app review) gives
  the tester line; any earlier end gives the beta line, whatever the switch says.
- N-71 (Addendum 3): the Siri line shows only with the build define `NATIVE_SIRI_LIVE` (the
  `native-siri` hold, via fastlane, identical to #224) and in the iPhone app. Today it is hidden
  everywhere.
- Tests: widget tests for each item, goldens regenerated. e2e `purchases`, `household-bound` and
  `premium-yearly` pass 15 of 15 on hz; the refund help is now reached by buying twice.
- The prices in the screenshots are test data from the fake store (N-72).

## How to verify

- `cd app && flutter test test/purchases test/design/premium_golden_test.dart`
- `scripts/verify.sh --only e2e -- tests/purchases.spec.ts` (4 pass on hz, 2026-11-03)
- Screenshots: `docs/screenshots/87/` (goldens and web build shots).

## Results

- `scripts/verify.sh --only gitleaks,lint,flutter,fg-cli` passed (all app tests).
- e2e `purchases.spec.ts` passed 4 of 4, twice (`--workers=1`, box e2e lock); after review 0, `purchases`, `household-bound` and `premium-yearly` passed 15 of 15.

## Not done or blocked

- Merge waits for Legal Review sign-off and the lead review. No flags, switches, defines, prices,
  store products or legal pages changed.
- Which free-unlock title shows when (beta vs testers/app review, by `premium_offer`) is my call; NEEDS_LEAD asks the lead to confirm.
- Real store purchases can't be driven here (no store sandbox). Job 86 (#213) recaptures the iOS
  review screenshot from this branch.
