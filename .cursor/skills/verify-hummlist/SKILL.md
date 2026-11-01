---
name: verify-hummlist
description: "Drive the real Hummlist app (the Flutter web release build in Chromium via Playwright) against this checkout's local Supabase stack with a seeded demo household, and prove behavior with screenshots, ARIA snapshots, video and database state. Use before claiming a Hummlist feature works, to reproduce a bug, to capture PR evidence, or to look up what the app does today (features/, and features/FEATURES-FOR-WRITERS.md for copy)."
---

# Verify Hummlist

The surface is the web build users get at app.hummlist.com: release mode, production defines, wasm, served under the production CSP. It runs against your checkout's own Supabase stack and is driven by Playwright from `e2e/node_modules`. Everything a user can do is mapped in [`features/`](features/README.md), one file per feature. Read the matching file before you drive.

Other surfaces:

| Surface | Drivable here | How |
| --- | --- | --- |
| iOS, Android apps | No simulators or emulators on the build boxes | The Linux desktop debug app through `scripts/fg` (verify-family-groceries skill, `FG_SURFACE=linux`). Native-only behavior (microphone, Siri intents, store purchases, keyboards) stays unverified |
| Siri | Server side only | `POST /functions/v1/voice` with a Siri key, as `e2e/tests/voice.spec.ts` does (`features/siri.md`) |
| Alexa (beta) | Server side only | Signed requests through `scripts/alexa-say.sh` and `e2e/tests/alexa-helpers.ts` (`features/alexa.md`) |
| MCP / AI assistants | Yes, over HTTP | Local `/functions/v1/mcp` with an access key or OAuth (`e2e/tests/mcp-helpers.ts`, `features/ai-assistants.md`) |

Drive Siri, Alexa and MCP only against a local test household. Never against the hosted project or a real user's household.

One instance per checkout: the ports come from your `supabase/config.toml` port block (`<prefix>21` API, `<prefix>81` web). Two checkouts with different blocks run side by side. Never drive another checkout's instance.

## Launch

```bash
.cursor/skills/verify-hummlist/helpers/launch.sh                      # demo-familie (German)
.cursor/skills/verify-hummlist/helpers/launch.sh --scenario demo-family-en --fresh   # English household
```

It goes from nothing to a signed-in household and is idempotent.

1. It starts the stack (`supabase start`, which applies every migration to an empty database) unless it already runs.
2. It builds the release web app when `app/` changed. The build takes about 80 s; a rerun with no change takes about 5 s.
3. It serves the build on `http://127.0.0.1:<prefix>81` with `e2e/serve.mjs`.
4. It seeds the scenario with `scripts/fg seed`.
5. It signs the first member in through the login screen, reopens the app, and checks that the add field has focus and a seeded item shows.

The ready signal is the last line: `READY http://127.0.0.1:<prefix>81 run=<run>`. A failure exits non-zero and names the log to read.

`--fresh` replaces the seeded run. `--rebuild` forces the build. State lives in `~/.cache/verify-hummlist/<prefix>/`: `instance.json`, the `fg/runs/<run>.json` credentials (mode 600; never paste them) and the build and serve logs.

The build has production defines with two local swaps. Google sign-in points at a fake client id. PostHog points at the e2e stand-in host, `https://posthog.invalid`, so nothing reaches a real analytics project. It has none of the e2e-only switches (LEGAL_DRAFTS, HOUSEHOLD_ARCHIVE, INTEGRATION_LOCK), so it shows what a normal user sees.

Teardown is `helpers/cleanup.sh` (see Cleanup).

## Doctor

```bash
.cursor/skills/verify-hummlist/helpers/doctor.sh
```

Read-only. It prints one line per check, `ok` or `FAIL ... -> <fix>`:

- The instance record exists.
- The stack is up, and the migrations applied equal the files in `supabase/migrations`.
- The functions answer `/health`.
- The process on the web port is the server `launch.sh` started.
- The build matches `app/` at HEAD plus local edits.
- The app and its `FontManifest.json` are served.
- The run has credentials.
- The first member signs in and belongs to the seeded household.

It exits 0 only when every check passes. Run it first, and whenever a drive fails strangely. `drive.sh` runs it too.

## Drive

```bash
.cursor/skills/verify-hummlist/helpers/drive.sh quick-add            # a scripted journey: PASS or FAIL: <reason>
.cursor/skills/verify-hummlist/helpers/drive.sh quick-add --lang en
.cursor/skills/verify-hummlist/helpers/drive.sh edit-item            # no journey yet: prints the feature's e2e specs (exit 3)
```

A journey is `journeys/<feature-id>.mjs`, a plain Node script on `helpers/lib.mjs`. To prove a feature without a journey, write one: copy `journeys/quick-add.mjs` and follow the steps of `features/<id>.md`. Commit it only if it is reusable. Building blocks from `helpers/lib.mjs`:

| Helper | Does |
| --- | --- |
| `instance()`, `member(inst, 'mia')` | The launched instance and a seeded member (`email`, `password`, `id`, `householdId`) |
| `openApp(inst, { lang, viewport, dpr, dark, videoDir })` | A fresh Chromium context on the build: `de-DE` or `en-US` locale, 390×844 at DPR 2 by default. Returns `{ browser, context, page, L, errors }` |
| `L(key, params)` / `labels(lang)` | UI text from `app/l10n/app_<lang>.arb` by key, so one script runs in both languages |
| `signIn(page, L, user)` | The login screen with email and password, declines the analytics question, dismisses the explainer card |
| `addField`, `addSheet`, `itemRow(page, name)`, `openTab(page, L, 'tabMore')`, `headingAbove(page, row)` | Stable handles: the textbox „Was brauchst du?“, the group „Hinzufügen“, a row by item name, the tabs, the category heading above a row |
| `typeInto(field, text, { perKey })` | Focus, then insert (synthetic key events drop umlauts) |
| `apiAs(inst, user)` | supabase-js signed in as the member: the second view of stored state |
| `capture(page, dir, name)`, `logger(dir)` | PNG + ARIA snapshot, a timestamped journey log |

Find widgets by role and accessible name, never by coordinates. Semantics are on in the web build. A row's name is the item name, then the quantity. Menu rows join label and hint. The richer TypeScript helpers (`reveal`, `tick`, `putBack`, `openEdit`, `actionSnackBar`, `cutOff`, `finger`) are in `e2e/tests/helpers.ts`. A feature's existing specs run with `scripts/verify.sh --only e2e -- tests/<spec>`. That is the e2e build under `/tmp/fg-e2e.lock`, not this instance.

Local Playwright here is one browser per journey. When you run the e2e suite yourself, use `flock /tmp/fg-e2e.lock` and `--workers=1`.

## Evidence

`drive.sh` writes to `$VH_EVIDENCE_DIR/<run>/<feature-id>-<HHMMSS>/` (default `~/hummlist-evidence`; set `VH_EVIDENCE_DIR=/workspace/hummlist/research/<job>/evidence` on the Hetzner runner so the box gets a copy). The directory holds:

- `journey.log`, with UTC timestamps, the rows offered and the database row as JSON.
- `NN-<step>.png` and `.aria.txt` before and after each action, plus `99-failure.png` on a failure.
- The context's WebM video.

Proof standards:

- Drive the user path: the field, the row, the menu. Use the API (`apiAs`, `scripts/fg db query --write`) only to set up preconditions.
- Capture the action and the resulting state, not only the final screen.
- Check side effects with a second, read-only view: `apiAs` for rows, a second context for sync, Mailpit (`mailpitUrl` in `instance.json`) for mail.
- Name the entry point you proved. Report a skipped one as skipped.
- For a PR, copy the PNGs you embed to `docs/screenshots/<job>/`. The run directory stays where it is.

## Cleanup

```bash
.cursor/skills/verify-hummlist/helpers/cleanup.sh                 # run torn down, server stopped, stack stopped if launch.sh started it
.cursor/skills/verify-hummlist/helpers/cleanup.sh --keep-stack    # leave the stack up (it was yours already, or you go on)
.cursor/skills/verify-hummlist/helpers/cleanup.sh --purge-build   # also delete app/build/verify-hummlist-web (about 75 MB)
```

Cleanup does these things:

- It tears the seeded run down with `fg teardown`, which proves every leftover count is 0.
- It stops the web server by its recorded pid and command line, never by name.
- It stops the Supabase stack only if `instance.json` says `launch.sh` started it. Only your project id is stopped.
- It removes `instance.json`.

It never touches `$VH_EVIDENCE_DIR`. Its last line names the evidence dir and how many files it holds.

## Helpers

| Script | Invocation |
| --- | --- |
| `helpers/launch.sh` | `launch.sh [--scenario <name>] [--fresh] [--rebuild]`, ends with `READY <url> run=<run>` |
| `helpers/doctor.sh` | `doctor.sh`, exit 0 when healthy |
| `helpers/drive.sh` | `drive.sh <feature-id> [journey args]`, no id lists the ids |
| `helpers/cleanup.sh` | `cleanup.sh [--keep-stack] [--purge-build]` |
| `helpers/env.sh` | `source` it to get `VH_*` and fg's `FG_*` for this instance (then `scripts/fg db query "..." --as <run>:mia` works) |
| `helpers/lib.mjs` | `import { ... } from '<repo>/.cursor/skills/verify-hummlist/helpers/lib.mjs'` in a journey or clip script |
| `journeys/quick-add.mjs` | `drive.sh quick-add [--lang en] [--prefix Joghu]` |

How-to clips (GIF for emails, MP4/WebM for the site) of the same build: [hummlist-howto-clips](../hummlist-howto-clips/SKILL.md).

## Gotchas

- `flutter build web --output` leaves `assets/FontManifest.json` out and no text renders. `launch.sh` builds into `app/build/web` and copies it. A later e2e gate run in the same checkout rebuilds `app/build/web` with its own defines; the copy here stays.
- Clicking „Verstanden“ (the explainer card) takes focus from the add field. Test autofocus after a reload, as `ready.mjs` does.
- The add sheet's note „✓ Hinzugefügt: …“ exists twice in the DOM (the note and a screen-reader announcement). Scope it to `addSheet(page, L)`.
- Catalogue suggestions are German words in both UI languages. In English, type a prefix of a German word ("Ched" → „Cheddar“).
- `fg` accepts port blocks 500 to 649. On the Hetzner runner `env.sh` sources `~/groceries-ops/env.hz` for PATH.
- The local stack signs up without email confirmation, while the hosted project requires it (`features/sign-in.md`).
