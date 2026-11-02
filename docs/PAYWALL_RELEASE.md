# Paywall release: the go-live checklist

This is the ordered list of switches that put Hummlist Premium on sale and,
after that, lock Siri, Alexa and AI assistants behind it. Every step names its
owner. A step marked **Peter's yes** waits for Peter to say yes in his own
words. Nothing here has been flipped yet (job 67, 2026-11-02). The behaviour
behind the switches is in [`PURCHASES.md`](PURCHASES.md). The old per-job
notes are in [`NEEDS_LEAD.md`](NEEDS_LEAD.md) (jobs 43, 47, 49 and 50) and
[`NEEDS_PETER.md`](NEEDS_PETER.md) (jobs 25 and 43). This file replaces them
as the order to follow.

Owners:

- **Peter**: decisions, legal sign-off, anything under his Apple, Google or
  bank identity.
- **Ops** (Hummlist Ops): App Store Connect, Play Console and RevenueCat
  dashboard work. Ops creates no product and changes no price without
  Peter's yes.
- **Lead** (hummlist-lead): repository PRs, repository variables and
  secrets, function secrets, SQL on the hosted project.
- **Legal** (Legal Review): legal texts and their publication.
- **Launch** (Hummlist Launch): user-facing copy that is still a placeholder.

## The switches

| Switch | Where | Off today | Turned on in step |
| --- | --- | --- | --- |
| `REVENUECAT_PURCHASES` | GitHub variable, `release` environment (store builds) | unset | 5.1 |
| `REVENUECAT_APPLE_API_KEY`, `REVENUECAT_GOOGLE_API_KEY` | GitHub secrets, `release` environment | unset | 5.1 |
| `app_switches.premium_offer` | hosted database | `false` | 5.4 |
| `premium-launch` | `releases/flags.json` hold | `released: false` | 5.6 |
| PR #153 (privacy section 5a, FAQ, terms draft) | repository | open, not merged | 4.1 |
| `app_switches.integration_lock` | hosted database | `false` | 6.4 |
| `INTEGRATION_LOCK` | GitHub variable, `release` environment, and the Vercel project's environment | unset | 6.5 |
| `integration-lock` | `releases/flags.json` hold | `released: false` | 6.5 |

Store builds read the four build switches through `app/fastlane/Fastfile`
(`PREMIUM_DEFINES`) and `.github/workflows/release.yml`. The web build reads
`INTEGRATION_LOCK` through `scripts/vercel.sh`. The web app never sells, so
it takes no purchase define. While a variable is unset the build sells
nothing and locks nothing.

The Home Screen widgets are not part of the lock. They show the list the
app already has and never call Siri's, Alexa's or the MCP endpoint, so they
stay free with every switch on. Whether widgets should be Premium is
undecided (Peter). Locking them would be new work, not a switch.

## 1. Accounts and money (Peter)

1.1 **Peter**: App Store Connect → Business → Paid Apps agreement accepted,
bank account and tax forms done, status "Active". Without it Apple serves no
in-app product, not even in the sandbox (NEEDS_PETER "Job 25", item 1).

1.2 **Peter**: Play Console → Setup → Payments profile created and verified
(NEEDS_PETER "Job 25", item 2).

1.3 **Peter**: the App Store Small Business Program, and on Play the 15 %
service fee through an account group (NEEDS_PETER "Job 25", item 3). The
revenue estimate assumes 15 %.

1.4 **Peter's yes**: Google Play real-time notifications. They need a
Pub/Sub topic in a Google Cloud project with billing attached. The usage
stays inside the free tier. Without them a Play refund or renewal reaches
RevenueCat late (NEEDS_PETER "Job 43", item 3). Either answer works with the
code.

## 2. Store products (Ops, Peter's yes)

The products exist (Ops, 2026-10-31). This job created no product and
changed no price. Check each item and fix only what Peter approves.

2.1 **Ops**: App Store Connect, subscription group "Hummlist Premium"
(`22532621`). `com.hummlist.app.yearly` (Apple ID `6829293557`, 1 year) and
the non-consumable `com.hummlist.app.lifetime` (`6829223747`) each have a
German and an English display name and description, a review screenshot and
review notes, and the status "Ready to Submit". Family Sharing is off for
both, and Apple never lets it be turned off again once on.

2.2 **Ops**: Play Console. The subscription `com.hummlist.app.yearly` with
base plan `yearly` (auto-renewing, 1 year, grace period 14 days, account
hold 46 days, **no free trial or introductory offer**). The one-time product
`com.hummlist.app.lifetime` is active. Since job 67 the app buys the base
plan itself. An offer added later would not be charged without an app
change, which keeps the shown price the charged price (Legal Review A2-5).

2.3 **Peter's yes**: the prices. Euro storefronts EUR 9.99 a year and
EUR 29.99 Lifetime. US $9.99 / $29.99, UK £8.99 / £24.99, CH CHF 10 / CHF 30.
Brazil, Mexico and India get yearly only (`expectedPrices` in
`scripts/iap/product.ts`).

2.4 **Lead**: the price drift check. Set the repository secrets `ASC_KEY_ID`,
`ASC_ISSUER_ID`, `ASC_KEY_P8` and `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`. Then
run `deno run --allow-env --allow-net --allow-read scripts/iap/price_drift.ts`
once on the box, fill in the printed BR, MX and IN yearly amounts in
`expectedPrices` in a PR, and confirm that `price-drift.yml` is green
(NEEDS_LEAD "Job 49", steps 5 and 6). This is the launch gate for prices.

## 3. RevenueCat and the server (Ops, Lead)

3.1 **Ops**: RevenueCat project "Hummlist", in the dashboard:

- Entitlement `premium` (`entl654efcfce4`) with all four products: App Store
  yearly and Lifetime, Play `com.hummlist.app.yearly:yearly` and
  `com.hummlist.app.lifetime`. The Play Lifetime product is marked
  **non-consumable**.
- Offering `default` with `$rc_annual` and `$rc_lifetime`. The app loads
  products by id, so the offering is only for the dashboard.
- Restore behavior **Keep with original App User ID**, production and
  sandbox. "Track new purchases from server-to-server notifications" off,
  AI features off, no other integrations.
- App Store Server Notifications V2 (production and sandbox) point to
  RevenueCat's URL. The In-App Purchase key is uploaded. The Play service
  account is uploaded, plus Pub/Sub if 1.4 said yes.
- The webhook integration:
  `https://jdwqrallbpdbshrdhenk.supabase.co/functions/v1/purchases/revenuecat/webhook?forceFunctionRegion=eu-central-1`,
  production and sandbox, all apps, all event types, and the `Authorization`
  value the function expects.

3.2 **Lead**: the function secrets on the hosted project are set (names only,
never print values): `REVENUECAT_WEBHOOK_AUTH`,
`REVENUECAT_TOMBSTONE_HMAC_KEY`, `REVENUECAT_SECRET_KEY`,
`REVENUECAT_PROJECT_ID`, `REVENUECAT_DELETIONS_SECRET`, and
`REVENUECAT_WEBHOOK_HMAC_SECRET` if signing is on. The repository secret
`REVENUECAT_DELETIONS_SECRET` holds the same value (NEEDS_LEAD "Job 47",
step 1). Check:

- `supabase secrets list --project-ref jdwqrallbpdbshrdhenk` names them all.
- `curl -s https://jdwqrallbpdbshrdhenk.supabase.co/functions/v1/purchases`
  answers `{"configured":true}`.
- RevenueCat's "Send test event" gets 200 `ignored`.
- `revenuecat-delete.yml`, run by hand once, is green.

3.3 **Lead**: the hosted database has every migration of main up to and
including `20261102001623_premium_grace_kept.sql` (job 67), deployed by
`supabase-deploy.yml`. Read-only checks in the SQL editor:

```sql
select key, enabled from public.app_switches order by key;  -- premium_offer, integration_lock: false
select kind, premium_source, source, count(*) from public.entitlements group by 1, 2, 3;
```

3.4 **Lead**: delete the old RevenueCat entitlement `lifetime` only after
every installed app is a job 49 build or later (NEEDS_LEAD "Job 49",
step 2). The launch does not wait for it.

## 4. Legal texts (Legal, Peter's yes)

The open gaps between the drafts and what the app does are listed in the
job 67 PR ("For Legal Review"). Each one is either closed or accepted by
Legal before 4.1.

4.1 **Legal, Peter's yes**: PR #153 (rebased onto main by job 67). It puts
section 5a (yearly plan and Lifetime) into the privacy policy, deletes the
draft purchase pages, adds the FAQ entry "Wie kündige ich das Jahresabo?"
and the terms page as `draft: true`. It goes live on hummlist.com when it
merges, so it merges together with step 5.4, not earlier. Before merging,
set the publication date (handoff R.1 (4)) and confirm the English §12 line
job 67 composed while rebasing. The Lead merges it with
`~/groceries-ops/bin/merge-lock bash -c 'scripts/push-pr.sh && scripts/merge-pr.sh --wait 153'`
from the PR's checkout.

4.2 **Legal, Peter's yes**: the terms of use (`nutzungsbedingungen.md`,
`terms.md`). They stay `draft: true` until a lawyer has cleared the
⟦NEEDS A LAWYER BEFORE PUBLISHING⟧ markers. Until then the Premium page
links Apple's standard EULA on iOS and the support page on Android and the
web (`termsUrl` in `app/lib/purchases/premium_server.dart`). Once the page is
published, a one-line PR points `termsUrl` at `/nutzungsbedingungen` and
`/en/terms` on Android and the web. Apple's EULA can stay on iOS, or the
terms page can replace it there too (Legal decides).

4.3 **Legal**: privacy section 9 names `paywall_viewed` and
`integration_blocked` (and the Siri events), and section 7 says that Siri,
Alexa and AI assistants need Hummlist Premium. This is needed before 6.4,
not before the sale.

4.4 **Ops, after Legal**: the App Store privacy label and the Play Data
safety form list purchases (RevenueCat as processor, household id as user
id).

## 5. The sale

5.1 **Lead**: the store build switches. Set the `release` environment
secrets `REVENUECAT_APPLE_API_KEY` (`appl_…`) and `REVENUECAT_GOOGLE_API_KEY`
(`goog_…`), both from `~/groceries-ops/env`, and the variable
`REVENUECAT_PURCHASES=true`. Nothing is sold yet: while `premium_offer` is
off every build says "Hummlist Premium ist bald verfügbar.". Check: the
next Release run's `fastlane ios beta` and `fastlane android build` log
lines show `--dart-define=REVENUECAT_PURCHASES=true`. The key values are
masked.

5.2 **Lead**: for the sandbox run in 5.3, turn `premium_offer` on for a
short window with the statement in 5.4, then off again. Every installed
build with the define then sells. TestFlight builds buy only in the sandbox.
**Play internal testers who are not license testers pay real money**, so
only Play license testers (Play Console → Setup → License testing) take part
on Android.

5.3 **Peter and Lead**: the sandbox run on real phones (TestFlight with a
sandbox Apple ID, Play internal with a license tester). Peter and Lea's
household, or a fresh test household without a promotional grant:

- Mehr → Hummlist Premium shows both cards, yearly first, with the store's
  price and "inkl. MwSt.".
- Buy yearly. The page says "Wird freigeschaltet …", then „Hummlist Premium
  aktiv (jährlich, verlängert sich am …)“. The partner's phone shows the same
  within seconds without a reload.
- Restore on the partner's phone: nothing to buy, nothing to restore.
- Buy Lifetime while yearly runs. The warning appears first, then
  „Hummlist Premium Lifetime“ with the note that the plan keeps billing.
- „Abo verwalten oder kündigen“ opens Apple's or Google's subscription page.
  Cancel there. The status says „läuft am … aus“. The sandbox year lasts one
  hour on Apple and 30 minutes for Play license testers. After the end the
  household is back to both cards (a household without Lifetime).
- A household with a promotional grant (`scripts/iap/promotional.ts grant`)
  shows „Hummlist Premium geschenkt“ and no Buy.
- The webhook rows: `select event_type, count(*) from public.revenuecat_events group by 1;`
  in the SQL editor.

Turn `premium_offer` off again when the run ends.

5.4 **Lead, Peter's yes**: the sale opens, together with 4.1:

```sql
update public.app_switches set enabled = true, changed_at = now() where key = 'premium_offer';
```

5.5 **Peter's yes, Ops**: App Store review. The app has no public release
path yet ([`RELEASE.md`](RELEASE.md), "Public releases"). The store
submission is its own job and needs Peter's go. For the paywall it must
attach both in-app purchases to the app version ("In-App Purchases and
Subscriptions" on the version page), since Apple reviews a first purchase
only with a version. The review notes name a reviewer account whose
household has no promotional grant, so the reviewer can buy in the sandbox
(the App Review household from "Testers" in `PURCHASES.md` has a grant and
shows no Buy). Play: the production track, with its own release job as on
Apple.

5.6 **Lead**: the changelog. A PR sets `"released": true` for
`premium-launch` in `releases/flags.json`, as part of the release whose
store build first sells. The next `changelog.mjs draft` then takes the held
Premium items: job 49's ("Hummlist Premium gibt es jetzt jährlich oder als
Lifetime …") and job 67's. Whoever owns the release checks the "What's new"
texts against the 500-character limit (`node scripts/release/changelog.mjs drafts`).

5.7 **Launch, Peter's yes**: the placeholder copy. Every `premium*` key
marked PLACEHOLDER in `app/l10n/app_de.arb` and `app_en.arb`, and the rename
„Hummlist Lifetime“ → „Hummlist Premium“ in the older strings (S-11, about
45 lines; for example `joinTargetUnlocked` "Dieser Haushalt hat Hummlist
Lifetime" also shows for yearly and granted households). The guides on
hummlist.com that call the integrations free. Launch can do this before 5.4.
A sale with the placeholder copy is possible but not recommended.

## 6. The integration lock (after the sale is live)

6.1 **Peter's yes**: the households that keep the integrations for free
(beta households). Spec #4 says no grandfathering.

6.2 **Lead**: a promotional grant for each of them, a dry run first:
`deno run --allow-env --allow-net scripts/iap/promotional.ts grant --household <uuid>`,
then with `--apply`. The Alexa certification account and the App Review and
Play Review households need a grant too, or they hear only the Premium
answer.

6.3 **Lead**: the cut-over count, read-only, in the SQL editor:
`scripts/iap/integration-cutover.sql`. It lists every household without
Premium that uses an integration now. Peter sees the numbers before 6.4.

6.4 **Lead, Peter's yes**, after 4.3:

```sql
update public.app_switches set enabled = true, changed_at = now() where key = 'integration_lock';
```

From this moment Siri (Shortcut and native), Alexa (add, read, launch) and
MCP tool calls refuse households without Premium, with the Premium sentence.
Nothing is deleted or disconnected.

6.5 **Lead**: the app side. Set the variable `INTEGRATION_LOCK=true` in the
`release` environment and in the Vercel project's environment (production
and preview). The next store builds and the next web deploy then show the
Premium card under Mehr › Zugänge. A PR sets `"released": true` for
`integration-lock` in `releases/flags.json`. The held item "Sprachbefehle
über Siri und der Zugang für KI-Assistenten gehören jetzt zu Hummlist
Premium." then reaches the next release.

## 7. After each step: what to watch

- The `purchases` function logs in the Supabase dashboard. A 401 means a
  wrong `REVENUECAT_WEBHOOK_AUTH`. A 503 `not_recorded_yet` means a lifecycle
  event arrived before its purchase, and RevenueCat retries it. A 5xx means a
  database failure, and RevenueCat retries 5 times over about 80 minutes.
- `price-drift.yml` (daily) stays green.
- PostHog project 319492: `purchase_completed`, `paywall_viewed` and, after
  6.4, `integration_blocked`.

## Rollback

| What went wrong | Do this | Effect |
| --- | --- | --- |
| Anything with the sale (wrong price, store problem, a bug) | `update public.app_switches set enabled = false, changed_at = now() where key = 'premium_offer';` | At once, on every build: no card, no Buy, no store price query. What was bought stays unlocked |
| A price drifted | The same statement, then fix the price (Ops, Peter's yes) | As above |
| The integration lock refuses the wrong households | `update public.app_switches set enabled = false, changed_at = now() where key = 'integration_lock';` | At once: every integration open for every household, and the app hides the card in every build (it reads the switch) |
| A build should not sell at all | Unset `REVENUECAT_PURCHASES` (and `INTEGRATION_LOCK`), and let the next Release run ship | The next builds show "bald verfügbar". Installed builds follow the server switch |
| The privacy text must come back | Revert the #153 commit on main in a PR | hummlist.com redeploys from main |
| A webhook secret leaked | Rotate `REVENUECAT_WEBHOOK_AUTH` in RevenueCat and the function secrets together. Never rotate `REVENUECAT_TOMBSTONE_HMAC_KEY` | Deliveries between the two changes fail and are retried |
| A single purchase is wrong | Refunds go through Apple or Google (the refund help, `PURCHASES.md` "Refunds when something is off"). RevenueCat's refund event locks that purchase | Hummlist never refunds itself |

Purchases cannot be taken back by a switch. Once something is sold, the
buyer's household keeps it (model A), whatever is turned off later.
