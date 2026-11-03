# Job 83: waitlist landing variations V1–V5 (internal preview)

PR: https://github.com/trost-systems/family-groceries/pull/218 (preview only, not for merge).

## What was built

- `site/content/internal/waitlist-variations.yml`: Launch's draft copy (variations V1–V5, shared
  form and thank-you states, install FAQ), verbatim, with Addendum 2's new first sentence of V1's
  German founder note.
- `site/waitlist-variations.mjs`: renders the index and ten pages (five variants × DE/EN) from
  typed blocks in page order. `site/build.mjs` adds them to preview and local builds only.
- `site/public/internal/`: `waitlist.css` (job 82's form styles), `variations.css` (blocks, review
  chrome, V4's sort animation), `waitlist.js` (the mock form; no network).
- `site/checks/waitlist-variations.mjs`: the Chromium check. `site/test/waitlist-variations.test.mjs`:
  10 node tests.

## Where

Preview (Vercel login):
https://hummlist-site-git-job-83-waitlist-variations-peter-trost.vercel.app/internal/waitlist
Locally: `cd site && npm run build && npm run preview`, then http://127.0.0.1:55990/internal/waitlist.

## How to verify

- `cd site && npm test`: 108 pass.
- `cd site/checks && npm ci && flock /tmp/fg-e2e.lock node waitlist-variations.mjs ../dist --out /tmp/wv`:
  all 10 pages at 390 (light, dark) and 1440, mock states, zero requests, fold, axe, V4 order.
- `flock /tmp/fg-e2e.lock node crawl.mjs ../dist --pages /internal/waitlist,...`: CSP, focus,
  targets, press depth on all 11 pages.
- `VERCEL_ENV=production npm run build`: no `dist/internal`.

## Screenshots

`docs/screenshots/83/`: every variant at 390 (fold and full page) and 1440 (EN, full page),
V1's mock states, V4's animation frames, V2 in dark mode, the index.

## Missing or blocked

- The preview needs a Vercel login, so I could not open the deployed pages from the runner. The
  deploy status is green, and the same build was checked locally through `scripts/preview.mjs`,
  which applies vercel.json's headers.
- Open copy questions for Launch and Peter: docs/NEEDS_LEAD.md "Job 83".
