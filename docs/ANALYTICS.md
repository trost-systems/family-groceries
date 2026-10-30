# Analytics and error tracking (job 19)

Hummlist measures its DACH kill gates and lifetime value in PostHog, and reports app and
edge-function errors there. Spec #1 "Kill-gate and LTV analytics"; decisions in
[DECISIONS.md](DECISIONS.md), "Job 19"; what Peter still has to do in
[NEEDS_PETER.md](NEEDS_PETER.md), "Job 19".

| Metric | Question | Query |
| --- | --- | --- |
| Day-35 unlock share | Which share of an install-week cohort bought the lifetime unlock within 35 days of `first_open`? | [`analytics/queries/unlock_d35.sql`](../analytics/queries/unlock_d35.sql) |
| WAH | How many households added or ticked at least once in a week (Mon-Sun, Europe/Berlin)? | [`wah.sql`](../analytics/queries/wah.sql) |
| Net unlock revenue | Revenue per month after VAT and store fee, refunds subtracted, restores zero | [`revenue_monthly.sql`](../analytics/queries/revenue_monthly.sql) |
| Household retention | Share of an install-week cohort still adding or ticking in week 1-12 and month 1-11 | [`retention_weekly.sql`](../analytics/queries/retention_weekly.sql), [`retention_monthly.sql`](../analytics/queries/retention_monthly.sql) |
| Manual reorders | Category (route order, store layout) and store reorders per household | [`reorders.sql`](../analytics/queries/reorders.sql) |
| Internal filter | Installs and households excluded from every query above | [`internal.sql`](../analytics/queries/internal.sql) |
| Privacy scan (AC4) | No item names, list text, e-mails, IPs or GeoIP in the project | [`privacy_scan.sql`](../analytics/queries/privacy_scan.sql) |

## Where the data goes

- **PostHog EU Cloud**, organization and project "Einkauf", project id **319492**, ingestion host
  `https://eu.i.posthog.com`. The app and the edge functions accept that host and nothing else
  (the e2e build's stand-in `https://posthog.invalid` aside, which cannot leave the machine). No
  fallback key or host is in the code: without `POSTHOG_PROJECT_API_KEY` and `POSTHOG_HOST`
  analytics and error tracking are off.
- The **project key** (`phc_…`) is public by design but never committed. Builds get it from their
  environment: Vercel (`scripts/vercel.sh`), the release workflow (`release.yml` → fastlane,
  `--dart-define`), and Supabase function secrets for the edge functions. CI builds never have it:
  `no_posthog_in_ci` in `scripts/lib.sh` fails the e2e, web-prod and flutter gates otherwise.
- **Free tier only.** No group analytics, cohorts, dashboards or add-ons were created. Person
  profiles are off (`$process_person_profile: false`), so events stay personless and cheap.
- Project-side settings Peter set (IP anonymization, no autocapture, replay, surveys, heatmaps,
  web vitals; exception autocapture; Europe/Berlin; EUR; test-account filter) are a second line.
  The app enforces its own rules regardless.

## How it is built

The app does not use the posthog_flutter SDK or posthog-js (DECISIONS Job 19.1). It sends to
PostHog's public capture API (`POST /batch/`) itself, so every byte goes through the allow-list
below, the same code runs on iOS, Android and web, and e2e can answer the host with a fake
collector.

| Part | Where |
| --- | --- |
| Consent gate, install id, queue, sending | `app/lib/analytics/analytics.dart` (`Analytics`, a cubit) |
| Event catalog and allow-list | `app/lib/analytics/events.dart` (`eventCatalog`, `checkEvent`) |
| `is_internal` rules | `app/lib/analytics/internal.dart` (`isInternal`) |
| Exception shape and scrubber | `app/lib/analytics/exceptions.dart` (`exceptionList`, `scrubMessage`) |
| The sink (the one network call) | `app/lib/analytics/sink.dart` (`PostHogSink`, `allowedHost`) |
| Start-up from the build defines | `app/lib/analytics/setup.dart`; defines in `app/lib/app/environment.dart` |
| Consent screen | `app/lib/analytics/consent_screen.dart`, route `/analytics-consent` |
| More switch, internal install | `app/lib/more/more_screen.dart` (`more-analytics`, long press on `more-version`) |
| Edge-function error tracking | `supabase/functions/_shared/telemetry.ts` (`withTelemetry`, `Telemetry`) |
| Purchase events (skeleton) | `supabase/functions/_shared/purchases.ts` |
| HogQL and its reference | `analytics/queries/*.sql`, `analytics/metrics.ts`, tests in `analytics/metrics_test.ts` |

## Consent

- **Opted out by default.** Nothing is captured, queued or sent until the user says yes on this
  install. A "no" is stored too and never asked again.
- **When it is asked:** right after the first sign-in on an install, before onboarding (create or
  join a household) and before the list (Peter, 2026-10-27). The router's only gate,
  `authRedirect`, sends a signed-in user to `/analytics-consent` while the install has not
  decided; an invite (`?invite=` or `/join/<code>`) rides along, so the link still ends on joining.
  A browser tab authorizing an MCP client (`next=/oauth/consent…`) is not interrupted; the app
  asks the next time it is opened. Signed out, nothing is captured, not even errors: the login
  screen sends nothing.
- **Per install**: a later sign-in on the same install (another account included) is not asked
  again. More → Nutzungsdaten switches it. Off stops sending at once, drops whatever still waits
  in the queue and deletes the install id; nothing captured before a yes is ever sent later.
- **The install id exists only after a yes** (job 33b, legal review H-08, TDDDG §25): a yes
  makes and stores it, a no or off deletes it together with the `first_open` mark, and a later
  yes makes a new one. Without a yes the device holds only the decision (`analytics.consent`),
  never an id. An id an older build (job 19) stored without a yes is deleted at the next start;
  an id stored with a yes keeps working.
- **A build without a key** (CI, fg, local debug) never shows the screen: nothing could be sent.
- Peter approved the wording (DE and EN, the legal review's version) on 2026-10-30; job 33b
  removed the "ENTWURF" mark from the screen and from More.
- **`first_open`** is sent at the moment of consent on the first sign-in of an install, once per
  install id, not at process start. Install-week cohorts therefore start at the first consented
  open. Someone who said no and later switches it on under More sends `first_open` then, and so
  does someone who switched it off and on again: that is a new install id.

## Event catalog

Every event carries `distinct_id` = `install_id` (a random UUID made on the device at the yes,
new on a reinstall or after switching off and on; never an e-mail or name, no `identify`), `event_id` (UUID, also PostHog's `uuid`, so a
retried batch is not counted twice), `household_id` (null before joining), `platform`
(`ios`, `android`, `web`), `app_version` (`0.1.0+1023`), `is_internal`, `$geoip_disable: true`,
`$process_person_profile: false`, `$lib: hummlist-app`, `$lib_version`. No `$ip`. With
`ANALYTICS_HOUSEHOLD_GROUPS=true` (off; group analytics is paid) it also sends
`$groups: {household: <id>}`.

| Event | When | Properties |
| --- | --- | --- |
| `first_open` | the first yes on an install | none |
| `household_created` | the server created the household; once, also when a retry finds the household a lost answer made (job 22) | `default_stores` (true: dm, Lidl and Edeka; false: Skip) |
| `invite_accepted` | the server confirmed a new membership from an invite (`accept_invite` answered `joined`; not when the user was a member already, except as the answer to a try whose answer was lost) | `method`: `link` (the code came from `/join/<code>`, `?invite=` or the pending invite kept on the device, and was not edited) or `code` (typed) |
| `invite_sent` | job 22: an invite was handed out: the share sheet opened, or its link or code was copied; once per tap | `channel` (`share_sheet`, `copy_link`, `copy_code`), `context` (`onboarding`: Step 3 after creating; `settings`: More, Einladungen). Never the code, the link or the household's name |
| `item_added` | the user added an item | `source`: `typed` (taken as typed), `spoken` (in-app dictation), `suggestion` (any other row of the add sheet, a due usual, a re-add from "Zuletzt verwendet" more than 10 minutes after the tick), `alexa` (server only, job 31: added through the Alexa skill, sent by the `alexa` function); `actor_role` (`owner`, `member`); `household_size` |
| `item_ticked` | the user ticked an item off | `actor_role`, `household_size` |
| `category_reordered` | a new category order reached the server | `scope`: `default` (route order) or `store` (a store's layout) |
| `store_reordered` | a new store order reached the server | none |
| `feedback_submitted` | the server stored a feedback note (job 21, docs/FEEDBACK.md); once per note, also after a Retry whose first answer was lost | `category` (`bug`, `idea`, `other`, `none`), `entry_point` (`settings`; More is the only entry), `screen` (a name from `screenNames` in `router.dart`, e.g. `list`), `contact_ok` (true, false). Never the note's text |
| `item_categorized` | the server confirmed an add from the app (job 32a); once per added item, also after a retry whose first answer was lost; not for a restored deletion | `via`: how the server chose the category (`items.categorized_via`): `household` (a correction of this household, also for the item's spelling variants and synonyms), `exact` (the dictionary, also after folding spelling: Karrotten), `synonym` (Paradeiser), `fuzzy` (a typo: Schokolde), `fallback` (Sonstiges), `picked` (the add brought another category than the guess). Never the name or the canonical key |
| `dedupe_hint_shown`, `dedupe_hint_merged`, `dedupe_hint_ignored` | job 32b's duplicate hint ("Möhren steht schon auf der Liste"): `shown` when the snackbar shows, then once either `merged` (Zusammenführen) or `ignored` (any other close); the merge's undo sends nothing. Listed by 32a, sent by `ListCubit` since 32b | `actor_role`, `household_size`. Never the item names |
| `purchase_completed`, `purchase_refunded` | server only, after store verification (see Purchases) | `product_id`, `price`, `currency`, `app_store` (`apple`, `google`), `country`, `net_amount` when known, `transaction_ref` |
| `purchase_restored` | server only | `product_id`, `app_store` |

Rules that keep it one event per user action (AC3, AC9):

- Events fire where the user acts (`ListCubit.tick`, `addParsed`, `readd`, the reorder methods,
  `SessionCubit.createHousehold` and `join`), never where ops are sent. An op retried after a
  reconnect, a realtime echo, or a resync sends nothing.
- Undo sends nothing: the tick has no snackbar since job 29b, and a tap on the item under "Zuletzt
  verwendet" within 10 minutes of the tick (`ListCubit.undoWindow`, the window in which
  `suggest_items` drops the purchase too) is its undo, no `item_added`; the add sheet's undo deletes, a
  restored deletion re-inserts; none is an event. Ticking again after an undo is a new action and
  sends a new `item_ticked`.
- A tick of an item that is not on the list, an add of something already on it, a reorder that
  leaves the order as it was, one refused offline, or one the server rejected: nothing.
- Hiding a category in a store's layout is not a reorder.
- MCP and Siri adds and ticks are not counted (PM, 2026-10-25): the app only. Alexa adds are
  (Spec #7, job 31): see "Alexa" below.
- `item_categorized` is the one list event sent on the server's answer, not on the tap: only the
  server knows how it categorized. An op is acknowledged once, so it is still one event per add.

Adding an event (jobs 21 and 22): add it to `eventCatalog` with a rule per property, a case to
`app/test/analytics/events_test.dart`, and a row here. Free text can't be added by accident: a
property needs an explicit rule (`OneOf`, `IntIn`, `IsBool`), and `checkContext` refuses any other
key. Server events: `serverEventCatalog` in `telemetry.ts`.

## Alexa (job 31)

An item added through the Alexa skill is `item_added` with `source: alexa`, `actor_role` and
`household_size`, sent by the `alexa` edge function (`serverEventCatalog` in `telemetry.ts`, which
allows nothing else), once per item that was not on the list yet.

Consent is per install and lives on the device, so the app tells the server each install's answer
(`record_analytics_consent(p_install, p_consent, p_internal)`, table `analytics_consents`, no
client may read it): when the user answers, switches it under More, marks the install internal,
or signs in (an account new on an install that already answered). A no is recorded under the
install id it had before job 33b's no deletes it, or, for an install that never had one, under the
nil UUID. An answer the user gives is always their newest; a start or sign-in only records a new or
changed answer, so it never outranks a newer answer on another device. The function
counts an Alexa add only while the user's newest answer is yes, with that install as
`distinct_id` and its internal mark as `is_internal`; otherwise nothing is sent. A build without a
key never records an answer, so its users' Alexa adds are never counted. Item names, the
utterance, Alexa's user id and tokens are never sent.

## Never sent

Item names, quantities, brands, details, category or store names, household names, display
names, e-mail addresses, invite codes, tokens, request bodies, IP addresses, GeoIP. The allow-list
makes them impossible as event properties; `privacy_scan.sql` checks the project after real data
arrives (AC4, the lead runs it).

## `is_internal`

True when any of these holds (`isInternal`, `app/lib/analytics/internal.dart`):

- a debug or profile build, or a Vercel preview deployment (`ANALYTICS_INTERNAL_BUILD`, set by
  `scripts/vercel.sh` for every deployment but production);
- the install is marked internal: a long press on the version line under More (a snackbar says
  so; "Interne Installation" shows below it, with a "Testfehler senden" button for error
  tracking);
- the household is in `ANALYTICS_INTERNAL_HOUSEHOLDS` (Peter's family; a build define, not in
  code);
- the user's e-mail domain is a reserved test domain (`.test`, `.invalid`, `.example`,
  `.localhost`, `example.com/.net/.org`: the fixtures' `fg.test` and `fg-test.invalid`, e2e's
  `example.test`) or in `ANALYTICS_INTERNAL_EMAIL_DOMAINS`. The e-mail is read on the device only.

Server events take it from the `ANALYTICS_INTERNAL` function secret (true only for local proofs).
Every gate query drops every event of an install or household that **ever** sent
`is_internal = true` (`internal.sql`, AC10), so a phone marked internal late, or a tester in a
household, leaves no trace. PostHog cohorts need person profiles, which the app does not create,
so the filter is this pair of lists in each query rather than a saved cohort.

## Error tracking

- **App:** `FlutterError.onError`, `PlatformDispatcher.instance.onError` and the zone around
  `main` hand uncaught errors to `Analytics.captureException`, under the same rules as events
  (consent, signed in, `is_internal`). The event is `$exception` with `$exception_list` in
  posthog_flutter's shape (type, value, mechanism, raw frames).
- **Scrubbing** (`scrubMessage`): errors the Dart runtime and Flutter raise themselves (type,
  range, null-check, state, layout errors) keep the shape of their message's first line, at most
  120 characters: anything quoted, e-mail addresses, URLs, UUIDs and numbers are replaced, and
  every word outside the runtime's and Flutter's own error templates becomes `<w>`, so
  `StateError('cannot parse Hafermilch 2 Liter')` reads `Bad state: cannot <w> <n> <w>`. The
  word list is the edge functions' (`telemetry.ts`) plus Dart's and Flutter's. Every other error (a Postgres
  error echoing a value, a format error quoting its input, the app's own exceptions) keeps only a
  code that looks like one (`23505`, `invalid_invite`) or `<redacted>`. Frames carry code
  locations only; a device path keeps its file name.
- **Readable traces.** iOS and Android release builds are not obfuscated (no `--obfuscate`, no
  `--split-debug-info`), so Dart frames name their functions and files. On the web, Safari and
  other non-Chromium browsers run `main.dart.js`: with `POSTHOG_PERSONAL_API_KEY` and
  `POSTHOG_PROJECT_ID` in the Vercel project, `scripts/vercel.sh` builds with `--source-maps`, runs
  `posthog-cli sourcemap process` (chunk ids into `main.dart.js`, the map uploaded, then deleted
  from the deployment), and the app sends each frame's `chunk_id`, so PostHog maps it back to Dart.
  Chromium runs the wasm build (job 28): its frames name Dart functions but carry no lines, and
  PostHog has no wasm symbolication.
- **Edge functions:** every function is wrapped in `withTelemetry(<name>, handler)`: an uncaught
  exception is reported (tagged `function_name`) and answered with 500, and the voice and account
  functions also report the failures they catch and answer with 500. The event is sent before the
  response returns (3 s cap) and never carries the request, headers, tokens or item text. Its
  `distinct_id` is `edge-function-<name>`: no user, so no consent is involved (DECISIONS Job 19).

## Configuration

| Name | Where | What |
| --- | --- | --- |
| `POSTHOG_PROJECT_API_KEY` | app define (Vercel env, release secret), function secret | the `phc_` key; empty = off |
| `POSTHOG_HOST` | app define (Vercel env, release variable), function secret | `https://eu.i.posthog.com` |
| `ANALYTICS_INTERNAL_HOUSEHOLDS` | app define (Vercel env, release variable) | Peter's household id(s), comma-separated |
| `ANALYTICS_INTERNAL_EMAIL_DOMAINS` | app define (optional) | more internal e-mail domains |
| `ANALYTICS_INTERNAL_BUILD` | app define (set by `scripts/vercel.sh` outside production) | every event internal |
| `ANALYTICS_HOUSEHOLD_GROUPS` | app define | `true` sends `$groups`; off until Peter buys group analytics |
| `ANALYTICS_INTERNAL` | function secret | `true` marks server events internal |
| `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID` | Vercel env (production) | source-map upload; error-tracking write scope, Einkauf only |

## The insights (AC4-AC10)

The HogQL lives in `analytics/queries/`; the Engineering Lead creates the insights from it in
project 319492 through the PostHog connector and runs `privacy_scan.sql` after the first real
events. `analytics/metrics.ts` computes the same metrics in TypeScript, step by step like the
SQL, and `analytics/metrics_test.ts` checks them on `analytics/fixtures.ts`: Berlin week edges
(Sunday 23:30 UTC is Monday in Berlin), a purchase after day 35, a refund in the next month, a
restore, an install marked internal late, a test account and Peter's household. It also checks
that every gate query carries the internal filter. The functions gate runs it.

Definitions:

- **Weeks** are Monday to Sunday in Europe/Berlin (`toStartOfWeek(…, 1)` on Berlin time);
  months are Berlin calendar months.
- **Install week** is the Berlin week of an install's `first_open` (its first consented sign-in).
- **Day 35** is 35 × 24 h after `first_open`. A purchase refunded since (same `transaction_ref`)
  does not count.
- **Household retention:** a household starts with its first event (`household_created`,
  `invite_accepted`, an add or a tick); its cohort is that Berlin week. It is active in period k
  when it added or ticked between start + k·7 days (weeks) or start + k·30 days (months) and the
  next period. Fixed-length months give every cohort the same windows. Weeks 0-12, months 0-11:
  the free plan keeps a year of data (Peter's override, 2026-10-25); month 12 and beyond need the
  paid retention Peter plans to buy before year end.
- **Net revenue:** completed minus refunded `net_amount`, in the month each happened; restores
  add nothing. Gross (`price`) the same way.

## Purchases (AC8, partial)

Nothing is sold yet; the lifetime unlock comes with the in-app purchase job. This job built what
the revenue metrics need, so that job only has to plug real verification in:

- **Revenue only from the server, after the store confirmed it.** The app never reports a price.
  `recordPurchase(payload, buyer, {verifier, telemetry})` in `_shared/purchases.ts` verifies, and
  for a buyer whose install said yes (`consent` and `install_id` come from the app with the
  purchase) queues `purchase_completed`, `purchase_refunded` or `purchase_restored` with the
  install as `distinct_id`. An unverified payload throws; nothing is sent.
- `PurchaseVerifier` is the interface; `FakePurchaseVerifier` accepts test payloads only. The
  mapping from what the stores return is real code: `fromApple` (a decoded
  `JWSTransactionDecodedPayload`: `price` in milliunits, `currency`, alpha-3 `storefront`) and
  `fromGoogle` (an Orders API order: `total`, `tax`, `regionCode`).
- **Net amount** (`netAmount`): the store-reported tax (Google's Orders API) or else the country's
  VAT rate (DE 19 %, AT 20 %, CH/LI 8.1 %), then the store fee (15 %, both stores' small-business
  rate; 30 % above $1M). Apple reports the customer price incl. VAT, not the tax. Unknown country
  and no tax: no `net_amount`. It is an estimate; the real proceeds are in App Store Connect's and
  Play Console's monthly financial reports, to reconcile monthly.
- `transaction_ref` is the first 16 bytes of SHA-256(`<store>:<original transaction id>`): stable
  across purchase, refund and restore, not the raw store id.

What the IAP job adds (needs Peter's store credentials, NEEDS_PETER Job 19):

1. **Apple.** The app sends the StoreKit 2 transaction's JWS (`jwsRepresentation`) with its
   install id and consent to a `purchases` edge function. The function verifies the JWS: the
   `x5c` chain up to Apple Root CA - G3 (pinned), signature ES256, `bundleId`, `productId`,
   environment; or asks the App Store Server API (`GET /inApps/v1/transactions/{id}`, a JWT signed
   with an App Store Connect in-app purchase key). Refunds arrive as App Store Server Notifications
   v2 (`REFUND`, `REVOKE`; signed payload verified the same way) at a second endpoint; they carry
   no install id, so the function keeps `original_transaction_id → install_id, consent` in a
   service-role-only table written at purchase time.
2. **Google.** The app sends the purchase token. The function calls
   `purchases.productsv2.getproductpurchasev2` (Play Developer API, service account) to verify it
   and `orders.get` (Orders API) for `total`, `tax` and `regionCode`. Refunds come from Real-time
   Developer Notifications via Pub/Sub push (`VoidedPurchaseNotification`), mapped through the
   same table.
3. **Restore** is a re-verified transaction the table already has: `purchase_restored`, no
   revenue.
4. Tests: the stores' sample payloads and a test certificate chain made in the test (a self-made
   root, intermediate and leaf), so the chain check runs without Apple.

## Verifying

- `flutter test app/test/analytics` (events, consent gate, payload, internal rules, scrubber,
  list and session events, consent flow, More switch); `deno test` in `supabase/functions`
  (`telemetry_test.ts`, `purchases_test.ts`, voice reporting) and in `analytics/`.
- `e2e/tests/analytics.spec.ts` drives the web build against the local stack with a fake
  collector on the PostHog host: sign-in → consent → onboarding or list (with screenshots), zero
  requests before consent and after declining or switching off, one event per action, no list
  text, invite links through consent. Every other spec answers the consent through `signUp` or
  `answerConsent` (declined).
- Manual proofs against project 319492 (never from CI): `e2e/analytics-proof.mjs` (AC11, a local
  release web build raising the internal test error) and `analytics/proofs/edge_exception.ts`
  (AC12). Steps in `.cursor/skills/verify-family-groceries/features/analytics.md`; evidence in
  `docs/screenshots/19/`.
