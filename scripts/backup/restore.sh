#!/usr/bin/env bash
# Loads a decrypted dump from dump.sh (stdin) into a database whose schema the migrations already
# built, replacing its data. Usage (docs/BACKUP.md):
#   age -d -i key.txt backup.sql.age | scripts/backup/restore.sh
# Connection from the libpq environment, as for dump.sh. One transaction: on any error nothing
# changes.
set -euo pipefail
# Ubuntu's /usr/bin/pg_dump follows the installed server (16 on runners), so 17's own binaries win.
PATH="/usr/lib/postgresql/17/bin:$PATH"

# replica: no trigger runs while the rows go in, so items_before_write, items_log_event,
# items_learn and on_auth_user_created can't rewrite or add rows, and foreign keys aren't
# checked mid-load. The truncate empties what the target already holds (the migrations' seed
# rows in classifier_terms, or the data the restore replaces); CASCADE reaches the auth tables
# that point at users (sessions, refresh tokens, MFA factors, OAuth consents), whose rows
# would be stale (DECISIONS 13b.4).
psql --no-psqlrc --quiet --output=/dev/null --single-transaction -v ON_ERROR_STOP=1 \
  -c 'SET session_replication_role = replica' \
  -c "DO \$\$ BEGIN
        EXECUTE (SELECT 'TRUNCATE auth.users, auth.identities'
                   || coalesce(', ' || string_agg(format('%I.%I', schemaname, tablename), ', '), '')
                   || ' CASCADE'
                 FROM pg_tables WHERE schemaname = 'public');
      END \$\$" \
  -f -
