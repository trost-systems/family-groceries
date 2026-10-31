# Alexa skill

A household member says "Alexa, sag Hummlist, füg Milch und Eier hinzu" and the items land on the household's list, categorized like typed ones and visible to every member within seconds; Alexa reads back what it added ("Milch und Eier sind auf der Hummlist."). "Alexa, frag Hummlist, was auf der Liste steht" reads the open items. The account is linked once in the Alexa app through the app's consent page ("Amazon Alexa"), shows under Mehr → Zugänge, and is cut off there, by disabling the skill, or by linking again.

## Sub-features

- `alexa-add` adds the items of one phrase (several, quantities, umlauts) to the linked user's current household and reads them back.
- `alexa-duplicate` names open items ("Schon auf der Hummlist: Milch.") without adding them again.
- `alexa-read` reads the open items in aisle order, at most 10, then "und N weitere"; an empty list has its own sentence.
- `alexa-reprompt` asks once when nothing was understood, then says "… Ich habe nichts auf die Hummlist gesetzt."; nothing is added.
- `alexa-unlinked` asks to link the account (LinkAccount card) when there is no token or it was revoked.
- `alexa-link` is account linking: the consent page shows "Amazon Alexa", and Mehr → Zugänge lists it afterwards.
- `alexa-revoke` cuts Alexa off at once: "Amazon Alexa trennen" under Zugänge, or the skill disabled in the Alexa app.
- `alexa-verify` refuses unsigned, tampered, stale and foreign-skill requests with 400 before anything is read.

## How to get to it (user POV)

- An Echo or the Alexa app, after the skill is enabled and linked (beta, docs/ALEXA.md): "Alexa, sag Hummlist, …", "Alexa, frag Hummlist, …", "Alexa, öffne Hummlist".
- Linking: Alexa app → Skills → Hummlist → Konto verknüpfen, which opens the app's consent page (web).
- Locally there is no Alexa: `scripts/alexa-say.sh` sends the request Alexa would send, signed with the local test CA.

## Driving it with fg

Preconditions:

- Run `scripts/alexa-test-ca.sh` once before `fg up` (it writes the test CA into `supabase/functions/.env`, which fg's stack links; `fg up` doesn't run it). A running stack doesn't load the new variables, and `fg up --fresh` only resets the database: run `fg down`, then `fg up`. Baseline from `features/README.md`; peter and lea signed in.
- An access token for peter as Alexa holds it: run the linking in a browser as `e2e/tests/alexa-helpers.ts` `linkAccount` does (register with `scripts/alexa-oauth-client.sh <vendor id, 6-20 capitals or digits such as LOCALTEST1> "$(fg env | jq -r .apiUrl)"`, open the authorize URL with PKCE and the layla redirect, "Erlauben" on peter's web client, exchange the code with HTTP Basic). Keep the token in a shell variable `TOKEN`, never in a file.

- **Add.** `scripts/alexa-say.sh --url "$(fg env | jq -r .apiUrl)" --token "$TOKEN" "Milch und Eier"` answers `outputSpeech.text` "Milch und Eier sind auf der Hummlist."; `fg wait --client lea --text Eier` succeeds on lea's client within 5 seconds without a tap. `fg db query --as peter "select i.name, c.name from items i join categories c on c.id = i.category_id where i.status = 'active'"` shows Kühlregal for both.
- **Duplicate.** The same call with "Milch" answers "Schon auf der Hummlist: Milch."; the Milch count stays 1.
- **Read.** `scripts/alexa-say.sh … --token "$TOKEN" --read` answers "Auf der Hummlist stehen 2 Sachen: …".
- **Re-prompt.** `… --token "$TOKEN" "äh"` answers "Das habe ich nicht verstanden. Was soll auf die Liste?" with `shouldEndSession` false; `… --token "$TOKEN" --retry "ähm"` answers "Das habe ich leider nicht verstanden. Ich habe nichts auf die Hummlist gesetzt."
- **Unlinked.** `scripts/alexa-say.sh … --launch` (no token) answers "Bitte verknüpfe zuerst dein Hummlist-Konto …" with `card.type` LinkAccount.
- **Revoke.** On peter's client: `fg tap --key tab-more`, Zugänge, tap "Amazon Alexa trennen" and confirm "Trennen". The add call with `$TOKEN` now answers the link sentence and adds nothing. Or `scripts/alexa-say.sh … --disable` (SkillDisabled for the default Alexa user that made the earlier calls) with the same result.
- **Verify.** `… --unsigned "Bier"` and `… --stale "Bier"` answer 400 `missing_signature` and `stale_timestamp`; no Bier row exists.
- **Proof.** The JSON answers, `fg screenshot --name alexa-<sub-feature>` of lea's list, and the `fg db query` rows.

## Gotchas

- The local function trusts the test CA only inside a local stack; it never accepts a request a hosted project would refuse, and `scripts/alexa-say.sh` cannot reach a hosted project.
- A stack started before `scripts/alexa-test-ca.sh` ran doesn't trust the test CA: every signed request answers a 400 before any intent runs (`{"error":"cert_expired"}` on 2026-10-31). Restart it with `fg down` and `fg up`. Without the CA at all, `scripts/alexa-say.sh` refuses to sign ("no test CA").
- `--disable` revokes the sessions of the Alexa user id in the request (default `amzn1.ask.account.LOCAL`); use the same `--user` for the add calls and the disable.
- Alexa itself, the spoken voice and the Alexa app's linking screens can only be checked on a real device (docs/NEEDS_PETER.md, Job 31 beta checklist). Report them as not drivable here.
