# Job 26: public MCP URL https://mcp.hummlist.com

PRs:
- Part A, merged: https://github.com/trost-systems/family-groceries/pull/80 (main 9c725ae).
- Part B: https://github.com/trost-systems/family-groceries/pull/82 (the app shows the public URL), after `Lead: mcp.hummlist.com live` at 15:44.

## What was built

- **`mcp-proxy/`**: `vercel.json` and a README for the Vercel project `hummlist-mcp`. It holds rewrites only:
  - `/.well-known/oauth-protected-resource`, `/` and `/:path*` go to the `mcp` edge function on supabase.co.
  - Every destination carries the marker `?via=mcp-hummlist`.
  - Caching is off (`x-vercel-enable-rewrite-caching: 0`).
  - There is no build, no env vars and no secrets.
- **`supabase/functions/mcp/handler.ts`**: a request with the marker, or with the allow-listed `x-forwarded-host`, gets `resource: https://mcp.hummlist.com` and `resource_metadata="https://mcp.hummlist.com/.well-known/oauth-protected-resource"`. Every other request gets the old supabase.co values, unchanged. The issuer is unchanged. The public host is an allowed `Origin`. `MCP_PUBLIC_URL` defaults to `https://mcp.hummlist.com` in code, so no secret step is needed.
- **`scripts/mcp-smoke.sh <mcp url>`** walks discovery like a client: the 401 challenge, a bad token, the metadata on the same host, then the authorization server metadata. `initialize` + `tools/list` run with `MCP_SMOKE_TOKEN` and report `SKIP` without it. `scripts/smoke-remote.sh`, which runs after every deploy, calls it for the supabase.co URL.
- **Part B (#82)**: `Environment.mcpUrl` is `https://mcp.hummlist.com` for the production project and `<SUPABASE_URL>/functions/v1/mcp` for any other project. Zugänge shows and copies it.
- **Docs**: `docs/MCP.md` (public URL section), `mcp-proxy/README.md` (Vercel limits), `docs/DECISIONS.md` Job 26 (items 1 to 13), `docs/NEEDS_LEAD.md#mcphummlistcom`, `docs/DEPLOY.md`, and the verify skill's `hosted-backend.md` and `mcp-access.md`.

## Which proxy signal is live

The query marker. After the deploy, a direct request to supabase.co with `x-forwarded-host: mcp.hummlist.com` still got supabase.co values: the hosted gateway replaces the header, as Kong does locally. The same request with `?via=mcp-hummlist` got `https://mcp.hummlist.com`. Details are in DECISIONS item 11.

## Vercel limits found (mcp-proxy/README.md)

- 120 s to the first byte, then the stream stays open while data keeps coming at least every 120 s.
- No documented body limit for external rewrites.
- Streaming through the proxy is not documented. The function's answers are short SSE streams that close after the result, and GET gets 405, so nothing long-lived has to pass the proxy.
- New projects cache external rewrites by default, so caching is turned off.
- Vercel documents `/.well-known` as "reserved", but the external rewrite of `/.well-known/oauth-protected-resource` works on mcp.hummlist.com (item 13).
- Hobby is free up to 1M CDN requests and 100 GB a month, for non-commercial use.
- If the proxy fails, the supabase.co URL keeps working.

## How verified

- Deno: 15 handler tests, 7 of them new (direct, proxied by marker and by header, foreign host and marker, `MCP_PUBLIC_URL` override, Origin, issuer unchanged).
- A local rehearsal of the proxy. `npx vercel build` (offline) compiled the routes, and a throwaway proxy replayed them against the local function. Both URLs passed `mcp-smoke.sh` at once, the token checks included. The MCP Inspector CLI added and listed an item through the proxy. The local authorization server accepted `resource=https://mcp.hummlist.com`.
- #80: CI green on its final head 97449b3 (https://github.com/trost-systems/family-groceries/actions/runs/40699047554). GitHub's rebase merge wrote that commit to main as 9c725ae, with the same tree. Supabase deploy run https://github.com/trost-systems/family-groceries/actions/runs/40702648968 deployed it, and its smoke step passed with the new checks. Two Sonnet review rounds (`selfreview.partA*.md` in the job's ops directory). The merged head fixes every must-fix item. The last one, a menu path in NEEDS_LEAD, was not re-reviewed.
- #82: flutter gate (295 tests). The e2e OAuth MCP spec passed locally with the new assertion that a local build shows its own function URL. Screenshots came from a release build with production defaults, served from the local stack.

Production after the deploy (`scripts/mcp-smoke.sh https://jdwqrallbpdbshrdhenk.supabase.co/functions/v1/mcp`):

```
MCP smoke test against https://jdwqrallbpdbshrdhenk.supabase.co/functions/v1/mcp
PASS no token: 401, resource_metadata on the same host (https://jdwqrallbpdbshrdhenk.supabase.co/functions/v1/mcp/.well-known/oauth-protected-resource)
PASS bad token: 401 invalid_token, same resource_metadata
PASS protected resource metadata: 200, resource https://jdwqrallbpdbshrdhenk.supabase.co/functions/v1/mcp, authorization server https://jdwqrallbpdbshrdhenk.supabase.co/auth/v1
PASS authorization server metadata: https://jdwqrallbpdbshrdhenk.supabase.co/.well-known/oauth-authorization-server/auth/v1 has authorization, token and registration endpoints
SKIP initialize + tools/list: MCP_SMOKE_TOKEN not set
all checks passed against https://jdwqrallbpdbshrdhenk.supabase.co/functions/v1/mcp
```

`https://mcp.hummlist.com` after the Lead created the project (`scripts/mcp-smoke.sh https://mcp.hummlist.com`, 2026-10-28 15:4x):

```
MCP smoke test against https://mcp.hummlist.com
PASS no token: 401, resource_metadata on the same host (https://mcp.hummlist.com/.well-known/oauth-protected-resource)
PASS bad token: 401 invalid_token, same resource_metadata
PASS protected resource metadata: 200, resource https://mcp.hummlist.com, authorization server https://jdwqrallbpdbshrdhenk.supabase.co/auth/v1
PASS authorization server metadata: https://jdwqrallbpdbshrdhenk.supabase.co/.well-known/oauth-authorization-server/auth/v1 has authorization, token and registration endpoints
SKIP initialize + tools/list: MCP_SMOKE_TOKEN not set
all checks passed against https://mcp.hummlist.com
```

Through the proxy, two metadata fetches came back `x-vercel-cache: MISS`, a CORS preflight got 204 with the MCP headers, and the supabase.co URL still passed `mcp-smoke.sh` with its own values.

## Incident: one e2e run hit production sign-up

A local e2e run of the MCP spec reused a leftover static server of mine on the e2e port. That server held the production-default build, so the test's sign-up went to the production project and got HTTP 400 (twice). A read-only count on production found no `@example.test` user created in the 3 hours before. I stopped the server and reran; the rerun passed against the local stack. Lesson: never leave a server on the e2e port. Playwright reuses whatever answers there.

## What's left, for whom

- **Peter**: nothing.
- **Lead**: nothing. The project is live.
- **Clients**: anyone on the supabase.co URL can stay on it or switch to `https://mcp.hummlist.com`. Switching means reconnecting, because the resource changes.
