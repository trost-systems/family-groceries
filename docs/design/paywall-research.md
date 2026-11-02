# Paywall research for Hummlist Premium

## 1. Scope and method

Date: 2026-11-02. Purpose: evidence for paywall prototypes of Hummlist Premium
(household unlock for the integrations Siri, MCP and the public API; Alexa stays free).

Product facts from the repo (`docs/PURCHASES.md`, `docs/DECISIONS.md` jobs 25, 43, 49):
two products, one entitlement `premium`. Yearly is an auto-renewing subscription at
EUR 9.99 per year in Germany. Lifetime is a one-time purchase at EUR 29.99, three times the
yearly price. One member pays and the whole household has it. The RevenueCat customer is the
household id. The SDK starts only after a tap on the Premium page (Legal Review K.11).
DECISIONS "Job 43" item 22 rules out RevenueCat Paywalls and Customer Center for now, so section 5 describes
what Paywalls v2 can render but the app draws its own UI.

Method. Pages were opened with WebFetch, which returns a model summary of the page, not the raw
text. Figures below are as that summary stated them. Items marked "(snippet, not opened)" come
only from a search result snippet. Where a source did not give a number, none is given here.
Several RevenueCat pages are internally inconsistent (noted where it matters). Nothing here is
legal advice.

Opened: RevenueCat State of Subscription Apps 2026 and 2025 (overview pages), the 2026
Productivity page, RevenueCat blog posts (paywalls study guide, paywall tests, lifetime
subscriptions, paywall redesigns, ugly paywalls, paywall placement, weird paywalls), RevenueCat
Paywalls docs (overview, components), Superwall best practices blog, Adapty State of In-App
Subscriptions 2025 page, Apple App Review Guidelines (first 100,000 characters), Apple
subscriptions page, Google Play subscriptions policy, DSA Art. 25 (third-party mirror),
PAngV paragraphs 2 and 3, CMS Law article on the Digital Fairness Act, AnyList Complete page,
two Bring! news articles (2014, 2020).

Not obtained: EUR-Lex pages returned empty, so the UCPD annex and DSA text were not read at the
source. No German survey on one-time purchase versus subscription was found. No first-hand
paywall teardown of Todoist, Things, Duolingo, Headspace or Flo was opened.

## 2. RevenueCat findings

**R1. Hard paywalls convert far more than freemium, retention is similar.** SOSA 2026 (2025
data): day 35 download-to-paid 10.7% for hard paywalls against 2.1% for freemium. Day 14 revenue
per install $2.32 against $0.27. Year-one retention is nearly identical. SOSA 2025 reported
12.11% against 2.18% and a refund rate of 5.8% against 3.4%. Hummlist's free list is freemium by
design, so the 2% class is the realistic benchmark for the free-to-paid step.
https://www.revenuecat.com/state-of-subscription-apps/ and
https://www.revenuecat.com/state-of-subscription-apps-2025/

**R2. Most trials start on install day.** 82% of trial starts happen on the install day (SOSA
2025). In Productivity, 78% of trials start on day 0, the lowest share of the listed categories,
and 22% start later, the highest delayed rate. Nearly 72% of Productivity conversions happen on
day 0. A utility that earns trust over weeks is a later-trigger case. Sources: SOSA 2025 and
https://www.revenuecat.com/state-of-subscription-apps-2026-productivity

**R3. Trial length and conversion.** SOSA 2026 medians for trial-to-paid: 25.5% for trials of
4 days or less, 37.4% for 5 to 9 days, 42.5% for 17 to 32 days. Short trials are 46.5% of all
trials. 55.4% of 3-day trial cancellations happen on day 0. Hummlist Lifetime cannot have a
trial (R9), and a yearly trial is not decided.
https://www.revenuecat.com/state-of-subscription-apps/

**R4. Western Europe numbers.** Germany is not broken out. Western Europe medians in SOSA 2026:
download-to-paid 2.0% (North America 2.6%), download-to-trial 5.0%, trial-to-paid 29.7%. Monthly
RLTV per payer $17.89 and yearly $26.64, both above North America. SOSA 2025: Western Europe has
refund rates below 3.0% and high year-one LTV.
https://www.revenuecat.com/state-of-subscription-apps/

**R5. Yearly plans win revenue per install and retention.** Apps whose top plan is yearly have
revenue per install of $0.36 at day 14 and $0.46 at day 60, against $0.18 and $0.29 for monthly
(SOSA 2026). Year-one retention: yearly 44.1%, monthly 17.0%, weekly 3.4% (SOSA 2025). The yearly
share of plan durations fell from 41.4% to 33.6%.
https://www.revenuecat.com/state-of-subscription-apps/

**R6. Price level.** Median yearly price rose from $31.60 to $34.80 (SOSA 2026). Median
subscription app price is $29.99 and top-quartile prices are almost three times higher (SOSA
2025). Higher-priced apps converted worse to trial (28.4% against 47.8% trial-to-paid) but showed
about 7x year-one LTV per payer ($55.21 against $8.08). Hummlist's EUR 9.99 yearly sits in the
low-price class (the 2026 bottom quartile is roughly $17 to $20).
https://www.revenuecat.com/state-of-subscription-apps-2025/

**R7. Lifetime is common but rarely the headline.** 23.2% of apps pair subscriptions with a
lifetime plan (SOSA 2026). Lifetime-dominant apps have day 14 revenue per install of $0.19.
RevenueCat's lifetime post says lifetime offers are usually not prominent on the main paywall and
are pushed through email, push, in-app messages and promotions. Utility apps with low or variable
usage may show it as a standard option.
https://www.revenuecat.com/blog/growth/lifetime-subscriptions.md

**R8. Lifetime price multiples.** Examples in the post: Moonly 2.1x annual, Fiit 3.1x, Placify
3.3x, Jumpspeak 3.6x, Calm 5.0x, Waking Up 11.5x. Typical range roughly 2x to nearly 12x. The post
advises pricing higher when unsure and testing 5x, 8x and 12x. A separate post suggests 1.5 to 2x
LTV. Hummlist's 3.0x (EUR 29.99 against 9.99) is at the low end of the range.
https://www.revenuecat.com/blog/growth/lifetime-subscriptions.md and
https://www.revenuecat.com/blog/growth/paywall-tests-grow-app-revenue.md

**R9. Lifetime caveats.** No free trial, because the App Store treats it as a non-consumable.
Switching from a subscription needs manual cancellation and can cause double charges, refunds and
support load. "Family plans on lifetime can erode revenue", so the post says terms should name
what is included. The word "lifetime" may be read as product life, so terms matter.
https://www.revenuecat.com/blog/growth/lifetime-subscriptions.md

**R10. Make the yearly plan the default and anchor to a monthly price.** Mojo (RevenueCat
tests post): yearly as default with monthly behind "view all plans" lifted yearly take-up by 15 to
20% with a minor rise in cancellations. Showing "$4.99 per month billed annually" instead of
"$59.99 per year" raised revenue per impression. Conflict: Google Play policy says not to show
annual pricing mainly as a monthly figure (L3 in section 7).
https://www.revenuecat.com/blog/growth/paywall-tests-grow-app-revenue.md

**R11. Show the trial timeline.** Blinkist added a free-trial timeline after exit surveys showed
users did not know when they would be charged. The post does not state the lift in its body.
Related: the Personal Best "Redeem your free 2 weeks" one-tap CTA (figures only in a chart image).
https://www.revenuecat.com/blog/growth/paywall-tests-grow-app-revenue.md

**R12. Sell the outcome, make the CTA the only colored element, use real reviews.** The post's
advice: "you're going to look your best" beat "20 times cheaper than a trainer" in one test (no
figures). Show App Store reviews with a name and date. Silent, text-free demo video built trust in
FitnessAI. Showing the paywall earlier with a demo video raised views 50% and doubled
install-to-trial, trial-to-paid flat.
https://www.revenuecat.com/blog/growth/paywall-tests-grow-app-revenue.md

**R13. Redesign case studies, shorter is better.** Four redesigns: crypto promo paywall 2.7% to
3.24% view-to-subscription (over 20%); driver-license app ARPU +17.02% with real reviews at the
top; party game install-to-trial +31%, revenue +64% (monthly moved under "View All Plans", yearly
framed "SAVE 83%"); food app install-to-trial +72% (monthly and yearly side by side, "SAVE 40%",
effective monthly price). Caveat in the post: as of February 2026 Apple rejects apps that use a
trial toggle on paywalls. All four are onboarding paywalls of consumer apps, not feature-gate
paywalls.
https://www.revenuecat.com/blog/growth/paywall-redesigns-case-studies/

**R14. Placement: before locked features.** The placement post gives no numbers for feature-gated
paywalls. It quotes Jake Mor suggesting a paywall before users reach a locked feature, and
PhotoRoom showing it after the core action. Onboarding moves raised trial sign-ups about 400%
(Greg, plant app, bundled with a pricing change) and revenue 5x (Rootd). Experts advise testing
placements, not copying.
https://www.revenuecat.com/blog/growth/paywall-placement/

**R15. Entry-point personalization.** Duolingo changes the emphasis by entry point (unlimited
hearts from the shop, ad removal from an ad). No metrics. Fits Hummlist's two entry points, More
and the integration settings.
https://www.revenuecat.com/blog/growth/paywall-tests-grow-app-revenue.md

**R16. Light and stripped-back paywalls.** Golf GameBook switched from dark green to white and saw
a "significant" trial conversion lift, no figures. Strava, Fishbrain and Headspace are named as
simplified paywalls without results.
https://www.revenuecat.com/blog/growth/ugly-paywalls-conversion-testing/

## 3. Other sources

**S1. Superwall best practices.** Keep 1 to 3 plans with a clear recommended one. Test a "most
popular" highlight and annual versus monthly as the default. Show benefits, not features.
Trigger after the user has experienced value, tied to a product event. Claims: pushing annual
plans gives a "10 to 30% LTV uplift", abandoner offers convert at 25%+, personalization beats
generic by 15%+. These are vendor claims without method. Urgency "sparingly" is advice that
conflicts with EU rules (section 7).
https://superwall.com/blog/superwall-best-practices-winning-paywall-strategies-and-experiments-to

**S2. Superwall trial wording (snippet, not opened).** A "No Payment Due Now" label above the
button is described as a repeatedly working tweak. Customer-reported lifts on its agencies page
are self-reported. A third-party glossary gives rough ranges (impression-to-trial 5 to 15%,
trial-to-paid 40 to 70%) without sources (snippet, not opened).

**S3. Adapty 2025 report.** The page text is mostly charts. Qualitative findings: three-plan
paywalls (weekly, monthly, yearly) deliver the highest LTV, and annual plus weekly creates an
upgrade path. Based on $1.9B revenue and 11,000+ apps. No Germany, lifetime or trial-versus-none
figures were readable. https://adapty.io/reports/state-of-in-app-subscriptions-2025/

**S4. AnyList Complete.** A grocery-list peer. USD 9.99 per year for an individual and USD 14.99
per year for a household. Paid items: recipe photos and scaling, item prices and totals, store
filters, themes, priority support, cloud backup of photos. The page has no trial. Layout: headline,
feature sections with screenshot, heading, short text and often a user testimonial, price and
button repeated at top and bottom, a link to compare with the free plan. Hummlist's household
price (one payment covers the household) matches this pattern.
https://www.anylist.com/complete

**S5. Bring! history.** In 2014 Bring! moved shared lists behind a subscription, drew heavy
negative comments, and made shared lists free again within about three months
(https://www.appgefahren.de/?p=114815). In 2020 Premium cost EUR 13.99 per year and its main
benefit was no ads (https://www.mobiflip.de/?p=401895). A search snippet reports other prices in
other years (snippet, not opened). Lesson: taking away a core shared-list function from existing
users is punished. Hummlist keeps list, sync and Alexa free.

**S6. Todoist and Things (snippets, not opened).** A 2026 comparison page puts Todoist Pro at
USD 5 per month billed yearly after a price rise in December 2025, one account per subscription.
Things 3 is a one-time purchase per platform (USD 9.99 iPhone, 19.99 iPad, 49.99 Mac). Evidence
that both models coexist in German-popular utilities. Not verified at the vendors.

**S7. Unconventional paywalls (RevenueCat post, opened).** CoinStats animated paywall average lift
2.9x, CapCut carousel with auto-playing demos, Waterllama long scrolling paywall with awards and
reviews, Flo story-style "swipe to reveal your discount" with 86% off lifetime at USD 24.99 and
a crying teddy bear on decline. Flo's pattern is the type of confirmshaming and fabricated
discount that section 7 flags for review. Not suitable for Hummlist.
https://www.revenuecat.com/blog/growth/weird-paywalls-drive-subscription-growth/

**S8. Apple subscription sign-up screen requirements (opened).** Must show subscription name,
duration and content; the full renewal price "clearly and prominently"; a way for subscribers to
sign in or restore. The billed amount must be the most prominent pricing element. Trials must say
how long they last and the price after. Terms of Use and Privacy Policy links must be in the app
and in metadata. https://developer.apple.com/app-store/subscriptions/

**Not covered:** Duolingo, Headspace and Flo paywall layouts are known only from RevenueCat's
mentions (R15, R16, S7). Family plan framing for those apps was not researched.

## 4. Patterns

| Pattern | Evidence | Fit for Hummlist |
| --- | --- | --- |
| Contextual paywall at the locked integration, plus a Premium page in More | R14, R15, S1, `integration_blocked` already exists | High. Entry-point copy differs per integration. Matches the two `entry_point` values. |
| One page, 2 plans, clear recommended one | R10, R13, S1, S3 | High. Two products only. Recommend one, show both prices fully. |
| Yearly as default selection | R10, R5, S1 | Medium. At EUR 9.99 the gap to Lifetime is small, so a recommendation must not hide Lifetime. |
| Lifetime shown as a plain option, not a promotion | R7, R8, R9 | High. A utility with low running cost, German one-time preference (section 6). No fake discount. |
| Monthly-equivalent price anchor | R10 | Low. Contradicts Google policy text (L3). Show the total price first. |
| Benefit copy tied to household tasks | R12, S1 | High. "Add by voice, in the car" over "Siri integration". |
| Real social proof (reviews with name and date) | R12, R13, S4 | Low now. Needs real reviews. No invented testimonials. Household or store rating only when real. |
| Trial timeline | R11, S8 | Only if a yearly trial is introduced. Not needed for Lifetime. |
| Trial toggle | R13 | Avoid. Apple rejecting (R13). |
| Urgency, countdown, "swipe to reveal discount" | S1, S7 | Do not use. Section 7 lists the risk. |
| Calm, light, stripped-back layout | R16, R13 | High. Matches Hummlist's own look. |
| Soft paywall (free core) | R1 | Fixed by product. Expect low conversion, use a household-level metric (`paying_share_wah`). |

## 5. What RevenueCat Paywalls v2 can render

Docs: https://www.revenuecat.com/docs/tools/paywalls (overview) and
https://www.revenuecat.com/docs/tools/paywalls/creating-paywalls/components (components).
The overview lists purchases-flutter 8.10.1 as the minimum Paywalls SDK, iOS 15+, Android 7.0+,
and web through Web Purchase Links. One paywall per Offering, single screen or multi-step flow
(multi-step needs a newer SDK, 10.7.0 for Flutter).

Components:

- Core: Text (formatting, variables, custom fonts), Image, Video (MP4, MOV, also as background),
  Icon (Tabler-based), Custom (HTML, CSS, JavaScript), Stack, Header (fixed top), Footer
  (fixed bottom).
- Paywall: Package (selectable, default and selected states), Purchase button, Express checkout
  buttons (Apple Pay and Google Pay, web only).
- Interactive: Tabs (package groups), Switch (toggle between two option sets), Button (restore,
  back, open link or sheet), Carousel (swipeable pages).
- Content: Countdown (timer to a date), Timeline (progression), Social proof, Feature list and
  Award (pre-styled starting points).

No separate template catalogue is described on the components page. Prototypes that stay within
Stack, Text, Image, Icon, Package, Purchase button, Button (restore, terms, privacy), Feature list,
Timeline and Switch map one to one. Avoid Countdown in prototypes (section 7).

Constraint for Hummlist: DECISIONS "Job 43" item 22 forbids RevenueCat Paywalls and Customer Center, and the
lint rule keeps `purchases_flutter` in one file. A prototype can mimic the components, but the app
page stays native. Paywalls would also load remote configuration and send paywall events to
RevenueCat, which is a question for Legal Review (Q7).

## 6. German market and household angle

Evidence is thin. What was found:

- Western Europe pays well once converted (R4: monthly RLTV $17.89, yearly $26.64, refund rate
  below 3.0% in SOSA 2025) but converts to paid less than North America (2.0% against 2.6%).
- Germany is not broken out in the RevenueCat reports (R4, SOSA 2025 preview). No Germany-specific
  Adapty figure was readable (S3).
- A German iphone-ticker report says about 20% of users backed out after Apple added the extra
  subscription confirmation dialog (snippet, not opened). It illustrates subscription caution, not
  a survey.
- Bring! shows German users reject losing shared-list functions (S5). Its 2020 Premium price was
  EUR 13.99 per year for no ads.
- A one-time purchase option is established for utilities (Things, S6, snippet). No survey on
  German preference for one-time payment was found. State this as an assumption, not a finding.
- The household angle: AnyList prices a household tier above the individual tier (S4). Todoist
  ties a subscription to one account and does not support Family Sharing (S6, snippet). Hummlist's
  model A is one payment for the household, which the page should say in plain words. Lifetime in a
  family setting carries erosion risk for the seller (R9), but Hummlist binds it to one household.
- Trust: privacy is a stated product stance (consent-gated analytics, SDK only on tap). The page
  can say what the purchase does not do (no account at RevenueCat beyond the household id,
  no ad identifiers). Wording needs Legal Review.

## 7. Legal must-haves, DE/EU

Checklist for the paywall page. Each item names its source. These are questions, not advice.

- L1. Price shown in euro, total price including VAT. PAngV section 2 no. 3 defines the Gesamtpreis
  as the price "einschließlich der Umsatzsteuer und sonstiger Preisbestandteile"; section 3 para 1
  requires Gesamtpreise towards consumers, para 3 says a broken-down price must emphasize the total.
  https://www.gesetze-im-internet.de/pangv_2022/__2.html and `__3.html`
- L2. Subscription name, duration, what it contains, full renewal price prominent, localized,
  billed amount the most prominent price element, restore link. Apple, S8.
  https://developer.apple.com/app-store/subscriptions/
- L3. Google Play: pre-purchase disclosure of cost, billing frequency and auto-renewal without
  extra taps, fully localized, and "don't show annual pricing mainly as a monthly figure". Trials
  must state duration, price after, how to cancel. Easy cancellation path, for example a link to the
  Subscription Center. https://support.google.com/googleplay/android-developer/answer/9900533
- L4. Apple 3.1.2(c): describe what the user gets for the price before asking to subscribe; 3.1.2(a)
  ongoing value for subscriptions; 3.1.1 a restore mechanism. 5.1.1(i) privacy policy link in app.
  The 3.1.2(c) text points to Schedule 2 of the Apple Developer Program License Agreement, which was
  not read. https://developer.apple.com/app-store/review/guidelines/
- L5. Terms of Use and Privacy Policy links on the purchase page (Apple, S8).
- L6. Cancellation: App Store and Play manage subscriptions. The BGB section 312k cancellation
  button concerns websites and was not researched here. The page should still point to the store's
  subscription settings. Lifetime has no cancellation but a refund path (decisions H-76).
- L7. Withdrawal right for digital content: not researched. Question Q4.
- L8. Dark patterns: DSA Art. 25 prohibits deceptive or manipulative interface design for online
  platform providers, and excludes practices covered by the UCPD or GDPR. Its para 3 lists visual
  prominence of options, repeated requests, and harder cancellation than sign-up as examples
  (read via a third-party mirror, https://www.eu-digital-services-act.com/Digital_Services_Act_Article_25.html).
  A CMS Law summary says the UCPD already prohibits false urgency claims and the Fitness Check
  flagged free trials that convert automatically; the Digital Fairness Act draft is expected
  around 11 November 2026, and not in force before the end of 2028 at the earliest
  (https://cms.law/en/aut/legal-updates/inside-the-eu-s-planned-digital-fairness-act-digital-design-subscription-traps-and-influencer-marketing).
  UCPD Annex I was not read at the source.
- L9. Practices to keep out of the prototypes: countdowns and "only today" text, preselected
  paid option that is not what the page recommends in words, decline buttons that shame
  ("No, I don't want to save"), fabricated discounts or crossed-out prices that were never charged,
  hidden or low-contrast close, a pre-checked trial toggle.

Questions for Legal Review:

- Q1. Does a recommended-plan badge or a pre-selected yearly plan count as preselection under UCPD
  or DSA Art. 25 when both prices are fully visible?
- Q2. May the page show a monthly equivalent for the yearly price (R10), given the Google Play text
  and PAngV section 3 para 3?
- Q3. Does "Lifetime" need a definition on the page (for example "for as long as Hummlist
  offers it") and where does the term come from?
- Q4. Withdrawal right and the consent to start digital content for in-app purchases: does the
  store flow cover it, or does the page need text?
- Q5. Settled already: the page reads the store's own price when it opens and adds "inkl. MwSt."
  only after a euro price (DECISIONS "Job 49" item 14, A2-5, K.13.P.3). Open part: does a
  placeholder price in a prototype or marketing shot need the same wording?
- Q6. Is household-bound entitlement ("stays with the household where it was bought") material
  information that must appear before purchase (UCPD Art. 7)?
- Q7. Would RevenueCat Paywalls (remote config, paywall events) contradict conditions C3 of the
  RevenueCat review?
- Q8. May real store reviews or ratings be quoted on the page, and in what form?
- Q9. A contextual paywall at the integration lock: is a blocked Siri or MCP call that returns a
  Premium message plus a deep link into the page acceptable as non-aggressive?

## 8. Takeaways for Hummlist

- Treat conversion expectations as freemium: about 2% download-to-paid, hard-paywall figures do not
  apply (R1, R4). Measure at household level.
- Use a contextual trigger at the locked integration, and a quiet entry in More. Vary the headline
  by integration (R14, R15, S1).
- Offer two plans, Yearly and Lifetime, on one calm page, with the full price and period for each
  as the most prominent element (S8, L2, S1, R13).
- Recommend one plan in words, not by pressure. Pre-select the same plan the page recommends (S1,
  R10, Q1).
- Do not hide Lifetime and do not push it with fake discounts. Lifetime at 3.0x yearly is low in
  the observed range, so keep the decision to Peter (R7, R8).
- Write benefits in household terms (shopping by voice, assistants adding to the shared list), with
  features as small supporting lines (R12, S1).
- Make the household model explicit: one payment, whole household, stays with the household (S4,
  R9, Q6).
- Skip the trial toggle, countdowns, story-style discount reveals and decline shaming (R13, S7, L9).
- Use only real social proof. Without reviews, use none (R12, R13).
- Include restore, Terms, Privacy and manage-subscription links on the page and state renewal terms
  in one sentence for the yearly plan (S8, L2 to L6).
- Keep the free promise visible: list, sync and Alexa stay free (S5 shows the cost of the
  opposite).
- Build the prototype from components Paywalls v2 has, for portability, but keep the page native
  (section 5, Q7).

## 9. Sources

Opened:

- RevenueCat, State of Subscription Apps 2026: https://www.revenuecat.com/state-of-subscription-apps/
- RevenueCat, State of Subscription Apps 2025: https://www.revenuecat.com/state-of-subscription-apps-2025/
- RevenueCat, SOSA 2026 Productivity: https://www.revenuecat.com/state-of-subscription-apps-2026-productivity
- RevenueCat, paywalls study guide: https://www.revenuecat.com/blog/growth/paywalls-study-guide.md
- RevenueCat, paywall tests grow app revenue: https://www.revenuecat.com/blog/growth/paywall-tests-grow-app-revenue.md
- RevenueCat, lifetime subscriptions: https://www.revenuecat.com/blog/growth/lifetime-subscriptions.md
- RevenueCat, paywall redesign case studies: https://www.revenuecat.com/blog/growth/paywall-redesigns-case-studies/
- RevenueCat, ugly paywalls: https://www.revenuecat.com/blog/growth/ugly-paywalls-conversion-testing/
- RevenueCat, paywall placement: https://www.revenuecat.com/blog/growth/paywall-placement/
- RevenueCat, weird paywalls: https://www.revenuecat.com/blog/growth/weird-paywalls-drive-subscription-growth/
- RevenueCat Paywalls docs: https://www.revenuecat.com/docs/tools/paywalls
- RevenueCat Paywalls components: https://www.revenuecat.com/docs/tools/paywalls/creating-paywalls/components
- Superwall best practices: https://superwall.com/blog/superwall-best-practices-winning-paywall-strategies-and-experiments-to
- Adapty, State of In-App Subscriptions 2025: https://adapty.io/reports/state-of-in-app-subscriptions-2025/
- AnyList Complete: https://www.anylist.com/complete
- Bring! 2014: https://www.appgefahren.de/?p=114815
- Bring! 2020: https://www.mobiflip.de/?p=401895
- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple subscriptions: https://developer.apple.com/app-store/subscriptions/
- Google Play subscriptions policy: https://support.google.com/googleplay/android-developer/answer/9900533
- PAngV section 2: https://www.gesetze-im-internet.de/pangv_2022/__2.html
- PAngV section 3: https://www.gesetze-im-internet.de/pangv_2022/__3.html
- DSA Art. 25 (mirror): https://www.eu-digital-services-act.com/Digital_Services_Act_Article_25.html
- CMS Law, Digital Fairness Act: https://cms.law/en/aut/legal-updates/inside-the-eu-s-planned-digital-fairness-act-digital-design-subscription-traps-and-influencer-marketing

Snippet only, not opened: Superwall trial template and agencies pages, the mwm.ai paywall
glossary, the iphone-ticker report on the 20% subscription dialog reversal, Todoist and Things 3
price pages (routine.co, morgen.so, lifestack.ai), Pixelcut result (+16% paying customers) on
revenuecat.com/customers/pixelcut.

## Prototype mapping

Five prototypes are in the app (`app/lib/purchases/paywall_prototypes.dart`, debug builds only:
the "Paywall-Prototyp" switch on top of the Premium page). Every one shows both plans with the
configured launch prices (9,99 € a year, 29,99 € once, as `scripts/iap/product.ts` and
docs/PURCHASES.md "Expected prices" set them; in the app the store's own prices once the page has
read them), "inkl. MwSt." after a euro price, the yearly disclosures from today's page unchanged,
Restore, Terms and Privacy. None has a trial (none is configured, R9, R11), a countdown, a crossed
out price, a monthly equivalent (L3, Q2), invented reviews (R12) or a shaming decline (L9). Each
is built only from what RevenueCat Paywalls v2 renders (section 5), so a later move to Paywalls
stays possible, though the app keeps its native page (DECISIONS "Job 43" item 22).

| Prototype | Layout | Applies | Paywalls v2 components | Open questions |
| --- | --- | --- | --- | --- |
| PW-P1 Klassisch | Honey hero with an outcome headline, four benefit lines, both plans as radio rows in one card, one "Weiter" button, the picked plan's terms under it | R12 (sell the outcome), R13 and S1 (one page, two plans, one button), R10 (yearly preselected), R16 (light, calm) | Stack, Image, Text, Feature list, Package x2, Purchase button, Button | Q1 (yearly preselected) |
| PW-P2 Einmal zahlen | Lifetime is the hero: its price as the one big number, the benefits inside its card; yearly below as an outlined second choice | Section 6 (one-time preference, stated as an assumption), R7 and R8 (Lifetime shown plainly, no fake discount), S1 (one recommended plan) | Stack, Icon, Text, Feature list, Package, Purchase button x2, Button | Q3 ("Lifetime", "für immer"), R7 says Lifetime is rarely the headline: this tests the opposite |
| PW-P3 Vergleich | Free next to Premium as a table (list, sync and Alexa free; Siri, AI assistants, API in Premium), then a Jährlich/Lifetime toggle and the picked price large | S5 and takeaway "keep the free promise visible", R15 (what the household gets), section 5 Switch | Stack, Text, Icon, Switch (or Tabs), Package, Purchase button, Button | Q1 |
| PW-P4 Haushalt | Member hexes and "Einer kauft. Alle haben es.", three benefits, plans as two side-by-side tiles (picked one in honey) | S4 (household tier), takeaway on the household model, R13 food-app case (plans side by side) | Stack, Icon, Text, Feature list, Package x2 (side by side), Purchase button, Button | Q6 (household binding before purchase) |
| PW-P5 Aus der Sperre | Bottom sheet opened by the integration lock's button: what is paused, that it comes back, "Alexa bleibt kostenlos", plans as radio rows, buy, "Später" | R14 and R15 (contextual paywall, copy by entry point), S1, L9 (a plain "Später", no confirmshaming) | Stack, Icon, Text, Package x2, Purchase button, Button (close) | Q9 (paywall at a blocked integration) |

No prototype uses social proof: Hummlist has no store reviews yet, and R12 and R13 only support
real ones. No prototype has a Hummel mascot: there is no approved mascot asset and the design
system rules a bee mascot out (hummlist-ui-craft, DECISIONS "Job 81").
