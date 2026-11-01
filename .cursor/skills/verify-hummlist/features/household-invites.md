# Household and invites

One household shares one list. Its name shows under „Partner einladen“ / "Invite your partner" in the More tab. A member invites a partner with an 8-character code and a link (valid 7 days, usable by one person), shares or copies them, and can revoke open invites. A person joins by typing the code or opening the link; someone already in a household is warned that joining moves them. There is no screen to rename a household, list its members or leave it without joining another (or deleting the account).

## Sub-features

- `invite-create` More → „Partner einladen“ / "Invite your partner" (title „Einladungen“ / "Invites"): text „Teile den Link oder den Code mit der Person, mit der du einkaufst. Die Einladung gilt 7 Tage und für eine Person.“ / "Share the link or the code with the person you shop with. The invite is valid for 7 days and for one person." Button „Neue Einladung“ / "New invite".
- `invite-card` per invite: „Code“ with the 8 characters (letters A-Z and digits 2-9, no I, O, 0, 1), „Link“ (`<app origin>/join/<code>`; on the phones https://app.hummlist.com/join/<code>), „gültig bis {date}, {time} Uhr“ / "valid until {date}, {time}", buttons „Teilen“ / "Share" (only where a share sheet exists: phones, browsers with Web Share), „Link kopieren“ / "Copy link" (snackbar „Link kopiert“ / "Link copied"), „Code kopieren“ / "Copy code" (snackbar „Code kopiert“ / "Code copied"), „Widerrufen“ / "Revoke" (accessible name „Einladung {code} widerrufen“ / "Revoke invite {code}").
- `share-text` the share sheet text: „Komm in unseren Hummlist-Haushalt: {link} · Code: {code}“ / "Join our Hummlist household: {link} · Code: {code}" (code only when the build has no app URL).
- `open-invites` list „Offene Einladungen“ / "Open invites"; empty: „Keine offenen Einladungen.“ / "No open invites." Used, revoked and expired invites are not listed. Any member can revoke any open invite; snackbar „Einladung widerrufen. Link und Code gelten nicht mehr.“ / "Invite revoked. Its link and code no longer work."
- `expiry-single-use` an invite is valid 7 days from creation (database default) and works once; after use, revoke or expiry the code gives „Dieser Code ist ungültig oder abgelaufen.“ / "This code is invalid or has expired." (one answer for made-up, expired, revoked and used codes).
- `join` More → „Anderem Haushalt beitreten“ / "Join another household" (title the same) or onboarding „Einladung annehmen“: field „Einladungscode“ / "Invite code" (upper-cased, spaces and dashes ignored), „Weiter“ / "Continue" previews the household under „Einladung in den Haushalt“ / "Invite to the household", then „Haushalt beitreten“ / "Join household" or „Abbrechen“ / "Cancel".
- `switch-warning` in a household: card „Du bist schon in einem Haushalt“ / "You're already in a household" plus „Du bist das einzige Mitglied von „{household}“. Trittst du bei, wird „{household}“ mit seiner Liste gelöscht.“ / "You're the only member of “{household}”. If you join, “{household}” is deleted along with its list." or, with other members, „Trittst du bei, verlässt du „{household}“. Die anderen Mitglieder behalten die Liste.“ / "If you join, you leave “{household}”. The other members keep its list." „Abbrechen“ is the prominent button, the join button second.
- `link-join` opening `/join/<code>` signed in goes to the join screen with the code previewed; signed out, the code survives sign-in and onboarding (kept 7 days).
- `rate-limit` 10 failed codes within an hour block even valid codes: „Zu viele Versuche. Bitte später noch einmal.“ / "Too many attempts. Please try again later."
- `premium-on-join` the join screen mentions Hummlist Lifetime when the target or the household being left has it. Premium is not on sale yet (hold `premium-launch`), so a normal user sees none of this.
- `archive` „Archivierte Haushalte“ / "Archived households" in More and „Archivieren und beitreten“ / "Archive and join": off in production (see Gotchas).

## How to get to it (user POV)

- Right after creating a household: Step 3 „Partner einladen“ (see onboarding).
- Later: tab „Mehr“ / "More", section „Haushalt“ / "Household", row „Partner einladen“ (shows the household's name as detail), page „Einladungen“.
- Joining: row „Anderem Haushalt beitreten“ in the same section; or an invite link; or at first run „Einladung annehmen“.
- Household name: shown only as the detail of the row „Partner einladen“; it is set once when creating.

## Driving it with Playwright

Preconditions:

- Local stack, e2e web build. The baseline household „Familie Brandt“ has three members (Mia, Noah, Ida), so most join recipes use a fresh sign-up or an invite made by the API (`householdWithInvite`, `createInviteCode(page)` in the specs).

- **Open the invite page.** `openMore(page, 'Partner einladen')`. Observable result: URL `/more/invites`, button „Neue Einladung“ visible.
- **Create an invite.** `page.getByRole('button', { name: 'Neue Einladung' }).click()`. Observable result: `inviteCodeLabel(page)` (group named `Code ABCD2345`), text matching `/^gültig bis /`; read codes with `shownInviteCodes(page)`; the code matches `/^[A-HJ-NP-Z2-9]{8}$/`.
- **Copy.** `page.getByRole('button', { name: 'Link kopieren' }).click()` then `actionSnackBar`/`snack(page, 'Link kopiert')`; clipboard equals `<origin>/join/<code>` (needs clipboard permissions). Same with „Code kopieren“.
- **Revoke.** `page.getByRole('button', { name: 'Einladung ' + code + ' widerrufen' }).click()`. Observable result: snackbar „Einladung widerrufen. Link und Code gelten nicht mehr.“, the code's group gone; a second user opening `/join/<code>` sees „Dieser Code ist ungültig oder abgelaufen.“.
- **Join by code.** `openMore(page, 'Anderem Haushalt beitreten')`, then `joinWithCode(page, code, 'Haushaltsname')`. Observable result: URL `/`, the list of the new household; the old household is left (API: `household_members`).
- **Join warning.** `page.goto('/join/' + code)` while in a household: text „Du bist schon in einem Haushalt“ visible; click „Abbrechen“ to stay.
- **Expiry and single use.** Use the API to backdate or use an invite (`adminClient()` in helpers); the specs check 6-day-old works, 7+ days fails.
- Covered by `e2e/tests/onboarding.spec.ts` (AC4-AC13, "a used invite disappears from More's invite list", link twice, race for one code), `e2e/tests/household-bound.spec.ts` (joining a household with Lifetime, archive; relies on the e2e-only `HOUSEHOLD_ARCHIVE` and `LEGAL_DRAFTS` defines), `e2e/tests/partner-news.spec.ts` (items the partner added are marked new until seen). Run via `scripts/verify.sh --only e2e -- tests/onboarding.spec.ts`.

## Gotchas

- `HOUSEHOLD_ARCHIVE` is not set in `app/config/auth.json` (the production web and store builds), so it is off for normal users: no „Archivierte Haushalte“ row, and the last member of a household with Lifetime sees the decline warning (`join-lifetime-ends`) with „Trotzdem beitreten“ / "Join anyway", not the archive offer. The e2e build turns it on; `household-bound.spec.ts` therefore shows behaviour users do not see. Peter's decision log says turning it on needs Legal Review first.
- Premium/Lifetime texts on the join screen are only reachable with a household that has a purchase; Premium is not on sale (hold `premium-launch`).
- There is no members list, no rename, no remove-member and no "leave household" button in the app (searched More and the household screens). Leaving happens by joining another household, or by deleting the account (feature account). The household is deleted when its last member leaves.
- Revoking is not undoable; there is no "revoke all".
- The invite link host: on the web it is the page's own origin, on the phones https://app.hummlist.com. The share sheet text uses the German or English variant of the app's language.
- Codes are compared upper-cased with other characters ignored; they never go to analytics.
- 7-day expiry and single use are in the database (invite default `now() + interval '7 days'`, `used_at` set on join); the pending invite on a device also lasts 7 days.
