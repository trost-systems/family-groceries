#!/usr/bin/env bash
# Deno for CI without denoland/setup-deno (.github/actions/deno, which falls back to setup-deno only
# when resolve fails). setup-deno retries its download only 3 times and versions.json for ~8 s.
#   resolve <range>  prints the version setup-deno picks: an exact version (2.9.8, as in .dvmrc)
#                    as is, without the network; for a vN.x or N.x range the newest stable vN.*.*
#                    in dl.deno.land/versions.json, as its semver.maxSatisfying does on the same
#                    file. Fails for any other range or when the fetch fails.
#   fetch <version>  downloads that release, checks it against the release's .sha256sum and
#                    unpacks it into $RUNNER_TOOL_CACHE/deno/<version>/<arch>.
#   path <version>   checks that release runs and puts it and ~/.deno/bin on $GITHUB_PATH.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"

resolve() {
  local major
  if [[ $1 =~ ^v?([0-9]+\.[0-9]+\.[0-9]+)$ ]]; then
    echo "${BASH_REMATCH[1]}"
    return
  fi
  if [[ ! $1 =~ ^v?([0-9]+)\.x$ ]]; then
    echo "deno-toolcache: cannot resolve '$1', only an exact version or vN.x" >&2
    exit 1
  fi
  major="${BASH_REMATCH[1]}"
  local tmp version
  tmp="$(mktemp -d)"
  "$here/download.sh" "${FG_DENO_VERSIONS_URL:-https://dl.deno.land/versions.json}" "$tmp/versions.json"
  version="$(jq -r '.cli[]' "$tmp/versions.json" | { grep -E "^v${major}\.[0-9]+\.[0-9]+$" || true; } \
    | sort -V | tail -n 1 | sed 's/^v//')"
  rm -rf "$tmp"
  if [[ -z $version ]]; then
    echo "deno-toolcache: no stable v$major release in versions.json" >&2
    exit 1
  fi
  echo "$version"
}

cache_arch() {
  case "$(uname -m)" in
    x86_64 | amd64) echo x64 ;;
    aarch64 | arm64) echo arm64 ;;
    *) echo "deno-toolcache: unsupported machine $(uname -m)" >&2; exit 1 ;;
  esac
}

path() {
  local dir
  dir="${RUNNER_TOOL_CACHE:?RUNNER_TOOL_CACHE is unset}/deno/$1/$(cache_arch)"
  "$dir/deno" --version | head -n 1
  printf '%s\n' "$dir" "${DENO_INSTALL_ROOT:-$HOME/.deno/bin}" >>"${GITHUB_PATH:?GITHUB_PATH is unset}"
}

fetch() {
  local version="$1" arch platform
  case "$(cache_arch)" in
    x64) arch=x86_64 ;;
    arm64) arch=aarch64 ;;
  esac
  case "$(uname -s)" in
    Linux) platform=unknown-linux-gnu ;;
    Darwin) platform=apple-darwin ;;
    *) echo "deno-toolcache: unsupported OS $(uname -s)" >&2; exit 1 ;;
  esac
  # The @actions/tool-cache layout: <tool>/<version>/<arch> plus a <arch>.complete marker.
  local dir zip tmp expected actual
  dir="${RUNNER_TOOL_CACHE:?RUNNER_TOOL_CACHE is unset}/deno/$version/$(cache_arch)"
  zip="${FG_DENO_RELEASES_URL:-https://github.com/denoland/deno/releases/download}/v$version/deno-$arch-$platform.zip"
  tmp="$(mktemp -d)"
  "$here/download.sh" "$zip" "$tmp/deno.zip"
  "$here/download.sh" "$zip.sha256sum" "$tmp/deno.zip.sha256sum"
  expected="$(awk '{print $1; exit}' "$tmp/deno.zip.sha256sum")"
  if command -v sha256sum >/dev/null; then
    actual="$(sha256sum "$tmp/deno.zip" | awk '{print $1}')"
  else
    actual="$(shasum -a 256 "$tmp/deno.zip" | awk '{print $1}')"
  fi
  if [[ -z $expected || $actual != "$expected" ]]; then
    echo "deno-toolcache: $zip has sha256 $actual, its .sha256sum says '$expected'" >&2
    rm -rf "$tmp"
    exit 1
  fi
  rm -rf "$dir" "$dir.complete"
  mkdir -p "$dir"
  unzip -o -q "$tmp/deno.zip" -d "$dir"
  rm -rf "$tmp"
  "$dir/deno" --version | head -n 1
  touch "$dir.complete"
}

if [[ $# -ne 2 || ! $1 =~ ^(resolve|fetch|path)$ ]]; then
  echo "usage: $0 resolve <range> | fetch <version> | path <version>" >&2
  exit 2
fi
"$1" "$2"
