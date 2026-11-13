#!/usr/bin/env bash
# Tests stack-logs.sh with docker stubbed out: one file per container of this stack only (other
# stacks have lookalike names), both streams and the timestamps in it, the runtime's end
# printed, and exit 0 whatever docker does.
# Run by the lint gate.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
failures=0
fail() { echo "FAIL: $*" >&2; failures=$((failures + 1)); }
project="$(sed -n 's/^project_id = "\(.*\)"$/\1/p' "$here/../../supabase/config.toml")"

mkdir "$tmp/bin"
cat >"$tmp/bin/docker" <<'DOCKER'
#!/usr/bin/env bash
case "$1 $2" in
  "ps -a")
    [[ -z ${DOCKER_DOWN:-} ]] || { echo "Cannot connect to the Docker daemon" >&2; exit 1; }
    # Each container with its stack's label, as `docker ps --filter label=<key>=<value>` sees them.
    wanted=""
    while [[ $# -gt 0 ]]; do
      if [[ $1 == --filter ]]; then wanted="${2#label=com.supabase.cli.project=}"; fi
      shift
    done
    while read -r name label; do
      if [[ -z $wanted || $label == "$wanted" ]]; then echo "$name"; fi
    done <<LIST
supabase_kong_$PROJECT $PROJECT
supabase_edge_runtime_$PROJECT $PROJECT
supabase_auth_$PROJECT $PROJECT
supabase_db_another-job another-job
supabase_db_x_$PROJECT x_$PROJECT
supabase_db_${PROJECT}2 ${PROJECT}2
supabase_db_$PROJECT-219 $PROJECT-219
buildx_buildkit -
LIST
    ;;
  "logs -t")
    case "$3" in
      *edge_runtime*) for n in $(seq 1 400); do echo "2026-11-13T20:00:00.000000000Z runtime line $n"; done ;;
      *kong*) echo "2026-11-13T20:00:01.000000000Z kong on stdout"; echo "2026-11-13T20:00:02.000000000Z kong on stderr" >&2 ;;
      *auth*) echo "2026-11-13T20:00:03.000000000Z auth line"; echo "Error response from daemon: No such container" >&2; exit 1 ;;
      *) echo "unexpected: docker $*" >&2; exit 2 ;;
    esac
    ;;
  *) echo "unexpected: docker $*" >&2; exit 2 ;;
esac
DOCKER
chmod +x "$tmp/bin/docker"
export PROJECT="$project"

code=0
out="$(PATH="$tmp/bin:$PATH" "$here/stack-logs.sh" "$tmp/logs" 2>&1)" || code=$?
[[ $code == 0 ]] || fail "exit $code"
[[ "$(cd "$tmp/logs" && echo *)" == "supabase_auth_$project.log supabase_edge_runtime_$project.log supabase_kong_$project.log" ]] || fail "files: $(ls "$tmp/logs")"
[[ "$(cat "$tmp/logs/supabase_kong_$project.log")" == *"kong on stdout"*"kong on stderr"* ]] || fail "kong's log lacks a stream: $(cat "$tmp/logs/supabase_kong_$project.log")"
[[ "$(wc -l <"$tmp/logs/supabase_edge_runtime_$project.log")" -eq 400 ]] || fail "the runtime's file is not the whole log"
grep -q "^saved the logs of 2 of the 3 containers of the stack $project " <<<"$out" || fail "no summary line: $(head -n 3 <<<"$out")"
{ grep -q "^supabase_auth_$project: docker logs or tail failed" <<<"$out" && grep -q 'auth line' "$tmp/logs/supabase_auth_$project.log"; } || fail "a container that went away: $(head -n 3 <<<"$out")"
[[ "$(grep -c 'Z runtime line' <<<"$out")" == 300 && "$(tail -n 1 <<<"$out")" == *"runtime line 400" ]] || fail "the printed end of the runtime's log: $(grep -c 'runtime line' <<<"$out") lines"

code=0
out="$(PATH="$tmp/bin:$PATH" STACK_LOG_BYTES=100 "$here/stack-logs.sh" "$tmp/short" 2>&1)" || code=$?
[[ $code == 0 && "$(wc -c <"$tmp/short/supabase_edge_runtime_$project.log")" -eq 100 ]] || fail "the size limit: exit $code, $(wc -c <"$tmp/short/supabase_edge_runtime_$project.log") bytes"
[[ "$(tail -n 1 "$tmp/short/supabase_edge_runtime_$project.log")" == *"runtime line 400" ]] || fail "the limit keeps the oldest lines, not the newest"

code=0
out="$(PATH="$tmp/bin:$PATH" STACK_LOG_BYTES=many "$here/stack-logs.sh" "$tmp/many" 2>&1)" || code=$?
{ [[ $code == 0 ]] && grep -q "^saved the logs of 0 of the 3 containers" <<<"$out"; } || fail "a limit that is no number: exit $code, $out"
code=0
out="$(PATH="$tmp/bin:$PATH" "$here/stack-logs.sh" /dev/null/logs 2>&1)" || code=$?
[[ $code == 0 && $out == *"no stack logs: cannot create /dev/null/logs" ]] || fail "a directory that cannot be: exit $code, $out"

code=0
out="$(PATH="$tmp/bin:$PATH" DOCKER_DOWN=1 "$here/stack-logs.sh" "$tmp/down" 2>&1)" || code=$?
[[ $code == 0 && $out == "no stack logs: docker ps said: Cannot connect"* ]] || fail "docker down: exit $code, $out"

if [[ $failures -gt 0 ]]; then
  echo "stack-logs-test: $failures failed" >&2
  exit 1
fi
echo "stack-logs.sh saves this stack's logs with timestamps and never fails: all cases pass"
