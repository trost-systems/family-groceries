# Job 88: an own store named like an offered chain ticks the chain

PR https://github.com/trost-systems/family-groceries/pull/214 (merges on lead review + green CI).

## What was built

- `app/lib/household/create_household_screen.dart`: „Eigenen Laden hinzufügen“ with a name whose
  key (trimmed, spacing collapsed, case folded) matches an offered chain adds the chain's own
  spelling. Its chip ticks and toggles as if tapped. A name already picked stays picked once.
- Server: unchanged. The unique index `stores_household_name_key` and `add_store`'s
  `on conflict do nothing` already guard every writer; `supabase/tests/stores.test.sql` covers it.
- e2e `chainStores` and three specs now name the store „EDEKA“ (it comes from the chip now).
- Docs: DECISIONS „Job 88“, verify-hummlist onboarding recipe + FEATURES-FOR-WRITERS,
  verify-family-groceries onboarding recipe, TEST_FIXTURES spelling.

## How to verify

- `cd app && flutter test test/household/onboarding_test.dart --plain-name 'offered chain'`
  (5 of 8 fail on the main before this PR, all pass with it).
- verify-hummlist on the web build: sign up a user without a household, „Haushalt erstellen“,
  „Eigenen Laden hinzufügen“, type „ edeka “, Enter: EDEKA is ticked, no extra chip; one tap
  unticks it; create: one store EDEKA (seed_key edeka) or none.

## Results

- Widget tests: 55/55 onboarding; `scripts/verify.sh --only lint,flutter` passed.
- Web build before/after journey: before reproduces the bug (unticked chip, first tap no-op,
  hidden store `Edeka`); after PASS. Screenshots in `docs/screenshots/88/`.

## Missing / blocked

Nothing. No Legal items (no new names, logos or colours shown).
