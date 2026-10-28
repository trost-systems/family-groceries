# mcp-proxy

The Vercel project `hummlist-mcp` serves this directory at
`https://mcp.hummlist.com`, the public URL of the Hummlist MCP server. It
has no code, no build and no secrets. `vercel.json` rewrites every request
to the `mcp` edge function:

| Request on mcp.hummlist.com | Goes to (on `https://jdwqrallbpdbshrdhenk.supabase.co`) |
| --- | --- |
| `/.well-known/oauth-protected-resource` | `/functions/v1/mcp/.well-known/oauth-protected-resource` |
| `/` | `/functions/v1/mcp` |
| `/<path>` | `/functions/v1/mcp/<path>` |

Each destination carries the query marker `via=mcp-hummlist`, which tells
the function to advertise `https://mcp.hummlist.com` as the resource and
`https://mcp.hummlist.com/.well-known/oauth-protected-resource` as its
metadata (`supabase/functions/mcp/handler.ts`). Requests straight to
supabase.co keep getting the supabase.co URLs, so both URLs work. The
function also accepts `x-forwarded-host: mcp.hummlist.com`, which Vercel
sends, but Supabase's gateway replaces that header before it reaches the
function, so the marker is what works (`docs/DECISIONS.md`, Job 26, item 11). The
authorization server stays Supabase Auth on supabase.co.

`x-vercel-enable-rewrite-caching: 0` keeps Vercel from caching any response
(Vercel caches external rewrites by default for projects created after
2026-04-06).

## Check it

```bash
scripts/mcp-smoke.sh https://mcp.hummlist.com
MCP_SMOKE_TOKEN=fgp_… scripts/mcp-smoke.sh https://mcp.hummlist.com   # also initialize + tools/list
```

`npx vercel build` in a copy of this directory, with a hand-written
`.vercel/project.json`, compiles the routes offline without a login. The
compiled routes are in `.vercel/output/config.json`.

## Vercel limits (docs read 2026-10-28)

- **Timeout.** Vercel waits up to 120 s for the first byte from the origin,
  then keeps the response open while data arrives at least every 120 s
  ([limits](https://vercel.com/docs/limits),
  [changelog](https://vercel.com/changelog/cdn-origin-timeout-increased-to-two-minutes)).
  The function answers a POST with a short SSE stream that closes after the
  result, and answers GET with 405, so no stream stays open. A tool call
  slower than 120 s fails with `ROUTER_EXTERNAL_TARGET_ERROR` on this URL;
  the supabase.co URL has only the function's own limit.
- **Body size.** Vercel documents no limit for external rewrites (the 4.5 MB
  limit is for Vercel Functions). MCP requests here are a few KB.
- **Streaming.** Not documented. The responses are short SSE streams, so even
  a buffering proxy delivers them whole.
- **Headers.** Vercel documents the headers it adds: `x-forwarded-host`,
  `x-forwarded-proto`, `x-forwarded-for` and `x-real-ip`
  ([rewrites](https://vercel.com/docs/routing/rewrites)). It does not list
  which client headers it passes on. `scripts/mcp-smoke.sh` proves the ones
  MCP needs: the bad-token check needs `Authorization`, and `tools/list`
  with a token needs `Accept`, `Content-Type` and `MCP-Protocol-Version`.
  The function is stateless, so `Mcp-Session-Id` is never used. It never
  reads the upstream `Host` either.
- **`/.well-known`.** The rewrites page says the path "is reserved and
  cannot be redirected or rewritten". The external rewrite of
  `/.well-known/oauth-protected-resource` works on mcp.hummlist.com all the
  same (checked 2026-10-28 with `scripts/mcp-smoke.sh`, `docs/DECISIONS.md`
  Job 26, item 13).
- **Cost.** Hobby is free: 1,000,000 CDN requests and 100 GB Fast Data
  Transfer a month ([usage](https://vercel.com/docs/manage-cdn-usage)).
  Hobby is for non-commercial personal use
  ([fair use](https://vercel.com/docs/limits/fair-use-guidelines)).

If the proxy fails, `https://jdwqrallbpdbshrdhenk.supabase.co/functions/v1/mcp`
still works for every client.
