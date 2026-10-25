#!/usr/bin/env bash
# Installs what dump.sh and restore.sh need: pg_dump/psql 17 (the hosted and local Postgres are
# 17, and pg_dump refuses a newer server) and age. Debian 13 ships postgresql-client-17; Ubuntu
# 24.04 (GitHub runners) ships 16, so it comes from the PGDG apt repository there.
set -euo pipefail

# Ubuntu's /usr/bin/pg_dump (pg_wrapper) follows the installed server, 16 on runners, not the
# newest client, so the scripts put 17's own bin directory first.
PATH="/usr/lib/postgresql/17/bin:$PATH"
pg_major() { pg_dump --version 2>/dev/null | sed -n 's/^pg_dump (PostgreSQL) \([0-9]*\).*/\1/p'; }

if [[ "$(pg_major)" != 17 ]] || ! command -v age >/dev/null; then
  if ! apt-cache show postgresql-client-17 >/dev/null 2>&1; then
    sudo install -d /usr/share/postgresql-common/pgdg
    sudo curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
      https://www.postgresql.org/media/keys/ACCC4CF8.asc
    . /etc/os-release
    echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" \
      | sudo tee /etc/apt/sources.list.d/pgdg.list >/dev/null
    sudo apt-get update -qq
  fi
  sudo apt-get install -y -qq postgresql-client-17 age >/dev/null
fi

if [[ "$(pg_major)" != 17 ]]; then
  echo "pg_dump is $(pg_dump --version 2>&1), expected 17.x" >&2
  exit 1
fi
pg_dump --version
age --version
