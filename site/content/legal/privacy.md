---
title: Privacy policy
description: "Privacy policy of Hummlist: which data the app and the website process, why, who receives it and what rights you have."
locale: en
path: /en/privacy
translation_key: privacy
updated: 2026-10-30
---

# Privacy policy

This is a translation. The [German version](/datenschutz) is authoritative.
Last updated: 30 October 2026

This page explains which personal data Hummlist processes, why, on what legal basis, who receives it and what rights you have. Hummlist is a shopping-list app for households on iPhone, Android and in the browser (app.hummlist.com), with the website hummlist.com.

## 1. Controller

Peter Trost, Yalovastr. 5, 72108 Rottenburg am Neckar, Germany. E-mail: [support@hummlist.com](mailto:support@hummlist.com). No data protection officer has been appointed.

## 2. Website hummlist.com

The website sets no cookies, loads nothing from other servers and uses no analytics. The pages are served as static files. When you visit it, our host Vercel Inc. (440 N Barranca Ave #4133, Covina, CA 91723, USA) processes technically necessary data: IP address, time, page requested and browser identifier. This is needed to deliver the site and protect it from attacks (Art. 6(1)(f) GDPR; our legitimate interest is secure operation). Server logs are kept for at most 30 days.

## 3. Web app app.hummlist.com

The web app is also delivered by Vercel as static files (see section 2). The web app currently loads program libraries and fonts from Google servers (gstatic.com); Google receives your IP address when it does. We will change this shortly.
Hummlist stores the following in your browser's local storage or on your device: your sign-in session; a copy of your list and your list settings, so the app starts quickly and works offline; your language; and your choice about usage data (section 9). These are strictly necessary for the app you asked to use (§ 25(2) no. 2 TDDDG). A service worker caches the app files. A random installation ID is stored only if you allow usage data (section 9).

## 4. Account and sign-in

For an account we process your e-mail address, a password (stored only in hashed form) or your Google or Apple sign-in, and a display name. If you sign in with Google or Apple, we receive your account ID, your e-mail address (with Apple possibly a relay address) and, if provided, your name; Google or Apple learn that you sign in to Hummlist. Sign-in links and confirmations are e-mailed via our service provider Supabase.
Legal basis: Art. 6(1)(b) GDPR (performance of the user agreement).

## 5. Shopping list and household

We store what you enter in Hummlist: the household name, members and their roles, invitations, items (item name, quantity, who added and bought it, timestamps), a history of changes, and what Hummlist learns for your household (categories, stores, brands). All members of your household see the list, the history and the other members' display names. Invite links expire after 14 days.
Legal basis: Art. 6(1)(b) GDPR.

## 6. Voice input

When you dictate an item in the iPhone or Android app, your operating system's speech recognition turns speech into text. This happens only on your device: if the device cannot recognise German without the internet, Hummlist does not offer voice input. There is no voice input in the browser. The app sends the recognised text to our server, which turns it into items; we never receive audio.
Legal basis: Art. 6(1)(b) GDPR.

## 7. Siri, Alexa and AI assistants

You can connect Hummlist to Siri or to AI assistants (for example through the Model Context Protocol at mcp.hummlist.com). This only happens if you create an access key or approve a connection yourself. The connected service can then read and change your list items, and its provider processes that content under its own privacy terms. For each key we store a name, a hash and when it was last used. You can revoke keys and connections in the app at any time.
Legal basis: Art. 6(1)(b) GDPR.

### Amazon Alexa

You can enable the Alexa skill "Hummlist" in the Alexa app and link it to your Hummlist account. To do so, you sign in to Hummlist and allow "Amazon Alexa" to access your list. Amazon receives an access token and a refresh token for this and keeps them.

When you ask Alexa to add something to your list or read it out, Amazon records your speech and turns it into text. We do not receive a voice recording from Amazon, only the recognised text (for example "milk and eggs"), the kind of request, the access token, an ID of your Alexa account and technical details about the device and language. We do not use the device ID. We add the items to the list of your current household, just as if you had entered them in the app; the other members see them. In our reply we send Amazon the item names, which Alexa reads out to you and shows as a card in the Alexa app: the items just added, or up to 10 open items on your list.

For this we store a hash (SHA-256) of your Alexa ID, which sign-in session belongs to it and when you last used the skill, so that we can end the connection when you disable the skill. We also count how many items you added in the current minute (at most 30). We delete this data as soon as the connection ends: when you disable the skill in the Alexa app, link it again, choose "Disconnect Amazon Alexa" under More › Access, or delete your account. If you only unlink in the Alexa app, Amazon deletes the tokens; the entry under More › Access stays until you remove it.

Amazon processes your voice recordings, their transcript and our replies as an independent controller under Amazon's Alexa Terms of Use and privacy notice. For Alexa on amazon.de, your contract partner is Amazon Media EU S.à r.l., 38 avenue John F. Kennedy, L-1855 Luxembourg. How long Amazon keeps voice recordings and how you delete them is set in the Alexa app; we have no influence on this.
Legal basis: Art. 6(1)(b) GDPR.

## 8. Export your data and delete your account

Account › Export my data gives you your data as a JSON file. Account › Delete account deletes your account immediately. What happens to shared households is explained at [https://app.hummlist.com/konto-loeschen.html](https://app.hummlist.com/konto-loeschen.html).

## 9. Usage data and error reports (only with consent)

Only if you agree, Hummlist stores a random installation ID on your device and sends usage data and error reports to our processor PostHog Inc. (servers in the EU, Frankfurt). Sent: the installation ID, your household's ID, platform, app version, actions such as "app opened for the first time", "household created", "invite accepted", "item added/ticked off" and "category/store reordered" (with details such as your role in the household, the number of members and whether an item was typed, dictated, suggested or added through Alexa), and cleaned-up error reports. For in-app purchases our servers send the purchase event (purchase, refund or restore) with the same installation and household ID, with product, price, currency, store, country and a pseudonymised purchase reference (hash), but without payment data; this too only if you agreed. If you add an item through Alexa that was not yet on the list, our servers send the event "item added" marked "through Alexa", with your role and the number of members, under the installation ID of the device on which you last decided about usage data, and only if that decision was yes. To make this possible and to be able to prove your consent, we store for your account, per installation, your decision (yes or no), when you made it and, for a yes, the installation ID; at most the 20 most recent decisions. They are deleted with your account (legal basis: Art. 6(1)(c) GDPR in conjunction with Art. 7(1) GDPR). Never sent: item names, list contents, names, e-mail addresses, IP address and location. PostHog creates no person profile and does not derive a location from the IP address. The data is pseudonymous.
Purpose: to see which features are used, find bugs and measure whether Hummlist pays for itself.
Legal basis: your consent (Art. 6(1)(a) GDPR; for storing the ID, § 25(1) TDDDG). You can withdraw it any time under More › Usage data, with effect for the future.
Retention at PostHog: 1 year.

Separately, our servers report errors in server functions to PostHog. Such a report contains the name of the server function, the kind of error, a shortened and cleaned-up error message and the places in the program code where the error occurred. It contains no user, household or installation ID, no e-mail addresses, no list contents, nothing from the request and no IP address. Legal basis: Art. 6(1)(f) GDPR (legitimate interest in error-free operation). Retention at PostHog: 1 year.

## 10. Contact and support

If you write to support@hummlist.com, hello@hummlist.com or feedback@hummlist.com, we process your e-mail address and your message to reply. Google hosts these mailboxes (Google Workspace, see sections 12 and 13). Peter Trost writes and sends every reply himself.
Legal basis: Art. 6(1)(b) GDPR where it concerns your account, otherwise Art. 6(1)(f) GDPR (legitimate interest in answering requests). Support e-mails are deleted 6 months after the request is closed.

## 11. Backups

An encrypted backup of the database is made every night and deleted automatically after 90 days. It is used only to recover from failures. Location: GitHub Inc., USA (as an encrypted file).
Legal basis: Art. 6(1)(f) GDPR (data security, Art. 32 GDPR).

## 12. Recipients and processors

These service providers process data on our behalf and on our instructions (Art. 28 GDPR):

- Supabase Pte. Ltd., Singapore (database, sign-in, sending the sign-in e-mails, server functions; the database is in a data centre in Frankfurt am Main, the server functions run at the location nearest the request, including outside the EU; the server function for purchases always runs in Frankfurt am Main)
- RevenueCat, Inc., Brandon (Florida), USA (in-app purchases: checking and managing the unlock, section 5a; servers at Amazon Web Services in the USA)
- Vercel Inc. (hosting of hummlist.com, app.hummlist.com and mcp.hummlist.com; domain and DNS)
- PostHog Inc. (usage data and error reports, servers in the EU; only as described in section 9)
- GitHub Inc. (encrypted backups)
- Google Cloud EMEA Limited, Dublin, Ireland (Google Workspace, e-mail)

Independent controllers: Google or Apple when you sign in with them; Google, as long as the web app loads program libraries and fonts from gstatic.com (section 3); the provider of your operating system's speech recognition; AI assistants you connect yourself; Amazon, when you use the Alexa skill (section 7); Apple and Google as app stores.

## 13. Transfers outside the EU

Some providers are based in the USA or belong to US companies. Supabase's server functions, except the one for purchases, can also run in data centres outside the EU (see section 12). Where data is transferred to the USA or other third countries or US authorities could access it, we rely on the following:

- Vercel Inc., GitHub Inc., PostHog Inc. and Google LLC (USA; part of the same group as Google Cloud EMEA Limited and processes data for it) are certified under the EU-US Data Privacy Framework. The European Commission's adequacy decision applies to them (Art. 45 GDPR). Vercel and PostHog have also agreed Standard Contractual Clauses (Art. 46(2)(c) GDPR) in their data processing agreements; for Google, Standard Contractual Clauses apply if Google stops relying on the Data Privacy Framework.
- PostHog stores the data in Frankfurt am Main. Under its contract, PostHog may also process it in the USA, for example through sub-processors; the above applies to that.
- Supabase Pte. Ltd. (Singapore) is not certified under the Data Privacy Framework. The European Commission's Standard Contractual Clauses apply (Art. 46(2)(c) GDPR); they are part of Supabase's data processing agreement.
- RevenueCat, Inc. (USA) is not certified under the EU-US Data Privacy Framework. The European Commission's Standard Contractual Clauses apply (Art. 46(2)(c) GDPR); they are part of RevenueCat's data processing agreement. RevenueCat stores the data at Amazon Web Services in the USA and uses further sub-processors in the USA that are bound by equivalent obligations. To check a purchase, RevenueCat sends the receipt and your household's ID (to Google a hash value made from it) to Apple or Google.
- Amazon (Alexa) receives our replies as an independent controller (section 7). Where Amazon passes them to Amazon companies in the USA, Amazon.com, Inc. (including Amazon.com Services LLC) is certified under the EU-US Data Privacy Framework (Art. 45 GDPR); where no adequacy decision applies, Amazon's developer agreement provides for controller-to-controller Standard Contractual Clauses.

You can get a copy of the safeguards from support@hummlist.com.

## 14. Retention

We keep your data as long as you have an account. When you delete your account, we delete your account, profile, memberships, access keys, connections (Alexa included), your usage-data decisions and any entry in the tester list immediately; for purchases we remove the link to your account (section 5a). We also delete Alexa connection data as soon as the connection ends (section 7). If you are the last member of a household, the household and everything in it is deleted, as is any household you archived. If you leave a household with Hummlist Lifetime as its last member without deleting your account, you can archive it; we delete it if it is not re-enabled within 24 months (section 5a). Otherwise the items and history stay for the other members, without any link to you; the item names remain visible. We keep shared household data, the history included, as long as the household exists, archived households included (section 5a). Our database provider's logs are deleted after at most 1 day, backups after 90 days, and usage data and error reports at PostHog after 1 year.

## 15. Your rights {#rights}

You have the right of access (Art. 15 GDPR), rectification (Art. 16), erasure (Art. 17), restriction of processing (Art. 18), data portability (Art. 20), and to withdraw any consent with effect for the future (Art. 7(3)). Write to [support@hummlist.com](mailto:support@hummlist.com).

**Right to object (Art. 21 GDPR):** Where we process data on the basis of legitimate interests (Art. 6(1)(f) GDPR), you may object at any time on grounds relating to your particular situation.

You can also complain to a data protection supervisory authority (Art. 77 GDPR), for example the one responsible for us: Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit Baden-Württemberg, Heilbronner Straße 35, 70191 Stuttgart, Germany (postal address: Postfach 10 29 32, 70025 Stuttgart).

## 16. What you must provide; no automated decisions

You can't create an account without an e-mail address or a Google/Apple sign-in; everything else is voluntary. We make no automated decisions and do no profiling within the meaning of Art. 22 GDPR. Hummlist shows no ads and sells no data.

## 17. Minimum age

Hummlist is for people aged 16 and over.

## 18. Changes

We update this policy when Hummlist changes. The version published here applies.
