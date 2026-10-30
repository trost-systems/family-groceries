# Job 29e: Einstellungen: light/dark/system theme and a language list

PR: https://github.com/trost-systems/family-groceries/pull/110

Peter, 2026-10-29: "the language selector isn't scalable once we add many languages. Move it a settings submenu and make it more scalable like a dropdown or another pattern if one is nicer than that. Also add a menu where we can put the light/dark/system mode switch and add dark+light mode."

## What changed for users

- **Mehr → Einstellungen** (`/more/settings`) replaces the Sprache segments on the More list. One row, "Einstellungen · Darstellung und Sprache", opens a page with two sections. From 840 px it opens beside More's list.
- **Darstellung**: "Wie Gerät" (default), "Hell", "Dunkel" as radio rows. A pick repaints the whole app at once. It is kept on the device, read before the first frame (a dark pick never starts light) and outlives reloads, restarts and sign-out. "Wie Gerät" follows the device's light or dark setting live.
- **Sprache**: a row that names the pick ("Deutsch", "English", or "Wie Gerät (Deutsch)") opens a language list (`/more/settings/language`). "Wie Gerät" comes first, with a line that says what the device gives ("Gerade Deutsch"), then one radio row per language in its own name. A pick switches every text at once and the page stays open. Back returns to Einstellungen, and beside the list on wide screens a back arrow does the same. Why a list page and not a dropdown: DECISIONS 29e.2.
- **A real dark theme.** It is design H's scheme in dark, built from the same seed. Every screen, sheet, dialog and snackbar uses `ColorScheme` roles. The store divider rules stay in the store's colour, mixed toward white where the brand colour would not reach 3:1 on the dark surface. Before, Lidl's, Edeka's and Aldi's navy rules nearly vanished on dark. Store badges get a light ring on dark.
- **No white flash on a dark device**: the web page behind the app and the iOS launch screen follow the device's setting. Android's launch theme already had a `values-night` variant.
- The account deletion dialog's hint now says the export is "unter Konto" (since 29d it is no longer "in den Einstellungen").

## Where

- `app/lib/app/theme.dart` (new): `appTheme(Brightness)` (the one place the theme is built), `ThemeCubit`, `themeModeOf`, `contrastRatio`.
- `app/lib/settings/settings_screen.dart` (new): `SettingsScreen` (keys `settings-screen`, `theme-system|light|dark`, `settings-language`) and `LanguageScreen` (`language-screen`, `language-system`, `language-<code>`).
- `app/lib/app/language.dart`: `AppLanguage.nativeName`. A new language is one enum value plus its ARB file.
- `app/lib/app/device_cache.dart`: `theme()` / `saveTheme()` (key `theme`, kept across sign-out).
- `app/lib/app/app.dart`, `app/lib/main.dart`: light and dark from `appTheme`, `themeMode` from the cubit, the stored pick read before `runApp`.
- `app/lib/app/router.dart`: `appSettingsPath`, `languagePath`, routes below `/more`, in `inMoreTab` and the screen names `settings` / `language` (job 21's feedback and analytics). `app/lib/more/more_screen.dart`: the `more-settings` row, `MorePage.settings|language`, the wide back arrow.
- `app/lib/list/store_badge.dart`: `storeTint(store, surface)` with the 3:1 floor, and the badge ring on dark. `app/lib/list/list_view/dividers.dart` passes the surface.
- `app/web/index.html` (`color-scheme` meta), `app/ios/Runner/Base.lproj/LaunchScreen.storyboard` (`systemBackgroundColor`).
- ARB: new `settingsTitle`, `settingsRowHint`, `appearance`, `themeSystem|Light|Dark`, `languageSystemNow`, `languageSystemPicked`. `languageGerman` and `languageEnglish` are gone (the names now live in `AppLanguage`). `accountDeleteExportHint` is reworded.
- Tests: `app/test/app/theme_test.dart` (cubit persistence, a sign-out keeps the pick, WCAG AA for every text role pair in both themes, 3:1 for outlines and for every store rule in both themes, brand colours unchanged where they already read), `app/test/settings/settings_screen_test.dart` (the More row, the theme switch and its persistence, light and dark overriding the device, the device default, the language list, live switching, back, the device line, the wide layout), `router_test.dart` (the new paths), `more_screen_test.dart`, `arb_parity_test.dart`.
- e2e: `e2e/tests/theme.spec.ts` (new) shoots every main screen in light and dark and reads the background's luminance from the screenshot pixels. It covers the persistence across a reload, Hell over a dark device, Wie Gerät following the device live, and the login after sign-out staying dark. `e2e/tests/shell-more.spec.ts`: the language now goes through Einstellungen → Sprache, the English browser scan includes both new pages, and the wide two-pane case covers the language list and its back arrow.
- Recipes: new `features/settings.md`; `features/shell-more.md`, `features/README.md`, `SKILL.md`.
- Decisions: `docs/DECISIONS.md`, "Job 29e".

## How to verify

```bash
(cd app && flutter analyze && flutter test test/app test/settings test/more test/l10n)
scripts/ci-e2e.sh --spec "tests/theme.spec.ts tests/shell-more.spec.ts" --no-db
```

By hand (preview.app.hummlist.com after the merge): Mehr → Einstellungen → Dunkel, then reload. It stays dark. Then Sprache → English.

## Screenshots

`docs/screenshots/29e-settings-theme/`: `before/` (main before this job, in a light browser and in a dark one) and `after/` (this branch, light and dark, every main screen), embedded in the PR.
