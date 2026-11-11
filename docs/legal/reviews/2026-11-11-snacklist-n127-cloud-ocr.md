# Snacklist — N-127 cloud receipt scanning (PM batch 11 November 2026)

Reviewed 11 November 2026, ~21:20–21:50 CET (Europe/Berlin), by Legal Review. Question from Snacklist PM's daily batch of 11 November 2026 (item N-127): may the Premium receipt scan use a cloud OCR / AI service instead of the on-device-first path, and on what conditions? Nothing is built. No user data, database contents or user mail were read. No vendor terms were opened in an account, signed or accepted. Sources: `/workspace/legal/sources/2026-11-11-n127/` (see VERIFICATION.txt), all fetched 11 November 2026.

This is a careful review, not legal advice from a lawyer.

## 1. Summary (must-fix first)

**Verdict: CONDITIONAL GO** for a cloud receipt scan in Snacklist Premium, **only if Peter picks U2B** (cloud) and only once conditions C1–C10 are met before the first real image leaves a device (C11–C12 recommended). Without Peter's U2 answer it stays out of the build plan. Reason: a user-requested scan by an EU-hosted processor under an Art. 28 contract, with no training, immediate deletion (hard ceiling 24 h), server-side stripping of payment and loyalty data and an explicit permission screen, is lawful under Art. 6(1)(b) GDPR with an Art. 9(2)(a) safety net, and it meets Apple 5.1.2(i). The open points are a vendor choice and engineering work. None of them needs a lawyer.

**MUST (new findings N-135 to N-144)**

- **N-135 (C1) Processor contract.** Use an Art. 28 DPA with the chosen provider: documented instructions, no use for the provider's own purposes, a sub-processor list with objection rights, deletion and audit help. Peter accepts the vendor terms himself, billed to "Peter Trost". No bot accepts them.
- **N-136 (C2) EU processing, end to end.** The image goes through a Snacklist server function **pinned to Frankfurt am Main** (like the purchase function today). Supabase server functions otherwise run "am Standort, der dem Aufruf am nächsten liegt, auch außerhalb der EU" (policy §12). The provider processes in an EU region only. No US endpoint and no global endpoint.
- **N-137 (C3) No training, no retention.** The provider must not use images or results for training or improvement, contractually and in the console. Use zero data retention if offered. Otherwise call the delete API right after the result arrives; the hard ceiling is 24 hours. Snacklist stores no image and does not keep the full OCR text. Request bodies are never written to Supabase logs, PostHog events or error reports.
- **N-138 (C4) Strip identifiers on the server, before anything is shown or stored.** Drop card numbers and fragments (last four included), IBAN, loyalty or customer numbers (for example Payback), cashier names and IDs, the shop's street address, the time of day, and receipt, transaction and TSE numbers. Only the item name, price, optional quantity, date and chain go back to the app.
- **N-139 (C5) Art. 9 disposition.** Receipt scanning is for grocery receipts only. If the result is a pharmacy receipt (chain or merchant category "Apotheke", PZN lines), the server discards the whole result. Lines that look like medicines or health products are never proposed. The one-time permission screen includes an **explicit consent** (Art. 9(2)(a)) for the case that a receipt still shows health-related items. Cloud scanning stays off without it, and manual entry stays available.
- **N-140 (C6) Permission and notice in the app.** Show a one-time permission screen before the first cloud scan (§5 A), meeting Apple 5.1.2(i): explicit permission before sharing with "third-party AI". Show a short notice under the scan button every time (§5 B). Add a settings switch to withdraw. Use an in-app camera capture or the out-of-process picker, and never full photo-library access (Apple 5.1.1(iii)).
- **N-141 (C7) Privacy policy live before first use.** New §6a, plus additions to §12 and §14 (and §13 only for a US-group provider), as in §6. The price-history paragraph (2026-11-10 Premium review §4 and Q3/Q6, the F28 price-history text) must be live at the same time, because scanned prices are stored "like manually entered prices" and the current policy has no price section yet.
- **N-142 (C8) Store labels.** Update the Apple App Privacy answers and the Google Play Data safety form in the same release (§8).
- **N-143 (C9) Unconfirmed lines.** Proposed lines stay only on the device until the user confirms or cancels. Delete them after 24 hours at the latest. No silent writes.
- **N-144 (C10) Vendor verification and record.** Before signing, re-check the chosen provider's DPA, region, retention, no-training term and current sub-processor list. Record the result and a short DPIA screening note (§4.5) in the record of processing. A DPIA itself is not required.

**SHOULD**

- **C11.** Check on the device before upload where cheap: if on-device text recognition sees "Apotheke"/PZN, do not send. This lowers the residual Art. 9 risk further. If built, the bracketed policy sentence in §6 may be used.
- **C12.** Prefer an **EU-headquartered** provider, so that no Chapter V transfer arises at all. A US group with an EU region is acceptable on the DPF (Art. 45). Its §13 bullet is then mandatory.

**Lower-risk variant, equally GO (engineering choice):** "Text-only cloud." On-device OCR (Apple Vision / ML Kit) reads the receipt. The on-device filter drops payment, loyalty and health lines, and only the remaining text lines go to an EU provider for structuring. The image never leaves the device. C1–C3 and C6–C10 still apply, C4/C5 are then enforced on the device, and every §5/§6 text that says "Foto" changes to "erkannte Textzeilen" / "recognised text lines" (also §12 and §14). Because no health line leaves the device, the Art. 9(2)(a) tick can then be dropped. This is the variant to choose if Engineering can do it in time.

**Updates N-131 (10 November).** The earlier note required "per-scan consent ... TDDDG § 25(1)". Revised view: camera or photo access for a scan the user has just started, on a feature described as a cloud scan, falls under § 25(2) Nr. 2 TDDDG. The GDPR basis is Art. 6(1)(b), not consent. The one-time explicit permission (C6) remains mandatory for Apple 5.1.2(i); its Art. 9(2)(a) tick covers the incidental health-line case (§4.1); it is worded to the § 25(1) standard as a fallback. A tap per scan plus the notice under the button replaces a consent dialog per scan.

No point needs a lawyer if C1–C10 are followed. **Needs a lawyer only** if Product wants pharmacy or drogerie receipts scanned as a whole, or wants raw images or full OCR text kept. That design is not recommended, and this review does not cover it.

## 2. Peter's product decisions (ask Peter directly; not legal nuance)

1. **U2** (still open from 10 November): U2A on-device only, or U2B cloud scan. This review makes U2B possible on the conditions above. The cheaper legal path is still U2A or the text-only variant.
2. **Provider choice**, once U2B is chosen: pick from verified candidates (§7). Legal recommendation: an EU-headquartered provider with zero retention.
3. Accepting the provider's DPA/terms is Peter's own act.

## 3. Facts assumed (from PM's question)

Premium feature, paid launch 1 December 2026. The user photographs their own receipt. The image is sent only on a tap to scan, used only for extraction, not kept after processing and not used for training. Extracted items and prices are stored like manually entered prices. The provider is EU-hosted if possible.

## 4. Analysis

### 4.1 Legal basis: Art. 6(1)(b), not consent

**Decision: Art. 6(1)(b) GDPR.** The user bought Premium, which includes receipt scanning, and starts each scan. Reading the photo is objectively necessary to deliver that scan (EDPB 2/2019: processing must be "objectively necessary for the performance of a contract"). Who performs the OCR (the device or a processor) is a choice of means; it does not change the purpose. Consent as the main basis would be worse. Apple 5.1.1(ii) says "Paid functionality must not be dependent on or require a user to grant access to this data". Withdrawal would also break a paid feature, and consent bundled with a contract is suspect (Art. 7(4)).

Limit: Art. 6(1)(b) covers only extraction for the user's own price history. Any other use (public posts, analytics on receipts, model improvement) is outside it (N-126/N-130 remain).

**Art. 9 safety net: Art. 9(2)(a) explicit consent**, given once on the permission screen (§5 A), for the incidental health line that slips through C5. It is stated openly as a prerequisite of the **cloud** scan: an image upload cannot exclude such a line in advance, so without the tick no photo is sent and manual entry stays. This is not the Art. 7(4) problem, because that targets consent to processing "für die Erfüllung nicht erforderlich"; here the consent is needed for exactly the feature. The Apple 5.1.1(ii) review risk ("Paid functionality must not be dependent on ...") is low, because the permission is intrinsic to the feature, like camera access for a scanner. The rest of Premium works without it. The text-only variant removes the tick altogether, which is a further reason to prefer it.

**§ 25 TDDDG.** Camera capture or picking one photo for a scan the user starts is access that is "unbedingt erforderlich ..., damit der Anbieter ... einen vom Nutzer ausdrücklich gewünschten digitalen Dienst zur Verfügung stellen kann" (§ 25 Abs. 2 Nr. 2). This holds because the scan is offered and explained as a cloud scan. The permission screen is in any case worded to the consent standard of § 25(1), so no gap remains if a stricter view is taken.

### 4.2 Processor and DPA (Art. 28)

The provider is a processor only if it processes "nur auf dokumentierte Weisung" (Art. 28(3)(a)). A provider that uses images for its own training "starts to determine its own purposes and means" and "will then be considered a controller" (EDPB 07/2020). That is why no-training is a must, not a preference. Art. 28(3) contents to check: subject matter and duration, type of data (receipt images, which may show third-party names such as cashiers), the data subjects (users and incidentally cashiers or household members), confidentiality, Art. 32 security, sub-processor approval (Art. 28(2): prior general or specific written authorisation with notice of changes), assistance with data-subject rights, deletion at the end, and audit information.

Supabase (existing processor, SCCs in its DPA) transiently handles the image in the server function. That is already covered by §12/§13, as long as the function is pinned to Frankfurt (C2).

### 4.3 Transfers (Chapter V)

- EU-headquartered provider, EU processing, no non-EU sub-processor for OCR: no transfer (Art. 44 not triggered). This is preferred (C12).
- US group, EU region (Google, Microsoft, AWS): processing stays in the EU, but remote access by the US parent is possible. Those parents state DPF participation (vendor pages fetched). Adequacy decision (EU) 2023/1795 applies (Art. 45). The General Court dismissed the annulment action in T-553/23 on 3 September 2025. An appeal (C-703/25 P, lodged 31 October 2025) is pending, according to secondary reports. A US provider's SCCs in its DPA serve as the fallback. Policy §13 must then name the provider and the DPF (Art. 13(1)(f)).
- A transfer assessment (EDPB 01/2020) is only needed if SCCs, not the DPF, are the actual basis. Not needed for an EU provider.

### 4.4 Loyalty-card numbers, payment data, third parties

Card fragments, IBAN and loyalty numbers are personal data, but they are not Art. 9 data and are not needed for the purpose (Art. 5(1)(c), Art. 25(2): "durch Voreinstellung ... nur ... erforderlich"). Strip them on the server before the app sees anything, and never store them (C4). Do not keep the raw OCR text. Cashier names are third-party data. They are discarded at once, so no Art. 14 notice is practicable or needed beyond the policy text.

### 4.5 DPIA: not required; record a screening note

- Art. 35(3)(b) (large-scale Art. 9 processing) does not apply: Art. 9 data is incidental, filtered out and not stored, and Snacklist is a small consumer app.
- DSK Muss-Liste v1.1: Nr. 11 (AI "zur Steuerung der Interaktion ... oder zur Bewertung persönlicher Aspekte") does not apply, because OCR extraction does neither. Nr. 14 ("umfassende Profile über ... Kaufverhalten", for example loyalty cards for customer retention) does not apply, because prices are the user's own history and are not profiled or used for marketing (N-130 holds). Nr. 15 (anonymisation of Art. 9 data) does not apply.
- WP248 criteria: at most "innovative use" (criterion 8) applies, while "sensitive data" (criterion 4) is designed out by C5. "In most cases" two criteria are needed. Result: no DPIA. Keep a half-page screening note in the record of processing (C10). If C5 is dropped, or receipts are used for anything beyond the user's own price history, do the DPIA.

### 4.6 Retention

| Data | Where | Retention |
|---|---|---|
| Photo on the device | App temp storage | Delete after upload or cancel; never saved to the photo library |
| Photo in transit | Snacklist server function (Frankfurt) | Memory only; not logged |
| Photo and result at the provider | Provider (EU) | Zero retention, or deleted via API right after the result; never more than 24 h |
| Full OCR text | — | Not stored anywhere by Snacklist |
| Proposed, unconfirmed lines | Device | Until confirm or cancel; 24 h max |
| Confirmed lines (item, price, qty, date, chain) | Database | Like manual prices (price-history paragraph); deleted with the line, the household or the account |
| Permission and consent record (version, time, yes/no) | Database | While the account exists (Art. 7(1) proof), like the usage-data decisions |

### 4.7 Art. 9 disposition

The CJEU holds that Art. 9(1) applies where processing allows sensitive information to be revealed, "unabhängig davon, ob diese Informationen einen Nutzer ... oder eine andere natürliche Person betreffen" and irrespective of whether the controller aims to obtain it (C-252/21, paras 68–69). Order data for pharmacy-only medicines are health data "auch wenn der Verkauf dieser Arzneimittel keiner ärztlichen Verschreibung bedarf" (C-21/23). A whole pharmacy receipt in the cloud is therefore Art. 9 processing.

Disposition, with no lawyer needed:
1. Scope is grocery receipts only, and the in-app text says so.
2. The server discards the whole result of a pharmacy receipt. C11 adds an on-device pre-check.
3. Health-like lines are never proposed or stored.
4. Explicit consent (Art. 9(2)(a)) covers the user's own incidental lines.
5. The provider deletes the data at once and never trains on it.

Residual: a supermarket receipt may carry an incidental health-related line bought for another household member. It is transient, unstored, processor-only and filtered, which is an accepted low risk. The text-only variant removes even that from the cloud, so prefer it if feasible.

## 5. In-app texts (paste-ready)

### A. One-time permission screen (before the first cloud scan)

**DE**

**Kassenbon scannen**
- Wenn du auf „Scannen“ tippst, schickt Snacklist genau dieses Foto zur Texterkennung an [ANBIETER] in der EU.
- [ANBIETER] löscht Foto und Ergebnis direkt danach und nutzt sie nicht zum Training. Wir speichern das Foto nicht.
- Kartennummern, IBAN, Kunden- und Payback-Nummern, Namen an der Kasse, die Adresse des Ladens, die Uhrzeit sowie Bon-, Transaktions- und TSE-Nummern entfernen wir, bevor du die Zeilen siehst.
- Gespeichert wird nur, was du bestätigst: Artikel, Preis, Menge, Datum, Kette. Bitte keine Apothekenbons.

☐ Ich willige ausdrücklich ein, dass Snacklist meine Kassenbons zur Texterkennung auch dann verarbeitet, wenn sie gesundheitsbezogene Artikel zeigen. Ich kann das jederzeit unter Mehr › Einstellungen widerrufen.

[Erlauben und scannen] (only active when ticked) · [Nicht jetzt]

**EN**

**Scan receipt**
- When you tap "Scan", Snacklist sends this one photo to [PROVIDER] in the EU to read the text.
- [PROVIDER] deletes the photo and the result straight after and does not use them for training. We do not store the photo.
- We remove card numbers, IBANs, customer and Payback numbers, names at the till, the shop's address, the time, and receipt, transaction and TSE numbers before you see the lines.
- Only what you confirm is stored: item, price, quantity, date, chain. Please don't scan pharmacy receipts.

☐ I explicitly agree that Snacklist may process my receipts for text recognition even if they show health-related items. I can withdraw this at any time under More › Settings.

[Allow and scan] (only active when ticked) · [Not now]

### B. Line under the scan button (every time)

DE: „Dieses Foto geht zur Texterkennung an [ANBIETER] in der EU und wird danach gelöscht. Du prüfst jede Zeile, bevor etwas gespeichert wird.“

EN: "This photo goes to [PROVIDER] in the EU to read the text and is deleted afterwards. You check every line before anything is saved."

### C. Settings switch

DE: „Kassenbons in der Cloud scannen“ — Untertitel: „Aus: Es werden keine Fotos gesendet. Preise kannst du weiter von Hand eintragen.“
EN: "Scan receipts in the cloud". Subtitle: "Off: no photos are sent. You can still enter prices by hand."

## 6. Privacy-policy redlines (DE authoritative, EN translation)

Base: package `/workspace/hummlist/research/legal-review/pr-363/f3dc3ccb66d5a24e5713eb5d7c3b9c093e9166f7/legal/` (datenschutz.md, privacy.md). Ship together with the first build that offers the cloud scan, and together with the price-history paragraph. Replace the placeholders after the vendor check (C10). Delete the bracketed sentence unless C11 is built.

**Change 1, new subsection. Placement:** after §6 "Spracheingabe" / "Voice input" (after the line "Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO." / "Legal basis: Art. 6(1)(b) GDPR.") and before §7.

Old: *(none)*

New DE:

> ## 6a. Kassenbon scannen (Snacklist Premium)
>
> Mit Snacklist Premium kannst du in der App für iPhone und Android Preise aus einem Kassenbon übernehmen. Erst wenn du auf „Scannen“ tippst, schickt die App genau das eine Foto, das du in der App aufnimmst oder über die Fotoauswahl deines Systems wählst, zur Texterkennung. Auf deine ganze Fotomediathek greift Snacklist nicht zu. Das Foto geht über unsere Server-Funktion in Frankfurt am Main an unseren Auftragsverarbeiter [ANBIETER, Sitz], der den Text in [einem Rechenzentrum in der EU] liest. [ANBIETER] verarbeitet das Foto nur in unserem Auftrag, nutzt es nicht zum Training und nicht für eigene Zwecke und löscht Foto und Ergebnis direkt nach der Verarbeitung[, spätestens nach [X] Stunden]. Wir speichern das Foto nicht, und den vollständigen erkannten Text behalten wir nicht. Bevor du das Ergebnis siehst, entfernt unser Server Kartennummern und Teile davon, IBAN, Kunden- und Treuekartennummern (z. B. Payback), Namen und Kennungen an der Kasse, die Adresse des Ladens, die Uhrzeit sowie Bon-, Transaktions- und TSE-Nummern; sie werden nie gespeichert. Die Funktion ist für Lebensmittel-Kassenbons gedacht. Ist ein Bon von einer Apotheke, verwerfen wir das Ergebnis vollständig[; erkennt die App das schon vorher, schickt sie das Foto gar nicht erst]. Zeilen, die nach Arzneimitteln oder Gesundheitsprodukten aussehen, schlagen wir nicht vor. Du prüfst die vorgeschlagenen Zeilen; gespeichert wird nur, was du bestätigst: Artikelname, Preis, wenn angegeben die Menge, das Datum und die Handelskette, wie bei von Hand eingetragenen Preisen (Abschnitt [Preisverlauf]). Nicht bestätigte Zeilen bleiben nur auf deinem Gerät und werden nach spätestens 24 Stunden gelöscht.
> Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO. Zeigt ein Bon trotzdem gesundheitsbezogene Artikel, verarbeiten wir sie nur mit deiner ausdrücklichen Einwilligung, die du vor dem ersten Scan in der App gibst (Art. 9 Abs. 2 lit. a DSGVO). Du kannst sie jederzeit unter Mehr › Einstellungen widerrufen (Art. 7 Abs. 3 DSGVO); dann senden wir keine Fotos mehr, und du kannst Preise weiter von Hand eintragen. Den Zugriff auf die Kamera bzw. auf das gewählte Foto für den Scan, den du gestartet hast, stützen wir auf § 25 Abs. 2 Nr. 2 TDDDG.

New EN:

> ## 6a. Scanning receipts (Snacklist Premium)
>
> With Snacklist Premium you can take prices from a receipt in the iPhone and Android app. Only when you tap "Scan" does the app send exactly the one photo that you take in the app or choose with your system's photo picker, for text recognition. Snacklist does not access your whole photo library. The photo goes through our server function in Frankfurt am Main to our processor [PROVIDER, seat], which reads the text in [data centre in the EU]. [PROVIDER] processes the photo only on our behalf, does not use it for training or for its own purposes, and deletes the photo and the result straight after processing[, at the latest after [X] hours]. We do not store the photo, and we do not keep the full recognised text. Before you see the result, our server removes card numbers and parts of them, IBANs, customer and loyalty card numbers (for example Payback), names and IDs at the till, the shop's address, the time of day, and receipt, transaction and TSE numbers; these are never stored. The feature is meant for grocery receipts. If a receipt is from a pharmacy, we discard the result completely[; if the app recognises this beforehand, it does not send the photo at all]. We do not propose lines that look like medicines or health products. You check the proposed lines; only what you confirm is stored: item name, price, the quantity if given, the date and the shop chain, as with prices you enter by hand (section [price history]). Unconfirmed lines stay only on your device and are deleted after 24 hours at the latest.
> Legal basis: Art. 6(1)(b) GDPR. If a receipt still shows health-related items, we process them only with your explicit consent, which you give in the app before your first scan (Art. 9(2)(a) GDPR). You can withdraw it at any time under More › Settings (Art. 7(3) GDPR); we then send no more photos, and you can still enter prices by hand. Access to the camera or the chosen photo for the scan you started is based on § 25(2) no. 2 TDDDG.

**Change 2, §12 processor list. Placement:** new bullet after the RevenueCat bullet.

Old: *(none)*
New DE: `- [ANBIETER, Sitz] (Texterkennung beim Scannen von Kassenbons in Snacklist Premium (Abschnitt 6a); Verarbeitung in [einem Rechenzentrum in der EU]; löscht Fotos und Ergebnisse direkt nach der Verarbeitung)`
New EN: `- [PROVIDER, seat] (text recognition when scanning receipts in Snacklist Premium (section 6a); processing in [data centre in the EU]; deletes photos and results straight after processing)`

**Change 3, §13, only if the provider belongs to a US group. Placement:** extend the first DPF bullet.

Old DE: `- Vercel Inc., GitHub Inc., PostHog Inc., Plus Five Five, Inc. (Resend) und Google LLC (USA; …) sind nach dem EU-US Data Privacy Framework zertifiziert.`
New DE: the same list plus `[US-Muttergesellschaft des ANBIETERS]` before "sind nach dem EU-US Data Privacy Framework zertifiziert", plus a new bullet: `- [ANBIETER] verarbeitet die Fotos in [einem Rechenzentrum in der EU]; ein Zugriff aus den USA ist nicht ausgeschlossen. Dafür gilt der Angemessenheitsbeschluss (Art. 45 DSGVO), zusätzlich die Standardvertragsklauseln im Auftragsverarbeitungsvertrag (Art. 46 Abs. 2 lit. c DSGVO).`
Old EN: `- Vercel Inc., GitHub Inc., PostHog Inc., Plus Five Five, Inc. (Resend) and Google LLC (USA; …) are certified under the EU-US Data Privacy Framework.`
New EN: the same list plus `[US parent of PROVIDER]`, plus: `- [PROVIDER] processes the photos in [data centre in the EU]; access from the USA cannot be ruled out. The adequacy decision applies (Art. 45 GDPR), with the Standard Contractual Clauses in the data processing agreement in addition (Art. 46(2)(c) GDPR).`
For an EU provider with no non-EU sub-processor for OCR: no §13 change.

**Change 4, §14 retention. Placement:** before the sentence "Protokolle unseres Datenbank-Anbieters …" / "Our database provider's logs …".

Old: *(none)*
New DE: `Fotos von Kassenbons speichern wir nicht; bestätigte Zeilen daraus speichern wir wie von Hand eingetragene Preise, nicht bestätigte Zeilen bleiben höchstens 24 Stunden auf deinem Gerät (Abschnitt 6a).`
New EN: `We do not store photos of receipts; confirmed lines from them are kept like prices entered by hand, and unconfirmed lines stay on your device for 24 hours at most (section 6a).`

**Change 5, §15 rights:** no change. Art. 7(3) withdrawal is already listed.

## 7. Provider must-haves and candidates

**Must-have checklist (all, before signing):**
1. Art. 28 DPA covering the service, contracting entity named; Peter accepts it himself.
2. EU region selectable and enforced for processing **and** storage; EU API endpoint; no global or US fallback.
3. Customer content not used to train or improve models, by contract (not only in marketing), with the opt-out set where the default is otherwise.
4. Zero retention, or deletion via API immediately; no default retention beyond 24 h.
5. Current, public sub-processor list (dated within 12 months) with change notice and objection right; no non-EU sub-processor for OCR, or a disclosed transfer basis.
6. Transfer basis if a US group: DPF participation of the parent plus SCCs in the DPA.
7. Encryption in transit and at rest; Art. 32 measures documented (ISO 27001 / SOC 2 report available).
8. Receipt or line-item extraction quality without needing to upload training samples from users.
9. No requirement to log request bodies; metadata-only logging.

**Candidates — to verify, none approved** (facts fetched 11 November 2026; see VERIFICATION.txt):

| Candidate | Verified this session | Not verified / blocker |
|---|---|---|
| Mistral AI OCR (France, EU HQ) | "By default, your data is hosted in the European Union"; but data "can be temporarily transferred outside of the European Union" depending on feature (help, 12 Aug 2026). ZDR covers `/v1/ocr` (on request); Files API is outside ZDR. "Data sent through our API isn't used for model training" (product page). Terms §4.2: no training except opt-in/opt-out settings, Feedback, Order Form, Labs/Preview models. DPA: transfers on adequacy or SCCs | Sub-processor list (JS page) not read; whether OCR uses any non-EU sub-processor; pay-as-you-go training setting (help text ambiguous); ZDR approval. Do not upload via the Files API; avoid Labs/Preview models |
| Google Cloud Document AI (EU location) | EU location: "data and processes are only stored in the European Union" (with "You and your users can access the data from any location"). Online requests "not persisted to disk"; "we never use customer data to train our Document AI models"; some request metadata logged. Google LLC states DPF certification | Contracting entity in the Cloud DPA; sub-processors for Document AI; any Gemini-based extractor using a global endpoint (avoid) |
| Azure AI Document Intelligence (EU region) | "processed in the same region where the ... resource was created"; input and results stored "for 24 hours"; Delete Analyze Result API. Microsoft states DPF compliance (page updated September 2026) | No-training statement not found on the service page; DPA contracting entity; EU Data Boundary exceptions (10 Nov review) |
| Amazon Textract (eu-central-1) | Service Terms §50.3: AWS "may use and store AI Content" from Textract "to develop and improve", and may store it "in an AWS region outside" the one used; opt-out via an AWS Organizations AI opt-out policy. AWS states DPF certification | Acceptable **only** with the AI services opt-out policy in place; input retention not verified. Least attractive of the four |

Legal preference, not a vendor approval: an EU-headquartered provider with zero retention (fewest moving parts: no Chapter V, no §13 change), subject to the sub-processor check. Among US groups, Google Document AI's public no-training and no-persistence statements are the clearest of those fetched.

## 8. Store labels (Apple, Google)

- **Apple App Privacy:** "Collect" means data sent off the device and accessible "for a period longer than what is necessary to service the transmitted request in real time". With zero retention, the photo is arguably not "collected". With up to 24 h retention it is. Lower-risk answer: declare **Photos or Videos** (App Functionality, not used for tracking). The stored lines need **Purchase History** (App Functionality, linked to the user, not tracking). Apple 5.1.2(i) explicit permission is satisfied by §5 A. The camera or photo purpose string must name the receipt scan and the cloud text recognition.
- **Google Play Data safety:** declare **Photos** (collected; ephemeral processing must still be entered, and the 24 h case is not ephemeral; purpose App functionality) and **Purchase history** (collected, App functionality). Transfer to a processor is not "sharing" ("Service provider ... processes user data on behalf of the developer"). Do **not** declare User payment info, because it is stripped and never stored (keep it that way). Data deletion: confirmed lines are deleted with the account (existing answer).

## 9. Severity overview

| # | Severity | Item |
|---|---|---|
| N-135 | MUST | Art. 28 DPA; Peter accepts |
| N-136 | MUST | Frankfurt-pinned server function + EU region |
| N-137 | MUST | No training, zero or immediate deletion, ≤24 h; no body logging |
| N-138 | MUST | Server-side stripping of payment, loyalty, cashier, address, time and transaction IDs |
| N-139 | MUST | Art. 9: grocery only, pharmacy discard, no health lines, explicit consent |
| N-140 | MUST | One-time permission + button notice + settings switch; picker, no library access |
| N-141 | MUST | Policy §6a/§12/§14 (+§13 if US group), with the price-history paragraph |
| N-142 | MUST | Apple / Google labels updated in the same release |
| N-143 | MUST | Unconfirmed lines device-only, 24 h |
| N-144 | MUST | Vendor re-check before signing; DPIA screening note |
| C11 | SHOULD | On-device pharmacy pre-check |
| C12 | SHOULD | Prefer an EU-headquartered provider |

## 10. Sources (fetched 11 November 2026, CET)

GDPR (EUR-Lex CELEX:32016R0679, DE; EUR-Lex reachable this time) Art. 5, 6, 7, 9, 13, 25, 28, 35, 44, 45, 46; § 25 TDDDG (gesetze-im-internet.de/ttdsg/__25.html); CJEU C-252/21 and C-21/23 (EUR-Lex); Decision (EU) 2023/1795; General Court T-553/23 (dismissed, 3 Sep 2025); C-703/25 P OJ notice (pending status from secondary reports, unverified on curia); DSK DSFA Muss-Liste v1.1; WP248 rev.01; EDPB Guidelines 07/2020 and 2/2019; Apple App Store Review Guidelines 5.1.1/5.1.2; Apple App Privacy Details; Google Play Data safety and User Data policy; vendor pages listed in §7. EDPB Recommendations 01/2020 referenced but not re-fetched (only relevant for an SCC-only provider). LfDI BW not used.

## 11. What this review does not do

It does not approve a vendor, accept any terms, send anything, or decide U2. Nothing is published until Peter approves the wording and a build with C1–C10 exists.

---

## Addendum A (11 November 2026, ~22:05 CET): Peter chose U2B; provider comparison (Vertex AI / Gemini, Mistral OCR, Document AI, Chinese open models)

**Peter's decision, recorded:** **U2B** (the receipt image goes to an EU cloud service and is deleted right away). Given in his own chat at 21:39 CET on 11 November 2026 (t91u), with "Let's also consider Vertex AI". At 21:41 CET (t92u) he added: "best case we can use a capable chinese model via Vertex AI. Cheap, compliant and capable enough to reliably scan receipts." The provider is still his choice; below is the legal recommendation. Sources: VERIFICATION.txt "ADDENDUM", all fetched this session. Workspace notes: the 30 October Vertex AI EU design for support mail (reviews/2026-10-30-hummlist.md §J) was parked; no note shows an existing Google Cloud billing account, so assume none.

### A.1 Recommendation (ranking)

1. **Google Vertex AI, `gemini-3.5-flash`, regional endpoint `europe-west3` (Frankfurt).** Recommended. It is GA, ML processing is documented in Germany, and the contract has a no-training term. It uses an existing Google contract (CDPA) and an entity Snacklist already lists (Google Cloud EMEA Limited). Its one gap against N-137 (abuse-flag logging, below) is narrow and can be disclosed.
2. **Mistral OCR (EU headquarters).** Legally the cleanest on transfers. It becomes usable only after Mistral approves zero data retention for `/v1/ocr` and after the sub-processor list (JS page, not readable) and the pay-as-you-go training setting are checked. Fallback if Peter prefers no US group.
3. **Google Document AI Expense parser, `eu` location.** It is not persisted and never used for training. It runs in the EU multi-region only, not Frankfurt, and costs $0.10 per receipt. Use it only if Gemini extraction quality falls short.
4. **Chinese-origin models on Vertex: no for 1 December.** See A.3. Self-deploying Qwen3-VL or DeepSeek-OCR in `europe-west3` would be legally acceptable (Google-operated, no transfer to China). But GPU availability in Frankfurt is unverified, and a dedicated GPU endpoint costs far more than per-token pricing at Snacklist's volume.

### A.2 Vertex AI (Gemini 3.5 Flash) against the must-haves

| Must-have | Verdict | Evidence (fetched 11 Nov 2026) |
|---|---|---|
| N-135 Art. 28 DPA, named entity | **Pass** | Cloud Data Processing Addendum (CDPA, last modified 30 Oct 2026). Contracting entity for Germany: "EMEA except France, Italy and Poland — Google Cloud EMEA Limited". Whether a non-business individual account gets the CDPA is **unverified**, so open the billing account as a business (Einzelunternehmen "Peter Trost") |
| N-136 EU processing | **Pass** with config | The `gemini-3.5-flash` model page shows ML processing in "Europe: europe-west2, europe-west3". The data-residency table ticks Germany (europe-west3) and EU multi-region. The contractual commitment (Service Terms §16) is the **Multi-Region**, so `europe-west3` sits inside the EU. "global" endpoints "may be processed in any Google Cloud location", so never use them |
| N-137 no training | **Pass** | Service Terms §18: "Google will not use Customer Data to train or fine-tune any AI/ML models without Customer's prior permission or instruction." |
| N-137 retention ≤24 h | **Pass with one disclosed exception** | Implicit caching is on by default (in-memory and durable, ≤24 h, in region); **disable caching for the project**. Request-response logging is "disabled by default"; keep it off. Interactions API defaults to `store=true`; do not use it (use `generateContent`). **Exception:** under the online GCP terms (ToS 4.3), Google may log prompts that its classifiers flag, "for up to 90 days in the same region or multi-region", with possible human review, no training. Only Cloud Master Agreement customers are exempt, and no opt-out for online-terms customers was found. **Disposition:** accept as a narrow, event-driven exception and disclose it in §6a (A.4). This amends N-137's 24 h ceiling for this provider only |
| Grounding and web search off | **Required** | Grounding with Google Search keeps logs up to 3 days and Maps 30 days, which "cannot be disabled". Grounding is excluded from the data-residency commitments. Send no `tools` (no Google Search, Maps, URL context, code execution or RAG) |
| Sub-processors | **Pass** (current list) | Sub-processor list last modified 19 Oct 2026. Google group affiliates worldwide for support and maintenance of "AI Platform/Gemini platform (formerly Vertex AI), Generative AI Services" mean remote access from outside the EU is possible, which is why the §13 sentence is needed (A.4) |
| Transfer basis | **Pass** | Official DPF list: Google LLC, EU-U.S. DPF "Active", next certification due 13 Sep 2027 (Art. 45). The CDPA also provides SCCs. The appeal C-703/25 P remains a known risk (main report §4.3) |
| Security (Art. 32) | **Pass** (standard) | CMEK, VPC-SC and data residency are listed as security controls for online prediction on the model page. Certification reports were not re-read |
| Price (non-legal) | ~$0.005–0.013 per receipt (estimate) | Non-global price is $1.65 per 1M input tokens (text and image) and $9.90 per 1M output tokens. The image token count for 3.5 Flash is not published on the page, so the estimate assumes about 1–2k input and 0.5–1k output tokens. Thinking must be kept minimal |

### A.3 Chinese-origin models on Vertex AI (Peter t92u)

**The legal point holds.** An open-weights model that Google runs on Vertex is processing by Google under the CDPA, not a transfer to China. Google states: "Customer prompts and model responses are not shared with third parties when using the Gemini Enterprise API, including open models." But such models are "Separate Offerings" (Service Terms §19), "subject to separate terms" in the model card, and Google disclaims liability for them. A licence must be accepted on deploy (`accept_eula=True` in Google's notebook). Peter would accept that himself: Apache-2.0 for Qwen3-VL and MIT for DeepSeek-OCR (Hugging Face model cards). Both are permissive, with no data-sharing duty.

| Model | (a) Vision / receipt | (b) Regions, EU? | (c) Google-operated, same terms? | (d) Self-deploy europe-west3 | (e) Price | Verdict |
|---|---|---|---|---|---|---|
| Qwen3 MaaS (235B, Coder, Next) | Text only | n/a | n/a | — | n/a | **Retired 21 Oct 2026** |
| DeepSeek-V4.1-Flash MaaS (preview) | Yes ("accepts text and image input") | **`global` only**; no EU data-residency tick | Google-operated; Separate Offering plus model-card terms | — | not on the pricing page | **No**: fails N-136 (global endpoint) |
| DeepSeek-OCR MaaS | OCR | — | — | — | — | **Retired 21 Oct 2026** |
| Qwen3-VL (self-deploy, Model Garden) | Yes, vision-language | Your own endpoint in your chosen region | Google-operated on your endpoint; CDPA; Apache-2.0 | Notebook's verified config is a3-highgpu-1g + 1× H100 (default us-central1); **H100 in europe-west3 unverified** | GPU hourly price, not per token (not fetched) | Legally OK; **not for 1 Dec** (cost, ops, unverified EU GPU) |
| DeepSeek-OCR (self-deploy) | OCR only (needs separate structuring) | Same as above | Google-operated; MIT | Machine type unverified | GPU hourly | Legally OK; not for 1 Dec |
| GLM, Kimi, MiniMax | Text, or retired | global | — | — | — | No |

**Quality (non-legal):** in Nanonets' own IDP benchmark (older model generations), Gemini-3-Flash scored 80.5 overall (OCR 81.7) and Qwen3-VL-235B 80.0 (OCR 71.7). DeepSeek-OCR was not listed. This is not evidence for German thermal receipts. Engineering should test 30–50 synthetic or own receipts (no user data) before launch.

### A.4 Exact configuration for Engineering (Vertex AI)

- **Model:** `gemini-3.5-flash` (GA; retirement "May 19, 2027 or later", so plan a model review before then). Do not use `-lite` variants (no Frankfurt ML processing), preview models or any model on `global`.
- **Endpoint:** `https://europe-west3-aiplatform.googleapis.com/v1/projects/<PROJECT>/locations/europe-west3/publishers/google/models/gemini-3.5-flash:generateContent`. Do not use `global` or `us`. The `eu` multi-region is acceptable only as a fallback, with no policy change beyond "in der EU".
- **Caller:** only the Snacklist server function pinned to Frankfurt (N-136), with a service account; no key in the app.
- **Project settings:** **disable caching** (turning it off disables both in-memory and durable caching); keep request-response logging **off**; no Interactions API (if ever used, `store=false`); no batch jobs or Cloud Storage uploads (send the image inline); no tuning; organisation policy restricting resource locations to `europe-west3` and EU, if available.
- **Request:** no `tools` (no grounding, search, Maps, URL context or code execution); minimal thinking; `responseMimeType: application/json` with a schema returning only `items[{name, price, qty}]`, `date`, `chain`, `is_pharmacy`. The system instruction says not to output card, IBAN, loyalty, cashier, address, time or transaction IDs. The server still strips them (N-138) and discards the result if `is_pharmacy` is set (N-139).
- **Logging:** no request or response bodies in Supabase logs, PostHog or error reports. Cloud Audit Logs: Admin Activity only, Data Access logs off for Vertex.
- **Billing:** a Google Cloud billing account in the name **"Peter Trost"** (Einzelunternehmen, Germany). Never IAKUVO.

### A.5 Updated redlines for the chosen provider (Vertex AI / Gemini)

Replace the placeholders in §5 and §6 as follows. Everything else in §5 and §6 is unchanged.

**§5 A permission screen.** DE bullet 1: „Wenn du auf „Scannen“ tippst, schickt Snacklist genau dieses Foto zur Texterkennung an Google (KI-Modell Gemini, Rechenzentrum Frankfurt am Main).“ DE bullet 2: „Google löscht Foto und Ergebnis direkt danach und nutzt sie nicht zum Training. Wir speichern das Foto nicht.“ EN: "… to Google (AI model Gemini, data centre in Frankfurt am Main) to read the text." / "Google deletes the photo and the result straight after and does not use them for training. We do not store the photo." **§5 B:** replace „[ANBIETER] in der EU“ with „Google in Frankfurt am Main“ and "[PROVIDER] in the EU" with "Google in Frankfurt am Main".

**§6 Change 1 (§6a), DE.** Old: „…an unseren Auftragsverarbeiter [ANBIETER, Sitz], der den Text in [einem Rechenzentrum in der EU] liest. [ANBIETER] verarbeitet das Foto nur in unserem Auftrag, nutzt es nicht zum Training und nicht für eigene Zwecke und löscht Foto und Ergebnis direkt nach der Verarbeitung[, spätestens nach [X] Stunden].“
New: „…an unseren Auftragsverarbeiter Google Cloud EMEA Limited, Dublin, Irland, der den Text mit dem KI-Modell Gemini im Rechenzentrum Frankfurt am Main liest. Google verarbeitet das Foto nur in unserem Auftrag, nutzt es nicht zum Training und nicht für eigene Zwecke und löscht Foto und Ergebnis direkt nach der Verarbeitung. Nur wenn Googles automatische Missbrauchserkennung eine Anfrage als verdächtig markiert, kann Google sie bis zu 90 Tage in der EU speichern und prüfen, ausschließlich um Missbrauch festzustellen.“

**§6a, EN.** Old: "…to our processor [PROVIDER, seat], which reads the text in [data centre in the EU]. [PROVIDER] processes the photo only on our behalf, does not use it for training or for its own purposes, and deletes the photo and the result straight after processing[, at the latest after [X] hours]."
New: "…to our processor Google Cloud EMEA Limited, Dublin, Ireland, which reads the text with the AI model Gemini in its data centre in Frankfurt am Main. Google processes the photo only on our behalf, does not use it for training or for its own purposes, and deletes the photo and the result straight after processing. Only if Google's automated abuse detection flags a request may Google keep it in the EU for up to 90 days and review it, solely to determine whether there was abuse."

**§6 Change 2 (§12).** Instead of a new bullet, **extend the existing Google bullet.**
Old DE: `- Google Cloud EMEA Limited, Dublin, Irland (Google Workspace, E-Mail)`
New DE: `- Google Cloud EMEA Limited, Dublin, Irland (Google Workspace, E-Mail; außerdem Texterkennung beim Scannen von Kassenbons in Snacklist Premium mit dem KI-Modell Gemini, Verarbeitung in Frankfurt am Main (Abschnitt 6a))`
Old EN: `- Google Cloud EMEA Limited, Dublin, Ireland (Google Workspace, e-mail)`
New EN: `- Google Cloud EMEA Limited, Dublin, Ireland (Google Workspace, e-mail; also text recognition when scanning receipts in Snacklist Premium with the AI model Gemini, processed in Frankfurt am Main (section 6a))`

**§6 Change 3 (§13): required (US group).** Google LLC is already in the DPF bullet. Add after that bullet:
New DE: `- Kassenbon-Fotos verarbeitet Google in Frankfurt am Main. Ein Zugriff durch Google-Gesellschaften außerhalb der EU, etwa für Wartung und Support, ist nicht ausgeschlossen; dafür gelten der Angemessenheitsbeschluss (Art. 45 DSGVO) für Google LLC und die Standardvertragsklauseln im Auftragsverarbeitungsvertrag von Google (Art. 46 Abs. 2 lit. c DSGVO).`
New EN: `- Google processes receipt photos in Frankfurt am Main. Access by Google companies outside the EU, for example for maintenance and support, cannot be ruled out; for this the adequacy decision (Art. 45 GDPR) applies to Google LLC, together with the Standard Contractual Clauses in Google's data processing agreement (Art. 46(2)(c) GDPR).`

**§6 Change 4 (§14):** unchanged. The flagged-abuse exception is stated in §6a. **§8 store labels:** declare Photos as "collected" (no ephemeral claim, because of the 90-day exception).

### A.6 What Peter must do himself (not delegable)

1. Create or confirm a Google Cloud **billing account** as a business, in the name **"Peter Trost"**, Germany (contracting entity Google Cloud EMEA Limited).
2. Accept the Google Cloud Platform Terms of Service and the **CDPA** in Cloud Console. Where Console offers it, review the CDPA and enter the EU data-protection contact (the console path is unverified this session). No bot may accept them.
3. Approve the final DE/EN wording in A.5 before publication.
4. Optional: subscribe to sub-processor change notices for the Art. 28(2) objection right.

### A.7 Open, unverifiable points

- Whether an individual (non-business) Google Cloud account receives the CDPA.
- The exact Console path for accepting the CDPA.
- No opt-out from flagged-abuse logging for online-terms customers was found. One is treated as unavailable.
- The image token count for Gemini 3.5 Flash, so the price is an estimate.
- Per-region cells on the locations page (JS); the model page and the residency table were used instead.
- H100/L4 availability and hourly price in `europe-west3` for self-deploy.
- Mistral's sub-processors and ZDR approval.
- Whether C-703/25 P is still pending (secondary sources only).

Conditions C1–C10 (N-135–N-144) remain in force. The verdict is now **conditional GO for Vertex AI `gemini-3.5-flash` in `europe-west3`** with the A.4 configuration, the A.5 redlines and Peter's A.6 steps. This is a careful review, not legal advice from a lawyer. No lawyer flag.
