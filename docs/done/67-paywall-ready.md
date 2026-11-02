# Job 67: paywall release readiness (2026-11-02)

PR #187, not merged (review, then the Lead lands it). No switch was flipped, no product created,
no price changed, nothing submitted or bought.

## What was built

- **The go-live checklist**, `docs/PAYWALL_RELEASE.md`: the ordered steps with an owner each,
  from accounts and store products to RevenueCat, the legal texts (#153), the sale, the App Store
  review and the integration lock, plus what to watch and how to roll back.
- **Audit with every flag on locally, and fixes.** Thirteen bugs, each with a test that failed on
  the old code (the table in the PR). The ones a buyer would have hit first: a failed renewal
  ended Premium on day one of the grace period (SQL, `20261102001623_premium_grace_kept.sql`); a
  restore of a lapsed plan blocked Buy until the app restarted; offline, the page said "bald
  verfügbar".
- **Store builds read the Premium switches from the release environment**: Fastfile
  `PREMIUM_DEFINES`, `release.yml` variables `REVENUECAT_PURCHASES` and `INTEGRATION_LOCK` and
  secrets `REVENUECAT_APPLE_API_KEY` and `REVENUECAT_GOOGLE_API_KEY`, and `INTEGRATION_LOCK` for
  the web in `scripts/vercel.sh`. All are unset.
- **Changelog**: the held items for this PR (`hold: premium-launch`, `hold: integration-lock`), and
  `changelog.mjs check` now lets an item with a closed hold of its own name another hold's word.
- **PR #153** rebased onto main (6e0fdbd), green and not merged; the body explains the merge.
- **Gaps for Legal Review**: listed in the PR body.

## How it was verified

- Premium e2e on the local stack (Hetzner, ports 567xx): purchases, premium-yearly and
  household-bound, 13/13 before and after the fixes; integration-lock, 3/3 after.
- The real app (Linux debug build, fake store, both server switches on, `INTEGRATION_LOCK`), two
  clients peter and lea: the offer, the locked Zugänge card, buy yearly (lea's card went 438 ms
  later), BILLING_ISSUE plus CANCELLATION (`BILLING_ERROR`) kept Premium to the grace end 14 days
  ahead, EXPIRATION back to the offer on both clients live, offline "gerade nicht verfügbar".
  Screenshots: `docs/screenshots/67/`.
- Local gates: lint, functions (513 passed), db (pgTAP 1556), `flutter analyze` clean, `flutter
  test` 1447 passed, release script tests. CI on the PR: see the PR's checks.

## Missing or blocked

- Real store purchases and prices (sandbox on a phone): PAYWALL_RELEASE.md 5.3, Peter and the Lead.
- Everything with "Peter's yes" in PAYWALL_RELEASE.md, the legal texts (Legal Review), the
  placeholder copy (Launch), and a public release path for the stores (its own job).
- The app-resume refresh (one line in `app.dart`) has no test: no test builds `App`.
