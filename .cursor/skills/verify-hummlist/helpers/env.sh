# shellcheck shell=bash
# Sourced by the verify-hummlist helpers. The instance is this checkout's own Supabase stack (its
# port block in supabase/config.toml), a static server for the web build on <prefix>81 and one
# fg seed run of demo users. Override with VH_* variables; never point them at another job's stack.
VH_HELPERS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VH_SKILL="$(dirname "$VH_HELPERS")"
# shellcheck source=../../../../scripts/lib.sh
source "$VH_HELPERS/../../../../scripts/lib.sh"
# shellcheck disable=SC1091 # the Hetzner runner's PATH (flutter, supabase, node); absent elsewhere
[[ -f $HOME/groceries-ops/env.hz ]] && source "$HOME/groceries-ops/env.hz"

VH_PREFIX="$(sed -n 's/^port = \([56][0-9][0-9]\)21$/\1/p' "$REPO_ROOT/supabase/config.toml" | head -1)"
VH_PROJECT_ID="$(project_id)"
VH_STATE_DIR="${VH_STATE_DIR:-$HOME/.cache/verify-hummlist/$VH_PREFIX}"
VH_EVIDENCE_DIR="${VH_EVIDENCE_DIR:-$HOME/hummlist-evidence}"
VH_WEB_PORT="${VH_WEB_PORT:-${VH_PREFIX}81}"
VH_WEB_URL="http://127.0.0.1:$VH_WEB_PORT"
VH_BUILD_DIR="$REPO_ROOT/app/build/verify-hummlist-web"
VH_INSTANCE="$VH_STATE_DIR/instance.json"
export VH_HELPERS VH_SKILL VH_PREFIX VH_PROJECT_ID VH_STATE_DIR VH_EVIDENCE_DIR VH_WEB_PORT VH_WEB_URL VH_BUILD_DIR VH_INSTANCE

# fg (seed, teardown, db query) on this checkout's stack, with its run files in our state dir.
export FG_PORT_PREFIX="$VH_PREFIX" FG_PROJECT_ID="$VH_PROJECT_ID" FG_STACK_WORKDIR="$REPO_ROOT" \
  FG_STATE_DIR="$VH_STATE_DIR/fg" FG_EVIDENCE_DIR="$VH_EVIDENCE_DIR"

# What a production build gets (app/config/auth.json minus the hosted Google client and APP_URL),
# with the e2e stand-in PostHog host so nothing reaches a real PostHog project.
vh_defines() {
  cat <<'JSON'
{
  "GOOGLE_WEB_CLIENT_ID": "family-groceries-e2e",
  "SIGN_IN_WITH_APPLE": "true",
  "POSTHOG_PROJECT_API_KEY": "phc_e2e_fake_collector",
  "POSTHOG_HOST": "https://posthog.invalid"
}
JSON
}

# The source the web build comes from: app/'s tree at HEAD plus any uncommitted change under app/.
vh_build_stamp() {
  { git -C "$REPO_ROOT" rev-parse HEAD:app; git -C "$REPO_ROOT" diff HEAD -- app; vh_defines; } | sha256sum | cut -c1-16
}

vh_json() { node -e 'const s=require(process.argv[1]);console.log(process.argv[2].split(".").reduce((o,k)=>o?.[k],s)??"")' "$VH_INSTANCE" "$1"; }

# The pid listening on the web port, if any.
vh_server_pid() { ss -ltnpH "sport = :$VH_WEB_PORT" 2>/dev/null | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1; }
