# Job 200: the household cap is 20 per user (2026-11-11)

PR [#375](https://github.com/trost-systems/family-groceries/pull/375). Started 11 Nov 2026 22:39
Europe/Berlin on the Hetzner runner.

## What was built

- **Cap behaviour.** A user is in at most 20 households, on Free and on Premium (`household-limit`).
  At 20 the database refuses every way in with `too_many_households`. That covers creating a
  household, joining with an invite (new and old builds), filing a join request, an admin's
  approval (the request closes as cancelled), restoring an archived household, and a direct
  membership insert. Job 173 already enforced a cap of 10 on all of these. Migration
  `20261111214106_household_cap_twenty.sql` moves the number to `public.household_cap()` (20).
  The triggers, `create_household` and `decide_join_request` all read it. The cap is keyed by
  the Snacklist user id and has no Premium check.
- **App.** The existing refusal text now says 20: „Du bist schon in 20 Haushalten. Verlasse
  einen, bevor du einen neuen anlegst oder beitrittst.“ / "You are in 20 households already.
  Leave one before you create or join another." There is no new UI, no paywall change and no
  flag. Old store builds show 10 in that sentence until they update, and they still refuse
  correctly.
- **Docs.** DECISIONS (job 200), PRODUCT_FEATURE_MAP and PAYWALL_RELEASE (the cap is now
  implemented; the paywall and terms copy stays with job 187), and the feature map
  (`household-invites.md` sub-feature `household-cap`, FEATURES-FOR-WRITERS).

## Existing members over 20

None. A read-only production query at 11 Nov 2026 22:43 Europe/Berlin found 67 users with a
membership. Nobody is in more than 2 households, so nobody is above 10 or 20.

## How to verify

- `supabase test db supabase/tests/households_join_cap.test.sql` and `households_multi.test.sql`
  pass. With `household_cap()` set to 10 or to 21, both fail. The full db gate passed 2506 tests.
- Opus review (read-only, independent): PASS. Its small leftovers (an old recipe line, the test
  fake still refusing at 10, test titles) are fixed in the PR.
- `.cursor/skills/verify-snacklist/helpers/launch.sh`, then
  `node .cursor/skills/verify-snacklist/journeys/household-cap.mjs <dir> [--lang en]`. It passed in
  DE and EN. Screenshots are in `docs/screenshots/200/`.

## Scope kept

This job did not wait on job 190 and did not change paywall UI or copy. It did not touch job 182,
PR #363, the stores or store prices, and it did not resolve shared-views.
