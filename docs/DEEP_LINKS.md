# Deep links (app.hummlist.com)

A link to `https://app.hummlist.com/<path>` opens the matching screen of the installed Hummlist
app: iOS universal links, Android App Links. Where the app is not installed, the same URL opens
the web app, which routes it the same way. Emails (the E2 onboarding email links
`https://app.hummlist.com/more/invites`), the site and invites use these URLs. Job 66; invite
links (`/join/<code>`) came first in job 22.

| | |
| --- | --- |
| Route table in code | [`app/lib/app/deep_links.dart`](../app/lib/app/deep_links.dart) (`appLinks`) |
| Routing | [`app/lib/app/router.dart`](../app/lib/app/router.dart) (`authRedirect`, `buildRouter`) |
| iOS | [`app/ios/Runner/Runner.entitlements`](../app/ios/Runner/Runner.entitlements) (`applinks:app.hummlist.com`), [`app/web/.well-known/apple-app-site-association`](../app/web/.well-known/apple-app-site-association) |
| Android | [`app/android/app/src/main/AndroidManifest.xml`](../app/android/app/src/main/AndroidManifest.xml) (the `autoVerify` filter), [`app/web/.well-known/assetlinks.json`](../app/web/.well-known/assetlinks.json) |
| Serving | [`vercel.json`](../vercel.json): `.well-known/` stays out of the SPA rewrite; the AASA is served as `application/json` |
| Checks | [`app/test/app/deep_links_config_test.dart`](../app/test/app/deep_links_config_test.dart), [`app/test/app/router_test.dart`](../app/test/app/router_test.dart), [`scripts/gates/web-prod.sh`](../scripts/gates/web-prod.sh), [`e2e/tests/deep-links.spec.ts`](../e2e/tests/deep-links.spec.ts), [`e2e/web-smoke.mjs`](../e2e/web-smoke.mjs) on a deployed URL |
| Decisions | [DECISIONS.md](DECISIONS.md), "Job 66" |

## Route table

| Link | Opens | Signed out |
| --- | --- | --- |
| `/list` | the list | sign-in, then the list |
| `/add` | the list with the add sheet open and the field focused | sign-in, then the add sheet |
| `/stores/<store id>` | the list, scrolled to that store's section and unfolded. An unknown id, another household's store or a store without open items: the list | sign-in, then the store |
| `/more` | the More tab | sign-in, then More |
| `/more/invites` | More, Einladungen (invite the partner, open invites) | sign-in, then Einladungen |
| `/more/settings` | More, Einstellungen (theme, language) | sign-in, then Einstellungen |
| `/more/settings/language`, `/more/access`, `/more/account`, `/more/lifetime` | the More page of that path | sign-in, then that page |
| `/join/<code>` | the join screen for that invite | sign-in, then the join screen (job 22) |
| anything else | the list | sign-in, then the list |

The app's own `/` is the list too, but it is not claimed (see below).

Signed out, the link's location rides along as `/login?next=<location>`. After sign-in the
analytics question comes first on a new install, then the link's screen. An account without a
household goes through onboarding first (Step 1, creating or joining) and then lands on the
link's screen instead of Step 3. Signing out never carries the screen the user was on.

On iOS and Android a sign-in that leaves the app (a magic link, Apple on Android) comes back
through `com.hummlist.app://login-callback`, which loses the location. The router keeps the
link's location in memory until the sign-in completes. Invite codes also survive an app kill
(`PendingInvite`, job 22); other links do not, the app then opens the list.

## What the apps claim, and what not

Only the paths in `appLinks` open the app. Each is listed in the AASA `components` and as a
`<data android:path|pathPrefix>` of the verified intent filter; `deep_links_config_test.dart`
fails when either differs from the table.

Not claimed, so they always stay in the browser:

- `/`: web sign-in (Google, Apple, magic link) returns to the app URL with a code that only the
  browser that started it can redeem. A link-continuing web sign-in returns to `/?next=<link>`
  for the same reason.
- `/login`, `/welcome`, `/welcome/*`, `/analytics-consent`: pages a browser flow redirects to.
- `/oauth/consent`: the MCP OAuth consent page (docs/MCP.md) must finish in the browser of the
  MCP client's flow.
- `/settings`: the redirect for links from before job 29d (Zugänge, or Konto with
  `?section=account`). It still works in the app and on the web, it just does not open the app.
- Static files (`/konto-loeschen.html`, assets).

## Adding a link

1. Make the router handle the path (`authRedirect` in `router.dart`; a More page under `/more/`
   needs nothing else).
2. Add it to `appLinks` in `deep_links.dart`.
3. Add it to the AASA `components` (`/x` exact, `/x/*` for a prefix) and to the manifest's
   verified filter (`android:path` or `android:pathPrefix`). `flutter test
   test/app/deep_links_config_test.dart` tells you what is missing.
4. Add a row to `router_test.dart` and to the table above.

Apple's CDN caches the AASA (up to a day or two); a new path opens the app once an iPhone has
the new file. Android verifies the domain, not paths, so a new path works with the app build
that has the new filter.

## Rollout

app.hummlist.com serves `app/web/.well-known/` from the `release` branch, so the new AASA goes
live with the next dispatched store release, together with the app that routes the paths
(docs/DEPLOY.md, "Web app"). An older app that receives a new link still opens: `/add` and
`/stores/<id>` show the list there, `/more/...` already worked. Check the live files with
`node e2e/web-smoke.mjs https://app.hummlist.com` and Apple's cached copy with
`curl https://app-site-association.cdn-apple.com/a/v1/app.hummlist.com`; Google's view of the
domain is
`https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://app.hummlist.com&relation=delegate_permission/common.handle_all_urls`.

## Home Screen widgets (job 63)

The widgets open the app with `hummlist-widget://open` and `hummlist-widget://add`, handled by
`app/lib/home_widget/` (not by these links). The widget's Add has its own add-sheet request next
to `ListLinks` in the list screen; it could map onto this table (`router.go('/add')`) instead.
That is a follow-up in job 63's files, not part of job 66.
