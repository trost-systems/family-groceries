# Job 13b: nightly encrypted database backups (2026-10-25)

PR #41, on `main` as `ed88b95`. The hosted database is now backed up every
night, encrypted to Peter's age key and kept for 90 days. CI proves on every
db gate run that a backup restores to identical data.

## What was built

- **`.github/workflows/backup.yml`**: 02:30 UTC nightly and on dispatch.
  `pg_dump` 17 through the session pooler, `age` to
  `supabase/backup/recipient.txt`, artifact `db-backup-<UTC date>-<run id>`,
  90 days. Fails without `SUPABASE_DB_PASSWORD`. A failure opens or comments
  on the issue "Database backup failed", and the next green run closes it.
- **`scripts/backup/dump.sh`**: the one dump command, used by the workflow and
  the drill. Data of `public.*`, `auth.users` and `auth.identities`. If
  anything fails it deletes the output, and it checks the header and a 16 KiB
  minimum.
- **`scripts/backup/restore.sh`**: one transaction in replica mode. It
  truncates (CASCADE) and loads from stdin.
- **`scripts/backup/drill.sh`** (end of the db gate) with
  `scripts/backup/fixtures.sql`: GoTrue users and identities, fixtures in
  every table through the app's RPCs, a throwaway key, a reset to the
  migrations and a restore. It compares row count and md5 for all 15 tables,
  then checks that sign-in works, that triggers fire again, and that the
  `item_events` sequence continues.
- **`scripts/backup/install-tools.sh`**: pg_dump 17 (PGDG when needed) and
  age. Used by `ci.yml`'s db job, `backup.yml` and `bootstrap.sh`.
- `ci.yml` `keepalive-schedule` also re-enables `backup.yml`. The lint gate
  shellchecks `scripts/backup/`.
- Docs: `docs/BACKUP.md` (runbook, restore, what isn't restored, key loss
  and rotation), linked from `docs/DEPLOY.md`. DECISIONS 13b.1-13b.10.
  NEEDS_PETER marks the decision done. Verify-skill
  `features/hosted-backend.md` gains `backend-backup`.

## Verification

| Check | Result |
| --- | --- |
| Restore drill, local 559xx stack (`scripts/verify.sh --only db`) | PASS, 15 tables identical ([output](../screenshots/13b-db-backups/drill-output.txt)) |
| Restore drill in CI (PR #41 db job) | PASS, pg_dump 17.11, 46498-byte encrypted dump |
| Negative checks ([list](../screenshots/13b-db-backups/negative-checks.txt)) | Drill fails without replica mode (duplicate `item_events` key) and with `--schema=public --table=auth.*` (public tables missing). dump.sh leaves no file when pg_dump fails, dies mid-stream or outputs almost nothing |
| Password probe from the branch | Run 40208395282 failed on the runner's pg_dump 16 wrapper (fixed) and opened issue #40. Run 40209166873 was green and closed #40 |
| PR #41 CI; `main` CI run 40209740753 | all gates green; on `main` `keepalive-schedule` (now also enabling `backup.yml`) green |
| **Acceptance on `main`**: run [40209747507](https://github.com/trost-systems/family-groceries/actions/runs/40209747507) (dispatch, `ed88b95`) | green |
| Artifact | `db-backup-2026-10-25-40209747507`, 35425 bytes (zip), file 35231 bytes, created 2026-10-25T16:02:44Z, expires 2027-01-23T16:02:11Z |
| Header (`head -c 21`) | `age-encryption.org/v1`. Not decrypted. Download deleted |
| Log | 0 email addresses, 0 `COPY`/`INSERT` lines, `PGPASSWORD` only as `***` |

The real backup was never decrypted, and the private key file was never
read. Every test used throwaway `age-keygen` keys in `mktemp -d` directories.

## What's left for Peter

- Copy the private key from `~/groceries-ops/backup-age-key.txt` on the
  build box to his own computer and password manager (NEEDS_PETER, "Job 13:
  database backups"). Until then the only copy is on the box.
- Watch the repository's issues, so that "Database backup failed" reaches him.
- `SUPABASE_DB_PASSWORD` holds the existing password (not rotated). If the
  lead rotates it, the secret must change in the same step, or the next
  night opens the issue (`docs/BACKUP.md`, Failures).

## Notes

- Job 18's fixtures weren't on `main`, so the drill has its own
  (`scripts/backup/fixtures.sql`). A new public table without fixture rows
  fails the drill, which keeps every table proven to round-trip.
- No UI changes, so the 5-green e2e rule didn't apply.
