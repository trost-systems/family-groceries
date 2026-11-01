# Hummlist features for writers

What Hummlist does today, in plain words, with the exact button and screen labels in German and English. Hummlist Launch and anyone writing emails, site copy or instructions reads this file. The verification recipes behind it are the other files in this folder.

## How to use this

- Describe only what a section says the app does. If it is not here, ask before you write it.
- Copy labels exactly, with their quotes and punctuation: German „…“, English "…". The app shows German or English depending on the phone's language, or on Mehr → Einstellungen → Sprache.
- Check each section's **Never claim** list and the global list below before you send anything.
- **Unverified** means nobody could prove it from the code or a test run. Leave it out, or ask.
- Each section ends with the commit and date it was last checked. If the app changed after that date, the section can be out of date.
- Short clips (GIF for emails, MP4/WebM for the site, PNG fallback) live in `/workspace/hummlist/clips/<feature>/` on the box, for example `quick-add/de.gif`. Each `meta.json` names the commit and the alt text. To make a new one, see `.cursor/skills/hummlist-howto-clips/SKILL.md`. Always give the GIF its alt text and link the PNG as a fallback.

## Never claim (everywhere)

- That Hummlist Premium can be bought, or any price, plan, trial or discount. Premium is not on sale and nothing is locked behind it today.
- That Siri, Alexa or AI assistants need Premium. Today they don't.
- Siri without setup ("just say Hey Siri", no Shortcut) as available. It is built, but its announcement waits for Hummlist Launch. Today Siri works through a Shortcut the user sets up once, in German.
- That the Alexa skill is launched, certified or in the Alexa Skill Store. It is a beta by invitation, German only.
- Store logos or chain colours, official store layouts, prices, offers or opening hours. Store names are plain names; walking orders are researched defaults.
- A code to type from an email for sign-in. Sign-in emails contain a link, and the only code in Hummlist is the 8-character household invite code.
- Apple Watch, widgets, Google Assistant, Android voice assistants, push notifications, recipes, meal plans or price tracking. None exist.
- That the microphone (dictation) works in the browser. It is in the iPhone and Android apps only.
- Real people's names or lists. Clips and screenshots use the fictional Brandt family.
- Anything in `releases/flags.json` that is not released (premium-launch, native-siri, alexa-certification, integration-lock).

# Getting started

## Sign-up and sign-in

**What it does.** A new or returning user signs in with email and password, creates an account with "Registrieren", or asks for a sign-in link by email and opens it on the same device. The app also offers "Sign in with Google" and "Sign in with Apple". Signing out is in the More tab. The login screen links the imprint and the privacy policy.

**How to get there.**
1. Open Hummlist while signed out: the login screen („Anmelden“, EN: "Sign in") appears.
2. Enter email and password, then tap „Anmelden“ (EN: "Sign in"), or „Registrieren“ (EN: "Sign up") for a new account.
3. Or enter only the email and tap „Anmeldelink per E-Mail senden“ (EN: "Email me a sign-in link"), then open the link from the email on the same device.
4. Or tap „Mit Google anmelden“ / „Mit Apple anmelden“ (EN: "Sign in with Google" / "Sign in with Apple").
5. To sign out: tab „Mehr“ (EN: "More"), then „Abmelden“ (EN: "Sign out").

**Never claim.**
- A code that users type in from an email: the app has no such field. Sign-in emails carry a link.
- "8-digit code" for sign-in. Sign-in emails contain a link, not a code. The only 8-character code in Hummlist is the household invite code (letters and digits).
- That the emails are in German or come from a "Hummlist" template: today they are short English emails ("Your sign-in link", "Confirm your email address").
- Passkeys, phone-number sign-in or other providers than Google and Apple.

**Last verified.** main 1b6d204, 2026-11-01 (CET), from code on main, plus the hosted project's auth settings (read-only, Management API). Recipe: [sign-in.md](./sign-in.md).

## Usage-data question (analytics consent)

**What it does.** Right after the first sign-in on a device, Hummlist asks once whether it may collect usage data. A no sends nothing at all. A yes sends pseudonymous usage data and error reports to PostHog on servers in the EU. Both answers are equally prominent, and the user can change the answer any time in More.

**How to get there.**
1. Sign in for the first time on a device: the question „Darf Hummlist Nutzungsdaten erfassen?“ (EN: "May Hummlist collect usage data?") appears.
2. Answer „Erlauben“ (EN: "Allow") or „Nicht erlauben“ (EN: "Don't allow").
3. To change it later: tab „Mehr“ (EN: "More"), section „Nutzungsdaten“ (EN: "Usage data"), switch „Nutzungsdaten und Fehlerberichte senden“ (EN: "Send usage data and error reports").

**Never claim.**
- That list contents, names or email addresses are collected: the text says they are never sent.
- That a no limits any feature: the app works the same.
- That Hummlist uses advertising or sells data: nothing in the app says so.
- Quote the legal text exactly; do not paraphrase it. Point to the privacy policy for details.

**Note.** Every released app and app.hummlist.com ask this question (checked 2026-11-01).

**Last verified.** main 1b6d204, 2026-11-01 (CET), from code on main and the production builds' analytics configuration. Recipe: [privacy-consent.md](./privacy-consent.md).

## Getting started: first sign-in to the list

**What it does.** After the first sign-in, a new user creates a household or accepts an invite. Creating asks for a household name (prefilled "Unser Haushalt") and which stores you shop at: pick from ten common ones (EDEKA, REWE, Lidl, Aldi Süd, Aldi Nord, Kaufland, Netto, Penny, dm, Rossmann) and add your own, or skip and add them later. Then Hummlist offers to invite the partner and opens the shopping list. Someone who opens an invite link goes straight to joining.

**How to get there.**
1. Sign up or sign in. If the app asks about usage data, answer it.
2. On „Willkommen bei Hummlist“ (EN: "Welcome to Hummlist") tap „Haushalt erstellen“ (EN: "Create a household") or „Einladung annehmen“ (EN: "Join with an invite").
3. Creating: choose the name, tap the stores you shop at (or „+ Eigenen Laden hinzufügen“, EN: "+ Add your own store"), then „Haushalt erstellen“ (EN: "Create a household"); „Überspringen“ (EN: "Skip") starts without stores.
4. Next screen „Partner einladen“ (EN: "Invite your partner"): make an invite or tap „Später“ (EN: "Later") to go to the list.

**Never claim.**
- A tour, a tutorial or a newsletter or email opt-in in the app: there is none.
- That any store is pre-installed, recommended or a partner: nothing is picked until you pick it, and the shops have nothing to do with Hummlist.
- Anything about stores the user creates themselves during onboarding.

**Last verified.** job 58 branch (PR #176), 2026-11-01 (CET), by e2e/tests/onboarding.spec.ts and stores-add.spec.ts. Recipe: [onboarding.md](./onboarding.md).

## Household and invites

**What it does.** One household shares one shopping list. A member invites a partner with an 8-character code and a link; each invite is valid for 7 days and works for one person. The partner types the code or opens the link and joins. A member can revoke open invites at any time.

**How to get there.**
1. Tab „Mehr“ (EN: "More"), section „Haushalt“ (EN: "Household"), row „Partner einladen“ (EN: "Invite your partner").
2. Tap „Neue Einladung“ (EN: "New invite"), then share it with „Teilen“ (EN: "Share") or copy it with „Link kopieren“ / „Code kopieren“ (EN: "Copy link" / "Copy code").
3. To join: „Anderem Haushalt beitreten“ (EN: "Join another household") in the same section, enter the code, „Weiter“, then „Haushalt beitreten“ (EN: "Join household"). Or open the invite link.
4. To revoke: on the invites page tap „Widerrufen“ (EN: "Revoke") on an invite.

**Never claim.**
- A members list, renaming a household, removing a member or a "leave household" button: none exist. Joining another household moves the person; if they were the last member, the old household is deleted with its list.
- An archive for households: it is off in the released apps.
- Invites that stay valid longer than 7 days or work for several people.
- Purchases or Premium tied to joining: Premium is not on sale yet.

**Last verified.** main 1b6d204, 2026-11-01 (CET), from code on main. Recipe: [household-invites.md](./household-invites.md).

# The list

## Quick add

**What it does.** The bar at the bottom of the list, „Was brauchst du?“ (EN: "What do you need?"), is how items get onto the list. As soon as you type or tap it, a sheet opens with suggestions: what you typed, things you bought before, other packs, sizes and brands, and words from a built-in catalogue; they also find what you meant despite a small typo ("Hafermlch" offers Hafermilch). Enter takes the first suggestion, a tap takes any. Hummlist reads amounts out of what you type ("2 l Milch", "6x Eier", "zwei Gurken"), and picks the category and, where it knows one, the store. After an add the field is empty and ready for the next item, and „Rückgängig“ (EN: "Undo") takes the last add back.

**How to get there.**
1. Open Hummlist and stay on the „Liste“ (EN: "List") tab.
2. Type into „Was brauchst du?“ (EN: "What do you need?") or tap it.
3. Press Enter for the first suggestion, or tap another row. Before you take a row you can choose a store („Laden: automatisch“, EN: "Store: automatic") and a category („Kategorie: automatisch“, EN: "Category: automatic").
4. Close with „Schließen“ (EN: "Close"), Escape, or a tap on the list behind.

**Never claim.**
- That suggestions forgive any spelling. They forgive one wrong letter in short words and two in longer ones ("Hafermlch" finds Hafermilch) and find a word from 4 letters inside it ("milch" finds Hafermilch), online and offline alike.
- That the microphone works in the browser (it is on iOS and Android only).
- That the cursor jumps into the field on phones when the app opens (only on desktop and web).
- That an item already on the list can be added twice; Hummlist says „<name> steht schon auf der Liste“ (EN: "<name> is already on the list"). Two people adding the same item at the same moment also end up with one.

**Last verified.** job 64 branch (job/64-polish-seed), 2026-11-02 (CET), from code on the branch, driven on the web build (360×640, 390×844) and by widget, pgTAP and Deno tests. Recipe: [quick-add.md](./quick-add.md).

## Due again

**What it does.** Hummlist notices what a household buys regularly. When you open the add bar with nothing typed, items that are probably running out show up as „Wieder fällig“ (EN: "Due again"); one tap puts them on the list with the usual quantity. An item shows up once it was bought on at least two different days and about its usual time between purchases has passed. Below them come the items used in the last 30 days, marked „Zuletzt verwendet“ (EN: "Recently used"), up to 10 rows in all. The sheet opens small, with three of them; the others scroll.

**How to get there.**
1. Open the „Liste“ (EN: "List") tab.
2. Tap the bar „Was brauchst du?“ (EN: "What do you need?") without typing.
3. Tap a row marked „Wieder fällig“ (EN: "Due again").

**Never claim.**
- That Hummlist sends reminders or notifications about due items; it only shows them in the add sheet.
- That it works from a single purchase; it needs at least two purchase days.
- That it predicts quantities by season or guesses new items; it only repeats what the household bought.

**Last verified.** job 64 branch (job/64-polish-seed), 2026-11-02 (CET), from code on the branch, driven on the web build (360×640, 390×844) and by widget, pgTAP and Deno tests. Recipe: [usuals.md](./usuals.md).

## Dictation

**What it does.** In the iPhone and Android apps, a microphone next to the add bar lets people speak what they need. Hummlist listens in German, on the phone only, so the voice never goes to a server. The words appear as they are spoken and, when the person pauses, Hummlist splits the sentence into separate items ("Milch, zwei Gurken und Klopapier") and adds them. It then says what it added.

**How to get there.**
1. Open the Hummlist app on an iPhone or Android phone, on the „Liste“ (EN: "List") tab.
2. Tap the microphone at the right of „Was brauchst du?“ (EN: "What do you need?") („Diktieren“, EN: "Dictate").
3. Say what you need. Tap the red button („Diktat beenden“, EN: "Stop dictation") to stop early.
4. The first time, allow microphone and speech recognition when the phone asks.

**Never claim.**
- That dictation works in the web app or on a computer; there is no microphone button there.
- That the voice is sent to a server or stored; recognition happens on the device.
- That it understands languages other than German.
- That it works on phones without German offline speech data; the app then asks to download it or to type instead.

**Unverified.** Behaviour on real devices (permission prompts, recognizer) was read from code, not run.

**Last verified.** main 1b6d204, 2026-11-01 (CET), from code on main. Recipe: [dictation.md](./dictation.md).

## Ticking items, "Zuletzt verwendet" and undo

**What it does.** Tapping an item on the list ticks it off: a line strikes through it, the row turns mint and slides away in under half a second, without a message. There is no check box to tap; the whole row is the target. At the bottom of the list, „Zuletzt verwendet“ keeps the last 20 ticked items; tapping one puts it back where it was. Deleting an item or adding one by mistake can be undone with „Rückgängig“.

**How to get there.**
1. Open the list and tap an item to tick it.
2. Scroll to the bottom and tap „Zuletzt verwendet“ (EN: "Recently used") to unfold it.
3. Tap the item to put it back; a note says „<Name> steht wieder auf der Liste“ (EN: "<Name> is back on the list").
4. To delete: hold the item (or swipe it left), tap „Löschen“ (EN: "Delete"), then „Rückgängig“ (EN: "Undo") if it was a slip.

**Never claim.**
- That ticking shows an undo message; it does not. Undo for a tick is the „Zuletzt verwendet“ section.
- A check box next to each item: there is none.
- That swiping deletes; swiping left opens editing.
- That ticked items vanish after a fixed time or can be counted past 20 there.

**Unverified.** Whether ticked items are ever removed from the section by age: no cleanup job was found in the code, but it was not run.

**Last verified.** main c8dfb2c, 2026-11-01 (CET), from code on main after job 57, driven on the web build. Recipe: [tick-and-undo.md](./tick-and-undo.md).

## Edit an item

**What it does.** Every item can be changed after it is on the list: its name, brand, details (like "Größe 3" or "1,5 %"), quantity, store and category. The list row shows the brand and details in small text under the name. Items can also be deleted from the same sheet, with an undo.

**How to get there.**
1. Open the „Liste“ (EN: "List") tab.
2. Swipe an item to the left, press and hold it, or right-click it on a computer. (A plain tap ticks the item off instead.)
3. In the sheet „Bearbeiten“ (EN: "Edit") change „Bezeichnung“ (EN: "Name"), „Marke“ (EN: "Brand"), „Menge“ (EN: "Qty") with the buttons „Eins weniger“ / „Eins mehr“ (EN: "One less" / "One more"), or „Eigenschaften“ (EN: "Details"), or pick another store or category with the chips.
4. Tap „Fertig“ (EN: "Done") to save, „Abbrechen“ (EN: "Cancel") to discard, or „Löschen“ (EN: "Delete") to remove the item; „Rückgängig“ (EN: "Undo") in the message that shows for a few seconds brings it back.

**Never claim.**
- That a swipe deletes an item; it opens the edit sheet.
- That items in „Zuletzt verwendet“ (EN: "Recently used") can be edited.
- That the quantity buttons work on free text like "eine Packung"; they only step numbers.

**Last verified.** main 1b6d204, 2026-11-01 (CET), from code on main. Recipe: [edit-item.md](./edit-item.md).

## Automatic category (the classifier)

**What it does.** When an item is added, Hummlist sorts it into a category on its own, such as Kühlregal for Hafermilch, using a built-in German word list of about 1,250 terms plus common spelling variants, regional words, some English words and small typos. Anything unknown goes to „Sonstiges“. If you move an item to another category, the household remembers it and the same item lands there next time. This works the same for items added in the app, by voice, through the AI-assistant connection, Siri and Alexa.

**How to get there.**
1. Type an item in the add bar on the „Liste“ tab and add it; it appears under its category.
2. To correct it, hold the item and tap the chip „Kategorie: …“ (EN: "Category: …"), pick another one, tap „Fertig“ (EN: "Done"). Or hold the item and drag it onto another category heading.
3. To choose before adding, tap the category chip in the add sheet.

**Never claim.**
- That it understands every word, or any typo; very short words and unusual typos stay in „Sonstiges“ on purpose.
- That it uses AI or learns across households; each household's corrections stay in that household.
- That it works for every language; the word list is German, with a few English synonyms.
- That Siri and Alexa are generally available: Siri's native integration is held and Alexa is in beta, not certified.

**Unverified.** How quickly the server answers on a slow connection: while it is working, the item shows under „Wird einsortiert …“.

**Last verified.** main 1b6d204, 2026-11-01 (CET), from code on main. Recipe: [classifier.md](./classifier.md).

## Categories

**What it does.** Items on the list sit under categories such as Obst & Gemüse or Getränke. Every household starts with 11 and can add its own, rename any, reorder them, and delete any except „Sonstiges“. When a category is deleted, its items move to a category the user picks.

**How to get there.**
1. Tap „Mehr“ (EN: "More") in the tab bar.
2. Tap „Kategorien verwalten“ (EN: "Manage categories").
3. Tap a category to rename it, the trash icon to delete it, the handle to drag it; „Kategorie hinzufügen“ (EN: "Add category") adds one.

The starting categories, in order: Obst & Gemüse, Brot & Backwaren, Kühlregal, Fleisch/Wurst/Fisch, Vorrat & Konserven, Süßes & Snacks, Getränke, Tiefkühl, Haushalt, 👶 Drogerie, Sonstiges (EN: Fruit & veg, Bread & bakery, Chilled, Meat & fish, Pantry, Sweets & snacks, Drinks, Frozen, Household, 👶 Drugstore, Other).

**Never claim.**
- That "Sonstiges" can be deleted; it is the fallback for anything unrecognised.
- That categories are per store; stores only have their own order of the same categories.
- A fixed number of categories or any limit on adding them (none found).

**Unverified.** Whether there is a limit on category count or name length: none found in the app.

**Last verified.** main 1b6d204, 2026-11-01 (CET), from code on main. Recipe: [categories.md](./categories.md).

## Stores, walk order and the sections of the list

**What it does.** The list is split into one section per store (only stores that have something on the list), then „Ohne Laden“. Inside a store, items are grouped by category in that store's own walking order, so the list follows the way you walk through the shop. Hold and drag moves an item to another store, category or place, and the household remembers which store an item belongs to. A new household has the stores it picked at the start; you can change their order and add your own stores (Rewe, the market, the bakery), each with its own walking order, rename them or delete them.

**How to get there.**
1. Open the „Liste“ tab (EN: "List"): each store is a section; tap a store's name to fold it.
2. Hold a store's name (or right click it) for the menu: „Laden nach oben“ / „Laden nach unten“ (EN: "Move store up" / "Move store down") and „Reihenfolge bearbeiten“ (EN: "Edit order") for the category order of that store.
3. Hold an item and drag it onto a store's name to put it in that store.
4. Tap „Mehr“ (EN: "More"), then „Läden“ (EN: "Stores"), to reorder the stores or open a store's category order; „+ Neuer Laden“ (EN: "+ New store") adds one, the ⋮ next to a store renames or deletes it.
5. While adding or editing an item, open the store chip and tap „+ Neuer Laden“ (EN: "+ New store"), type the name and press Enter: the store is created and chosen for the item.

**Never claim.**
- Store logos, chain colours or official store maps. Store names appear as plain names in a small hexagonal label. The walking orders are researched defaults that can differ from a real shop.
- That swiping or tapping moves items between stores; it is hold and drag, or the edit sheet's store choice.
- That the app knows prices, opening hours or store locations.

**Note.** The wording of the onboarding skip hint („Du kannst sie später unter Mehr anlegen“) promises adding stores later, but the app has no add-store function today; do not repeat it.

**Last verified.** job 58 branch (PR #176), 2026-11-01 (CET), by e2e/tests/stores-add.spec.ts and stores.spec.ts. Recipe: [stores-walk-order.md](./stores-walk-order.md).

## Live sync between household members

**What it does.** Everyone in a household sees the same list, live. When a partner adds, ticks, edits, moves or deletes an item, it shows on the other phone within a couple of seconds, with no reload. New items from a partner are highlighted, and the strip above the list says how many are new and from whom, until they have been on screen for a moment.

**How to get there.**
1. Both people join the same household: one uses „Mehr“ (EN: "More") → „Partner einladen“ (EN: "Invite your partner"), the other opens the link or enters the code.
2. Open „Liste“ (EN: "List"). Changes appear on its own.
3. Strip above the list: „1 neu von Lea“ (EN: "1 new from Lea"). A small cloud icon on its right appears while changes are being sent or the phone is offline.

**Never claim.**
- Sync with people outside the household, or with a read-only guest view.
- Push notifications for a partner's changes.
- That the list updates with the app fully closed in the background.

**Last verified.** main c8dfb2c, 2026-11-01 (CET), from code on main after job 57, driven on the web build. Recipe: [live-sync.md](./live-sync.md).

## Working offline

**What it does.** The shopping list keeps working without a connection: adding, ticking, editing and deleting items all show up immediately and are sent automatically once the phone is back online. The app also opens offline and shows the last list it had. A cloud icon above the list says "Offline" while there is no connection. A few settings-type actions (reordering stores or categories, creating or joining a household, exporting data, deleting the account, sending feedback) need a connection and say so.

**How to get there.**
1. Open „Liste“ (EN: "List") and use it as usual with the connection off.
2. Look for the crossed-out cloud on the right of the strip above the list: „Offline: Änderungen werden synchronisiert, sobald die Verbindung zurück ist“ (EN: "Offline: changes will sync once the connection is back").
3. When the connection returns, the cloud goes away on its own.

**Never claim.**
- That a partner sees offline changes before they sync.
- That reordering stores or categories, feedback or account actions work offline.
- Offline voice dictation to a server: dictation stays on the device, but splitting text into items needs a connection.

**Unverified.** Offline sign-in, and a first start offline before the list was ever synced (not covered by specs or read in detail).

**Last verified.** main 1b6d204, 2026-11-01 (CET), from code on main. Recipe: [offline.md](./offline.md).

# Settings, help and account

## Theme: System, light, dark

**What it does.** The user chooses between „System“ (follow the device), light and dark in one three-part switch. The choice applies immediately across the whole app and is remembered on that device, also after signing out. By default the app follows the phone's or browser's own light/dark setting.

**How to get there.**
1. „Mehr“ (EN: "More") → „Einstellungen“ (EN: "Settings").
2. Under „Darstellung“ (EN: "Appearance") tap „System“ (EN: "System"), „Hell“ (EN: "Light") or „Dunkel“ (EN: "Dark").

**Never claim.**
- That the choice follows the account to other devices.
- A scheduled or automatic day/night switch beyond „System“.
- The old label „Wie Gerät“ for the theme (it is „System“ since 2026-11-01).

**Last verified.** main c8dfb2c, 2026-11-01 (CET), from code on main after job 57, driven on the web build. Recipe: [theme.md](./theme.md).

## App language

**What it does.** The app is available in German and English. It follows the device language by default (German if the device uses neither); the user can override that. The switch is instant, covers the whole app and is remembered on that device.

**How to get there.**
1. „Mehr“ (EN: "More") → „Einstellungen“ (EN: "Settings") → „Sprache“ (EN: "Language").
2. Pick „Wie Gerät“ (EN: "Device"), „Deutsch“ or „English“.

**Never claim.**
- Any language besides German and English.
- That the language is stored in the account or follows the user to other devices.
- That everything is English once the app is set to English: suggestions from the catalogue („Aus dem Katalog“) stay German words, the Siri Shortcut answers in German, the Alexa skill speaks German only, and the sign-in emails are short English emails whatever the app language.

**Last verified.** main 1b6d204, 2026-11-01 (CET), from code on main, English catalogue suggestions driven on the web build. Recipe: [language.md](./language.md).

## Feedback

**What it does.** Users can send Peter a short note from inside the app: a bug, an idea or anything else, up to 2000 characters. They can optionally say Peter may contact them. The app attaches its version, device type, language and the screen the user came from, but never anything from the shopping list. If there is no connection the note stays in the form and can be sent again.

**How to get there.**
1. „Mehr“ (EN: "More") → „Feedback senden“ (EN: "Send feedback").
2. Write in „Deine Nachricht“ (EN: "Your message"), optionally pick „Bug“, „Idee“ or „Sonstiges“ (EN: "Bug", "Idea", "Other") and tick „Peter darf mich dazu kontaktieren“ (EN: "Peter may contact me about this").
3. Tap „Senden“ (EN: "Send"); the app answers „Danke!“ (EN: "Thanks!").

**Never claim.**
- Shake-to-report, feedback from the list screen, or screenshots/attachments.
- A reply is guaranteed; contact only happens if the box is ticked and Peter chooses to.
- That list contents are sent.

**Unverified.** How quickly or by what channel Peter sees notes (not in the app).

**Last verified.** main 1b6d204, 2026-11-01 (CET), from code on main. Recipe: [feedback.md](./feedback.md).

## The More tab, help and legal pages

**What it does.** The app has two tabs, List and More. More collects household entries (invite partner, join another household, categories, stores; Premium only once it is on sale), access, account and sign-out, feedback, help, settings, and the legal pages, with the app version at the bottom. Help, imprint and privacy open pages on hummlist.com in the browser.

**How to get there.**
1. Tap „Mehr“ (EN: "More") in the bottom bar (on wide screens: the rail on the left).
2. Pick an entry, e.g. „Hilfe & Kontakt“ (EN: "Help & contact"), „Impressum“ (EN: "Imprint"), „Datenschutz“ (EN: "Privacy"), „Lizenzen“ (EN: "Licenses"), „Abmelden“ (EN: "Sign out").
3. Help page on the web: hummlist.com/support (EN: hummlist.com/en/support), with support@hummlist.com and answers to common questions.
4. Guides on hummlist.com: Siri Shortcut and Alexa skill, in German; the English pages say these are German-only for now.

**Never claim.**
- A guides section inside the app, a help chat or an in-app browser.
- That Siri or Alexa guides exist in English beyond the German-only notice.
- A sign-out from anywhere but More.

**Last verified.** job 64 branch (job/64-polish-seed), 2026-11-02 (CET), from code on the branch, driven on the web build (360×640, 390×844) and by widget, pgTAP and Deno tests. Recipe: [more-help.md](./more-help.md).

## Account: data export and deletion

**What it does.** Every user can download a copy of their data as a JSON file and delete their account for good. Before deleting, the app says what happens to the shared household: it stays for the others (the user's items remain, without their name) or, for the last member, it is deleted with its list. The user confirms by typing a word. Single data can also be removed without deleting the account: an item from the list, an access key or connected app on Zugänge, and usage data by switching it off.

**How to get there.**
1. Open „Mehr“ (EN: "More").
2. Under „Konto“ (EN: "Account") tap the row „Konto“ (EN: "Account").
3. Tap „Meine Daten exportieren“ (EN: "Export my data") for the copy, or „Konto löschen“ (EN: "Delete account"), type LÖSCHEN (EN: DELETE) and tap „Endgültig löschen“ (EN: "Delete for good").
4. Without the app: app.hummlist.com/konto-loeschen.html explains all steps; single data is at app.hummlist.com/konto-loeschen.html#einzelne-daten under „Einzelne Daten löschen, ohne das Konto zu löschen“.

**Never claim.**
- History entries or „Zuletzt verwendet“ entries can be deleted one by one in the app (they cannot; history goes with the household, single entries on request by email to support@hummlist.com).
- Deletion can be undone, or happens later (it is immediate and final).
- Backups or logs vanish at once (backups are kept up to 90 days, logs 1 day, per the deletion page).

**Unverified.** Apple sign-in revocation on iPhone (no iOS surface to test).

**Last verified.** main 1b6d204, 2026-11-01 (CET), from code on main. Recipe: [account-deletion.md](./account-deletion.md).

# Connections and Premium

## AI assistants (MCP) and access keys

**What it does.** An AI assistant such as Claude can read the shopping list, add items, tick them off and move them to another category or store. The user connects it by signing in when the assistant asks (a page „Zugriff erlauben?“ with „Erlauben“ and „Ablehnen“) or with an access key made in the app, which is shown once. In the app the user sees the address, the keys and the connected assistants, and can revoke or disconnect any of them at once. Nothing needs Premium today.

**How to get there.**
1. Open „Mehr“ (EN: "More") and tap „Zugänge“ (EN: "Access").
2. Copy the server address under „MCP-Server“ (EN: "MCP server"): https://mcp.hummlist.com.
3. In the assistant, add a connector with that address and sign in, or tap „Token erstellen“ (EN: "Create token"), name it and copy the key once.
4. To end access: the bin icon „<Name> widerrufen“ (EN: "Revoke <name>") then „Widerrufen“, or „<App> trennen“ (EN: "Disconnect <app>") then „Trennen“.

**Never claim.**
- That it needs Premium (it does not today).
- That the assistant sees more than the list (it reads and changes shopping items, categories and stores only).
- That a key can be viewed again after creation (shown once).
- That ended keys are deleted at once (the record stays 30 days, then a daily clean-up deletes it; the key itself stops working immediately).
- Any specific assistant as officially supported or tested (Claude and ChatGPT are named in the app text; ChatGPT needs a Business or Enterprise workspace).

**Unverified.** The third-party connector screens of Claude and ChatGPT.

**Last verified.** main 1b6d204, 2026-11-01 (CET), from code on main. Recipe: [ai-assistants.md](./ai-assistants.md).

## Siri

**What it does.** On an iPhone the user can add things to the Hummlist by voice: they say a sentence like „Milch, zwei Gurken und Klopapier“, Hummlist splits it into items, files each under a category and Siri reads back „Hinzugefügt: Milch, 2 Gurken, Klopapier.“ Today this works with a Shortcut the user sets up once (about five minutes, German only). Siri without any setup (iOS 17 and newer, German and English, also reads the list aloud) is built but its announcement is held until Hummlist Launch.

**How to get there.**
1. Open „Mehr“ (EN: "More") → „Zugänge“ (EN: "Access") → „Token erstellen“ (EN: "Create token"), name it Siri, copy the key once.
2. In Apple's Shortcuts app build a shortcut called „Einkaufsliste“ (dictate text, send to Hummlist, speak the answer). The step-by-step guide is on hummlist.com: „Hummlist per Siri: Kurzbefehl einrichten“ (EN: "Hummlist with Siri (German only for now)").
3. Say „Hey Siri, Einkaufsliste“, then the items.

**Never claim.**
- That Siri works without setup as a released feature (held until Hummlist Launch).
- That it works on Apple Watch, AirPods or CarPlay (untested), or Android, or in the browser.
- That English sentences are split correctly through the Shortcut (German only).
- That it needs Premium (it does not today).
- That the voice microphone in the app works on the web (iOS and Android apps only).

**Unverified.** Real Siri voice on a device; the Shortcut on current iOS versions.

**Last verified.** main 1b6d204, 2026-11-01 (CET), from code on main. Recipe: [siri.md](./siri.md).

## Alexa skill (beta)

**What it does.** With the Hummlist skill a household member can say „Alexa, sag Hummlist, füg Milch und Eier hinzu“; the items land on the shared list, sorted by category, and Alexa says „Milch und Eier sind auf der Hummlist.“ „Alexa, frag Hummlist, was auf der Liste steht“ reads the open items (up to ten, then „und N weitere“). The skill is in beta, German only, and not yet certified by Amazon, so it is not for everyone.

**How to get there.**
1. Ask for a beta invitation (the link comes from Peter, who needs the email address of your Amazon account); accept it.
2. In the Alexa app open the skill „Hummlist“ and tap „Zur Verwendung aktivieren“.
3. Sign in to Hummlist and tap „Erlauben“ on the page „Zugriff erlauben?“ (it names „Amazon Alexa“).
4. Say „Alexa, sag Hummlist, …“. To end it: Hummlist → „Mehr“ (EN: "More") → „Zugänge“ (EN: "Access") → „Amazon Alexa trennen“ (EN: "Disconnect Amazon Alexa") → „Trennen“, or disable the skill in the Alexa app.

**Never claim.**
- That the skill is certified, in the public Alexa Skill Store, or available to everyone.
- That it speaks English or works outside DE, AT, CH, LU, LI.
- That it needs Premium (it does not today).
- That it works for ticking items off or moving them (add and read only).

**Unverified.** Real Alexa voice, the Alexa app screens and the beta invitation flow (no device or Amazon account here).

**Last verified.** main 1b6d204, 2026-11-01 (CET), from code on main. Recipe: [alexa.md](./alexa.md).

## Hummlist Premium (held)

**What it does.** Premium is not on sale yet and nothing in the app is gated by it: Siri, Alexa and AI assistants work for everyone. The app has a „Hummlist Premium“ page that explains Premium will unlock these connections for the whole household. Today it says Premium is bought in the iPhone or Android app (web) or „bald verfügbar“ (phone apps); there are no prices or buy buttons. Households the team has gifted Premium (for example testers) see „Hummlist Premium geschenkt“ and „Freigeschaltet“.

**How to get there.** Not from Mehr before the launch: the row „Hummlist Premium“ shows only for households that have Premium (testers). The page opens from its link.

**Never claim.**
- That Premium can be bought, or any price, plan or discount (yearly and Lifetime are planned, not for sale).
- That Siri, Alexa or AI assistants need Premium today (they do not).
- That Google Assistant or Apple Watch exist (the page says only "later").
- That there is a free trial.
- That Mehr shows Hummlist Premium to everyone (it does once Premium is on sale).

**Unverified.** Real store purchases (no store sandbox here); whether the analytics event for the paywall ever fires in production (it should not).

**Last verified.** job 64 branch (job/64-polish-seed), 2026-11-02 (CET), from code on the branch, driven on the web build (360×640, 390×844) and by widget, pgTAP and Deno tests. Recipe: [premium.md](./premium.md).
