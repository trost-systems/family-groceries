# Job 33a: privacy policy on hummlist.com, corrected deletion page

PR #105, ready; Peter approved the wording 2026-10-30 07:51, the lead merges (labels `needs-peter-legal-ok`,
`do-not-merge`). Decisions: DECISIONS "Job 33a". Peter's steps: NEEDS_PETER
"Job 33a".

## What was built

- `site/content/legal/datenschutz.md` (`/datenschutz`, German, authoritative)
  and `privacy.md` (`/en/privacy`): the legal review's §B.1 and §B.2 with the
  fact fixes from the engineering answers. `/privacy` redirects to
  `/en/privacy`. Section 15 carries `#rechte` / `#rights` (a `{#id}` heading
  rule in `site/build.mjs`).
- Footer flags `privacyPublished` (on) and `supportPublished` (off) replace
  `legalPublished`.
- `app/web/konto-loeschen.html`: H-06 redlines, `support@hummlist.com`
  (H-19), a link to the policy; ENTWURF banner and noindex removed (Peter
  approved the wording 07:51).
- §3 uses the interim gstatic sentence until job 33c swaps it back; "Stand:
  30. Oktober 2026".
- H-05: edge-function and app error reports reduce a runtime error's message
  to its shape (template words kept, other words `<w>`, numbers `<n>`, 120
  characters), with tests that no personal value reaches PostHog.
- The site CI gate builds in preview mode; Vercel's production build still
  fails while a `[PETER: …]` is left (DECISIONS 33a 4).

## How to verify

- `cd site && npm test && npm run build`; `VERCEL_ENV=production npm run
  build` fails listing the placeholders.
- `PORT=56380 npm run preview`, then curl `/datenschutz`, `/en/privacy`
  (200), `/privacy` (308 to `/en/privacy`); every response has
  `X-Robots-Tag: noindex`.
- `cd supabase/functions && deno test -A _shared/telemetry_test.ts`;
  `cd app && flutter test test/analytics/`.
- Screenshots: `docs/screenshots/33a/`.

## Open

- The `[PETER: …]` placeholders (PR body lists them with questions).
  Merging does not publish hummlist.com until they are filled.
- Merge after job 33b (install id only after consent, H-08). No wait for 33c:
  §3 has the interim sentence, 33c swaps it back.
- Feedback paragraph once job 21 lands (12-month purge).
- Follow-ups for Peter: H-11 backups off the public repo, H-12 item_events
  retention cron, H-14 Play payments address 7 to 5 and USt-IdNr, H-17 MCP
  consent text, store consoles' privacy URL, pinning functions to
  eu-central-1.
