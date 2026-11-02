# Hummlist Premium (held: not on sale)

Premium launch is on hold: nothing is sold and nothing is gated. Siri, Alexa and AI assistants work for every household without Premium. Still, Mehr has a row „Hummlist Premium“ in every production build, and its page explains what Premium will unlock and, depending on the platform, says where it will be bought or that it is „bald verfügbar“. There is no price, no buy button and no restore button anywhere. A household that has been given Premium by the team (testers, reviewers, partners: a RevenueCat promotional grant) sees the page flip to a status line and the row to „Freigeschaltet“.

## Sub-features

- `prem-row` the Mehr row „Hummlist Premium“, hint „Siri, Alexa und KI-Assistenten“ (household without Premium) or „Freigeschaltet“ (household with Premium).
- `prem-page-web` on the web (app.hummlist.com, the preview) the page says Premium is bought in the iPhone or Android app. Nothing to buy on web, ever.
- `prem-page-soon` in the iOS and Android store builds today (purchases build define off) the page says „Hummlist Premium ist bald verfügbar.“ No cards, no prices, no buy, no restore.
- `prem-refund-link` the page always ends with the link „Doppelt gekauft? So bekommst du dein Geld zurück“ (opens „Kauf zurückfordern“ help with the Apple and Google refund steps).
- `prem-granted` household with a grant (testers): status tile „Hummlist Premium geschenkt“ (no end date) or „Hummlist Premium geschenkt bis <Datum>“ plus „Hummlist Premium ist für euren ganzen Haushalt freigeschaltet. Danke!“. Every member sees it live.
- `prem-no-paywall` no paywall is shown in production: no plan cards, so no `paywall_viewed` event is ever sent; the Zugänge page shows no Premium card (the integration lock is off).
- `prem-held-unreachable` (not visible today, shipped in the code, needs the purchases define on a store build and the server switch `premium_offer`): yearly „Jährlich“ and „Lifetime“ cards with store prices, „Kauf wiederherstellen“, terms, manage-subscription, billing warnings. Do not describe as available. Offline (switch unreadable) the page says „Hummlist Premium ist gerade nicht verfügbar.“, not „bald verfügbar“; a restore that finds only a lapsed plan says nothing to restore; a failed renewal keeps Premium through the store's grace period (job 67). The order of the switches that make this reachable is `docs/PAYWALL_RELEASE.md`.

## How to get to it (user POV)

- Tab „Mehr“ / "More" → section „Haushalt“ / "Household" → row „Hummlist Premium“ / "Hummlist Premium" (same name in both languages). Hint: „Siri, Alexa und KI-Assistenten“ / "Siri, Alexa and AI assistants", or „Freigeschaltet“ / "Unlocked" when the household has Premium.
- Page text for every household, first line: „Hummlist Premium schaltet für euren ganzen Haushalt die Verbindungen frei: Siri, Alexa und KI-Assistenten (MCP). Später kommen Google Assistant und die Apple Watch dazu.“ / "Hummlist Premium unlocks the connections for your whole household: Siri, Alexa and AI assistants (MCP). Google Assistant and the Apple Watch come later."
- Web: „Hummlist Premium kaufst du in der iPhone- oder Android-App. Danach ist es auch hier für deinen ganzen Haushalt freigeschaltet.“ / "You can buy Hummlist Premium in the iPhone or Android app. It is then unlocked here too, for your whole household."
- iOS and Android store builds today: „Hummlist Premium ist bald verfügbar.“ / "Hummlist Premium is coming soon."
- Granted household: „Hummlist Premium geschenkt“ / "Hummlist Premium, a gift", with end date „Hummlist Premium geschenkt bis {date}“ / "Hummlist Premium, a gift until {date}". Subtitle „Hummlist Premium ist für euren ganzen Haushalt freigeschaltet. Danke!“ / "Hummlist Premium is unlocked for your whole household. Thank you!"
- Refund link at the bottom: „Doppelt gekauft? So bekommst du dein Geld zurück“ / "Bought it twice? How to get your money back" (title „Kauf zurückfordern“ / "Request a refund").
- Route `/more/lifetime`, reachable only signed in and in a household.

## Driving it with Playwright

Preconditions:

- Seeded household „Familie Brandt“, signed in. A second view of the database is needed to grant Premium: the e2e helpers play RevenueCat's webhook (`e2e/tests/iap.ts`: `buy(email, transactionId)` grants Lifetime, `householdOf(email)`; the promotional grant is `promote(householdId)` in `e2e/tests/integration-lock.spec.ts`).
- Specs: `e2e/tests/purchases.spec.ts`, `e2e/tests/premium-yearly.spec.ts`, `e2e/tests/integration-lock.spec.ts`; run with `scripts/verify.sh --only e2e -- tests/purchases.spec.ts`.

- **Open the row.** `await openTab(page, 'Mehr')`; `page.getByRole('button', { name: /^Hummlist Premium/ })` contains „Siri, Alexa und KI-Assistenten“ for a household without Premium.
- **Open the page.** Click that button. URL `/more/lifetime`. On web: `page.getByText(/^Hummlist Premium kaufst du in der iPhone- oder Android-App\./)` is visible; `page.getByRole('button', { name: 'Kauf wiederherstellen' })` has count 0; no button „Jährlich abschließen“ / „Lifetime kaufen“ (count 0).
- **English.** Locale en-US: `getByText(/^You can buy Hummlist Premium in the iPhone or Android app\./)`, no button 'Restore purchase'.
- **Granted household (testers).** Grant the household through the webhook helper, then the row reads „Freigeschaltet“ (`toContainText('Freigeschaltet')`, live, without reload), and the page shows `page.getByText(/^Hummlist Premium (Lifetime|aktiv|über|geschenkt)/)`. A promotional grant shows „Hummlist Premium geschenkt“.
- **Nothing gated.** A household without Premium can still add via Siri/MCP/Alexa (see `siri`, `ai-assistants`, `alexa` maps); Zugänge shows no Premium card.

## Gotchas

- Production builds do not set the purchases define, the integration-lock define or the fake store (`app/config/auth.json`), and the server switches `premium_offer` and `integration_lock` are off. Anything about plans, prices, cards or the locked state is unreachable for a normal user.
- The e2e build (`app/config/e2e.json`) turns `INTEGRATION_LOCK` on; with the server switch also on, Zugänge shows the Premium card, tokens show „Pausiert: braucht Hummlist Premium“ and Siri/MCP/Alexa answer that the household needs Premium. That is a test of shipped-but-dormant code, not today's product. The e2e web build still never sells (web is `PurchasesUnsupported`).
- The Mehr row hint „Siri, Alexa und KI-Assistenten“ is flagged in the ARB as a placeholder for Hummlist Launch copy; it shows today for every household without Premium although nothing is sold.
- The refund link shows on the page even though nothing is sold.
- Testers get Premium by a RevenueCat promotional grant for their household (made by the team in RevenueCat, no code); the old tester list is gone. The page shows the gift line, not Lifetime. The grant takes effect through RevenueCat's webhook; RevenueCat unreachable means a retry later.
- Words in this feature for copy: „Hummlist Premium“ is the name; yearly and Lifetime are the planned plans but are not on sale. Do not announce a price.
- `paywall_viewed` (entry points `more`, `integrations`) fires only when a plan with a store price is shown, so never in production today; it is also subject to analytics consent. unverified in a live run (read from code only).
- Real store purchases cannot be driven on the box (no store). unverified (no store sandbox).
