# 169b: households, the invite loop and club features (2026-11-08)

Peter's Phase 2 decisions (2026-11-08) on the Phase 1 plan (`docs/households/PLAN.md`, draft #322):
HH3 in three waves, Premium per household (M-H1), reusable group links, a default household for
Siri, Alexa and AI, club features without club outreach. Each wave is its own PR, merged on an Opus
review PASS and `ci-ok`.

## Wave 1: several households (#327, merged as d43ba62c)

- A user can be in several households; one is the default (Siri, Alexa, AI assistants, old app
  versions). The household's name sits top left of the list and opens "Deine Haushalte" (switch,
  new household, join with a code, default for Siri, Alexa & KI). Joining adds a household.
- Household page under More: rename, members, default, leave.
- Server: one default per user kept by triggers and a per-user lock; old store builds see one
  membership; every single-membership read fixed; MCP `list_households` and a `household` argument;
  dictation in the household shown; a schema check stops new single-membership reads.
- Contract `docs/households/W1.md`; reviews `review-W1.1..4.md` in the job dir.

## Wave 2: the invite loop (#332)

- Static join page at `/join/<code>` (who invites to what, never item names), join in the browser,
  store links once the listings are public; group link with QR (50 people, 30 days, admins only),
  "Wer ist beigetreten"; roles Hauptadmin/Admin/member, remove members; share text by kind;
  "Einladung einfügen"; Play install referrer.
- Contract `docs/households/W2.md`.

## Wave 3: club features (#333)

- Several lists per household (tabs), "Ich bringe das" claims, join approval (on by default for
  clubs). MCP, API, Siri, Alexa and old app versions keep working (first list).
- Contract `docs/households/W3.md`.

## Not in the repo's merge path

- Privacy text and a draft data processing agreement for clubs: draft #328 for Legal (do not
  merge), 25 open questions in `docs/legal/169b-privacy-draft.md` on that branch.
- Store buttons and the Smart App Banner on the join page stay off until the App Store and Play
  listings are public (`storeListings` in `app/web/join/join.js`, `site/config/stores.mjs`).

## How to verify

- `scripts/verify.sh --only db,functions` (pgTAP `households_multi`, `households_invites`,
  `households_lists`, `households_claims`, `households_join_approval`, RLS cases, two-connection
  race tests in `supabase/functions/_shared/households_integration_test.ts`).
- `scripts/verify.sh --only e2e -- tests/households.spec.ts tests/invite-loop.spec.ts
  tests/join-page.spec.ts tests/club.spec.ts`.
- Feature map: `household-invites.md`, `lists-and-claims.md` and their sections in
  `FEATURES-FOR-WRITERS.md` under `.cursor/skills/verify-hummlist/features/`.
