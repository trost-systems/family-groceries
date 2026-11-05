# Job 82: the hummlist.com waitlist (Spec #10)

PR: https://github.com/trost-systems/family-groceries/pull/210 (open, not merged: see
`docs/NEEDS_LEAD.md` "Job 82"). Design and routes: `docs/WAITLIST.md`.

## What was built

- **Site** (`site/`): a waitlist mode. Landing `/de` and `/en` with the form in the hero (email
  with the Apple ID / Google hint, iPhone or Android, optional unticked launch-news box, consent
  text under the button), an FAQ, and no link to or request for app.hummlist.com. Confirmation
  and unsubscribe pages act only when their button is pressed. `/support` becomes an FAQ page
  with support@hummlist.com. Legal's privacy-policy redlines sit in `::: waitlist` blocks. One
  script (`public/waitlist.js`), CSP unchanged.
- **Off in production**: the mode is on only for `HUMMLIST_WAITLIST=on` or non-production builds.
  `site/scripts/classic-diff.mjs` shows the classic production build equals main's, except a
  noindex meta line on `/de` and `/en` that replaces the header there. A production waitlist
  build fails while any `⟦…⟧` placeholder is left (AC21).
- **Vercel function** `site/api/waitlist*` (fra1): hashes the client IP with a daily key,
  forwards to the edge function with a shared secret and `x-region: eu-central-1`, 404 until
  configured, logs only outcome codes.
- **Edge function** `supabase/functions/waitlist`: validation, honeypot, a 3 s
  time-to-submit check, rate limits, double opt-in with hashed single-use 48 h tokens, the same
  answer and timing for new, known and dropped addresses, welcome mail with one-click unsubscribe,
  HMAC-signed unsubscribe links, Resend single sends without tags. Recipients are limited to
  `hello+…@hummlist.com` until `WAITLIST_MAIL_ALLOW=*`, and mails with placeholders are refused.
- **Database** (migration `20261102213606_waitlist.sql`): `waitlist`, `waitlist_consent_proof`,
  `waitlist_rate`, RLS on with no grants to anon or authenticated, service-only functions, daily
  `purge_waitlist` with Legal's periods (7 days, 3 months after the invite, 30 days after the
  launch mail, 2027-12-31, proof 3 years, counters 2 h).
- **Invites**: `scripts/waitlist/invite.ts`. A dry run prints counts, `--confirm <batch>` sends
  and writes the TestFlight/Play CSVs. Peter runs it, never automatically.
- **app.hummlist.com** gets `X-Robots-Tag: noindex` (it had none; AC15).

## How to verify

- `cd site && npm test` (126 tests, Node 22 and 24); `scripts/gates/site.sh`.
- `supabase test db` (waitlist.test.sql: 108 of 1812); `scripts/gates/functions.sh` (waitlist
  handler and mail tests, invite script tests); the integration test with `FG_DB_TEST=1`.
- Browser checks: `flock /tmp/fg-e2e.lock node site/checks/waitlist.mjs site/dist` (108 checks),
  crawl, contrast, Lighthouse (100 accessibility on /de and /en, mobile and desktop, light and
  dark).
- Full stack, local, driven 2026-11-03: Chromium against the site preview with the Vercel
  handlers, then the served edge function, the local database and a stand-in Resend. 16 checks
  passed: DE sign-up; the same address in other letters from EN gives the identical answer
  `202 {"status":"ok"}` and one row with locale de; one confirmation mail from „Peter von
  Hummlist“, no images, with confirm and delete links; opening the confirm link changes nothing,
  the button confirms, the same link again shows the neutral page; welcome mail with
  List-Unsubscribe and List-Unsubscribe-Post; the unsubscribe button deletes the row and leaves
  one proof record (HMAC only); EN sign-up mails from „Peter from Hummlist“, and RFC 8058
  one-click deletes; an invalid email gets 400 and no row; honeypot and too-fast get 202 and no
  row; the per-client rate limit answers 429; no cookies, no off-origin request, no console
  errors. Anon key: select, insert and RPC on the waitlist tables answer 42501. That run found
  a real bug: the plain-text footer put „:“ right after the unsubscribe URL. Fixed (`<url>`),
  with a test.
- CI: ci-ok green on the PR head (see PR).

## Screenshots

`docs/screenshots/82/`: landing DE/EN at 390 and 1440 px, form errors, success, confirm and
unsubscribe pages before and after, and the full-stack run (`e2e-*`).

## Missing or blocked

- Peter: Resend API key, Supabase secrets, Vercel env vars, then the fra1 proof with a logged-in
  request (NEEDS_PETER "Job 82"). Copy and legal texts await his approval; the markers block
  production until then.
- Lead: merge or wait (Legal's "no copy may be merged"), and the ambiguities in NEEDS_LEAD
  "Job 82".

## Review

An independent review (Sonnet) found one must-fix: rate counters could live about 24 h 24 min,
because the purge ran once a day. `waitlist_rate_hit` now deletes windows older than 2 hours
itself, with a pgTAP case. Should-fix items done: drafts are never mailed once
`WAITLIST_MAIL_ALLOW=*`; the time-to-submit floor is 1.5 s (was 3 s); 10 sign-ups per client per
hour (was 5), and IPv6 clients count as their /64; the doc now says the RFC 8058 URL carries id
and signature in its query. Left as is: the honeypot name `website` (it has `autocomplete=off`
and no report of autofill), and spreadsheet escaping in `ios.csv` (addresses go to TestFlight,
not a spreadsheet).

## Requeue 2026-11-04: Addenda 5 to 10

PR: https://github.com/trost-systems/family-groceries/pull/210 (open; Peter OKs the copy, Legal
reviews). Head `2d303956`, ci-ok green
(https://github.com/trost-systems/family-groceries/actions/runs/41772834136). Preview (Vercel
login): https://hummlist-site-git-job-82-waitlist-peter-trost.vercel.app/de

- **Addendum 5:** the heading „Eine Liste für alle“ / "One list for everyone" is now „Schnell
  eingetragen, schnell abgehakt“ / "Quick to add, quick to tick off"; „Jede Einladung gilt sieben
  Tage.“ / "Each invitation is valid for seven days." is gone from the landing page, and „7 Tage“ /
  "7 days" from the invite answer on /support.
- **Addendum 6:** „Die Adresse des MCP-Servers steht in der App unter Mehr › Zugänge …“ / "The MCP
  server's address is in the app under More › Connections …" is gone; „Dein Konto löschst du unter
  Mehr › Konto“ became „Dein Konto löschst du dort selbst, sofort.“
- **Addendum 7:** no month, date or „bald“/"soon" on the landing pages, their meta tags or the
  confirmation copy (the Siri card lost its „Bald“ chip and sentence; /support lost „die erste am
  15. November, danach jede Woche“; the changelog's empty state is timeless).
- **Addendum 8:** main's landing page with stage CTAs from `site/config/stage.ts` (`waitlist` now,
  `beta` and `launch` built and off); `/get`, official badges and a QR code for the launch stage.
- **Addendum 9:** CSP `form-action 'none'` → `form-action 'self'`, nothing else; a test asserts the
  whole header value in `vercel.json` and as served.
- **Addendum 10:** form text v2, confirmation-page consent v1 with the unticked launch-news box,
  confirmation mail v2, llms.txt L-1, privacy P-1/P-2, launch news only at the confirm press, the
  same 202 for every sign-up, no submitter logging, and every build fails on a placeholder.

Verified: site tests 149/149 on Node 22 and 24; `scripts/gates/site.sh`; job 93's site-agent checks
18/18 (consent byte for byte, pending 202); pgTAP 1843/1843; functions 627 passed; lint; browser
checks (flow 108 checks, crawl, contrast; Lighthouse accessibility 100 on /de and /en, mobile and
desktop, light and dark). Full stack locally (14 checks): sign-up from the header button, identical
202 for a duplicate, an API sign-up with `launch_news: true` stored false, confirmation mail M-1
without launch sentence, consent page with the box ticked storing `waitlist-confirm-de-v1` and
true, proof record with both versions, 12 rapid sign-ups all 202 with the rest dropped, logs with
outcome codes only, no cookies, no off-origin request, no console error.

Screenshots: `docs/screenshots/82/` (stage-*, landing-*, form-*, confirm-*, unsubscribe-*, e2e-*).

Still open: the fra1 region proof and the served CSP on the preview (it sends unauthenticated
requests to Vercel SSO; the CSP is proven on the local preview server), Peter's secrets and env
vars, Legal's points in NEEDS_LEAD "Job 82" (13 to 17 are new). Review fix: `supabase db lint`
flagged the unused `p_launch_news`; the new migration now reads it as `p_launch_news and false`.
