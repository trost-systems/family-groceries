#!/usr/bin/env bash
# The publisher on hz. The crontab line (installed by job 156; README "Deploy and setup") first
# moves the shallow clone ~/nexus-publisher to main's head with a fetch and a hard reset (a pull
# would refuse to fast-forward a depth-1 clone once main moved), then runs this script.
# The clone follows origin/main hard, so the published page and the hill-climb docs it reads are
# main's. One run at a time; a run that finds the lock taken exits at once. publish.sh loads the
# Vercel secrets from ~/.config/agents/nexus.env for the deploy step only.
set -euo pipefail

# Bash reads a script as it runs; the git reset below can rewrite this file, so the whole body is
# parsed (as a function) before anything runs, and the script exits before reading further.
main() {
  local checkout="${NEXUS_CHECKOUT:-$HOME/nexus-publisher}"
  exec 9>/tmp/nexus-publish.lock
  flock -n 9 || { echo "[$(date '+%F %T %Z')] nexus: previous publish still running"; return 0; }
  # shellcheck source=/dev/null # host files, not in the repo
  [[ -f "$HOME/groceries-ops/env.hz" ]] && source "$HOME/groceries-ops/env.hz"
  cd "$checkout"
  # Children get fd 9 closed: the lock stays with this script, never with a leftover child.
  git fetch --quiet --depth 1 origin main 9>&-
  git reset --quiet --hard FETCH_HEAD 9>&-
  echo "[$(date '+%F %T %Z')] nexus: publishing $(git rev-parse --short HEAD)"
  NEXUS_PUBLISH_LOCKED=1 nexus/scripts/publish.sh --deploy 9>&-
}
main "$@"
exit
