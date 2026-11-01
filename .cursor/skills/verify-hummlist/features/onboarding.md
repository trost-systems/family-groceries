# Onboarding: from first sign-in to the list

After the first sign-in a user without a household lands on „Willkommen bei Hummlist“ / "Welcome to Hummlist" and either creates a household or accepts an invite. Creating asks for a name (prefilled „Unser Haushalt“ / "Our household") and which stores the household shops at (ten common ones to pick, own ones to type, or none), then offers to invite the partner, then opens the list. Opening an invite link (`/join/<code>`) skips the choice and goes to the join screen after sign-in. Builds that carry analytics ask the analytics question first (feature privacy-consent).

## Sub-features

- `welcome` Step 1, title „Willkommen bei Hummlist“ / "Welcome to Hummlist", text „Hummlist teilt eine Einkaufsliste mit allen in deinem Haushalt. Erstelle einen neuen Haushalt oder nimm eine Einladung an.“ / "Hummlist shares one shopping list with everyone in your household. Create a new household or accept an invite." Two cards: „Haushalt erstellen“ (hint „Eine neue Liste, zu der du danach deinen Partner einlädst.“) / "Create a household" ("A new list; you invite your partner next.") and „Einladung annehmen“ (hint „Du hast einen Link oder einen Code bekommen.“) / "Join with an invite" ("You got a link or a code."). Below: „Konto löschen“ / account delete (red text button); in the app bar a logout icon, tooltip „Abmelden“ / "Sign out".
- `create` Step 2a, title „Haushalt erstellen“ / "Create a household": field „Name des Haushalts“ / "Household name" (prefilled „Unser Haushalt“, 1 to 80 characters, error „Gib einen Namen mit 1 bis 80 Zeichen ein.“ / "Enter a name of 1 to 80 characters."), group „Läden“ / "Stores" with the hint „Wähl die Läden, in denen ihr einkauft. In dieser Reihenfolge stehen sie in der Liste.“ / "Pick the stores you shop at. Your list shows them in this order.", ten filter chips (EDEKA, REWE, Lidl, Aldi Süd, Aldi Nord, Kaufland, Netto, Penny, dm, Rossmann; none picked; `app/lib/household/popular_stores.dart`), „+ Eigenen Laden hinzufügen“ / "+ Add your own store" (an inline field „Name des Ladens“ / "Store name"; a typed store joins the chips, picked), the store-name note „Ladennamen wie dm, Lidl oder EDEKA verwenden wir nur, …“ / "We use shop names such as dm, Lidl or EDEKA only, …", the button „Haushalt erstellen“ / "Create a household", then „Überspringen“ / "Skip" (creates it without stores) with the hint „Ohne Läden starten. Du kannst sie später unter Mehr anlegen.“ / "Start without stores. You can add them later under More.". The picked stores are created in the order picked. The creator becomes the owner. A double tap or a retry after a lost answer makes one household.
- `invite-step` Step 3, title „Partner einladen“ / "Invite your partner" (`/welcome/invite`): text „Teile den Link oder den Code mit der Person, mit der du einkaufst. Die Einladung gilt 7 Tage und für eine Person.“ / "Share the link or the code with the person you shop with. The invite is valid for 7 days and for one person." Button „Partner einladen“ makes an invite (card with code, link, expiry and share/copy buttons, see household-invites); „Später“ / "Later" goes to the list, after an invite is made the same button reads „Weiter zur Liste“ / "Go to the list".
- `join` Step 2b, title „Einladung annehmen“ / "Join with an invite": field „Einladungscode“ / "Invite code", button „Weiter“ / "Continue" shows the household's name under „Einladung in den Haushalt“ / "Invite to the household", then „Haushalt beitreten“ / "Join household" (cancel: „Abbrechen“ / "Cancel"). Details in household-invites.
- `invite-link` a `/join/<code>` link survives sign-in, the analytics question and onboarding steps (kept for 7 days on the device); a new user lands on the join screen with the code filled in and the household previewed.
- `offline` create and join say „Keine Internetverbindung. Versuche es erneut, sobald du online bist.“ / "No internet connection. Try again once you're online." and keep what was typed.

## How to get to it (user POV)

- Sign up or sign in with an account that has no household: the app goes to Step 1 by itself (after the analytics question on builds with analytics).
- Open an invite link signed out: sign in, then the join screen opens directly.
- Step 1 „Haushalt erstellen“ → Step 2a → Step 3 → list. Step 1 „Einladung annehmen“ → join screen → list.
- Back arrows return to Step 1 (no household) from Step 2a and the join screen.

## Driving it with Playwright

Preconditions:

- Local stack, web build, a fresh email per run (`newEmail(...)` in the specs) because the seeded users already have a household. Viewport 390x844 or 480x900.
- On the e2e build the analytics question comes first; `signUp(page, email)` signs up and answers it (decline by default).

- **Sign up to Step 1.** `signUp(page, email)`. Observable result: URL `/welcome`, buttons `page.getByRole('button', { name: /^Haushalt erstellen/ })` and `/^Einladung annehmen/` visible.
- **Create with default stores.** `createHousehold(page)` (clicks the card, optionally types a name with `typeInto(page.getByRole('textbox', { name: 'Name des Haushalts' }), name)`, clicks `page.getByRole('button', { name: 'Haushalt erstellen', exact: true })`). Observable result: URL ends `/welcome/invite`; via the API second view: one household named „Unser Haushalt“, the user as only member with role owner, stores dm, Lidl, Edeka.
- **Create without stores.** `createHousehold(page, { stores: false })` clicks `page.getByRole('radio', { name: /^Überspringen/ })`. Observable result: household without stores.
- **Invite step.** `page.getByRole('button', { name: 'Partner einladen', exact: true }).click()`; the card shows (`inviteCodeLabel(page)`, text „gültig bis …“). Leave with `skipInvite(page)` (button `/^(Später|Weiter zur Liste)$/`): URL `/`, `addField(page)` focused.
- **Join with a code.** `joinWithCode(page, code, 'Familienname')` (clicks „Einladung annehmen“ if on Step 1, types into textbox „Einladungscode“, „Weiter“, then `confirmJoin`: button „Haushalt beitreten“). Observable result: URL `/`, `addField(page)` visible; the preview text for the household name is checked with `invitePreview`.
- **Invite link before sign-in.** `signUp(page, email, '/join/' + code)` then `confirmJoin(page, household)`.
- One-shot helper: `signUpWithHousehold(page, email)` = sign up, create with defaults, skip the invite.
- Covered by `e2e/tests/onboarding.spec.ts` (AC1-13, including invite link through password, magic link and fake Google/Apple, offline, rate limit, English), `e2e/tests/analytics.spec.ts` (order: sign-in, consent, onboarding). Run via `scripts/verify.sh --only e2e -- tests/onboarding.spec.ts`.

## Gotchas

- There is no separate "store step" or "email opt-in" in onboarding: the stores choice is the radio group on the create screen; the app asks for no newsletter or email opt-in anywhere in this flow (searched the screens; nothing found).
- The seeded demo users are already onboarded, so a recipe needs a fresh sign-up to see Steps 1-3.
- The prefilled household name is not in the DOM until the field is edited (so `toHaveValue` on it fails); edit with `typeInto` or just click create.
- Step 3 on the web shows the invite card (code, link, copy buttons) and only the „Teilen“ button where the browser has Web Share; Chromium in Playwright has none. The phones open the share sheet at once.
- Someone already in a household who opens an invite sees „Du bist schon in einem Haushalt“ / "You're already in a household" with a warning, and „Abbrechen“ is the prominent button (joining leaves the old household; if they are its last member it is deleted with its list).
- Too many wrong codes (10 failures in an hour) show „Zu viele Versuche. Bitte später noch einmal.“ / "Too many attempts. Please try again later." even for a valid code.
- Fake-OIDC e2e specs (provider sign-in lands on the join screen) need the fake issuer reachable from the Supabase container and time out on the Hetzner boxes; trust CI for them.
