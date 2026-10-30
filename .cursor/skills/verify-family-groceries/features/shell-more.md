# Shell and More

The signed-in app has two tabs: "Liste" (the shopping list with the add bar) and "Mehr". On phones they sit in a bar at the bottom, which slides away while the add sheet is open; from 840 px wide they become a rail on the left. The More tab gathers what the old list menu held and more: the household (invite, join, categories, stores), Zugänge, Konto and sign-out, the language, and the legal pages, with the app version at the bottom. The language switch (Wie Gerät, Deutsch, English) applies at once and is kept on the device, across restarts and sign-out.

## Sub-features

- `sm-tabs` switches between `tab-list` ("Liste") and `tab-more` ("Mehr"). Each tab reopens the page it last showed; a tap on the current tab goes back to its first page. Leaving the list tab closes the add sheet.
- `sm-household` opens "Mitglied einladen" (`more-invite`, the invite dialog with the code; shown with a household only), "Anderem Haushalt beitreten" (`more-join`, the code dialog), "Kategorien verwalten" (`more-categories`, `features/categories.md`) and "Läden" (`more-stores`, `features/stores.md`).
- `sm-stores` lists the stores on `stores-screen`. A row `store-row-<id>` opens "<Store>: Reihenfolge"; a drag on "<Store> verschieben" reorders the stores.
- `sm-access` opens the Zugänge page (`more-access` → `access-screen`, route `/more/access`: MCP-Server, Zugriffstoken, Verbundene Apps; `features/mcp-access.md`).
- `sm-account` opens the Konto page (`menu-account` → `account-screen`, route `/more/account`: the signed-in email, export, deletion; `features/account.md`). Zugänge and Konto are two pages (job 29d); each has a back arrow to More.
- `sm-old-links` the routes of the one page they were before keep working: `/settings` redirects to `/more/access`, `/settings?section=account` to `/more/account`.
- `sm-sign-out` signs out (`more-sign-out`, "Abmelden") and shows the login screen (`features/auth.md`).
- `sm-feedback` opens the feedback form (`more-feedback`, "Feedback senden", section "Feedback" before Sprache): `features/feedback.md`.
- `sm-language` switches the whole UI with `language-system` ("Wie Gerät"), `language-de` ("Deutsch") or `language-en` ("English") in `more-language`. The pick survives `fg restart` and sign-out.
- `sm-imprint` opens the imprint on the web (`more-imprint`, external: https://hummlist.com/impressum).
- `sm-privacy` shows the draft privacy page (`more-privacy` → `privacy-draft`, chip "Entwurf", "Die Datenschutzerklärung von Hummlist wird gerade geschrieben …") while no privacy URL is configured.
- `sm-licenses` opens Flutter's license page for "Hummlist" with the version (`more-licenses`).
- `sm-version` shows "Version <version> (<build>)" at the bottom (`more-version`). A long press marks the device internal for analytics (`features/analytics.md`, `an-internal`).
- `sm-analytics` "Nutzungsdaten" (`more-analytics`) between Sprache and Rechtliches, only in builds with a PostHog key (not fg builds): `features/analytics.md`, `an-switch`.
- `sm-wide` from 840 px: a NavigationRail instead of the bar, the add sheet as wide as the list column, and More in two panes (the list on the left, Zugänge or the picked page on the right, without a back arrow).

## How to get to it (user POV)

- Tap "Mehr" in the tab bar (or the rail on a wide screen). Tap "Liste" to go back.
- Scroll down the More list for Konto, Abmelden, Sprache and Rechtliches.

## Driving it with fg

Preconditions:

- Baseline from `features/README.md`; peter signed in on the list.
- `H="(select id from households where name = 'Familie Test')"`; the store ids from `fg db query "select id, name from stores where household_id = $H order by sort_order" --as peter`.

- **`sm-tabs`.** Run `fg tap --key tab-more` and `fg wait --key more-screen` (if it times out, More reopened its last page: tap `tab-more` again); `fg screenshot --name sm-more`. `fg find --key add-item-field` counts 0. `fg tap --key tab-list` and `fg wait --key add-item-field` return to the list. Leaving closes the sheet: `fg tap --key add-item-field`, `fg wait --key add-sheet`, `fg press escape`; with the sheet open the tabs are out of reach (`fg tap --key tab-more` fails with `not_found`, and `fg find --key add-sheet-hint` shows the hint in their place), so close it first.
- **`sm-household`.** On More, `fg marionette -- scroll-to --key more-invite` (the list keeps its scroll position), `fg tap --key more-invite`, `fg wait --text Code`, and the code is `fg find --type Text | jq -r '[.elements[].text | select(test("^[A-Z2-9]{8}$"))][0]'`; `fg back` closes the dialog. `fg tap --key more-join`, `fg wait --label Einladungscode`, `fg back`. `fg tap --key more-categories`, `fg wait --text Kategorien`, `fg back`, `fg wait --key more-screen`.
- **`sm-stores`.** `fg tap --key more-stores`, `fg wait --key stores-screen`. `fg find --contains verschieben` lists "dm verschieben", "Lidl verschieben", "Edeka verschieben". `fg tap --key store-row-<dm id>` and `fg wait --text "dm: Reihenfolge"`; `fg back` twice returns to More. Reordering: `features/stores.md` (Stores screen).
- **`sm-access`.** `fg tap --key more-access`, `fg wait --text "Verbundene Apps"`, `fg screenshot --name sm-access`. Run `fg tap --key tab-list`, then `fg tap --key tab-more`: Zugänge shows again (`fg wait --text "Verbundene Apps"`), the tab kept its page. A second `fg tap --key tab-more` goes to the More list (`fg wait --key more-screen`). `fg tap --key more-access` again, then `fg back` also returns to the More list; `fg find --key account-delete` on Zugänge counts 0.
- **`sm-account`.** `fg marionette -- scroll-to --key menu-account`, `fg tap --key menu-account`, `fg wait --key account-screen`; `fg find --key account-email` shows `peter@fg.test`, `fg find --key account-export` and `fg find --key account-delete` count 1, `fg find --text MCP-Server` counts 0. `fg screenshot --name sm-account`. `fg back` (or `fg tap --key tab-more`) returns to the list of entries.
- **`sm-old-links`.** Not drivable with fg (no URL bar on the desktop client); the widget tests in `app/test/more/more_screen_test.dart` ("the link /settings… opens …") and the web e2e test "old /settings links open the right page; back from a deep link goes to More" (`e2e/tests/shell-more.spec.ts`) cover it. Report it as skipped.
- **`sm-privacy`.** `fg marionette -- scroll-to --key more-licenses`, `fg tap --key more-privacy`, `fg wait --key privacy-draft`. `fg find --text Entwurf` counts 1 and `fg find --contains Datenschutzerklärung` counts 1; `fg screenshot --name sm-privacy`. `fg back` returns to More (`fg wait --key more-screen`).
- **`sm-licenses`, `sm-version`.** `fg marionette -- scroll-to --key more-licenses`, then `fg find --key more-version` shows "Version 0.1.0 (1)" (the checkout's `pubspec.yaml` version). `fg tap --key more-licenses`, `fg wait --text Hummlist`, and `fg find --contains 0.1.0` returns "0.1.0 (1)"; `fg screenshot --name sm-licenses`. `fg back`, `fg wait --key more-screen`.
- **`sm-imprint`.** `fg tap --key more-imprint` (after the scroll-to above). The app hands the URL to the desktop: on the build box `pgrep -af hummlist.com/impressum` shows `google-chrome-stable https://hummlist.com/impressum`. Stop that browser with `kill <pid>` from that line; the app stays on More.
- **`sm-language`.** `fg marionette -- scroll-to --key more-licenses`, `fg screenshot --name sm-language-before` ("Wie Gerät" is picked), `fg tap --key language-en`, `fg wait --text More`: the app bar, every entry and the tabs read English at once ("Sign out", "Language", "List"). Run `fg restart` and `fg wait --key add-item-field`: `fg find --key add-item-field` has the label "What do you need?". Run `fg logout`, then `fg find --type Text` lists "Sign in": the pick outlives the session. `fg login peter`, `fg tap --key tab-more`, `fg marionette -- scroll-to --key more-licenses`, `fg tap --key language-system`, `fg wait --text Mehr` restore German.
- **`sm-sign-out`.** `fg tap --key tab-more`, `fg marionette -- scroll-to --key more-sign-out`, `fg tap --key more-sign-out`, `fg wait --key login-email`. `fg logout` does the same. `fg login peter` signs in again.
- **`sm-wide`.** Not drivable on linux: the client's Xvfb screen is fixed at 412×892, below the 840 px breakpoint. Report it as skipped; the web e2e test "wide screens: a rail, a sheet as wide as the list column, More in two panes" (`e2e/tests/shell-more.spec.ts`) covers it.
- **Proof.** Screenshots `sm-more`, `sm-access`, `sm-account`, `sm-privacy`, `sm-licenses`, the language before and after, and the login screen in English.

## Gotchas

- More is a lazy ListView. On a 412×892 client, `menu-account`, `more-sign-out`, the language buttons and the legal entries are not built until you scroll: `fg tap --key more-privacy` fails with `not_found` before `fg marionette -- scroll-to --key more-licenses`.
- `fg back` on the More list itself closes the Linux app ("Back button pressed, no route to pop (app may exit)"; `fg doctor` then shows `peter.process: not running`, `fg up` relaunches it). Since job 29d Zugänge and Konto are routes below `/more` like the privacy draft, so `fg back` (and Android's back button) there returns to the More list. `fg back` is also safe on the licenses, the stores and categories screens and in dialogs.
- The language buttons' texts are not listed by `fg find`; tap them by key. After a switch every text match changes language: `fg logout` and `fg login` use keys and work in both, but recipes that match German text need `language-system` (or `language-de`) back.
- The open add sheet hides the tabs: tap `add-sheet-close` or `fg press escape` before `fg tap --key tab-more`. `fg logout` does that for you.
- `more-invite` shows only while the user is in a household.
- The More list keeps its scroll position while the app runs. Scroll to an entry at the top (`more-invite`) as well as to one at the bottom.
- When `fg up` rebuilds the app for another client, the bundle on disk changes under a client that keeps running: icons render as boxes and `more-version` is empty. `fg restart` that client (or `fg up`, which relaunches stale ones).
