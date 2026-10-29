# web-release-align: web production follows the store release (2026-10-29)

What changed:

- `release.yml` has a `Web production` job. After a real store upload
  (`Uploaded` green) it fast-forwards the `release` branch to the shipped
  commit. Vercel's production branch is `release`, so that build lands on
  `https://app.hummlist.com`. A failure of the job is reported like the other
  release jobs (`scripts/release/report.sh`, tests in `scripts/release/test.sh`).
- `main` builds as a preview on `https://preview.app.hummlist.com`, behind
  Vercel Authentication (Standard Protection, unchanged).
- Docs: `DEPLOY.md` section "Web app" (flow, manual ship, rollback),
  `RELEASE.md`, `AGENTS.md`, `NEEDS_PETER.md`, `DECISIONS.md` section
  "web-release-align", and the verify skill's `features/web-hosting.md`.

Done outside the repository (Vercel and Supabase settings):

- Vercel project `family-groceries`: auto-assignment of production domains
  turned off on 2026-10-29 at about 17:25 CET, so merges to `main` stopped
  moving `app.hummlist.com` right away. It stays on the 5b6659d build until the
  production branch is `release` and auto-assignment is back on (see
  `NEEDS_PETER.md` and the PR).
- Branch `release` created at 5b6659d, the commit `app.hummlist.com` serves.
- Supabase `jdwqrallbpdbshrdhenk`: `https://preview.app.hummlist.com/**` added
  to the redirect allow list.

Follow-up (review suggestions on #88, 2026-10-29):

- The failure issue now says what reached TestFlight, Play internal and
  `app.hummlist.com` from each job's own result (`report.sh outcome`), so it
  is right for any mix, such as a cancelled iOS job with a failed web job.
  `release.yml` passes the Android job's `uploaded` output to the report.
- `Web production` needs only `Uploaded`.
- `DEPLOY.md` and `RELEASE.md`: no branch protection or ruleset may cover
  `release`. Checked on 2026-10-29: no repository rulesets, the branch is not
  protected, and `rules/branches/release` is `[]`.
