# Siri (Shortcut and native Siri)

A user can put things on the Hummlist by voice with Siri on an iPhone. Two ways exist. The Shortcut: the user creates an access key in the app and builds a three-step shortcut in Apple's Shortcuts app named „Einkaufsliste“; then „Hey Siri, Einkaufsliste“ dictates a sentence, Hummlist splits it into items and Siri reads the result back. Native Siri: with the iPhone app (iOS 17 or newer) signed in to a household, Siri understands „Füge etwas zu Hummlist hinzu“ / "Add to Hummlist" and „Was steht auf meiner Hummlist?“ / "What's on my Hummlist?" with no setup. Native Siri is built and in test builds, but its announcement is held (native-siri hold, waiting for Hummlist Launch and a device test), so do not promote it. Nothing needs Premium today.

## Sub-features

- `siri-shortcut` the Shortcut recipe: access key „Siri“ (Mehr → Zugänge → „Token erstellen“), then the shortcut „Einkaufsliste“ (dictate text in German, POST to the voice address with `Authorization: Bearer fgp_…`, speak the result). German only for splitting.
- `siri-reply-added` spoken reply German: „Hinzugefügt: Milch, 2 Gurken, Klopapier.“
- `siri-reply-existing` already on the list: „Schon auf der Liste: Milch.“ (nothing added for it). Mixed: „Hinzugefügt: Brot. Schon auf der Liste: Milch.“
- `siri-reply-similar` a spelling variant or synonym is open: item is added and Siri adds „Möhren steht schon auf der Liste.“ (several: „… stehen schon auf der Liste.“).
- `siri-errors` the exact sentences, German and English (see below).
- `siri-limits` at most thirty items per sentence: „Mehr als dreißig auf einmal gehen nicht; sag den Rest bitte noch einmal.“ (EN "More than thirty at once doesn't work; please say the rest again."); text over 1000 characters is refused (too_long).
- `siri-native-add` native Siri adds in German or English; English reply „Added milk, eggs and bread to Hummlist.“
- `siri-native-read` native Siri reads the open list: „Auf der Hummlist stehen 3 Sachen: …“ / „Die Hummlist ist leer.“ (EN "There are 3 things on your Hummlist: …" / "Your Hummlist is empty."); at most ten are named, then „und N weitere“ / "and N more".
- `siri-credential` the iPhone app creates its own Siri key „Siri (dieses iPhone)“ after sign-in in a household (other phones: „Siri (anderes iPhone)“); it ends with sign-out, leaving the household, account deletion or revoking it; at most five Siri keys per account (the oldest ends). Works only for Siri; the MCP server refuses it.
- `siri-card` Zugänge on iPhone shows the card: „Siri funktioniert jetzt ohne Einrichtung. Sag: „Füge etwas zu Hummlist hinzu“.“ with the link „Siri-Sätze anzeigen“ (dialog „Siri-Sätze“, „Auf Deutsch“ / „Auf Englisch“, the four phrases each). If the user has an old key named like the Shortcut (Siri, Kurzbefehl, Shortcut): „Den alten Kurzbefehl brauchst du nicht mehr. Seinen Token „<Name>“ kannst du unten löschen.“ Revoking a Siri key asks „Siri-Zugang widerrufen?“ / „Siri kann auf dem iPhone dann nichts mehr hinzufügen. Beim nächsten Start von Hummlist dort wird Siri neu eingerichtet.“
- `siri-suggestions` the app tells Siri which item names to offer for „Füge <Eintrag> zu Hummlist hinzu“ / "Add <item> to Hummlist": the household's usuals first, then open items, then recently bought, each name once, at most 50, sent at most every 2 seconds after the list changes. Names only, nothing else.
- `siri-dictation` related, not Siri: the microphone button in the add bar on the iOS and Android apps (tooltip „Diktieren“, while listening „Diktat beenden“, hint „Ich höre zu …“). Not on web.

## How to get to it (user POV)

- Shortcut: Mehr → Zugänge → „Zugriffstoken“ → „Token erstellen“, name `Siri`, copy the key once; then Shortcuts app → new shortcut „Einkaufsliste“ with actions „Text diktieren“ (Deutsch, nach Pause, prompt „Was soll auf die Liste?“), „Inhalte von URL abrufen“ (POST, `https://jdwqrallbpdbshrdhenk.supabase.co/functions/v1/voice?format=text`, header `Authorization: Bearer fgp_…`, JSON field `text` = Diktierter Text), „Text sprechen“ (Inhalte der URL). Say „Hey Siri, Einkaufsliste“. If Siri opens Reminders instead, rename the shortcut, for example „Einkauf notieren“. Public guides: DE „Hummlist per Siri: Kurzbefehl einrichten“, EN "Hummlist with Siri (German only for now)" on hummlist.com (their native-Siri section is tagged since 1.0.0 and hidden in production until that release).
- Native (iPhone, iOS 17+, signed in, in a household): „Hey Siri, füge etwas zu Hummlist hinzu“ then the items; English „Hey Siri, add something to my Hummlist“. Phrases (Zugänge → „Siri-Sätze anzeigen“): EN "Add to Hummlist", "Add something to my Hummlist", "Add <item> to Hummlist", "What's on my Hummlist?"; DE „Füge etwas zu Hummlist hinzu“, „Auf meine Hummlist“, „Füge <Eintrag> zu Hummlist hinzu“, „Was steht auf meiner Hummlist?“. Siri listens in the iPhone's language, not the app's.
- Failure sentences German / English (exact): 
  - key missing or wrong: „Der Zugriffstoken fehlt oder ist ungültig. Erstelle in der Hummlist-App unter Mehr, Zugänge einen neuen.“ / "I couldn't sign in to Hummlist, so nothing was added. Open Hummlist and sign in again."
  - no household: „Du bist noch in keinem Haushalt. Leg in der Hummlist-App einen an oder tritt einem bei.“ / "You're not in a household yet, so nothing was added. Create one or join one in the Hummlist app."
  - no text: „Ich habe keinen Text bekommen. Sag zum Beispiel: Milch, zwei Gurken und Klopapier.“ / "I didn't get any text, so nothing was added. Say for example: milk, two cucumbers and toilet paper."
  - nothing understood: „Ich habe nichts verstanden, was auf die Liste soll. Sag zum Beispiel: Milch, zwei Gurken und Klopapier.“ / "I didn't understand anything to put on the list. Say for example: milk, two cucumbers and toilet paper."
  - too long: „Das war zu lang. Sag höchstens dreißig Dinge auf einmal.“ / "That was too long, so nothing was added. Say at most thirty things at once."
  - server: „Das hat leider nicht geklappt. Versuch es gleich noch einmal.“ / "Sorry, that didn't work, nothing was added. Please try again in a moment."
  - not POST: „Bitte schick den Text per POST.“ / "Please send the text with POST."
- Other replies: EN existing "Already on the list: milk." ; EN similar "<Name> is already on the list." (several: "<Names> are already on the list."); parse-only (the app's microphone, German) „Verstanden: Milch, Brot.“ / EN "Got it: milk and bread."
- Items appear on all phones within seconds.

## Driving it with Playwright

Preconditions:

- Web cannot run Siri. Only the server side is drivable, over HTTP against the LOCAL stack, as `e2e/tests/voice.spec.ts` does. Seeded household „Familie Brandt“, signed in. Never call production.
- Helpers in `e2e/tests/voice.spec.ts`: `say(token, text, '?format=text')`, `ask(token, { text, mode, lang })`, `sessionToken(email)`; a key from `(await apiAs(email)).rpc('create_personal_access_token', { p_name: 'Siri' })` or, for native Siri, `rpc('create_siri_credential')`. `functionsUrl` + `/voice`. Run: `scripts/verify.sh --only e2e -- tests/voice.spec.ts`.

- **Create the key in the UI.** `openMore(page, 'Zugänge')`, `getByRole('button', { name: 'Token erstellen' })`, `typeInto(getByRole('textbox', { name: 'Name' }), 'Siri')`, `getByRole('button', { name: 'Erstellen' })`, read `getByText(/^fgp_/)`, `getByRole('button', { name: 'Fertig' })`.
- **Dictate.** `say(token, 'Zwei Gurken und Klopapier')` returns status 200 and JSON `speech` „Hinzugefügt: 2 Gurken, Klopapier.“; `say(token, 'Milch und Brot', '?format=text')` returns the body only. In the app: `openTab(page, 'Liste')`; `itemRow(page, 'Klopapier')` visible without reload.
- **Duplicate and similar.** Say „Milch“ twice: second answer „Schon auf der Liste: Milch.“. Say „Möhren“ then „Karotten“: both on the list, speech ends „Möhren steht schon auf der Liste.“
- **Errors.** `say('fgp_not-a-token', 'Milch', '?format=text')` is 401 with the unauthorized sentence; text „Bitte, danke“ is 422 with „Ich habe nichts verstanden …“.
- **Native, English.** `ask(token, { text: 'milk, eggs and bread', mode: 'add', lang: 'en' })`: `outcome` `added`, `speech` "Added milk, eggs and bread to Hummlist."; again with `milk`: `nothing_added`, "Already on the list: milk."; `ask(token, { mode: 'read', lang: 'en' })`: `total` 3, speech starts "There are 3 things on your Hummlist: "; German `lang: 'de'`: „Auf der Hummlist stehen 3 Sachen: “. A request without `lang` answers exactly as the Shortcut always did and has no `outcome`.
- **Ending.** Revoke in the app (`getByRole('button', { name: 'Siri widerrufen' })`, then `getByRole('button', { name: 'Widerrufen' })`): the next request is 401. For the Siri credential: signing out the session that created it also gives 401, `outcome` `unauthorized`; the MCP endpoint answers 401 to it.

## Gotchas

- Native Siri and the „Siri“ card on Zugänge exist only in the iOS app (a method channel to the iPhone). On web and Android Zugänge shows no Siri header and card (a Siri key made on an iPhone still shows as „Siri (anderes iPhone)“ there). There is no way to drive Siri voice or the Shortcuts app on this harness. unverified (needs a real iPhone; Peter's device test is pending, per the native-siri hold).
- The native-siri hold: the code is on main and ships in iOS test builds, but the changelog and site announcement wait for Hummlist Launch. Describe native Siri only as "coming", never as released.
- The Shortcut path is live today, but it is manual and splits German only (the English splitter is used only when the request names `lang: 'en'`, which the Shortcut does not send).
- Integration lock: production has the server switch off, so a household without Premium is not refused. The e2e build plus switch on gives „Sprachbefehle sind Teil von Hummlist Premium. Du kannst es in der App freischalten. Ich habe nichts hinzugefügt.“ (EN "Voice commands are part of Hummlist Premium. You can unlock it in the app under More, Hummlist Premium. I didn't add anything."): placeholder copy, not live.
- Voice replies must be quoted exactly from the lists above; Siri reads them aloud verbatim.
- The `list` field and `mode` / `lang` request fields are the contract for the native app; keep them out of copy.
- The in-app microphone is mobile-only; Playwright on web cannot drive it.
