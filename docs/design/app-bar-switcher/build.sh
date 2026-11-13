#!/usr/bin/env bash
# Copies the sandbox into one self-contained static folder (for a Vercel preview).
# Usage: build.sh <out-dir>
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
site="$here/../../../site/public"
out="${1:?out dir}"
rm -rf "$out"
mkdir -p "$out/vendor/fonts"
cp "$here"/{index.html,proto.css,proto.js,model.js,variants.js,icons.js} "$out/"
cp "$site/tokens.css" "$out/vendor/"
cp "$site"/fonts/{bricolage-grotesque-latin-standard-normal,inter-latin-wght-normal}.woff2 "$out/vendor/fonts/"
sed -i 's#\.\./\.\./\.\./site/public/tokens\.css#vendor/tokens.css#' "$out/index.html"
sed -i 's#\.\./\.\./\.\./site/public/fonts/#vendor/fonts/#' "$out/proto.css"
