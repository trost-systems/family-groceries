#!/usr/bin/env bash
# The product is Snacklist (job 174): no tracked file names Hummlist (any case) unless
# scripts/checks/hummlist-allow.txt lists it. Each allow-list line is a git pathspec glob, then
# two spaces and `# <exception n>[, <m>]: <reason>`; blank lines and `#` lines are comments. An entry
# that matches no hit any more is printed as stale, so the list shrinks as the exceptions retire.
# Usage: scripts/checks/no-hummlist.sh [repo-dir]   (default: this checkout). Run by scripts/lint.sh.
set -euo pipefail
root="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$root"
allow=scripts/checks/hummlist-allow.txt
[[ -f $allow ]] || { echo "no-hummlist: $allow is missing" >&2; exit 1; }

specs=()
bad=0
n=0
while IFS= read -r line || [[ -n $line ]]; do
  n=$((n + 1))
  [[ $line =~ ^[[:space:]]*(#|$) ]] && continue
  if [[ ! $line =~ ^([^[:space:]]+)\ \ \#\ [0-9]+(,\ [0-9]+)*:\ [^[:space:]] ]]; then
    echo "$allow:$n: '$line': write '<path or glob>  # <exception n>: <reason>'" >&2
    bad=1
    continue
  fi
  specs+=("${BASH_REMATCH[1]}")
done <"$allow"
((bad == 0)) || exit 1

excludes=()
for spec in ${specs[@]+"${specs[@]}"}; do excludes+=(":(exclude,glob)$spec"); done
# git grep exits 1 for no match; anything else is an error and must not pass as "clean".
code=0
hits="$(git grep -i -I -n -F hummlist -- . ${excludes[@]+"${excludes[@]}"})" || code=$?
((code <= 1)) || { echo "no-hummlist: git grep failed ($code)" >&2; exit 1; }
if ((code == 0)); then
  printf '%s\n' "$hits" >&2
  cat >&2 <<'EOF'
no-hummlist: the lines above name Hummlist, but the product is Snacklist (job 174). Rename them:
  Hummlist -> Snacklist, hummlist.com -> snacklist.app, app.hummlist.com -> app.snacklist.app,
  mcp.hummlist.com -> mcp.snacklist.app, <name>@hummlist.com -> <name>@snacklist.app.
Only if the old name must stay (old builds, redirects, store ids, history; CLAUDE.md's rename
exceptions) add the file to scripts/checks/hummlist-allow.txt with '  # <exception n>: <reason>'.
EOF
  exit 1
fi

# File and directory names too: git grep only reads contents.
files="$(git ls-files -- . ${excludes[@]+"${excludes[@]}"})"
names="$(grep -i hummlist <<<"$files" || true)"
if [[ -n $names ]]; then
  printf '%s\n' "$names" >&2
  echo "no-hummlist: the paths above name Hummlist: rename them (git mv) to Snacklist, or allow-list them" >&2
  exit 1
fi

for spec in ${specs[@]+"${specs[@]}"}; do
  git grep -q -i -I -F hummlist -- ":(glob)$spec" || git ls-files -- ":(glob)$spec" | grep -qi hummlist ||
    echo "no-hummlist: '$spec' in $allow has no hit any more: remove the line" >&2
done
echo "no-hummlist: ok (${#specs[@]} allow-list entries)"
