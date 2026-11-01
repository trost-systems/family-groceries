# Theme (light, dark, device)

Under Mehr → Einstellungen the user picks how the app looks: like the device, light or dark. The pick applies at once to every screen, is stored on the device only (not in the account) and also holds after sign-out and sign-in. The default is "like the device", which follows the browser's or phone's light/dark setting live.

## Sub-features

- `theme-system` „Wie Gerät“ (default): follows the device's light/dark setting, also when it changes while the app is open.
- `theme-light` „Hell“: always light.
- `theme-dark` „Dunkel“: always dark.
- `theme-persist` the pick survives reload and sign-out; it is per device, not per account.

## How to get to it (user POV)

- „Mehr“ / "More" → „Einstellungen“ / "Settings" (hint „Darstellung und Sprache“ / "Appearance and language") → section „Darstellung“ / "Appearance" with three radio rows: „Wie Gerät“ / "Device", „Hell“ / "Light", „Dunkel“ / "Dark".
- Deep link `/more/settings`. The old `/settings` link redirects there.

## Driving it with Playwright

Preconditions:

- Seeded household, signed in, on the list. Browser colour scheme is light by default; `page.emulateMedia({colorScheme:'dark'})` simulates a dark device.

- **Open settings.** `openMore(page, 'Einstellungen')`. Observable: URL `/more/settings`, `getByRole('heading',{name:'Einstellungen'})` visible, `getByRole('radio',{name:'Wie Gerät', exact:true})` is checked.
- **Pick a theme.** Click `getByRole('radio',{name:'Dunkel', exact:true})`. Observable: that radio `toBeChecked()`; the page background turns near black at once. Proof is pixels, not DOM: read the screenshot pixel at x=2, mid-height (luminance below 0.05 dark, above 0.7 light); `luminanceAt`/`expectTheme` in `e2e/tests/theme.spec.ts`.
- **Persist.** `page.reload()`, go to the list: still dark. Sign out via `getByRole('button',{name:/^Abmelden/})`: the login screen is dark too.
- **Device follows.** Pick „Wie Gerät“, then `page.emulateMedia({colorScheme:'dark'})` and back to `light`: the background changes live.
- **Hell beats a dark device.** Emulate dark, pick „Hell“: stays light.
- Spec: `scripts/verify.sh --only e2e -- tests/theme.spec.ts`.

## Gotchas

- Main has only these three radio rows (job 57's segmented control is not merged).
- Stored per device (browser storage): a fresh browser context starts on „Wie Gerät“.
- Colour is only visible in pixels or screenshots; semantics give no theme information.
- The wide layout shows Einstellungen beside the More list; the same radios.
