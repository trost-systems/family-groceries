# Job 211: Premium pre-sales fixes from job 185's review

PR: https://github.com/trost-systems/snacklist/pull/406 (merged as 799f8ca5). Changelog `none`:
nothing is sold yet, so users see no change. `REVENUECAT_PURCHASES` and `premium_offer` were not
touched. No UI copy, legal text or store setup changed.

## The three gaps, each verified against the code first

1. **Double pay after leaving the last household: fixed.** `PurchaseCubit._userOf` mapped
   `NeedsHousehold` to no user, so leaving the only household reset a pending unlock and turned
   Buy back on. It now keeps the user id. Two cubit tests failed first (`FlowIdle` instead of
   `FlowUnlocking` / `FlowUnlockDelayed`) and pass now.
2. **Deleted households queued at RevenueCat although RevenueCat never saw them: fixed.**
   Migration `20261113155327_revenuecat_known_customers.sql` adds the marker
   `revenuecat_households`. `purchase_record` and `promotional_premium_sync` write it, and
   `household_deleted_purchases` queues only marked households. The migration also marks today's
   purchase and promotional households. Covered by pgTAP `revenuecat_known_customers.test.sql`.
3. **Account deletion racing a RevenueCat customer note: fixed.** `revenuecat_account_hold` takes
   a key share lock on the account, and a gone account queues its customer. It is called from a
   trigger on `revenuecat_customers` and from the webhook's two user paths. `delete_account` now
   takes `purchase_user_lock` first; review round 1 found the deadlock that line removes. The deno
   test `purchases/revenuecat_customers_integration_test.ts` runs in the db gate and covers 9
   interleavings. Each one failed before its fix, with `queued: false`, a foreign key error or
   `deadlock detected`.
4. **Wording: fixed, and backed by a lint.** The ast-grep rule `revenuecat-user-id-from-session`
   allows `RevenueCatUserId` in `app/lib` only inside `purchase_cubit.dart`. The `canOffer` and
   `yearlyBilled` comments were corrected, and the `no_household` label for ids that name nothing
   is documented in `store.ts`.

## Verification

- Local: `scripts/verify.sh --only db` passed on the final code, and `lint,functions,changelog`
  passed. `flutter test test/purchases` passed (+220) and `flutter analyze` is clean.
- CI: ci-ok green on a7daa180 and again on the merged head 81f64e60, including db, both e2e shards and ios.
- Opus reviews: round 0 FAIL (the lint missed `const`/`new`/`as`) and round 1 FAIL (the deadlock),
  both fixed. Round 2 PASS. Files: `review.inline.{0,1,2}.md` in this job's ops directory.
- supabase-deploy for the merge commit: success (run 43490808854: `applied 20261113155327_revenuecat_known_customers`, smoke test passed). A read-only query on production afterwards showed that `postgres` has UPDATE on `auth.users` (which `for key share` needs), that the lock trigger exists, and that 3 households were noted.
- No screenshots: no surface shows this while sales are off.

## Open

- NEEDS_PETER "Job 211". Ops makes a one-time check in RevenueCat for household customers whose
  promotional grant ended before the migration. They have nothing to mark, so their customers stay
  at RevenueCat if the household is deleted later.
- Round 2's nits: `promotional()` holds the per-user lock while it reads RevenueCat (up to 10 s),
  so an account deletion can wait that long. The `PromotionalOutcome` comment does not name the
  new migration. The lint does not catch generic casts such as `.cast<RevenueCatUserId>()`.
  This PR adds the first to DECISIONS "Job 211" and fixes the comment. The third stays as DECISIONS already words it.
- TestFlight: the next green main build carries the change. There is no flag, and nothing is
  visible until `REVENUECAT_PURCHASES` and `premium_offer` are on.
