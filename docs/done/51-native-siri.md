# Job 51: native Siri (App Intents, English and German)

Spec #9. On an iPhone with iOS 17 or newer, a household member signed in to Hummlist can say "Add
to Hummlist" or "Füge etwas zu Hummlist hinzu", then name the items. Siri adds them to the
household's list and reads back what it added. There is no Shortcut to set up and no token to
copy. "What's on my Hummlist?" / "Was steht auf meiner Hummlist?" reads the open items. The old
Shortcut recipe keeps working unchanged. The reasons are in `docs/DECISIONS.md` "Job 51". The open
steps for the Lead and Peter (device test, the Siri capability if needed, placeholder copy, Legal
Review points) are in `docs/NEEDS_LEAD.md` "Job 51".

## What was built

- **iOS** (`app/ios/Runner/AppIntents/`):
  - `AddItemsIntent`, `ReadListIntent`, `HummlistShortcuts` (10 phrases in English and German,
    `en.lproj`/`de.lproj` `AppShortcuts.strings`) and the `ItemSuggestion` entity for "Add milk to
    Hummlist".
  - `VoiceClient` (8 s in all, branches on the server's `outcome`), `SiriCredentialStore` (Keychain,
    this device only) and the `hummlist/siri` channel.
  - Siri's sentences are in `Localizable.xcstrings` (EN and DE). Everything runs in the
    background, iOS 17 and newer. The language comes from the dictated text, else the app's
    language.
- **Server** (`supabase/functions/voice/`, `_shared/auth.ts`):
  - `lang: de|en` with an English parser (`parse_en.ts`) and one copy table (`copy.ts`).
  - `mode: read`, and `outcome` in every answer to a request that names `lang`.
  - `premium_required` copy for job 50, which no code path returns yet.
  - `siri_add` and `siri_read` events.
  - The Shortcut's answers are byte-identical.
- **Database:**
  - `20261031213000_siri_credentials.sql`: the Siri credential is a `personal_access_tokens` row
    of kind `siri`, bound to the app's Supabase session. It is minted by `create_siri_credential`
    and checked by `authenticate_access_token`.
  - `20261031213001_classifier_synonyms_english.sql`: English synonyms.
- **App** (`app/lib/siri/`, `app/lib/settings/access_*`):
  - On iOS, the app keeps the credential in step with the session: created in a household,
    revoked and cleared on sign-out, cleared without a household.
  - It sends up to 50 item names for the one-shot phrase.
  - Zugänge shows the Siri card, the phrases dialog, "Siri (dieses iPhone)" and a hint to delete
    the old Shortcut's token.
- **Docs and guides:**
  - The guides' native Siri sections, marked `since=1.0.0` and noted as drafts for Launch.
  - `docs/SIRI_SHORTCUT.md` engineering notes, `docs/ANALYTICS.md`, `analytics/queries/privacy_scan.sql`.
  - The verify recipe `features/voice.md`.
  - The `native-siri` hold in `releases/flags.json`.

## How it was verified

- **Swift.** CI's `ios` job on macOS 26 with Xcode 26.6 builds the app, including Validate app
  shortcut strings metadata. It then runs 23 XCTests on an iPhone 17 Pro simulator, covering:
  - every outcome mapped to an answer: success, already on the list, each failure, premium at 200
    and 403, offline, timeout, 401, no credential, and a malformed reply;
  - the Keychain round trip and its accessibility;
  - language detection;
  - that every phrase is translated.
- **Deno.** The voice, auth and telemetry tests, plus the EN parser table. A test proves the error
  report for a failing add has no item text, and another that no input reaches
  `premium_required`.
- **pgTAP** (`siri_credentials.test.sql`, `english_groceries.test.sql`):
  - the kind check and the create refusals (anon, OAuth client, no household);
  - the session binding, revoke, `p_replace`, the cap of 5 and the account-deletion cascade;
  - 50 English grocery words getting their category.
- **e2e.** `voice.spec.ts`: the existing Shortcut cases unchanged, an English add with a minted
  Siri credential, and `mode: read`.
- **Flutter.** The whole suite passes, including the credential lifecycle and the Zugänge card in
  DE and EN.
- **By hand on the local stack with `fg`:**
  - "two cucumbers and a pack of eggs" (en) → "Added 2 cucumbers and 1 pack of eggs to
    Hummlist."; again → `nothing_added`.
  - "Füge Milch zu Hummlist hinzu" → Milch.
  - Read → "There are 5 things on your Hummlist: …".
  - A minted Siri credential adds through `voice` and gets 401 from `mcp`. After
    `/auth/v1/logout` of its session, voice answers 401 "… Open Hummlist and sign in again."
- **Screenshots.** `docs/screenshots/51-native-siri/` (Zugänge card, legacy hint and phrases
  dialog, DE and EN).

## Open

- Real Siri voice, HomePod and Siri's language choice can only be checked on Peter's iPhone with
  the TestFlight build after merge (NEEDS_LEAD "Job 51", device test).
- English "beer" is classified as produce: the German stemmer folds it into "Beere".
- iOS 15 and 16 users keep the Shortcut recipe.
