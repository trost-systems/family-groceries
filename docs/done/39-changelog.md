# Job 39: user-facing changelog (store "What's new" + hummlist.com/changelog) from PR notes

PR #140. Every PR now says in its description what users notice, in German and English, or
`none`. A release collects those notes from `main`'s commits into a draft that Peter reviews.
The draft holds the App Store and Play "What's new" texts within their limits. Once the stores
accept the build, the release record takes the draft, and hummlist.com/de/changelog and
/en/changelog show the version. Today no release is public, so both pages show an empty state.
Format and flow: [docs/CHANGELOG.md](../CHANGELOG.md). Calls and reasons:
[docs/DECISIONS.md](../DECISIONS.md), "Job 39".

## What was built

- **The note.** A `## Changelog` section in the PR description. Each item is a category (`new`,
  `improved`, `fixed`) followed by a `de:` and an `en:` sentence, or the whole section is `none`.
  The PR template (`.github/pull_request_template.md`) carries the guidance.
- **push-pr.sh** checks the note before it squashes.
  - A PR without a note that changes no app build (`plan.sh ships-app`) and nothing under
    `supabase/` or `alexa/`, or a Dependabot branch, gets `none` added to its description.
  - Any other PR without a note, or an invalid note, stops the push with the format.
- **CI gate `changelog`**, a small job that `ci-ok` needs. It checks the structure of the PR
  head's message, falling back to the PR description in the event. It also checks every draft in
  `releases/changelog/`, including whether its store texts match its items. It runs on pull
  requests only and skips Dependabot.
- **`scripts/release/changelog.mjs`** has three commands:
  - `draft` collects main's first-parent commits since the newest public release (else the root)
    into `releases/changelog/<v>.json`, with PR and sha per item and the store texts. It never
    overwrites a draft without `--force`.
  - `store` rewrites the store texts after the wording was edited.
  - `check` is the parser that push-pr.sh and the gate use.
- **Store texts.** App Store 4000 UTF-8 bytes, Play 500 Unicode characters. When a text is too
  long, whole items go from the end (fixed, improved, new) and a link line to the changelog
  anchor follows. Emoji and `<` are stripped. With no items, a neutral sentence plus a warning.
- **Record.** `record.mjs add` embeds the draft as `changelog` and deletes the draft file in
  the same commit. `public-release-record.yml` stages `releases/`. `parseRecord` checks
  `changelog` when it is present, and job 38's entries pass unchanged.
- **Site.** `/de/changelog` („Neuigkeiten“) and `/en/changelog` ("What's new").
  - Production lists the public releases newest first, with anchors.
  - Preview and local builds also show drafts with job 38's banner.
  - Every page gets a footer link. noindex is unchanged.

## How to verify

- `scripts/verify.sh --only gitleaks,lint,changelog,site`. It runs:
  - 78 site tests;
  - `scripts/release/test.sh`: 19 changelog, 19 record and 6 gate cases;
  - `scripts/landing-test.sh`, with 6 new push-pr.sh changelog cases.
- `node scripts/release/changelog.mjs draft --version 0.1.0 --sha origin/main --dry-run` prints a
  draft and its store texts and writes nothing.
- dist diff vs main (production): the two new pages, the footer `<nav>` line on the 12 footer
  pages, and two CSS rules.
- Screenshots: `docs/screenshots/39/changelog-empty.png`, `changelog-production.png` and
  `changelog-preview.png`.

## Open

- No store submission path exists yet. The step that uploads `store.app_store` and `store.play`
  as "What's new" belongs to the future public release job (docs/RELEASE.md, "Changelog and store
  texts").
- Notes start with this job. Releases cut before PRs carry notes collect nothing and fall back to
  "Bug fixes and improvements." with a warning; older PRs are not backfilled.
