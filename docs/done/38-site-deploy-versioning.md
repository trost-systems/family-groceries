# Job 38: hummlist.com guides follow the live store version; public release record

PR #139. hummlist.com can now hold guides, sections and paragraphs for app versions the stores
don't have yet: production leaves them out until a public release makes them live, and preview
builds show them with a banner for review. What is public is recorded in
`releases/releases.json`, which a public release updates through one workflow; that commit is
also what redeploys hummlist.com. Today nothing is tagged and the record is empty, so
hummlist.com looks exactly as before. Calls and reasons: docs/DECISIONS.md, "Job 38".

## What was built

- **Release record.** `releases/releases.json` and `releases/README.md`. Fields: version, channel,
  date, day N since 2026-10-22, build, sha, previous_sha, stores, stats (commits, net
  additions, deletions and files, contributors) and notes de/en. Contributors merge commit
  authors and `Co-authored-by:` trailers by identity (`identities`: Peter `peter-trost`, the
  bot under both of its addresses, Claude), and bots are marked. `site/releases.mjs` validates
  the file strictly: field set, day against date, version and build order, previous_sha chain,
  unique e-mails.
- **Live version.** `site/build.mjs` reads the newest public release, else the version in
  `app/pubspec.yaml` (0.1.0 today, what the testers have), and logs
  `live version: 0.1.0 (from app/pubspec.yaml, no public release yet)`. If it can't read
  either file, the build fails and names the Vercel setting.
- **`since` tags.** Three levels: guide frontmatter `since: X`, a heading suffix `{since=X}`
  (with `{#id}`), and a `::: since X` … `:::` block. Production leaves unreleased content out:
  a guide 404s and drops off its index, hreflang and language switch. Preview and local builds
  show it with the banner "Ab Version X, noch nicht im Store". The note "Ab App-Version X" shows
  only for content newer than the first public release, and never repeats its guide's note.
  The build fails on: an invalid version, `since` on legal pages or indexes, an unclosed or
  misspelled block, and a `:::` line in a fence inside a block. Rules: `site/README.md`,
  "Versioned content" and "Live version".
- **Record script.** `node scripts/release/record.mjs add --version X --sha S --build N [--date]
  [--channel] [--stores] [--notes-de=…] [--notes-en=…] [--dry-run]`. It refuses duplicate,
  non-semver or non-increasing versions and builds, and a sha that is not on main.
- **Workflow.** `.github/workflows/public-release-record.yml` (dispatch and `workflow_call`,
  `dry_run` defaults to true). A real run commits `Release X: public release record` to main
  and pushes it, rebasing and retrying if main moved. Vercel builds that push as hummlist-site
  production. It starts no store upload: a `GITHUB_TOKEN` push starts no workflow, and
  `plan.sh` counts `releases/` as non-app (fixture test).
- **Docs.** `docs/RELEASE.md` "Public releases" (the future public release step calls the
  workflow after the stores accept), `docs/DEPLOY.md` "Guides site", `docs/DECISIONS.md`
  "Job 38" (also how `/history` will read the record), AGENTS.md, `features/guides.md`
  (`gd-since`).

## How to verify

- `scripts/verify.sh --only gitleaks,lint,site` covers 71 site tests (`site/test/versions.test.mjs`
  has 18 of them), 14 record-script tests against a throwaway git repo, the plan.sh
  `releases/` fixture, actionlint and shellcheck.
- `cd site && VERCEL_ENV=production node build.mjs && diff -r <main's dist> dist`: for today's
  content, production and preview builds are byte-identical to main's except the added
  `.since-note` line in `styles.css`.
- `node scripts/release/record.mjs add --version 0.1.0 --sha origin/main --build 1054 --dry-run`
  prints the entry main would get today. At the time of writing: day 9, 98 commits, +135062
  lines over 2121 files; contributors petertrost-bot 98 (bot), Peter Trost 96, Claude 68 (bot).
- On Vercel, the PR head's "Vercel – hummlist-site" status is success. That build read
  `../releases` and `../app/pubspec.yaml`.
- Screenshots: `docs/screenshots/38/guide-preview.png` and `guide-production.png` (a fixture
  guide against a fixture record with public releases 1.0.0 and 1.2.0).

## Open

- Not proven until the first real run: that Vercel builds a push made by the Actions token. The
  commit is authored by petertrost-bot like every main commit Vercel builds today. If Vercel
  doesn't build it, the next merge to main does (DECISIONS 38.7).
- After the merge, one dispatch with `dry_run=true` on main proves the workflow runs. The ops
  DONE_SUMMARY and the PR link to that run.
