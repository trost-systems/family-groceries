# Job 158: a page for people at mcp.hummlist.com

PR: https://github.com/trost-systems/family-groceries/pull/304 (lead merges).

## What was built

- A person who opens https://mcp.hummlist.com in a browser gets a static page in German or English
  instead of the function's 401 JSON. The page is in `mcp-proxy/public/` (`de.html`, `en.html`,
  `static/`). It says the address is for AI assistants that support MCP and shows it with a copy
  button. It links to the guides, hummlist.com, the imprint and the privacy policy. A small scene
  shows a request becoming a list row, and it holds still under reduced motion. Light and dark
  mode. `noindex`, no tracking, no cookies, no external requests, no build, no dependencies.
- `mcp-proxy/vercel.json` rewrites `/` to `/de` or `/en` only for a browser navigation: `Accept`
  names `text/html`, with no `text/event-stream`, `Content-Type`, `Authorization`,
  `Mcp-Session-Id` or `MCP-Protocol-Version`. The first `Accept-Language` tag picks the language.
  Every other request goes to the function as before. Every response gets `X-Robots-Tag: noindex`.
- Tests: `scripts/mcp-proxy-routes_test.ts` (lint gate, 47 cases, both readings of Vercel's `has`
  regex). `scripts/mcp-smoke.sh` has an opt-in page check (`MCP_SMOKE_PAGE=1`) with fixture tests.
  The brand-name lint also scans `mcp-proxy/public`.
- Docs: `mcp-proxy/README.md`, `docs/MCP.md`, AGENTS.md, DECISIONS "Job 158", feature map
  (`ai-url-page`, FEATURES-FOR-WRITERS).

## Deviations from the brief

- The copy names no AI product. The brief's example names two, but Legal N-80..N-86 and the
  standing rule allow brand names only in setup help.
- No bee: the repo has no mascot, and the ui-craft skill rules a bee out. The page uses the app
  icon.

## How to verify

- `deno test -q --config scripts/deno.json --allow-read scripts/mcp-proxy-routes_test.ts`
- `npx -y -p node@22 node --test scripts/mcp-smoke.test.mjs`
- After the deploy: `MCP_SMOKE_PAGE=1 scripts/mcp-smoke.sh https://mcp.hummlist.com` and open
  https://mcp.hummlist.com in a browser.

## Results

- `scripts/verify.sh --only gitleaks,lint` passed. Routes test 47/47 pass. Removing any one of the
  five guards fails a case. Smoke fixture tests 16/16 pass on Node 22.
- Production before the deploy: the discovery smoke passes. The page checks fail with the 401
  JSON, as expected before the deploy.
- Local Chromium at 390, 1280 and 1440 px, DE and EN, light and dark: no CSP violations, no
  console errors, no external requests. The copy button writes the address, and reduced motion
  stops the scene.
- Screenshots: `docs/screenshots/158/`.

## Missing or blocked

- Vercel's real routing is unproven until the deploy. `hummlist-mcp` previews need a Vercel login,
  and `vercel dev` does not evaluate `has`. After the merge, run the smoke above. If it fails, revert
  the PR.
- Follow-up once that passes: set `MCP_SMOKE_PAGE=1` for the prod probe in
  `scripts/gates/site-agent.sh`. It can't be set now, because that gate probes production before the
  merge.
- The MCP initialize with a token was not run against production, because this box has no
  production token. The routes test covers initialize POSTs, and the smoke covers the
  initialize POST without a token (401) and the OAuth discovery.
