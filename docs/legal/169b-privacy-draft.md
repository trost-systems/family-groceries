# Privacy policy draft for job 169b (several households, invite loop)

Status: DRAFT for Legal. The texts are `site/content/legal/datenschutz.md` (binding) and
`site/content/legal/privacy.md` (translation). Facts come from the branches `job/169b-households-p2`
(PR #327, wave 1) and `job/169b-w2` (wave 2), contracts in `docs/households/W1.md` and `W2.md`.
Migrations: `supabase/migrations/20261108125048_households_multi.sql` (W1) and
`20261108133253_households_invite_loop.sql` (W2).

## Changes

| Section | Change | Fact behind it | Proposed legal basis |
| --- | --- | --- | --- |
| Head | Stand / Last updated 8 November 2026, `updated:` 2026-11-08 | Placeholder, see question 10 | none |
| 3 | Device storage: lists (plural), the household last opened on this device, an opened invite until joining | W1 device cache per user and household; `DeviceCache` keys `invite.pending`, `invite.referrer_read` | § 25 Abs. 2 Nr. 2 TDDDG (unchanged) |
| 5 | Several households; household kind if given; roles and join dates; members of one household don't see your others; default household chosen by the user, first one until then | W1 migration: `household_members.is_default`, insert trigger, `households.kind`, `my_households()`, `household_members_of()` | Art. 6 Abs. 1 lit. b |
| 5, new "Rollen und Einladungen" | Owner ("Hauptadmin"), admins, removal of members, owner succession | W2: `set_member_role`, `remove_member`, succession in `leave_household_as` / `delete_account` | Art. 6 Abs. 1 lit. b |
| 5 | Replaces "Einladungslinks laufen nach 7 Tagen ab und gelten nur einmal": person link 7 days, one use; group link 30 days, 50 joins, revocable, owner/admins only; Hummlist sends no invites (N-18) | W2: `invites.kind`, `max_uses`, `create_invite` intervals 7 / 30 days | Art. 6 Abs. 1 lit. b |
| 5 | Per invite: creator, expiry, join count, join-page open count (no identities); per join: invite and time, shown to current members under "Wer ist beigetreten" | `invites.use_count`, `preview_count`; table `invite_uses`; `invite_joins()` lists only current members | Art. 6 Abs. 1 lit. b |
| 5 | Public join page: inviter's first name (only with a display name of their own), household name and kind, member and open-item counts, Premium; never item names, emails or ids | `preview_invite_public()` (anon), `app/web/join/` | Art. 6 Abs. 1 lit. f (question 1) |
| 5 | Rate limit: salted SHA-256 of `X-Real-IP` and of the code per hour, with a count; no raw IP; past hours deleted at the next join-page request | `invite_preview_rate`, `invite_preview_salt`, `invite_preview_hit()`; the delete runs at the top of `preview_invite_public()` | Art. 6 Abs. 1 lit. f (question 2) |
| 5 | Android Install Referrer read once at first start; only the invite code and the click time are kept, on the device | `app/lib/household/install_referrer.dart` (`inviteInReferrer` reads only `invite`; `clickedAt` dates the pending invite) | Art. 6 Abs. 1 lit. b; § 25 Abs. 2 Nr. 2 TDDDG (question 4) |
| 5 | "Einladung einfügen" reads the clipboard only on that tap and keeps only an invite link or code | `app/lib/household/paste_invite.dart`, the only `Clipboard.getData` in `app/lib` | Art. 6 Abs. 1 lit. b; § 25 Abs. 2 Nr. 2 TDDDG (question 5) |
| 7 | Access tokens bound to their household; an OAuth connection works in the default household, sees names and member counts of the others and can act in them when the service names one | W1 `create_personal_access_token(..., p_household)`; `supabase/functions/mcp/tools.ts` `households()` (OAuth: all, token: its own), `household` argument | Art. 6 Abs. 1 lit. b (question 7) |
| 7 Siri | Token works while member of at least one household, acts in the default, follows a changed default; ends when leaving the last household; suggestions are item names of the household open in the app | W1 migration lines 655-770 (Siri tokens follow `is_default`, revoked only without any membership); `app/lib/list/list_scope.dart` builds `SiriSuggestions` from the open list | Art. 6 Abs. 1 lit. b (question 6) |
| 7 Alexa | "aktuellen Haushalts" becomes the default household | `householdOf()` in `supabase/functions/_shared/db.ts` reads `is_default` | Art. 6 Abs. 1 lit. b |
| 8 | Export holds all households and the invites joined through | `export_my_data()` in the W2 migration (`households`, `invite_uses`) | unchanged |
| 14 | Account deletion also deletes the join records; single households can be left; a deleted household takes its invites and join records with it; join-page check values after the hour | `invite_uses` foreign keys `on delete cascade` to `auth.users`, `households`, `invites` | unchanged |

## Open questions for Legal

1. Join page. Anyone holding a link sees, signed out, the inviter's first name, the household name
   and kind, member and open-item counts and Premium. We propose Art. 6 Abs. 1 lit. f. Is that
   right for the inviter's first name, or does it need lit. b (they created the link) plus a hint
   in the invite sheet that the page shows their first name? The app shows no such hint today.
2. Rate-limit hashes. The salted hash of the IP address is pseudonymous personal data. Is lit. f
   with the wording in section 5 enough? The rows of past hours are deleted only when the next join
   page is requested, so with no traffic they stay longer than an hour. The draft says so
   ("beim nächsten Aufruf einer Beitrittsseite"). If you want a hard bound, we would add a scheduled
   cleanup (a code change, not in this draft).
3. Join records after leaving. A member who leaves or is removed drops off "Wer ist beigetreten",
   but their `invite_uses` row (user id, invite, time) stays until they delete their account or the
   household is deleted. The table's RLS lets current members read the raw rows. Should leaving
   delete the row? We'd recommend that code change; the draft then needs no extra sentence.
4. Install Referrer. Is reading it at first start covered by § 25 Abs. 2 Nr. 2 TDDDG (the user
   tapped a join link to join), or does it need consent? Is Google an independent controller for
   it and belongs in section 12? The path is only reached once the Play listing is public and the
   join page shows its "App laden" link.
5. Clipboard. The read happens only on the user's tap of "Einladung einfügen". Same question:
   § 25 Abs. 2 Nr. 2 TDDDG, or no § 25 case at all?
6. Siri suggestions come from the household open in the app, while Siri writes into the default
   household. The draft describes this as it is. If the two should match, that is a code change.
7. AI connections (OAuth/MCP) reach all of the user's households when the service names one. The
   consent screen says only "Arbeitet in deinem Standard-Haushalt: <Name>" (`consentDefaultHousehold`).
   Should the consent screen say that the other households are reachable too?
8. Section 9 (analytics) lists actions and properties as examples. W1/W2 add the events
   "Haushalt gewechselt" and "Mitglied entfernt" (no properties), the invite's kind and context,
   the join methods "referrer" and "paste", the role "admin" and where a household was created.
   None carries names or text. The draft leaves section 9 unchanged; do you want them listed?
9. Section 14 says a Lifetime household is deleted when its last member leaves. The code
   (`leave_household_as`) can archive a Premium household on leave when the user asks and the
   `household_archive` switch is on. This predates 169b; please check the sentence.
10. Date. "Stand" is set to 8 November 2026 as a placeholder. The text describes W1 and W2, which
    are not in a store build yet. It should go live with the release that ships them.
11. Household kind. The server stores it, the join page and share texts use it, but no app screen
    asks for it yet (job 168 will). Keep the sentence now, or add it with job 168?
12. N-18. The draft says "Hummlist verschickt keine Einladungen". Please confirm the wording.
