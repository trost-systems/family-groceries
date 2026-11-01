---
title: Privacy policy
description: "Privacy policy of Hummlist: which data the app and the website process, why, who receives it and what rights you have."
locale: en
path: /en/privacy
translation_key: privacy
updated: 2026-11-01
---

# Privacy policy

This is a translation. The [German version](/datenschutz) is authoritative.
Last updated: 1 November 2026

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

You can connect Hummlist to AI assistants (for example through the Model Context Protocol at mcp.hummlist.com) or to Siri through a shortcut you set up yourself. This only happens if you create an access key or approve a connection yourself. For Siri directly in the iPhone app, see "Siri on iPhone" below. The connected service can then read and change your list items, and its provider processes that content under its own privacy terms. For each key we store a name, a hash, its last four characters and when it was last used. When a key ends, for example because you revoke it or leave the household, we delete this data at the next daily clean-up 30 days later. You can revoke keys and connections in the app at any time.
Legal basis: Art. 6(1)(b) GDPR.

### Siri on iPhone

When you are signed in to the iPhone app and belong to a household, the app automatically creates its own access key for Siri; you don't need to do anything. In the app it is called "Siri (this iPhone)". The key is kept in this iPhone's Keychain and is not transferred to other devices. For it we store a hash (SHA-256) of the key, its last four characters, the name "Siri", which sign-in session it belongs to, and when it was created and last used. The key only works for Siri requests to Hummlist, and only while you are signed in and a member of that household.

When you ask Siri to add something to your list or read it out, Apple turns your speech into text. We do not receive a voice recording. We only receive the recognised text or the name of a suggestion you picked (for example "milk"), whether you want to add or hear items, the language (German or English) and the key. When reading out, no text is sent. We add the items to your household's list just as if you had entered them in the app; the other members see them. We do not write the text to logs or to usage analytics; for errors we only log the type of error.

So that Siri understands phrases like "Add milk to Hummlist", the app stores up to 50 item names of your household on your iPhone and passes them to iOS's App Shortcuts. How Apple processes your speech, its transcript and this data is governed by Apple, as an independent controller, in its privacy policy and in your iPhone's Siri settings; we have no influence on this.

The key ends when you sign out, leave the household, delete your account, revoke it under More › Access, or sign in again on this iPhone (the app then creates a new one). Each account has at most five Siri keys; when another is added, the oldest ends. After a key ends, we keep its stored data for 30 more days so we can look into misuse or questions, then delete it at the next daily clean-up. If the key ends because you signed out, we notice this by the next day at the latest.
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

Only if you agree, Hummlist stores a random installation ID on your device and sends usage data and error reports to our processor PostHog Inc. (servers in the EU, Frankfurt). Sent: the installation ID, your household's ID, platform, app version, technical details of the device and the app (in the iPhone and Android app: app build, device maker, model and type, operating system and version, screen size, language, time zone, whether Wi-Fi or mobile data is used, on Android also Bluetooth status, the mobile network's name and the system's HTTP user agent; in the browser: browser and operating system with version, device type, screen and window size, language and time zone, but never the page address or the referring page), a random session ID that changes after 30 minutes without use, actions such as "app opened for the first time", "household created", "invite accepted", "item added/ticked off" and "category/store reordered" (with details such as your role in the household, the number of members and whether an item was typed, dictated, suggested or added through Alexa), and error reports. We clean errors in the app's own code before sending. If the iPhone or Android app crashes, it sends the operating system's crash report (error type, error message, technical stack trace) at the next start; we don't clean this one, but it normally holds none of your list content. For in-app purchases our servers send the purchase event (purchase, refund or restore) with the same installation and household ID, with product, price, currency, store, country and a pseudonymised purchase reference (hash), but without payment data; this too only if you agreed. If you add an item through Alexa that was not yet on the list, our servers send the event "item added" marked "through Alexa", with your role and the number of members, under the installation ID of the device on which you last decided about usage data, and only if that decision was yes. To make this possible and to be able to prove your consent, we store for your account, per installation, your decision (yes or no), when you made it, which version of this notice you saw and, for a yes, the installation ID; at most the 20 most recent decisions. If we change the notice to cover new purposes or data, we ask you again and send nothing until you answer. They are deleted with your account (legal basis: Art. 6(1)(c) GDPR in conjunction with Art. 7(1) GDPR). Never sent: item names, list contents, names, e-mail addresses, IP address and location. PostHog creates no person profile and does not derive a location from the IP address. The data is pseudonymous. Also only with your consent, the app asks PostHog, using the installation ID, which features are switched on for your installation. For this, in the iPhone and Android app, the PostHog software stores the installation ID, events not yet sent and the answer about switched-on features on your device; in the browser it stores nothing. If you switch usage data off, we delete this on your device.
Purpose: to see which features are used, find bugs, measure whether Hummlist pays for itself and switch new features on step by step.
Legal basis: your consent (Art. 6(1)(a) GDPR; for storing the ID, § 25(1) TDDDG). You can withdraw it any time under More › Usage data, with effect for the future.
Retention at PostHog: 1 year.

Separately, our servers report errors in server functions to PostHog. Such a report contains the name of the server function, the kind of error, a shortened and cleaned-up error message and the places in the program code where the error occurred. It contains no user, household or installation ID, no e-mail addresses, no list contents, nothing from the request and no IP address. Legal basis: Art. 6(1)(f) GDPR (legitimate interest in error-free operation). Retention at PostHog: 1 year.

## 10. Contact and support

If you write to support@hummlist.com, hello@hummlist.com or feedback@hummlist.com, we process your e-mail address and your message to reply. Google hosts these mailboxes (Google Workspace, see sections 12 and 13). Peter Trost writes and sends every reply himself.
Legal basis: Art. 6(1)(b) GDPR where it concerns your account, otherwise Art. 6(1)(f) GDPR (legitimate interest in answering requests). Support e-mails are deleted 6 months after the request is closed.

If you send us feedback in the app, we store your message (up to 2,000 characters), the category if you choose one, whether we may contact you about it, app version and build, platform, operating system version (in the browser: browser and operating system), language and the screen you wrote from, together with your user and household ID, at Supabase (servers in the EU). Other members of your household can't see your feedback; only Peter Trost can read it. We use it to fix bugs and improve Hummlist. If you allow it, we reply to your account's e-mail address. We delete feedback automatically after 12 months, and at once if you delete your account. Legal basis: Art. 6(1)(f) GDPR (our legitimate interest in a bug-free, better app).

## 11. Backups

An encrypted backup of the database is made every night and deleted automatically after 90 days. It is used only to recover from failures. Location: GitHub Inc., USA (as an encrypted file).
Legal basis: Art. 6(1)(f) GDPR (data security, Art. 32 GDPR).

## 12. Recipients and processors

These service providers process data on our behalf and on our instructions (Art. 28 GDPR):

- Supabase Pte. Ltd., Singapore (database, sign-in, sending the sign-in e-mails, server functions; the database is in a data centre in Frankfurt am Main, the server functions run at the location nearest the request, including outside the EU; the server function for purchases always runs in Frankfurt am Main)
- RevenueCat, Inc., Brandon (Florida), USA (in-app purchases: checking and managing the unlock; servers at Amazon Web Services in the USA)
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

We keep your data as long as you have an account. When you delete your account, we delete your account, profile, memberships, access keys, connections (Alexa included), your usage-data decisions and any entry in the tester list immediately; for purchases we remove the link to your account. We also delete Alexa connection data as soon as the connection ends (section 7). If you are the last member of a household, the household and everything in it is deleted, as is any household you archived. If you leave a household with Hummlist Lifetime as its last member without deleting your account, you can archive it; we delete it if it is not re-enabled within 24 months. Otherwise the items and history stay for the other members, without any link to you; the item names remain visible. We keep shared household data, the history included, as long as the household exists, archived households included. Our database provider's logs are deleted after at most 1 day, backups after 90 days, and usage data and error reports at PostHog after 1 year.

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
