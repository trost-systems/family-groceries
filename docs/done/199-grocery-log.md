# Job 199: grocery log, G1 journal and G2 store timeline behind `grocery-log` (2026-11-13)

PR: https://github.com/trost-systems/snacklist/pull/394 (head a30a3678, `ci-ok` green). Merged 13 Nov 2026 10:49 Europe/Berlin as `e5d43316` on main (same tree as the reviewed head; Supabase deploy 43404474026 success, main CI 43404474129 success).
Flag: PostHog `grocery-log`; `releases/flags.json` rollout `off`. Changelog item `new`, `flag: grocery-log`.

## What was built

- **Verlauf tab** (between Liste and Mehr, only with the flag on; `/history` redirects to the list without it, and the flag turning off while the tab is open goes to the list).
- **Toggle (t828u).** One icon button at the top cycles G1 → G2 → G1: `app/lib/log/history_screen.dart:139` (key `log-view-toggle`). Kept per device (`DeviceCache` key `log.view`); default G1.
- **G1 journal** with "Diese Woche" / "Letzte Woche" / month sections, and a **compact month calendar in the G1 header**. Decision confirmed: neither G1 nor G2 had a calendar in the prototypes (only G4); Peter's Lidl×2 + Rewe×1 example is a month-grid pattern and a week strip hides older trips, so the month grid sits in the G1 header and G2 gets none (G2 trip rows keep date labels).
- **Calendar dots.** One overlapping round dot per trip in the store's colour, newest first and on top: `history_screen.dart:836` (dot keys `log-dot-<day>-<i>`). **Cap: at most 3** (`maxDayDots = 3`, `app/lib/log/model.dart:286`, applied at `model.dart:308`); 4, 5 or more trips still show exactly 3 dots. **No +N shipped** (t830u); the day's screen-reader label gives the real count. Store colours: stores have none, so a dot takes token palette slot `index mod 6` of the store's place in the household order (brand, tomato, mint, honey, success/warning light, cobalt/mintEdge dark); no store or a deleted store gets a neutral grey dot. Day tap filters the journal to that day (tap again or ✕ clears); future days are not buttons.
- **G2 store timeline.** One block per store in household order, trips by date inside, a + per store; deleted stores' trips keep their snapshot name.
- **Einkauf eintragen sheet** (store with nothing preselected and „Ohne Laden“ explicit, day not in the future, items with optional amounts, edit, delete; failures said inside the sheet). Empty history state without "kostenlos".
- **Post-shop card on the list** („Einkauf bei Lidl eintragen?“, Eintragen / Später).
- **Server** `supabase/migrations/20261113070349_grocery_log.sql`: `public.trips` (items as a JSON **snapshot** `{name, quantity, canonical_key}`, store name snapshot), `save_trip` (idempotent upsert by client id; one id per sheet and per list card), `delete_trip`, `trip_history`.
- **Flag targeting (t834u).** The app sends `is_internal` as a PostHog person property for flag evaluation only, so the flag can be released to internal installs.

## Peter's decisions as shipped (t830u: H2 to H4 confirmed, no longer provisional)

- **H1, 4-week Free cutoff:** Free browses trips with `shopped_on >= today - 27` (28 calendar days including today; today = the device's local date, clamped server-side to `current_date ± 1`). Enforced on the server (`trip_history`; direct `select` on `trips` revoked). **Older trips are retained** (no purge) and **visible with Premium**. The **job 185 entitlement path was reused**: `household_has_premium(p_household) or user_has_premium(auth.uid())`, the same rule as `integration_gate` (the Opus review showed per-user only would lock out household-bound Lifetime and tester grants). Locked periods: one quiet row („Ältere Einkäufe siehst du mit Snacklist Premium“ + count) at the end of G1 and G2, locked calendar days (muted, lock, no dots, not tappable) with the same hint under the month. The row opens the Premium page only where More lists Premium (`premiumListed()`), otherwise it is plain text; no new pricing copy, no „bald verfügbar“, no web buy line (job 87 rules). **Logging stays free and unlimited**, any past day. **A Premium history cap was built, at 4 weeks.**
- **H2:** the card appears once every open item of a store's section was ticked on this device; not on the first tick, not on `TripCompleted`, not on backgrounding; partner ticks never prompt.
- **H3:** one card and one trip per store.
- **H4:** trips deleted with the household (cascade); `logged_by` nulled on account deletion and on leave (`household_member_forget_user`); `trips_logged` in `export_my_data`; no time-based purge; not in realtime, not on the public API or MCP. Row in `docs/PRIVACY_DATA_MAP.md`. Art. 9 question for drugstore lines: `docs/NEEDS_PETER.md` "Job 199" item 2 (merge did not wait for Legal).
- **Snapshot verified** (pgTAP): re-adding a bought item updates the same `items` row to active and clears `bought_at`; ticking again sets a new one on the same row. The trip keeps its items through re-add, re-tick, rename and delete.

## Not built (as briefed)

No spend graphs, no prices or trip totals, no receipt scanning, no G3/G4/G5 as home. Sales and paywall copy untouched.

## Verification

- `flutter analyze` clean; `flutter test` full suite green (2794 passed, 92 skipped, before the last small round; `scripts/verify.sh --only lint,flutter` green after it); `scripts/verify.sh --only db` green (pgTAP: `grocery_log.test.sql` 51, `rls.test.sql` 110, `account_deletion.test.sql`; backup drill 55 tables).
- CI on a30a3678: every job green incl. e2e and `ci-ok`.
- Real web build with `FLAGS_ON=grocery-log`, verify-snacklist journey `grocery-log` (`.cursor/skills/verify-snacklist/journeys/grocery-log.mjs`): PASS in de, en, dark and 358 px. Evidence: `/workspace/hummlist/research/199-grocery-log-design-review/evidence/`. Screenshots: `docs/screenshots/199/` (embedded in the PR).
- Feature docs: `.cursor/skills/verify-snacklist/features/grocery-log.md`, FEATURES-FOR-WRITERS "Grocery log". Decisions: `docs/DECISIONS.md` "Job 199". Feature map: `docs/PRODUCT_FEATURE_MAP.md` (grocery log under Built, gated off; history beyond 4 weeks is Premium).
- Reviews: Opus review 0 FIX (household Premium; retry duplicate id) → fixed with tests; Opus re-review PASS; its should-fix (a second sheet from the card after a lost answer) also fixed.

## Preview / TestFlight (t834u)

No Vercel preview (Peter t834u). The TestFlight build that carries this is the next green `main` release run after the merge: **iOS TestFlight build 1270** (release run 43407286410 on e5d43316, `upload_to_testflight` succeeded 13 Nov 2026 ~11:21 Europe/Berlin; Android upload succeeded in the same run). To see it: create the PostHog flag `grocery-log` with release condition `is_internal = true` (NEEDS_PETER "Job 199" item 1), give the analytics yes and mark the install internal (long-press the version line under More), restart.

## Open / for Peter

- NEEDS_PETER "Job 199": create the flag (lead or Peter), Legal's Art. 9 question, copy check of the locked row before any public rollout.
- Job 190 also redefines `export_my_data` (BOARD 08:24); whoever lands second copies the other's body (posted on BOARD).
- Calendar paging and the journal are independent (paging to October does not scroll the journal); left as is.
