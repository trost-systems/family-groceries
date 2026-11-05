#!/usr/bin/env bash
# hc-memory: the Linux profile app's memory over a fixed scripted session (docs/hillclimb/hc-memory.md).
# Builds the profile bundle, seeds a fresh 300-item household on the checkout's local stack, runs
# session.mjs under Xvfb while holding /tmp/fg-hc-measure.lock, prints one JSON line.
# Score (lower is better) = 0.5 * peak RSS MB (VmHWM) + 0.5 * median RSS MB of the last 30 s of a 60 s idle.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(git -C "$here" rev-parse --show-toplevel)"
cd "$repo"
SEED=107
RUN_ID=hc-memory

env="$(supabase status -o env 2>/dev/null)" || { echo "local stack not running: supabase start" >&2; exit 1; }
api="$(sed -n 's/^API_URL="\(.*\)"$/\1/p' <<<"$env")"
key="$(sed -n 's/^PUBLISHABLE_KEY="\(.*\)"$/\1/p' <<<"$env")"
port="${api##*:}"
prefix="${port:0:3}"

export FG_PORT_PREFIX="$prefix"
FG_PROJECT_ID="$(sed -n 's/^project_id = "\(.*\)"$/\1/p' supabase/config.toml)"
export FG_PROJECT_ID
export FG_STACK_WORKDIR="$repo"
export FG_STATE_DIR="${HC_STATE_DIR:-$HOME/.cache/hc-memory/$FG_PROJECT_ID}"
export FG_SURFACE=linux
mkdir -p "$FG_STATE_DIR"

(
  cd app
  PATH="$repo/.cursor/skills/verify-family-groceries/linux-build:$PATH" flutter build linux --profile \
    -t test_driver/main_hc_memory.dart \
    --dart-define=SUPABASE_URL="$api" --dart-define=SUPABASE_PUBLISHABLE_KEY="$key" --dart-define=FAKE_STORE=ok
) >"$FG_STATE_DIR/build.log" 2>&1 || { tail -30 "$FG_STATE_DIR/build.log" >&2; exit 1; }
bundle="$repo/app/build/linux/x64/profile/bundle/family_groceries"

# The local stack is shared with verify sessions: put the Premium switch back and drop the run on any exit.
offer="$(scripts/fg db query "select enabled from app_switches where key = 'premium_offer'" 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).rows[0]?.enabled === true))')"
restore() {
  scripts/fg db query --write "update app_switches set enabled = $offer where key = 'premium_offer'" >/dev/null 2>&1 || true
  scripts/fg teardown "$RUN_ID" >/dev/null 2>&1 || true
}
trap restore EXIT

scripts/fg teardown "$RUN_ID" >/dev/null 2>&1 || true
scripts/fg seed "$repo/tool/hillclimb/hc-memory/hc-memory-300.yaml" --run-id "$RUN_ID" >"$FG_STATE_DIR/seed.json" 2>"$FG_STATE_DIR/seed.log" \
  || { cat "$FG_STATE_DIR/seed.json" "$FG_STATE_DIR/seed.log" >&2; exit 1; }
scripts/fg db query --write "update app_switches set enabled = true where key = 'premium_offer'" >/dev/null
manifest="$FG_STATE_DIR/runs/$RUN_ID.json"
email="$(node -e 'console.log(require(process.argv[1]).users.hc.email)' "$manifest")"
password="$(node -e 'console.log(require(process.argv[1]).users.hc.password)' "$manifest")"

session="$(flock /tmp/fg-hc-measure.lock xvfb-run -a -s '-screen 0 412x892x24 -nolisten tcp' \
  node "$here/session.mjs" "$bundle" "$email" "$password")"
household="$(node -e 'console.log(require(process.argv[1]).households.home.id)' "$FG_STATE_DIR/seed.json")"
added="array['Ingwer','Koriander','Petersilie','Basilikum','Rosmarin','Thymian','Oregano','Zimt','Muskat','Paprikapulver','Kurkuma','Kreuzkümmel','Lorbeer','Dill','Schnittlauch','Minze','Salbei','Vanillezucker','Backpulver','Hefe']"
work="$(scripts/fg db query "select count(*) filter (where status = 'active') as active, count(*) filter (where status = 'bought') as bought, array_agg(name) filter (where status = 'active' and name = any($added)) as left_active from items where household_id = '$household'" 2>/dev/null)"

node -e '
const [session, sha, seed, work] = process.argv.slice(1);
const s = JSON.parse(session);
const { active, bought } = JSON.parse(work).rows[0];
// 300 seeded + 20 added - 20 ticked: the session did its work.
if (active !== 300 || bought !== 20) { console.error(`work check failed: active ${active}, bought ${bought}, still active: ${JSON.parse(work).rows[0].left_active}`); process.exit(1); }
const score = Math.round((0.5 * s.peakRssMb + 0.5 * s.steadyRssMb) * 10) / 10;
console.log(JSON.stringify({
  goal: "hc-memory", score, higher_is_better: false,
  parts: { seed: Number(seed), items: 300, workActive: active, workBought: bought, window: "412x892", build: "profile", ...s },
  git: sha, at: new Date().toISOString(),
}));
' "$session" "$(git rev-parse --short HEAD)" "$SEED" "$work"
