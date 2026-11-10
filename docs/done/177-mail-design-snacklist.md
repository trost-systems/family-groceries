# 177-mail-design-snacklist: the mail design system for Snacklist, around AL4 (2026-11-10)

PR: https://github.com/trost-systems/family-groceries/pull/362 (replaces #170, job 55). Not merged:
Peter reviews every mail first.

- **Built.** `emails/` (React Email, from #170) renamed to Snacklist. Each Supabase Auth mail is a
  German/English pair. `emails/scripts/build.tsx` joins both renders under AL4's `mail_locale`
  pick in `supabase/templates/*.html` and writes the subjects into `supabase/config.toml`; AL4's
  six subjects are unchanged byte for byte. The security notices got German drafts, and the
  notices got English twins. `supabase/deploy/auth_mail.ts` refuses draft lines. CI job `emails`
  is in `ci-ok`. `emails/` is a tsc project of the strict TS lint pack.
- **Verified.** `emails` tests 15/15 (AL4 wording in both languages, subjects, fallback structure,
  Legal footers); `supabase/deploy` 17/17; mutations of one word and of the branch order fail. Local
  GoTrue + Mailpit: de gets German, en/fr/none get English, the link, logo, CSS and footer intact.
  Read-only `auth_mail.ts --dry-run` on hosted: main is up to date (AL4 plain mails live), this
  branch changes only the six template bodies.
- **Previews.** `~/groceries-ops/jobs/177-mail-design-snacklist/previews/index.html` (every mail DE
  and EN, 2x PNGs, HTML, plain text; `mailpit/` holds the real GoTrue renders) and a 1x selection
  in `docs/screenshots/177-mail-design-snacklist/`.
- **Deploy.** Merging deploys no auth template. Going live is `supabase/deploy/auth_mail.ts`, run by
  hand after the merge (logo on snacklist.app) and after the draft reason lines are approved
  (docs/NEEDS_PETER.md, "Job 177").
- **Open.** Peter: approve the footers and the draft reason lines. Launch: the account-deletion
  body, the iPhone welcome. No onboarding sender, unsubscribe endpoint or consent record exists.
