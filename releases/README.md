# Public release record

`releases.json` lists every Hummlist release that is public in the stores. It is the one place
that says what the public has, so the site and a later history page read it instead of asking the
stores or git (Vercel clones shallow). The format is checked by `parseRecord` in
`site/releases.mjs`; the site tests and `scripts/release/record.mjs` both use it.

Today the list is empty: TestFlight internal and Play internal are not public releases
(`docs/RELEASE.md`, "Public releases").

## Who writes it

Nobody edits `releases` by hand. After the stores accept a public build, the public release step
runs the **Public release record** workflow (`.github/workflows/public-release-record.yml`) with
the version, the commit and the build number. The workflow runs

```bash
node scripts/release/record.mjs add --version 1.0.0 --sha <commit> --build 1100
```

and pushes the change to `main` as `Release 1.0.0: public release record`. That push makes
Vercel rebuild hummlist.com with the new live version (`site/README.md`, "Live version"). Add
`--dry-run` to see the entry without writing it.

## Fields

`project.day_zero` is the date of the repository's first commit (2026-10-22). `identities` maps
commit e-mail addresses to one person, with their GitHub login and whether they are a bot. Add a
person here when a new address shows up as a separate contributor.

Each release:

| Field | Meaning |
| --- | --- |
| `version` | Store version, `MAJOR.MINOR.PATCH`. Unique, above the previous release's. |
| `channel` | `public`, the only channel so far. |
| `date`, `day` | Date the stores accepted it (Europe/Berlin), and days since `day_zero` (day 0). |
| `build` | Store build number, above the previous release's. |
| `sha`, `previous_sha` | The released `main` commit and the previous release's (`null` for the first). |
| `stores` | Which stores got it: `app_store`, `play`, `web` (app.hummlist.com). |
| `stats` | From git at record time, over `previous_sha..sha` (the first release counts from the root commit). `commits`; `additions`, `deletions`, `files_changed` of the net diff; `contributors`. |
| `notes` | Short release notes, `de` and `en` (may be empty), from the workflow's inputs. The changelog is `changelog`. |
| `changelog` | Optional (job 39). The reviewed changelog: `title` (`de`, `en`, may be empty), `items` (`new`, `improved`, `fixed`, each a list of `{de, en, pr, sha}`), `store` (`app_store` and `play`, each `{de, en}`, the "What's new" texts within the stores' limits). A release without it shows "Fehlerbehebungen und Verbesserungen." on hummlist.com. |

A contributor is every commit author and every `Co-authored-by:` trailer, merged by identity, so a
commit by the bot with Peter as co-author counts once for each of them. Each contributor has
`commits` and the `additions` and `deletions` of those commits, so their sum can exceed the net
diff. Releases are sorted by version, oldest first.

`pr` and `sha` on an item trace it to the PR and the commit on `main` it came from (`pr` is
`null` for a commit without ` (#n)`). The site never renders them.

## Changelog drafts

`changelog/<version>.json` is the changelog of a release that is not public yet. It holds the
same `title`, `items` and `store` as the record's `changelog`, plus `version`, `status: "draft"`
and `generated_from` (`previous_sha`, `sha`: the range it was collected from).
`scripts/release/changelog.mjs draft` writes it from the PRs' `## Changelog` notes, and a person
reviews the wording ([`docs/CHANGELOG.md`](../docs/CHANGELOG.md)). When `record.mjs add` records
that version, it copies `title`, `items` and `store` into the entry and deletes the draft file in
the same commit, so the record is the one copy afterwards. Preview builds of hummlist.com show
drafts with a banner; production shows only the record.
