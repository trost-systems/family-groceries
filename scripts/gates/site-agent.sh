#!/usr/bin/env bash
# snacklist.app for AI agents (job 93, docs/AGENT_FIRST.md), the checks that need the network or a
# browser. The build's own agent checks (llms.txt, .md twins, robots, sitemap, hreflang, JSON-LD,
# links) run in the site gate. Here: the MCP probe's fixture tests, the probe against the public
# MCP URL without credentials, and the built site served like Vercel serves it: what an agent
# fetches from llms.txt and the sitemap, and the waitlist form (skipped until it is on main).
set -euo pipefail
source "$(dirname "$0")/../lib.sh"
cd "$REPO_ROOT"

log "MCP probe: fixture tests"
node --test scripts/mcp-smoke.test.mjs
log "MCP probe: https://mcp.snacklist.app, discovery only"
scripts/mcp-smoke.sh https://mcp.snacklist.app

log "site build"
cd site
npm ci --no-audit --no-fund
npm run build
cd checks
npm ci --no-audit --no-fund
# CI runners install the browser's system libraries with sudo; a local run has them already.
if [[ -n ${CI:-} ]]; then npx playwright install --with-deps chromium; else npx playwright install chromium; fi
log "served site and waitlist form"
node --test agent-http.test.mjs agent-forms.test.mjs
