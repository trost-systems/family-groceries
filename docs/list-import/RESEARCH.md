# Importing lists from other apps into Snacklist (job 193, phase 1)

Research only, 2026-11-11. No code, no prototype. The per-app notes with a source URL for every
claim are in `notes/`: `bring-listonic.md`, `anylist-ourgroceries-outofmilk.md` and
`todo-apps.md`. The matrix below repeats the main URL per app. UNVERIFIED marks claims without a
primary source.

## The answer in 10 lines

1. Most apps on the list can put a list out as **text** (share sheet, email, copy or print), and
   none documents what that text looks like. No verbatim sample was found for any app. UNVERIFIED
   for four: Todoist documents no copy-as-text, Listonic's sources conflict (a link, or the list
   in the message), Microsoft To Do's
   email is reported to drop items, and the iOS Reminders rendering is unknown.
2. Only 3 apps have a **file export** a household could manage: Todoist (CSV per project),
   Out of Milk (CSV) and OurGroceries (ZIP with XLSX and JSON, web only). Keep has Google Takeout
   (every note at once).
3. **APIs** exist officially only for Todoist (OAuth with PKCE) and Microsoft To Do (Graph,
   `Tasks.Read`). Bring!, AnyList, OurGroceries and Listonic have only reverse-engineered APIs that
   take the user's password. Listonic's terms forbid automated access (§7f; §7e forbids reverse
   engineering); OurGroceries' terms forbid reverse engineering (§6(c)) and access "in ways we do
   not authorize" (§6(g)), which arguably covers it.
4. Categories and stores mostly do not survive. Names survive everywhere. Quantities are free
   text in Todoist, Keep and To Do, separate fields in Bring! (`specification`) and Listonic
   (`Amount`, `Unit`); how those render in shared text is UNVERIFIED.
5. So the import that covers the most households is **paste-any-text**: a tolerant line parser on the
   device, a preview with checkboxes, then the normal item add. Snacklist's server classifier
   re-sorts every item into the household's stores and categories, so lost categories cost nothing.
6. Today a pasted multi-line list becomes **one item** in both "Was fehlt gerade?" and the
   list's add field: "Milch Brot Eier" on the web (Chromium turns newlines into spaces; driven in
   review 0), "MilchBrotEier" on iOS and Android (Flutter deletes `\n`; Flutter widget test, not a
   phone). Both fields also stop at 120 characters, so a long list is cut before any app code
   sees it. An import therefore needs its own paste route, not the existing fields as they are.
7. **share-to-snacklist** (the OS share sheet) is the nicer route on phones and reuses the same
   parser, for 4 more lane-days (an iOS share extension). Do it second.
8. **file-import-csv** covers Todoist, Out of Milk and OurGroceries power users only. Do it last,
   or not at all.
9. Linking another app's account (password or OAuth) and reading Apple Reminders directly
   (full read-write access to all reminders) are out: credentials, terms, and data far beyond the
   one list the user wants.
10. Recommendation: paste-any-text in onboarding's "Was fehlt gerade?" and on the empty list,
    through a button or its own paste area: 3 lane-days plus the five-prototype review (4.5 if
    the existing fields must detect a paste themselves). Five questions for Peter at the end.

## What exists in Snacklist today (main c5d2d211)

- **Onboarding** (`docs/onboarding/PLAN.md`, "Phase 2: what was built"): welcome, consent,
  „Mit wem kaufst du ein?“, name, stores, **„Was fehlt gerade?“** (12 staple chips and one field),
  account, setup, invite, list. Everything before the account is a draft in `DeviceCache`
  (`app/lib/onboarding/draft.dart`); at setup each draft item goes through `parseEntry` and an
  `AddItem` op (`app/lib/onboarding/onboarding_cubit.dart:51-80`), one call per item, and the
  server's `classify_item` sorts it. The feature map says „Importing a list from another app: not
  built.“ (`.cursor/skills/verify-snacklist/features/FEATURES-FOR-WRITERS.md:113`).
- **The two add fields are single-line.** „Was fehlt gerade?“ (`app/lib/onboarding/steps.dart:505`)
  and the list's add field (`app/lib/list/list_screen.dart:709`) use the default `maxLines: 1`, and
  Flutter then prepends `FilteringTextInputFormatter.singleLineFormatter`, which is
  `deny('\n')` (`flutter/lib/src/widgets/editable_text.dart:967-972`,
  `services/text_formatter.dart:425`). Both fields also cap input at 120 characters
  (`LengthLimitingTextInputFormatter(120)`; `maxLength: 120`, enforced). What a paste of
  "Milch\nBrot\nEier" does, per platform:
  - **Web, driven** (review 0, verify-snacklist on the web build, Ctrl+V through the real
    clipboard): Chromium's single-line `<input>` turns the newlines into spaces before Flutter
    sees them. Both fields hold "Milch Brot Eier"; Enter stores one item of that name. Evidence:
    `groceries-ops/jobs/193-list-import-research/review0-evidence/`.
  - **iOS and Android, framework-tested** (fix round 0: a throwaway Flutter widget test, both the
    input path and Flutter's own paste action, not run on a phone): "MilchBrotEier", glued without
    spaces. A 40-line paste stops at 120 characters, inside line 13. Evidence:
    `groceries-ops/jobs/193-list-import-research/fix0-evidence/README.md`.
  - **Even a multi-line field keeps only part of a list**: in review 0's probe (`maxLines: null` on
    the need field, a clone only) a 40-line paste kept its newlines, but the 120 cap cut it after
    11 lines.
- **Parsing on the device:** `parseEntry` in `app/lib/list/entry.dart:94` splits one line into
  name and quantity ("2 Gurken", "Hack 500 g"). The server's German sentence splitter for Siri and
  dictation is `supabase/functions/voice/parse.ts` (`parseSentence`, at most 30 items); it needs a
  signed-in call, so it cannot serve the pre-account draft.
- **Clipboard prior art:** „Einladung einfügen“ (`app/lib/household/paste_invite.dart`) reads the
  clipboard only on the user's tap and parses an invite out of a whole shared message. An import
  button can follow the same pattern.
- **Share prior art:** the app only sends (`share_plus`). It has no share target on any platform.
  iOS already has an app extension (`app/ios/HomeWidget`), so app groups and extension signing exist.

## Per-app matrix

"Text out" is what the user can send or copy out of the app. "Survives" is what a text or file
route carries; API-only data is in the notes. "DE relevance" is an estimate from store listings
and the notes, not a measured share.

| App | DE relevance | Text out | File export | API | Survives (text/file) | Credentials / terms | Best route in |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Bring!** ([help](https://getbring.com/help-center-main-categories/items-lists)) | Highest in DACH (20 M+ users, company figure, `docs/onboarding/research/comparable-apps.md`) | „Liste senden“ via the share sheet; iOS „Save to Files“, Android print to PDF. Text format UNVERIFIED | None; GDPR portability on request to feedback@bringlabs.com, no format stated ([privacy](https://getbring.com/en/legal/privacy.html)) | None official; [`bring-api`](https://github.com/miaucl/bring-api) needs email and password (Home Assistant uses it) | Names; specification ("2 Liter") likely; sections UNVERIFIED | Terms silent on automated access ([terms](https://getbring.com/en/terms-of-use)); SSO users have no password | Share or paste text |
| **Listonic** ([help](https://help.listonic.com/en)) | High (DE, PL) | Share as text, email or link; sources conflict: recipients "will see the list" (help snippet) vs a shared link; help pages return 403, UNVERIFIED | None; GDPR portability on request by email ([privacy](https://listonic.com/privacy)) | Unofficial only; §7f forbids bots and scripts, §7e reverse engineering ([ToS](https://listonic.com/terms-of-service)) | Names; amounts UNVERIFIED | Lists can live without an account | Share or paste text |
| **AnyList** ([help](https://help.anylist.com/topics/lists/list-sharing)) | Medium (German UI, US-centric) | „Share, Email & Print“; format UNVERIFIED | None found (user claim, [Trustpilot](https://nz.trustpilot.com/review/www.anylist.com)) | Unofficial ([`anylist`](https://unpkg.com/anylist@0.8.6/README.md)), password | Names, quantity likely | Terms silent; password needed | Share or paste text |
| **OurGroceries** ([guide](https://www.ourgroceries.com/user-guide)) | Medium-high (German UI) | Email or text, "single-column" ([App Store](https://apps.apple.com/us/app/-/id325851015)) | Web: ZIP with README, XLSX, JSON; fields UNVERIFIED | Unofficial, password; terms forbid reverse engineering (§6(c)) and access "in ways we do not authorize" (§6(g)), which arguably covers it ([terms](https://www.ourgroceries.com/terms)) | Names, categories, notes, crossed-off (JSON, UNVERIFIED) | One shared account per household | Paste text; XLSX/JSON file |
| **Out of Milk** ([store](https://apps.apple.com/us/app/-/id564974992)) | Low-medium (German UI, US audience) | Text or email share | CSV (Android menu, website); columns UNVERIFIED (help site returned 403, claims from search snippets) | None found | Names, more UNVERIFIED | Terms not checked (UNVERIFIED) | CSV file or paste |
| **Todoist** ([CSV](https://www.todoist.com/help/articles/import-or-export-a-project-as-a-csv-file-in-todoist-YC8YvN)) | Medium (general to-do app) | No documented copy-as-text | CSV per project: `TYPE` (task/section/note), `CONTENT`, `DESCRIPTION`, `INDENT`, `RESPONSIBLE`, … ([format](https://todoist.com/help/articles/format-a-csv-file-to-import-into-todoist-UVUXTmm6)); no completed tasks, 300 tasks per project | Official API v1, OAuth PKCE, `data:read` ([docs](https://developer.todoist.com/api/v1/)) | Names, sections, notes, assignees | OAuth app registration | CSV file or paste |
| **Google Keep** | High (Android default) | Android share to apps ([MakeUseOf](https://www.makeuseof.com/tag/share-google-keep-notes-apps-phone/)); checkbox rendering UNVERIFIED | Takeout: JSON per note, `listContent[{text, isChecked}]` (community parsers, [gist](https://gist.github.com/codemicro/f26e0d38cc00beef0f84a25ba505476a)) | Workspace-only ([Google](https://workspaceupdates.googleblog.com/2021/05/keep-audit-logs-and-api.html)) | Names, checked state | Takeout exports every note | Share or paste text |
| **Apple Reminders** ([Apple](https://support.apple.com/en-ae/105086)) | High (iPhone default, grocery list type since iOS 17) | Mac: select all, copy as text ([thread](https://discussions.apple.com/thread/253170272)); iOS rendering UNVERIFIED | None | EventKit on device: full read-write access to all reminders, no sections ([Apple](https://developer.apple.com/documentation/technotes/tn3152-migrating-to-the-latest-calendar-access-levels)) | Names, completed flag; grocery sections lost | Permission far broader than one list | Paste text; a Shortcut later |
| **Microsoft To Do** ([export](https://support.microsoft.com/en-gb/office/exporting-your-microsoft-to-do-account-d286b243-affb-4db4-addc-162e16588943)) | Low | Windows "Email list", reported to drop items ([forum](https://techcommunity.microsoft.com/discussions/to-do/emailing-listing-from-todo-app-does-not-reproduce-all-tasks-in-the-email-/1408473)) | Outlook mailbox export only | Graph `Tasks.Read`, personal accounts too ([Graph](https://learn.microsoft.com/en-us/graph/api/todo-list-lists)) | Names, notes, completed | Azure app registration | Paste text |
| **WhatsApp chat / Apple Notes** | High (no app, just text) | Copy or share; Notes may keep rich text, checkbox rendering UNVERIFIED | n/a | n/a | Names; WhatsApp `~strike~` may mean "done" (inference) | n/a | Paste text |

Cross-cutting facts:
- **Alexa and Google Assistant list sync are gone** (Amazon's list API ended 2024-07-01, Google's
  third-party lists 2023-06-20; [Bring!](https://getbring.com/blog-posts/google-assistant-no-more-support-for-third-party-list-apps),
  [AnyList](https://help.anylist.com/articles/alexa-skill-update-july-2024/)). No route there.
- **Prior art for importing:** AnyList and OurGroceries both import by paste, one item per line,
  and auto-categorise ([AnyList](https://help.anylist.com/articles/paste-items),
  [OurGroceries](https://www.ourgroceries.com/user-guide), which also takes CSV with
  `item`/`name`/`description`, `category`, `note` headers and tells Out of Milk users to bring their CSVs).
  No importer in the set that signs into a competitor's account was found (absence, UNVERIFIED).
- **Retailer apps** (Kaufland, Lidl Plus) have simple lists with no documented export
  ([mobiflip](https://www.mobiflip.de/?p=451056)); paste covers them.
- **Other German list apps** such as Pon and Überliste were noted in review 0 and not researched:
  both are niche next to Bring! and Listonic, and paste covers any app that shares text.
- **Household members:** no text or file route carries them, except Todoist's `RESPONSIBLE`
  column (assignee names). The unofficial APIs expose more (Bring!: members' names, emails and
  photos; Listonic: collaborators' emails). An import takes items only and never brings people
  along: members join Snacklist through its own invites.

## Privacy and legal

| Route | Where the data goes | Verdict |
| --- | --- | --- |
| Paste into a field or „Liste einfügen“ | Parsed on the device; only the lines the user keeps go to Supabase, as normal items | Keep. User-initiated, same processing as typing; same basis as items today, Art. 6(1)(b) per `docs/onboarding/PLAN.md` "Data to collect" |
| OS share sheet into Snacklist | Same, the text arrives through the OS | Keep |
| File pick (CSV, JSON) | Parsed on the device; only kept items sent | Keep, but a Takeout zip holds every Keep note: read only the one file the user picks, never upload the file |
| Account link (password, unofficial API) | Snacklist handles another service's password, server-side scraping | Avoid. Credentials, ToS (Listonic §7f; OurGroceries §6(g), arguably), SSO users have none |
| OAuth to Todoist or Microsoft | Tokens for the user's whole task data | Avoid for now. Scope wider than one list, app registrations, little reach |
| EventKit (Apple Reminders) | Read-write access to all reminders | Avoid for now. Ask far beyond one list |

Data minimisation for the routes we keep:
- Parse on the device; nothing is sent until the user confirms the preview.
- Drop by default: ticked lines, headers and dates, notes, people's names. A WhatsApp copy starts
  lines with a date, time and sender ("[11.11.26, 09:12] Lea: Milch", UNVERIFIED format): strip
  that prefix on the device so the sender never reaches the server.
- Clipboard read only on tap, never on screen open. On iOS 16+ a programmatic read shows the
  system's paste permission prompt (known platform behaviour, UNVERIFIED in this job); a plain
  field the user pastes into via the OS menu does not.
- Analytics: counts only, after the analytics yes. For example `item_added` with a new
  `source: import`, or one `list_imported` event with `route` (paste, share, file) and
  `kept_count`/`skipped_count`. No source app name, no text (`eventCatalog`, `docs/ANALYTICS.md`).
- `docs/PRIVACY_DATA_MAP.md` gets no new data category: imported items are items.

**Legal question, not decided here:** may the import UI or a help guide name the source apps
(„Liste aus Bring! einfügen“)? Addendum D covers retailers (plain text names and neutral icons only, no logos; Legal
dispositions 2026-11-05, `groceries-ops/COMMON.md`);
competitor app names in UI and guides are a separate question for Legal, not decided here. The
sketches below use neutral copy („aus einer anderen App oder einem Chat“) only because it needs no
answer to build. See question 2.

## Options

Coverage numbers are rough guesses from the matrix, not measurements: "target users" means new
Snacklist households who already keep a list somewhere (an app, Notes, a chat).

### paste-any-text (recommended first)

**UX in words.** In „Was fehlt gerade?“ a line under the field: „Schon eine Liste? Füge sie hier
ein.“ with a „Liste einfügen“ button, or a paste area of its own (several lines, no 120 cap; the
cap applies per item after parsing). The existing field stays single-line: it cannot see a
multi-line paste today (see "What exists"). The pasted text opens a preview sheet:
„12 Artikel erkannt“, one row per item with a checkbox, quantity split off („Milch · 2 Liter“),
ticked lines from the source shown unchecked under „Schon abgehakt“, duplicates of what is on the
list folded away. „12 übernehmen“ adds them to the draft (before the account) or as `AddItem` ops
(signed in). The same sheet opens from a „Liste einfügen“ action on the empty list. Opening it
from a paste into the list's add field needs the paste-detection work below.

**Parser (pure Dart, on the device).** Split on newlines (and on commas or „und“ for a one-line
list); strip bullets and checkboxes (`• - * ☐ ☑ ✓ ✔ [ ] [x]`, numbering, emoji); mark ticked
lines (`☑ ✓ ✔ [x] ~Milch~`); drop header and date lines and the WhatsApp sender prefix; split a
trailing "(2 Liter)" or ", 2 Liter" and leading "2x" into quantity, then `parseEntry`; cap names at
120 characters and the import at 100 lines (guess, to tune). Table-driven tests like
`voice/parse_test.ts`, filled with **real samples** from each app (question 3).

**Covers.** Roughly 70-90 % of target users (guess): most apps in the matrix produce text, plus
chats and Notes. The range depends on what the real samples look like (question 3). Weakest for
Microsoft To Do (lossy email), Listonic (sources conflict on link vs items) and Reminders on iOS
(format unknown).

**Effort.** 3 lane-days with a button or a separate paste area: parser and tests 1, preview
sheet in onboarding and list 1, draft and `AddItem` wiring, dedupe against the list 0.5, ARB both
languages, analytics rule, feature files, e2e 0.5. Plus about 1 lane-day (guess) for the
five-prototype set before the UI is built.
If the existing fields must notice a paste themselves (prototypes 1 and 5), add about 1.5
lane-days (guess), so 4.5: catch the paste before the single-line formatter and the 120 cap on
iOS and Android (Flutter's paste action and toolbar), catch the browser's DOM paste on the web
(the newlines are gone before Flutter sees the text), or turn the field multi-line with no input
cap and rework Enter/send (the list field uses `TextInputAction.send` and its own Enter handler)
and the list field's counter.

**Risks.** Unknown text formats until samples arrive (mitigated by the preview: the user unticks
junk). The existing fields flatten and cut a paste before app code sees it (web: spaces, native:
glued, both: 120 characters), so any flow that relies on pasting into them is the expensive
variant above. A long import sends one call per item today (`onboarding_cubit.dart:51`); 100 items may
take several seconds (guess, to measure). Paste on the web goes through the browser's clipboard
rules (Flutter web); test there.

### share-to-snacklist (second)

**UX in words.** In Bring!, Keep or Notes the user taps Share, picks Snacklist, and Snacklist
opens on the same preview sheet. Signed out, the text lands in the onboarding draft and the guided
start opens at „Was fehlt gerade?“ with the preview; signed in, it goes to the current list.

**Covers.** Roughly 50-70 % of target users (guess): the paste audience minus web and desktop
users and apps that share a link or a PDF, with one less step (no copy). Web: a Web Share Target
needs an installed PWA; skip.

**Effort.** 4 lane-days on top of paste-any-text: iOS share extension (Swift, app group, hand-off
to the app) 2, Android `ACTION_SEND text/plain` intent filter and channel 0.5, routing for signed
out, signed in and a cold start 1, proof 0.5.

**Risks.** A new iOS extension target needs a provisioning profile and app group for signing in
`release.yml` (possibly a NEEDS_PETER step); no iPhone on the runners, so proof is CI build plus
widget tests until someone tries it on a phone. An app that shares a link instead of items
(possible for Listonic, sources conflict) gives a preview that says nothing was found.

### file-import-csv (last, optional)

**UX in words.** „Datei importieren“ under the paste line opens the file picker. Snacklist reads
Todoist CSV (`TYPE`/`CONTENT`, sections dropped, the classifier re-sorts), OurGroceries-style CSV
(`item`/`name`/`description`, `category`, `note`) and, once samples exist, Out of Milk CSV and a single Keep
Takeout note JSON (`listContent`). Same preview.

**Covers.** Under 5 % of target users (guess): Todoist, Out of Milk and OurGroceries users who
find their export. Bring!, the biggest source, has no file export.

**Effort.** 2.5 lane-days: `file_picker` dependency and web upload 0.5, CSV and JSON readers with
tests 1.5, UI and docs 0.5.

**Risks.** Undocumented columns (Out of Milk, OurGroceries XLSX), a new dependency, and a Takeout
zip with every note (pick one file, never upload).

### Not proposed

- **connect-other-account** (Bring!, AnyList, OurGroceries, Listonic via unofficial APIs): needs
  the other app's password and server-side scraping, against Listonic's terms (§7f) and arguably
  OurGroceries' (§6(g)).
- **oauth-todoist-microsoft**: possible, but app registrations and wide scopes for a one-time
  import used by few.
- **reminders-direct** (EventKit): full read-write access to all reminders and no grocery
  sections. A downloadable Shortcut that sends one Reminders list as text to Snacklist's share
  target or the clipboard is the light alternative once share-to-snacklist exists.

## Recommendation

Build **paste-any-text** first, in „Was fehlt gerade?“ and on the empty list, with the parser as a
pure, table-tested function, and its own paste button or area rather than the existing fields.
It reaches the most households (70-90 %, guess), keeps all processing on the device until the
user confirms, needs no new dependency or native target, and gives a pasted list a route that
today's fields cannot (they flatten it into one item).
Add **share-to-snacklist** next, once paste shows people use it (`list_imported` counts).
Leave **file-import-csv** until users ask.

## Phase 2: what a five-prototype set would explore

Peter's rule (2026-11-11): five distinct approaches before any production UI. For
paste-any-text:
1. **multi-line-field-live-chips**: the „Was fehlt gerade?“ field takes a paste and turns each
   line into a removable chip at once, no sheet.
2. **paste-button-preview-sheet**: a „Liste einfügen“ button (reads the clipboard on tap, like
   „Einladung einfügen“) opens a checkbox preview.
3. **have-a-list-step**: an optional onboarding step „Hast du schon eine Liste?“ before „Was fehlt
   gerade?“, with neutral how-to copy and a big paste area.
4. **empty-list-bring-your-list**: no onboarding change; a card on the empty list and in „Erste
   Schritte“ („Liste mitbringen“) after the household exists.
5. **add-bar-detects-lines**: the list's add bar notices a multi-line paste and offers „7 Artikel
   erkannt, alle hinzufügen?“ inline.

Prototypes 2, 3 and 4 work with today's fields as they are (a button, or a paste area of their
own). Prototypes 1 and 5 depend on the paste-detection work in the effort note above (+1.5
lane-days, guess): today a paste into those fields arrives as one flattened, cut line.
Each prototype would show a messy real sample (bullets, ticked lines, a WhatsApp sender prefix)
and the 358 px compact layout.

## Questions for Peter

1. **import-where-first**: paste-any-text in „Was fehlt gerade?“ and on the empty list (my
   default), or only one of them? And through a button or paste area (3 lane-days) or by pasting
   straight into the existing fields (4.5)? Default if no answer: both places, a button or area,
   same preview sheet.
2. **name-source-apps-in-ui**: may the import copy or a help guide name apps like Bring! or Google
   Keep, or should it stay neutral („aus einer anderen App oder einem Chat“)? This is a Legal
   question and not decided here; Phase 2 can build with neutral copy and no logos either way.
3. **real-share-samples**: can you (or Lea, if you ask her; no agent contacts her) send the text that "Share list" or copy
   produces in Bring!, Google Keep, Apple Reminders, Apple Notes, Listonic and a WhatsApp list,
   iPhone and Android, with a ticked item and a quantity in each? No vendor publishes the format,
   and the runners have no phones. Default: build the parser from generic rules and tune it when
   samples arrive.
4. **ticked-items-on-import**: ticked lines from the old list are left out by default. Should
   they instead seed the household's usuals (the suggestions), so the first suggestions know what
   the family buys? Default: leave them out.
5. **share-target-timing**: build share-to-snacklist right after paste-any-text in the same week,
   or wait for usage numbers first? Default: wait for the numbers.
