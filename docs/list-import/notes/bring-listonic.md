# Import sources: Bring! and Listonic

Read-only web research, 2026-11-11. Each claim has a source. Anything I could not confirm is marked
UNVERIFIED. Help pages at help.listonic.com failed TLS verification on fetch, so Listonic help claims
come from search-result snippets of those pages.

## Bring! (Bring! Labs AG, Zurich)

### Export routes
- **"Send list" (OS share sheet):** list > "..." top right > "Send list" ("Liste senden"). On iPhone the
  same sheet offers "Save to Files". On Android: list menu > "Print list" > "Save as PDF". Both work in
  the app only. Source: Help Center "Items & Lists",
  https://getbring.com/help-center-main-categories/items-lists
  - **Format of the sent text: UNVERIFIED.** No help page, forum post or screenshot transcript quoting
    the text turned up (searched DE/EN, "Liste senden", "Sent from Bring"). The header line, the bullet
    character and how the spec is rendered (e.g. "Milch (2 Liter)" vs "Milch, 2 Liter") are unknown.
    Get a real sample from a device before building a parser.
- **Copy to clipboard / CSV / JSON export:** none documented. The help center lists no such article
  (same URL). Third-party advice to move lists *into* Bring! says to paste text separated by commas or
  newlines, which suggests Bring! itself parses pasted lists:
  https://www.antwort.net/a/technologie/wie-kann-ich-eine-app-liste-in-bring-importieren.html
  (low-authority site).
- **Templates ("Inspiration" > "+"):** saves a list for reuse inside Bring!. This is not an export.
  https://getbring.com/help-center-main-categories/items-lists
- **GDPR access/portability:** the privacy policy grants EU users the right to "demand the transfer of
  your personal data", by email to feedback@bringlabs.com. It names no format and no self-service
  download. https://getbring.com/en/legal/privacy.html
- **Official public API:** none. A third-party connector says Bring! has no public API and that it uses
  the undocumented web-app API: https://gladysassistant.com/docs/integrations/external/bring/
- **Unofficial API:**
  - `bring-api` (miaucl), async Python, MIT, "not endorsed by or affiliated with Bring! Labs AG". It
    signs in with **email + password** (`Bring(session, MAIL, PASSWORD)`), then calls `load_lists`,
    `get_list`, `batch_update_list` and others. It is derived from eliasball's `python-bring-api`, which
    ports foxriver76's `node-bring-api`. https://github.com/miaucl/bring-api ,
    https://pypi.org/project/bring-api/ , https://pypi.org/project/python-bring-api/
  - **Home Assistant core integration "Bring!"** (since HA 2024.2, Platinum quality scale, cloud
    polling every 90 s) is built on it. Apple, Google and Facebook sign-up accounts must first set a
    password in the app (Profile settings) or on the web reset page.
    https://www.home-assistant.io/integrations/bring/
  - ioBroker has a Bring adapter: https://forum.iobroker.net/topic/19840/aufruf-bring-adapter/12?page=18
- **Web app:** web.getbring.com. Sign-in by email + password. Users who signed up with an Apple ID get a
  generated email address, shown under Profile, and must set a password first.
  https://getbring.com/help-center-main-categories/further-devices
- **Voice and OS:**
  - **Siri:** adds items, reads the list out ("what's on my shopping list in Bring!") and marks items
    done. Shortcuts are documented for adding only.
    https://getbring.com/help-center-main-categories/voice-assistants
  - **Alexa:** list sync ended 1 July 2024, when Amazon retired its list API. Only "Alexa, open Bring!
    and add ..." still works. Same page, plus
    https://www.digitec.ch/en/page/alexa-amazon-makes-life-difficult-for-suppliers-like-bring-33803
  - **Google Assistant:** dropped on 20 June 2023, when Google ended support for third-party list apps.
    https://getbring.com/blog-posts/google-assistant-no-more-support-for-third-party-list-apps
  - **Apple Reminders sync:** none found (UNVERIFIED absence).
  - **Watch apps:** Apple Watch and Android Wear. Widgets are not mentioned on the help pages.
    https://getbring.com/help-center-main-categories/further-devices

### Data per route
- **Unofficial API** (types in `bring_api/types.py`,
  https://raw.githubusercontent.com/miaucl/bring-api/main/bring_api/types.py):
  - Lists carry `listUuid`, `name` and `theme`.
  - Items arrive in two arrays: `purchase` (to buy) and `recently` (recently used, i.e. checked off).
    Each entry has `uuid`, `itemId` (the name, often a German catalogue key), `specification` (free
    text such as "2 kg" or "low fat") and `attributes`. Attributes carry the flags
    urgent/convenient/discounted, `newItemSection` and `newItemIcon`.
  - Item details add `userSectionId`, `userIconItemId`, `assignedTo` and `imageUrl` (the user's
    photo).
  - List members (`BringUser`) carry name, email, `photoPath`, country and language. User settings
    hold section order and catalogue language as generic key/value pairs. There is also an activity
    timeline.
  - Quantity is not a separate field; it lives inside `specification`. The help page shows typing
    "2 kg apples" into search to add item and quantity in one step.
    https://getbring.com/help-center-main-categories/items-lists
- **Bring! fields with no counterpart elsewhere:** a catalogue item name in the list's language
  (`itemId`) can differ from the label the user sees. Translating it needs Bring!'s locale catalogue;
  the library has a `prepare_locales_catalog.py` script for this (UNVERIFIED how complete).
- **Send list / PDF:** content UNVERIFIED (see above). The PDF route, a print rendering, is useless for
  machine import.
- **Prices and shops:** prices can only go into the description, and Bring! does not total them. Shops
  are not item fields. https://getbring.com/help-center-main-categories/items-lists

### Auth / ToS
- The terms of use (effective 18 May 2018) contain **no** clause on automated access, scraping, reverse
  engineering or APIs. Bring! Labs reserves the right to exclude a user "at any time without stating
  any reasons". https://getbring.com/en/terms-of-use
- The unofficial route needs the user's Bring! **email + password**, and SSO users must first create a
  password. A third-party app handling another service's password is a trust and legal problem for
  Snacklist, even though the ToS does not forbid it.

### Reliability / platforms
- `bring-api` is actively maintained: CI, tests, and it ships with Home Assistant core. It switched to
  the "newer endpoint that the Bring app also uses" for batch updates. Bring! can break it at any
  time; HA reports occasional 502s. https://github.com/miaucl/bring-api ,
  https://www.home-assistant.io/integrations/bring/
- Platforms: iOS, Android, watch apps, and the web app at web.getbring.com. There is no desktop app.
  "Save to Files" exists on iOS only; "Print list" > PDF on Android only.

## Listonic (Listonic Sp. z o.o., Poland)

### Export routes
- **Share button (square with arrow):** the user picks email, text or link, depending on the apps
  installed. A text recipient "will see the list but will not be able to edit it". The user must be
  logged in. https://help.listonic.com/en/26496634-Can-I-send-a-list-via-text-message-link-or-email-
  (snippet), https://help.listonic.com/en/5825351-How-do-I-send-a-list-as-an-email-or-a-text-message-
  (snippet)
  - **Link vs. text body: UNVERIFIED.** The marketing pages describe WhatsApp, text message or "copy the
    link". The shared message is therefore likely a link to a list view, possibly with item text.
    https://listonic.com/f/shared-lists , https://fpdev.listonic.com/features/share-lists
  - **No verbatim sample** of a shared message was found.
- **Copy to clipboard / CSV / file export:** none documented. The help center has "How do I copy a
  list?" (likely a duplicate within the app, UNVERIFIED). https://help.listonic.com/en
- **GDPR portability:** the privacy policy grants data "in a structured, commonly used
  machine-readable format" on request, by email (the address is obfuscated on the page). There is no
  self-service download. https://listonic.com/privacy
- **Official public API:** none. A Home Assistant thread (Jan 2024) found only the web app's unofficial
  API. https://community.home-assistant.io/t/new-integration-listonic/667462
- **Unofficial API:**
  - `listonic-mcp` (ArturLys, v0.1.0, 29 Jul 2026, MIT, "Unofficial. Not affiliated with Listonic")
    signs in with **email + password** against `api.listonic.com`, using the public web-app client
    `listonicv2`. https://pypi.org/project/listonic-mcp/ ,
    https://raw.githubusercontent.com/ArturLys/listonic-mcp/main/API.md
  - HA custom component `Sanji78/listonic` (shared Sep 2025) signs in through **Google OAuth** with the
    user's own Google Cloud client. https://github.com/Sanji78/listonic
- **Web app:** https://app.listonic.com , linked from https://listonic.com/f/shared-lists
- **Voice and OS:** no Alexa, Google Assistant, Siri, Wear OS or widget integrations confirmed in this
  pass (UNVERIFIED either way). If Listonic had a Google Assistant list integration, Google's June 2023
  shutdown would have ended it, as it did for Bring! (inference).

### Data per route
- **Unofficial API** (`API.md` above):
  - Lists carry `Id`, `Name`, `Items`, `Active` and `Deleted`. Shares are available via
    `includeShares` and list collaborators' emails.
  - Items carry `Id`, `Name`, `Checked` (1/0), `Amount` (string), `Unit`, `Price` (float),
    `Description` and `CategoryId`. Categories come from `GET /api/categoriesv2`.
  - Quantity and unit are separate fields here, unlike Bring!.
  - The HA thread's scripts confirm `Name`, `Amount`, `Unit` and `Checked`.
    https://community.home-assistant.io/t/new-integration-listonic/667462
- **Share text / link:** content UNVERIFIED.
- **Photos:** the privacy policy lists "lists, texts, notes, and photos" as user content.
  https://listonic.com/privacy

### Auth / ToS
- The terms of service (effective 6 May 2024) are explicit:
  - §7e forbids "reverse engineering, attempting to decipher our Services".
  - §7f forbids "accessing our App using automated or non-human methods, such as bots, scripts ...
    without prior explicit consent", except "authorized access through our API, if applicable and
    granted".
  - So a server-side importer using a user's credentials breaches Listonic's ToS.
  - https://listonic.com/terms-of-service
- Accounts are optional. The app works without one, and accounts mainly serve sync and backup
  (https://listonic.com/?p=2094). Sign-up offers email, Facebook, Google and Apple ID
  (ToS §3, same URL as above). Many lists may therefore sit on a device with no account behind them,
  and those lists cannot be reached through any API.

### Reliability / platforms
- The unofficial clients are young and small (v0.1.0; a single-author HA component). The auth flow
  needs browser-sniffed client headers and token refresh, per the HA thread. Expect breakage.
- Platforms: iOS, Android, and the web app (app.listonic.com).

## German retailer list apps (one line)
- Kaufland's app has a shareable list, and Lidl Plus has a simple list
  (https://www.mobiflip.de/?p=451056 , https://www.inside-digital.de/news/lidl-rewe-kaufland-penny-netto-edeka-apps-prospekt).
  Neither has a documented export or API. Users would bring such lists in by copy and paste, and that
  route is not worth dedicated support.

## Implications for Snacklist import (my read)
1. The only route open to both apps without credentials or ToS risk is **the user sharing or pasting
   text into Snacklist**. Build a tolerant paste parser: one item per line, strip bullets and emoji,
   split off a "(spec)" or ", spec" suffix. Then collect real "Send list" samples from Bring! and
   Listonic on iOS and Android to tune it, because no verbatim format is published.
2. A Bring! API import (email + password, unofficial) is technically mature: HA core uses it, and it
   returns item, spec, section and recently-used data. But Snacklist would be handling Bring!
   passwords, and SSO users have none.
3. A Listonic API import is forbidden by its ToS (§7f) and is technically fragile. Skip it.
4. GDPR Art. 20 requests to either vendor go by email, with no turnaround or format stated. This route
   is too slow for onboarding.
