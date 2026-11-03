# Job 80: Access screen, tips card, account email (Peter's feedback 7-9)

## What was built

**A. Mehr › Zugänge**
- Connected app rows no longer list the granted scopes. A row reads
  „Chrome · macOS · Verbunden am 30.10.2026 · Zuletzt aktiv 2.11.2026“.
- The device label comes from the consent page. After „Erlauben“ it records a short browser and
  system name (`app/lib/oauth/device_label.dart`, `record_oauth_device`). Supabase's own session
  user agents name only the client's HTTP library: in production that's `undici`,
  `python-httpx`, `Apache-HttpClient` and `codex-mcp-client`. Only the label is stored, in
  `public.oauth_app_devices`, never the user agent, an IP address or a location. A trigger deletes
  the label when the grant ends. The data export carries it.
- „Zuletzt aktiv“ is the client's newest token refresh from `auth.sessions`, read by
  `connected_app_details()`. Nothing new is stored for it.
- A tap on a row opens a sheet with the device and dates, the heading „Was <App> darf“ in plain
  words, and „<App> trennen“. The trailing disconnect icon stays.
- Under „Zugriffstoken“ there is now a hint that a token lets you build your own automations
  that manage the list. With the `public-api` flag on, the hint points to the API section instead.
- Siri card: „Siri funktioniert jetzt ohne Einrichtung …“ is replaced by
  „Sag zum Beispiel: „Hey Siri, füge etwas zur Hummlist hinzu“.“

**B. Tips card** (`app/lib/tips/`)
- A typed, ordered queue (`tips`) with platform and app version targeting. One card shows at a
  time, in the list's scroll view under the gesture card's slot.
- The card shows only when the list has an open item and the gesture card is dismissed.
- The X stores the tip's id per user on this device (`DeviceCache`, `tips.<user id>`). The next
  tip shows from the next start on.
- Tips today: hold an item to edit it, and type the amount with the item. The Siri tip was
  dropped: German native Siri is unverified on a device and held until Launch.

**C. Konto**
- The email is plain text with a copy button („E-Mail-Adresse kopieren“) that shows „Kopiert“.

## How to verify
- `scripts/verify.sh` (all gates).
- `scripts/verify.sh --only e2e -- tests/mcp.spec.ts` drives the real consent and asserts the
  recorded „Chrome · Linux“, the row and the sheet.
- `supabase test db supabase/tests/connected_app_devices.test.sql`.
- verify-hummlist: `drive.sh ai-assistants`, `drive.sh tips [--lang en --dark]`,
  `drive.sh account-deletion`.

## Screenshots
docs/screenshots/80/: `access-connected-app.png`, `access-app-details.png`,
`account-email-copied.png`, `tip-de.png`, `tip-en-dark-next.png`.

## Open
- Legal Review: the privacy policy may need a line about the device label (NEEDS_LEAD "Job 80").
  Legal texts are unchanged.
- An "Anpassen" tip waits for job 78's button. Add it to `tips` once that lands.
