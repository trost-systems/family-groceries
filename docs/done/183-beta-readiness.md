# Job 183: reliability beta readiness, free core (2026-11-11)

Synthetic checks only. No user data or feedback was read. No code fix, because no check found a
blocker. A docs PR corrects two sign-in items that were done but still listed as open, and adds
the beta note to `docs/RELEASE.md`.

| Area | Covered by (green on main 3119516d, CI run 42931150622) | Checked live (11 Nov, read-only) | Status |
| --- | --- | --- | --- |
| Apple and Google sign-in | e2e `social-sign-in` (8), `id-token` (6: nonce, audience, linking), `auth` (4); `social_sign_in_test.dart`, `auth_config_test.dart`; release IPA and AAB built with `config/auth.json` (release run 42897400437) | Hosted auth config: Apple list has `com.snacklist.app`; Google has the web and Snacklist iOS clients; nonce check on | Web green. **Native release builds blocked**: they need a phone (below) |
| Invite and revoke | e2e `invite-loop` (4: revoke, new link, old link invalid, removal, no rejoin by old link), `households` (7), `join-page` (17); pgTAP `invites`, `households_invites` | `/join/<code>` 200; AASA and assetlinks list `com.snacklist.app` with the Play signing key | Green |
| Two-person live sync | e2e `live-sync` (8), `rls` realtime leak; `fg sync` smoke (3); cubit, regression and fuzz tests | | Green |
| Offline and reconnect | e2e `connectivity` (2), `offline-start` (3), `list-header`; `list_cubit_test`, `network_test`, `list_cache_test` | | Green on web. Native network detection is unit-tested only |
| DE/EN naming, mail links | `emails` gate, `auth_mail_test.ts`, `no-hummlist` lint; e2e `legal` (8), `deep-links` (4) | Hosted mail templates: Snacklist in DE and EN, links only to `ConfirmationURL` and snacklist.app; app, site, legal pages 200; hummlist.com redirects 308 | Green. The old Alexa skill still says Hummlist until S5 |
| Privacy consent, account deletion | e2e `analytics` (8), `account` (6); pgTAP `account_deletion`, `consent_text_version`; `account/handler_test.ts` | `/datenschutz`, `/en/privacy` 200 | Green |
| CI, build, crash, feedback | `ci-ok` green on main; last store upload 0286a194; PostHog error tracking after consent (e2e `analytics`); e2e `feedback` (8) | Supabase `health` 200; keepalive green daily | Green. Crash reports only from testers who said yes to analytics (by design) |

**Blocked: needs a phone with the store builds.** Neither runner can reach one, and these are not
marked as passed:

1. Google sign-in in the Play internal build.
2. Google sign-in in the TestFlight build.
3. Apple sign-in in the TestFlight build.
4. Apple sign-in on Android (browser redirect back into the app).
5. An invite link that opens the installed app.

Steps are in `~/groceries-ops/jobs/183-beta-readiness/OPS_HANDOFF.md` and `docs/NEEDS_PETER.md`,
section 4.

**Gaps that are not blockers.** These are listed for later jobs. None has an e2e test:

- A person invite revoked through the UI (pgTAP covers it).
- An expired invite.
- Revoking a link while the join page is open.
- Remaining members seeing a removal live.
- An offline start before the first sync.

There is no password-reset screen; the magic link stands in for it. Feedback notifies no one.
