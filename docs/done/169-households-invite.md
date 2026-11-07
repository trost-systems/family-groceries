# Job 169, Phase 1: households and the invite loop (plan, research, prototype)

Draft PR, not for merge: https://github.com/trost-systems/family-groceries/pull/322 (the `site`
gate fails on purpose for the internal page; every other gate is meant to pass).
Status: needs-lead. Phase 2 starts after Peter answers Q-HH1..Q-HH5.

## What was built

- `docs/households/PLAN.md`: 10-line summary, data model and migration, switcher S1/S2/S3, invite
  loop (moments 1-6, join page, deep links without a paid SDK, measuring), money options
  M-H1..M-H3, scope options HH1..HH3 with lane-days (6.5 / 14 / 24), recommendation HH2 + M-H1 in
  three waves, risks, questions Q-HH1..Q-HH5.
- `docs/households/research/`: code audit (file:line), invite loops, deep links and pricing (one
  URL per claim), the German clubs niche.
- `docs/households/proofs/old-app-policy.{sql,md}`: in a scratch Postgres, today's app query still
  returns exactly one household after the planned migration, and after the default membership ends
  (leave, deleted household) the `after delete` trigger hands the default to the oldest remaining
  membership.
- `site/public/internal/households.html` (+ `households/`): a clickable prototype, Peter and Mia
  side by side, DE/EN, light/dark. Preview (Vercel Authentication):
  https://hummlist-site-git-job-169-households-invite-peter-trost.vercel.app/internal/households
- Screenshots: `docs/screenshots/169/`.

## How to verify

- `node docs/done/169-shots.mjs`: serves `site/public` with the production CSP, drives the
  prototype, 25 checks, 0 console errors or CSP violations.
- `docker exec -i <pg> psql ... < docs/households/proofs/old-app-policy.sql` as in the proof's README.
- `scripts/verify.sh --only lint`: passes.

## Review 0 (FIX), addressed

1. Lint gate: the 12 `tool/lint/ts` findings in the prototype JS and the shots script are fixed;
   the lint gate passes locally.
2. Default household: PLAN section 2 now has the rule (an `after delete` trigger promotes the
   oldest remaining membership; the old `accept_invite` makes the joined household the default and
   refuses one the user is already in), the risk rows and the Phase 2 pgTAP list. The proof covers
   leave, cascade and last leave.
3. Second hop vs job 168: two hints for two audiences. 168's `second-household` (14 active days,
   creators) stays; 169 adds `own-household` (invitees with no household of their own, 2nd active
   day, under 168's hint rules). Posted on BOARD for 168.
Nice to have, all done: honest iOS paste wording (the prompt stays with a Flutter button), the
signed-out join page as a risk with a Legal step, M-H1's incentive qualified (Premium not on sale
yet), `list_repository`'s profile load and the old `accept_invite` refusal as risks, 25 checks.

## Review 1 (FIX), addressed

1. Old apps' `create_household` retries: the guard stays for calls without a request id; the new
   app sends one, and a unique index on (created_by, request_id) covers retries. Risk row and
   pgTAP case added.
2. Old `leave_current_household` and `unarchive_household` act on the default membership only
   (PLAN section 2 table, risk rows, pgTAP list).
3. Concurrent leaves: the trigger's subquery takes `for update`. `docs/households/proofs/concurrent-leave.sh`
   reproduces the loss (`3 default=f`) and the fix (`3 default=t`); the main proof's output is
   unchanged with the lock.
4. M-H1 now names the store limit (one store account unlocks one household) in its "Against" and
   in the summary's money line.
Nice to have: the BOARD failure count corrected (10 `site` failures, all from the internal page),
PLAN's header says the growth research was not available, the old-app fallbacks to the default are
named per function, the EN prototype's drinks row reads „6×". Job 168's plan still lists only
`second-household`; until 168 adds `own-household`, the two hint catalogues differ (lead note).

## Missing / blocked

- `growth-research-2026-11-06.md` still isn't on hz; when it arrives, compare the plan with it.
- Nothing for NEEDS_PETER: Phase 1 needs only Peter's answers.
