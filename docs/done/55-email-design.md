# 55-email-design: the Hummlist mail design system (2026-11-01)

PR #170, not merged: Peter reviews every automated mail. Nothing was sent, and the hosted
Supabase project, Resend and DNS are unchanged.

What was built:

- `emails/`: a React Email package (exact versions, lockfile, no CLI or telemetry). The tokens are
  read from `design/tokens/hummlist.tokens.json`. Components: Header (app icon #5 PNG + live
  wordmark), Heading, Greeting, Paragraph, TextLink, Steps (2 to 4, typed), TipBox, CodeBox,
  PrimaryButton (48 px, VML for Outlook, raw link under it, one per mail), PhoneScreenshot
  (hummlist.com PNGs only, alt required), Signature, Draft, TransactionalFooter and
  OnboardingFooter (Legal Review N-15, DE and EN), `onboardingHeaders` (List-Unsubscribe, N-16).
  Layouts `AuthLayout` and `OnboardingLayout`. Light and dark, 600 px fluid, 375 px phones,
  plain text from the same render.
- The 13 mails Supabase Auth can send, restyled with the hosted wording word for word:
  `supabase/templates/<template>.html` and `.txt`, plus `subjects.json`. The invite template is
  labelled unused (Legal N-18). The local stack uses them (`supabase/config.toml`, a generated block).
- Onboarding: the tester welcome (Android, DE and EN) and the day-3 nudge (DE and EN) with Launch's
  wording, plus a "partner joined" notice, an account-deletion layout and a component catalog.
- Assets: `site/public/email/hummlist-icon-96.png` (from `design/app-icon/build.mjs`) and
  `site/public/email/demo-list-de.png` (demo screen from the homepage's add-tick scene).
- CI: the `emails` job (`scripts/gates/emails.sh`) runs when the mails' sources or outputs change,
  and `ci-ok` needs it. It runs type checks, `build --check` (drift, including leftover files) and
  14 unit tests.
- Docs: `docs/EMAIL.md`, `emails/README.md`, `emails/COPY_NEEDED.md`, DECISIONS "Job 55",
  NEEDS_PETER "Job 55: switch live templates".

How it was verified:

- `npm test` in `emails/`. The wording tests compare the auth mails with the hosted templates
  and the onboarding mails with Launch's drafts. A changed word fails them, and so do a changed
  Legal footer line and a leftover template file (each tried).
- Local stack: a magic link sent through GoTrue arrives in Mailpit with the new template, link
  intact. GoTrue's `html/template` strips HTML comments, so Outlook's MSO parts do not survive
  Supabase (documented).
- Local e2e (`auth`, `onboarding`, `id-token`): every spec that reads Mailpit passes, magic link
  and onboarding sign-ups included. The 7 specs that use the fake Google/Apple provider time out
  on the Hetzner runner because containers cannot reach host ports (shown with `wget` from the
  auth container); CI runs them.
- Previews: `docs/screenshots/55-email-design/` (1x) and `/workspace/hummlist/research/55-email-previews/` (2x).

Open: German auth wording, the draft reason lines, the deletion body (Launch,
`emails/COPY_NEEDED.md`); Peter's approval of the Legal footers and the live switch
(NEEDS_PETER); a sender for onboarding mails, the unsubscribe endpoint and consent storage
(Peter's decision, not built).
