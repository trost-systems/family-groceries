#!/usr/bin/env bash
# Downloads <url> to <out-file>, retrying transient failures (a CDN's 504 failed the lint and
# functions jobs, issue #246) with curl's exponential backoff. The one place for retry flags.
# Always to a file: a retried transfer into a pipe would hand the reader the bytes twice.
# --speed-limit/--speed-time end an attempt that stalls (connected, no bytes), so it is retried;
# --retry-max-time alone only stops new attempts from starting.
set -euo pipefail
if [[ $# -ne 2 ]]; then
  echo "usage: $0 <url> <out-file>" >&2
  exit 2
fi
url="$1"
out="$2"
curl -fsSL --retry "${FG_DOWNLOAD_RETRIES:-7}" --retry-all-errors --retry-max-time 300 \
  --connect-timeout 30 --speed-limit 1024 --speed-time "${FG_DOWNLOAD_STALL_SECONDS:-30}" -o "$out" "$url"
