# Hosted backend

The hosted Supabase project stays reachable for the app, MCP clients and Siri. Every deploy from `main` ends with a smoke test of the edge functions, a daily keepalive keeps the free project from pausing, and a dispatch with an earlier `main` commit rolls the edge functions back. The full runbook is `docs/DEPLOY.md`.

## Sub-features

- `backend-health` answers `GET /functions/v1/health` with 200 and `{"ok": true, "database": true}` after one read from Postgres, and 503 with `"database": false` when Postgres doesn't answer.
- `backend-smoke` runs `scripts/smoke-remote.sh` after every deploy: health, the MCP Protected Resource Metadata, and 401 with `WWW-Authenticate` from `voice` and `mcp` for a bad token.
- `backend-keepalive` reads through `health` once a day (workflow Keepalive), re-enables its own schedule (and every push to `main` does too), and opens the issue "Keepalive failed" on failure (closed by the next green run).
- `backend-rollback` redeploys only the edge functions of an earlier `main` commit (workflow Supabase deploy, input `ref`) and smoke-tests them with that commit's script.

## How to get to it (user POV)

- An MCP client or the Siri Shortcut calls the hosted functions at `https://jdwqrallbpdbshrdhenk.supabase.co/functions/v1/`.
- A maintainer opens Actions › Keepalive or Actions › Supabase deploy › Run workflow.

## Driving it with fg

Preconditions:

- No `fg` stack is needed for the hosted checks. They need `curl`, `jq` and, for the workflows, `gh` signed in with access to `trost-systems/family-groceries`.

- **Hosted smoke test.** Run `scripts/smoke-remote.sh` from the repo root. Four lines start with `PASS`, the last line is `all checks passed against https://jdwqrallbpdbshrdhenk.supabase.co/functions/v1`, and the exit code is 0.
- **A wrong project fails.** Run `scripts/smoke-remote.sh https://jdwqrallbpdbshrdhenx.supabase.co`. Four lines start with `FAIL`, and the exit code is 1.
- **Local stack.** After `fg up`, run `scripts/smoke-remote.sh http://127.0.0.1:${FG_PORT_PREFIX}21`. All four checks pass. Stop the database container (`docker stop supabase_db_<project_id>`), then `curl -s -w ' %{http_code}' http://127.0.0.1:${FG_PORT_PREFIX}21/functions/v1/health` prints `{"ok":false,...,"database":false} 503` after about 5 s. Start the container again.
- **Keepalive.** Run `gh workflow run keepalive.yml -R trost-systems/family-groceries`, then `gh run watch` on the new run. It ends green, with "Postgres answered through ..." in the first step.
- **Rollback.** Run `gh workflow run supabase-deploy.yml -R trost-systems/family-groceries --ref main -f ref=<sha on main>`. The run shows the notice "Rollback: redeploying the edge functions of <sha>", skips Migrations, and Smoke test passes. A SHA not on `main`, or one older than `scripts/smoke-remote.sh`, fails in "Check out the rollback commit" before anything deploys.

## Gotchas

- A rollback or keepalive dispatch changes or touches production. The smoke test itself is read-only.
- A rollback lasts until the next push to `main` that touches `supabase/**` deploys `main` again.
- `workflow_dispatch` runs only workflows that are on `main`, so a new workflow can't be dispatched from its PR branch.
