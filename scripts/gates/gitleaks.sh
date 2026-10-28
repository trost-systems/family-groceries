#!/usr/bin/env bash
# No secret in the full history or in what the working tree could commit: tracked files plus
# untracked ones .gitignore lets in. Ignored output (Playwright traces, builds) holds local-stack
# session tokens and reaches a commit only through `git add -f`, which the pre-commit hook scans.
set -euo pipefail
source "$(dirname "$0")/../lib.sh"
cd "$REPO_ROOT"
gitleaks git --no-banner --redact --verbose .
tree=$(mktemp -d)
trap 'rm -rf "$tree"' EXIT
git ls-files -z --cached --others --exclude-standard |
  tar --null --files-from=- --ignore-failed-read -cf - 2>/dev/null | tar -xf - -C "$tree"
cd "$tree"
gitleaks dir --no-banner --redact --verbose -c "$REPO_ROOT/.gitleaks.toml" .
