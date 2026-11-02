# Alexa skill "Hummlist" (de-DE, en-*)

A household member says "Alexa, sag Hummlist, füg Milch und Eier hinzu", and Milch and Eier land
on the household's Hummlist within seconds, categorized and sorted like items typed in the app.
"Alexa, frag Hummlist, was auf der Liste steht" reads the open items aloud. Spec #7, job 31.
On an Echo set to English (en-US, en-GB, en-AU, en-CA, en-IN), "Alexa, ask Hummlist to add milk
and eggs" does the same in English (job 69). Certification readiness:
[ALEXA_CERTIFICATION.md](ALEXA_CERTIFICATION.md).

| | |
| --- | --- |
| Skill name, invocation name | `Hummlist`, `hummlist` (always in full; a test fails on "Humm" alone) |
| Endpoint (and skill events) | `https://jdwqrallbpdbshrdhenk.supabase.co/functions/v1/alexa` (`sslCertificateType: Wildcard`) |
| Function | [`supabase/functions/alexa/`](../supabase/functions/alexa/) |
| Skill package | [`alexa/skill-package/`](../alexa/skill-package/) (`skill.json`, `interactionModels/custom/de-DE.json` and the five identical `en-*.json`, icons from `design/app-icon/build.mjs`), [`alexa/ask-resources.json`](../alexa/ask-resources.json) |
| Account linking | [`alexa/account-linking.json`](../alexa/account-linking.json) (no secret), [`scripts/alexa-oauth-client.sh`](../scripts/alexa-oauth-client.sh) |
| Local testing | [`scripts/alexa-test-ca.sh`](../scripts/alexa-test-ca.sh), [`scripts/alexa-say.sh`](../scripts/alexa-say.sh) (`--locale en-US`), [`e2e/tests/alexa.spec.ts`](../e2e/tests/alexa.spec.ts), [`alexa-en.spec.ts`](../e2e/tests/alexa-en.spec.ts) |
| Amazon (ASK CLI signed in) | [`scripts/alexa-deploy-dev.sh`](../scripts/alexa-deploy-dev.sh), [`alexa-validate.sh`](../scripts/alexa-validate.sh), [`alexa-simulate.sh`](../scripts/alexa-simulate.sh) |
| Decisions | [DECISIONS.md](DECISIONS.md), "Job 31" |
| Manual steps | [NEEDS_PETER.md](NEEDS_PETER.md), "Job 31" |

## How a request flows

```
Echo ──> Alexa (speech to text, intent "AddItemIntent", slot items = "milch und eier")
     ──> POST /functions/v1/alexa  (signed: SignatureCertChainUrl + Signature-256)
         1. verify.ts: cert URL, chain to a pinned Amazon root, SAN echo-api.amazon.com,
            signature over the raw body, timestamp ±150 s, our skill id  ── else 400, nothing read
         2. the linked token (context.System.user.accessToken) ─> _shared/auth.ts authenticate():
            a Supabase OAuth access token whose session still exists; its user's CURRENT
            household from household_members  ── else "Bitte verknüpfe …" + LinkAccount card
         3. voice/parse.ts splits "milch und eier" (the Siri splitter; voice/parse_en.ts for an
            en-* request, alexa/voices.ts picks by request.locale)
         4. 30 items a minute per user (alexa_take_adds)
         5. voice/items.ts adds through public.add_item as the user, under RLS (classifier,
            store memory, duplicates) ─> Realtime ─> every member's app
         6. read-back: "Ich habe Milch und Eier auf die Hummlist gesetzt."
```

Nothing from the request body chooses a household: only the token's user and their membership at
request time do, so after a household switch Alexa adds to the new one. The item's `added_by` is
the linked user, and the other members see it like any partner's add ("Neu").

## What Alexa understands and says

Invocation: "Alexa, sag Hummlist, …", "Alexa, frag Hummlist, …", "Alexa, öffne Hummlist".

| Intent | Examples (de-DE.json has them all) | Answer |
| --- | --- | --- |
| `AddItemIntent` (slot `items`, `AMAZON.SearchQuery`) | füg {items} hinzu · setz {items} auf die Liste · schreib {items} auf · wir brauchen {items} · trag {items} ein | added: "Ich habe Milch und Eier auf die Hummlist gesetzt." · open already, with other spellings of new items (job 32b, added anyway; job 68): "Schon auf der Hummlist: Milch und Möhren." |
| `ReadListIntent` | was auf der Liste steht · was steht auf der Liste · lies die Liste vor · was brauchen wir | "Auf der Hummlist stehen 3 Sachen: Äpfel, 2 Liter Milch und Eier." in the app's aisle order; at most 10, then "und 5 weitere."; empty: "Die Hummlist ist leer." |
| LaunchRequest | "Alexa, öffne Hummlist" | "Was soll auf die Liste?" and waits for the answer (`Dialog.ElicitSlot`, so "Milch" alone works) |
| `AMAZON.HelpIntent` | "Hilfe" | what the skill does, with the two examples; the session stays open |
| `AMAZON.StopIntent`, `CancelIntent`, `NavigateHomeIntent` | "Stopp", "Abbrechen" | "Bis bald." |
| `AMAZON.FallbackIntent`, nothing understood | "äh", "bitte" | once: "Das habe ich nicht verstanden. Was soll auf die Liste?" (re-prompt); the second time: "Das habe ich leider nicht verstanden. Ich habe nichts auf die Hummlist gesetzt." Never a guess. |

Other answers, all German, all ending the session: not linked or link revoked ("Bitte verknüpfe
zuerst dein Hummlist-Konto in der Alexa-App. …" with a LinkAccount card), no household ("Du bist
noch in keinem Haushalt. …"), more than 1000 characters ("Das war zu lang. … Ich habe nichts
hinzugefügt."), more than 30 items (the first 30 are added: "Mehr als dreißig auf einmal gehen
nicht; sag den Rest bitte noch einmal."), the rate limit ("… Warte bitte eine Minute …"), and a
database error ("Entschuldigung, das hat gerade nicht geklappt. Ich habe nichts hinzugefügt. …",
reported to error tracking). Quantities are said in words: "2 l" is "2 Liter", "1 kg" is
"1 Kilo". A phrase heard all in lowercase ("milch ohne laktose") is stored with German capitals
("Milch ohne Laktose").

`SessionEndedRequest`, `System.ExceptionEncountered` and skill events get an empty answer.

**Integration lock: Alexa stays free (job 72).** The skill is not part of Hummlist Premium
(Peter Q39, Legal Review N-27). The alexa function never asks the integration lock, and
`integration_gate` answers `alexa` open even with `integration_lock` on (for a function deployed
before job 72). Its Zugänge tile never shows as paused. Siri and MCP: docs/PURCHASES.md,
"Integration lock".

## Account linking

Alexa links accounts with the OAuth 2.0 authorization code grant. **Supabase Auth's OAuth 2.1
server (the one the MCP server uses) does it directly; no shim.** Checked against its source
(`supabase/auth`, `internal/api/oauthserver`) and end to end on the CI stack:

- It accepts **confidential clients** (`token_endpoint_auth_method` `client_secret_basic` or
  `client_secret_post`), also through dynamic client registration, and checks the secret at the
  token endpoint.
- It **requires PKCE** (`code_challenge` with S256 or plain) on every authorization. Alexa sends
  PKCE when the skill turns it on (`pkceConfiguration: {status: ENABLED, codeChallengeMethod:
  S256}` in the account-linking request, "PKCE" in the console), so it must be on.
- Redirect URIs match exactly; the client is registered with all three Alexa URLs
  (`https://pitangui.amazon.com/api/skill/link/<vendor id>`, `https://layla.amazon.com/…` for
  Europe incl. de-DE, `https://alexa.amazon.co.jp/…`).
- The token answer has `expires_in` (1 h) and a `refresh_token`; Alexa refreshes with HTTP Basic.
  A refresh keeps the session, so the function's session check keeps passing.
- No scopes are configured; Supabase applies its default.

The user sees the app's consent page (`/oauth/consent`, the one MCP clients get) with
"Amazon Alexa", signs in there if needed and taps "Erlauben". The link then shows under
Mehr → Zugänge as "Amazon Alexa".

| Alexa console, Account Linking | Value |
| --- | --- |
| Authorization grant type | Auth Code Grant |
| Your Web Authorization URI | `https://jdwqrallbpdbshrdhenk.supabase.co/auth/v1/oauth/authorize` |
| Access Token URI | `https://jdwqrallbpdbshrdhenk.supabase.co/auth/v1/oauth/token` |
| Your Client ID / Secret | from `scripts/alexa-oauth-client.sh <vendor id>` (the secret is shown once) |
| Your Authentication Scheme | HTTP Basic (Recommended) |
| Scope | none |
| Domain List | `app.hummlist.com`, `jdwqrallbpdbshrdhenk.supabase.co` |
| PKCE | on, S256 |
| Allow users to enable skill without account linking | off |

### Unlinking and revocation

A revoked or expired token is treated as unlinked: the LinkAccount card, nothing added. The
token is refused as soon as its Supabase session is gone (`authenticate` checks the session on
every request, not only the JWT's expiry). That happens when:

- the user taps "Amazon Alexa trennen" under Mehr → Zugänge (revokes the grant, deletes its
  sessions and refresh tokens);
- the user **disables the skill** in the Alexa app: Alexa sends `AlexaSkillEvent.SkillDisabled`
  (subscribed in `skill.json`). It carries only Alexa's user id, so the function keeps a map of
  which Hummlist session each Alexa account holds (`alexa_links`, the Alexa id SHA-256 hashed,
  written on every request) and deletes those sessions (`alexa_revoke`);
- the user **links again** (`AlexaSkillEvent.SkillAccountLinked`): the sessions that Alexa
  account held before are revoked, the new one stays;
- the account is deleted (the sessions go with the user) or the user signs out everywhere.

"Unlink" in the Alexa app without disabling the skill sends no event: Alexa deletes the access
and refresh token it held, so the next request comes without a token and gets the link prompt.
The grant stays listed under Zugänge until it is removed there, the skill is linked again or
disabled, or it goes unused for 12 months; nobody holds a token for it (Alexa had the only copy).

### What is kept, and for how long

Legal Review N-24 and N-28 (privacy §7), migration `20261102093000_alexa_cleanup.sql`:

| Data | Deleted |
| --- | --- |
| `alexa_links` row (Alexa id hash, session, `last_seen`) | with its session, right away (trigger on `auth.sessions`): Zugänge "trennen", SkillDisabled, linking again, signing out everywhere, account deletion |
| `alexa_rate` counter | with the user's last link, right away; otherwise by the daily job once its minute has passed |
| The grant (`auth.oauth_consents`, the Zugänge entry) | SkillDisabled: right away, once the user holds no other Alexa session. "trennen": GoTrue only marks it revoked; the daily job deletes it |
| An Alexa session and its link unused for 12 months | by the daily job, then its grant with it |

The daily job is `public.purge_alexa()` (pg_cron `purge-alexa`, 03:29 UTC). It also deletes
links whose session is gone and Alexa grants with no session left (a day's grace while a link
is in progress). "Unused" means no request moved `last_seen` and Alexa did not refresh the
token. The Alexa client is the one whose redirect URIs are Amazon's account linking URLs
(`public.alexa_client_ids()`), not the one named "Amazon Alexa".

## Request verification

Amazon requires it of every skill hosted outside Lambda; `verify.ts`, unit-tested rule by rule in
`verify_test.ts`:

1. `SignatureCertChainUrl`: `https`, host `s3.amazonaws.com` (any case), path starting with
   `/echo.api/` (case-sensitive, after normalizing `..`), port 443 if given, no user info.
2. The chain behind it (fetched once per worker, 3 s timeout, at most 64 KiB): the first
   certificate valid now and with the SAN `echo-api.amazon.com`; each certificate signed by the
   next one (a CA, valid now) until one is signed by a pinned root: Amazon Root CA 1-4 and
   Starfield Services Root CA - G2 ([`anchors.ts`](../supabase/functions/alexa/anchors.ts)). A test
   checks Amazon's real `echo-api-cert-12` chain against them. **If Amazon moves to another root,
   add it there.**
3. `Signature-256`: RSA PKCS#1 v1.5 with SHA-256 over the raw body bytes.
4. `request.timestamp` at most 150 s from now; one hour for `AlexaSkillEvent.*` (they are delivered
   later and retried, as the ASK SDK allows).
5. The application id (`context.System.application.applicationId`, else the session's) is one of
   `ALEXA_SKILL_ID`. Without it every request is refused.

Any failure answers 400 `{"error": "<reason>"}` before the database is touched.

## Configuration

| Variable | Where | What |
| --- | --- | --- |
| `ALEXA_SKILL_ID` | Supabase secrets (hosted), `supabase/functions/.env` (local) | the skill id(s), comma-separated, `amzn1.ask.skill.…`. Not secret, but configuration, so not in code |
| `ALEXA_TEST_ROOT_PEM`, `ALEXA_TEST_CHAIN_PEM` | local `supabase/functions/.env` only | the test CA (base64 PEM). Honoured only when the function runs in a local stack (`SUPABASE_URL` is `http://kong:8000`); in a hosted project they are ignored |
| `POSTHOG_PROJECT_API_KEY`, `POSTHOG_HOST` | as for every function (job 19) | error tracking and the `item_added` event |

The account-linking client secret lives only in the Alexa console (Amazon keeps it); Supabase
keeps its hash. It is never in the repo, the function's environment or a log.

## Analytics and privacy

- An add over Alexa is counted as `item_added` with `source: alexa`, `actor_role` and
  `household_size`, once per item that was not on the list yet, **only if the user's newest
  answer to the analytics question in the app was yes** (docs/ANALYTICS.md). The app records each
  install's answer on the server (`record_analytics_consent`) when the user answers, switches it
  under More, or signs in; the event goes out under that install id. No item names, utterances,
  Alexa ids or tokens in any event or log; the server catalog allows nothing else.
- Errors reach PostHog error tracking (project 319492) through `withTelemetry` and
  `telemetry.exception`, tagged `function_name: alexa`, scrubbed (no names, no tokens).
- Amazon processes the voice audio and the transcript. The privacy policy must name the skill
  before certification (NEEDS_PETER, Job 31).
- "Meine Daten exportieren" lists the stored analytics answers and the Alexa links (last use).

## Invocation name and Alexa's own lists

**Languages.** `alexa/voices.ts` picks the language per request from `request.locale`: de-DE
(and a request without a locale) is German (`speech.ts`, `voice/parse.ts`, German capitals for
names heard in lowercase); every en-* locale is English (`speech_en.ts`, `voice/parse_en.ts`,
names stored as heard, like Siri in English). The five English models are one model
(`skill_package_test.ts` keeps them identical). English one-shots: "Alexa, ask Hummlist to add
milk", "Alexa, tell Hummlist we need milk", "Alexa, ask Hummlist what's on the list"; "Alexa, add
milk to Hummlist" goes to Alexa's own lists, as in German.

The invocation name stays `hummlist` (Peter, 2026-11-02). On a German Echo Alexa sometimes hears
it as „Homelist“ or „Hamlist“, or only „Liste“, and then answers „Ich weiß nicht“ or opens her
own shopping list. Saying the name clearly as two syllables, „Humm-list“, helps; „Alexa, öffne
Hummlist“ first, then the items, is the fallback. The guide says both.

Alexa's built-in lists take any sentence without the invocation pattern: „Alexa, setz Milch auf
die Hummlist“ ends at „Ich konnte keine Liste finden unter Hummlist“. Only „Alexa, sag/frag
Hummlist, …“ and „Alexa, öffne Hummlist“ reach the skill. The guide lists those phrasings, and
`site/test/content.test.mjs` checks that each „Alexa, sag/frag Hummlist, …“ in the guides matches
a sample utterance of the de-DE model; `skill_package_test.ts` keeps the common one-shot forms
(„ich brauche Milch“, „füge Milch hinzu“, „setz Milch drauf“) in the model.

## Deploy

Deployed by job 31b (2026-10-30) to Peter's Amazon Developer account: skill
`amzn1.ask.skill.fee316d1-e9c1-44a4-a06e-955fbda63a1b` (development stage, de-DE), account linking
with the Supabase client "Amazon Alexa", development testing on, a beta test created and running
with no testers. Status and smoke results: [done/31b-alexa-deploy.md](done/31b-alexa-deploy.md).
The steps below are how it was done and how to redo it.

1. **ASK CLI.** `npm install -g ask-cli` (v2), then `ask configure` and sign in with the
   developer account (opens a browser; `ask configure --no-browser` on a server). The vendor
   id: `ask smapi list-vendors`.
2. **Create the skill** from the package: `cd alexa && ask deploy --target skill-metadata`.
   It creates the skill "Hummlist" (development stage), uploads `skill.json`, the de-DE model and
   the icons, and builds the model. The skill id lands in `alexa/.ask/ask-states.json`
   (gitignored). Check: `ask smapi get-skill-status -s <skill id>` shows the de-DE model
   `SUCCEEDED`.
3. **OAuth client.** `scripts/alexa-oauth-client.sh <vendor id>`. It prints the client id and the
   secret once.
4. **Account linking.** Without writing the secret to a file in the repo:

   ```bash
   jq --arg id "<client id>" --arg secret "<client secret>" \
     '.accountLinkingRequest.clientId = $id | .accountLinkingRequest.clientSecret = $secret' \
     alexa/account-linking.json > /tmp/alexa-linking.json
   ask smapi update-account-linking-info -s <skill id> --account-linking-request file:/tmp/alexa-linking.json
   rm /tmp/alexa-linking.json
   ask smapi get-account-linking-info -s <skill id>   # PKCE on, S256; no secret shown
   ```

   If the CLI refuses `pkceConfiguration`, set it in the console (Build → Account Linking →
   "PKCE" on, S256) and remove it from the file.
5. **Skill id for the function.** The lead (Supabase access token): `supabase secrets set
   ALEXA_SKILL_ID=<skill id> --project-ref jdwqrallbpdbshrdhenk`. The function itself is deployed
   by `supabase-deploy.yml` with every merge; `scripts/smoke-remote.sh` checks that an unsigned
   request gets 400.
6. **Try it** in the console's Test tab (Development) or on an Echo signed in as the developer
   account, after linking in the Alexa app (Skills → Hummlist → Konto verknüpfen). The beta
   checklist below is the full run.

Changes to the model, manifest or icons later: commit them, then run
`ALEXA_SKILL_ID=<skill id> scripts/alexa-deploy-dev.sh` where the ASK CLI is signed in (the box,
job 69). It writes the state file below, runs `ask deploy --target skill-metadata` (development
stage only), restores `alexa/`, waits for the de-DE model build and checks over SMAPI that the
development stage serves the name „Hummlist“, the invocation name `hummlist` and both icons. By
hand: `ask deploy --target skill-metadata` from `alexa/`. In a checkout without `alexa/.ask/ask-states.json`, write it first, or ask deploy
creates a second skill:

```bash
mkdir -p alexa/.ask && jq -n --arg id "$ALEXA_SKILL_ID" \
  '{askcliStatesVersion: "2020-03-31", profiles: {default: {skillId: $id}}}' > alexa/.ask/ask-states.json
```

ask deploy rewrites `skill.json` and `ask-resources.json` in its own JSON style; discard that
(`git checkout -- alexa/`). It also keeps only what is inside `manifest`, which is why
`manifestVersion` sits there (`skill_package_test.ts` checks it).

**Smoke test without a device.** `ask smapi invoke-skill-end-point -s <skill id>
--endpoint-region Default --skill-request-body file:<request.json>` makes Amazon sign a request
and send it to the function: an unlinked LaunchRequest or AddItemIntent answers "Bitte verknüpfe
zuerst dein Hummlist-Konto …" with a LinkAccount card. The function logs only refusals
("alexa request refused: <reason>", 400), so a 200 with no such line means the signature check
passed.

## Beta and certification

Both need Peter's yes first ([NEEDS_PETER.md](NEEDS_PETER.md), Job 31). Neither needs the other:
beta testing runs without certification.

**Beta (up to 500 testers, no certification).** Console → Distribution → Availability → Beta
Test: add the testers' e-mail addresses (their Amazon accounts), start the beta; Amazon mails each
an invitation link. Peter, Lea, Max and Barbie first.

**Beta checklist (on a real Echo or the Alexa app, each tester):**

1. Alexa app → Skills → "Hummlist" (from the beta link) → aktivieren → Konto verknüpfen: the
   Hummlist consent page shows "Amazon Alexa"; sign in, "Erlauben"; the Alexa app says the
   account is linked. In Hummlist, Mehr → Zugänge lists "Amazon Alexa".
2. "Alexa, sag Hummlist, füg Milch hinzu": Alexa says "Ich habe Milch auf die Hummlist gesetzt.";
   Milch appears on another member's phone within 5 seconds, in Kühlregal (AC1, AC3).
3. "Alexa, sag Hummlist, füg Milch und Eier hinzu": "Ich habe Eier … Schon auf der Hummlist:
   Milch." Then with two new things ("Brot und Äpfel"): "Ich habe Brot und Äpfel auf die Hummlist
   gesetzt." (AC2).
4. "Alexa, sag Hummlist, füg zwei Liter Hafermilch hinzu": the app shows "Hafermilch" with 2 l.
5. "Alexa, öffne Hummlist", then mumble something: "Das habe ich nicht verstanden. Was soll auf
   die Liste?"; mumble again: "… Ich habe nichts auf die Hummlist gesetzt."; nothing added (AC4).
6. "Alexa, frag Hummlist, was auf der Liste steht": the open items, at most 10 (AC6 of the spec's
   read-back).
7. Disable the skill in the Alexa app, enable it again without linking: "Alexa, sag Hummlist, füg
   Brot hinzu" asks to link the account; nothing added; Zugänge no longer lists "Amazon Alexa"
   (AC8).
8. Link again, then Mehr → Zugänge → "Amazon Alexa trennen": the next request asks to link (AC8).

**Certification**: [ALEXA_CERTIFICATION.md](ALEXA_CERTIFICATION.md) has what is ready, what
Amazon's validation said and what is left (the test account, the submit). The privacy policy URLs
are in `skill.json` (`/datenschutz`, `/en/privacy`); no terms URL until the terms pages are live.
The testing instructions are in `skill.json` too, without credentials (the test account goes
into the console field only).
Certification usually asks about a one-word invocation name: "Hummlist" is the product's brand
(the app's name in the stores), which is the documented exception.

**Testing instructions**: `publishingInformation.testingInstructions` in `skill.json`, German and
English, checked by `skill_package_test.ts` (no credentials).

## Testing

- `deno test` in `supabase/functions` (the functions gate): `alexa/verify_test.ts` (each
  verification rule, Amazon's real chain), `handler_test.ts` (intents, read-back, re-prompt,
  unlinked and revoked, two households and a switch, errors, rate limit, long input, analytics
  and error-tracking payloads), `skill_package_test.ts` (AC11 and the package's structure),
  `config_test.ts` (the test CA only in a local stack). English: the `English …` tests at the end
  of `handler_test.ts`, and every locale's model in `skill_package_test.ts`.
- `alexa/store_integration_test.ts` against the stack's database (the db gate): the production
  wiring adds and reads like the app, keeps households apart, limits, links and revokes.
- `supabase/tests/alexa.test.sql` (pgTAP): no client reaches the tables or functions; the
  consent RPC; the rate limit; links and revocation; the export; what is kept and the daily job.
- `e2e/tests/alexa.spec.ts` (the e2e gate, CI): account linking with a confidential client, PKCE
  and the layla redirect through the app's consent page, a refresh, signed requests adding
  "Milch" visible on another member's screen within 5 s, categories as typed, re-prompt,
  revocation in Zugänge and by SkillDisabled (the link, the counter and, for SkillDisabled, the
  Zugänge entry gone right away), two households and a switch, forged, stale and
  foreign-skill requests refused. `e2e/tests/alexa-en.spec.ts`: the same linking, then an en-US
  add, duplicate and read in English. It writes a redacted transcript of the linking
  (`alexa-account-linking-transcript.txt` in the screenshots artifact).
- By hand on a local stack: `scripts/alexa-test-ca.sh` runs with every `supabase_up`
  (scripts/lib.sh); restart the stack once if it was running before. Then
  `scripts/alexa-say.sh --launch`, `scripts/alexa-say.sh --token <access token> "Milch und Eier"`,
  `--read`, `--unsigned`, `--stale`, `--disable`. An access token comes from the linking flow
  above (the e2e helpers), or any OAuth client's token for the user.
