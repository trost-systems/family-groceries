# Importing lists from to-do and note apps (Todoist, Keep, Reminders, MS To Do, plain text)

Research date 2026-11-11. Web research only; nothing was run against any service.
UNVERIFIED means no primary or reliable source was found. For those items the next step is a hands-on device test.

## Bottom line

- The paths that work everywhere are **plain text in** (paste or the share sheet) and **file in** (Todoist CSV, Keep Takeout JSON).
  Every app can produce text somehow, but no vendor documents its text format. A tolerant line parser covers all of them
  (strip `☐ ☑ - [ ] [x] • * -` and numbering; keep a quantity like "2x Milch" as part of the name).
- Of the four, only Todoist and Microsoft To Do have consumer OAuth APIs. Keep has no consumer API. Reminders is on-device only (EventKit, iOS).
- **Sections and categories are lost almost everywhere.** Todoist CSV and API keep sections. Keep and MS To Do have no sections.
  Reminders' iOS 17 grocery sections are not exposed by EventKit (see below).

## Todoist

**Export routes**
- CSV export per project, from the project's three-dots menu > "Manage data" > "Export as CSV". The file is meant to be a near-exact copy,
  but **completed tasks are not included**. Shared projects can be exported. Limit of 300 tasks per project.
  https://www.todoist.com/help/articles/import-or-export-a-project-as-a-csv-file-in-todoist-YC8YvN
  - The source calls the route "Manage data"; it does not say which platforms have it. Web and desktop are certain. Mobile is UNVERIFIED.
- CSV columns, quoted from the format article (https://todoist.com/help/articles/format-a-csv-file-to-import-into-todoist-UVUXTmm6):
  `TYPE` ("task", "section" or "note", lowercase), `CONTENT`, `DESCRIPTION`, `PRIORITY` (1-4), `INDENT` (1-4, sub-tasks),
  `AUTHOR` and `RESPONSIBLE` ("username (ID)", e.g. "Evan (14781400)"), `DATE`, `DATE_LANG` (de included), `TIMEZONE`,
  `DURATION`, `DURATION_UNIT`, `meta` ("view_style=board"), `DEADLINE`, `DEADLINE_LANG`, `IS_COLLAPSED`.
  The file must be UTF-8. Section rows come before their tasks; a "note" row is a comment on the task above it.
  The article has no complete sample row (not found).
- Public API: the unified **Todoist API v1** (`https://api.todoist.com/api/v1/...`, including `/sync`). https://developer.todoist.com/api/v1/
  - OAuth: authorize at `https://app.todoist.com/oauth/authorize`, token at `https://api.todoist.com/oauth/access_token`.
    **Public clients may use PKCE without a client_secret** (`token_endpoint_auth_method: none`), so a mobile or web app needs no server
    secret. Same page.
  - Scopes: `data:read` gives read-only access to tasks, projects, labels and filters, which is enough for an import. Others are `task:add`, `data:read_write`,
    `data:delete`, `project:delete`, `backups:read`. Same page.
  - The section object has `id`, `name`, `project_id`, `section_order` and more (same page). I could not read the task field names (`content`,
    `checked`, `section_id`, `responsible_uid`) off the page because it was truncated: UNVERIFIED, but the CSV columns show the same data.
- Clipboard and share-as-text: no official documentation of copying a project as text was found (UNVERIFIED).
- Alexa: Todoist ended its Alexa list sync when Amazon shut down the List Skill API on 2024-07-01, and built no replacement.
  https://www.newsbytesapp.com/news/science/alexa-to-stop-supporting-popular-third-party-shopping-list-apps/story ,
  https://help.anylist.com/articles/alexa-skill-update-july-2024/

**Data that comes out:** names (`CONTENT`), notes (`DESCRIPTION` and note rows), sections, sub-tasks (`INDENT`), assignees (`RESPONSIBLE`),
dates. The CSV does not carry checked state, since completed tasks are omitted. Quantities appear only as free text inside `CONTENT`.

**Weight:** a CSV import is a light file-picker job. OAuth with PKCE is feasible client-side, but it means a Todoist app registration for a
feature most users touch once.

## Google Keep

**Export routes**
- **Google Takeout** exports Keep as HTML and JSON per note, plus attachments (PNG and other files).
  https://www.howtogeek.com/694042/how-to-export-your-google-keep-notes-and-attachments/ ,
  https://con.github.io/serve/tools/cloud-storage/google-takeout (a community overview, which warns that Google changes formats without notice).
  Google's own Takeout help page does not document the Keep format: https://support.google.com/accounts/answer/3024190
- Takeout JSON fields, from community parsers and not from Google:
  - Go struct (https://gist.github.com/codemicro/f26e0d38cc00beef0f84a25ba505476a):
    `title`, `textContent`, `listContent[] { text, isChecked }`, `labels[] { name }`, `attachments[] { filePath, mimetype }`,
    `createdTimestampUsec`, `userEditedTimestampUsec`.
  - Python (https://gist.github.com/echus/ce7cd43ec18edaad8105ca37349af41b): `if "listContent" in keep.keys():` ... `if item["isChecked"]:`,
    plus `isPinned`. Other parsers also read `isArchived` and `isTrashed`.
  - A complete verbatim sample JSON file: not found.
- Send to other apps: Google's help page covers only the web route, More > "Copy to Google Docs".
  https://support.google.com/keep/answer/6320648 . A third-party article reports that the Android app shares notes to other apps
  (https://www.makeuseof.com/tag/share-google-keep-notes-apps-phone/). Yahoo Tech reports that sharing sends the content but not the title
  (https://tech.yahoo.com/general/articles/google-keep-missing-6-basic-163023640.html).
  **The text format of a shared or copied checklist ("☐ item" or plain lines, and whether checked items are included) is UNVERIFIED.**
  No source was found. A device test is needed.
- Keep is being tested in Google Messages as a shared checklist, which is chat-side and not an export.
  https://androidauthority.com/google-messages-keep-notes-checklist-september-android-drop-3705193
- Public API: the **Keep API is enterprise-only**. "These features are only available for Google Workspace customers, and are not available for
  users with personal Google accounts." https://workspaceupdates.googleblog.com/2021/05/keep-audit-logs-and-api.html ,
  https://developers.google.com/workspace/keep (built for enterprise security tooling; Jentic notes it typically uses domain-wide delegation).
  The **Data Portability API** has no Keep resource group: https://developers.google.com/data-portability/user-guide/scopes

**Data that comes out:** title, item text, checked state (Takeout `isChecked`), labels, timestamps. Keep has no sections and no quantities
(free text only). Takeout has no field for collaborators in the parsers seen (Google's own docs: not found).

**Weight:** Takeout is a multi-step, minutes-to-hours export of a zip holding every note. It is fine for a "power user" path but heavy for a household.
For most people the realistic path is share or copy text into a paste box.

## Apple Reminders (incl. the iOS 17+ Groceries list)

**Feature:** from iOS 17, a list can be of type Groceries, and Reminders then sorts items into categories automatically.
https://support.apple.com/en-ae/105086 . Unrecognized items stay unsectioned, and users can rename, add and reorder sections
(https://9to5mac.com/2023/06/09/ios-17-reminders-groceries/ , https://www.macrumors.com/2023/06/07/ios-17-reminders-grocery-sorting/).

**Export routes**
- There is no built-in export. On a Mac you can "select all reminders in a list (Edit > Select All), copy them (Edit > Copy) and paste them as text",
  or print to PDF (Apple Community, Big Sur era). https://discussions.apple.com/thread/253170272 . How iOS copy and paste or the share sheet renders a list
  as text: UNVERIFIED.
- **Shortcuts:** the "Find Reminders" action, then a loop over "Get Details of Reminders", can build TSV or text. It filters to not-completed
  by default. https://discussions.apple.com/thread/256061841 , https://talk.automators.fm/t/shortcuts-beginner-needs-reminder-app-help/10186 .
  Tags are supported in Find Reminders: https://matthewcassinelli.com/apple-testing-updated-native-actions-in-shortcuts-starting-with-reminders/ .
  A Snacklist-provided Shortcut ("send this Reminders list to Snacklist") is feasible without any in-app permission, but a user must install it.
- **EventKit (in-app, iOS and macOS only):** on iOS 17+ the app needs `NSRemindersFullAccessUsageDescription` and
  `requestFullAccessToReminders`. Without the key, iOS denies access automatically. https://developer.apple.com/documentation/eventkit/accessing-the-event-store ,
  https://developer.apple.com/documentation/technotes/tn3152-migrating-to-the-latest-calendar-access-levels .
  Full access is **read and write to all reminders**. There is no read-only or per-list scope, which is a heavy ask for a one-time import.
  - EventKit **does not expose sections** (or list groups, ordering, subtasks). Community reports:
    https://developer.apple.com/forums/thread/744915 . Apple DTS confirmed only the subtask part (no API) and pointed to Feedback Assistant:
    https://developer.apple.com/forums/thread/820848 . The grocery categories therefore do not come out.
  - App Store review notes specific to EventKit import: not found.
- Not available on Android or web. A Flutter app needs a plugin or a platform channel.
- Siri: built-in "add X to my shopping list" goes to Reminders. Snacklist already has its own Siri route.

**Data that comes out (EventKit or Shortcuts):** title, notes, completed flag, list (calendar) name, dates, tags (Shortcuts). Sections are not available.
Assignees in shared lists (iOS 17+) are not in the EKReminder docs: UNVERIFIED.

## Microsoft To Do

**Export routes**
- Official: export via Outlook.com, Settings > "Export Mailbox", since To Do syncs with Outlook Tasks. This produces a mailbox export,
  not a list file. https://support.microsoft.com/en-gb/office/exporting-your-microsoft-to-do-account-d286b243-affb-4db4-addc-162e16588943
- In-app: lists can be Shared (an invite link, not a copy), Duplicated or Printed.
  https://support.microsoft.com/en-us/todo/share-a-task-list ,
  https://support.microsoft.com/en-us/outlook/create-and-manage-task-lists-with-my-day-in-outlook .
  Users report an "Email list" option in the Windows app that dropped items (14 of 44):
  https://techcommunity.microsoft.com/discussions/to-do/emailing-listing-from-todo-app-does-not-reproduce-all-tasks-in-the-email-/1408473
  (community, UNVERIFIED as current). The email and clipboard text format: not found.
- **Microsoft Graph To Do API:** `GET /me/todo/lists` and `/me/todo/lists/{id}/tasks`. The least-privileged delegated scope is **`Tasks.Read`**,
  for both work/school and **personal** Microsoft accounts. https://learn.microsoft.com/en-us/graph/api/todo-list-lists ,
  https://learn.microsoft.com/en-us/graph/api/todotasklist-list-tasks . The todoTask properties are `title`, `body`, `status`
  (`notStarted`, `inProgress`, `completed`, ...), `completedDateTime`, `importance`, `categories`, `createdDateTime`, plus `checklistItems`
  (sub-steps). The type has no assignee property. https://learn.microsoft.com/en-us/graph/api/resources/todotask
  - Public-client (MSAL, no secret) sign-in for mobile and SPA is standard for Graph but was not checked for To Do specifically: UNVERIFIED.
- Unofficial: a GitHub tool exports To Do to the Todoist CSV format or JSON using a Graph Explorer token.
  https://github.com/daylamtayari/Microsoft-To-Do-Export
- Alexa: forum threads show historic To Do and Alexa sync problems
  (https://techcommunity.microsoft.com/discussions/to-do/alexa-and-to-do-not-syncing/2249643). The List Skill API shutdown
  (2024-07-01, above) ended third-party list sync generally.

**Data that comes out:** task titles, notes (`body`), completed state, list names, Outlook categories, steps. The app has no sections
(lists can be grouped in folders, which is UNVERIFIED in Graph). Quantities appear as free text in the title.

**Weight:** an Azure app registration and a Microsoft sign-in flow for a once-per-user import. There is no file route a normal user would manage.

## WhatsApp chats and Apple Notes checklists (plain text)

- Many households keep the list as a WhatsApp message or an Apple Notes checklist. Both reach Snacklist only as text, by copy and paste or the share
  sheet. Notes can be shared via Messages, mail or any share extension (https://www.idownloadblog.com/?p=378773). Users report that the share-sheet copy
  **keeps formatting** (rich text) (https://talk.automators.fm/t/shortcut-to-create-a-checklist-in-notes/5610), and that a checklist sent
  by email lost its formatting (https://appleinsider.com/articles/15/10/12/how-to-create-interactive-checklists-in-notes-for-ios-9).
  The exact plain-text rendering of Notes checkboxes (bullet, "◦" or nothing): not found, UNVERIFIED.
- WhatsApp has no checklist type. Its markup is `*bold*`, `_italic_`, `~strike~` and monospace
  (https://guides.clickatell.com/release-notes/release-notes-archive/2024-release-notes/q1-2024/channel-updates/whatsapp-text-formatting), so
  "done" items may appear as `~Milch~`. Treat that as a checked hint (an inference, not documented user behaviour).

## Reliability and platform notes

- Text formats are undocumented and change silently. Parse defensively and show a preview with checkboxes before inserting.
- Todoist CSV: stable and documented, 300 tasks per project, no completed tasks. Keep Takeout: format changes without notice (con.github.io above).
- Reminders: iOS and macOS only, all-or-nothing permission, no sections. Shortcuts behaviour changed across iOS versions (iOS 18 reworked the
  Reminders actions, per the matthewcassinelli.com link above).
- MS To Do: the Graph API is solid. The consumer export is a mailbox dump. The in-app email-list feature has had reported gaps.
- Alexa: no third-party list sync since 2024-07-01. It is not a route.
- Recommended order (inference): 1) a paste or share-target text import with a preview (covers Keep, Notes, WhatsApp, Reminders on Mac, To Do email);
  2) a Todoist CSV file; 3) a Keep Takeout JSON file; 4) an optional iOS Shortcut for Reminders. Skip in-app OAuth and EventKit for a first version.
