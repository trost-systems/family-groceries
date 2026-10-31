# Changelog

What each Hummlist version brings users. The same notes feed two places: the
stores' "What's new" text and the pages
[hummlist.com/de/changelog](https://hummlist.com/de/changelog) and
[hummlist.com/en/changelog](https://hummlist.com/en/changelog). Each PR
writes its own note, so nobody has to reconstruct a release afterwards.
Decisions and reasons are in [`DECISIONS.md`](DECISIONS.md), "Job 39".

## The note in every PR

Every PR description has a `## Changelog` section
([`.github/pull_request_template.md`](../.github/pull_request_template.md)).
It holds one or more items. Each item is a paragraph of three lines: a
category, then one German and one English sentence.

```
## Changelog
new
de: Mit Alexa fügst du Artikel per Sprache hinzu: „Alexa, sag Hummlist, füg Milch hinzu“.
en: Add items with Alexa: "Alexa, tell Hummlist to add milk".

fixed
de: Die Liste springt beim Abhaken nicht mehr nach oben.
en: The list no longer jumps to the top when you check off an item.
```

If users see no change, the whole section is the single word `none`.

| Category | For |
| --- | --- |
| `new` | Something users can do that they couldn't before |
| `improved` | Something that works better, faster or more clearly |
| `fixed` | A bug a user could have noticed |

What to write:

- Write in user words: what the user can now do, or what now works.
- Write one plain sentence per language.
- Don't name jobs, PRs, files, tables or internal tools.

What to leave out: typo and copy fixes, refactors, CI, docs, tests, lints,
deploys and server internals. Add a fix only if a user could have noticed the
bug.

The parser (`scripts/release/changelog.mjs`, `parseNote`) is strict about
structure and lenient about wording. It accepts:

- any case, a trailing colon or full stop (`Fixed:`, `None.`)
- Markdown around the word (`**New:**`, `` `none` ``)
- a remark in brackets (`none (docs only)`)
- list dashes (`- de: …`)
- the German words `neu`, `verbessert`, `behoben` and `keine`

It rejects these, each with a message:

- a heading that is almost the right one (`### Changelog`, `## Changelog:`)

- an unknown category
- an item without a `de:` or an `en:` line
- an empty line or a duplicate line
- `none` together with items
- an empty section
- two `## Changelog` sections

The section ends at the next heading or `---` rule. A paragraph that is
neither an item nor `none` also ends it, so the "Generated with" line and the
trailers after it are not part of it. HTML comments (the template's guidance)
are ignored.

## Where it is checked

- **`scripts/push-pr.sh`** checks the PR description before it squashes.
  - **No section, and nothing users could notice changes:** it adds
    `## Changelog` + `none` to the description (`gh pr edit`) and continues.
    Users notice the app build, by the Release run's own rule
    (`scripts/release/plan.sh ships-app`: `app/` or
    `.github/workflows/release.yml`). They also notice the backend, which
    goes live from `main` without an app release: `supabase/` (functions,
    migrations, the classifier) and `alexa/`. Docs, CI, scripts, the site,
    tests and `releases/` need no note. A Dependabot branch (`dependabot/…`)
    gets `none` too.
  - **No section, and the app or backend changes:** it stops and prints the
    format. For a backend change users can't see, write `none`.
  - **An invalid section:** it always stops.
- **CI** checks the structure, never the wording, in the `changelog` gate
  (`scripts/gates/changelog.sh`), a job that `ci-ok` waits for. It runs on
  pull requests only. It skips Dependabot (its bumps change nothing users
  see, and their PRs have no note) and pushes to `main`. It checks the PR
  head's commit message, which is what `main` takes. A head pushed without
  push-pr.sh has no section in its message yet; then the PR description in
  the event counts. The same gate checks every draft in `releases/changelog/`
  (`changelog.mjs drafts`): each must be valid, be named `<version>.json`,
  and have store texts that match its title and items.

Commits without a section count as `none`. These are everything before job
39, release record commits and Dependabot PRs. Older PRs are not backfilled.

## Collecting a release

```bash
node scripts/release/changelog.mjs draft --version 1.0.0 --sha <main commit> --dry-run
node scripts/release/changelog.mjs draft --version 1.0.0 --sha <main commit>
```

`draft` reads main's first-parent commits from the previous public release up
to `--sha`. The previous release is the newest one in
`releases/releases.json`. Without one, it reads from the root commit.
`--previous-sha` sets the start by hand. The script reads git only: no
GitHub API, no network, no LLM.

What `draft` does with the notes:

- It drops `none` and commits without a section.
- It groups the items as new, improved, fixed, in merge order (oldest first)
  within each group.
- It drops an item whose German and English sentences are identical to an
  earlier one.
- It keeps each item's PR number and commit for tracing. The site never shows
  them.

It writes `releases/changelog/<version>.json`. `--out` writes the file
somewhere else instead. `--dry-run` prints the JSON and both store texts with
their lengths, and writes nothing. A release with no item prints a warning,
because a release with nothing users notice is suspicious.

An invalid section on `main` (only possible past CI) stops `draft` and names
the commit. Write that item into the draft by hand, then rerun with
`--skip <sha>`.

`draft` never overwrites an existing draft, because it may hold reviewed
wording. Edit the draft by hand, or pass `--force` to replace it.

The draft's `title` (`de`, `en`) starts empty. During the review, give it a
headline that names the 2-3 biggest things. After editing the title or the
items, run

```bash
node scripts/release/changelog.mjs store --version 1.0.0
```

It rewrites the draft's store texts from the edited wording. The changelog
gate and `record.mjs` refuse a draft whose store texts don't match its title
and items, so an edit can't reach the stores half-applied. An item added by
hand needs `pr` (a number, or `null`) and `sha` (the release commit will do).

## Store texts

Each draft holds four texts: `store.app_store` and `store.play`, each in
`de` and `en`. Each text has the title (if any), then `Neu:` / `New:`,
`Verbessert:` / `Improved:` and `Behoben:` / `Fixed:` with one `•` line per
item. An item that is empty after stripping (only emoji) gets no line. With
no items it is "Fehlerbehebungen und Verbesserungen." / "Bug fixes and
improvements."

| Store | Limit | Counted as | Source |
| --- | --- | --- | --- |
| App Store | 4000 | UTF-8 bytes. Apple says "characters"; fastlane's pilot cuts at 4000 bytes, the strictest reading, so "ä" counts 2 | App Store Connect Help, "Platform version information": "Limited to 4000 characters." |
| Google Play | 500 | Unicode characters (code points, after NFC) | Play Console Help, answer 9859348: "up to 500 Unicode characters per language" |

When a text is too long, whole items go from the end: fixed first, then
improved, then new. A last line then points to the full list: "Alle
Änderungen: hummlist.com/de/changelog#v1-0-0" / "All changes:
hummlist.com/en/changelog#v1-0-0". A sentence is never cut. Emoji and `<` are
removed from both stores' texts, as fastlane's `sanitize_changelog` does,
because Apple rejects them. Emoji means what shows as emoji: emoji
presentation, or a symbol with the emoji selector. Text symbols such as ©, ™,
arrows or a plain ✔ stay. The site shows the items unchanged.

`parseRecord` and `parseDraft` (`site/releases.mjs`) reject a store text over
its limit. A text edited by hand can't slip past them.

## Publishing

The order of steps is in [`RELEASE.md`](RELEASE.md), "Public releases":

1. A PR commits the draft.
2. Peter reviews it and approves the release.
3. After the stores accept the build, the Public release record workflow moves
   the draft into `releases/releases.json` and deletes the draft file.
4. That push redeploys hummlist.com, which shows the version from then on.

Preview builds of the site also show drafts whose version is not in the
record yet, with a banner. Production shows only recorded releases ([`site/README.md`](../site/README.md),
"Changelog").
