# Store review notes: free Hummlist Premium in the beta (Legal Review N-57)

Draft review notes for the builds that carry the free beta unlock (job 43b). The text comes from
Legal Review's handoff of 2026-11-03 (section 3), approved by Peter on 2026-11-03 at 20:32. Paste
it as written, after checking the conditions below on the submission date. Nothing here is
submitted by a job.

## Apple: App Store Connect "App Review Information → Notes" and TestFlight "Beta App Review Information"

> Hummlist Premium is unlocked free of charge for beta households. The unlock is a RevenueCat
> promotional entitlement granted from our server; the user pays nothing and nothing renews. This
> build sells nothing: it shows no prices, no purchase or restore buttons and no links to outside
> payment. When sales start, Hummlist Premium will be sold only through Apple In-App Purchase, in a
> later build submitted for review. The demo account's household already has the free unlock.
> Privacy policy: https://hummlist.com/en/privacy#premium-beta

## Google Play: testing-track and production "App access" / review notes

> Hummlist Premium is unlocked free of charge for beta households. The unlock is a RevenueCat
> promotional entitlement granted from our server; the user pays nothing and nothing renews. This
> build sells nothing: it shows no prices, no purchase or restore buttons and no links to outside
> payment. When sales start, Hummlist Premium will be sold only through Google Play Billing, in a
> later release. The test account's household already has the free unlock. Privacy policy:
> https://hummlist.com/en/privacy#premium-beta

## Conditions (check on the submission date)

- **Demo and test households.** Keep "The demo/test account's household already has the free
  unlock" only if it is true then. Play Review's household has had it since 1 Nov 13:23 CET
  (docs/PURCHASES.md). Apple's demo household is **unverified**. Check it with
  `scripts/iap/promotional.ts status --household <id>`.
- **"This build sells nothing"** holds only with `premium_offer` off (server switch) and
  `REVENUECAT_PURCHASES` unset in that build (N-53). Release builds read the repository variable,
  and its value is **unverified** here.
- **Public App Store.** If the build goes to the public App Store rather than TestFlight,
  guideline 2.2 says "Demos, betas, and trial versions of your app don't belong on the App Store –
  use TestFlight instead". Then add: "The app is complete; 'beta' refers only to the free
  introductory period before Hummlist Premium is sold." Whether Apple accepts that is
  **unverified**.
- **Guideline 3.1.1** is about paid unlocks. Legal Review reads a free server grant, with nothing
  for sale, as not covered by it. How Apple treats it is **unverified**.
- **Guideline 2.1(a):** include the demo account info.
- **Privacy labels:** no change. Apple App Privacy already declares "Identifiers › User ID" (App
  Functionality, linked, not tracking). Play Data safety already declares "Personal info › User
  IDs" (collected, not shared: RevenueCat is a service provider). Don't add "Purchase History" for
  grants.
- **The link target.** The beta-wide wording of `#premium-beta` is in the privacy policy only
  once job 43b's PR is merged and deployed. The anchor itself exists since #216.
