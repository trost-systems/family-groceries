# Job 60: Hummlist feature map (verify-hummlist) and how-to clips

Hummlist Launch and the other writing bots now have one current, plain-language description of what the app does today, with the exact German and English labels: `.cursor/skills/verify-hummlist/features/FEATURES-FOR-WRITERS.md`. Agents have a scripted way to drive the real web build and prove a feature (the verify-hummlist skill), and anyone can film a short how-to clip of a feature as an email GIF, site video and PNG (the hummlist-howto-clips skill). No app behaviour changed. PR: https://github.com/trost-systems/family-groceries/pull/178.

## What and where

- **`.cursor/skills/verify-hummlist/`** (also `.claude/skills/`).
  - `SKILL.md`: Launch, Doctor, Drive, Evidence, Cleanup and Helpers.
  - `helpers/launch.sh`, `doctor.sh`, `drive.sh <feature-id>`, `cleanup.sh`, `env.sh`.
  - `helpers/lib.mjs`: the Playwright building blocks. Labels come from the ARB files, so one script runs in DE and EN.
  - `journeys/quick-add.mjs`.
- **`features/`**.
  - `README.md`: index, baseline, conventions and the entry contract.
  - 23 feature files: sign-in, privacy-consent, onboarding, household-invites, quick-add, usuals, dictation, tick-and-undo, edit-item, classifier, categories, stores-walk-order, live-sync, offline, theme, language, feedback, more-help, account-deletion, ai-assistants, siri, alexa, premium.
  - `FEATURES-FOR-WRITERS.md`.
- **`.cursor/skills/hummlist-howto-clips/`** (also `.claude/skills/`): `SKILL.md` with the email caveats, `clip.mjs` and `scripts/quick-add.mjs`.
- **Docs.**
  - `docs/FEATURE_MAP.md`.
  - AGENTS.md (= CLAUDE.md): a bullet on the feature map, and the duplicated hummlist-ui-craft bullet removed.
  - A README link and a PR template checkbox.
  - Pointer lines at the top of the old `verify-family-groceries/SKILL.md` and `features/README.md`.
  - DECISIONS "Job 60".
- **Tooling fix.** `fg` (`cli/instance.ts`) and `fg_on_repo_stack` (`scripts/lib.sh`) now accept port blocks 500 to 649. Job 60's 601 was refused. The new fg-cli test fails on the old check.

## How to verify

```bash
.cursor/skills/verify-hummlist/helpers/launch.sh          # READY http://127.0.0.1:<prefix>81 run=<run>
.cursor/skills/verify-hummlist/helpers/doctor.sh          # 9 x ok, exit 0
.cursor/skills/verify-hummlist/helpers/drive.sh quick-add # PASS, evidence dir printed
node .cursor/skills/hummlist-howto-clips/clip.mjs quick-add --out /tmp/clips
.cursor/skills/verify-hummlist/helpers/cleanup.sh         # evidence kept
```

## Results

- **Proof run on hz.** The log is `/workspace/hummlist/research/60-feature-map/proof-run.log` and the evidence is in `/workspace/hummlist/research/60-feature-map/evidence/fx-1101-1719-3sei/`.
  1. Launch from an empty database: 35 s with the build reused, about 80 s more for a cold build.
  2. Doctor: 9 of 9 checks pass.
  3. quick-add in DE: PASS. Joghurt lands under „Kühlregal“, and the database row matches.
  4. quick-add in EN: PASS. Cheddar lands under "Chilled".
  5. Cleanup: leftovers 0, the server and stack stopped, all 26 evidence files still there.
- **Clips.** `/workspace/hummlist/research/60-feature-map/clips/quick-add/`. The DE GIF is 705 KB and the EN GIF 616 KB, both 480×1038 at 12 fps, about 7.6 s. MP4: 131 and 106 KB. WebM: 104 and 90 KB. PNG: 120 and 104 KB. The proof copies are in `docs/screenshots/60/`.
- **Gates.** `scripts/verify.sh --only lint,fg-cli,gitleaks` passes. The helpers are shellcheck-clean.
- **Feature map.** 9 features have no unverified claim. 14 carry 22 `unverified` notes in all, each with its reason; most need a real device or a third-party account. Proven by drive or live check:
  - quick-add in DE and EN;
  - the Mehr tab order and the Premium hint;
  - the hosted auth settings (read-only);
  - the production PostHog key;
  - the guide URLs on hummlist.com.

## Findings for the lead

- **"8-digit code".** The hosted OTP length is 8, but the sign-in and confirmation emails contain only a link. The app has no code field. Email subjects are Supabase's English defaults („Your sign-in link“, „Confirm your email address“). Job 55 (#170) restyles the auth mails.
- **Store badges.** Main shows chain-coloured badges. The writers' file forbids mentioning them, pending job 58 (Legal N-23).
- **Premium hint.** The row „Hummlist Premium“ shows the hint „Siri, Alexa und KI-Assistenten“ to everyone, while nothing is sold.
- **Onboarding.** The skip-stores hint promises adding stores "später unter Mehr", which is not possible on main (job 58 adds it).
- **English demo items.** "Bananas" and "Apples" show a carrot emoji.
- **Catalogue suggestions** are German in the English UI.

## For the lead (copy to the box)

- Feature map: copy `/workspace/hummlist/research/60-feature-map/feature-map/` (the merged `features/` folder from main, written after the merge) to `/workspace/hummlist/feature-map/`.
- Clips: copy `/workspace/hummlist/research/60-feature-map/clips/` to `/workspace/hummlist/clips/`.

## Missing or open

- Job 59's server part (#177) landed before the merge; quick-add was updated and re-driven in #178. Job 57 (#175) landed after it; a follow-up PR updated tick-and-undo, theme, stores-walk-order and live-sync and added `journeys/tick-and-undo.mjs` (driven: strike-through and mint row, no snackbar, bought/active in the database). Job 59's app part (#179) landed too and updated the map itself. Job 58 (#176) was still open at the end of the 2-hour watch.
- Only quick-add has a scripted journey and a clip script. The other features have recipes and e2e spec pointers.
