# Job 72: Alexa link data cleanup (Legal N-24, N-28) and fact answers

Branch `job/72-alexa-data-cleanup`, runner hz (ports 582xx, project `family-groceries-72`).
PR #195, merged 2026-11-02 (53d107d5). Nothing applied to the hosted project, no flags flipped, site legal texts
untouched.

## What was built

- `supabase/migrations/20261102093000_alexa_cleanup.sql`
  - Trigger `alexa_sessions_deleted` (after delete on `auth.sessions`, per statement): a gone
    session takes its `alexa_links` rows, and the user's last link takes the `alexa_rate`
    counter, in the same transaction. Covers "Amazon Alexa trennen" (GoTrue deletes the client's
    sessions), SkillDisabled, linking again, sign-out everywhere, account deletion.
  - `alexa_revoke` (SkillDisabled) now also deletes Amazon's grant in `auth.oauth_consents` once
    the user holds no other Alexa session, so Zugänge no longer lists "Amazon Alexa". Before,
    the entry stayed although it no longer worked.
  - `purge_alexa()` daily (pg_cron `purge-alexa`, 03:29 UTC): Alexa sessions unused for 12
    months (`last_seen`, `refreshed_at`, `updated_at`, `created_at`), links whose session is
    gone, counters of a past minute, revoked Alexa grants and Alexa grants with no session left
    (a day's grace, and none while a link is in progress).
  - `alexa_client_ids()`: the Alexa client by its Amazon redirect URIs, not by its name.
- Tests: `supabase/tests/alexa.test.sql` (64 cases, 31 new); `e2e/tests/alexa.spec.ts` checks
  the link and counter rows after "trennen" and after SkillDisabled, and Zugänge after
  SkillDisabled. One pre-existing pgTAP tie fixed (DECISIONS Job 72.6).
- Docs: `docs/ALEXA.md` "What is kept, and for how long"; `docs/DECISIONS.md` Job 72;
  `docs/NEEDS_LEAD.md` Job 72 with the answers to Legal Review's fact questions 3, 4, 5, 6 and
  9; feature map `alexa.md` and FEATURES-FOR-WRITERS.

## Fix round 1 (review 0)

- **ADDENDUM 1, Alexa stays free (N-27).** The alexa function no longer asks the integration
  lock (`requirePremium`, `speech.premium`/`premiumAdd` removed). The new migration
  `20261102120000_alexa_free.sql` makes `integration_gate` answer `alexa` open even with
  `integration_lock` on. `integration_blocked` no longer allows `alexa`. The app's ARB copy
  follows section 7 exactly (`integrationPremiumAlexa` removed), the Premium card has no Alexa
  line, and the Amazon Alexa tile in Zugänge never shows as paused. Docs: PAYWALL_RELEASE,
  PURCHASES, ALEXA, ANALYTICS, and the feature map (premium, more-help, FEATURES-FOR-WRITERS).
- **ADDENDUM 2, proof.** pgTAP covers a user whose only Alexa session went unused for 12
  months: the session, the link, the grant (the Zugänge entry) and the counter all go in one
  `purge_alexa()` run.
- **Nice to have.** The pgTAP suite checks each Amazon redirect host, and the migration comment
  points at `scripts/alexa-oauth-client.sh`.
- **Proof.**
  - pgTAP: `alexa.test.sql` (69) and `integration_lock.test.sql` (36).
  - Functions: `premium_integration_test.ts` shows Alexa adding with the switch on, before a
    plan and after its lapse.
  - App: `flutter test` 1532 passed; new tests check that Alexa never appears paused and that
    the Premium page doesn't mention Alexa.
  - e2e: `integration-lock.spec.ts` 3/3, `alexa.spec.ts` 3/3, `purchases.spec.ts` 3/3.

## Fact answers (short; evidence in NEEDS_LEAD and `docs/screenshots/72/hosted-evidence.txt`)

3. Amazon's requests run in eu-west-1 (Ireland); the database is eu-central-1.
   `forceFunctionRegion` would not affect signature verification (body and headers only); the
   console's acceptance of a query string is untested (needs the ASK login).
4. `last_seen` moves on every request with an accepted token (launch, add, read, also when
   locked) and on SkillAccountLinked; not on help, stop, fallback, an add with nothing
   understood, or a refused token.
5. Before this job the grant stayed after SkillDisabled, without expiry. Now it is deleted
   right away; GoTrue's "trennen" leaves a revoked record that the daily job deletes.
6. Unlimited locally and live (timebox and inactivity timeout 0); refresh tokens rotate. Alexa
   sessions now end after 12 months unused.
9. The skill was deployed from skill.json; job 31b's manifest read matches the privacy URL. A
   full comparison needs the box's ASK login: command in NEEDS_LEAD.

## How to verify

```bash
scripts/verify.sh --only db                       # pgTAP incl. alexa.test.sql (64)
scripts/verify.sh --only e2e -- tests/alexa.spec.ts
```

## Results

- Local on hz: gitleaks, lint, changelog, db (1587 pgTAP across 30 files, store integration),
  functions: passed. e2e `tests/alexa.spec.ts`: 3 passed (real GoTrue grant revocation and
  SkillDisabled).
- Independent review (read-only, rolled-back transactions): no defects; two concerns fixed
  (links of a still-refreshed session, a grant reused for a link in progress).
- Screenshots: `docs/screenshots/72/alexa-03-zugaenge-alexa.png` (before "trennen"),
  `alexa-05-zugaenge-after-skill-disabled.png` (Zugänge empty after SkillDisabled).

## Open

- Question 9's console read needs the box (ASK login).
- Whether the Alexa console accepts `?forceFunctionRegion=` in the endpoint URI (untested,
  endpoint unchanged as briefed).
- The legal texts (variant A, with the 12-month sentence) wait for Peter's approval.
