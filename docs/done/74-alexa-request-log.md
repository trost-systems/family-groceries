# Job 74: privacy-safe request log line for the Alexa function (2026-11-02)

**Built.** `supabase/functions/alexa/handler.ts` logs exactly one line per request through a new
`Deps.log` (production: `console.log`):
`alexa: <type> <intent|-> <locale|-> linked=<bool> -> <kind>`. Kinds are `replyKinds`
(the brief's seven plus no-household, goodbye, reprompt, not-understood, too-long,
rate-limited, locked, refused; DECISIONS Job 74). Skill events log their type
(`AlexaSkillEvent.SkillAccountLinked`, `.SkillDisabled`). The old refusal and
ExceptionEncountered warnings are folded into the line. How to read it: docs/ALEXA.md,
"Request log".

**Verify.** `cd supabase/functions && deno test --allow-all alexa/` (73 passed). The "job 74"
tests send 21 requests (every kind), assert each logs exactly the expected line, that every kind
is covered and that no token, Alexa/user/household/session id or item name appears; a second test
shows a newline or spaces in a field cannot forge a line. Injecting the token into the line makes
the test fail (checked). `scripts/verify.sh --only functions,gitleaks,lint` passed.
The real `alexa/index.ts` served locally with the test CA and driven by `scripts/alexa-say.sh`
printed exactly one line per request: docs/screenshots/74/request-log-local.txt.
The Management API logs query in docs/ALEXA.md ran against jdwqrallbpdbshrdhenk (it returned
the old "alexa request refused" lines, since the new line is not deployed yet).

**Open.** Merges on lead review + ci-ok (PR only). After merge, supabase-deploy.yml deploys
the alexa function to jdwqrallbpdbshrdhenk from main; then the query in docs/ALEXA.md shows the
new lines. Job 72 (#195) removes the Premium check from this handler: whichever lands second
drops the `locked` kind / rebases the `kind:` fields.
