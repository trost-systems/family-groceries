# Job 93: hummlist.com for AI agents, deterministic checks

PR: https://github.com/trost-systems/family-groceries/pull/223 (merged 2026-11-04, 66eb5851,
after lead review, see `docs/NEEDS_LEAD.md` "Job 93"). Guide and how to run everything:
[`docs/AGENT_FIRST.md`](../AGENT_FIRST.md). Decisions: `docs/DECISIONS.md` "Job 93".

## What was built

- **Agent files.** `site/agent.mjs` generates them from the rendered pages at build:
  `llms.txt` (its head is the hand-written `site/content/llms.md`), `llms-full.txt`, a `.md` twin
  of every page (linked from the page's head), `sitemap.xml` and `robots.txt`. JSON-LD on the
  landing pages (`WebSite`), the guides (`TechArticle`) and the support pages (`FAQPage`, from
  their „Häufige Fragen“ / "Common questions" section; Legal's files are unchanged). `openapi.yaml` is generated only while `public-api` is on (it is
  off).
- **Build checks.** Eleven checks in a registry read only `dist/`: md-twin, llms-txt,
  llms-full, robots, launch, hreflang, sitemap, jsonld, structure, links, openapi. Any
  problem fails `npm run build`, so it fails the `site` gate and Vercel builds.
- **Launch guard.** `site/config/stage.ts` holds the stage, shared with job 82's CTA stages.
  At `'launch'`, the build fails while `X-Robots-Tag: noindex` is still there. The stage stays
  `'waitlist'`.
- **New `site-agent` gate**, part of `ci-ok`, always run. It runs the MCP probe's fixture
  tests, then `scripts/mcp-smoke.sh https://mcp.hummlist.com` without credentials. It serves
  the built site the way Vercel does (`site/checks/agent-http.mjs`) and runs the waitlist form
  check in Chromium (`site/checks/agent-forms.mjs`). The form check is skipped until job 82's
  consent texts are on main.
- **MCP probe.** `scripts/mcp-smoke.sh` takes `MCP_PROTOCOL_VERSION` (default 2025-11-25;
  2026-07-28 works too) and runs stricter `initialize`, `notifications/initialized` and
  `tools/list` checks. It has a fake-server fixture test (`scripts/mcp-smoke.test.mjs`).
  `e2e/tests/mcp-smoke.spec.ts` runs the probe with a throwaway household's token.

## How to verify

- `cd site && npm ci && npm test && npm run build`. That is 115 tests, on Node 22 and 24.
- `scripts/verify.sh --only site,site-agent,lint` passed on hz.
- `scripts/verify.sh --only e2e -- tests/mcp-smoke.spec.ts` passed (2 tests, both protocol
  versions).
- Set the stage to `'launch'` in `site/config/stage.ts`. The build then fails with
  `launch: site/vercel.json: stage is launch ..., so remove the X-Robots-Tag noindex header`.
- On job 82's branch, `node --test agent-forms.test.mjs` in `site/checks` passes for `/de`
  and `/en`. Changing one character in `waitlist-de-v1.md` makes it fail at character 567.
- The llmstxt.org reference parser (`llms_txt` 0.0.7) parses the generated `llms.txt`.

## Screenshots

`docs/screenshots/93/` has the served `llms.txt`, a twin, `robots.txt` and `sitemap.xml`.

## Missing or blocked

- **Research file.** Scout's research file never reached hz (asked on BOARD at 22:44). The
  brief's items are built from the brief. The "needs a rule" checklist in
  `docs/AGENT_FIRST.md` is my own reading of what no check can decide. Reconcile it with the
  research once the file is on hz.
- **Waitlist form check.** It turns on when job 82 merges. If job 82 renames
  `[data-waitlist="signup"]`, `data-legal` or `data-state="done"`, update
  `site/checks/agent-forms.mjs` in the same PR.

## Review 0 fixes

- **Legal files unchanged.** `support.md` and `support-en.md` are back to main's text. The FAQ
  is now found by its heading title (`FAQ_HEADINGS` in `site/agent.mjs`). The diff against main
  under `site/content/legal/` is empty.
- **2026-07-28 tested.** The fake MCP server now answers `server/discover`. One test passes on
  that path, and one fails when the server doesn't list the version. That makes 13/13 tests.
- **TODO.** The probe's TODO no longer carries a past date.
- **Robots note.** `docs/AGENT_FIRST.md` now says the site-wide noindex header counts every page
  as noindex.
- **Live probe.** It stays blocking (DECISIONS Job 93, item 13).
- **Checks run.** `scripts/verify.sh --only site,site-agent` passed. Site tests passed 115/115,
  and both builds pass, including the production build.

