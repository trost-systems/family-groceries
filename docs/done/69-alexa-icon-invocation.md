# Job 69: Alexa skill icon, phrasings, English, certification readiness

Peter's German Echo showed the old basket icon, heard „Hummlist“ as „Homelist“ or „Hamlist“, and
answered „Ich konnte keine Liste finden unter Hummlist“ to „setz X auf die Hummlist“. The
invocation name stays `hummlist` (ADDENDUM 1).

## What changed

| | Where |
| --- | --- |
| Skill icons 108 and 512 px, the app icon full bleed (the App Store art) | `design/app-icon/build.mjs` writes `alexa/skill-package/assets/images/de-DE_{small,large}IconUri.png`; the lint gate's `build.mjs --check` fails when they drift (it flagged the old icons as stale) |
| One-shot samples „setz/setze/pack/packe/schreib {items} drauf“, „ich brauche noch“, „füg/füge noch {items} hinzu“ | `alexa/skill-package/interactionModels/custom/de-DE.json`, test `skill_package_test.ts` (12 one-shot forms) |
| „drauf“ is trailing filler: „Setz Milch drauf“ added „Milch drauf“ through Siri, and would through Alexa if the slot kept it | `supabase/functions/voice/parse.ts`, tests `voice/parse_test.ts`, `alexa/handler_test.ts` |
| Guide: section „Damit Alexa Hummlist erreicht“ (phrasings that reach the skill, the warning about „auf die Hummlist setzen“, the „Humm-list“ tip, „Alexa, öffne Hummlist“ first), two troubleshooting rows; EN stub gets the same in short | `site/content/guides/{de,en}/alexa.md`, test `site/test/content.test.mjs` (every „Alexa, sag/frag Hummlist, …“ in the guides matches a sample) |
| Development-stage deploy and SMAPI check | `scripts/alexa-deploy-dev.sh`, docs/ALEXA.md „Deploy“ |

Each new test fails on main's model or splitter and passes on the branch.

## Icons

Before: [small](../screenshots/69/before-small.png), [large](../screenshots/69/before-large.png).
After: [small](../screenshots/69/after-small.png), [large](../screenshots/69/after-large.png)
(= `alexa/skill-package/assets/images/`).

## Verified

- `scripts/verify.sh --only gitleaks,lint,changelog,site,functions` passed.
- Local stack (569xx): `fg fn call voice` with „Setz Milch drauf“, „Pack Eier und Butter mit drauf“
  adds Milch, Eier, Butter; again „Setz Milch drauf“ answers „Schon auf der Liste: Milch.“
  ([voice-drauf.txt](../screenshots/69/voice-drauf.txt)).
- The built guide: [section](../screenshots/69/guide-de-hummlist-erreichen.png),
  [troubleshooting row](../screenshots/69/guide-de-troubleshooting-row.png),
  [EN](../screenshots/69/guide-en.png).
- Not checkable here: Alexa's speech recognition, and whether Alexa's NLU picks the new samples
  over her built-in lists. Only a real Echo shows that.

## Deploy

The Hetzner runner has no ASK CLI login; the LWA tokens are in the box's ops secrets. The box
runs `ALEXA_SKILL_ID=… scripts/alexa-deploy-dev.sh` from this branch (development stage only, no
certification, no beta invites). Result: see DONE_SUMMARY in the job's ops directory.

## ADDENDA 3-7 (same PR)

- **Launch bug (A).** „Alexa, öffne Hummlist“ never reached the function: production edge logs
  show only the deploy smoke check (07:38 CET, 400 by design) and three skill events (08:16,
  08:25:34, 08:25:41: link, disable, link); the one `alexa_links` row was last used at 08:25:41.
  Alexa answered „Ich weiß nicht“ herself: the name was misheard, or the Echo isn't on the
  account that has the skill. Peter's check: NEEDS_PETER „Job 69“. The launch response is pinned
  by a full-JSON test.
- **English (B).** en-US, en-GB, en-AU, en-CA, en-IN: one English model, `speech_en.ts`,
  `voices.ts` picks the language by `request.locale`, `voice/parse_en.ts` splits. Tests:
  `skill_package_test.ts` (every locale), `handler_test.ts` (English …), `e2e/tests/alexa-en.spec.ts`
  (linking, add, duplicate, read; passed locally). Guide `en/alexa.md` is a full English guide.
- **Certification readiness (4-7).** Worldwide, privacy URL per locale, no terms URL (404 today),
  testing instructions without credentials, nothing about Premium. `docs/ALEXA_CERTIFICATION.md`.
  `scripts/alexa-validate.sh` and `scripts/alexa-simulate.sh` for the box.
- **Not done here, unproven:** Amazon's validation, the simulator run (which would reproduce the
  launch bug) and the development deploy need the ASK login on the box. The launch root cause is
  inferred from log timestamps only. The testing instructions are not Ops' draft (on the box only).

## Review 0 fixes

- The German lock lines no longer mention Premium or „freischalten“: „Hummlist nimmt für euren
  Haushalt gerade keine Sprachbefehle an.“ `skill_package_test.ts` now scans `speech.ts` and
  `speech_en.ts` too (fails on main's line). `e2e/tests/integration-lock.spec.ts` expects the new
  Alexa line; it and `alexa-en.spec.ts`, `alexa.spec.ts` passed locally.
- Items 2 and 3 (Amazon-side runs, Ops' draft) are blocked on the box; the PR and
  `docs/ALEXA_CERTIFICATION.md` say so.
