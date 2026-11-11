# Job 181: the product feature map in the repo, linked from Nexus (2026-11-11)

## What was built

- **New file.** [`docs/PRODUCT_FEATURE_MAP.md`](../PRODUCT_FEATURE_MAP.md) is the product candidate map. It covers what is built, built and gated off, planned, considering and dropped, the decisions in force and open, and a legacy ID table. It uses topic slugs, not codes. It is the lead's draft (copied to hz at 07:37) with one fact corrected. The draft said the code has no household cap, but job 173 has stopped a user at 10 since 9 Nov. The decision (20 per user) is unchanged.
- **Pointer files.**
  - `docs/FEATURE_MAP.md` gained a three-line pointer and otherwise remains the inventory.
  - `docs/PAYWALL_RELEASE.md` gained "Product prerequisites". Prices and trip total come before the sale, and shelf-label scanning must not delay it. The household limit of 20 per user (both tiers) is approved and not implemented. Per-user Premium, Lifetime at EUR 39.99 and a free Siri are approved but not yet in the checklist. No amount, switch or legal step changed.
  - `docs/DECISIONS.md` has a "Job 181" entry.
- **Nexus.** `nexus/web/index.html` and `nexus/web/styles.css` add the header links "Feature map" (to the GitHub blob on main) and "Living view" (to the Page). `nexus/README.md` mentions them.

## Where

- PR: https://github.com/trost-systems/family-groceries/pull/367. Merged 11 Nov 2026 08:44 Europe/Berlin under the Hetzner-only merge lock, because the Mac was unreachable. Commit on main: `c5d2d211`.
- Map on main: https://github.com/trost-systems/family-groceries/blob/main/docs/PRODUCT_FEATURE_MAP.md (HTTP 200 after the merge).

## Verification

- `scripts/verify.sh --only gitleaks,lint,nexus` passed (nexus: 38 tests). CI `ci-ok` passed on #367.
- I built Nexus locally (`publish.sh` without `--deploy`) and checked it with Playwright. The "Product" navigation has both links with the right hrefs at 1280 px and 390 px, in light and dark. The screenshots are in `docs/screenshots/job-181/`.
- An Opus review found no must-fix. Its two should-fix items, both about wording in the PAYWALL note, are applied.

## Nexus live status

The live Nexus does not show the links yet. The hz cron (`7 * * * *`, `nexus/scripts/cron.sh`) publishes once a night in the 03:00 hour Europe/Berlin, and today's publish already ran before the merge. The header should appear on the run at about 03:07 on 12 Nov 2026. No Vercel setting or authentication changed.

## Not done, by design

The household limit, prices and trip total, shelf-label scanning, paywall copy, store prices and legal texts are not implemented. #363 is untouched. Decisions that came in after this brief (Peter's 08:14 UI prototype gate; `planned-vs-bought`, job 188) are not in the repo map yet. Job 188 waits on this job and adds them.
