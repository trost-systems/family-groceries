# More tab, help, guides, legal pages

The app has two tabs, „Liste“ and „Mehr“ (EN "List", "More"): a bottom bar on phones, a left rail from 840 px width. „Mehr“ is a list of sections: household, access, account (with sign-out), feedback and help, settings, legal, and the version at the bottom. Entries either open a page inside the app (on wide screens beside the list, on phones as a full page with a back button) or open a page on hummlist.com in a new browser tab.

## Sub-features

- `tabs` the two tabs and the wide-screen rail.
- `more-list` every More entry in order (below).
- `more-wide` from 840 px More shows the entry list (360 px) on the left and the opened page beside it; „Zugänge“ is shown first by default.
- `help-link` „Hilfe & Kontakt“ opens the help page on hummlist.com (new tab).
- `imprint-privacy` „Impressum“ and „Datenschutz“ open hummlist.com pages (new tab); the login screen links both too.
- `licenses` „Lizenzen“ opens Flutter's license page, titled Hummlist with the version.
- `version` last line „Version 0.x.y (build)“ (a local build reads „Version 0.1.0 (1)“).
- `sign-out` „Abmelden“ ends the session and shows the login.
- `analytics-switch` „Nutzungsdaten und Fehlerberichte senden“ switch (only where the build can send analytics).
- `internal-install` long press on the version line toggles an internal-install mark (testers only).

More entries in order (section header, then rows: DE label, EN label, hint):

1. Section „Haushalt“ / "Household"
   - „Partner einladen“ / "Invite your partner", hint = household name; only when the user is in a household (opens Einladungen page; see household-invites).
   - „Anderem Haushalt beitreten“ / "Join another household" (opens the join-code page).
   - „Archivierte Haushalte“ / "Archived households": hidden on normal builds (see Gotchas).
   - „Kategorien verwalten“ / "Manage categories".
   - „Läden“ / "Stores", hint „Reihenfolge und Laufweg“ / "Order and walking route".
   - „Hummlist Premium“ (both languages), only once Premium may be offered or for a household that has it (job 64), hint „Freigeschaltet“ / "Unlocked" when the household has Premium, otherwise „Siri, Alexa und KI-Assistenten“ / "Siri, Alexa and AI assistants" (driven 2026-11-01 on the production-like web build: a normal household sees this hint although nothing is sold).
2. Section „Zugänge“ / "Access": „Zugänge“ / "Access", hint „MCP-Server, Zugangsschlüssel, verbundene Apps“ / "MCP server, access tokens, connected apps".
3. Section „Konto“ / "Account": „Konto“ / "Account", hint „Daten exportieren, Konto löschen“ / "Export your data, delete your account"; then „Abmelden“ / "Sign out".
4. Section „Feedback“ / "Feedback": „Feedback senden“ / "Send feedback", hint „Fehler, Ideen und Fragen an Peter“ / "Bugs, ideas and questions for Peter"; then „Hilfe & Kontakt“ / "Help & contact", hint „Fragen, Anleitungen und unsere E-Mail-Adresse“ / "Questions, guides and our email address" (external-link icon).
5. Section „Einstellungen“ / "Settings": „Einstellungen“ / "Settings", hint „Darstellung und Sprache“ / "Appearance and language".
6. Section „Nutzungsdaten“ / "Usage data" with the switch „Nutzungsdaten und Fehlerberichte senden“ / "Send usage data and error reports" (hint: „Pseudonym an PostHog (Server in der EU), ohne Listeninhalte. Gilt für dieses Gerät. Ausschalten löscht die Kennung auf diesem Gerät.“): only when the build has an analytics key.
7. Section „Rechtliches“ / "Legal": „Impressum“ / "Imprint" (external), „Datenschutz“ / "Privacy" (external), „Lizenzen“ / "Licenses".
8. Version line „Version {version}“ (same in EN), version plus build number in brackets when there is a build number.

## How to get to it (user POV)

- Bottom tab „Mehr“ / "More" on phones (under 840 px); left rail button „Mehr“ from 840 px. Tapping the already-open tab returns to its first page (the list of entries).
- Help page: „Mehr“ → „Hilfe & Kontakt“ / "Help & contact" opens https://hummlist.com/support (German UI) or https://hummlist.com/en/support (English UI) in a new browser tab. The page „Hilfe und Kontakt“ gives the support email address support@hummlist.com and answers FAQs (invite partner, join with a code, export data, delete account, Hummlist Lifetime, usage data, Siri, Alexa, AI assistants, TestFlight/Google Play testing).
- Imprint: „Mehr“ → „Impressum“ opens https://hummlist.com/impressum (DE) or https://hummlist.com/en/imprint (EN). Privacy: „Datenschutz“ opens https://hummlist.com/datenschutz (DE) or https://hummlist.com/en/privacy (EN). On the login screen the same two links sit under the form as „Impressum · Datenschutz“.
- Guides on hummlist.com (not linked from anywhere in the app; each URL below answered 200 on 2026-11-01): German „Hummlist per Siri: Kurzbefehl einrichten“ at /de/anleitungen/siri-kurzbefehl, „Hummlist per Alexa: Skill einrichten“ at /de/anleitungen/alexa; English "Hummlist with Siri (German only for now)" at /en/guides/siri-shortcut and "Hummlist with Alexa (German only for now)" at /en/guides/alexa (English pages say the feature is German-only and point to the German guide).
- Deep links: /more, /more/access, /more/account, /more/invites, /more/lifetime, /more/settings, /more/settings/language.

## Driving it with Playwright

Preconditions:

- Seeded household „Familie Brandt“, signed in, consent declined, on the list (phone 390x844, or 1366x1024 for the wide layout).
- For the external pages stub the site so the test never hits the live site: `page.context().route('https://hummlist.com/**', r => r.fulfill({contentType:'text/html', body:'<title>stub</title>'}))`.
- More is a lazy list taller than the window: wheel to a row before clicking it (`wheelTo` helper in `e2e/tests/shell-more.spec.ts`/`help.spec.ts`: `page.mouse.wheel(0, 250)` over the list until the row is above the tab bar).

- **Open More.** Click the tab. `openTab(page, 'Mehr')` (phone: `getByRole('tab', {name:'Mehr', exact:true})`; rail: `getByRole('button', {name:'Mehr Tab '})`). URL `/more`, heading „Mehr“.
- **Open an entry.** `openMore(page, 'Einstellungen')` (taps Mehr, makes sure the list is shown, clicks `getByRole('button', {name: /^Einstellungen( |$)/})`). Rows are buttons whose accessible name is label + hint, so match with a start-anchored regex, e.g. `/^Konto Daten/`, `/^Läden/`, `/^Zugänge/`.
- **Help page.** `wheelTo(page, getByRole('button',{name:/^Hilfe & Kontakt/}))`, then `const popup = page.waitForEvent('popup'); await row.click()`. Observable: `(await popup).url()` equals `https://hummlist.com/support`; the app URL is unchanged. Spec: `e2e/tests/help.spec.ts` (also the English URL and 1366 px).
- **Imprint / Privacy.** Same popup pattern with `getByRole('button',{name:/^Impressum/})` and `/^Datenschutz/`; URLs `https://hummlist.com/impressum`, `https://hummlist.com/datenschutz`. Spec: `e2e/tests/shell-more.spec.ts`, `e2e/tests/legal.spec.ts` (login footer links).
- **Licenses.** Click `getByRole('button',{name:/^Lizenzen/})`. Observable: `page.locator('body').ariaSnapshot()` matches `/Hummlist[\s\S]*Flutter[\s\S]*bloc/`; „Zurück“ returns.
- **Version.** `page.getByText(/^Version \d+\.\d+\.\d+/)` visible at the end of the list.
- **Sign out.** Click `getByRole('button',{name:/^Abmelden/})`. Observable: `getByRole('textbox',{name:'E-Mail'})` visible, URL contains `/login`.
- **Wide layout.** `page.setViewportSize({width:1366,height:1024})`, click `getByRole('button',{name:/^Mehr Tab/})`. Observable: the entries and `getByText('MCP-Server',{exact:true})` side by side; „Zurück“ buttons absent; clicking `/^Konto Daten/` shows Konto alone (URL `/more/account`). At 820 px the bottom tabs return.
- Specs to run: `scripts/verify.sh --only e2e -- tests/shell-more.spec.ts`, `tests/help.spec.ts`, `tests/legal.spec.ts`.

## Gotchas

- „Archivierte Haushalte“ shows only in builds with HOUSEHOLD_ARCHIVE (the e2e build has it; a normal user does not see it). „Hilfe & Kontakt“ is on for everyone now (the help page is published).
- „Nutzungsdaten“ section and switch exist only when the build has an analytics key. Production has one: the app.hummlist.com bundle carries a PostHog project key, and the store builds get it from the `release` environment secret (checked 2026-11-01). The e2e and verify-hummlist builds carry the stand-in key, so the switch shows there too.
- „Partner einladen“ is absent for a signed-in user without a household.
- Premium row hint: a household without Premium sees „Siri, Alexa und KI-Assistenten“ under „Hummlist Premium“ even though Premium is not on sale (driven 2026-11-01).
- On the phone the tab is role `tab`; on the rail it is role `button` named "Mehr Tab …". Use `openTab`.
- Pages open by deep link: back goes to the More list, not out of the app.
- Opening hummlist.com pages stays external everywhere; never an in-app browser. Real site pages are not reachable offline; stub them.
- Long-press on the version line (touch only in practice) toggles „Interne Installation“ and shows „Testfehler senden“; internal testers only, not for copy.
- Wide More page title: „Mehr“ heading; language page adds a back button next to its title.
