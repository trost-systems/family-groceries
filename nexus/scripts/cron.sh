#!/usr/bin/env bash
# The publisher on hz. The crontab line (installed by job 156; README "Deploy and setup") first
# moves the shallow clone ~/nexus-publisher to main's head with a fetch and a hard reset (a pull
# would refuse to fast-forward a depth-1 clone once main moved), then runs this script.
# The clone follows origin/main hard, so the published page and the hill-climb docs it reads are
# main's. One run at a time; a run that finds the lock taken exits at once. publish.sh loads the
# Vercel secrets from ~/.config/agents/nexus.env for the deploy step only.
# Cadence (Peter, N7, 2026-11-10): the crontab still fires every 10 minutes, but this script
# publishes at most once a night: only in the 03:00 hour Europe/Berlin (NEXUS_DEPLOY_HOUR) and
# only if no publish succeeded yet that day (stamp file NEXUS_STAMP). A failed run leaves no stamp,
# so the next 10-minute tick in that hour retries. NEXUS_FORCE=1 publishes now (by hand).
# The Vercel project has no git connection, so pushes to main never build on Vercel.
set -euo pipefail

# Bash reads a script as it runs; the git reset below can rewrite this file, so the whole body is
# parsed (as a function) before anything runs, and the script exits before reading further.
main() {
  local checkout="${NEXUS_CHECKOUT:-$HOME/nexus-publisher}"
  local stamp="${NEXUS_STAMP:-$HOME/.cache/nexus-last-publish}"
  local hour today
  hour="${NEXUS_CLOCK_HOUR:-$(TZ=Europe/Berlin date +%H)}"
  today="$(TZ=Europe/Berlin date +%F)"
  if [[ -z ${NEXUS_FORCE:-} ]]; then
    [[ $hour == "${NEXUS_DEPLOY_HOUR:-03}" ]] || return 0
    [[ "$(cat "$stamp" 2>/dev/null || true)" != "$today" ]] || return 0
  fi
  exec 9>"${NEXUS_LOCK:-/tmp/nexus-publish.lock}"
  flock -n 9 || { echo "[$(date '+%F %T %Z')] nexus: previous publish still running"; return 0; }
  # Again under the lock: a run that just finished may have stamped today.
  [[ -n ${NEXUS_FORCE:-} || "$(cat "$stamp" 2>/dev/null || true)" != "$today" ]] || return 0
  # shellcheck source=/dev/null # host files, not in the repo
  [[ -f "$HOME/groceries-ops/env.hz" ]] && source "$HOME/groceries-ops/env.hz"
  cd "$checkout"
  # Children get fd 9 closed: the lock stays with this script, never with a leftover child.
  git fetch --quiet --depth 1 origin main 9>&-
  git reset --quiet --hard FETCH_HEAD 9>&-
  echo "[$(date '+%F %T %Z')] nexus: publishing $(git rev-parse --short HEAD)"
  NEXUS_PUBLISH_LOCKED=1 nexus/scripts/publish.sh --deploy 9>&-
  mkdir -p "$(dirname "$stamp")"
  echo "$today" >"$stamp"
}
main "$@"
exit
