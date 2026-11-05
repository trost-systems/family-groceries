# Job 96: brand names and claims in live Hummlist copy (Legal N-80 to N-86)

PR https://github.com/trost-systems/family-groceries/pull/230, merged 2026-11-04 (c5a580a8) after Peter approved the text.
Vercel preview (Vercel login):
- Help: https://hummlist-site-git-job-96-brand-free-copy-peter-trost.vercel.app/support, https://hummlist-site-git-job-96-brand-free-copy-peter-trost.vercel.app/en/support
- Homepage: https://hummlist-site-git-job-96-brand-free-copy-peter-trost.vercel.app/de, https://hummlist-site-git-job-96-brand-free-copy-peter-trost.vercel.app/en
- Alexa guide: https://hummlist-site-git-job-96-brand-free-copy-peter-trost.vercel.app/de/anleitungen/alexa, https://hummlist-site-git-job-96-brand-free-copy-peter-trost.vercel.app/en/guides/alexa
- Claude guide: https://hummlist-site-git-job-96-brand-free-copy-peter-trost.vercel.app/de/anleitungen/claude, https://hummlist-site-git-job-96-brand-free-copy-peter-trost.vercel.app/en/guides/claude
- Impressum / Imprint: https://hummlist-site-git-job-96-brand-free-copy-peter-trost.vercel.app/impressum, https://hummlist-site-git-job-96-brand-free-copy-peter-trost.vercel.app/en/imprint

## Built
- **N-80.** The Siri FAQ on `/support` and `/en/support` answers with the Shortcut. The native-Siri answer
  waits behind the `native-siri` hold. New site gates `::: once <hold>`, `::: until <hold>` and the heading
  attribute `once=`/`until=` (`site/build.mjs`) read `releases/flags.json`, the same hold #217's
  `NATIVE_SIRI_LIVE` is built from. The guides' native sections get `once=native-siri` too.
  `site/test/gates.test.mjs` fails if native-Siri wording renders anywhere (pages, twins, llms*.txt, JSON)
  while the hold is off. On main's support page it fails.
- **N-81, N-82.** AI FAQ heading and answer, and the homepage AI card, are brand-free.
- **N-83.** Homepage Siri badge „Geplant“ / "Planned".
- **N-84.** „Hummlist-Skill für Amazon Alexa“ / "Hummlist skill for Amazon Alexa" in both Alexa guides and
  the FAQ; Alexa is no longer sie/she.
- **N-85.** The skill has **de-DE, en-US, en-GB, en-AU, en-CA, en-IN** (`alexa/skill-package/skill.json`,
  one interaction model each, #193). The function answers in English for every en-* locale. Support now
  says German and English.
- **N-86.** „Marken“ / "Trade marks" section in impressum.md / imprint.md.
- **Addendum 1 (after review 0).** Claude guides: Customize › Connectors › + Add › Add custom connector,
  removal via Customize › Connectors › Remove or the three-dot menu, the Claude Free one-connector note,
  and the Premium sentence in `::: once integration-lock` (the MCP server answers `premiumRequired` only
  while the lock is on; the hold is unreleased, so production leaves it out today, and a gates test checks
  both states). ChatGPT is gone from the Codex aside. The allowlist entries for the guides allow only Claude
  and Anthropic (new `brands` field). FEATURES-FOR-WRITERS no longer says AI stays free after Premium
  launches; `ai-assistants.md` has the new menu path.
- **Brand check.** `scripts/brand-names.ts` (lint gate) with `scripts/brand-names.allow.json` and 12
  fixture tests. The writers doc's global „Never claim“ list carries the rule.

## Open / blocked
- **Homepage `voice.siri.body`** still says „Bald …“ / "Soon …" next to the „Geplant“ badge. The brief limits
  N-83 to the badge, so this is a question for Legal or Peter.
- **Legal's exact text is not in the PR.** `/workspace/legal/reviews/2026-11-04-hummlist-brand-names.md`
  is not on the Hetzner runner (asked on the BOARD at 07:57 and again after review 0). Every new string is a draft from the brief,
  listed in the PR. Swap in Legal's §2 text byte for byte, rerun `scripts/push-pr.sh`, then Peter approves.
- **#228 order: resolved.** #228 landed first, so this PR dropped the two `integrationPremiumAi` allowlist
  entries after rebasing onto it.
- **Alexa console.** I didn't check the dev-stage skill's live locales, because ASK login works only on
  the box. The repo package has six locales.

## Verified
- After review 0: site tests 122/122 on Node 22, `scripts/gates/site.sh` and `site-agent.sh` pass, brand check
  clean with 13 tests. `site-agent` had a port-clash flake; its checks now serve on a free port.
- Screenshots: `docs/screenshots/96/` (production and preview builds served by `site/scripts/preview.mjs`).
