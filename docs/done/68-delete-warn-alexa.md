# Job 68: account deletion Premium warning, one read-back sentence per outcome (2026-11-02)

PR #191, merged 2026-11-02 (5946a665).

## Built

- **Account deletion and Hummlist Premium.** The last member of a household with Premium (Lifetime,
  a yearly plan or a promotional grant) sees a red card in the deletion dialog: what ends, why
  archiving isn't offered there, how to keep the household (invite someone first), the refund help
  link, and a box „Ich habe verstanden: Hummlist Premium endet und wird nicht automatisch
  erstattet.“ that „Endgültig löschen“ waits for. Households the user archived are named, since
  they go with the account; one with Premium asks for the same tick. DE and EN.
  - Shown with job 43's `HOUSEHOLD_ARCHIVE` define or once the `premium_offer` switch is on;
    both are off in releases, so today's apps show the dialog as before.
  - Server: `public.leaves_unlocked()` (migration `20261102091002_leaves_unlocked.sql`), pgTAP
    `supabase/tests/leaves_unlocked.test.sql`. App: `AccountFate` in
    `app/lib/settings/account_repository.dart`, `app/lib/settings/delete_account_dialog.dart`.
  - Decided: deleting the account never archives; archived households go with the account
    (DECISIONS "Job 68", NEEDS_LEAD "Job 68" for Legal Review).
- **Alexa read-back.** One sentence per outcome: „Ich habe Karotten und Mohrrüben auf die
  Hummlist gesetzt. Schon auf der Hummlist: Milch und Möhren.“ (was „… sind auf der Hummlist. …
  Möhren steht schon auf der Hummlist.“). Siri's voice function the same in German and English.
- **Onboarding hint.** „Du kannst sie später unter Mehr → Läden anlegen.“ / "You can add them later
  under More → Stores." (Mehr → Läden has „Neuer Laden“ since job 58).
- Docs: DECISIONS, NEEDS_LEAD, ALEXA.md, SIRI_SHORTCUT.md, the Alexa guide on the site, feature
  files (account-deletion, onboarding, alexa, siri, voice) and FEATURES-FOR-WRITERS.

## Verify

- `cd app && flutter test test/settings test/household` (10 new dialog tests, mutation-checked:
  ignoring the tick fails them).
- `supabase test db supabase/tests/leaves_unlocked.test.sql` (14 assertions).
- `scripts/verify.sh --only lint,site,functions,db` green on hz.
- `scripts/verify.sh --only e2e -- tests/household-bound.spec.ts tests/alexa.spec.ts` green on
  hz; the new e2e case is "account deletion: the last member of an unlocked household confirms
  that Premium is not refunded". Screenshots in `docs/screenshots/68/`.

## Not proven / open

- The fake-OIDC sign-in specs (onboarding AC6 Google/Apple) time out on hz as always (hz
  containers can't reach host ports); CI runs them.
- Nothing flipped. The four new strings wait for Legal Review (NEEDS_LEAD "Job 68").
