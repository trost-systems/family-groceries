#!/usr/bin/env bash
# Installs the Flutter that CI uses (FLUTTER_VERSION in ci.yml) as ~/flutter-<version>, where
# scripts/lib.sh looks for it first. A ~/flutter of another version stays as it is: other
# checkouts on the box may need it. Linux only, no root. Does nothing when the gates already find
# CI's version; two runs at once take turns. Ends 0 only when the gates will find that version.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

version="$(ci_flutter_version)"
target="$HOME/flutter-$version"
releases="${FLUTTER_RELEASES:-https://storage.googleapis.com/flutter_infra_release/releases}"
stop() { echo "install-flutter: $*" >&2; exit 1; }

if (require_ci_flutter) 2>/dev/null; then
  log "Flutter $version is on the gates' PATH: $(command -v flutter)"
  exit 0
fi
[[ -z ${FLUTTER_DIR:-} ]] || stop "FLUTTER_DIR is $FLUTTER_DIR, which is not Flutter $version, and the gates take it before $target: unset it and run this again"
[[ "$(uname -s)" == Linux ]] || stop "Linux only: install Flutter $version yourself and set FLUTTER_DIR to it"
exec 9>>"$target.lock"
flock 9
if [[ -e $target ]]; then
  # Another run's, finished while this one waited for the lock, or not an SDK of this version.
  have="$(flutter_version_of "$target/bin/flutter")"
  [[ $have == "$version" ]] || stop "$target exists and is not Flutter $version (${have:-no bin/flutter that runs}): move it away and run this again"
else
  release="$(curl -fsSL "$releases/releases_linux.json" \
    | jq -r --arg v "$version" 'first(.releases[] | select(.version == $v and .channel == "stable")) | "\(.archive) \(.sha256)"')"
  read -r archive sha256 <<<"$release"
  [[ -n $archive && ${sha256:-null} != null ]] || stop "$releases/releases_linux.json has no stable release $version with a sha256"
  log "downloading $archive"
  # Fetched and unpacked beside the target and moved, so a run that dies leaves no half an SDK there.
  work="$(mktemp -d "$target.XXXXXX")"
  trap 'rm -rf "$work"' EXIT
  curl -fsSL -o "$work/archive" "$releases/$archive"
  echo "$sha256  $work/archive" | sha256sum --check --status || stop "$archive is not the file the release list names (sha256)"
  mkdir "$work/sdk"
  tar -xJf "$work/archive" --strip-components=1 -C "$work/sdk"
  # The sha256 says it is the list's archive, not that the list named the right one.
  have="$(flutter_version_of "$work/sdk/bin/flutter")"
  [[ $have == "$version" ]] || stop "$archive unpacks to ${have:-no bin/flutter that runs}, not Flutter $version"
  mv -T "$work/sdk" "$target"
fi
"$target/bin/flutter" config --no-analytics --enable-web >/dev/null
# What a gate does next: lib.sh again, now that the target is there, and its check.
(source "$(dirname "$0")/lib.sh" && require_ci_flutter)
log "installed: Flutter $version in $target"
