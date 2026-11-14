#!/usr/bin/env bash
# Tests which Flutter SDK scripts/lib.sh puts on PATH and that require_ci_flutter refuses another
# version than CI's, with stub SDKs in a scratch home; that install-flutter.sh installs CI's
# version from a stub release list or says why not; and that every gate that runs Flutter calls
# require_ci_flutter before. Run by the lint gate.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
failures=0
fail() { echo "FAIL: $*" >&2; failures=$((failures + 1)); }

want="$(ci_flutter_version)"
[[ $want =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "ci.yml's FLUTTER_VERSION reads as '$want'"
# sdk <dir> <version>: a Flutter that only knows its version.
sdk() {
  mkdir -p "$1/bin"
  printf '#!/bin/sh\nprintf \047{\\n  "frameworkVersion": "%s",\\n  "channel": "stable"\\n}\\n\047\n' "$2" >"$1/bin/flutter"
  chmod +x "$1/bin/flutter"
}
# in_home <FLUTTER_DIR or ""> <commands>: runs them after lib.sh, as a gate does, in a shell that
# has only the scratch home.
in_home() {
  env -i HOME="$tmp/home" PATH=/usr/bin:/bin ${1:+FLUTTER_DIR="$1"} bash -c "set -euo pipefail; source '$REPO_ROOT/scripts/lib.sh'; $2" gate 2>&1
}
mkdir -p "$tmp/home"

[[ "$(in_home "" flutter_dir)" == "$tmp/home/flutter" ]] || fail "no SDK installed: $(in_home "" flutter_dir)"
out="$(in_home "" require_ci_flutter)" && fail "no flutter on PATH passes"
grep -q "flutter on PATH is missing (none), CI uses $want" <<<"$out" || fail "no flutter on PATH says: $out"

sdk "$tmp/home/flutter" 3.0.0
out="$(in_home "" require_ci_flutter)" && fail "Flutter 3.0.0 passes as $want"
grep -q "^gate: flutter on PATH is 3.0.0 ($tmp/home/flutter/bin/flutter), CI uses $want (.github/workflows/ci.yml): run scripts/install-flutter.sh (it adds ~/flutter-$want) or set FLUTTER_DIR to an SDK of that version$" <<<"$out" \
  || fail "the wrong version says: $out"

sdk "$tmp/home/flutter" "$want-0.1.pre"
in_home "" require_ci_flutter >/dev/null && fail "Flutter $want-0.1.pre passes as $want"

sdk "$tmp/home/flutter-$want" "$want"
[[ "$(in_home "" flutter_dir)" == "$tmp/home/flutter-$want" ]] || fail "the SDK of CI's version beside ~/flutter is not chosen: $(in_home "" flutter_dir)"
[[ "$(in_home "" "require_ci_flutter && command -v flutter")" == "$tmp/home/flutter-$want/bin/flutter" ]] || fail "CI's version beside ~/flutter does not pass"

[[ "$(in_home "$tmp/home/flutter" flutter_dir)" == "$tmp/home/flutter" ]] || fail "FLUTTER_DIR does not win"
in_home "$tmp/home/flutter" require_ci_flutter >/dev/null && fail "FLUTTER_DIR with another version passes"

# scripts/install-flutter.sh puts CI's version beside ~/flutter from the release list, once, and
# only the archive the list names. Linux only, like the script.
if [[ "$(uname -s)" == Linux ]]; then
  mkdir -p "$tmp/releases/stable/linux" "$tmp/archive"
  sdk "$tmp/archive/flutter" "$want"
  tar -cJf "$tmp/releases/stable/linux/flutter_linux_$want-stable.tar.xz" -C "$tmp/archive" flutter
  # list <sha256 of the stable archive>
  list() {
    cat >"$tmp/releases/releases_linux.json" <<JSON
{"releases": [
  {"version": "$want", "channel": "beta", "archive": "beta/linux/flutter_linux_$want-beta.tar.xz", "sha256": "$1"},
  {"version": "$want", "channel": "stable", "archive": "stable/linux/flutter_linux_$want-stable.tar.xz", "sha256": "$1"},
  {"version": "3.0.0", "channel": "stable", "archive": "stable/linux/flutter_linux_3.0.0-stable.tar.xz", "sha256": "$1"}
]}
JSON
  }
  sum="$(sha256sum "$tmp/releases/stable/linux/flutter_linux_$want-stable.tar.xz" | cut -d' ' -f1)"
  list "$sum"
  install() { env -i HOME="$tmp/home" PATH=/usr/bin:/bin FLUTTER_RELEASES="file://$tmp/releases" ${1:+FLUTTER_DIR="$1"} "$REPO_ROOT/scripts/install-flutter.sh" 2>&1; }
  leftovers() { find "$tmp/home" -mindepth 1 -maxdepth 1 -name "flutter-$want*" ! -name "flutter-$want.lock" ${1:+! -name "flutter-$want"}; }
  rm -rf "$tmp/home/flutter-$want"
  out="$(install "")" || fail "install-flutter.sh failed: $out"
  [[ "$(in_home "" "require_ci_flutter && command -v flutter")" == "$tmp/home/flutter-$want/bin/flutter" ]] || fail "after install-flutter.sh the gates do not find CI's version: $out"
  [[ -z "$(leftovers installed)" ]] || fail "install-flutter.sh left its work directory: $(leftovers installed)"
  mv "$tmp/releases/releases_linux.json" "$tmp/releases.json"
  out="$(install "")" || fail "a second install-flutter.sh run needs the release list: $out"

  rm -rf "$tmp/home/flutter-$want"
  out="$(install "")" && fail "install-flutter.sh passes without a release list"
  [[ -z "$(leftovers)" ]] || fail "a run without a release list left $(leftovers)"
  sed "s/\"$want\", \"channel\": \"stable\"/\"9.9.9\", \"channel\": \"stable\"/" "$tmp/releases.json" >"$tmp/releases/releases_linux.json"
  out="$(install "")" && fail "install-flutter.sh takes a beta archive"
  grep -q "has no stable release $want" <<<"$out" || fail "a version without a stable release says: $out"
  list "${sum//[0-9]/a}"
  out="$(install "")" && fail "install-flutter.sh takes an archive with another sha256 than the list's"
  grep -q "is not the file the release list names" <<<"$out" || fail "another sha256 says: $out"
  [[ -z "$(leftovers)" ]] || fail "a refused archive left $(leftovers)"
  # The list's own archive, holding another version or no flutter at all.
  mv "$tmp/releases/stable/linux/flutter_linux_$want-stable.tar.xz" "$tmp/right.tar.xz"
  sdk "$tmp/other/flutter" 3.0.0
  tar -cJf "$tmp/releases/stable/linux/flutter_linux_$want-stable.tar.xz" -C "$tmp/other" flutter
  list "$(sha256sum "$tmp/releases/stable/linux/flutter_linux_$want-stable.tar.xz" | cut -d' ' -f1)"
  out="$(install "")" && fail "install-flutter.sh installs an archive that holds another version"
  grep -q "unpacks to 3.0.0, not Flutter $want" <<<"$out" || fail "an archive of another version says: $out"
  [[ -z "$(leftovers)" ]] || fail "an archive of another version left $(leftovers)"
  rm "$tmp/other/flutter/bin/flutter"
  tar -cJf "$tmp/releases/stable/linux/flutter_linux_$want-stable.tar.xz" -C "$tmp/other" flutter
  list "$(sha256sum "$tmp/releases/stable/linux/flutter_linux_$want-stable.tar.xz" | cut -d' ' -f1)"
  out="$(install "")" && fail "install-flutter.sh installs an archive without bin/flutter"
  grep -q "unpacks to no bin/flutter that runs, not Flutter $want" <<<"$out" || fail "an archive without bin/flutter says: $out"
  [[ -z "$(leftovers)" ]] || fail "an archive without bin/flutter left $(leftovers)"
  mv "$tmp/right.tar.xz" "$tmp/releases/stable/linux/flutter_linux_$want-stable.tar.xz"

  # A target that is there and is not that SDK stays as it is, and so does a FLUTTER_DIR in the way.
  list "$sum"
  mkdir "$tmp/home/flutter-$want"
  out="$(install "")" && fail "install-flutter.sh passes with a directory without an SDK at its target"
  grep -q "flutter-$want exists and is not Flutter $want (no bin/flutter that runs): move it away" <<<"$out" || fail "a directory at the target says: $out"
  [[ -z "$(ls -A "$tmp/home/flutter-$want")" ]] || fail "install-flutter.sh wrote into the directory at its target: $(ls -A "$tmp/home/flutter-$want")"
  rmdir "$tmp/home/flutter-$want"
  sdk "$tmp/home/flutter-$want" 3.0.0
  out="$(install "")" && fail "install-flutter.sh passes with another version at its target"
  grep -q "exists and is not Flutter $want (3.0.0)" <<<"$out" || fail "another version at the target says: $out"
  rm -rf "$tmp/home/flutter-$want"
  sdk "$tmp/home/flutter" 3.0.0
  out="$(install "$tmp/home/flutter")" && fail "install-flutter.sh passes while FLUTTER_DIR keeps the gates on another version"
  grep -q "FLUTTER_DIR is $tmp/home/flutter, which is not Flutter $want" <<<"$out" || fail "a FLUTTER_DIR in the way says: $out"
  [[ -z "$(leftovers)" ]] || fail "a run with FLUTTER_DIR in the way installed anyway: $(leftovers)"
fi
sdk "$tmp/home/flutter-$want" "$want"

# Any line of a gate that names a flutter or dart command, however it is wrapped or indented.
for gate in "$REPO_ROOT"/scripts/gates/*.sh; do
  first="$(grep -nE '(^|[^[:alnum:]_./-])(flutter|dart) ' "$gate" | grep -vE '^[0-9]+: *#' | head -1 | cut -d: -f1 || true)"
  [[ -n $first ]] || continue
  check="$(grep -n '^require_ci_flutter$' "$gate" | head -1 | cut -d: -f1 || true)"
  [[ -n $check && $check -lt $first ]] || fail "$(basename "$gate") runs Flutter on line $first without require_ci_flutter before it"
done

if [[ $failures -gt 0 ]]; then
  echo "flutter-sdk-test: $failures failed" >&2
  exit 1
fi
log "the gates run CI's Flutter ($want) or say which one to install: all cases pass"
