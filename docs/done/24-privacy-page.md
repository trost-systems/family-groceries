# Job 24: help and contact page (draft) and the privacy data map

PR: https://github.com/trost-systems/family-groceries/pull/117 (2026-10-30, Mac runner).

## Scope

The brief was written before three later rulings: 24a built the guides site (`site/`, live on
hummlist.com), and on 2026-10-30 the Lead gave the privacy policy to 33a (#105) and the in-app
privacy links (login footer, consent link, More → Datenschutz) to 33b (#107). All three (and 33c)
landed while this job ran; it rebased onto them. Job 24 built what was left: the help and
contact page, its More entry, the data map, and the steps for Peter and the Lead
(docs/DECISIONS.md, "Job 24").

## What was built

- **Help and contact page** on the guides site: `/support` (German) and `/en/support`, from
  `site/content/legal/support.md` and `support-en.md`. What Hummlist is, how to get help (in-app
  "Feedback senden", support@hummlist.com), links to the Impressum and the privacy policy, and an
  FAQ: invite a partner, join with a code, export data, delete the account (incl. the 90-day
  backups), turn off usage data, Siri, AI assistants via MCP, TestFlight/Play testing. Every UI
  path matches the ARB labels on main.
- **Unpublished draft:** new optional frontmatter `draft: true` in `site/build.mjs`. Preview and
  local builds show the page with a banner ("ENTWURF: Freigabe durch Peter" / "DRAFT: pending
  Peter's approval"), the same text in an HTML comment and `meta robots noindex` (plus the
  site-wide `X-Robots-Tag: noindex`). Vercel production builds leave drafts out, so
  hummlist.com/support stays a 404 until Peter's OK. A footer link to a draft fails the
  production build.
- **More → "Hilfe & Kontakt" / "Help & contact"** (`more-help`, under "Feedback senden"): opens
  `supportUrl(language)` in the system browser (33b's `openLegalPage`). Shown when
  `supportPagePublished` (`app/lib/app/guides.dart`, false) or `Environment.legalDrafts`
  (`LEGAL_DRAFTS`, default `kDebugMode`; on in `app/config/e2e.json`). Release builds hide it
  until publishing.
- **`docs/PRIVACY_DATA_MAP.md`:** each data item with storage, purpose, legal basis, retention,
  processor/region, deletion path and source file; processors, deletion/export, "not collected".
  Source for job 14's App Privacy label and Play data safety form.
- **Stale directions fixed:** "Menü (⋮) → Zugänge" → "Mehr → Zugänge" in the Siri guide,
  `docs/SIRI_SHORTCUT.md` and the voice function's 401 text (and its e2e assertion).
- Docs: `site/README.md` (Drafts), DECISIONS "Job 24", NEEDS_PETER "Job 24", NEEDS_LEAD "Job 24"
  (Support URL in App Store Connect, contact details in Play), verify skill
  `features/legal.md` and `sm-help` in `features/shell-more.md`.

## How to verify

```bash
cd site && npm ci && npm test        # 48 tests; draft.test.mjs: preview 200 + banner + noindex, production 404
npm run build && PORT=55880 node scripts/preview.mjs   # /support and /en/support with the banner
cd ../app && flutter test test/more/more_screen_test.dart   # DE/EN URL, external mode, hidden as in release
```

e2e `e2e/tests/help.spec.ts`: signs up, opens More, checks the row and that a click opens
https://hummlist.com/support (German) and /en/support (English, after switching the language) in
a new tab while the app stays on More, at 390 and 1366 px.

## Test results

- `site` gate: 48/48 (8 new for drafts; removing the production filter fails 3 of them).
- `flutter analyze --fatal-infos`: no issues. `flutter test`: 823 passed (831 on main after the rebases, per the review).
- `scripts/lint.sh`: ok. gitleaks: no leaks. `deno test supabase/functions/voice`: 211 passed.
- axe (WCAG 2.1 A/AA) on both pages, light and dark: 0 violations. 320, 390 and 1366 px: no
  horizontal scroll. html-validate: valid except `doctype-style` (the site's lowercase doctype).
- Lighthouse 12 (mobile) on the local preview build, fix 1: Performance 100, Accessibility 100,
  Best Practices 100 on `/support` and `/en/support`; SEO 63 only because of the intended noindex.
- CI: `ci-ok` green on 40098e0 (the merged head adds only the rebase onto 33e/33f and doc updates; merge-pr.sh waited for `ci-ok` on it too): https://github.com/trost-systems/family-groceries/actions/runs/41063087267. Earlier runs failed in my new spec (the 60 s timeout, then a wait for a tab bar that the 1366 px rail doesn't have, both fixed) and once in `list-header.spec` (the add-sheet focus flake on main, which passed on the next run).

## Screenshots

`docs/screenshots/job-24/`: `site-preview-support-390.png`, `site-preview-support-1366.png`,
`site-preview-en-support-390.png`, `site-preview-en-support-1366.png` (draft banner),
`site-prod-support-390.png`, `site-prod-en-support-1366.png` (production build: 404),
`app-more-help-{de,en}-{390,1366}.png` (More with the new row, from the CI e2e run).

## For Peter (NEEDS_PETER "Job 24") and the Lead (NEEDS_LEAD "Job 24")

- Peter: approve the DE+EN text; keep support@hummlist.com or name another address; OK to
  publish (remove `draft: true` from both files, `supportPublished: true`,
  `supportPagePublished = true`). Not legal advice; optionally a lawyer check.
- Lead: send Peter the hummlist-site preview of this PR; after publishing set the App Store
  Connect Support URL and the Play store contact details (exact clicks in NEEDS_LEAD).
- Job 25: the data map's in-app purchase row is the planned design (only the verified
  entitlement stored); update it with the real one.

## Fix 1 (review 0, follow-up PR)

- **Deletion link on the help page** pointed at `https://app.hummlist.com/konto-loeschen`; the
  app host has `cleanUrls: false` and answers that path with the Flutter app (checked live: title
  "Hummlist", while `/konto-loeschen.html` is "Hummlist: Konto und Daten löschen"). Both pages now
  link `/konto-loeschen.html`, like the policy. New `site/test/consistency.test.mjs`: every
  `app.hummlist.com/<path>` link in `site/content` must be a file in `app/web`.
- **Publish flags pinned:** the same test fails unless `draft: true` in `support.md` and
  `support-en.md`, `supportPublished` in `site/config.json` and `supportPagePublished` in
  `app/lib/app/guides.dart` agree, so a half-publish can't land. Both new checks fail when
  their defect is put back (checked).
- **Data map current:** 33b's install-id handling (merged, no longer "open PR"), the differences
  section names the policy itself, Anysphere removed after 33g, 32b's `item_merges` added (30 days), written against `main`
  0b47f91.
- **Alexa in the FAQ** (DE+EN): enable and link the skill, two example phrases, unlink in the
  Alexa app or under Mehr → Zugänge, still in testing.
- NEEDS_PETER "Job 24": the data map has no open `[PETER: …]` items any more.
