#!/usr/bin/env bash
# No secret in the full history or the working tree.
set -euo pipefail
source "$(dirname "$0")/../lib.sh"
cd "$REPO_ROOT"
gitleaks git --no-banner --redact --verbose .
gitleaks dir --no-banner --redact --verbose .
