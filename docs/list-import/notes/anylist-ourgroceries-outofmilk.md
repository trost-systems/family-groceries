# List import research: AnyList, OurGroceries, Out of Milk

Read-only web research, 2026-11-11. Each claim has its source next to it. **UNVERIFIED** marks
anything I could not confirm. The Out of Milk help centre (support.outofmilk.com) returned
HTTP 403 to the fetcher, so its claims come from search-result snippets of those pages.

## AnyList

**German relevance:** The DE App Store listing shows German and English, 655 ratings at 4.8.
Location-based reminders and Watch list access require AnyList Complete.
https://apps.apple.com/de/app/anylist/id522167641. Siri help warns that Siri sometimes misreads
the app name, "especially in non-English languages": https://help.anylist.com/articles/siri/.
Relevance: medium. AnyList has a German UI but is US-centric.

### Export routes
- **Share, Email & Print:** List Actions (•••), then "Share, Email & Print". From there you can
  send the list as an email or text message, or print it.
  https://help.anylist.com/topics/lists/list-sharing, https://help.anylist.com/articles/print-list
- **What the text contains (quantities, categories, notes, checked items):** UNVERIFIED. The help
  pages don't describe the content: https://help.anylist.com/articles/share-list
- **CSV/JSON/file export of lists:** none found. A 2025 Trustpilot review says there is no way to
  export lists, recipes or calendars as text or CSV: https://nz.trustpilot.com/review/www.anylist.com.
  This is a user claim, so UNVERIFIED as official.
- **Recipes:** you can send a recipe as text, optionally with a file attachment that opens in
  AnyList: https://help.anylist.com/articles/send-recipe/. For recipe files, see
  https://help.anylist.com/articles/open-recipe-file/.
- **Web app:** at https://www.anylist.com/web, for AnyList Complete subscribers only:
  https://help.anylist.com/articles/web-app. Web export or print is UNVERIFIED.
- **Official public API:** none found.
- **Unofficial APIs (reverse engineered):**
  - Node: `anylist` (codetheweb), which calls itself "unofficial, reverse engineered". It logs in
    with the user's **email + password** and stores the tokens AES-encrypted in
    `~/.anylist_credentials`. It reads lists and items (name, quantity, checked) and supports
    recipes. https://unpkg.com/anylist@0.8.6/README.md
  - Rust `anylist_rs` with Python bindings `pyanylist`: https://pypi.org/project/pyanylist/.
  - Home Assistant: https://www.home-assistant.io/integrations/any_list/ and HACS integrations,
    e.g. https://github.com/ozonejunkieau/ha-anylist.
  - An MCP server: https://mcpservers.org/servers/bobby060/anylist-mcp.
- **Apple Reminders:** an import from Reminders into AnyList. It is not an export. AnyList creates
  Reminders lists and imports their items when the app opens; the items "will then be deleted
  from Reminders". https://help.anylist.com/articles/reminders-import/
- **Siri Shortcuts** (adding items): https://help.anylist.com/articles/siri/
- **Alexa skill** (add, cross off, read lists): https://help.anylist.com/articles/alexa-skill-commands/
- **Google Assistant:** shut down on 2023-06-20, when Google ended third-party list apps:
  https://blog.anylist.com/2023/05/google-assistant-integration-shutdown

### Data per route
- **Share as text:** contents UNVERIFIED.
- **Unofficial API:** list names, item name, quantity and checked state. Categories and details
  are not documented in the README: https://unpkg.com/anylist@0.8.6/README.md
- **Live sharing:** items are checked off in real time for every member:
  https://help.anylist.com/articles/share-list

### Format sample
- I found no verbatim sample of an emailed or texted AnyList list (searched for "Sent from
  AnyList", "Shared from AnyList", etc.).

### Auth / ToS
- The Terms (last revised 2019-07-18) contain no clause on automated access, scraping or reverse
  engineering: https://www.anylist.com/terms
- Every unofficial route needs the user's AnyList password, which Snacklist should not handle.

### Import into AnyList (prior art)
- **Paste items:** copy text from an email or a file and paste it into the Add Item field, "one
  item per line". The pasted items are "automatically categorized":
  https://help.anylist.com/articles/paste-items
- **Reminders import:** see above.
- **Recipe import:** from websites:
  https://help.anylist.com/articles/feature-overview-recipe-import/
- I found no importer from another list app.

### Platforms
- iOS, Android, Mac, and web (Complete only). Siri and Reminders are Apple-only. Google
  Assistant is gone.

## OurGroceries

**German relevance:** The DE App Store listing is titled "Einkaufsliste OurGroceries". It supports
9 languages, including German, and has 803 ratings at 4.7:
https://apps.apple.com/de/app/our-groceries-shopping-list/id325851015. The FAQ says there is no
German Alexa skill and none is planned, and that the product database is "rather U.S.-centric":
https://www.ourgroceries.com/faq. Category guessing is "language-sensitive":
https://www.ourgroceries.com/user-guide. Relevance: medium to high. Of the three, it is the most
localised for German.

### Export routes
- **Account data export (website only):** Settings, then "Export Data". This downloads a **ZIP
  with README.txt, XLSX and JSON**. "Currently this is an export-only feature" (OurGroceries can't
  re-import it). https://www.ourgroceries.com/user-guide
- **Send by email or text:** the iOS release notes mention sending shopping lists and recipes "via
  third-party text & email apps" and "single-column formatting of lists when sending them by
  email": https://apps.apple.com/us/app/-/id325851015. The exact menu path is UNVERIFIED.
- **Print:** on iOS, the Share icon (lower left), then "Print list". On Android, the menu, then
  "Print list". On the web, the menu, then "Print list", which gives a "paper-friendly" page.
  https://www.ourgroceries.com/user-guide
- **Web app:** at ourgroceries.com, signed in with the same account. You can view and edit
  lists there. https://www.ourgroceries.com/user-guide
- **Official public API:** none mentioned in the FAQ or the User Guide.
- **Unofficial API:** `ourgroceries` on PyPI (ljmerza/py-our-groceries, MIT). It logs in with
  `OurGroceries(username, password)`. It can get lists, items, categories and the master list,
  cross items off or on, add items with a note, and edit items. Recipes are available via
  `get_my_lists()`. https://github.com/ljmerza/py-our-groceries,
  https://community.home-assistant.io/t/ourgroceries-integration-support-for-recipes/651755
- **Home Assistant:** an official core integration, cloud polling, with one to-do entity per
  list: https://www.home-assistant.io/integrations/ourgroceries/
- **Voice:** Alexa (no German skill), Siri, and Android phone and Wear OS commands. Google
  Home and Nest support ended in 2023. https://www.ourgroceries.com/faq

### Data per route
- **Export ZIP:** XLSX + JSON. The exact fields (categories, notes, crossed-off state, recipes)
  are UNVERIFIED because the User Guide lists only the file types.
- **Unofficial API:** item value (name), category, note, crossed-off state, master list and
  recipes. A separate quantity field is not mentioned. OurGroceries appears to keep the quantity
  inside the name text; that is UNVERIFIED.
- **Household model:** one shared account, so every member signs in with the same email:
  https://www.ourgroceries.com/faq

### Format sample
- I found no verbatim emailed list. The only documented formatting fact is that email sends
  are "single-column".

### Auth / ToS
- The Terms, last updated 2026-09-16 (https://www.ourgroceries.com/terms):
  - §6(c): you may not "reverse engineer, decompile, disassemble, or try to derive the Service's
    source code", except where the law permits it.
  - §6(g): you may not "access it in ways we do not authorize".
- An unofficial client would need the user's password and arguably violates §6(g). The official
  route is: the user exports the ZIP and uploads it to Snacklist.

### Import into OurGroceries (prior art, the best example of the three)
- **Website, list menu, "Import items":** accepts typed or pasted text, a plain-text file, or a
  CSV. Plain text takes one item per line. CSV header mapping:
  - `category`
  - `item` / `name` / `description`
  - `barcode` / `upc`
  - `note` / `notes`

  Sample from https://www.ourgroceries.com/user-guide, verbatim:
  ```
  item,category
  milk,Dairy
  bread,Bakery
  ```
- The guide explicitly tells Out of Milk users to export their lists and import the CSVs:
  https://www.ourgroceries.com/user-guide

### Platforms
- iOS 16+, Android 6+, Apple Watch, Wear OS, and web. Import and export are **web only**:
  https://www.ourgroceries.com/faq, https://www.ourgroceries.com/user-guide

## Out of Milk

**German relevance:** the US App Store listing shows English, French and German, 10K ratings at
4.5, seller inMarket Media, LLC, and version 5.10.2 from about early November 2026:
https://apps.apple.com/us/app/-/id564974992. The DE App Store URL I tried returned 404. A DE
Google Play page titled "Out of Milk - Einkaufsliste" exists, but its details didn't load:
https://play.google.com/store/apps/details?id=com.capigami.outofmilk&hl=de&gl=DE. DE store
availability is partly UNVERIFIED. Relevance: low to medium. It has a German UI, but its
audience is US.

### Export routes
- **Android "Export list":** from the list's ⋮ menu. You pick an email app, and the list is
  emailed as a **.csv** file. The source is the search snippet of
  https://support.outofmilk.com/hc/en-us/articles/208223943 (403 to the fetcher). An iOS
  equivalent is UNVERIFIED and wasn't found.
- **Website, "List Summary, Import and Export":** download buttons per list (CSV). See
  https://support.outofmilk.com/hc/en-us/articles/360023000572 (snippet) and Lister's migration
  guide: https://lister.lister-studios.com/?p=1347
- **Share by text or email:** "Share lists by text or email":
  https://apps.apple.com/us/app/-/id564974992. The format is UNVERIFIED.
- **Collaboration:** "Add Friend By Email" shares to another Out of Milk account:
  https://support.outofmilk.com/hc/en-us/articles/207931796
- **Voice:** a Google Assistant voice skill, reported to also work with Alexa and Google Home:
  https://www.retaildive.com/news/out-of-milk-debuts-google-assistant-powered-shopping-list/504779.
  It is an old article (around 2017); current status is UNVERIFIED.
- **Official API, unofficial API, HA integration:** none found.

### Data per route
- **CSV columns:** UNVERIFIED. No source lists the headers. Out of Milk has separate list types
  (Shopping, Pantry, To-Do), and the importer asks which type each CSV is:
  https://support.outofmilk.com/hc/en-us/articles/208200803 (snippet)
- **Format sample:** none found.

### Auth / ToS
- I did not check Out of Milk's ToS (UNVERIFIED). Since no unofficial API exists, file export
  is the only practical route.

### Import into Out of Milk (prior art)
- **Website, List Summary, "Import New Shopping List"** (or the Pantry/To-Do equivalent):
  uploads a CSV previously exported from Out of Milk:
  https://support.outofmilk.com/hc/en-us/articles/208200803 (snippet). Whether it accepts other
  apps' CSVs is UNVERIFIED.
- **Third parties that import Out of Milk CSVs:** Lister imports them on the phone
  (multi-select files): https://lister.lister-studios.com/?p=1347. OurGroceries tells Out of
  Milk users to import them: https://www.ourgroceries.com/user-guide

## Takeaways for Snacklist

- **Paste one item per line.** It is the common denominator. AnyList and OurGroceries both
  accept it, and every app can produce some text (share, print, or email). Auto-categorise
  pasted lines, as AnyList does. Snacklist's `classify_item` already does this server-side.
- **Optional CSV upload.** Use OurGroceries' header mapping (`item/name`, `category`, `note`) as a
  forgiving model. It would cover Out of Milk CSVs and the OurGroceries XLSX/JSON export once
  converted. The exact columns are UNVERIFIED, so we should get real sample files from users.
- **No account linking.** All three unofficial routes need the user's password for the other
  service. OurGroceries' ToS §6(g) argues against it, and none of the three offers a public API.
- **Verbatim text-share samples are still missing for all three.** Get them from real devices
  before writing a parser for headers, bullets or quantities.
