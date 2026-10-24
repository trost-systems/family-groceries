# shellcheck shell=bash
# Shared helpers for scripts/*.sh and scripts/gates/*.sh. Source, don't run.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="${FLUTTER_DIR:-$HOME/flutter}/bin:$HOME/.deno/bin:$HOME/.local/bin:$PATH"
if command -v ruby >/dev/null; then PATH="$(ruby -e 'print Gem.user_dir')/bin:$PATH"; fi

log() { printf '\033[1;34m[%s]\033[0m %s\n' "$(basename "$0" .sh)" "$*"; }

# The whole stack is up (API, Auth, Realtime...), not just its database.
stack_running() { (cd "$REPO_ROOT" && supabase status -o env 2>/dev/null | grep -q '^API_URL='); }

project_id() { sed -n 's/^project_id = "\(.*\)"$/\1/p' "$REPO_ROOT/supabase/config.toml"; }

# Starts the local Supabase stack if it is not running and exports its URLs and publishable key,
# so the e2e tests and the web build talk to this checkout's stack whatever its port block.
# The lock lets CI start the stack in the background early (ci.yml) while this waits for it.
supabase_up() {
  (
    cd "$REPO_ROOT" && flock 7
    stack_running && exit 0
    # `supabase start` leaves a database started alone (`supabase db start`) as it is and
    # starts nothing else, so stop it first. Only this checkout's project is stopped.
    if docker ps -q --filter "name=^supabase_db_$(project_id)$" | grep -q .; then supabase stop --no-backup; fi
    supabase start
  ) 7>"/tmp/fg-supabase-start-$(project_id).lock"
  local env
  env="$(cd "$REPO_ROOT" && supabase status -o env 2>/dev/null)"
  SUPABASE_URL="$(sed -n 's/^API_URL="\(.*\)"$/\1/p' <<<"$env")"
  SUPABASE_PUBLISHABLE_KEY="$(sed -n 's/^PUBLISHABLE_KEY="\(.*\)"$/\1/p' <<<"$env")"
  MAILPIT_URL="$(sed -n 's/^MAILPIT_URL="\(.*\)"$/\1/p' <<<"$env")"
  if [[ -z $SUPABASE_URL || -z $SUPABASE_PUBLISHABLE_KEY || -z $MAILPIT_URL ]]; then
    echo "supabase status did not report API_URL, PUBLISHABLE_KEY and MAILPIT_URL" >&2
    return 1
  fi
  export SUPABASE_URL SUPABASE_PUBLISHABLE_KEY MAILPIT_URL
}

flutter_defines() {
  echo "--dart-define=SUPABASE_URL=$SUPABASE_URL --dart-define=SUPABASE_PUBLISHABLE_KEY=$SUPABASE_PUBLISHABLE_KEY"
}

# Commits on main follow one shape (CLAUDE.md, COMMON.md): one commit per PR, subject
# "<PR title> (#n)", authored with the noreply address GitHub accepts, Peter's trailer last.
AUTHOR_NAME="petertrost-bot"
AUTHOR_EMAIL="341616691+petertrost-bot@users.noreply.github.com"
PETER_TRAILER='Co-authored-by: Peter Trost <peter@petertrost.com>'
TRAILERS=$'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n'"$PETER_TRAILER"

# Why <head> is not yet the commit main takes for <subject>, or nothing when it is.
# Needs origin/main fetched.
landing_problem() {
  local head="$1" subject="$2"
  if [[ "$(git merge-base origin/main "$head")" != "$(git rev-parse origin/main)" ]]; then
    echo "it is not on top of origin/main"
  elif [[ "$(git rev-list --count "origin/main..$head")" != 1 ]]; then
    echo "it has $(git rev-list --count "origin/main..$head") commits"
  elif [[ "$(git log -1 --format=%ae "$head")" != "$AUTHOR_EMAIL" ]]; then
    echo "its author is $(git log -1 --format=%ae "$head"), not $AUTHOR_EMAIL"
  elif [[ "$(git log -1 --format=%s "$head")" != "$subject" ]]; then
    echo "its subject is not '$subject'"
  elif [[ "$(git log -1 --format=%B "$head" | sed '/^$/d' | tail -n 1)" != "$PETER_TRAILER" ]]; then
    echo "its message does not end with Peter's trailer"
  fi
}

# Prints the id of one commit on origin/main with <head>'s tree, <subject>, the noreply
# author and the trailers. The body keeps every commit's message: the body of a commit that
# already carries <subject> (an earlier squash), subject and body of every other commit.
squash_commit() {
  local head="$1" subject="$2" body
  body="$(git log --reverse --format='%s%x00%b%x01' "origin/main..$head" \
    | awk -v RS='\001' -v subject="$subject" '{
        sub(/^\n/, ""); split($0, part, "\000")
        print (part[1] == subject ? "" : part[1] "\n\n") part[2]
      }' \
    | grep -v -e '^Co-authored-by:' -e '^Co-Authored-By:' | sed '/./,$!d')"
  printf '%s\n\n%s\n\n%s\n' "$subject" "$body" "$TRAILERS" | sed '/^$/N;/^\n$/D' \
    | GIT_AUTHOR_NAME="$AUTHOR_NAME" GIT_AUTHOR_EMAIL="$AUTHOR_EMAIL" \
      GIT_COMMITTER_NAME="$AUTHOR_NAME" GIT_COMMITTER_EMAIL="$AUTHOR_EMAIL" \
      git commit-tree "$(git rev-parse "$head^{tree}")" -p origin/main
}

# Rebases the current branch onto origin/main, carrying local edits of skip-worktree files (a
# checkout's port block in supabase/config.toml, COORDINATION.md) across: git refuses to rebase
# over them once main changes such a file.
rebase_onto_main() {
  local files=() patch
  mapfile -t files < <(git ls-files -v | sed -n 's/^S //p')
  patch="$(mktemp --suffix=.patch)"
  if [[ ${#files[@]} -gt 0 ]]; then
    git update-index --no-skip-worktree "${files[@]}"
    git diff -- "${files[@]}" >"$patch"
    git checkout -- "${files[@]}"
  fi
  if ! git rebase -q origin/main; then
    echo "rebase stopped; resolve it and run git rebase --continue." >&2
    [[ -s $patch ]] && echo "Then restore your local edits: git apply $patch && git update-index --skip-worktree ${files[*]}" >&2
    return 1
  fi
  if [[ ${#files[@]} -gt 0 ]]; then
    git apply "$patch"
    git update-index --skip-worktree "${files[@]}"
  fi
  rm -f "$patch"
}
