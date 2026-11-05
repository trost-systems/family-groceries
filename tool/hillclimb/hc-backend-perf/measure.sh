#!/usr/bin/env bash
# hc-backend-perf: resets this checkout's local stack to the current migrations, seeds the fixed
# fixture, runs bench.ts under /tmp/fg-hc-measure.lock and prints one JSON line: score = geometric
# mean of the p95 latencies (ms) of every path, sequential and at concurrency 4. Lower is better.
# Local stack only (supabase status of this checkout); never a hosted project.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=../../../scripts/lib.sh
source "$here/../../../scripts/lib.sh"
cd "$REPO_ROOT"
exec 3>&1 1>&2

env="$(supabase status -o env 2>/dev/null)"
api="$(sed -n 's/^API_URL="\(.*\)"$/\1/p' <<<"$env")"
key="$(sed -n 's/^PUBLISHABLE_KEY="\(.*\)"$/\1/p' <<<"$env")"
db="$(sed -n 's/^DB_URL="\(.*\)"$/\1/p' <<<"$env")"
[[ $api == http://127.0.0.1:* && $db == postgresql://*@127.0.0.1:* ]] || { echo "no local stack for $(project_id)" >&2; exit 1; }
container="supabase_db_$(project_id)"
admin() { docker exec -i "$container" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -At "$@"; }

db_reset
# The reset restarts the database under PostgREST and Auth; seeding needs both answering again.
for _ in $(seq 120); do
  rest="$(curl -s -o /dev/null -w '%{http_code}' -H "apikey: $key" "$api/rest/v1/categories?select=id&limit=1" || true)"
  auth="$(curl -s -o /dev/null -w '%{http_code}' -H "apikey: $key" "$api/auth/v1/health" || true)"
  # Any answer from PostgREST itself will do (anon gets 401 here); 5xx is Kong or a lost database.
  [[ $rest =~ ^[1-4] && $auth == 200 ]] && break
  sleep 1
done
[[ $rest =~ ^[1-4] && $auth == 200 ]] || { echo "stack not ready after the reset (rest $rest, auth $auth)" >&2; exit 1; }
fg_on_repo_stack
export FG_STATE_DIR="${HC_STATE_DIR:-$HOME/.cache/fg-hc-backend-perf}"
run="hcbp-$(date +%s)"
scripts/fg seed ./tool/hillclimb/hc-backend-perf/hc-backend-perf.yaml --run-id "$run" >/dev/null
admin -c 'vacuum analyze' >/dev/null
admin -c 'create extension if not exists pg_stat_statements with schema extensions' >/dev/null

stats="$(mktemp)"
bench="$(mktemp)"
trap 'rm -f "$stats" "$stats.load" "$bench"' EXIT
(
  flock 9
  admin -c 'select extensions.pg_stat_statements_reset()' >/dev/null
  # The sampler must not hold the lock (fd 9), and must die with this subshell even when bench.ts
  # fails under set -e; a leftover sampler kept the lock taken for every hill-climb job.
  while :; do
    mapfile -t ids < <(docker ps -q --filter "name=_$(project_id)$")
    docker stats --no-stream --format '{{json .}}' "${ids[@]}" >>"$stats" 2>/dev/null || true
  done 9>&- &
  sampler=$!
  # set -e holds in traps too: nothing here may fail before the kill.
  trap 'kill "$sampler" 2>/dev/null || true' EXIT
  cut -d' ' -f1-3 /proc/loadavg >"$stats.load"
  deno run --quiet --allow-all "$here/bench.ts" "$FG_STATE_DIR/runs/$run.json" "$api" "$key" >"$bench"
  cut -d' ' -f1-3 /proc/loadavg >>"$stats.load"
) 9>/tmp/fg-hc-measure.lock

top="$(admin <<'SQL'
select coalesce(json_agg(t), '[]') from (
  select left(regexp_replace(query, '\s+', ' ', 'g'), 160) as query, calls,
         round(total_exec_time::numeric, 1) as total_ms, round(mean_exec_time::numeric, 3) as mean_ms
  from extensions.pg_stat_statements
  where query !~* '^(begin|commit|set |select set_config|reset|show|deallocate)'
  order by total_exec_time desc limit 8) t;
SQL
)"
hid="$(jq -r '.households.home.id' "$FG_STATE_DIR/runs/$run.json")"
uid="$(jq -r '.users.ann.id' "$FG_STATE_DIR/runs/$run.json")"
cols='id,name,quantity,brand,properties,category_id,store_id,sort_key,status,created_at,updated_at,bought_at,added_by,categorized_via,canonical_key'
cost() { admin <<SQL | sed -n 's/.*"Total Cost": \([0-9.]*\).*/\1/p' | head -1
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"$uid","role":"authenticated"}', true) \\g /dev/null
explain (format json) $1;
rollback;
SQL
}
plans="$(jq -n \
  --arg active "$(cost "select $cols from public.items where household_id = '$hid' and status = 'active'")" \
  --arg bought "$(cost "select $cols from public.items where household_id = '$hid' and status = 'bought' order by bought_at desc limit 50")" \
  --arg profiles "$(cost "select id, display_name from public.profiles")" \
  --arg usuals "$(cost "select * from public.suggest_items('$hid', '', 200)")" \
  '{items_active: ($active|tonumber? // null), items_bought: ($bought|tonumber? // null), profiles: ($profiles|tonumber? // null), suggest_items_call: ($usuals|tonumber? // null)}')"
docker_parts="$(jq -s 'group_by(.Name) | map({key: (.[0].Name | sub("^supabase_"; "") | sub("_family-groceries-[0-9]+$"; "")),
  value: {cpu_mean_pct: ((map(.CPUPerc | rtrimstr("%") | tonumber) | add / length) * 10 | round / 10),
          mem_max_mib: (map(.MemUsage | split(" / ")[0] | capture("(?<n>[0-9.]+)(?<u>[KMG]i?B)")
            | (.n | tonumber) * ({"KiB": (1 / 1024), "MiB": 1, "GiB": 1024}[.u] // 1)) | max | round), samples: length}}) | from_entries' "$stats")"
scripts/fg teardown "$run" >/dev/null || true

jq -c -n --slurpfile b "$bench" --argjson top "$top" --argjson plans "$plans" --argjson docker "$docker_parts" \
  --arg load "$(paste -sd'|' "$stats.load")" --arg git "$(git rev-parse --short HEAD)$([[ -z $(git status --porcelain -- supabase tool) ]] || echo '+dirty')" --arg at "$(date -Iseconds)" '
  $b[0] as $r
  | [$r.paths[] | .seq.p95, .conc.p95] as $p95
  | {goal: "hc-backend-perf",
     # A failed request can be a fast 4xx: no score for a run with errors.
     score: (if $r.errors > 0 then null
             else ((($p95 | map(log) | add) / ($p95 | length)) | exp | . * 100 | round / 100) end),
     higher_is_better: false,
     parts: {seed: $r.seed, warmup: $r.warmup, seq_n: $r.seq, workers: $r.workers, conc_rounds: $r.concRounds,
             requests: $r.requests, errors: $r.errors, error_samples: $r.errorSamples,
             fixture: "300 open + 5000 bought (tool/hillclimb/hc-backend-perf/hc-backend-perf.yaml)",
             host_loadavg_before_after: $load, paths: $r.paths, plan_cost: $plans, top_statements: $top, docker: $docker},
     git: $git, at: $at}' >&3
