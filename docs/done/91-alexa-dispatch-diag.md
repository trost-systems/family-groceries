# Job 91: Alexa „Verbindungsproblem“, dispatch diagnosis and troubleshooting (2026-11-03)

**Finding.** Spoken requests never reach Hummlist. Over 2026-11-03 07:00-12:00 CET the `alexa`
function got two calls, both skill events (`SkillDisabled` 08:20:56, `SkillAccountLinked`
08:21:17). Account linking worked: authorize, consent, and Amazon's code exchange 200 at
08:21:15, with one live link. No LaunchRequest or IntentRequest came. So the error Alexa speaks
is produced at Amazon, and no code fix applies. Run output:
[docs/screenshots/91/diagnose-2026-11-03-0700-1200.txt](../screenshots/91/diagnose-2026-11-03-0700-1200.txt).

**Built.**

- `scripts/alexa/diagnose.sh` (with `diagnose.ts`), read-only, production project only. For a
  window of at most 24 h (`--last 2h`, or `--from`/`--to` in Europe/Berlin) it prints:
  - each call to the function with status, duration and its request line, or the absence of one;
  - a verdict when no spoken request arrived;
  - the Amazon Alexa client's OAuth steps with status and error code;
  - the alexa_links counts.

  It prints no e-mail, name, IP, token or raw id. Ids appear only as a short SHA-256 prefix.
- `scripts/alexa/smoke.sh`: Amazon signs a de-DE LaunchRequest from
  `scripts/alexa/fixtures/launch-request.json` and sends it to the endpoint
  (`ask smapi invoke-skill-end-point`, development stage). The unlinked run must return the
  LinkAccount card. The linked run (`ALEXA_SMOKE_TOKEN`) must return the launch prompt.
  `--dry-run` calls nothing. Without `ask` or a skill id it exits 2 before any call.
- docs/ALEXA.md „Troubleshooting“ maps each thing Alexa says or shows to three answers: whether
  it reached us (diagnose.sh), the likely cause, and the fix. It also lists the four beta rules.
  ALEXA_CERTIFICATION.md records that SMAPI `simulate-skill`'s „did not resolve to any intent“ is
  an artefact, and that smoke.sh is the check to trust.
- `handler_test.ts`: the real verifier's refusals now assert their log lines
  (`-> refused missing_signature`, `bad_signature`, `stale_timestamp`). The line already said so.
  The format stays `refused <reason>` (DECISIONS „Job 91“).
- Token lifetime: compatible, so no config change. The details are in DECISIONS „Job 91“.

- Vercel DPA (ADDENDUM 1): `docs/legal/dpas/vercel-dpa-2026-03-17.pdf`, rendered from Vercel's
  public page (same version, 25 pages), because the box copy never reached hz. The new index
  `docs/legal/dpas/README.md` lists it with its provenance and checksums.

**Verify.**

- `scripts/verify.sh --only functions,lint,gitleaks` passed. The functions gate now runs
  `scripts/alexa` (11 tests).
- diagnose_test runs the real `diagnose.sh --fixture` over fixture logs full of user data. It
  checks the lines, the verdict and the OAuth filter, and that more than 25 sensitive values
  never appear in the output. When I made the hash return the raw id, the test failed.
- smoke_test signs the dry-run body with the test CA, sends it through the real verifier and
  handler, and gets the LinkAccount answer. With a fake `ask`, it checks pass, fail, skip and
  token masking.
- Dry run: [docs/screenshots/91/smoke-dry-run.txt](../screenshots/91/smoke-dry-run.txt).

**Open.**

- The lead ran smoke.sh on the box (21:42): `PASS unlinked`, 438 ms at Amazon, and diagnose.sh
  showed the LaunchRequest. So Amazon reaches the endpoint, and the Echo failure is in Amazon's
  routing for that account or device.
- The linked half waits for the certification test account.
- Peter's five checks are in NEEDS_PETER „Job 91“.
