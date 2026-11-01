# Alexa skill (beta, not certified)

A household member can say „Alexa, sag Hummlist, füg Milch und Eier hinzu“ and the items land on the household's list, sorted into categories like typed ones, visible to every member within seconds; Alexa reads back what it added. „Alexa, frag Hummlist, was auf der Liste steht“ reads the open items. The skill is German only (de-DE), in beta and not certified by Amazon (alexa-certification hold): it is not in the Alexa Skill Store for everyone. A user gets it today only by an invitation to the beta test (the invitation link comes from Peter, who needs the email address of the user's Amazon account), then enabling the skill and linking the account in the Alexa app. Nothing needs Premium today.

## Sub-features

- `alexa-add` adds the items of one phrase (several, quantities, umlauts) to the linked user's household and reads them back.
- `alexa-duplicate` names open items without adding them again.
- `alexa-similar` a spelling variant or synonym already open is added anyway and named.
- `alexa-read` reads the open items in aisle order, at most ten, then „und N weitere“; an empty list has its own sentence.
- `alexa-reprompt` asks once when nothing was understood, then gives up; nothing is added.
- `alexa-unlinked` asks to link the account (a link card in the Alexa app) when there is no link or it was cut.
- `alexa-link` account linking: Alexa app → Skills → Hummlist → „Zur Verwendung aktivieren“ / „Konto verknüpfen“ opens the Hummlist consent page „Zugriff erlauben?“ for „Amazon Alexa“; afterwards Mehr → Zugänge lists „Amazon Alexa“ under „Verbundene Apps“.
- `alexa-revoke` Alexa is cut off at once by „Amazon Alexa trennen“ then „Trennen“ in Zugänge, or by disabling the skill in the Alexa app; linking again restores it.
- `alexa-help` help and stop.
- `alexa-verify` requests not signed by Amazon, stale or for another skill are refused (HTTP 400) before anything is read.

## How to get to it (user POV)

- Today (beta): get the beta invitation link from Peter, accept it with the Amazon account used for Alexa, open the skill „Hummlist“ in the Alexa app (its icon carries the note „dev“ in test), tap „Zur Verwendung aktivieren“, sign in to Hummlist, check „Zugriff erlauben?“ shows „Amazon Alexa“ and tap „Erlauben“. Needs a German-language Alexa device, a Hummlist account, a household, and the Alexa app. Published guide: „Hummlist per Alexa: Skill einrichten“ on hummlist.com.
- Invocation: „Alexa, sag Hummlist, …“, „Alexa, frag Hummlist, …“, „Alexa, öffne Hummlist“. Invocation name: „hummlist“.
- Add phrases (sample utterances): „füg {items} hinzu“, „füge {items} hinzu“, „füg {items} zur liste hinzu“, „füg {items} zur einkaufsliste hinzu“, „{items} hinzufügen“, „setz {items} auf die liste“, „pack {items} auf die liste“, „schreib {items} auf“, „trag {items} ein“, „notier {items}“, „wir brauchen {items}“, „ich brauche {items}“, „{items} auf die liste“, „dass wir {items} brauchen“ and more. Read phrases: „was steht auf der liste“, „was auf der einkaufsliste steht“, „was wir brauchen“, „was muss ich kaufen“, „lies die liste vor“, „die liste“ and more. Item names given in lower case are capitalized the German way („milch ohne laktose“ becomes „Milch ohne Laktose“).
- Exact spoken replies (German only):
  - one item added: „Ich habe Milch auf die Hummlist gesetzt.“
  - several added: „Milch und Eier sind auf der Hummlist.“ / „Milch, Eier und Brot sind auf der Hummlist.“
  - mix: „Ich habe Eier auf die Hummlist gesetzt. Schon auf der Hummlist: Milch.“
  - already there only: „Schon auf der Hummlist: Milch.“
  - similar: „Möhren steht schon auf der Hummlist.“ (several: „… stehen schon auf der Hummlist.“)
  - units are spoken out: 2 l becomes „2 Liter“, kg „Kilo“, g „Gramm“, ml „Milliliter“.
  - more than thirty things: the confirmation is followed by „Mehr als dreißig auf einmal gehen nicht; sag den Rest bitte noch einmal.“
  - read: „Auf der Hummlist stehen 3 Sachen: Milch, Eier und Brot.“ / one item „Auf der Hummlist steht eine Sache: Milch.“ / more than ten: „Auf der Hummlist stehen 12 Sachen: a, b, … und 2 weitere.“ (exactly one more: „und eine weitere“) / empty: „Die Hummlist ist leer.“
  - open (launch): „Was soll auf die Liste?“ (reprompt „Was soll auf die Liste? Sag zum Beispiel: Milch und Eier.“)
  - help: „Mit Hummlist setzt du Sachen auf eure Einkaufsliste. Sag zum Beispiel: füg Milch und Eier hinzu. Oder frag: was steht auf der Liste? Was möchtest du?“ (reprompt „Was soll auf die Liste? Oder frag: was steht auf der Liste?“)
  - stop / cancel: „Bis bald.“
  - not understood, first time: „Das habe ich nicht verstanden. Was soll auf die Liste?“ (reprompt „Was soll auf die Liste? Sag zum Beispiel: Milch und Eier.“); second time: „Das habe ich leider nicht verstanden. Ich habe nichts auf die Hummlist gesetzt.“
  - not linked / cut off: „Bitte verknüpfe zuerst dein Hummlist-Konto in der Alexa-App. Ich habe dir dort eine Karte dazu geschickt.“
  - no household: „Du bist noch in keinem Haushalt. Leg in der Hummlist-App einen an oder tritt einem bei, dann klappt es auch mit Alexa.“
  - too long: „Das war zu lang. Sag höchstens dreißig Sachen auf einmal. Ich habe nichts hinzugefügt.“
  - too many requests: „Das waren gerade sehr viele Sachen auf einmal. Warte bitte eine Minute, dann geht es weiter. Ich habe nichts hinzugefügt.“
  - add failed: „Entschuldigung, das hat gerade nicht geklappt. Ich habe nichts hinzugefügt. Versuch es bitte gleich noch einmal.“
  - read failed: „Entschuldigung, ich komme gerade nicht an die Hummlist. Versuch es bitte gleich noch einmal.“
  - The add and read answers also appear as a card titled „Hummlist“ in the Alexa app.
- Skill store text (not live): „Eure gemeinsame Einkaufsliste: Sachen per Zuruf auf die Hummlist setzen.“ Available in DE, AT, CH, LU, LI only.

## Driving it with Playwright

Preconditions:

- Alexa itself cannot be driven. Only the skill's server side is, over HTTP against the LOCAL stack, as `e2e/tests/alexa.spec.ts` does: run `scripts/alexa-test-ca.sh` once before the stack starts (restart the stack if it was already running), then use `scripts/alexa-say.sh` or the helpers in `e2e/tests/alexa-helpers.ts` (`alexaRequest`, `addIntent`, `readIntent`, `postToAlexa`, `say`, `registerAlexaClient`, `linkAccount`). Never call production.
- Seeded household „Familie Brandt“ (baseline, three members), two of them signed in in two browser contexts for the live-sync check. Run: `scripts/verify.sh --only e2e -- tests/alexa.spec.ts`.

- **Link the account (UI part).** `linkAccount(...)` registers a confidential OAuth client named like Alexa and opens the authorize URL with PKCE and the Alexa redirect `https://layla.amazon.com/api/skill/link/<vendor id>` in the signed-in page. The consent page shows „Zugriff erlauben?“ and `getByText('Amazon Alexa')`; click `getByRole('button', { name: 'Erlauben' })`; the callback carries a code; exchange it for an access token with HTTP Basic.
- **Zugänge shows it.** `openMore(page, 'Zugänge')`; `page.getByText('Amazon Alexa').first()` is visible under „Verbundene Apps“.
- **Add.** `say(token, 'Milch und Eier')` (or `scripts/alexa-say.sh --url "$API" --token "$TOKEN" "Milch und Eier"`): `response.outputSpeech.text` is „Milch und Eier sind auf der Hummlist.“; in the partner's page `itemRow(lea, 'Eier')` is visible within 5 seconds without reload; both are under category „Kühlregal“ (`getByRole('heading', { name: 'Kühlregal' })`).
- **Duplicate / read / re-prompt / launch.** `say(token, 'Milch')` gives „Schon auf der Hummlist: Milch.“; `scripts/alexa-say.sh … --read` gives „Auf der Hummlist stehen N Sachen: …“; `say(token, 'äh')` then `--retry` gives the two not-understood sentences, `shouldEndSession` false then true; `--launch` with no token gives the link sentence and a `LinkAccount` card.
- **Revoke.** `getByRole('button', { name: 'Amazon Alexa trennen' }).click()`, `getByRole('button', { name: 'Trennen', exact: true }).click()`, `getByText('Noch keine App verbunden.')`; the next add answers the link sentence and adds nothing; the refresh token is refused. Or `--disable` (SkillDisabled).
- **Verify.** `--unsigned` and `--stale` answer HTTP 400 (`missing_signature`, `stale_timestamp`); no item is added.

## Gotchas

- The beta status is the product reality: do not say the skill is in the Alexa Skill Store or certified. The hold `alexa-certification` stays until Amazon certifies it.
- German only: invocation, utterances and replies. No English reply exists.
- A stack started before `scripts/alexa-test-ca.sh` ran does not trust the test CA: every signed request answers 400 before any intent. Restart the local stack after running the script.
- The local function trusts the test CA only in a local stack; a hosted project refuses it, and `scripts/alexa-say.sh` cannot reach a hosted project.
- Integration lock: production has the server switch off. With the e2e build and switch on, an add by a household without Premium says „Sprachbefehle sind Teil von Hummlist Premium. Du kannst es in der App freischalten. Ich habe nichts hinzugefügt.“; read and launch say the first two sentences with a card (placeholder copy). Not live.
- Real Alexa voice, the Alexa app linking screens and the beta invitation cannot be checked here. unverified (needs a real device and an Amazon account).
