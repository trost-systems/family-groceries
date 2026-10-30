# Help page and legal links

The help and contact page lives on the guides site (`site/`, hummlist.com): `/support` (German)
and `/en/support`, from `site/content/legal/support.md` and `support-en.md`. Until Peter approves
the text both are drafts (`draft: true`): preview builds show them with an "ENTWURF" / "DRAFT"
banner and noindex, production builds leave them out (404). The app opens them from More →
"Hilfe & Kontakt". The privacy policy and its app links are job 33a/33b's; the imprint is
`sm-imprint` in `shell-more.md`.

## Sub-features

- `lg-help-row` More shows "Hilfe & Kontakt" / "Help & contact" (`more-help`, detail "Fragen,
  Anleitungen und unsere E-Mail-Adresse") under "Feedback senden" when the build shows drafts
  (`LEGAL_DRAFTS`, default on in debug; on in e2e) or the page is published
  (`supportPagePublished` in `app/lib/app/guides.dart`). Release builds hide it until then.
- `lg-help-open` a tap opens https://hummlist.com/support (German UI) or
  https://hummlist.com/en/support (any other language) in the system browser (a new tab on the
  web); the app stays on More.
- `lg-draft` a preview or local site build serves both pages with the banner, an HTML comment and
  `<meta name="robots" content="noindex">`; `VERCEL_ENV=production` builds answer 404 for both.

## Recipes

### Site (no app, no Supabase)

```bash
cd site && npm ci && npm test                       # draft.test.mjs proves lg-draft both ways
                                                    # consistency.test.mjs: app links are real files, publish switches agree
npm run build && PORT=55880 node scripts/preview.mjs   # open /support and /en/support: banner
VERCEL_ENV=production npm run build                  # restart preview: /support is 404
```

### App

`scripts/fg` (Linux debug build, LEGAL_DRAFTS on): `fg tap --key tab-more`, scroll the list
(`fg marionette -- scroll-to --key more-help` if a plain tap can't reach it), screenshot,
`fg tap --key more-help`. The URL goes to the system browser (xdg-open), not to an app screen, so
the app stays on More; `fg logs` shows the launch. On the web, `e2e/tests/help.spec.ts` clicks the row and
checks the new tab's URL for German and English, at 390 and 1366 px.
