# App language

The app speaks German or English. By default it follows the device's preferred languages (German when the device prefers neither). Under Mehr → Einstellungen → Sprache the user can pick „Deutsch“ or „English“ instead. The switch applies live to the whole UI (labels, snackbars, category names of the default categories) without a restart and is stored on the device only, also across sign-out.

## Sub-features

- `language-system` „Wie Gerät“ with the line „Gerade Deutsch“ / "Currently English" (the language the device gives).
- `language-de` „Deutsch“ (its own name in every UI language).
- `language-en` „English“ (its own name in every UI language).
- `language-persist` kept on the device across reload and sign-out; not part of the account.

## How to get to it (user POV)

- „Mehr“ / "More" → „Einstellungen“ / "Settings" → row „Sprache“ / "Language" (subtitle: the pick, or „Wie Gerät (Deutsch)“ / "Device (English)" when following the device) → list page titled „Sprache“ / "Language" with radios „Wie Gerät“ / "Device" (subtitle „Gerade {language}“ / "Currently {language}"), „Deutsch“, „English“.
- Deep link `/more/settings/language`. On wide screens the list opens beside the More list, with a back button next to the title.

## Driving it with Playwright

Preconditions:

- Seeded household, signed in, German browser locale (de-DE), on the list.

- **Open the list.** `openMore(page, 'Einstellungen')`, then click `getByRole('button',{name:/^Sprache Wie Gerät \(Deutsch\)/})`. Observable: URL `/more/settings/language`, `getByRole('radio',{name:/^Wie Gerät/})` checked.
- **Switch to English.** Click `getByRole('radio',{name:'English', exact:true})`. Observable, live: `getByRole('heading',{name:'Language'})`, `getByRole('tab',{name:'List'})` visible.
- **Persist.** `page.reload()`: heading still "Language". Back (`getByRole('button',{name:'Back'})`): `getByRole('button',{name:/^Language English/})`. List: `getByRole('textbox',{name:'What do you need?'})`, and the default category shows its English name (`getByText('Chilled')`).
- **Back to German.** Tab `More` (it returns to the More page you left); on Settings click `button /^Language/`; then `getByRole('radio',{name:'Deutsch', exact:true})`: heading „Sprache“.
- **English browser.** With `test.use({locale:'en-US'})` the app starts in English without any pick, and no German UI text shows (see the second describe in the spec).
- Spec: `scripts/verify.sh --only e2e -- tests/shell-more.spec.ts`.

## Gotchas

- Only de and en exist. The first of them in the device's preferred languages wins (fr, en gives English); German only when neither is listed.
- Texts from the server do not follow this setting: the Siri Shortcut always answers in German (its requests carry no language), native Siri (held) sends its own language with each request, the Alexa skill answers in English on an English Alexa device and in German otherwise, the AI-assistant (MCP) tools answer in German (only the held Premium-lock message follows the client's Accept-Language), the Snacklist API's error messages (held) are English, the sign-in and confirmation emails are Supabase's English defaults, and add-sheet catalogue rows (section „Aus dem Katalog“ / "From the catalogue") are German words in both UI languages (driven 2026-11-01).
- The setting is per device: a fresh browser context starts on „Wie Gerät“.
- Einstellungen has a section heading „Sprache“ / "Language" too, so `heading 'Language'` is true on both pages: pair it with the URL check.
- Back-button names flip with the language („Zurück“ / "Back").
