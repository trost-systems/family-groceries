# More menu research (job 79)

This note collects how well-rated apps and the platform guidelines build their menu or settings screen. It feeds the redesign of the Hummlist "Mehr" tab: menu items only, no inline toggles, and an optional update card at the top.

Evidence levels used below:

- **Opened**: I fetched the page and read it.
- **Snippet**: the fact came from a web search result summary; I did not open the page. None are left after the second pass, except where a section says so.
- **(unverified)**: general knowledge, no source checked. Treat as a hypothesis to confirm on a device or in a screenshot.

Apple's HIG pages render client-side. The second pass read them from the JSON behind the page (`developer.apple.com/tutorials/data/design/human-interface-guidelines/<page>.json`). Apple's HIG gives no spacing numbers for lists, so every Apple point or pt value below is still (unverified). The m3.material.io pages also render client-side: the fetch returned only titles on the second pass.

## Android settings pattern (Material guidance)

Opened. Source: Android Developers, "Settings" design pattern.

- Settings hold infrequently accessed preferences. Frequent actions belong next to the feature they affect.
- Avoid app info (version number, licensing) and account management in settings. Put account, app info, help and feedback on their own screens.
- "Settings" goes after all other items in a drawer or top bar menu, except "Help & Feedback".
- Group settings in small groups. Use visual containment and headings between groups, not per-item decoration.
- For 15 or more settings, move related ones to a subscreen. The row label must match the subscreen title.
- Keep the overview short: show the most important settings with their values as secondary text.
- Icons should clarify meaning or show status, not decorate.
- Labels: brief, most important word first, no generic verbs such as Set, Change, Manage, no repeated section words. Skip secondary text when the label is enough.
- Do not stretch a single pane list to full width on large screens. Set a max width.

Relevance: a clear case for a Privacy subscreen, short labels, and a max width on web.

## Material 3 lists and dividers

Lists. Source: m3.material.io lists specs, first pass only. That fetch returned the list item heights: 56, 72 and 88 dp (one, two, three lines). A second fetch of the specs and guidelines pages returned only the page title, so the heights were not re-checked and no padding or icon value was read.

Still (unverified), general knowledge: 16 dp leading and trailing padding, 24 dp leading icons, 16 dp between icon and text, a 56 dp one-line item with a leading icon.

Dividers. Opened. Source: material-components-android, `docs/components/Divider.md`.

- The regular divider is 1 dp thick by default. The heavy divider is 8 dp.
- Heavy dividers mark "a visual break or stop between major sections in a long page".
- Inset dividers "separate related content within a section". Full width dividers "separate larger sections of unrelated content".
- Start and end insets default to 0 dp, so dividers are full-bleed unless set.

Relevance: between groups a full width 1 dp line or whitespace fits. An 8 dp heavy divider is a precedent for a gap of about that size, not 24 dp.

## Google Play in-app updates

Opened. Source: Android Developers, "In-app updates".

- Flexible: the update downloads in the background while the user keeps using the app. Use it when the update is not critical, for example to encourage a new feature.
- Immediate: a full-screen flow that blocks the app until the user updates and restarts. Use it only when the update is critical.
- Supported on Android 5.0 (API 21) and up. Not compatible with apps that use APK expansion files.
- The page does not specify banner or snackbar wording.

Relevance: the Hummlist update card maps to flexible. Immediate should stay reserved for a forced minimum version.

## Shorebird code push

Opened. Source: Shorebird blog, "Manually control your Shorebird updates".

- A downloaded patch takes effect only after a restart. Pair the download with either a forced restart or a clear prompt to relaunch.
- Do not await the update check in a way that blocks the UI (for example in `initState` of the home screen). Run it in the background or on a splash screen.
- With `in_app_update` on Android, call `readCurrentPatch()` first and skip the store prompt if the patch already fixes the issue, so the user does not get two conflicting messages.
- Catch `UpdateException` and surface its message only if you show errors.

Snippet (not opened): the Shorebird v2 blog and pub.dev example show a banner flow: update available, downloading, restart required.

## iOS Settings app

Opened (partly). Sources: HIG "Settings" and "Lists and tables" (JSON), UIKit `UITableView.Style.insetGrouped`.

- UIKit describes inset grouped as "A table view where the grouped sections are inset with rounded corners." Opened.
- HIG Lists and tables: the grouped style "uses headers, footers, and additional space to separate groups of data". It names iOS Settings as an example of "a hierarchy of lists". Opened.
- HIG Settings: the system Settings app covers system appearance, network, "account details", accessibility, and language and region. Opened.

Not read from any source, so (unverified), general knowledge of the iOS Settings screens:

- The account block (Apple Account) is first and visually distinct, with a large row.
- Rows have a colored rounded-square icon tile with a white glyph, a label, an optional value, and a chevron for navigation.
- Row height is about 44 pt minimum. The gap between groups is about 35 pt. Content margin is about 16 to 20 pt.
- Privacy & Security is a single row that opens a subscreen. Analytics toggles sit deep inside it.
- No sign out row. Erase All Content and Settings sits at the end of General, in a subscreen.
- App version lives in General > About.

## Apple Human Interface Guidelines

Opened. Sources: the HIG pages Lists and tables, Settings, Buttons, Alerts and Privacy, read as JSON.

Settings page:

- Put "general, infrequently changed settings" in the settings area. It lists "options related to people's accounts" as an example.
- Minimize the number of settings.
- Prefer letting people change task-specific options where the task is, "like showing or hiding parts of the current view, reordering ... or filtering a list".
- Do not offer custom versions of system-wide settings (accessibility, authentication). It confuses people.
- Where it makes sense, add only rarely changed options to the system Settings app and "consider providing a button that opens it directly from your interface".
- For watchOS, offer "a small number of essential options" at the bottom of the main view.

Lists and tables page:

- Keep item text succinct.
- "When possible, limit the number of rows."
- Use a disclosure indicator to drill into a row's subviews. An info button "doesn't support navigation".
- Avoid an alphabet index on a table that has trailing controls such as disclosure indicators.
- The grouped style uses headers, footers and extra space to separate groups.

Buttons and Alerts pages:

- The destructive button role uses the system red. Do not give the primary role to a destructive action, even if it is the most likely one.
- Avoid alerts for common, undoable actions. For an uncommon destructive action that cannot be undone, show an alert.
- Use a specific button title such as "Delete", not "OK". Always call the cancel button "Cancel", and do not make it the default.
- Use the destructive style on a button that does something people did not deliberately choose. If they chose Empty Trash on purpose, the confirm button is not styled destructive.

Privacy page:

- People can view and update a permission choice in Settings > Privacy. Never put a custom screen in front of the system permission alert.

Still (unverified): that a chevron is absent on rows that open an external page. The HIG pages above say nothing about external links.

## Things 3

Opened. Source: Cultured Code support article 2803590 (Things Cloud troubleshooting). The in-app path is "Things > Settings > Things Cloud". The earlier Things URLs article gave Settings > General > Things URLs. So settings has at least General and Things Cloud entries.

Still (unverified), general knowledge: the settings screen is an inset grouped list with colored icon tiles, Things Cloud (the account) first, and help and about info at the bottom.

## Todoist

Opened. Sources: Todoist help, "Delete your Todoist account" and "Log in or out of Todoist".

- iOS and Android: Browse tab (bottom-right), gear icon (top-right), then Account, then Delete Account. On iOS a Continue step follows.
- Log out: same route, Browse, gear, then Log out. On iPad the gear is top-left. So Log out sits on the settings screen and Delete Account one level deeper, inside Account.
- Web and desktop: avatar (top-left), Settings, Delete account; log out is under the avatar.
- Direct-billed plans cancel with the account. Subscriptions bought through Apple or Google do not, and "you may still be charged". Cancel them in the store.
- The password is required to confirm. Google and Apple sign-ins must add one first.
- "Account deletion is permanent and irreversible."
- Logging out with unsynced changes shows a warning with Cancel, because those changes would be deleted.

Still (unverified): how Todoist groups its other settings.

Relevance: Log out on the first settings level, Delete one level deeper, and a store subscription warning.

## Bring!

Opened. Source: Bring! "Delete account" page. Route: Profile tab (lower right), Settings, More settings, then scroll down to the delete option. Deletion cannot be restored, all data tied to the account is lost, and the app must be installed to do it. The page offers a deeplink and an email address if the option cannot be found.

Relevance: a grocery-list competitor. Delete is behind two taps and a scroll, not on the first screen.

## AnyList

Opened. Source: AnyList help, "Delete account". In the iOS or Android app: Settings tab, tap the Account row, tap the More Actions (three dots) button, choose Delete Account, Request Account Deletion. A confirmation email follows, then a password on a Delete Account page. The data "cannot be recovered". The website does the same from the Account page.

Relevance: three steps deep, and confirmed by email. Settings is a tab, with Account as a row.

Still (unverified): the rest of AnyList's settings layout.

## Revolut

Opened. Source: Revolut help, "Closing account" (en-GB). In the app: tap the profile icon (top-left), select Settings, tap Close account. Prerequisites include zero balances, no pending transactions or active subscriptions, a Standard plan and the latest app version.

So closing is reachable from the profile icon and a Settings screen, with preconditions listed before the action.

Still (unverified), general knowledge: the profile screen shows name and plan, then grouped sections with monochrome line icons and chevrons, and Log out is a red text button at the bottom.

## Spotify

Opened. Source: Spotify support, "How to log out of Spotify" (ie). Mobile: tap the profile picture at the top, tap "Settings and privacy", scroll to the lowest part of the menu, tap "Log out". Settings are reached from the profile picture, not a Home gear, and Log out is at the bottom.

A search summary of the same page also mentions "Sign out everywhere". That was not in the page text I opened, so treat it as a snippet.

Still (unverified): section names inside Settings and privacy, text-only rows, version under About.

## Duolingo

Snippet only. The search found no official support page. Third-party guides, which may be outdated: on web, profile menu, Settings, Account tab, scroll to the bottom for "Delete my account", confirm with the password. One guide mentions Settings > Privacy. Nothing about the app layout is verified. Treat as (unverified).

## Patterns across the apps

Rows marked (unverified) rest on general knowledge. Delete account, Log out and Settings placement rest on the opened help pages above.

| Topic | Common practice |
| --- | --- |
| Account | Its own row or screen (Todoist, AnyList, Revolut; Android guidance). First in iOS Settings (unverified). |
| Preferences | Middle, grouped by topic. |
| Help and support | Near the end. |
| Legal, about, licenses, version | Last, or under an "About" subscreen. |
| Sign out | Bottom of the list (Spotify, opened) or on the settings screen itself (Todoist, opened). Styling (red, centered) and iOS Settings having none are (unverified). |
| Delete account | Inside Account or at the bottom of a deep screen, never on the first screen (Todoist, Bring, AnyList, Revolut; all opened). |
| Privacy and analytics toggles | A Privacy subscreen (Spotify's "Settings and privacy" is opened; iOS Privacy & Security is unverified). |
| Icons | iOS: colored tiles (unverified). Material: monochrome. Revolut monochrome, Spotify none (both unverified). |
| Section headers | Optional. iOS leaves most groups unnamed. Material uses headings between groups. |

## Takeaways for Hummlist

1. **Order by frequency, with account last.** Household first (invite, join, archived, Premium), then Access (MCP, API tokens, connected apps), then Settings (theme, language), then Help, Feedback, then Account, then Legal. Frequent household actions come before rarely used account actions.
2. **Use whitespace groups with short headers only where the group is not obvious.** The Android guidance asks for headings between groups. Use small secondary-colored headers for Household, Access, Account. Leave Help and Legal unnamed or use a single "About" header.
3. **Section spacing: about 24 dp between groups, 8 dp between header and first row.** iOS uses about 35 pt (unverified). The only opened numbers are Material's 1 dp and 8 dp dividers. HIG says only "additional space". On a 358 px compact layout 24 dp reads better and still separates clearly. Test both on the 358 px film.
4. **Row density: one line, 56 dp minimum.** This matches the M3 one-line height (opened). Use two lines (72 dp) only when a row needs a status such as "Premium active" or "3 connected apps". Keep 16 dp horizontal padding (unverified for M3). HIG also says to limit the number of rows.
5. **Icons: monochrome, one weight, one size (24 dp).** Colored iOS tiles add noise for a 15-row menu and clash with the Hummlist look. Android guidance says icons should clarify meaning. Give every row an icon or none, never a mix.
6. **Chevron means "opens a screen in the app" (HIG: disclosure indicator drills into subviews). External links get an arrow-out icon (our choice; HIG is silent).** Help and contact, Imprint and Privacy policy open web pages, so they get the external icon, not a chevron. Licenses opens an in-app page, so it gets a chevron.
7. **Destructive items: Sign out is a plain row at the end of Account. Delete account is inside the Account screen.** Do not put Delete account on the first screen (Todoist, Bring, AnyList and Revolut all hide it one or more levels deep; Todoist keeps Log out one level higher). Style it with the error color, and confirm with a dialog whose button says "Delete", not "OK", with a plain "Cancel" that is not the default (HIG Alerts). Mention the store subscription, as Todoist does. Say it cannot be undone.
8. **Privacy submenu.** Move the analytics consent toggle into a "Privacy" row that opens a subscreen with the toggle, a short explanation and a link to the policy. Android guidance wants the label to match the subscreen title. This also keeps the main list free of controls. HIG Settings supports this: settings hold infrequently changed options, and task options belong where the task is. It also says not to duplicate system-wide settings, so permission changes link to the system Settings app.
9. **Version footer: small, centered, secondary text at the very end** ("Hummlist 1.4.2 (123)"). Keep the long-press for an internal install. Android guidance prefers app info on a separate screen. A footer line is a lighter alternative, and the long-press gesture keeps it quiet. If the list grows, move it to an About subscreen next to Licenses.
10. **Update card at the top, only when needed.** One card, one action. For a Shorebird patch: "Update ready" with a "Restart" button, shown after the patch is downloaded, since it needs a restart. For a newer store version: "New version available" with an "Update" button that opens the store (flexible, not immediate). On Android, skip the store card if a patch already fixes the issue (Shorebird guidance). Never block the menu behind the card, and let the user dismiss it.
11. **Keep labels short and noun-first.** Use "Household", "Invite partner", "API tokens". Avoid Manage, Set, Change (Android guidance). The row label equals the subscreen title.
12. **Limit width on web and tablets.** Cap the list at about 600 dp and center it, as the Android guidance says not to stretch single pane settings.

## Sources

All opened. Apple pages were read as JSON from `developer.apple.com/tutorials/data/...`; the links are the public pages.

- [Android Developers: Settings design pattern](https://developer.android.com/design/ui/mobile/guides/patterns/settings)
- [Android Developers: In-app updates](https://developer.android.com/guide/playcore/in-app-updates)
- [Shorebird: Manually control your Shorebird updates](https://shorebird.dev/blog/manual-control-of-your-shorebird-updates)
- [Apple HIG: Settings](https://developer.apple.com/design/human-interface-guidelines/settings)
- [Apple HIG: Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables)
- [Apple HIG: Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)
- [Apple HIG: Alerts](https://developer.apple.com/design/human-interface-guidelines/alerts)
- [Apple HIG: Privacy](https://developer.apple.com/design/human-interface-guidelines/privacy)
- [Apple: UITableView.Style.insetGrouped](https://developer.apple.com/documentation/uikit/uitableview/style/insetgrouped)
- [material-components-android: Divider.md](https://raw.githubusercontent.com/material-components/material-components-android/master/docs/components/Divider.md)
- [Material Design 3: Lists specs](https://m3.material.io/components/lists/specs) (first pass: item heights only; second pass: title only)
- [Flutter API: CupertinoListSection.insetGrouped](https://api.flutter.dev/flutter/cupertino/CupertinoListSection/CupertinoListSection.insetGrouped.html) (constants named, no values)
- [Cultured Code: Things Cloud troubleshooting](https://culturedcode.com/things/support/articles/2803590/)
- [Cultured Code: Things URLs](https://culturedcode.com/things/support/articles/2803573/)
- [Todoist: Delete your Todoist account](https://www.todoist.com/help/articles/delete-your-account-luq3xH)
- [Todoist: Log in or out of Todoist](https://todoist.com/help/articles/205064582)
- [Bring!: Delete account](https://getbring.com/en/delete-account)
- [AnyList: Delete account](https://help.anylist.com/articles/delete-account/)
- [Revolut: Closing account](https://help.revolut.com/en-GB/help/profile-and-plan/closing-account/)
- [Spotify: How to log out](https://support.spotify.com/ie/article/how-to-log-out/)

Seen in search results only, not opened:

- [AnyList: Sync devices](https://help.anylist.com/articles/sync-devices/)
- [Shorebird: Code Push package v2](https://shorebird.dev/blog/shorebird-code-push-v2)
- [pub.dev: shorebird_code_push example](https://pub.dev/packages/shorebird_code_push/example)
- Duolingo: only third-party guides, no official page found.

Not checked by any source: iOS Settings screen layout and measurements, Material 3 list padding and icon sizes, Duolingo app layout, Revolut and Spotify layout beyond the paths above.
