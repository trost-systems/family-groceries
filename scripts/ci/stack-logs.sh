#!/usr/bin/env bash
# Saves the local stack's container logs with timestamps, one file per container, and prints the
# end of the edge runtime's. The e2e report (.github/actions/e2e-report) runs it when the e2e job
# failed and uploads the directory with the Playwright artifacts: a test's start time in the
# report then finds the lines of that moment in Kong (one per request, websockets included), the
# edge runtime and auth, and the errors of Realtime and the database. Two flake hunts had only an
# untimed runtime tail to go on (job 219). Given its directory it reports and never fails: the
# job's result is the gate's.
# Usage: scripts/ci/stack-logs.sh <dir>
set -uo pipefail
dir="${1:?usage: stack-logs.sh <dir>}"
project="$(sed -n 's/^project_id = "\(.*\)"$/\1/p' "$(dirname "$0")/../../supabase/config.toml")"
# The newest 50 MB of a container's log: a database that logged every statement stays uploadable.
LIMIT="${STACK_LOG_BYTES:-50000000}"

[[ -n $project ]] || { echo "no stack logs: supabase/config.toml names no project_id"; exit 0; }
mkdir -p "$dir" || { echo "no stack logs: cannot create $dir"; exit 0; }
# By the CLI's label, not by name: supabase_db_<other>_<project> is another stack's container.
names="$(docker ps -a --filter "label=com.supabase.cli.project=$project" --format '{{.Names}}' 2>&1)" \
  || { echo "no stack logs: docker ps said: $names"; exit 0; }
saved=0
found=0
while read -r name; do
  [[ -n $name ]] || continue
  found=$((found + 1))
  if docker logs -t "$name" 2>&1 | tail -c "$LIMIT" >"$dir/$name.log"; then
    saved=$((saved + 1))
  else
    echo "$name: docker logs or tail failed; $dir/$name.log has what came before"
  fi
done <<<"$names"
echo "saved the logs of $saved of the $found containers of the stack $project with timestamps (UTC) in $dir"
runtime="$dir/supabase_edge_runtime_$project.log"
if [[ -s $runtime ]]; then
  echo "the end of the edge runtime's:"
  tail -n 300 "$runtime"
fi
exit 0
