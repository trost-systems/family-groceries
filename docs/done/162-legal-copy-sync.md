# Job 162: legal and help texts follow the app

Site and deletion-page copy only (DE and EN where both exist). Decisions: [DECISIONS.md](../DECISIONS.md) "Job 162".

## Changed sentences (for Legal Review)

**L1, app.hummlist.com/konto-loeschen.html, "Was gelöscht wird"** (no EN page exists)
- Before: „Die Verbindung zwischen deinen Käufen von Hummlist Lifetime und deinem Konto sowie ein Eintrag in der Testerliste. Die Freischaltung bleibt beim Haushalt.“
- After: „Die Verbindung zwischen deinen Käufen von Hummlist Lifetime und deinem Konto. Die Freischaltung bleibt beim Haushalt.“

**L2, /support and /en/support, FAQ on Lifetime when the last member leaves**
- DE before: „… als letztes Mitglied, kannst du ihn archivieren: Er bleibt mit Liste und Hummlist Lifetime erhalten, und du kannst ihn unter **Mehr** › **Archivierte Haushalte** wieder aktivieren. Aktivierst du ihn nicht innerhalb von 24 Monaten, wird er gelöscht. Löschst du ihn statt zu archivieren, endet Hummlist Lifetime mit ihm.“
- DE after: „… als letztes Mitglied, wird er gelöscht. Die App warnt dich vorher: Hummlist Lifetime endet mit dem Haushalt.“
- EN before: "… as its last member, you can archive it: it is kept with its list and Hummlist Lifetime, and you can re-enable it under **More** › **Archived households**. If you don't re-enable it within 24 months, it is deleted. If you delete it instead of archiving it, Hummlist Lifetime ends with it."
- EN after: "… as its last member, it is deleted. The app warns you first: Hummlist Lifetime ends with the household."
- Why: the „Archivierte Haushalte“ row and archiving exist only behind `HOUSEHOLD_ARCHIVE`, set in no release build.

**L3, privacy policy §7 "Amazon Alexa"**
- DE added: „Nutzt du den Skill 12 Monate lang nicht, beenden wir die Verbindung und löschen diese Angaben ebenfalls.“ and „… bleibt, bis du ihn entfernst **oder er 12 Monate lang ungenutzt war**.“
- EN added: "If you don't use the skill for 12 months, we end the connection and delete this data as well." and "… stays until you remove it **or it has gone unused for 12 months**."
- Source: `public.purge_alexa()`, `interval '12 months'`, `supabase/migrations/20261102093000_alexa_cleanup.sql` (daily pg_cron `purge-alexa`).

**L4, privacy policy §7 and §16**
- DE: „Zugangsschlüssel“ → „Zugriffstoken“ (3×); „Schlüssel“ → „Token“ in §7 (zu jedem Token, Endet ein Token, Tokens und Verbindungen, Der Token liegt im Schlüsselbund, des Tokens, Der Token funktioniert, den Token, Der Token endet, Siri-Tokens, zum Token, Endet der Token).
- EN: "access key(s)" → "access token(s)" (3×); "key" → "token" in §7 likewise.
- Source: `accessTokens` in `app/l10n/app_de.arb` („Zugriffstoken“) and `app_en.arb` ("Access tokens").

**Dates:** privacy policy „Stand“/"Last updated" 7 November 2026; `updated:` 2026-11-07 on both privacy pages and both support pages.

## Not changed
- `datenschutz-kaeufe.md` / `privacy-purchases.md` still describe archiving under „Mehr“ › „Archivierte Haushalte“ (outside the brief).
- §7's „Zugangs-Token“ for Alexa (Amazon's OAuth token, not an app token).
- Privacy §16 (`datenschutz.md`, `privacy.md`, retention) still says the last member can archive a household for 24 months, which release builds don't offer (outside the brief; Legal to decide).
- `konto-loeschen.html` says „Zugangs-Tokens“ like the app's deletion dialog (`accountDeleteWhat`), while the Zugänge page says „Zugriffstoken“ (outside the brief, which named the privacy policy).

## Verified
- `scripts/verify.sh --only lint,site,changelog` passed (site: 170 tests, build of 30 pages).
- Built `dist/` pages contain the new sentences and dates, and no „Zugangsschlüssel“/"access key".
