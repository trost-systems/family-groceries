# Job 40: flag/hold-gated changelog items, pending.json, 1.0 launch "What's new" override

PR #141. This job puts Peter's two calls of 2026-10-31 into the changelog from job 39.

- Work that not every user has yet stays out of the public changelog until it is fully out. That covers work behind a feature flag and the uncertified Alexa skill.
- Version 1.0 gets its own hand-written "What's new" text for first-time users.

Format and flow: [docs/CHANGELOG.md](../CHANGELOG.md), "Gated items" and "Override". Calls and reasons: [docs/DECISIONS.md](../DECISIONS.md), "Job 40".

## What was built

- **Note lines.** An item in a PR's `## Changelog` may add `flag: <key>` or `hold: <key>`, at most one of each. A key matches `[a-z0-9][a-z0-9._-]*`. Unknown lines are still rejected, and `none` is unchanged.
- **[`releases/flags.json`](../../releases/flags.json)** holds `flags` (`rollout`: full, partial or off) and `holds` (`released`, plus optional `match` words).
  - An item is public only when its flag is `full` and its hold `released`.
  - A key the file doesn't know is an error in push-pr.sh, the `changelog` gate and every release command.
  - `alexa-certification` is `released: false` with `match: ["alexa"]`. An item that mentions Alexa needs that hold, or it is refused at PR time. If one reaches main anyway, it is held and the draft warns.
  - The app has no feature-flag system (grep), so the file is edited by hand. No PostHog call is made.
- **`held` and `releases/changelog/pending.json`.**
  - `changelog.mjs draft` lists closed items under `held` in the draft. They are never rendered and are in no store text.
  - `record.mjs add` writes them to `pending.json` in the release commit, plus any gated items merged after the draft's sha.
  - The next draft takes the pending items whose gate is open now, in their category, keeping `flag`/`hold` for tracing.
  - `draft` never writes `pending.json`, so a discarded draft loses nothing (DECISIONS 40.3).
- **Re-check at the end.** The `changelog` gate and `record.mjs` run every published item through the gates again. They scan the titles, store texts and overrides for held words. They refuse a draft from another branch or one collected past the release, and a draft without `held` while items are pending.
- **Override `releases/changelog/<version>.override.md`.**
  - It has `## de` / `## en` sections, each with a `title:` line, then one text or `### play` + `### app_store` blocks.
  - It replaces the draft's title and store texts. Limits are job 39's (Play 500 code points, App Store 4000 UTF-8 bytes), with the same stripping of emoji and `<`.
  - `status: draft` makes `record.mjs add` refuse (a dry run only warns). `record.mjs` deletes the override with the draft.
- **The 1.0.0 launch text** [`releases/changelog/1.0.0.override.md`](../../releases/changelog/1.0.0.override.md) is marked `status: draft — pending Peter's review`. Every claim was checked against the app on main (DECISIONS 40.8). It mentions no Alexa and makes no beta comparison.
- **Site.** `pending.json`, `held` and overrides are never shown. The production and preview dist are byte-identical to main.
- **Docs.** `docs/CHANGELOG.md`, `releases/README.md`, `docs/RELEASE.md` (the cut flow now reviews held items and the override), the PR template, `docs/CI.md`, `site/README.md` and DECISIONS "Job 40".

## How to verify

- `scripts/release/test.sh` runs 34 changelog tests (15 for job 40), 19 record tests and the gate cases, 5 of them new.
- `scripts/landing-test.sh`.
- `scripts/verify.sh --only gitleaks,lint,changelog,site` (79 site tests).
- `actionlint` and `shellcheck`.
- `node scripts/release/changelog.mjs draft --version 1.0.0 --sha $(git rev-parse HEAD) --dry-run` prints the override's texts with their counts: Play de 434/500, Play en 389/500, App Store de 800/4000 bytes, App Store en 696/4000 bytes. It collects 0 items and holds 0, and writes nothing.

## Review

An independent agent ran the CLIs against scratch repos. It found that nothing re-checked the gates after drafting, that non-ancestor or overreaching drafts dropped or doubled items, that duplicate pending notes blocked the record, and that German "Alexas"/"Alexaskill" slipped past the match. All of these are fixed with regression tests (DECISIONS 40.9).

## Open

- Peter approves the 1.0.0 text by deleting its `status: draft` line (docs/NEEDS_PETER.md).
- When the app gets feature flags, `flags.json` stays hand-maintained. A read-only comparison is a possible later job.

## The 1.0.0 override, in full

```markdown
status: draft — pending Peter's review

# Hummlist 1.0.0: "What's new" for the launch

<!--
Replaces the generated title and store texts of 1.0.0 (docs/CHANGELOG.md, "Override"). Written
for people who open Hummlist for the first time: no comparison with the beta, no Alexa (its hold
alexa-certification is not released). Approve it by deleting the status line above; until then
record.mjs refuses to record 1.0.0 as a public release.
-->

## de

title: Willkommen bei Hummlist

### play

Willkommen bei Hummlist, der gemeinsamen Einkaufsliste für deinen Haushalt.

• Eine Liste für alle bei dir zu Hause, sofort auf allen Geräten
• Nach Laden sortiert, in der Reihenfolge deines Wegs durch den Markt
• Artikel landen von selbst in der richtigen Kategorie
• Per Sprache: mehrere Artikel in einem Satz, auf dem iPhone auch mit Siri
• Vorschläge für das, was wieder fällig ist
• Auch mit KI-Assistenten wie Claude und ChatGPT

### app_store

Willkommen bei Hummlist, der gemeinsamen Einkaufsliste für deinen Haushalt.

• Eine Liste für alle bei dir zu Hause: Was jemand einträgt, sehen alle sofort. Einladen geht per Link oder Code.
• Nach Laden sortiert, und die Kategorien stehen in der Reihenfolge, in der du durch den Markt gehst.
• Hummlist sortiert Artikel selbst in die passende Kategorie, auch mit Tippfehler.
• Sag einfach „Milch, Eier und Brot“: Das Mikrofon in der App trägt alles auf einmal ein. Auf dem iPhone geht das auch mit einem Siri-Kurzbefehl.
• Vorschläge zeigen, was du schon mal gekauft hast und was wieder fällig ist.
• Claude, ChatGPT und andere KI-Assistenten können deine Liste lesen, ergänzen und abhaken.

Funktioniert auch offline: Deine Änderungen kommen an, sobald du wieder Netz hast.

## en

title: Welcome to Hummlist

### play

Welcome to Hummlist, your household's shared shopping list.

• One list for everyone at home, updated instantly on every device
• Sorted by store, in the order you walk through the shop
• Items file themselves into the right category
• Add by voice: several items in one sentence, or with Siri on iPhone
• Suggestions for what's due again
• Works with AI assistants like Claude and ChatGPT

### app_store

Welcome to Hummlist, your household's shared shopping list.

• One list for everyone at home: what one of you adds, everyone sees right away. Invite others with a link or a code.
• Sorted by store, with the categories in the order you walk through the shop.
• Hummlist files items into the right category by itself, even with typos.
• Just say "milk, eggs and bread": the mic in the app adds them all at once. On iPhone, a Siri Shortcut does it too.
• Suggestions show what you've bought before and what's due again.
• Claude, ChatGPT and other AI assistants can read your list, add to it and check items off.

Works offline too: your changes go through as soon as you're back online.
```
