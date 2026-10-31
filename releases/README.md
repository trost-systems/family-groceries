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

and pushes the changed file to `main` as `Release 1.0.0: public release record`. That push makes
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
| `notes` | Short release notes, `de` and `en` (may be empty). |

A contributor is every commit author and every `Co-authored-by:` trailer, merged by identity, so a
commit by the bot with Peter as co-author counts once for each of them. Each contributor has
`commits` and the `additions` and `deletions` of those commits, so their sum can exceed the net
diff. Releases are sorted by version, oldest first.
