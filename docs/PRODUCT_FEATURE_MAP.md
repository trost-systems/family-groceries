# Snacklist product feature map

Living catalogue of what Snacklist has, is building, is considering, and has dropped.

This file is the **repository home** (canonical source). The [living Page](https://cursor.com/canvas/store-1bba9ee2-e28e-47ad-a6b5-ea80faa6498b/1ee9370d-3e32-4854-bc33-cb4729a84b14) is a navigation view of the same catalogue. [Nexus](https://nexus.snacklist.app) links both from its header ("Feature map", "Living view"). Keep the Page and this file in sync.

This is **not** the code-backed inventory of shipped behavior. That inventory lives in [FEATURE_MAP.md](FEATURE_MAP.md) and `.cursor/skills/verify-snacklist/features/`. Do not mix the two, and do not rename those inventory files to match these slugs.

Use **human-readable names**, with stable kebab-case **slugs** where a handle is needed. Do not use letter-and-number codes (F27, UA1, and so on) in new writing. A compact legacy mapping is at the end for historical traceability only. It is not a second code set to learn.

Statuses below were checked against `origin/main` at `3119516d` (11 Nov 2026, 01:24 Europe/Berlin). Only “Built” if the code exists. Product decisions in this revision: 11 Nov 2026, 07:23–07:25 Europe/Berlin. Approved work that is not in the tree is marked **pending implementation**. (?) marks judgment or unverified wording. Not legal advice.

## Now and what blocks sales

| | |
| --- | --- |
| Built and live | 12: list, categories, aisle layout, app and web, Alexa, widgets, multi-household, dictation, Siri, no ads, item icons, usuals |
| Built, gated off | 2: MCP and the public API |
| Planned (decided) | 6: prices and trip total, user photos, barcode scan-to-add, catalog photos, last-price memory, shelf-label scanning |
| Considering | 7: spend history, arrival reminders, themes, recipe to list, watch glance, receipt scanning, planned vs bought |
| Blocks sales | **Prices and trip total** must exist first. Shelf-label scanning must not delay sales (11 Nov 2026). |
| Yearly / lifetime | €9.99 / €39.99. No weekly plan. |

Nothing is sold today (`REVENUECAT_PURCHASES` and `premium_offer` are off; products are not submitted).

**Sales stay off until prices and trip total ship.** Shelf-label scanning ships later when it is ready and must not delay sales (Peter, 11 Nov 2026 07:23 Europe/Berlin). This supersedes the earlier hold that also waited on shelf-label scanning. Before the first sale, also implement per-user Premium (RevenueCat App User ID = the Snacklist user id, not the household UUID), change the Lifetime store price from €29.99 in code to €39.99, treat Siri as free in the integration gate and paywall copy (the lock still lists Siri), and raise the household cap to the approved 20 per user for both Free and Premium (the code stops a user at 10 today). Day-one rule: sell only what exists.

Per-user Premium: one person buys. Peter was leaning toward shared views (prices, trip total, last-price hints, photos) unlocking in the households the buyer belongs to, following the buyer if they leave (**leaning, not a firm approval**). Seat tools (entering a price, scanning a shelf label, taking a photo, API/MCP) stay on the buyer’s device. On lapse, entered prices stay visible read-only. Barcode scan-to-add is a free taste of 5 scans a day; unlimited scan, prices, shelf-label scanning, own photos and the API/MCP are Premium. Siri is free, like Alexa. MCP and the public API stay Premium. A user may belong to at most 20 households, Free or Premium (approved 11 Nov 2026; enforced since job 200).

## Decisions in force

| Decision | Slug | Status |
| --- | --- | --- |
| Per-user Premium. RevenueCat App User ID = Snacklist user id. | `per-user-premium` | Approved, not in code yet (still the household UUID). |
| Shared views in every household the buyer belongs to, tighten only on heavy abuse. | `shared-views` | **Leaning, not a firm approval.** `household-limit` does not settle every shared-views detail. |
| On lapse, prices and the last total stay read-only. Nothing is deleted. | `prices-remain-on-lapse` | Approved. |
| Product images: icons (already built) → Open Food Facts name and photo on a barcode scan → user photos. | `product-images` | Approved direction. |
| No sales until prices and trip total exist. Shelf-label scanning remains planned and ships later when ready; it must not delay sales. | `sales-prerequisite` | Approved 11 Nov 2026 07:23 Europe/Berlin. Supersedes the earlier hold that also waited on shelf-label scanning. |
| No weekly tier. Yearly €9.99. Lifetime €39.99. Five free barcode scans a day. | `yearly-plan`, `lifetime-plan`, `five-free-scans` | Approved. Code and some docs still say Lifetime €29.99; do not change store prices in the docs change that lands this file. |
| A user may belong to at most 20 households, on both Free and Premium. | `household-limit` | Approved 11 Nov 2026. **Implemented** (job 200): the membership code caps a user at 20 households (`public.household_cap()`); the paywall does not mention a cap yet (job 187). This is a per-user membership cap, not only a Premium shared-view cap. Peter’s answer labelled Q157 was this cap, not a receipt-scanning decision. |
| Cloud receipt scanning uses Vertex AI `gemini-3.5-flash` in `europe-west3` under Google Cloud EMEA Ltd's CDPA (Peter's U2B / Legal option R1, 11 Nov 2026). | `receipt-scanning` | Decision recorded 11 Nov 2026, 21:39 and 21:51 Europe/Berlin. **Approved for docs only; no build yet; no real receipts until N-135..N-144 met; policy/in-app text needs Peter's approval.** Artifact: [legal/reviews/2026-11-11-snacklist-n127-cloud-ocr.md](legal/reviews/2026-11-11-snacklist-n127-cloud-ocr.md). Do not confuse Legal option R1 (Vertex) with the dropped legacy slug `on-device-receipt-ocr` (legacy ID R1). |
| Siri is free. MCP and the public API stay Premium. | `siri`, `mcp`, `public-api` | Approved. |

Dropped: public price-insight posts (including Destatis); on-device receipt OCR; weekly auto-renew and the 7-day pass.

## Cost overview

Figures are rough, in Europe/Berlin terms, and marked (?) where judged. Store cut is 15–30% depending on programme, so a €9.99 year nets about €6.99–8.49 before VAT effects. Lifetime at €39.99 is a value choice (four years of yearly), not a storage-cost one.

| Item | Build (guess) | Running cost per paying user / year | Note |
| --- | --- | --- | --- |
| Free core (list, categories, aisle layout, app and web, Alexa, widgets, multi-household, dictation, item icons, usuals) | Already built | Hosting only | No LLM, no paid catalogue |
| Barcode scan-to-add + catalog photos | 1–2 weeks (?) | Free (Open Food Facts rate limits: 15 reads / 10 searches per IP per minute) | Cache by EAN; attribution in the UI |
| User photos | 1–2 weeks + a storage cap (?) | Storage cost depends on cap and usage; not a reason to raise Lifetime | Cap storage. Earlier storage figures are unverified estimates. |
| Prices, trip total and last-price memory | 1–2 weeks (?) | Negligible (our database) | Prices and trip total block sales; shelf-label scanning does not |
| Shelf-label scanning | 2.5–4 weeks, both platforms (?) | None (on-device Apple Vision / ML Kit) | User confirms; never silent-write. Ships later; must not delay sales. |
| Receipt scanning (candidate) | About 2–3 weeks plus Legal path (?) | Vendor and model recorded (Vertex AI `gemini-3.5-flash` in `europe-west3`); per-use cost not approved as a figure to ship | Path decided for docs only (U2B / Legal option R1, 11 Nov 2026). No build yet. No real receipts until N-135 to N-144 are met. No terms signed without Peter. |
| Public API and MCP | Built; extensions later | Rate limits already in v1; photo upload would share the user-photos cap | Sell only after prices and trip total if advertised; shelf-label scanning is not a sales gate |

## Legal flags

**Household limit approved: 20 per user, Free and Premium, in code since job 200.** Peter approved a maximum of 20 households per user for both Free and Premium (11 Nov 2026; he labelled this Q157). That should be plenty of room and limit abuse. This is a membership cap, not only a Premium shared-view cap. The code caps every user at 20 since job 200 (it was 10 from job 173); no user was above 10 when it changed. Legal Review (10 Nov 2026) had asked for a numbered cap to be visible on the paywall and in the terms before purchase, and had assumed free joining would stay uncapped with the cap only on Premium shared views. Peter’s number applies to both tiers. Record it on the paywall and in the terms when implemented; do not treat “every household” as firm paywall copy (shared views was a lean, not a firm approval). Not legal advice; Legal still reviews the wording.

- Manage or cancel subscription: already built in the Premium screen, labelled “Abo verwalten oder kündigen”. Legal still requires this to be permanent, to open the store page, and to sit next to clear paywall text on price, period and auto-renew before the yearly plan is sold. Do not add a Snacklist “Verträge hier kündigen” button while sales are store-only.
- Fair-use terms: Legal’s draft can use N = 20, in “du”, but the approved rule is a 20-household membership cap per user on both Free and Premium, not only a Premium shared-view cap. The older paid-terms draft that says Premium belongs to one household is stale and must be rewritten before sale. Do not publish terms in the change that lands this file.
- Receipt scanning path recorded as U2B / Legal option R1 (11 Nov 2026, 21:39 and 21:51 Europe/Berlin): Vertex AI `gemini-3.5-flash` in `europe-west3` under Google Cloud EMEA Ltd's CDPA. **Approved for docs only; no build yet; no real receipts until N-135 to N-144 are met; policy and in-app text need Peter's approval before they go live.** Conditions include a signed Art. 28 DPA (Peter accepts the terms himself), a Frankfurt-pinned server function, no training, immediate or zero retention (hard ceiling 24 h), server-side stripping of payment, loyalty, cashier, address, time and receipt/TSE numbers, grocery-only with pharmacy discard and Art. 9(2)(a) consent, a one-time permission screen, and policy/store-label updates in the same release. Artifact: [legal/reviews/2026-11-11-snacklist-n127-cloud-ocr.md](legal/reviews/2026-11-11-snacklist-n127-cloud-ocr.md). Not legal advice; no terms signed without Peter.
- Price-insight posts are dropped, so Legal’s Destatis vs user-data-posts question is closed unless Peter re-opens it.

## Built and live

These run for every household today. Hormozi impact is from the 10 Nov 2026 value report: D×L of 12 or more can lead a pitch; the index is (D×L) / ((6−T)×(6−E)).

| Name | Slug | What it is / example | Tier | Impact | Cost | Deps / decisions |
| --- | --- | --- | --- | --- | --- | --- |
| List and live sync | `list-and-live-sync` | Shared list that updates for everyone. Example: Anna adds Milch; Ben sees it on his phone at once. | Free | D×L 25, index 25 | Already built | Core |
| Categories | `categories` | Items land in a category. Example: Milch goes under Chilled. | Free | D×L 15, index 15 | Already built | Core |
| Aisle / store layout | `aisle-layout` | List follows the store, including learned item→store memory. Example: at Rewe, Milch appears in the dairy stretch of the walk. | Free | D×L 20, index 5.0 | Already built | Core, coverage grows with use |
| App and web | `app-and-web` | iOS, Android and the web app. Example: Anna is in the aisle; Ben adds from the laptop. | Free | D×L 20, index 10 | Already built | Core |
| Alexa | `alexa` | Add and read by voice on Echo. Example: “Alexa, add butter to Snacklist.” | Free (legal) | D×L 16, index 2.7 | Already built; stays free | Stays free by legal and product decision. |
| Home-screen widgets | `home-screen-widgets` | Glance the list without opening the app. | Free, ungated | D×L 15, index 7.5 | Already built | No Premium gating. |
| Multi-household | `multi-household` | Create, join and switch households. Example: Anna is in Home and Parents. Approved cap (`household-limit`, enforced since job 200): a user may belong to at most 20 households, Free or Premium. | Free (cap applies to both tiers) | D×L 15, index 7.5 | Already built; cap of 20 enforced (job 200) | `household-limit`, 11 Nov 2026. The code caps a user at 20 households (job 200). |
| On-device dictation and parse | `dictation` | Speak a line; the app splits quantity, brand and properties (`parse_item`). Example: “Zwei Packungen Barilla Spaghetti” becomes qty 2, brand Barilla. Offline German is required on the device. | Free | D×L 12, index 12 | Already built (`speech_to_text` onDevice, `addSpoken`) | Brand is parsed for free. No Premium split on brand. |
| Siri | `siri` | Add and read via Shortcut or native Siri on iPhone, without opening the app. | Free (decided) | D×L 16, index 2.7 | Already built and live (lock is off) | Before turning `integration_lock` on: treat Siri like Alexa in the gate, and drop Siri from paywall copy (it still says Siri is Premium). |
| No ads | `no-ads` | The free app does not show ads. There is no ad SDK in the tree. | Free (a promise, not a paid item) | Index 15 only if ads existed to remove | None | Do not sell “ad-free” |
| Item icons | `item-icons` | Bundled emoji icons from a keyword table, with a remote refresh. Example: Milch shows a milk carton. | Free (first `product-images` layer) | D×L 10, index 10 (bonus) | Already built (`item_icons` + remote JSON) | `product-images` |
| Usuals and “Need these again?” | `usuals` | Suggestions from household history, and a due row for staples. Example: the add sheet offers Milch because the household buys it often. | Free | D×L 16, index 8.0 | Already built (`suggest_items`, `dueSuggestions`) | A weekday-prediction Premium slice is not planned unless usage shows a gap. |

## Built, gated off

The code exists and works when switches are on, but sales and the integration lock are off, so everyone can use these today. They become Premium only when the lock and the offer are turned on: after prices and trip total, and after the Siri-free gate change. Shelf-label scanning is not a sales gate.

| Name | Slug | What it is / example | Tier | Impact | Cost | Deps / decisions |
| --- | --- | --- | --- | --- | --- | --- |
| MCP / AI assistants | `mcp` | Connect an MCP client to list, add, tick and move. Example: a developer’s assistant ticks Milch after the shop. Discovery stays free; `tools/call` is the lock. | Premium | D×L 6, index 0.5 (niche) | Already built; no running model cost | `integration_lock`; extensions (prices, EAN, photos) wait for `prices-and-trip-total`, `barcode-scan-to-add` and `user-photos` |
| Public REST API | `public-api` | Personal household-bound keys: items, categories, stores, lists. Example: a kitchen display polls open items. `public_api` is seeded false. | Premium | D×L 8, index 0.7 (niche) | Already built; rate limits in v1 | Under `per-user-premium` the Premium check should follow the key creator, not the household. Confirm before switch-on. Later extensions (PATCH name, prices, EAN, image upload, webhooks, changes feed, OAuth, api.snacklist.app) are not in v1. |

Paywall, RevenueCat and “Abo verwalten oder kündigen” are also built and gated off. Lifetime in `store_prices.dart` and `PURCHASES.md` is still €29.99. App User ID is still the household UUID.

## Planned (decided)

Decided, not in the tree at `3119516d`. Prices and trip total block sales. Shelf-label scanning remains planned and ships later when ready; it must not delay sales (11 Nov 2026). Others can follow in the same burst or just after, but must not be advertised before they exist.

| Name | Slug | What it is / example | Tier | Impact | Cost | Deps / decisions |
| --- | --- | --- | --- | --- | --- | --- |
| Prices and trip total | `prices-and-trip-total` | Type or confirm a price on an item; see a running total. Example: Anna enters €1.19 on Milch; Ben may see the total if shared views are offered in that household (`shared-views` is a lean, not a firm approval). | Premium (shared view if `shared-views` is confirmed) | D×L 16, index 2.7 typed, 4.0 with shelf-label scanning | 1–2 weeks (?); storage negligible | Sales prerequisite (the earlier shelf-label hold is superseded). `prices-remain-on-lapse`. `household-limit` enforced. No price column exists on items today. |
| Shelf-label scanning | `shelf-label-scanning` | On-device OCR of a German shelf label; user confirms the selling price, not the Grundpreis. Example: Anna points the camera at the Milch tag, taps €1.19. | Premium (seat tool) | D×L 16, index 4.0 | 2.5–4 weeks, both platforms (?); no cloud cost | Planned, but not a sales gate (11 Nov 2026). Ships later when ready. On-device Apple Vision / ML Kit. No silent write. No camera or ML Kit dependency in the app yet. |
| Barcode scan-to-add | `barcode-scan-to-add` | Scan a pack to add the item. Example: at home, Ben scans the empty Milch carton; the name appears. After 5 scans that day, typing stays free; more scans need Premium. | Free taste (`five-free-scans`: 5/day) + Premium unlimited | Taste D×L 12, index 6.0; paid slice index 4.0 | 1–2 weeks with `catalog-photos` (?) | `five-free-scans`. No barcode package in the app yet. |
| Catalog photo (Open Food Facts) | `catalog-photos` | A successful barcode add can show the Open Food Facts pack photo, with attribution. Example: the scanned Milch carton shows the brand pack shot. | Free on a free or Premium scan (`product-images`) | D×L 9, index 2.25 | Open Food Facts is free; 15 reads/min per IP | Needs `barcode-scan-to-add`. Legal check of ODbL / CC BY-SA still open. US fallback (USDA names only) only after measuring misses. |
| User photos | `user-photos` | Attach your own photo to an item. Example: Anna photographs the exact yogurt so Ben does not buy the wrong one. | Premium (shared view once added) | D×L 20, index 3.3 | 1–2 weeks + storage cap. Earlier yearly storage figures are unverified estimates. | `product-images`. No item photo column yet. |
| Last-price memory | `last-price-memory` | Prefill “last time this was €1.19” at this store; the user confirms. Example: next week the Milch row already shows last week’s price. | Premium (shared view) | D×L 12, index 2.0 | Small, ships with `prices-and-trip-total` | Needs `prices-and-trip-total`. Not a third-party price feed. |

## Considering

Not decided for a build slot. Strict: none of these are in the code. Receipt scanning's vendor path is recorded (U2B / Legal option R1) but is not approved to build.

| Name | Slug | What it is / example | Tier | Impact | Cost | Deps / decisions |
| --- | --- | --- | --- | --- | --- | --- |
| Receipt scanning (cloud LLM) | `receipt-scanning` | Photograph a German grocery receipt; match lines to ticked items; store confirmed prices; later graphs. Example: Anna scans the Rewe receipt, confirms “H-MILCH 3,5% ↔ Milch, €1.19”, and later sees Milch over time. On-device receipt OCR is dropped. Path: Vertex AI `gemini-3.5-flash` in `europe-west3` under Google Cloud EMEA Ltd's CDPA (U2B / Legal option R1). | Premium (later, after prices, spend history, and related features) | Shopper D×L 12, index 1.33; cost-tracker D×L 15, index 1.67 | Build ~2–3 weeks plus Legal path (?). Vendor and region recorded; per-use cost is an estimate only. | Decision recorded 11 Nov 2026, 21:39 and 21:51 Europe/Berlin. **Approved for docs only; no build yet; no real receipts until N-135..N-144 met; policy/in-app text needs Peter's approval.** Artifact: [legal/reviews/2026-11-11-snacklist-n127-cloud-ocr.md](legal/reviews/2026-11-11-snacklist-n127-cloud-ocr.md). No terms signed without Peter. |
| Planned vs bought (candidate) | `planned-vs-bought` | After a trip, compare what was on the list with what the receipt says was bought, for people who want less impulse buying or simply more awareness of spending. Compares a snapshot of the list taken when shopping starts, not the list as edited later, against confirmed receipt purchases. Example: the list had milk and bread; the receipt shows milk, bread and snacks, so snacks show as unplanned, with their price as unplanned spend when prices are available. | Not decided | Qualitative: spending awareness. Not scored. | Not estimated yet | Builds on `receipt-scanning` plus matching purchases to list items. Idea recorded 11 Nov 2026 08:09 Europe/Berlin; not an approved build and not a launch or sales prerequisite. Neutral wording: no health or moral judgments about what was bought. Examples use made-up data, never real user data. Prototypes (job 196, 12 Nov 2026): five approaches in [design/planned-vs-bought/](design/planned-vs-bought/), compared against ticked or logged purchases with a receipt only as an optional later input; recommended `trip-review-unplanned`, waiting for Peter's pick (job 197). |
| Spend history and graphs | `spend-history` | Prices over time, spend per trip or month. Example: “We spent €87 at Rewe this month.” | Premium | D×L 12, index 0.8 (slow payoff) | Build after `prices-and-trip-total`; storage small | Needed if `receipt-scanning` shows graphs. Weeks of use before it feels valuable. |
| Arrival reminders | `arrival-reminders` | A nudge when you arrive at the store. Example: “You are at Rewe, 4 items open.” | Premium | D×L 12, index 2.0 | 1–2 weeks (?); no cloud | Location permission. Only helps people who sometimes shop. |
| Themes | `themes` | A different look for the list. | Premium (bonus) | D×L 10, index 5.0 | Cheap if designed | Does not lead a pitch. |
| Recipe to list | `recipe-to-list` | Paste or photograph a recipe; ingredients become items. | Premium, later | D×L 16, index 1.8 | 2–4 weeks (?) | Fits a family list, but parsing is messy. Not day one. |
| Watch glance | `watch-glance` | The list on a watch. Paywall copy already mentions Apple Watch as later, not built. No watch target in the tree. | Free-leaning when built (earlier lean) | D×L 12, index 3.0 | A real watch app, not a small job | Do not advertise until it exists. |

Receipt scanning's path is recorded (U2B / Legal option R1, 11 Nov 2026): Vertex AI `gemini-3.5-flash` in `europe-west3` under Google Cloud EMEA Ltd's CDPA. It is approved for docs only; there is no build approval; no real receipts until N-135 to N-144 are met; policy and in-app text still need Peter's approval. Not legal advice; no vendor terms signed without Peter.

## Dropped

Closed. Do not plan work here unless Peter re-opens it. Price-insight posts and on-device receipt OCR were dropped on 10 Nov 2026. Weekly billing was rejected with the yearly-plan decision.

| Name | Slug | Why it is closed |
| --- | --- | --- |
| Public price-insight posts (including Destatis-only posts) | `public-price-insights` | Peter dropped price insights. Legal had also said not to use user prices for posts without a separate opt-in, and not to treat aggregates as anonymous. |
| On-device receipt OCR | `on-device-receipt-ocr` | Peter dropped this approach. Receipt scanning, if built, is a cloud LLM path, not on-device parsing of the whole receipt. |
| Weekly auto-renew and 7-day pass | `weekly-billing` | No short-term tier at launch. Weekly auto-renew looks like a dark pattern. A 7-day pass would need custom expiry on iOS (exception to “use RevenueCat as intended”). |
| Open Prices hint | `open-prices-hint` | No reliable German shelf-price feed; already not recommended. |
| Store offers / loyalty cards | `store-offers` | Does not fit a family grocery list: running data-licence costs, and it is a flyer product. Keep out of Lifetime. |
| AI meal plan | `ai-meal-plan` | Does not fit positioning (“do not lead with unasked-for AI”). Running cost; keep out of Lifetime. |
| Pantry-photo suggestions | `pantry-photo-suggestions` | Unasked-for cloud vision; weak Hormozi score (index 0.44). Does not fit. |

## Open decisions

Already answered and not re-asked: `yearly-plan`, `lifetime-plan`, `five-free-scans`, drop `public-price-insights`, drop `on-device-receipt-ocr`, Siri free, `prices-and-trip-total` is Premium, `per-user-premium`, `prices-remain-on-lapse`, `product-images`, `household-limit` (Peter’s 11 Nov answer labelled Q157 was this cap, not a receipt-scanning decision), `sales-prerequisite` (shelf-label scanning must not gate sales; prices and trip total remain the prerequisite), `receipt-scanning` path (U2B / Legal option R1, recorded 11 Nov 2026 21:39 and 21:51 Europe/Berlin; docs only). `shared-views` was a lean, not a firm approval.

1. **Receipt scanning build and conditions** (path recorded, not approved to build). Vendor path is U2B / Legal option R1: Vertex AI `gemini-3.5-flash` in `europe-west3` under Google Cloud EMEA Ltd's CDPA. Status: approved for docs only; no build yet; no real receipts until N-135 to N-144 are met; policy and in-app text need Peter's approval. No terms signed without Peter.
2. **Public API extensions** after prices and trip total: still PATCH name/quantity/brand and api.snacklist.app first, then prices, barcode and image upload, then a changes feed, webhooks and OAuth? Shelf-label scanning is not a sales gate.
3. **US barcode fallback:** only after measuring Open Food Facts miss rate on real scans, then USDA FoodData Central for names only (no pack photos)?
4. **Fair-use terms:** send Legal’s draft (EN + DE, with N = 20, “du”) as the terms and paywall line, adjusted to a 20-household membership cap per user on both Free and Premium, and rewrite the stale “one household” paid-terms section before sale? Do not publish in the change that lands this file.
5. **Next considering feature** after prices and trip total: user photos (needed for a fuller `product-images` day-one story), spend history, arrival reminders, or receipt scanning (path recorded, not approved to build)? Shelf-label scanning ships later when ready and does not gate this choice or sales.

## Legacy IDs

Older notes used letter-and-number codes. They are kept here only so earlier chats, reviews and memos can be traced. Use the names and slugs above in new work; do not learn this as a second code set. The code-backed inventory of shipped behavior (verify-snacklist feature files) is separate and is not renamed by this map.

| Legacy ID | Slug | Name |
| --- | --- | --- |
| F1 | `list-and-live-sync` | List and live sync |
| F2 | `categories` | Categories |
| F3 | `aisle-layout` | Aisle / store layout |
| F4 | `app-and-web` | App and web |
| F5 | `alexa` | Alexa |
| F6 | `home-screen-widgets` | Home-screen widgets |
| F7 | `multi-household` | Multi-household |
| F8 | `dictation` | On-device dictation and parse |
| F9 | `siri` | Siri |
| F10 | `mcp` | MCP / AI assistants |
| F11 | `public-api` | Public REST API |
| F12 | `prices-and-trip-total` | Prices and trip total |
| F13 | `spend-history` | Spend history and graphs |
| F14 | `arrival-reminders` | Arrival reminders |
| F15 | `user-photos` | User photos |
| F16 | `themes` | Themes |
| F17 | `recipe-to-list` | Recipe to list |
| F18 | `no-ads` | No ads |
| F19 | `barcode-scan-to-add` | Barcode scan-to-add |
| F20 | `watch-glance` | Watch glance |
| F21 | `store-offers` | Store offers / loyalty cards (dropped) |
| F22 | `ai-meal-plan` | AI meal plan (dropped) |
| F23 | `catalog-photos` | Catalog photo (Open Food Facts) |
| F24 | `item-icons` | Item icons |
| F25 | `last-price-memory` | Last-price memory |
| F26 | `open-prices-hint` | Open Prices hint (dropped) |
| F27 | `shelf-label-scanning` | Shelf-label scanning |
| F28 | `receipt-scanning` | Receipt scanning |
| F29 | `usuals` | Usuals and “Need these again?” |
| UA1 | `per-user-premium` | Per-user Premium |
| PB2 | `shared-views` | Shared views (leaning, not firm) |
| LP1 | `prices-remain-on-lapse` | Prices remain on lapse |
| IM1 | `product-images` | Product images |
| LA1 | `sales-prerequisite` | Sales prerequisite (shelf-label hold superseded 11 Nov 2026) |
| PR1 | `yearly-plan` | Yearly plan, no weekly tier |
| LT1 | `lifetime-plan` | Lifetime plan |
| SC1 | `five-free-scans` | Five free barcode scans a day |
| HH20 / Q157 cap | `household-limit` | Household limit (20 per user, both tiers) |
| PI* | `public-price-insights` | Public price-insight posts (dropped) |
| R1 | `on-device-receipt-ocr` | On-device receipt OCR (dropped) |
| PR2 / PR3 | `weekly-billing` | Weekly auto-renew and 7-day pass (dropped) |
| C7 | `pantry-photo-suggestions` | Pantry-photo suggestions (dropped) |

## Sources and method

- Code check: `origin/main` `3119516d`, 11 Nov 2026 01:24 Europe/Berlin.
- Decisions in this revision: 11 Nov 2026 07:23–07:25 Europe/Berlin (`household-limit`, `sales-prerequisite`, topic slugs); 11 Nov 2026 21:39 and 21:51 Europe/Berlin (`receipt-scanning` U2B / Legal option R1, docs only).
- Legal background: Legal Review's Premium review of 10 Nov 2026 (`reviews/2026-11-10-snacklist-premium.md`, not in this repo). N-127 cloud receipt scanning review and Addendum A: [legal/reviews/2026-11-11-snacklist-n127-cloud-ocr.md](legal/reviews/2026-11-11-snacklist-n127-cloud-ocr.md) (in this repo). The path is recorded; it is not a build approval.
- Hormozi scores from the 10 Nov 2026 value and follow-up reports.
- Living view: https://cursor.com/canvas/store-1bba9ee2-e28e-47ad-a6b5-ea80faa6498b/1ee9370d-3e32-4854-bc33-cb4729a84b14
- Nexus: https://nexus.snacklist.app
- Code-backed inventory: [FEATURE_MAP.md](FEATURE_MAP.md)

Not legal advice. Product name: Snacklist.
