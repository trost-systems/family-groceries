#!/usr/bin/env bash
# hc-ui-web guardrails for a kept step: only allowed paths changed since the baseline, the site
# gate (npm test, build), every page's words identical to the baseline build (copy-check.mjs,
# preview and production builds), and the browser checks (crawl.mjs, contrast.mjs).
# Usage: tool/hillclimb/hc-ui-web/guard.sh   (HC_BASE: the base commit, default the merge-base with origin/main)
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"
base="${HC_BASE:-$(git -C "$repo" merge-base origin/main HEAD)}"
work=/tmp/hc103/guard
mkdir -p "$work"

forbidden="$(git -C "$repo" diff --name-only "$base" -- . \
  ':!site/public/*.css' ':!site/*.mjs' ':!site/test' ':!site/scenes' ':!site/public/media' \
  ':!tool/hillclimb/hc-ui-web' ':!docs/hillclimb/hc-ui-web.md' ':!docs/screenshots/103' \
  ':!docs/DECISIONS.md' ':!DONE_SUMMARY.md' ':!docs/done/103-hc-ui-web.md')"
if [ -n "$forbidden" ]; then
  echo "guard: changed outside the allowed paths:" >&2
  echo "$forbidden" >&2
  exit 1
fi
echo "guard: paths ok"

if [ ! -f "$work/base-$base/prod/de.html" ]; then
  rm -rf "$work/base-$base" "$work/src-$base"
  git -C "$repo" worktree add --detach "$work/src-$base" "$base" >/dev/null
  ln -s "$repo/site/node_modules" "$work/src-$base/site/node_modules"
  (cd "$work/src-$base/site" && node --input-type=module -e "
    const { build } = await import('./build.mjs');
    build({ outDir: process.argv[1] + '/prod', env: { VERCEL_ENV: 'production' } });
    build({ outDir: process.argv[1] + '/preview' });
  " "$work/base-$base")
  git -C "$repo" worktree remove --force "$work/src-$base"
fi

(cd "$repo" && scripts/gates/site.sh) >"$work/site-gate.log" 2>&1 || { tail -40 "$work/site-gate.log"; echo "guard: site gate failed" >&2; exit 1; }
grep -E '^ℹ (tests|pass|fail) ' "$work/site-gate.log" || true
echo "guard: site gate ok"

(cd "$repo/site" && node --input-type=module -e "
  const { build } = await import('./build.mjs');
  build({ outDir: process.argv[1], env: { VERCEL_ENV: 'production' } });
" "$work/prod")
node "$here/copy-check.mjs" "$work/base-$base/prod" "$work/prod"
node "$here/copy-check.mjs" "$work/base-$base/preview" "$repo/site/dist"

cd "$repo/site/checks"
flock /tmp/fg-e2e.lock node crawl.mjs ../dist >"$work/crawl.log" 2>&1 || { tail -40 "$work/crawl.log"; echo "guard: crawl failed" >&2; exit 1; }
tail -3 "$work/crawl.log"
flock /tmp/fg-e2e.lock node contrast.mjs ../dist --out "$work/contrast" >"$work/contrast.log" 2>&1 || { tail -40 "$work/contrast.log"; echo "guard: contrast failed" >&2; exit 1; }
tail -3 "$work/contrast.log"
echo "guard: all green"
