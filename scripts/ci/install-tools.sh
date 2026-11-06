#!/usr/bin/env bash
# Installs CI's pinned tools into $FG_CI_TOOLS/bin, which ci.yml caches per tool version. A tool
# whose binary already reports its pinned version is skipped, so a cache hit downloads nothing.
# The versions come from ci.yml's env block.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bin="${FG_CI_TOOLS:-$HOME/.cache/fg-ci-tools}/bin"
mkdir -p "$bin"

if [[ $# -eq 0 ]]; then
  echo "usage: $0 <gitleaks|actionlint|ast-grep|squawk>..." >&2
  exit 2
fi

# Whether binary $1 reports version $2 as a whole number: 1.7.1 must not match 1.7.12.
reports_version() { "$1" --version 2>&1 | grep -qE "(^|[^0-9.])${2//./\\.}([^0-9.]|\$)"; }

for tool in "$@"; do
  # version: the pin; url: the release asset; kind: how the binary comes out of it.
  case $tool in
    gitleaks)
      version="${GITLEAKS_VERSION:?GITLEAKS_VERSION is unset (ci.yml env)}"
      url="https://github.com/gitleaks/gitleaks/releases/download/v${version}/gitleaks_${version}_linux_x64.tar.gz"
      kind=tar.gz ;;
    actionlint)
      version="${ACTIONLINT_VERSION:?ACTIONLINT_VERSION is unset (ci.yml env)}"
      url="https://github.com/rhysd/actionlint/releases/download/v${version}/actionlint_${version}_linux_amd64.tar.gz"
      kind=tar.gz ;;
    ast-grep)
      version="${AST_GREP_VERSION:?AST_GREP_VERSION is unset (ci.yml env)}"
      url="https://github.com/ast-grep/ast-grep/releases/download/${version}/app-x86_64-unknown-linux-gnu.zip"
      kind=zip ;;
    squawk)
      version="${SQUAWK_VERSION:?SQUAWK_VERSION is unset (ci.yml env)}"
      url="https://github.com/sbdchd/squawk/releases/download/v${version}/squawk-linux-x64"
      kind=binary ;;
    *)
      echo "install-tools: unknown tool '$tool' (gitleaks, actionlint, ast-grep, squawk)" >&2
      exit 2 ;;
  esac

  if [[ -x $bin/$tool ]] && reports_version "$bin/$tool" "$version"; then
    echo "$tool $version: cached"
    continue
  fi

  tmp="$(mktemp -d)"
  "$here/download.sh" "$url" "$tmp/asset"
  case $kind in
    tar.gz) tar -xzf "$tmp/asset" -C "$tmp" "$tool" && mv "$tmp/$tool" "$bin/$tool" ;;
    zip) unzip -o -q "$tmp/asset" "$tool" -d "$tmp" && mv "$tmp/$tool" "$bin/$tool" ;;
    binary) mv "$tmp/asset" "$bin/$tool" ;;
  esac
  chmod +x "$bin/$tool"
  rm -rf "$tmp"
  reports_version "$bin/$tool" "$version" || { echo "install-tools: $bin/$tool does not report version $version" >&2; exit 1; }
  echo "$tool $version: installed"
done

if [[ -n ${GITHUB_PATH:-} ]]; then
  echo "$bin" >>"$GITHUB_PATH"
fi
