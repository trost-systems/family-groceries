# Decisions

Calls made without a human in the loop, with the reason. Peter can overturn
any of them; each entry says what changing it would touch.

## Job 1 (foundation), 2026-10-22

1. **App identifiers.** Bundle id and applicationId
   `com.petertrost.familygroceries`; display name "Einkauf". Changing them
   touches `app/android/app/build.gradle.kts`, the Xcode project and
   `Info.plist`.
2. **One household per user.** `household_members.user_id` is unique.
   Joining another household moves the user; if they were the last member,
   the old household and its list are deleted (the app warns before joining).
   Peter and Lea share one list, so multi-household support would only add
   a switcher nobody needs.
3. **Invites are codes, never sent.** 8 characters from an alphabet without
   look-alikes (no 0/O/1/I), valid 14 days, reusable until then, revocable
   via `revoked_at`. The app shows the code and a `/join/<code>` link to copy.
4. **Fallback category "Sonstiges".** Seeded as an 11th category (sort order
   1000, `seed_key = 'other'`) so every item always has a category and a
   correction can target it. A trigger forbids deleting it.
5. **Seeded rows carry a `seed_key`.** Categories and stores keep a stable
   identity (`produce`, `drugstore`, `dm`, ...) when renamed, so later jobs
   (store layouts, the classifier dictionary) can address them.
6. **Placeholder classifier in Postgres.** `classify_item(household, name)`
   matches about 60 keywords by exact or suffix match ("Vollmilch" ends in
   "milch"), else the fallback. The items insert trigger calls it when no
   category is given. Job 2 replaces the body; callers do not change.
7. **Klopapier/Toilettenpapier go to Haushalt** in the stub (paper goods
   sit with household goods in Lidl and Edeka). Job 2 revisits this with the
   store layouts.
8. **Quantity is free text.** `items.quantity` holds "2", "500 g",
   "3 Dosen". The app parses a leading amount ("2 Gurken") or a trailing
   amount with a unit ("Hack 500 g"); a bare trailing number stays part of
   the name ("Windeln Größe 4").
9. **History.** Ticked items keep `status = 'bought'` with `bought_at` and
   `bought_by`; the app shows the last 20 under "Zuletzt gekauft" for a
   one-tap re-add. Every insert, tick, restore, edit and delete is also
   written to `item_events` by a trigger (append-only for clients).
10. **Optimistic writes as idempotent ops.** The app applies each change
    locally at once, queues it, and replays it until the server answers.
    Client-generated UUIDs make adds idempotent (`upsert ... ignoreDuplicates`).
    Network errors keep the op queued and retry every 3 s; a refused write is
    dropped and reported. On every realtime (re)subscribe and on app resume
    the app refetches and folds pending ops on top.
11. **Cold start needs the network.** The app keeps no local copy of the
    list yet: offline at launch it shows a spinner and retries until online.
    Changes made while online stay queued across connection loss.
    Tracked in https://github.com/peter-trost/family-groceries/issues/3.
12. **Duplicates.** Adding an item whose name matches an active item
    (case-insensitive) does not add a second row; the app says it is
    already on the list.
13. **State management: flutter_bloc cubits, go_router, no codegen.** Same
    libraries as emotely, without freezed/get_it to keep the app small.
14. **Path URLs on web** (`/join/CODE`, later `/oauth/consent`). Static
    hosting needs an SPA fallback to `index.html` (`e2e/serve.mjs` does this).
15. **Semantics always on for web.** `SemanticsBinding.ensureSemantics()`
    makes the DOM accessible to screen readers and to Playwright.
16. **Flutter web focus workarounds**, found by experiment (see the PR):
    the add field handles a hardware Enter in `Focus.onKeyEvent` instead of
    the text-input action, which otherwise blurs the field and leaves it
    unable to take the next item; the tick checkbox is wrapped in
    `ExcludeFocus` because a focused element that disappears with its row
    leaves the field unable to receive text on the next tap.
17. **No web hosting yet.** The hosted Auth site URL and redirect list wait
    for a public web URL (GitHub Pages is the free candidate); see
    `NEEDS_PETER.md`. Superseded by 7.x: the web app is on Vercel.
18. **Local stack trims.** Studio, Storage and Analytics are disabled in
    `supabase/config.toml` to fit the shared 15 GB box; enable them locally
    when needed.
19. **pstack models.** `/setup-pstack` ran non-interactively on 2026-10-22
    with budget "large": Opus for code and judgment, Sonnet for swarm
    workers and second opinions (Grok slugs do not exist in Claude Code).
    Written to `~/.cursor/rules/pstack-models.mdc`.
20. **Node 20 on this box.** supabase-js needs a WebSocket for realtime in
    Node < 22, so the e2e helpers pass `ws` as the transport. CI uses Node 22.
21. **Repository location.** The repo moved from `petertrost-bot/family-groceries`
    to `peter-trost/family-groceries` (GitHub redirect seen on the first push,
    2026-10-22). The local remote points at the new URL; nothing else in the
    repo names the owner.
22. **Android APK builds on this box.** `scripts/bootstrap.sh --android`
    installs OpenJDK 21 and the Android command-line tools; `flutter build apk
    --release` then produces `app-release.apk` (56.5 MB, 3.6 min cold). It is
    signed with the debug key until job 4 adds release signing via secrets.

## Job 1 review fixes (review 0), 2026-10-22

23. **`classify_item` is members-only for signed-in callers.** It returned
    another household's category ids to anyone who knew that household's id.
    Migration `20261022190000_classify_item_members_only.sql` raises
    `not_a_member` (42501) when `auth.uid()` is set and is not a member.
    Calls without a user (service role for MCP and Siri, the database
    itself) stay allowed; the items trigger runs as the caller, so member
    inserts are unaffected.
24. **Merge author.** The squash commits `26e9d06` (#1) and `13dfe23` (#2) on
    `main` carry `petertrost-bot <bot@petertrost.com>`, the account's default
    email, instead of the required
    `341616691+petertrost-bot@users.noreply.github.com`. `main` is not
    rewritten (no force-push). GitHub rejects the noreply address as a merge
    `--author-email` ("Invalid email address"), so `scripts/merge-pr.sh`
    squashes the PR locally into one commit authored with the noreply address
    and titled "<PR title> (#n)", pushes it to the PR branch, and once
    `ci-ok` passes on it, rebase-merges it. A rebase merge keeps the commit
    author, and one commit keeps `main` as linear as a squash merge.
    One slip while building this: commit `008e2b0` (adds only
    `scripts/merge-pr.sh`) was pushed straight to `main` after a failed
    branch checkout left the shell on `main`. It was a fast-forward, not a
    force-push; it stays, and CI ran on it like any `main` push.
25. **Input length caps in the app.** The add field and the edit sheet cap the
    name at 120 characters and the quantity at 40, matching the table checks,
    so a long paste no longer ends in a server rejection.
26. **No pstack config in the repo.** `/setup-pstack` writes only the
    per-user rule `~/.cursor/rules/pstack-models.mdc` (see #19); the repo
    carries none by design.
27. **Node 20 stays on this box.** Bootstrap does not replace the system
    Node, because other workloads share the box. CI runs Node 22. The
    supabase-js deprecation warning in local Playwright runs is expected.

## Job 1b (Sign in with Google and Apple), 2026-10-22

1. **Flows.** Google is native on iOS and Android, and Apple is native on
   iOS; both use `signInWithIdToken`. Apple on Android and both providers on
   web use the OAuth redirect with PKCE. These are the flows Supabase
   documents. google_sign_in on web cannot hand an ID token to our own
   button. Details in `docs/AUTH.md`.
2. **Nonce check on, one Google nonce per app run.** google_sign_in's
   `initialize` (the only place its nonce goes) may run once per process,
   so Google gets one random nonce per app run and Apple gets a fresh one
   per attempt. `skip_nonce_check` stays false. If real iPhones ever return a
   cached token with an old nonce, the fallback is `skip_nonce_check = true`
   for Google only.
3. **No google_sign_in app package.** The app depends on
   `google_sign_in_platform_interface` plus the Android and iOS
   implementations. The app-facing package would add `google_sign_in_web`,
   which loads Google's script on every page view of the web app (seen in
   the Playwright network log) although web signs in by redirect. Without
   it, no request goes to Google before the user taps the button. The cost
   is the platform interface's slightly lower-level API in
   `plugin_sign_in.dart`.
4. **Configuration is public client IDs in `app/config/auth.json`,** read
   with `--dart-define-from-file`. An empty value hides the button. Secrets
   live only in Supabase. The iOS reversed client ID also has to be in
   `ios/Flutter/Auth.xcconfig` because `Info.plist` is static; a unit test
   keeps the two files in step.
5. **Apple's name.** The app stores it with `updateUser` on the first native
   sign-in. A trigger copies `full_name` into `profiles.display_name` while
   the profile still has the derived name. A failed `updateUser` does not
   fail the sign-in, because the user is already signed in at that point.
6. **Hosted config by script, never invented.** `scripts/configure-social-auth.mjs`
   enables a provider only when its credentials are in the environment.
   Run on 2026-10-22 without provider credentials, it added only the app's
   deep link to the redirect allow list.
7. **Mobile deep link `com.petertrost.familygroceries://login-callback`**
   for Apple on Android and for magic links on the phones. Before this job,
   mobile magic links went to the site URL, which is the web app.
8. **Local test provider.** `[auth.external.keycloak]` in `config.toml`
   points at `e2e/fake-oidc.mjs` on `host.docker.internal:54399`. GoTrue
   runs the same ID-token, nonce and linking code for it as for Google and
   Apple, whose issuers are hard-coded. Its signing key comes from a fixed
   seed, so parallel worktrees can share one running copy. The deploy
   workflow does not push `config.toml`; never enable this provider on the
   hosted project.
9. **Button label "Mit Google anmelden"** as the brief asks. Google's German
   guideline page prefers „Über Google anmelden“ but allows localized
   labels. The Google "G" was cut from Google's 2026 asset kit with Chromium
   (transparent PNG at 1x, 2x and 3x).
10. **Cancel is reported.** A canceled provider dialog or `access_denied` on
    the return URL shows "Anmeldung abgebrochen", as the brief asks.
    Supabase's examples treat it as silent.

## Job 3 (MCP server, OAuth 2.1, personal access tokens), 2026-10-22

Numbered 3.x so parallel jobs don't collide. Details and sources: `docs/MCP.md`.

3.1. **Tools run as the user, not the service role.** `_shared/db.ts` opens one
     Postgres transaction per tool call on `SUPABASE_DB_URL` with role
     `authenticated` and `request.jwt.claims.sub` set to the caller. RLS,
     triggers and `classify_item` (members-only since #4) behave as for the
     app, and a missing household filter cannot leak another household's data.
     The alternative, the service role with explicit `household_id` filters,
     would have made every query a possible leak and given `auth.uid()` no
     value in triggers.
3.2. **Audience check = issuer + signature + `client_id`.** Supabase ignores
     RFC 8707 `resource` for `aud` (always `authenticated`; verified on a real
     token). The MCP endpoint accepts a JWT only with the project's issuer,
     a JWKS signature (ES256/RS256), `role = authenticated` and a `client_id`
     claim, so a token issued to the app is not accepted. `authenticate()`
     still reports app session tokens as `via: 'session'`, because job 4's
     voice endpoint is called by the app itself.
3.3. **Both MCP protocol eras.** The latest spec (2026-07-28) is breaking:
     no `initialize`, no sessions. `@modelcontextprotocol/server` 2.3.1's
     `createMcpHandler` serves it and 2025-era clients from one tool
     definition, stateless, `GET`/`DELETE` → 405. A fresh server per request
     keeps the authenticated caller in a closure, not in shared state.
3.4. **Protected Resource Metadata under the function path.** An edge function
     cannot serve `https://<ref>.supabase.co/.well-known/…`, so the metadata
     lives at `<endpoint>/.well-known/oauth-protected-resource` (and at
     `<endpoint>/oauth-protected-resource`, Supabase's own helper path). The
     `WWW-Authenticate` header points at it, which the spec lists first.
3.5. **Advertised scopes `openid email`.** Supabase rejects custom scopes, and
     the tools need none; household access comes from membership.
3.6. **Origin check with an allowlist.** Browser requests must come from the
     project host, localhost, or `MCP_ALLOWED_ORIGIN_HOSTS`; requests without
     an `Origin` (all native and server-side clients) pass. CORS stays open,
     because no cookies are involved.
3.7. **Personal access tokens.** Format `fgp_` + 32 random bytes, base64url.
     The table stores a SHA-256 hash (no salt or slow hash needed: the token
     has 256 bits of entropy) and the last four characters. A token acts as
     its creator in the household it was created in, and stops working when
     the creator leaves it. At most 20 active tokens per user. Revocation is
     one-way (trigger). Revoked tokens are hidden in the app.
     The cross-household cases for this table live in
     `supabase/tests/personal_access_tokens.test.sql`, not `rls.test.sql`,
     to stay out of other jobs' merge conflicts.
3.8. **Consent survives sign-in.** `authRedirect` carries the consent URL as
     `next` through `/login` and `/welcome`. Only a same-origin
     `/oauth/consent` URL is accepted, so `next` cannot become an open
     redirect.
3.9. **Settings screen "Zugänge"** (menu entry) holds the MCP URL, the tokens
     (create, shown once, revoke) and the OAuth grants (`listGrants`,
     `revokeGrant`), so a connected assistant can be disconnected without
     the dashboard.
3.10. **`add_items` through the items insert path for now.** MCP inserts rows
      without a category, so the items trigger calls `classify_item`. Job 2's
      `public.add_items` RPC replaces this inside `mcp/list.ts` `addItems()`
      once it is on main.
3.11. **Local edge runtime policy `oneshot`.** With `per_worker`,
      `supabase start` reuses one worker until its 1 s CPU soft limit, then
      ends it, and requests in flight fail with 503 after about 13 s (seen as
      "CPU time soft limit reached" in the edge runtime log; it failed one in
      four full e2e runs). `oneshot` starts a worker per request, which
      matches the hosted per-request CPU limit. Three full runs were clean
      afterwards.
3.12. **Local DB host alias.** Under `supabase start`, `SUPABASE_DB_URL` names
      the host `supabase_db_<project>`, which Deno's resolvers reject
      (underscore). `_shared/db.ts` maps it to the container alias `db`.
      Hosted URLs are unaffected.
3.13. **Remote OAuth server enabled through the Management API**
      (`SUPABASE_ACCESS_TOKEN` was available): OAuth server on, dynamic
      registration on, authorization path `/oauth/consent`. The project
      already signed with ES256. Deploying the function and migrations is
      still Peter's step (no DB password on the box), see `NEEDS_PETER.md`.

## Job 2 (classifier and stores), 2026-10-22

28. **One item key for the classifier and both memories.** `public.item_key(name)`
    lowercases the name and folds umlauts and accents (`ä` and `ae` both become
    `a`). It turns `ß` into `ss`, drops quantities with units and percentages,
    and turns punctuation into spaces. Then it stems each word by stripping one
    plural ending (`-n` after e/l/r, then `-e`, then `-s`). So "2 kg Äpfel" and
    "Aepfel" share the key `apfel`, and so do Gurke and Gurken. Plurals in
    `-er` (Eier, Kräuter) are not reduced, so the dictionary lists both forms.
    The key is a matching key, never shown.
29. **Pipeline order: memory, dictionary, fallback.** `classify_item` checks
    the household's learned memory by exact key first. Then it checks the
    dictionary, and the first rule that matches wins:
    1. A multi-word phrase found in the name.
    2. The whole name is a term.
    3. A frozen marker. "TK", or a word starting with Tiefkühl, tiefgekühlt
       or gefroren, sends the item to Tiefkühl, so TK-Spinat is not produce.
    4. Per word, the longest term the word ends with (compound heads:
       Vollmilch → milch).
    5. The longest term of four or more letters the word starts with.

    When matches tie, the later word wins, because the head of a German
    noun phrase comes last. Terms under three letters (ei, öl) only match
    whole words. Anything else goes to "Sonstiges". Pet food is Haushalt.
30. **Learning lives in a trigger, not in the callers.** An `UPDATE` that
    changes `items.category_id` is a correction. It goes into
    `category_memory` keyed by item key and category, with a count, and the
    latest correction wins. The edit sheet's category picker and drag between
    groups both write that column, and so will MCP's move tool. Edits that
    keep the category teach nothing. Moves caused by deleting a category teach
    nothing either (a transaction-local `family_groceries.learning = off`).
31. **Dictionary as a TSV plus a generated migration.** The reviewable file is
    `supabase/classifier/dictionary.tsv`. `generate.ts` writes it into a
    migration, and a Deno test in CI fails if the newest
    `*_classifier_dictionary*.sql` migration differs from the TSV. To change
    the dictionary: edit the TSV, create a new migration, and run the
    generator on it. A migration already on `main` is never edited.
32. **Tea and coffee are Vorrat; plant milks are Kühlregal.** This follows
    where Lidl and Edeka shelve them: coffee and tea sit with the dry goods,
    oat and soy drinks sit next to milk. Ready-to-drink tea (Eistee) is
    Getränke. Baby food jars and porridge are 👶 Drogerie, like the baby aisle.
33. **Klopapier stays in Haushalt** (#7 revisited). Toilet paper sits with the
    paper goods in Lidl and Edeka, and dm shows Haushalt in its view, so
    untagged toilet paper still appears when shopping at dm.
34. **Store layouts.** The defaults come from store reports and are documented
    with sources in `docs/STORE_LAYOUTS.md`. Every store has a row for every
    category, with a `hidden` flag for categories the store does not carry.
    dm hides produce, bakery, chilled, meat and frozen. A new category goes
    after the last shown category in each store, or just before Sonstiges
    when Sonstiges is the last shown one.
35. **Store views.** A store view shows the items tagged to that store plus
    the untagged ones, in the store's order. An untagged item in a category
    the store hides is left out. A footer counts these items and can show
    them. An item tagged to the store always shows. Items tagged to another
    store never show.
36. **Item→store memory.** It is learned from two things. Ticking an item off
    inside a store view tags the item with that store. Choosing a store in
    the edit sheet tags it by hand. Both write `items.store_id`, and the
    trigger records it, latest wins. A new item with no store gets the
    remembered store. Setting "Alle Geschäfte" in the edit sheet clears the
    memory, which means the item can be bought anywhere again. An item typed
    inside a store view is tagged with that store, so it stays visible where
    it was typed. Typing it in "Alle" leaves the memory in charge. A consequence: an
    untagged item ticked off at Lidl is a Lidl item from then on. It no longer
    shows in the Edeka or dm view until someone retags it in the edit sheet
    (or sets "Alle Geschäfte").
37. **The store picker resets to "Alle" on launch.** Planning at home happens
    in "Alle", and the picker is one tap away in the store. It sits under the
    add field and never takes focus, so autofocus on open is unchanged.
38. **Deleting a category moves its items** (active and bought) to a category
    the user picks, by default Sonstiges, which cannot be deleted. The
    category's learned corrections go with it. Its seed identity passes to the
    target (`categories.absorbed_seed_keys`), so dictionary hits for a deleted
    "Tiefkühl" land where its items went instead of in Sonstiges.
39. **`add_items` is the shared add path for MCP and Siri** (announced on the
    job board). Each entry may carry a quantity, which `public.parse_entry`
    parses with the same rules as the app's `parseEntry`. An entry whose item
    key is already active returns the existing row instead of a duplicate.
    `p_store` tags the new items. Without it, the remembered store applies.

## Job 4 (voice and release), 2026-10-22

<!-- job4-voice -->
- **Voice splitting lives in the `voice` edge function** (`parse.ts`), not
  in SQL: a token-based splitter with table-driven Deno tests (about 200
  sentences, plus a 759-sentence adversarial pass). Siri and the in-app
  mic share it; the app calls it with `mode: "parse"` and adds the entries
  through its own optimistic ops, so dictated items behave like typed ones
  (instant, offline-queued, duplicates refused).
- **Siri gets plain text.** `?format=text` answers with the sentence only,
  so the Shortcut is exactly Diktieren → Inhalte von URL abrufen → Text
  sprechen with no dictionary step. Errors also come back as German
  sentences with a matching HTTP status, so Siri speaks them too.
- **The voice function checks its own bearer token** (`verify_jwt = false`):
  PATs are not JWTs. It accepts PATs and app session JWTs through the shared
  `authenticate()` and writes as the user (role `authenticated`), so RLS,
  triggers and the classifier run exactly as for the app.
- **Items already on the list are not added twice** and Siri names them
  ("Schon auf der Liste: Milch."). An amount said after a comma joins the
  item before it ("Äpfel, ein Kilo" → 1 kg Äpfel).
- **"Kein Zucker" becomes "Zucker".** Leading "kein/keine" is dropped,
  because "Wir haben keine Milch mehr" is how people say it; a negative
  entry on a shopping list is not a real use.
- **No mic on web.** The browser's Web Speech API sends audio to Google's
  servers and is not on-device; typing is the web fallback. iOS and
  Android use the platform recognizer through `speech_to_text` in de-DE
  (free, no API key). On-device recognition is not forced, so devices
  without a German offline model still work.
- **The Android release build declares INTERNET.** Flutter's template grants
  it only to debug and profile builds; a release APK could not reach
  Supabase without it.
- **Shortcut name "Einkaufsliste"**, as the brief asks. If Siri routes that
  to Reminders' grocery list, `docs/SIRI_SHORTCUT.md` suggests
  "Einkauf notieren".
- **The list is cached on the device** (closes #3, supersedes #11). A
  versioned `ListSnapshot` (catalog with stores and layouts, server rows,
  pending `ItemOp`s) lives in shared preferences per user and household,
  next to each user's last household. A start without network opens that
  household and its list with the offline indicator; the usual resync and
  flush take over once Supabase answers, and replayed ops are harmless
  because they are idempotent (#10). A change to the queue is saved at
  once, server churn 300 ms after it settles. Signing out drops the whole
  cache; a household switch or leaving drops the user's other lists, and a
  list only saves while it is the user's current household, so a closing
  list cannot write a stale copy back. An access token that expired while
  offline no longer signs the user out: the failed refresh is retried by
  supabase_flutter, which keeps the session.

- **Duplicates compare `item_name_key`, the memory keeps `item_key`**
  (review 0). `item_key` drops every number, so "Windeln Größe 5" counted as
  already on the list after "Größe 4". `add_items` and MCP now compare
  `item_name_key` (`item_key` plus the numbers left in the name); the
  classifier and store memory still use `item_key`, so sizes share a
  learned category. Migration `20261023070910_item_name_key.sql`.
- **More than 30 items in one sentence**: the first 30 are added and Siri
  says the rest was not taken ("Mehr als dreißig auf einmal gehen nicht …");
  the JSON answer has `truncated: true`.

<!-- job4-release -->
- **Releases are manual.** The Release workflow runs only from the Actions
  tab, not on every merge like emotely: two users do not need a build per
  merge, and each run costs macOS minutes. Build numbers stay
  `1000 + run number`.
- **Missing release secrets skip, not fail.** Same rule as the Supabase
  deploy workflow: until Peter finishes the store setup, a run is green and
  names the missing secrets in a notice.
- **Team ID and match repo URL come from the environment**
  (`APPLE_TEAM_ID`, `MATCH_GIT_URL`), so the public repo holds no account
  identifiers and the export options are generated by the lane.
- **Release signing falls back to the debug key** when
  `android/key.properties` is absent, so local release builds need no
  secrets. Proven on the box with a throwaway keystore under `/tmp`.
- **The icon is generated** by `scripts/icons.py` (white basket on the theme
  green `#2E7D32`), including an Android adaptive icon with a monochrome
  layer, instead of adding `flutter_launcher_icons` to `pubspec.yaml`.
- **iOS builds are unverified on this box.** Linux cannot run Xcode; the iOS
  lane is checked only by `fastlane lanes` parsing it and by mirroring
  emotely's working lane.

## Job 5 (verification skill), 2026-10-23

5.1. **Primary surface is the Linux desktop debug app, not the Android
     emulator, on the build box.** Creating a KVM vCPU on this VM hits
     `kernel BUG at arch/x86/kvm/x86.c:702` (`vmx_vcpu_create`; three oopses,
     kernel tainted). Retrying risks the shared host, so
     `~/.config/fg/kvm-broken` records it and `fg` refuses the emulator while
     the marker exists. The same Flutter app (same widget tree, the same
     Marionette binding) runs as a Linux desktop window on Xvfb. It is real
     native Flutter, not a browser. Android stays fully implemented in `fg`
     for machines with a working emulator and is listed as unverified.
5.2. **`app/linux/` added** (`flutter create --platforms linux`, application
     id `com.petertrost.familygroceries`, phone-sized 412×892 window). Needed
     for 5.1; it also makes the app runnable as a desktop app.
5.3. **Marionette entrypoint `app/test_driver/main_marionette.dart`;
     `marionette_flutter` is a dev dependency.** Same pattern as
     flutter_driver's `test_driver/app.dart`. Code under `lib/` cannot import
     it (`depend_on_referenced_packages` fails `flutter analyze`). Release
     builds use `lib/main.dart`; a release `libapp.so` has no Marionette
     strings (checked). The entrypoint throws if built in release mode.
5.4. **One CLI (`scripts/fg` → `.cursor/skills/verify-family-groceries/fg`,
     Deno) instead of markdown recipes.** Deno is already in the toolchain
     and CI. Commands are one table (help, flags, `--dry-run`, JSON errors
     generated from it), and every process call goes through an injectable
     shell, so the CLI's own tests run without a stack (16 tests in CI).
5.5. **Supabase runs from a generated workdir** (`~/.cache/fg/<prefix>/stack`:
     config.toml with the port lines and project id rewritten, symlinks to
     migrations, functions and tests). Parallel agents never edit the tracked
     `config.toml` to get their own instance.
5.6. **Seeded users** `peter@fg.test` and `lea@fg.test` (password
     `test-password-123`, local only) in "Familie Test", created through the app's
     own RPCs (`create_household`, `create_invite`, `join_household`).
5.7. **Second client is a second real app** (two Linux instances, about
     650 MB each) with separate session storage via `XDG_*` dirs. `fg peer`
     (REST and Realtime as a user) is the light alternative, and the only
     one when the primary client is the emulator.
5.8. **Debug builds allow cleartext HTTP**
     (`app/android/app/src/debug/AndroidManifest.xml`) so the emulator can
     reach `http://10.0.2.2:<port>`. Release keeps Android's block.
5.9. **`flutter.inspector.structuredErrors=false` in fg builds.** Otherwise
     debug builds send Flutter errors only to the VM service, and `fg logs`
     would show nothing for a red error screen.
5.10. **Minimal ValueKeys** only where Marionette cannot reach a field by
      text: `login-email`, `login-password`, `household-name`, `invite-code`,
      `add-item-field`. Buttons are reached by their text; keyless fields by
      label (`fg type --label`).

## Job 3b (MCP follow-ups), 2026-10-23

3b.1. **Disconnect = session check per request.** Supabase's OAuth server
      cannot revoke an issued access token: its discovery document has no
      revocation or introspection endpoint. `revokeGrant` does delete the
      client's `auth.sessions` rows. `authenticate()` now accepts a JWT only
      while `auth.sessions` has its `session_id` for that user and
      `oauth_client_id`, and answers `401 invalid_token` otherwise. That is
      one primary-key lookup per request, run in parallel with the
      household lookup. Asking `/auth/v1/user` would also notice the missing
      session, but costs an HTTP round trip through Auth. Shorter token
      lifetimes would only shrink the window. App session tokens get the
      same check, so signing out also ends the voice endpoint's access.
3b.2. **MCP `add_items` calls `public.add_items` once per item.** That keeps
      the per-item `store` and the order of results. An explicit `quantity`
      overwrites the parsed one (an update that teaches nothing). An
      explicit `category` is applied as an update after the add, so the
      items trigger learns it. The tool tells assistants to send it only
      when the user names a category, so it is the user's correction.
      Supersedes 3.10.
3b.3. **Each checkout's e2e run uses its own port block.** `e2e/stack.ts`
      reads the URL, key and Mailpit URL from the environment or from
      `supabase status` and throws when one is missing, with no 543xx
      default. The web server port defaults to `<API port prefix>80`
      (54321 → 54380, 54621 → 54680). Before, all checkouts used 3100 with
      `reuseExistingServer`, so one job could test another job's build.
      `config.toml` allows loopback redirects on any port for this. The
      fake identity provider runs on the port of the Keycloak URL in the
      checkout's `config.toml` (`<prefix>99`). Before, every job used 54399
      with `reuseExistingServer`, and a run failed when the job owning the
      server finished (seen here: `ECONNREFUSED 127.0.0.1:54399` in 6
      id-token tests).
3b.4. **Playwright runs one worker locally** (CI keeps 2). With 3 workers,
      mem-guard paused this job for 45 s during a run (low RAM), and the
      paused MCP request timed out the test.

## Job 7 (Vercel hosting, auth config, API-only deploy), 2026-10-23

7.1. **Vercel hosts the web app** (Peter's decision, 2026-10-23 10:58,
     instead of GitHub Pages). A Git-linked Vercel project builds every push
     from `vercel.json`; production is `main`. The app is served at the
     domain root, so `WEB_BASE_PATH` and the Pages workflow are gone.
7.2. **The Flutter SDK lives in `node_modules/.flutter`.** Vercel's build
     cache keeps only `node_modules/**`. The SDK is a shallow clone of the
     version in `ci.yml` (one source for CI and Vercel); the pub cache sits
     next to it. Measured in Amazon Linux 2023 (`scripts/vercel-local.sh`):
     cold install 50 s, cached install 20 s, build 35 s. SDK plus pub cache
     are 1.55 GB uncompressed against Vercel's 1.5 GB cache limit; whether
     the compressed cache fits is unknown until the first Vercel builds. If
     it does not, every build pays the 50 s cold install.
7.3. **SPA rewrite for extensionless paths only.** `/oauth/consent`,
     `/join/CODE` and `/settings` serve `index.html`; a missing `.js` or
     `.png` stays a 404 instead of HTML that the browser would try to run.
7.4. **Cache headers.** Flutter's output is not content-hashed
     (`main.dart.js` keeps its name), so every file revalidates
     (`max-age=0, must-revalidate`, Vercel serves ETags), and the app routes,
     `index.html`, `flutter_bootstrap.js`, `flutter_service_worker.js`,
     `version.json` and `manifest.json` are `no-cache`.
7.5. **The Vercel build refuses a wrong key.** `SUPABASE_URL` must be
     `https://<ref>.supabase.co` and `SUPABASE_PUBLISHABLE_KEY` must start
     with `sb_publishable_`; a missing or secret-looking value fails the
     build instead of shipping the compiled-in defaults.
7.6. **Edge function import maps via `config.toml`.** `supabase functions
     deploy --use-api` bundles only the uploaded files and never saw
     `supabase/functions/deno.json`, so bare imports (`jose`,
     `@modelcontextprotocol/server`) failed. Each `[functions.<name>]` now
     sets `import_map = "./functions/deno.json"`: one map shared with
     `deno test`/`lint`, no per-function copies to drift.
     `supabase/deploy/config_test.ts` fails for a function directory without
     it (checked: it fails on the old config).
7.7. **Migrations deploy through the Management API**
     (`supabase/deploy/migrate.ts`). This box and an API-only workflow have
     no Postgres connection. Each pending migration runs with its
     `supabase_migrations.schema_migrations` row (repo version and name) in
     one transaction, so `supabase migration list` and `db push` see the same
     history. Checked against the local database: a migration that fails
     leaves neither its objects nor its row, and the CLI lists an applied one.
     It stops on drift: a remote version missing locally, or a pending
     migration older than the newest remote one (rename it, as
     COORDINATION.md says).
7.8. **The Supabase deploy workflow fails without credentials.** It needs
     only `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` (no database
     password, no Docker) and ends with a smoke test of `health` and the MCP
     metadata. Before, missing secrets skipped every step and the run showed
     green in 6 s.
7.9. **Production redirect list has no localhost entries.** Earlier notes
     suggested `http://localhost:3000/**`; local development uses the local
     stack, and a localhost redirect on production would hand tokens to
     whatever runs on that port. `supabase/deploy/auth_urls.ts` sets the
     Site URL, the redirect list and the consent path and keeps entries added
     by hand.
## Job 2b (follow-ups to jobs 2 and 5), 2026-10-23

2b.1. **Bags and brand names have dictionary entries.** `-tüte` and
      `-beutel` are Haushalt (Mülltüten, Gefriertüten, Zipbeutel); Teebeutel,
      Windelbeutel and Filtertüten stay where explicit entries put them.
      Common cleaning and drugstore brands (Somat, Frosch, Lenor, Elmex,
      Blend-a-med, Penaten) stand for their product. `kleber` is listed so
      Sekundenkleber stops matching `leber` (Fleisch). Briefmarken stays
      Sonstiges: stamps have no supermarket aisle, as the dictionary test
      already said. Kaffeefilter and Filtertüten sit with the coffee
      (Vorrat), Hustenbonbons with sweets. Found with a sweep of 345 common
      non-food items through `classify_item`; 45 of the fixes are rows in
      `supabase/tests/classifier_dictionary.test.sql`.
2b.2. **The classifier folder has its own `deno.json`.** CI and
      `scripts/verify.sh` run `deno fmt --check && deno lint && deno test`
      inside `supabase/classifier`, the same command a developer runs there.
2b.3. **Screenshots wait for two identical frames.** Flutter animates on
      its canvas, which Playwright's `animations: 'disabled'` cannot reach.
      The grey Edeka chip in job 2's `06-store-dm.png` was the chip's
      deselect animation, not hover: the dm chip was mid fade-in in the same
      frame. `screenshot()` (e2e helpers) now polls until two frames 100 ms
      apart agree (2 s cap).
2b.4. **Each resync keeps its own ack map.** The list opens with two
      resyncs at once (start, and the channel's first `subscribed`). They
      shared one nullable map; the first to finish nulled it and the other
      threw, so the list showed Offline until the next write (3/3 menu joins
      on the web build, 2/3 creates on the Linux app). A resync that answers
      now also brings the list back online, but only while the realtime
      channel is subscribed, so a dead channel still shows Offline.
2b.5. **No postgrest GET retries.** postgrest 2.9.1 retries each GET three
      times (1 + 2 + 4 s), invisibly. The session and list cubits already
      retry every 3 s and writes are idempotent ops retried until acked, so
      the library retries only delayed an offline cold start (7.7 s to the
      cached list, 15 s to the Offline indicator; now 0.7 s). The option
      only reaches `client.rest` (`client.from` builds its query builder
      without it), so the app reads and writes through `client.rest`.
2b.6. **e2e tests close the contexts they open.** Specs open one context
      per user with `browser.newContext()` and the browser lives for the
      worker, so every earlier test's app kept running: 48 renderers and
      9.4 GB RSS by the end of a one-worker run. That load was the "OAuth e2e
      flake" (a consent test waited 34 s for its first page) and much of the
      box's memory pressure. `e2e/tests/fixtures.ts` extends `test` with an
      auto fixture that closes them; `conventions.spec.ts` fails if a spec
      imports `test` from `@playwright/test` directly. mcp.spec's
      `retries: 1` (job 4) is gone.
2b.7. **A catalog reload awaits before it reads the state.**
      `emit(state.copyWith(catalog: await fetch()))` evaluated `state` before
      the await and wrote the old pending ops and server rows back. An add
      acked during the fetch came back as pending forever (1 in 20 runs of
      offline-start), and an op queued during it could vanish unsent.
2b.8. **The web bootstrap reloads once a boot asset load fails.** Chromium
      aborts in-flight requests with `ERR_NETWORK_CHANGED` when the host's
      interfaces change; Chromium declines to make that configurable. One
      aborted `canvaskit.js` or `main.dart.js` left a blank page with no
      error. `app/web/flutter_bootstrap.js` reloads, at most twice per tab
      session (sessionStorage), and catches a failed `main.dart.js` with a
      capture-phase listener because the loader's callback mode ignores the
      script tag's error. On this box Docker bridges from other jobs' stacks
      trigger it; for users a Wi-Fi or VPN switch during load does.
2b.9. **The list resyncs when Realtime says it is live.** Realtime confirms
      the channel join before its Postgres listener runs and announces it
      later with a `system` event ("Subscribed to PostgreSQL", 2.5 s after
      the join on this stack). A change in between was never delivered, so
      an item added by voice or MCP right after the list opened stayed
      missing (seen in a full e2e run, and around the local stack's periodic
      "tenant terminated: rebalancing"). `watch()` now reports that event as
      online, which resyncs. `realtime_client` already turns a `system`
      error into `channelError`, which shows Offline.
2b.10. **The list resubscribes a channel the server closed.**
      `realtime_client` rejoins a channel after an error or timeout, but not
      after the server closes it (`phx_close`, sent when the local Realtime
      terminates its tenant for "rebalancing"). The list then showed Offline
      and missed changes until restart (review 0 reproduced it once under
      load; an e2e test that injects `phx_close` failed every time). The
      cubit now subscribes again while the channel is down (3 s, doubling to
      30 s, reset once live) and ignores callbacks from a replaced channel.
      A dropped socket already recovered through the library's reconnect;
      an e2e test keeps that covered too.
2b.11. **No generic `karte`.** It made "Schokokarte" Haushalt. Cards are
      listed explicitly (Geburtstagskarte, Glückwunschkarte, Geschenkkarte,
      Guthabenkarte), "Chipstüte" is sweets ahead of `tüte`, and "Spüli" is
      Haushalt. pgTAP rows guard food compounds next to the short terms
      (Kartoffelsalat, Fanta, Chipstüte, Schokokarte).
2b.12. **The 345-item sweep is a checked-in regression list.**
      `supabase/classifier/sweep.tsv` holds every swept item with its
      category; `sweep.sh` classifies them on the local stack and prints the
      rows that moved. CI's database job and `scripts/verify.sh` run it, so
      a dictionary change that moves one of them fails until the list is
      refreshed (`sweep.sh --print`) on purpose. Rerunning it showed
      Babytücher and "Feuchte Tücher" in Haushalt (via `tücher`) while
      Feuchttücher is Drogerie; both are now Drogerie.
      Guthabenkarte), "Chipstüte"
      is sweets ahead of `tüte`, and "Spüli" is Haushalt. pgTAP rows guard
      food compounds next to the short terms (Kartoffelsalat, Fanta,
      Chipstüte, Schokokarte).

## Job 8 (who added, new since you looked, usuals), 2026-10-23

8.1. **Usuals come from `item_events`, grouped by `item_name_key`.** Only
     `added` and `bought` count; `edited` (classifier moves), `restored` and
     `deleted` are not uses. A tick undone within 10 minutes (the snackbar's
     Rückgängig) is no purchase, and an item added and deleted without being
     bought (a typo) is no history. The last quantity comes from the newest
     `items` row of that key: bought rows are never purged, so no quantity
     column on `item_events` is needed.
8.2. **"Due" needs two purchases, not three.** Purchases are distinct
     Europe/Berlin days with a counted tick. With n >= 2 the usual gap is
     (last day - first day) / (n - 1), at least one day, and an item is due
     from 1x to 4x that gap after its last purchase. Peter and Lea buy most
     staples weekly, so two purchases a week apart already make a usual;
     with three, the row would stay empty for most of the first month. The
     4x cap drops what they stopped buying (seasonal fruit, a one-off
     recipe). Proven with a fixed clock in `supabase/tests/suggest_items.test.sql`.
8.3. **One year of history.** `suggest_items` reads the last 365 days. A
     usual nobody touched for a year is not a usual, and the cost stays flat:
     measured 0.34 s for 6000 events and 3000 rows (about two years of a
     household). The first version took 26.6 s because it keyed every items
     row inside correlated subqueries; names are now keyed once in
     materialized CTEs.
8.4. **The app fetches all usuals once and filters while typing on the
     device.** `fetchUsuals` asks for up to 200 with an empty prefix; the
     cubit matches the typed text the way the server matches `p_prefix`
     (folded name starts with it first, then a word starts with it). Chips
     therefore show at the first keystroke, offline too, with no request
     per keystroke, so there is no typing debounce. The cache refreshes with
     every resync and, debounced by 1.5 s, after the set of active names
     changes (a ticked item comes back as a suggestion). `p_prefix` stays on
     the RPC for MCP and other callers.
8.5. **Usuals live in the list snapshot, which becomes version 2.** The
     snapshot gains a per-version migrator chain (`ListSnapshot._upgrades`):
     a v1 snapshot from an older app loads with its pending ops, and new
     nullable fields such as `added_by` are read tolerantly without a
     version bump. A snapshot newer than the app (a downgrade, which TestFlight
     and the stores don't do) is still dropped.
8.6. **"Neu" is a server-time watermark plus a set of ids, per device.** The
     seen mark (`SeenMark`, DeviceCache key `seen.<user>.<household>`, outside
     the snapshot) holds `until`, the newest server `created_at` the user has
     seen past, and the ids seen after it. Comparing server times with server
     times keeps a wrong phone clock out of it. A first start sets `until`
     to the newest row already there, so nothing old lights up. A partner
     item turns plain after it has been at least half on screen for 3 s
     while the app shows (VisibilityDetector per tile; web counts an
     unfocused window as showing). Once every new item is seen, `until`
     moves past them. A seen item that is ticked and put back stays seen.
8.7. **Partner initial: first letter, two when another member shares it.**
     No badge on own items, on items whose author left the household, or
     before the server confirms an add. An add by someone not in the
     catalog's members reloads the catalog, so a new member's initial shows.
8.8. **Web: a tap next to the add field gives its focus back after the
     engine's deferred blur.** Tapping a semantics node (a chip, the send
     icon) blurs the field's DOM input while Flutter keeps the field
     focused, and the engine's `safeBlur` of the closed text connection runs
     on a zero-delay timer that beats a refocus in the next frames (traced
     with a JS stack hook). The tap unfocuses and refocuses 50 ms later.
     Mobile is untouched (the keyboard would flicker). The Enter path is
     unchanged; it never blurs.

## Job 4b (voice follow-ups), 2026-10-23

4b.1. **DeviceCache writes its own file on Linux** (`device_cache.json`, via
      `SharedPreferencesLinuxOptions`). supabase_flutter keeps the session
      through the legacy `SharedPreferences`, the cache uses
      `SharedPreferencesAsync`, and on Linux both plugins hold their own
      in-memory copy of `shared_preferences.json` and rewrite the whole file
      on each write, so a cache write dropped the session (relaunch came back
      signed out). Android, iOS and web ignore Linux options, so their stores
      and keys are unchanged. Not migrated: Linux is a debug target, and the
      household/list keys left in the old file are a cache that refills on
      the next online start.
4b.2. **Dictation is on-device only** (spec), superseding the job 4 note
      "on-device recognition is not forced". `speech_to_text` 7.5 with
      `onDevice: true` is strict on iOS (`requiresOnDeviceRecognition`) but on
      Android silently uses the network recognizer when on-device
      recognition is unavailable, and on iOS it answers a device without
      on-device German twice. So the app asks first, over its own channel
      `familygroceries/speech` (`MainActivity.kt`, `AppDelegate.swift`): iOS
      `SFSpeechRecognizer(de_DE).supportsOnDeviceRecognition`; Android API 31+
      `isOnDeviceRecognitionAvailable` and, on 33+, German among the installed
      on-device languages. Without it the mic explains in German that the
      offline German recognizer is missing and listens to nothing. An Android
      12 device without German reports `error_language_*` once listening
      starts; that gets the same message. Not 7.6.0-beta.4's
      `hasOnDeviceSupport`: a beta, and its Android answer ignores the
      language.
4b.3. **The mic shows on iOS and Android only.** Linux and web have no
      on-device recognizer; the Linux build used to show a button that could
      only fail.
4b.4. **CI compiles the native code** (`android-build`: debug APK on
      Ubuntu; `ios-build`: simulator debug build on macOS, free for public
      repositories). The app now has its own Kotlin and Swift, and nothing
      compiled them before.
4b.5. **Offline start: cache first, and list reads fail fast.** Review 1's
      offline-start failure was the cached list missing 10 s after an offline
      reload. Measured: the list appeared 7.6 s after the reload and
      "Offline:" 7.3 s later. postgrest-dart 2.9 retries every GET three
      times on network errors (1, 2 and 4 s), and `SupabaseClient.from()`
      ignores `postgrestOptions.retryEnabled` (supabase 2.16.5), so the
      session's household lookup and the list fetches each took about 7 s to
      fail. Now SessionCubit opens the device's household before it asks the
      server. The retries themselves are off through 02b's change (reads go
      through `client.rest` with `retryEnabled: false`, 2b's decisions); this
      branch had used `.retry(enabled: false)` per read and dropped it on
      rebase. ListCubit and SessionCubit retry on their own every 3 s.
      After: list 0.5 s, banner 0.6 s after an offline reload.
4b.6. **Review 1's three e2e failures had one trigger.** The run (09:27 to
      09:37) was frozen by mem-guard from 09:30:38 to 09:35:04 (SIGSTOP,
      `mem-guard.log`), and with 3 workers exactly three tests were in
      flight; each failed after 4.6 to 4.8 minutes on wall-clock timeouts.
      Fixes for what made them fragile: 4b.5 for offline-start, 3b.3 (own
      fake OIDC port) for social-sign-in, and one worker locally (3b.4).
4b.7. **merge-pr.sh ends the squashed message with Peter's trailer**
      (COMMON.md: every commit message ends with it) and re-squashes a head
      that doesn't. Before, the Claude trailer came last. The Claude line
      names the model that does the work (Claude Opus 5.5 here); COMMON.md
      requires only Peter's line, so a later job on another model updates
      `TRAILERS` in the script.
4b.8. **The ops DONE_SUMMARY.md is a copy of `docs/done/<job>.md`**
      (COORDINATION.md), byte for byte; the root `DONE_SUMMARY.md` only links
      it. Job 4's repo copy gained the "Merged as PR #10" line its ops copy
      already had.
4b.9. **The 5-run Playwright streak is evidenced on CI for the landing
      commit.** On 2026-10-24 the box froze every 5 to 30 minutes for 2 to
      53 minutes (host VM pauses; mem-guard gaps, Postgres walsender
      timeouts and 'virtual machine fork' at each wake), so five consecutive
      local runs of ~4 minutes didn't fit between freezes. Every local run
      without a freeze passed; CI ran the full suite six times in a row on
      the squashed commit, all green. Local runs log their longest
      mem-guard gap, so a red run can be told apart from a stall.

## Job 7b: loose ends of the Vercel hosting

7b.1. **`APP_URL` lives in `app/config/auth.json`.** The phone apps' invite
      links need the web origin. Dart no longer hardcodes it: `Environment.appUrl`
      reads only the `APP_URL` define and is empty without it (the dialog then
      shows only the code). Every production build already passes
      `--dart-define-from-file=config/auth.json` (both fastlane lanes and
      `scripts/vercel.sh`), so that file is the one source of truth; a custom
      domain is a one-line JSON change. `auth_config_test.dart` fails when a
      production build command drops the file (checked by removing it from a
      Fastfile lane and from `vercel.sh`) or `APP_URL` is not an https origin.
      Rejected: Vercel's `VERCEL_PROJECT_PRODUCTION_URL`, because the phone
      builds don't run on Vercel and the web app links to its own origin.
7b.2. **SPA rewrite by asset type, not by "has a dot".** The old rule
      `/((?!.*\.\w+$).*)` 404ed deep links like `/join/AB.CD`. The rewrite now
      skips only Flutter's asset folders (`assets/`, `canvaskit/`, `icons/`)
      and the file extensions a Flutter web build emits, so a missing asset is
      still a 404. `e2e/web-smoke.mjs` checks both sides. Limit: a path
      whose last segment ends in one of those extensions (`/join/ab.png`,
      `/lists/a.json`) is still a 404. No real link has that shape today:
      invite codes are eight characters from `A-Z` and `2-9` without a dot
      (`create_invite`), and `/join/:code` is the only route that takes a
      path parameter.
7b.3. **Deleted the unused repo secret `SUPABASE_DB_PASSWORD`.** Nothing read
      it since 7.8. The value stays in `~/groceries-ops/env`, so it can be
      set again with `gh secret set`. The remaining repo hits of the name are
      `docs/SPEC.md` (the ops spec, copied verbatim) and past job records in
      `docs/done/`.

## Job 9 (account deletion and data export), 2026-10-24

9.1. **What the stores require.** Researched 2026-10-24.
     - Apple, App Review Guideline 5.1.1(v) and "Offering account deletion
       in your app"
       (https://developer.apple.com/support/offering-account-deletion-in-your-app/).
       The app must let people start deletion inside the app, and the
       option must be easy to find, typically in account settings. It must
       delete the whole account record and the personal data, not just
       deactivate it. A confirmation step is allowed, but deletion must not
       be "unnecessarily difficult" and must not need a support contact.
       Data kept for legal reasons must be named. A manual or delayed
       process is fine if the user is told how long it takes. Apps with Sign
       in with Apple "should use the Sign in with Apple REST API to revoke
       user tokens".
     - Apple TN3194
       (https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple).
       Revoke with `POST /auth/revoke`. When the app holds no token or
       code, it must still delete the account and point the user to the
       Apple ID settings.
     - Google Play, "Understanding Google Play's app account deletion
       requirements"
       (https://support.google.com/googleplay/android-developer/answer/13327111).
       The app needs an in-app deletion path and a web URL where users can
       request deletion without reinstalling the app. The page must name the
       app or developer as on the listing, give the steps, and say what is
       deleted, what is kept and for how long. The URL goes into the Data
       safety form.
     - GDPR Art. 20: an export in a structured, commonly used,
       machine-readable format. Neither store requires an export.
9.2. **An edge function, not an RPC.** Apple revocation needs HTTPS calls
     signed with the Sign in with Apple key, which Postgres cannot make. The
     database half is still one SQL function, `public.delete_account(uuid)`,
     granted to `service_role` only. The function deletes `auth.users` in
     the same transaction as the household cleanup, so deletion either
     completes or leaves nothing half-done. It does not use the Auth admin
     API afterwards. Every auth table cascades from `auth.users` (checked in
     `pg_constraint`), and the hosted `postgres` role has DELETE on it
     (checked read-only through the Management API).
9.3. **Fixed on main: no user who had added an item could be deleted.**
     `items_before_write` restored `added_by` on every UPDATE, including the
     `ON DELETE SET NULL` that deleting the user triggers, so the foreign key
     failed. The same failure hit the Supabase dashboard and the admin API.
     The trigger now passes such a set-null through, but only when the
     referenced user is really gone. It is security definer because it
     reads `auth.users`. The set-null also bumps no `updated_at`, and
     `items_log_event` no longer logs updates that change nothing visible.
     Clients still cannot rewrite `added_by`.
9.4. **The household after a deletion.** If other members remain, the
     household and its list stay. The leaver's items keep their place with
     `added_by`/`bought_by` null. Their history rows stay with `actor` null,
     in every household. Ownership passes to the earliest-joined remaining
     member. If the leaver was the last member, the household goes with all
     its rows. The household row is locked `FOR UPDATE`, so a concurrent
     `join_household` or a second member deleting at the same moment
     serializes behind it, and no orphaned household can be left behind.
9.5. **Only the app's own session may delete.** `authenticateSession` in
     `_shared/auth.ts` answers 403 `session_required` to personal access
     tokens and to OAuth client tokens (MCP), so a connected assistant cannot
     delete the account. Unlike `authenticate`, it needs no household. A
     retry whose first call succeeded but lost its response gets 200 again.
     The JWT still verifies, its user is gone, and a signature cannot be
     forged for a user who never existed.
9.6. **Sign in with Apple revocation.** On iOS the app asks Apple for a
     fresh authorization code after the typed confirmation. The function
     exchanges it with the bundle ID as client ID, checks that the code's
     `sub` is the account's Apple identity, and revokes the refresh token
     once the database delete has succeeded (9.12). Web and Android sign in with Apple through
     Supabase's redirect, and Supabase keeps no provider token (supabase/auth
     #1308), so they take TN3194's fallback. The account is deleted and the
     app shows the Apple ID settings path. Re-running an Apple redirect just
     to get a token was rejected: it adds a full-page round trip to every
     Apple deletion on the web for a case Apple documents as acceptable. Any
     Apple failure (no key configured, network, `invalid_grant`, wrong
     `sub`) never blocks deletion and ends in the same fallback. The key
     reaches the hosted function only as a secret Peter sets
     (`docs/NEEDS_PETER.md`, job 9). The box did not push the private key to
     production on its own.
9.7. **Confirmation by typing LÖSCHEN.** It is one deliberate step that
     Apple's "not unnecessarily difficult" allows, and it needs no email
     round trip. `LOESCHEN` also counts, for keyboards without umlauts.
     There is no re-authentication beyond Apple's sheet on iOS. The session
     already proves the user, and a password prompt does not exist for
     Google or Apple users.
9.8. **Online only.** Deletion is not an `ItemOp` and is never queued. When
     offline, the dialog refuses and says nothing was deleted. Queuing an
     irreversible action for later would surprise the user.
9.9. **Export as an RPC.** `public.export_my_data()` returns the caller's
     own data only, never other members' names, and never token hashes.
     OAuth client tokens get `session_required`, because PostgREST accepts
     them too. The app saves it as `einkauf-daten-YYYY-MM-DD.json`: a
     download on the web, the share sheet on the phones, the Downloads folder
     on the desktop debug build that the verify skill drives.
9.10. **Where the entry lives.** It sits in a "Konto" section of the
      settings screen, opened from its own "Konto" menu entry on the list,
      so it is one tap from the menu as Apple asks. It is also a button on
      the welcome screen, so a user who never joined a household can delete
      their account.
9.11. **The public deletion page is a static file.** It lives at
      `app/web/konto-loeschen.html`, not in a Flutter route. It loads
      without JavaScript, crawlers and Play reviewers can read it, and it
      bypasses `authRedirect`. Vercel's SPA rewrite skips paths with a file
      extension. It carries `noindex` and the ENTWURF banner until Peter
      approves it.
9.12. **Review 0: a dropped call is retried once; Apple comes after the
      delete.** CI run 40121325467 failed the shared deletion with an
      empty 503 from the local edge runtime ("connection aborted", a cold
      `oneshot` worker under two parallel first calls). Job 12 could not
      reproduce it with 44 concurrent calls. The hosted gateway also answers
      502, 503, 504 or 546 when a worker fails to boot. These are transient
      states at the network boundary, and the endpoint is idempotent, so
      `SupabaseAccountRepository.delete` retries once after one second when
      the error lacks the handler's JSON `error`. Errors the handler
      answered are not retried. The function now reads the Apple subject
      first, deletes, and only then calls Apple. A failed delete therefore
      never spends the single-use code, and a retry can still revoke. A
      retry that finds the account gone answers `apple: "manual"`: the
      first call may have died between the delete and Apple, and the hint
      is the safe answer.

## Job 12 (structural lints and schema guards), 2026-10-24

12.1. **ast-grep, not an analyzer plugin.** Every rule is syntactic and runs
      in `scripts/lint.sh`. An analyzer plugin would add an isolate to every
      agent's analysis server on a 16 GB box shared by several jobs. The cost
      is that `no-hardcoded-ui-text` cannot see types (12.3).
12.2. **Only `DeviceCache` opens a shared-preferences store, not `main.dart`.**
      The Linux sign-out came from `DeviceCache(SharedPreferencesAsync())` in
      `main.dart` (c4ed2e4^), so allowing `main.dart` would have let the bug
      through. A second rule, `device-cache-own-file`, requires the store
      inside `DeviceCache` to carry `SharedPreferencesLinuxOptions` with a
      file other than `shared_preferences`. Tests are not checked: they set
      up fakes.
12.3. **What counts as hard-coded UI text.** A string literal in `app/lib`
      (not `l10n/`) whose own text has a letter and is not a path. It counts
      when it is the text of `Text` or `SelectableText`, or the value of a
      named argument that Flutter uses for text. The rule looks through a
      ternary's branches, `??`, `+`, parentheses and switch-expression arms
      to that position, so `Text(done ? 'Erledigt' : 'Offen')` and
      `Text(n + ' Stück')` fail (review 0). It also follows `!`, list and
      set elements, map values, and the receiver of a method call, property
      or index: `Text('Hallo'.toUpperCase())`, `Text(['Eins', 'Zwei'][i])`
      and `Text(<String>['Eins'].join(', '))` fail (review 1). Index and map
      keys, conditions, switch patterns, and arguments of other calls
      (`DateFormat('dd.MM.')`, `json['name']`) are data and pass. Collection
      `if` and `for` elements are walked like list elements, and a name
      declared in the same file is followed to its value when the name
      reaches a text position: a constant, final, local or field, including
      list and map constants (`const _labels = ['Eins']; Text(_labels[0])`),
      a later assignment (`msg = 'Gespeichert'`), a parameter's default
      value, an enum constant's arguments when one of the enum's fields is
      shown (`fruit('Obst')` with `Text(c.label)`), and the result of a
      getter, function or method (`String get _title => 'Titel'`, `String
      _nr(int n) => 'Nr. $n'`, `return 'Ja';`). The literal is reported
      where it is declared (job 12b). Names are matched, not resolved: a
      `title` getter in one class counts when another object's `.title` is
      shown in the same file, and an enum constant's other literal
      arguments (a JSON key next to the label) count too; give those an
      ignore with the reason or move the label to l10n. `toString`
      overrides are skipped, since `Text(n.toString())` shows `n`. Four cases stay out of
      reach for a syntactic rule: a value that goes into another call's
      argument and comes back as its result (a closure in `.map((e) => 'Nr.
      $e')`, a custom widget's positional parameter that it shows with
      `Text`), a declaration whose value is another declaration's name
      (`const _b = _a;`, ast-grep binds one name per match), and a constant
      imported from another file. They would need the analyzer's types and
      data flow (12.1). The named-argument list adds the date, time, about
      and search dialogs' texts (`confirmText`, `cancelText`, `helpText`,
      `fieldLabelText`, `searchFieldLabel`, ...) to emotely's
      `avoid_hardcoded_ui_text` list, so a custom widget's named `title:`
      or `label:` argument is caught. A non-widget class with a parameter
      named `message` or `title` is reported too; pass it a localized value.
      Main had no findings.
12.4. **`dispose-after-dialog` looks at the whole function body.** It reports
      a local `TextEditingController`, `FocusNode`, `ScrollController` or
      `SearchController` that is disposed in a function that also awaits a
      route: `show*Dialog`, `show*BottomSheet`, `showCupertinoModalPopup`,
      the date, date-range and time pickers, `showMenu`, `showSearch`,
      `showAboutDialog`, `showLicensePage`, or a Navigator or go_router
      `push*`. A `finally` block counts too, and so does a dispose in the
      route's `.then` or `.whenComplete` callback without an await (job
      12b). A picker builds its own controllers, but its `builder` can wrap
      the caller's field, so pickers are in. The fix is a route widget whose
      State owns the controller. The rule does not check order inside the
      function, so a dispose written before the await is reported too. It
      does not follow a route that a helper function opens and the caller
      awaits (that needs a call graph), or a route's Future stored in a
      variable and awaited later.
12.5. **squawk rules as an allow-list in `schema_check.ts`.** squawk has no
      "only these rules" switch, so the check keeps the backward-compatibility
      rules from its JSON report (`COMPAT_RULES`) plus parse errors. Those
      rules ban dropping or renaming a column or table, NOT NULL without a
      default, setting NOT NULL, dropping NOT NULL, type changes, and
      dropping a function, view or database. Lock, timeout and style rules
      stay off. squawk reads only migrations that are not on main. Main's
      migrations are frozen anyway.
12.6. **Every public table enables RLS, with or without `household_id`.**
      PostgREST serves any public table to the API, so a table without RLS is
      readable with the publishable key. Main already complies.
12.7. **"Covered in a pgTAP test" means a test that sets up two
      households.** The table must appear as `public.<table>` in a
      `supabase/tests/*.test.sql` file that calls `create_household(` at
      least twice. A mention in a single-household test does not count.
      `personal_access_tokens` meets this in its own test file. A table
      created with `(like public.<table> ...)` inherits that table's
      `household_id` and needs its own RLS, policy and test (review 0).
      Quoting does not matter: `"public"."items"`, `public."items"` and
      `public.items` are the same table (job 12b).
12.8. **The base is `origin/main`.** `lint.sh` fetches it at depth 1 when the
      ref is missing, as it is in a CI pull-request checkout. A new migration
      must sort after main's newest, and main's files must match byte for
      byte.
12.9. **CI's versions are the only versions.** `ci.yml` pins
      `AST_GREP_VERSION` and `SQUAWK_VERSION`. `bootstrap.sh` installs
      exactly those versions, and `lint.sh` refuses to run with others,
      because rule snapshots and squawk findings change between releases.
12.10. **Exceptions say why.** The forms are
       `// ast-grep-ignore: <rule> -- <reason>` and
       `-- squawk-ignore <rule> -- <reason>`, where the reason has at least
       three words (`ignore-needs-reason`, `checkIgnores`). Both tools accept
       the ` -- ` suffix. There were no violations on main, so the PR adds
       no ignores and fixes no code.
12.11. **`fromEnvironment` and `go('/login')` had no history.** No commit
       on any branch ever broke these two conventions, so their rule tests
       use probes instead of historical code.

## Job 12b (lint and schema-guard follow-ups), 2026-10-25

12b.1. **`auth-navigation-only-in-router` reports the route names, not only
       navigation calls.** Nothing in `app/lib` outside `router.dart` has a
       reason to name `/login` or `/welcome`, so any such path literal,
       `loginPath`/`welcomePath`, and `'login'`/`'welcome'` as a `*Named`
       route name fail. A constant (`const _p = '/login'; go(_p)`) and
       `Uri(path: '/welcome')` are then caught without data flow. A path
       built at run time (`'/' + name`) is not.
12b.2. **`schema_check.ts` reads names with one parser.** `qualifiedName`
       splits a name on the dot and unquotes each part, and `statements()`
       keeps the case inside double quotes, so `create table
       "public"."items2"` is `public.items2` and `public."Mixed"` keeps its
       case in the fix hint. Before, `"public"."items2"` was read as the
       table `public` (review 2). The same scanner now honours `E'...'`
       backslash escapes and nested block comments, both of which used to
       swallow the DDL after them, and test SQL is read without its
       comments. `alter policy` (new `using`, rename), `rename column` to
       or from `household_id` and `set schema` are followed.
12b.3. **A table finding names the migration that last changed the table.**
       Renames, `alter table` and policy changes move it. The earlier file
       is often on main and frozen, so the fix goes after the last change:
       a rename probe used to be reported against the foundation migration.
12b.4. **`lint.sh` runs the schema check before its unit tests.** A probe
       migration also fails the unit test over the repository's own
       migrations, whose assertion diff hid the check's message.
12b.5. **Port blocks stay where they are; the kernel reserves them.** Linux
       picks outgoing connections' source ports from 32768-60999, and every
       job's block (543xx-561xx) and CI's 543xx lie inside it. A container
       that binds a port an outgoing connection holds fails with `bind:
       address already in use`; review 2 hit it twice on 55522 during `db
       reset`. On the box, 9 of 3000 loopback connections drew a source port
       in 55500-55599, and 0 of 3000 after `sysctl
       net.ipv4.ip_local_reserved_ports=55500-55599`; an explicit bind on
       55522 still worked. `reserve_port_block` (`scripts/lib.sh`) reserves
       the checkout's `<prefix>00-99` before `supabase start` and `db
       reset`, locally and on CI runners. Moving the blocks below 32768
       would also work but renumbers every job, and the verify skill's own
       stacks (`fg`, `~/.cache/fg/<prefix>`) don't go through `lib.sh`, so
       the box itself should reserve 54300-56199 at boot (BOARD, job 12b).
12b.6. **`typeInto` waits for Flutter's frame, not for more time.** On web,
       a DOM focus on a semantics text field only asks the app to focus it;
       the engine attaches its editor to the `<input>` with the next
       frame's semantics update (`semantics/text_field.dart`, `update()` ->
       `activate`). Text inserted before that frame is in the DOM but not in
       the app, and the frame writes the app's value back. The old helper
       checked the DOM right after inserting, so it passed. Then, under
       load, `auth.spec.ts` sent the old password (full run 1, 10:36, no
       freeze). With frames held back 1.5 s, the old helper left the field
       empty and the new one kept the text (probe in
       `docs/screenshots/12b-lints-followups/typeinto-frame-probe.*`).
       `typeInto` now waits two `requestAnimationFrame`s after focus and
       again before its value check. Review 2's partner-news failure was
       different: a 7-minute VM freeze inside a click (mem-guard gap
       01:42:58-01:50:18), void under the board's ruling.

## Job 11: one CI run per merge, one gate definition, measured CI speedups

11.1. **One script per gate, called by CI and `verify.sh`.** Each `ci.yml` job
      installs tools and runs `scripts/gates/<job>.sh`; `verify.sh` runs the
      same scripts in a fixed order (`--only <gate>` for some).
      `scripts/check-gates.sh` (lint gate) fails when a gate lacks its job,
      its `ci-ok` need, its `verify.sh` entry or its executable bit, or when
      `ci.yml`/`verify.sh` run a check command themselves. That turns the old
      drift into a lint error: `verify.sh` had no production web build, no
      fastlane parse and no `--fatal-infos`. The last one was cosmetic:
      `flutter analyze` defaults to `--fatal-infos` on Flutter 3.47, checked
      with an info-level probe (`omit_local_variable_types: info`). The
      gate states the flag anyway, so a default change can't loosen it.
      `android` and `ios` are CI-only in `verify.sh` (macOS, Gradle RAM).
11.2. **`scripts/push-pr.sh` pushes the commit main takes.** It rebases onto
      `origin/main`, squashes to `<PR title> (#n)` with the noreply author and
      trailers, and pushes with `--force-with-lease`; it refuses `main` and
      uncommitted changes. `merge-pr.sh` then finds a compliant head and only
      checks `ci-ok`, so a merge costs one CI run instead of two. The squash
      body keeps every commit subject, so fix rounds stay readable. Shared
      code (author, trailers, the compliance check, the squash) is in
      `scripts/lib.sh`. `merge-pr.sh` keeps its old behavior for PRs pushed
      the old way and gains `--wait` and `--dry-run`. Not removable: if
      `main` moves after the push, one more rebase, push and CI run is
      needed; merge-pr.sh says so.
11.3. **push-pr.sh carries skip-worktree edits across the rebase.** Every
      worktree keeps its port block in `supabase/config.toml` as a
      skip-worktree edit, and git refuses to rebase over it once `main`
      changes that file (it did: job 9's `[functions.account]`). The rebase
      saves those edits as a patch, restores the files, rebases, reapplies
      the patch and marks the files skip-worktree again.
11.4. **A pre-push hook warns, never blocks.** `.githooks/pre-push` warns
      when a PR branch goes up with more than one commit over `origin/main`.
      The first push before `gh pr create` is legitimately several commits.
      `core.hooksPath=.githooks` is in the shared repository config and
      resolves per worktree; shown by the warning from a worktree in /tmp.
11.5. **Box-wide e2e lock.** The e2e gate holds `flock /tmp/fg-e2e.lock` from
      stack start through Playwright and writes its checkout and pid into
      the file; a second run prints that and waits. Rejected `pgrep
      playwright`: it matches the caller's own command line (it matched an
      agent's shell during this job). Playwright arguments pass through
      (`verify.sh --only e2e -- tests/x.spec.ts`), so subset runs take the
      lock too.
11.6. **A database started alone is not a running stack.** `supabase status`
      exits 0 when only the database runs, and `supabase start` then reports
      "already running" and starts nothing else. `supabase_up` checks for an
      API URL and stops a database-only stack before starting the full one;
      the db gate starts the full stack when nothing runs, so CI and a local
      run take the same path.
11.7. **Path filters (`scripts/ci-changes.sh`).** Docs-only changes (`docs/`,
      Markdown outside `.cursor/`/`.claude/`) run only gitleaks and lint;
      `android`/`ios` need `app/ios/`, `app/android/` or `app/pubspec.*`;
      `fastlane` needs `app/fastlane/` or the Gemfile. The native builds
      compile Swift, Kotlin and the pubspec's plugin registrant; Dart that
      passes `flutter analyze`/`flutter test` and both web builds also
      compiles to the iOS and Android debug kernels. With e2e sharded, ios
      (median 4:48 running) was the floor of every app PR, and most app
      PRs touch only `app/lib/`. A change to `ci.yml`, the filter, `lib.sh` or a gate runs
      everything, and so do pushes to `main` and manual runs. Not filtered:
      db, functions, fg-cli, flutter and web-prod. They are off the critical
      path, so a filter would save runner minutes only, at the risk of a
      wrongly skipped gate.
11.8. **Kept the production web build in CI** (`web-prod`, ~1:20, parallel
      and off the critical path). Vercel builds every push (job 07), but its
      result is not in `ci-ok`.
11.9. **Dependabot, not Renovate.** Grouped weekly PRs for GitHub Actions,
      pub and npm, labelled `dependencies` and `agent-ready`; majors in their
      own group. Renovate would also bump the versions pinned in `ci.yml`
      env, but needs its app installed on Peter's account.
11.10. **Speedups kept, each with its measurement** (`scripts/ci-timings.sh`,
       numbers in `docs/CI.md`):
       - Supabase images from ghcr.io (`SUPABASE_INTERNAL_IMAGE_REGISTRY`).
         Every baseline e2e log has 21 "toomanyrequests" lines from
         public.ecr.aws and ~14 s of retries before the CLI fell back to
         ghcr.io; the new runs have none.
       - The stack starts in the background before the tool installs.
         Before, `supabase start` (1:04) ran after them; now the gate waits
         21-32 s for it.
       - Gradle and the NDK/CMake cached: android 4:38 running → 2:38.
         Without it android would be the limiter once e2e is sharded.
       - e2e in two shards: Playwright was the longest step (2:46-3:48 of
         e2e's ~5:30 running). Each shard ends at ~4:10, so ios (~4:05
         running) and e2e now finish together.
       - Playwright's apt dependencies only when Chromium can't launch:
         `--with-deps` once took 6:37 (25.9 MB at 70 kB/s from the runner's
         Ubuntu mirror); the runner image already has the libraries headless
         Chromium needs, and no test compares screenshots.
11.11. **Measured and dropped:**
       - Building the web app while the stack starts (URL from config.toml,
         the CLI's fixed local publishable key, rebuild on mismatch). It cut
         gate start → Playwright start from 60 s to 51 s (medians, 5 runs
         each). 9 s is below the noise and not worth the prediction code.
       - The Playwright browser cache: the download takes ~6 s, the restore
         ~4 s.
       - `supabase start -x`: config.toml already disables studio, storage,
         imgproxy, analytics and the pooler; the CI log shows exactly the 7
         images e2e uses being pulled.
       - A Deno cache: the functions and fg-cli jobs run 0:12 and are never
         on the critical path.
       - Docker image caching: with the background start, image pulls are
         off the critical path.
11.12. **Runner speed is the noise to read through.** Playwright took either
       ~2.9 m or ~3.8 m per full run, and in a slow run nearly every test is
       1.3-1.5× slower, from the first spec to the last. That is runner
       hardware, not this repo. Medians over 5 runs per variant, with the
       range shown; a change is judged on the segment it touches when the
       medians move less than that noise.
11.13. **Review 0 fixes.**
       - Every job in every workflow sets `timeout-minutes`: release secrets 5,
         release builds 60, Supabase deploy 15. `check-gates.sh` now fails on
         a job without one (a reusable-workflow job is exempt), so a new job
         can't miss it.
       - `merge-pr.sh --wait` gives up after `MERGE_WAIT_MINUTES` (default 30)
         and exits 1, so a `ci-ok` that never reports can't hold the merge
         lock forever.
       - `push-pr.sh` and `merge-pr.sh` refuse a branch with no commits on top
         of main. They used to squash it into an empty commit and push it.
       - The squash keeps other people's `Co-authored-by` lines: it moves them
         into the trailer block once each, case-insensitively. Ours come last,
         so Peter's trailer still ends the message.
       - The e2e gate clears its holder record when it exits. The wait message
         says that a plain `flock` user records nothing.
       - Kept: the `Co-Authored-By: Claude` trailer. This box's commit
         attribution rules ask for it on every commit an agent makes, and
         Peter's trailer stays last.

## Job 13 (keepalive, deploy smoke test, function rollback), 2026-10-24

13.1. **Supabase pauses free projects after 7 days of low database activity.**
      Researched 2026-10-24 in "Project Pausing"
      (https://supabase.com/docs/guides/platform/free-project-pausing). A
      Free plan project is paused when it gets too little "user database
      activity" over a 7-day window. The docs give no exact threshold: a few
      database requests a day usually keep a project active. Supabase emails
      a warning about a week before it pauses, and a paused project can be
      restored for up to 1 year. Only a paid plan turns pausing off, so that
      is out (free tier only). A connection that runs no query may not count
      (a forum answer, not the docs), so the keepalive runs a real query.
13.2. **GitHub disables scheduled workflows after 60 days.** "Events that
      trigger workflows", section `schedule`
      (https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows):
      "In a public repository, scheduled workflows are automatically
      disabled when no repository activity has occurred in 60 days." The
      docs don't define activity. Re-enabling uses
      `PUT /repos/{owner}/{repo}/actions/workflows/{id}/enable`
      ("Disabling and enabling a workflow",
      https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/disabling-and-enabling-a-workflow).
      What is guaranteed (review 1): every push to `main` re-enables the
      keepalive (13.11), and a push is repository activity, so the schedule
      is never off for longer than the time until the next merge. With no
      pushes at all, the stated recovery is the manual
      `gh workflow enable keepalive.yml` in docs/DEPLOY.md, and Supabase's
      own warning email reaches Peter as the owner before a pause. Best
      effort only: the keepalive also enables itself on every run
      (`permissions: actions: write`). Community tools
      (gh-workflow-immortality) say that resets the 60-day clock; GitHub
      doesn't document it, and it can't be tested short of 60 quiet days.
      Dummy commits were rejected: they pollute `main`, which takes one
      commit per PR, and the best-known action that made them,
      gautamkrishnar/keepalive-workflow, is now disabled by GitHub Staff
      for a terms-of-service violation.
13.3. **Job 06's nightly run doesn't keep the project awake.** Job 06 is
      not started (status `waiting`) and has no workflow on `main`. Its brief
      lets it choose a test household on the remote project or another
      option, so it may never hit production. The keepalive is one request
      a day; if 06 later reads the remote project nightly, the keepalive can
      be dropped then.
13.4. **`health` became a readiness check.** It now runs
      `select exists (select from public.classifier_terms)`: one indexed
      read of the shared seed dictionary, no user data, over the functions'
      existing `SUPABASE_DB_URL` pool. It answers 503 with
      `{"ok": false, "database": false}` when Postgres doesn't answer, so
      the smoke test also proves the database is reachable after a deploy.
      The read has a 5-second deadline (review 0): without it, a dead
      database took the driver's 30-second connect timeout, and the callers
      (curl, 20 to 30 seconds) saw a timeout instead of the 503.
      Calling it through the function (instead of PostgREST with the
      publishable key) keeps the keepalive free of keys and also exercises
      the edge runtime.
13.5. **The MCP 401 lost its `WWW-Authenticate` header in production.**
      Found by the new smoke test: for a bad or expired token, the hosted
      `mcp` function answered 401 with no `WWW-Authenticate`, so an MCP client
      couldn't find the Protected Resource Metadata to sign in again. The
      header's `error_description` carried the German message
      ("Token ungültig: ..."). RFC 6750 section 3 limits it to printable
      ASCII, and the hosted gateway drops a header with other bytes (the
      missing-token 401, which has no description, kept its header). The
      challenge now transliterates umlauts and drops anything outside the
      RFC 6750 set; the JSON body keeps the German text.
13.6. **Rollback deploys functions only, from main, with the commit's own
      smoke test.** The `ref` input must name a commit on `main` (reviewed
      code only), and that commit must contain `scripts/smoke-remote.sh`.
      Older commits have the health check without Postgres and the MCP
      header bug, so they would fail the smoke test anyway. The run uses
      that commit's own smoke script, which tests the functions against the
      contract they shipped with. Migrations are skipped: the database is
      forward-only (docs/DEPLOY.md, "fix forward").
13.7. **Deploys only from `main`.** A manual dispatch on another branch used
      to deploy that branch's functions and migrations to production. The
      credentials step now refuses any ref other than `refs/heads/main`.
13.8. **A failed keepalive opens an issue.** GitHub sends a scheduled run's
      failure mail only to whoever last edited its cron line
      ("Events that trigger workflows", `schedule`, "actor"), which is the
      bot account. The failure step opens one issue titled "Keepalive
      failed", or comments on the open one. The body names the step that
      failed. The next green run closes it. It matches the title through
      the plain issue list: in a test, `gh issue list --search` missed an
      issue created seconds earlier and opened a duplicate.
13.9. **actionlint comes from job 11's lint gate.** This job first added its
      own actionlint step to `ci.yml` and `verify.sh`. Job 11 landed first
      with actionlint in `scripts/gates/lint.sh` (same pinned 1.7.12), so
      the rebase dropped this job's copy. A broken keepalive file still
      fails CI.
13.10. **Backups stay a proposal.** The free plan has no backups, and runners
       reach Postgres only through the session pooler. Details and the plan
       are in docs/NEEDS_PETER.md, "Job 13: database backups".
13.11. **Every push to `main` re-enables the keepalive** (review 0). GitHub
       doesn't turn a schedule back on that it disabled for inactivity, and
       a disabled schedule never runs, so it can't report itself. A
       `keepalive-schedule` job in `ci.yml` runs `gh workflow enable` on
       push events. It is not part of `ci-ok`.

## Job 13b (nightly encrypted database backups), 2026-10-25

Peter approved the proposal in docs/NEEDS_PETER.md ("Job 13: database
backups") with three changes: nightly instead of weekly, 90 days of
retention, `auth.users` and `auth.identities` included. Runbook:
docs/BACKUP.md.

13b.1. **`pg_dump --data-only --table='public.*' --table=auth.users
       --table=auth.identities --strict-names --quote-all-identifiers`.**
       `--schema` has no effect once any `--table` is given (pg_dump docs,
       "-n pattern"), so `--schema=public --table=auth.users` would back up
       only the two auth tables. The drill proves it: with that variant it
       fails. `public.*` also selects the sequences, so the dump sets
       `item_events_id_seq` and new history rows continue after the
       restored ids (the drill inserts one). `--strict-names` fails the
       dump if a pattern stops matching (a renamed auth table) instead of
       silently leaving it out. `--quote-all-identifiers` keeps the dump
       loadable if a later Postgres reserves a word we use as a name.
       `--no-owner` and `--no-privileges` are left out: a data-only dump
       has no ownership or grant statements.
13b.2. **The schema comes from the migrations, not the dump.** Supabase's
       own schemas (auth, storage, realtime) belong to the platform, and a
       full schema dump would recreate objects the target project already
       has. Our schema is fully described by `supabase/migrations/`.
13b.3. **Repository secret, not an environment secret.** The proposal
       suggested a `backup` environment. The Engineering Lead set the
       repository secret `SUPABASE_DB_PASSWORD` instead. Only
       `backup.yml` reads it, `ci.yml` never does, and pull requests from
       forks get no secrets. An environment would add nothing without
       required reviewers, which a nightly unattended job can't have.
       The workflow fails, and opens the issue, when the secret is
       missing or empty: a silent skip would look like a backup.
13b.4. **Restore in replica mode, replacing all data.**
       `scripts/backup/restore.sh` runs `SET session_replication_role =
       replica` in the same psql session as the load, inside one
       `--single-transaction -v ON_ERROR_STOP=1` run, as Supabase documents
       for restores (https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
       Without it, `items_before_write` sets `bought_by` from `auth.uid()`
       and `item_events` gains rows: the drill run without replica mode
       failed on a duplicate `item_events` key. Before the load it
       truncates `auth.users`, `auth.identities` and every `public` table
       with `CASCADE`. That handles the rows migrations seed
       (`classifier_terms`, the only top-level seed insert; the backup holds
       the full dictionary) and makes the same command restore into the
       live project after data loss, not only into an empty one. CASCADE
       also empties the auth tables that point at users (sessions, refresh
       tokens, MFA, one-time tokens, OAuth consents): their rows would refer
       to the users being replaced. psql names each one.
13b.5. **Recipient in `supabase/backup/recipient.txt`.** The brief's path;
       it sits next to the other Supabase operations files. The private key
       never touches the repo, CI or a secret. `dump.sh` checks the file
       holds one `age1...` recipient.
13b.6. **A failed dump leaves no file.** age writes a valid header before
       it has seen any input, so a pg_dump that dies mid-stream would leave a
       file that passes the header check. `dump.sh` runs with `pipefail` and
       deletes the output on any error, then checks the header and a
       16 KiB minimum (the shared classifier dictionary alone is larger).
13b.7. **The restore drill is part of the `db` gate.** docs/CI.md: a check
       goes into the gate it belongs to. The db gate already starts a stack
       and resets it, so the drill costs about a minute and no extra runner.
       It creates users through GoTrue's admin API (real `auth.users` and
       `auth.identities` rows), writes fixtures through the app's RPCs and
       triggers (`scripts/backup/fixtures.sql`), requires rows in every
       backed-up table, dumps with a throwaway key from `age-keygen`, resets
       to the migrations, restores, and compares row count and an md5 of the
       ordered rows per table. Then the restored users sign in with their
       passwords and a new write runs the triggers again. Job 18's fixtures
       aren't on `main` yet; when they land, the drill can seed from them.
       A new table without fixture rows fails the drill, so every new table
       is proven to round-trip.
13b.8. **gitleaks already catches age private keys.** Its default rule
       `age-secret-key` flagged a throwaway `AGE-SECRET-KEY-1...` committed
       to a scratch repository, so no rule was added. The drill keeps its
       key in a `mktemp -d` directory outside the repository and deletes it
       on exit.
13b.9. **pg_dump 17 from PGDG on runners.** Ubuntu 24.04 ships
       postgresql-client-16, and pg_dump refuses a newer server.
       `scripts/backup/install-tools.sh` adds the PGDG repository only when
       the distribution lacks `postgresql-client-17` (Debian 13, the build
       box, has it) and fails unless `pg_dump --version` is 17. The first
       probe run failed that check: the runner image already has PGDG and
       a PostgreSQL 16 server, and Ubuntu's `/usr/bin/pg_dump` wrapper
       follows the installed server, not the newest client. So the scripts
       put `/usr/lib/postgresql/17/bin` first on `PATH`.
13b.10. **Every push to `main` re-enables the backup schedule**, in the
        same `keepalive-schedule` CI job as the keepalive (13.11).

## Job 11b: job 11's loose ends, 2026-10-25

11b.1. **The landed body is the PR description.** `squash_commit` used to
       join every working commit's message into the commit on `main`, so
       lines like `done: PR number` and whole changelogs landed. Now the
       body is the PR description from `gh pr view --json body`. GitHub's
       CRLF line ends are stripped. The description is the text a
       reviewer reads, and anyone can edit it with `gh pr edit`. Commit
       messages still count for one thing: their `Co-authored-by` lines
       join the trailer block.
11b.2. **The model trailer comes from `MODEL_CO_AUTHOR`, or it is left
       out.** The hard-coded `Claude Opus 5.5` line credited that model for
       every PR, whichever model built it. An agent's own commits carry its
       co-author line, and that line is kept. So the env var is needed only
       when the commits lack the line. A value that is not `Name <email>`
       stops the push rather than landing a broken trailer.
11b.3. **`MERGE_WAIT_MINUTES` takes whole minutes.** It is checked before
       merge-pr.sh calls gh, and anything else exits 2 with a message.
       `08` is read as decimal (`10#`), not as an invalid octal number.
       Sub-minute waits help nobody: CI runs take minutes.

## Job 20 (rename to Hummlist), 2026-10-25

Peter approved the name "Hummlist" and the ID `com.hummlist.app` on
2026-10-25. This supersedes job 1, decision 1.

1. **One ID everywhere.** Bundle ID, Android `applicationId` and
   `namespace`, the Kotlin package (`MainActivity.kt` moved to
   `kotlin/com/hummlist/app/`), the Linux `APPLICATION_ID` and the fastlane
   `APP_ID`/Appfile/Matchfile are `com.hummlist.app`; RunnerTests is
   `com.hummlist.app.RunnerTests`. The Dart package `family_groceries`, the
   MethodChannel `familygroceries/speech`, the Linux binary name, the repo,
   the Vercel project and its URL, and the export format id
   `family-groceries-export` stay: none of them is visible as the app's
   name, and renaming them would break imports, old exports or links.
2. **Both deep links stay allowed.** The app now redirects to
   `com.hummlist.app://login-callback`. TestFlight 0.1.0 (1001) and any
   installed build still use `com.petertrost.familygroceries://login-callback`,
   so `supabase/config.toml`, `supabase/deploy/auth_urls.ts` and
   `scripts/configure-social-auth.mjs` keep both. Dropping the old one would
   break magic links and Apple-on-Android for those builds.
3. **Apple client IDs as one comma list.** `configure-social-auth.mjs` writes
   `external_apple_client_id` = Services ID, old bundle ID, new bundle ID and
   an empty `external_apple_additional_client_ids`, exactly the hosted state
   the Lead set. Before, it wrote the bundle ID into the additional list, so a
   rerun would have dropped `com.hummlist.app` and broken native Apple
   sign-in on the new builds. Checked with `--dry-run` against a stubbed
   Management API returning the live values (no call to the real API).
4. **Account deletion revokes for both bundle IDs.** An Apple authorization
   code only exchanges with the client ID it was issued to, and the request
   does not say which build sent it. `supabase/functions/account/apple.ts`
   tries `com.hummlist.app`, then `com.petertrost.familygroceries`, moving on
   on `invalid_grant` (another app's code) or `invalid_client` (the key does
   not cover that ID yet), and revokes with the ID that worked. The
   `APPLE_BUNDLE_ID` secret is no longer read: a single configurable ID
   would always be wrong for one of the two builds.
5. **What carries the name "Hummlist".** Home-screen and store names
   (`CFBundleDisplayName`, `CFBundleName`, `android:label`), the iOS
   microphone and speech prompts, the web `<title>`, Apple web-app title and
   manifest `name`/`short_name`, `konto-loeschen.html`, `appTitle` and
   `accountDeletedApple`, the voice errors ("in der Hummlist-App"), the MCP
   server (`name: hummlist`, title and `resource_name` "Hummlist", the
   instructions start with "Hummlist:"), the Linux window title, README and
   the user docs. "Einkauf" stays where it is the ordinary word
   (Einkaufsliste, "Gemeinsame Einkaufsliste", the Shortcut name "Einkauf
   notieren"), and historical records (done summaries, the old App Store
   record "Einkauf Familie") keep the old name. The name is always the full
   word "Hummlist".
6. **No new UI for the name.** The sign-in screen keeps its title
   "Anmelden"; the name shows in the browser tab, the installed web app and
   the phones' home screens. Putting it on the sign-in screen is a design
   change, not part of the rename.
7. **Production URL `https://app.hummlist.com`.** Peter bought
   `hummlist.com`; the Lead attached `app.hummlist.com` on Vercel and made it
   the hosted Site URL (2026-10-25). `APP_URL` in `app/config/auth.json`
   (the phone apps' invite links), the link on `konto-loeschen.html` and the
   docs now name it. The old `family-groceries-pied.vercel.app` keeps
   serving and stays in the redirect allow list, so links already sent and
   bookmarked keep working. The Vercel project keeps its name.


## Job 23 (weekly release pipeline), 2026-10-27

1. **Why no TestFlight build was installable.** App Store Connect (read-only
   API, 2026-10-27) shows every unexpired build of the team expired within
   two seconds on 2026-10-26, 13:14:02 to 13:14:03 UTC: Hummlist 1002
   (uploaded 2026-10-25 20:20 UTC), build 1001 of the old app record
   (`6826907810`) and all 65 builds of another app of the team uploaded since
   2026-09-13, weeks before their 90 days were up; a fourth app's builds had
   expired normally after 90 days. No Beta App Review submission exists, no
   newer build of either Hummlist version replaced 1002, the certificate and
   the profile are `ACTIVE`, the API key works, and the team's live App Store
   app is still `READY_FOR_SALE` (so, as far as the API shows, the membership
   did not lapse). Manual expiry is ruled out: nobody expires 67 builds of
   three apps in two seconds. Apple's developer forums (thread 813703) report
   the same team-wide mass expiry for other teams in January, July and August
   2026; Apple's TestFlight team acknowledged it and gave no cause.
   Conclusion: an Apple-side event, not this pipeline. The weekly run
   counters it: when no TestFlight build is installable, an unchanged `main`
   ships again; a build that comes out of processing already expired fails
   the run and points to `RELEASE.md` (Apple Developer Support case, Peter's
   step in `NEEDS_PETER.md`, Job 23).
2. **"Last upload" is a job name, not a tag.** A run uploaded when its
   `Uploaded` job succeeded; the plan job pages through successful Release
   runs on `main` with the Actions API. No tags, no `contents: write`, and
   dry runs or skips never count. The same lookup gives the notes' start
   commit.
3. **Re-ship an unchanged `main`** when TestFlight has no installable build
   (item 1) or the last upload is 60 days old, so testers never hit the
   90-day expiry on a quiet `main`.
4. **Only green `main` ships, and `force` does not override it.** The plan
   reads the newest `ci.yml` push run on the commit (a green rerun counts)
   and needs `status: completed`, `conclusion: success`; `ci-ok` fails that
   run whenever a gate fails. A scheduled run that skips for this opens the
   failure issue: a red `main` on Monday is a failed release.
5. **The failure issue.** Scheduled runs and `simulate_failure` dispatches
   open or comment on "Weekly release failed"; other failed dispatches
   don't (whoever started them watches). A green upload run or an
   "unchanged" skip closes it; dry runs never touch it, since they prove the
   build but not the upload.
6. **Play is keyless.** fastlane 2.241's supply reads `external_account`
   credentials (checked in the gem source, `supply/client.rb`), so
   `google-github-actions/auth` with Workload Identity Federation replaces a
   JSON key. The service account `play-release@family-groceries-ci` has no
   key and no project roles; its only binding is
   `roles/iam.workloadIdentityUser` for the subject
   `repo:trost-systems@267752722/family-groceries@1429864759:environment:release`
   (the repo uses GitHub's immutable subject format), so only jobs in the
   `release` environment, which deploys from `main` only, can act as it.
   Narrower than the provider's repo-wide condition. `PLAY_SERVICE_ACCOUNT_JSON`
   is gone from the secrets check.
7. **`PLAY_RELEASE_STATUS` is the Play setup state.** Unset: no upload; the
   run proves the token exchange and reports whether Play lets the account
   in (`android play_access`), and the AAB is an artifact for the Lead's
   first manual upload. `draft`, then `completed`: every run uploads, and a
   missing grant fails the run. One variable instead of a separate on/off
   switch. A failed token exchange always fails the job: that is our setup.
8. **fastlane 2.241.1 to 2.241.2.** The patch release fixes security
   advisories in spaceship and match, both of which run with the signing
   secrets here.
9. **What to Test is set by `wait_processing`, not by pilot.** pilot waits
   for the build only when `changelog` is set and ignores
   `localized_build_info` for that check, and a retried upload would trip
   over it. The upload is retried once; the wait lane sets de-DE and en-US
   as soon as the build appears and then polls for `VALID`.
   `notify_external_testers` stays unset: there are no external groups and
   `distribute_external` is false; internal testers get TestFlight's normal
   notice.
10. **Dry runs validate.** iOS runs `altool --validate-app` with the API key
    (written to `~/.appstoreconnect/private_keys` for the call and deleted);
    Android runs the upload with `validate_only` once Play is set up. Both
    check the signing: the IPA through match's profile, the AAB through
    `check-aab.sh` against the upload certificate's SHA-256.
11. **Upload key.** PKCS12 keystores have one password; keytool ignores a
    separate key password, so `key.properties` names the same random
    32-character password twice. The first `keytool` call failed before
    writing a keystore (the password variable was not exported); its
    stray `key.properties` was deleted and both files were generated again.
12. **The release tests run in the lint gate**, next to
    `scripts/landing-test.sh`. The lint gate runs on every PR; the fastlane
    gate is path-filtered to `app/fastlane` and the Gemfile and would skip a
    change to `scripts/release/`. The lint gate's shellcheck line now covers
    `scripts/release/*.sh`.
13. **5-green, adapted.** The PR touches `scripts/gates/lint.sh`, a gate
    `verify.sh` runs, but none of `app/` (other than `app/fastlane` and the
    Gemfile), `supabase/` or `e2e/`. The Lead's rule for CI-only changes
    applies: CI `ci-ok` on the final head (the gate edit makes CI run every
    gate), `scripts/verify.sh --only lint,fastlane,gitleaks` locally, then
    5 consecutive green `upload: false` Release runs on `main` and one real
    upload run. No local Supabase stack, Playwright or Flutter build: the
    lint gate edit cannot change what those gates run.
14. **Capabilities without the Certificates workflow.** `ios renew_profile`
    runs match with `readonly: false`, `force: true` and
    `certificate_id: GN85KDC962`; match creates a certificate only when the
    repo holds none, so it regenerates the profile and nothing else. The
    box's network blocks SSH to GitHub (ports 22 and 443), so the box uses
    the HTTPS match URL with `gh` as the credential helper; the no-change
    run (`MATCH_FORCE=false`) passed and left the match repo's HEAD as it
    was. The plan's `ios preflight` fails early on an `INVALID` profile.
15. **Build number guard.** The plan fails a run whose number is not above
    TestFlight's highest, naming `BUILD_NUMBER_OFFSET`, instead of letting
    the upload fail after an hour of macOS build.
16. **One local appbundle build, for the Lead.** The Lead created the Play
    app while #52 waited for CI (ghcr.io refused runners for hours), and L3
    needs a signed AAB before any Release run on `main` can make one. The
    box builds it (`--build-number=1003`, MemAvailable 9 GB, no other
    flutter build running, the `~/.gradle` limits), checks its signer with
    `check-aab.sh` and installs it at
    `~/groceries-ops/artifacts/app-release.aab`. The first attempt (22:37)
    copied the keystore and `key.properties` into `app/android/` and was
    killed with the session before it finished, so its cleanup never ran
    and both copies stayed in the worktree (gitignored, never committed;
    review 0 found them). They were deleted. The build that counts
    (`/tmp`-only script, detached so a session end cannot cut it) copies no
    keystore: its `key.properties` names the keystore in
    `~/groceries-ops/secrets/android/` by absolute path and is deleted by an
    exit trap. Only that one build ran; the first never produced a bundle.
    `BUILD_NUMBER_OFFSET` went from 1000 to 1010 so CI's next number (1013)
    is above both stores' highest.
17. **Review round before merge** (independent reviewer, read-only): What
    to Test is sanitized with pilot's `sanitize_changelog` and a refusal
    only warns (a red `ios` job after a good upload would reopen the issue
    and re-ship the same commit); the notes drop titles about the repo's own
    machinery; an Actions API error in the last-upload lookup now fails the
    plan instead of reading as "no earlier upload"; the upload retry first
    looks for the build for 10 minutes; preflight accepts any ACTIVE profile
    of the name (a regenerated profile can leave an INVALID twin); the notes
    output uses a random heredoc delimiter; the signing secrets moved from
    the `ios` job's env to the two fastlane steps, out of reach of the
    third-party actions.
18. **ghcr.io refused runners** (`toomanyrequests` on every Supabase image
    pull, seven attempts over two hours, githubstatus green). #52 takes
    15b's one-line `ci.yml` change (`SUPABASE_INTERNAL_IMAGE_REGISTRY:
    docker.io`) byte-for-byte, so whichever of #49 and #52 lands second
    rebases cleanly.
