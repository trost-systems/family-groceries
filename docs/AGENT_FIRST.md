# snacklist.app for AI agents

An agent acting for a person should be able to sign that person up, connect Snacklist over MCP,
use the API once it is public, read the guides and find answers, without a browser session or
a human reading the page for it. Job 93 makes that a set of deterministic checks that run on
every PR. A check beats a rule: a broken `llms.txt` fails CI, a rule in a doc does not.

## What is built

The site build (`site/build.mjs`, the generators in `site/agent.mjs`) writes, next to every page:

| File | What it is |
| --- | --- |
| `/<page>.md` | The page as Markdown (the `.md` twin), e.g. `/en/guides/claude.md`. Every HTML page links its twin as `<link rel="alternate" type="text/markdown">`. |
| `/llms.txt` | The index for agents ([llmstxt.org](https://llmstxt.org)): the head from `site/content/llms.md`, then one list per section with every public page's twin. |
| `/llms-full.txt` | The same head and every twin's text in one file. |
| `/sitemap.xml` | The public page set: every built page without a `noindex` meta tag. |
| `/robots.txt` | Allows everything and names the sitemap. |
| JSON-LD | `WebSite` on the landing pages, `TechArticle` on guides, `FAQPage` on the support pages (the questions under „Häufige Fragen“ / "Common questions", `FAQ_HEADINGS` in `site/agent.mjs`; renaming that heading needs the list changed too, the `jsonld` check fails otherwise). |
| `/openapi.yaml` | `docs/api/openapi.yaml`, only while `releases/flags.json` has `public-api` on (it is off). |

`site/content/llms.md` is the only hand-written part: a one-line summary and how an agent gets
its person to Snacklist and connects the MCP server. Change it when that changes.

## The checks

| Check | Where | Fails when |
| --- | --- | --- |
| `md-twin` | build | a public HTML page has no `.md` twin, the twin's first line is not `# <h1>`, or the page doesn't link it |
| `llms-txt` | build | `llms.txt` breaks the llmstxt.org structure, a link doesn't resolve to a built file or anchor, a link leaves the site's `siteUrl` (only `https://mcp.snacklist.app` may), or a public page is missing |
| `llms-full` | build | `llms-full.txt` is missing a twin listed in `llms.txt` |
| `robots` | build | `robots.txt` disallows a page that carries `noindex` (crawlers could never see the `noindex`), or has no `Sitemap` line. The site-wide `X-Robots-Tag: noindex` header in `site/vercel.json` makes every page noindex until launch, so any `Disallow` of a page fails today |
| `launch` | build | `site/config/stage.ts` says `'launch'` and any `noindex` is left (the `X-Robots-Tag` header in `site/vercel.json` or a meta tag on a public page) |
| `hreflang` | build | a DE/EN pair doesn't point both ways, lacks itself or `x-default`, or names a page whose `lang` differs |
| `sitemap` | build | `sitemap.xml` is not exactly the public page set |
| `jsonld` | build | a JSON-LD block doesn't parse, misses a required property of its type, or the `FAQPage` questions differ from the page's |
| `structure` | build | a guide has no description, date or intro; a guide index misses a guide; a FAQ heading is not a question or has no answer |
| `links` | build | an internal link in a page, a twin or `llms*.txt` leads nowhere, including `#anchors` on other pages |
| `openapi` | build | `public-api` is on and `/openapi.yaml` is missing or invalid; skipped with that reason while it is off |
| served site | `site-agent` | served like Vercel serves it, a link from `llms.txt` or the sitemap doesn't answer 200 with the right content type |
| waitlist form | `site-agent` | a field has no label, there is a CAPTCHA, axe finds a serious or critical issue, the consent text differs by one byte from Legal's newest `site/content/legal/consent/waitlist-<locale>-v<n>.md`, or a sign-up doesn't end pending the mailed confirmation (202 and a thank-you that asks to confirm). Skipped until the waitlist (job 82) is on main; it turns on by itself when the consent texts arrive. |
| MCP + OAuth | `site-agent`, `e2e` | `scripts/mcp-smoke.sh`: the 401 challenge, Protected Resource Metadata, the authorization server's metadata, the hint-less discovery, then `initialize` and `tools/list` |

Every check has a fixture test that breaks one thing and expects that check to fail:
`site/test/agent.test.mjs` (build checks), `site/checks/agent-http.test.mjs`,
`site/checks/agent-forms.test.mjs` and `scripts/mcp-smoke.test.mjs` (a fake MCP server).

The MCP probe never uses a real household. CI runs it without credentials against
`https://mcp.snacklist.app` (discovery only; `initialize` and `tools/list` report `SKIP`), and
`e2e/tests/mcp-smoke.spec.ts` runs it with an access token of a throwaway household on the local
stack. `MCP_PROTOCOL_VERSION` picks the protocol version (default `2025-11-25`, what the server
speaks today).

## Run it locally

```bash
cd site && npm ci && npm test && npm run build    # build checks and their fixture tests
node agent.mjs dist                                # the build checks again, on any dist
scripts/verify.sh --only site,site-agent          # both gates, as CI runs them
node --test scripts/mcp-smoke.test.mjs             # the probe's fixture tests
scripts/mcp-smoke.sh https://mcp.snacklist.app      # the live probe, discovery only
scripts/verify.sh --only e2e -- tests/mcp-smoke.spec.ts   # the probe with a test household
```

`site-agent` needs Chromium (`npx playwright install chromium` in `site/checks`) and the
network for the live probe.

## Launch

The site stays `noindex` until launch. Launch is one line: `stage` in `site/config/stage.ts`
becomes `'launch'`. From then on the build fails until the `X-Robots-Tag: noindex` header is
gone from `site/vercel.json`, so the two changes land together.

## Needs a rule (no check can decide these)

Review these by hand when a page or the MCP server changes:

- [ ] A guide answers the task an agent was asked to do, from the person's side, in its first
  paragraph.
- [ ] Facts an agent needs (MCP address, how to sign up, what is free) are in text, never only
  in an image, video or animation.
- [ ] `site/content/llms.md` still says how a person gets Snacklist today (waitlist, beta or the
  stores) and how to connect the MCP server.
- [ ] A new FAQ question is phrased the way a person would ask it, and answered in its first
  sentence.
- [ ] The MCP tools' names and descriptions say what each tool does for the household, so an
  agent picks the right one.
- [ ] Nothing on the site promises a date, price or feature the app doesn't have yet.
