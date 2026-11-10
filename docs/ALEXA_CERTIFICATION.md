# Alexa certification readiness (job 69)

The skill package is prepared for Amazon's certification in de-DE, en-US, en-GB, en-AU, en-CA
and en-IN, and checked locally (below). **Amazon has not checked it yet**: the development deploy,
Amazon's validation and the simulator need the ASK login on the box, and none of them has run.
Until "Results" holds their output, the package counts as unproven against Amazon; a manifest
Amazon rejects (six locales, new sample utterances) is the main risk. Nothing is submitted and the
live stage is untouched: the lead submits after Peter's device retest.

## What the package says

| Field | Value | Checked by |
| --- | --- | --- |
| Name, invocation | „Snacklist“, `snacklist`, every locale | `skill_package_test.ts` AC11 |
| Locales | de-DE (German model and replies), en-US, en-GB, en-AU, en-CA, en-IN (one English model and English replies) | `skill_package_test.ts`, `handler_test.ts` (English …), `e2e/tests/alexa-en.spec.ts` |
| Availability | worldwide (`isAvailableWorldwide: true`, no country list; Peter Q38 AV3) | `skill_package_test.ts` |
| Category | `SHOPPING` | |
| Summary, description, keywords | per locale; keywords without retailer names (Legal N-23) | `skill_package_test.ts` (lengths) |
| Example phrases | three per locale, each matching a sample utterance word for word | `skill_package_test.ts` |
| Icons | 108 and 512 px PNG from the app icon, every locale | `design/app-icon/build.mjs --check` (lint gate) |
| Privacy policy | de-DE `https://snacklist.app/datenschutz`, en-* `https://snacklist.app/en/privacy` (both 200 on 2026-11-10; the 2026-11-02 run had the hummlist.com URLs) | `skill_package_test.ts` |
| Terms of use | none yet: `/nutzungsbedingungen` and `/en/terms` answer 404 on 2026-11-02; the lead adds `termsOfUseUrl` once they are live (optional field) | `skill_package_test.ts` |
| Purchases, ads, child-directed, export compliant | no, no, no, yes | `skill_package_test.ts` |
| Uses personal info | yes: account linking signs in to a Snacklist account (e-mail), and the skill reads and writes that household's list | |
| Premium | not mentioned anywhere in the package or in any reply, German or English; the lock lines say only that Alexa isn't available for the household (Alexa is free, Legal N-27; job 72 removes the lock) | `skill_package_test.ts` (package, `speech.ts`, `speech_en.ts`) |
| Testing instructions | German and English, no credentials ("Test account credentials: see the certification test-account field", ADDENDUM 5 wording). **Not Ops' draft**: ADDENDUM 6 asks for `/workspace/hummlist/alexa-cert/testing-instructions-draft.txt` with its `<PASSWORT>`/`<PASSWORD>` placeholders, and that file is on the box only. Replace the text with the draft once it is copied (the test allows the placeholders, not a real password) | `skill_package_test.ts` |

## What runs where

Amazon's side needs the ASK CLI signed in to Peter's developer account. That login is on the box,
not on the Hetzner runner, so these run on the box from a checkout of the branch:

```bash
ALEXA_SKILL_ID=<skill id> scripts/alexa-deploy-dev.sh   # development stage only, then checks every locale
ALEXA_SKILL_ID=<skill id> scripts/alexa-validate.sh     # Amazon's validation, development stage
ALEXA_SKILL_ID=<skill id> scripts/alexa-simulate.sh     # typed utterances per locale, what Alexa sent
ALEXA_SKILL_ID=<skill id> scripts/alexa/smoke.sh        # Amazon signs a LaunchRequest and calls the endpoint
```

`alexa-simulate.sh` types, it does not speak: it shows whether an utterance reaches the skill and
which intent it becomes, never whether Alexa hears „Snacklist“ right. Results go in the section
below.

## Results

Run from the box on 2026-11-02 (10:40-11:05 CET), branch `job/69-alexa-icon-invocation`, ASK CLI
2.30.7, development stage only. Nothing submitted, published or invited; the live stage is untouched.

1. **`alexa-deploy-dev.sh`: passed.** `ask deploy --target skill-metadata` imported the package and
   built every model. de-DE: SUCCEEDED; en-AU, en-CA, en-GB, en-IN, en-US: built by the import
   (`get-skill-status` lists only de-DE, so the script now accepts a missing entry and relies on the
   per-locale invocation check). Development manifest: name „Hummlist“, invocation `hummlist` in
   all six locales. Icons: Amazon re-encodes them, 108x108 and 512x512.
2. **`alexa-validate.sh`: SUCCESSFUL** for de-DE, en-AU, en-CA, en-GB, en-IN, en-US.
   - REQUIRED „Initial functional tests“: SUCCESSFUL.
   - RECOMMENDED „Eligibility to update your live skill instantly“: FAILED. This is expected: there
     is no live version yet, and it does not block certification.
3. **`alexa-simulate.sh`: NOT ROUTED, 30 of 30.** Every utterance in every locale fails with „This
   utterance did not resolve to any intent in your skill“ (now and then „An unexpected error
   occurred“). That includes „öffne hummlist“, „Alexa, öffne Hummlist“, „öffne den Skill hummlist“
   and „open hummlist“. `consideredIntents` lists `<LaunchRequest>`, and in English also
   `<IntentForDifferentSkill>`, but Alexa never sends a request: the `alexa` function's edge logs
   show no request from the simulator. This is the launch bug on Peter's Echo, and 31b saw the same
   in October. So the device result does not come from speech recognition: the skill does not
   route for typed text either.
   - Checked: testing is enabled for the development stage (`get-skill-enablement-status` 204, and
     re-enabling changed nothing). The vendor has exactly one skill. The beta test is running.
   - The endpoint works: `invoke-skill-end-point` with a LaunchRequest (de-DE, en-US, en-GB)
     reaches the function and gets the LinkAccount answer. Until this PR's functions deploy, the
     production function still answers in German for en-*.
   - Still open (NEEDS_PETER „Job 69“): find out why Alexa won't route to the development skill for
     the developer account. Check the developer console's Test tab (stage „Development“, the
     simulator there), and the Alexa marketplace and country of the developer and tester accounts.

**`simulate-skill` is not evidence (job 91).** Its „This utterance did not resolve to any
intent in your skill“ is a known SMAPI artefact (BOARD, 2026-11-02 11:48). It came back for every
utterance in every locale, the simulator never sent a request to the function, and the same
answer appeared in October while the endpoint worked. The developer console's own Test tab did
reach the function on 2026-11-02 at 11:24-11:27 and 11:43 CET: 200 with the LinkAccount reply
(the lead's check, same BOARD line). So `simulate-skill` says nothing about whether an Echo
reaches the skill. Trust `invoke-skill-end-point` instead, through `scripts/alexa/smoke.sh`.
Amazon signs a de-DE LaunchRequest, the function verifies it, and the reply is checked: the
LinkAccount card unlinked, the launch prompt linked. Then `scripts/alexa/diagnose.sh` shows the
request line.

The lead ran smoke.sh on the box on 2026-11-03: `PASS unlinked` (LinkAccount card, 438 ms at
Amazon). diagnose.sh then showed
`21:42:37 POST 200 alexa: LaunchRequest - de-DE linked=false -> link`. So the endpoint and its
signature check work. For a device, ALEXA.md „Troubleshooting“ says how to tell whether a spoken
request reached Snacklist at all. On 2026-11-03 none did (DECISIONS „Job 91“).

## Left for the console (lead, after Peter's retest)

1. The test account: a fresh Snacklist account with a household and a few items, its e-mail and
   password in the certification form's test-account field only.
2. If Ops' testing-instructions draft replaces the text in `skill.json`: keep its
   `<PASSWORT>`/`<PASSWORD>` placeholders in the repo and write the credentials through SMAPI or
   the console just before the submit.
3. `termsOfUseUrl` per locale once the terms pages answer 200.
4. Keep `integration_lock` off while the skill is in certification, or grant the reviewer
   account Premium first (`docs/PAYWALL_RELEASE.md`, section 6). Job 72 takes Alexa out of the lock.
5. Submit (Distribution → Certification). Not before Peter's yes.

## Not in the skill

Ticking items off and moving them by voice: de-DE has no such intent either. The English model
mirrors de-DE, so a reviewer finds the same two things in both languages: add and read.
