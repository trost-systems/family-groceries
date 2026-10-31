# Job 48: 6b Hex Frische and the three favourite icons in option 5's original colours (2026-10-31)

Design job, preview only. The branch is `design/48-icon6-frische`: `design/45-app-icon` with
`design/46-hex-art-styles` merged in. There is no PR, nothing was merged to main, main is
untouched, and nothing went to a store. The job was rescoped at 20:16: Peter's "6" is the design
system 6 Hex Frische, not icon #6. No Sprechwabe work is in any commit.

## Preview (Vercel login)

Vercel `hummlist-site` on `bf21701`: "Deployment has completed". The branch alias answers 302 to
the Vercel login, as expected (a made-up alias answers 404).

- Gallery: https://hummlist-site-git-design-48-icon6-frische-peter-trost.vercel.app/design-prototypes
- 6b homepage: https://hummlist-site-git-design-48-icon6-frische-peter-trost.vercel.app/design-prototypes/option-6b-hex-frische-original5
- 6b token sheet: https://hummlist-site-git-design-48-icon6-frische-peter-trost.vercel.app/design-prototypes/option-6b-hex-frische-original5/tokens-sheet
- App icon page (new top section): https://hummlist-site-git-design-48-icon6-frische-peter-trost.vercel.app/design-prototypes/app-icon

## The original 5 colours and where they come from

`design-prototypes/option-5-frische/tokens.css` is byte-identical to job 36's
`8a5713a:site/public/design-prototypes/option-5-frische/tokens.css` (moved unchanged in
`32ecb63`). The hexes never changed. 6 changed how they were used.

| Role | Light | Dark |
| --- | --- | --- |
| Brand / brand field | `#1b3fae` (white on it) | `#9fb6ff` (on it `#0b1024`) / field `#2448c0` (white) |
| Brand container | `#e1e8ff` / on `#132f86` | `#1d2b66` / on `#e1e8ff` |
| Tomato accent | `#ff5b3a` (on it `#0f1530`) | `#f0603f` (on it `#0b1024`) |
| Mint, lemon | `#7fe3b8`, `#ffe24a` (on both `#0f1530`) | `#62c99d`, `#e8cb3c` (on both `#0b1024`) |
| Surface, raised, sunken | `#f7f7f2`, `#ffffff`, `#eceff6` | `#0b1024`, `#151c3a`, `#111735` |
| Text, muted, border | `#0f1530`, `#4b536c`, `#d3d8e6` | `#eff3ff`, `#b0b9d8`, `#2f3a66` |

## Part A: 6b Hex Frische (Original 5 Farben)

Same generator, markup, hex controls, navy contour and type as 6. Only palette and colour
blocking change.

What changed compared with 6:

| Block | 6 Hex Frische | 6b, light | 6b, dark |
| --- | --- | --- | --- |
| Hero | mint, navy text | cobalt `#1b3fae`, white text, lemon store buttons | `#2448c0`, white text, lemon `#e8cb3c` buttons |
| Feature 1 | lemon | lemon | lemon `#e8cb3c` |
| Feature 2 | cobalt mist | brand container `#e1e8ff`, text `#132f86` | `#1d2b66`, text `#e1e8ff` |
| Feature 3 | mint | mint | mint `#62c99d` |
| Voice (Alexa, Siri) | cobalt | tomato `#ff5b3a`, navy text | tomato `#f0603f` |
| Privacy | open white | cobalt, white text, white checklist | `#2448c0` |
| CTA | lemon | lemon, tomato "Im Browser öffnen" | lemon, tomato button |
| Surfaces | `#f7f8f2`, mint-tinted sunken `#e4f6ec` | `#f7f7f2`, sunken `#eceff6` | 5's dark surfaces |
| Dark mode | calm navy cards | (n/a) | real colour fields |
| Mark | lemon hex check | cobalt hex, white check, lemon hex where 5 has its sun | same |

- Tomato is used for blocks and buttons only, never for text or links. Tomato on white is
  about 2.9:1, so links and focus rings stay cobalt.
- The gallery card "6b · Hex Frische (Original 5 Farben)" sits directly after the 6 card.

Contrast, from the token sheet (every pair passes; full table on the sheet):

| Pair | Light | Dark | Min |
| --- | --- | --- | --- |
| white / cobalt (hero, privacy) | 8.9 | 7.6 | 4.5 |
| navy / lemon | 13.9 | 11.7 | 4.5 |
| navy / tomato | 5.8 | 5.8 | 4.5 |
| navy / mint | 11.6 | 9.3 | 4.5 |
| text / brand container | 9.7 | 10.8 | 4.5 |
| text / surface | 16.7 | 17.0 | 4.5 |
| muted / surface | 7.1 | 9.7 | 4.5 |
| lemon / cobalt (graphical) | 6.9 | 4.7 | 3 |
| contour / lemon, tomato, mint | 13.9, 5.8, 11.6 | 12.6, 6.2, 10.0 | 3 |
| contour / surface | 16.7 | 5.8 | 3 |

Screenshots:
- `design-prototypes/screenshots/48/6-vs-6b.png`: 6 and 6b side by side, phone light, phone dark
  and desktop light.
- `design-prototypes/screenshots/48/6b/`: homepage and token sheet, 390 and 1440, light and dark.

## Part B: Peter's favourites in option 5's original colours

| New | Based on | Light | Dark |
| --- | --- | --- | --- |
| 5o Wabenstapel | 5 | cobalt bg, lemon ring, white inner hex, cobalt check | deep `#0b1024`, lemon `#e8cb3c` ring, `#9fb6ff` inner hex, deep check |
| 13o Kachelstapel | 13 | cobalt bg, lemon back tile, white front tile, cobalt check | deep, lemon `#e8cb3c` back, paper front, `#2448c0` check |
| 14o Frische Wabe | 14 | cobalt bg, lemon hex, cobalt check cut out | deep, lemon `#e8cb3c` hex, deep check |

- **Geometry.** Each record shares its job 45 original's layers by reference, so the shapes
  are identical. `check.mjs` fails if that ever changes.
- **Recommendations.**
  - **5o** is the brand pick: it has the three colours of 5's mark, and its layers carry the
    depth in glass and visionOS.
  - **14o** for the clearest small icon: two colours, and the check holds at 16 px.
  - **13o** is the most "shared list" idea.
- **No tomato.** Tomato candidates measured 2.87:1 on cobalt, 2.38:1 on lemon and 3.08:1 on
  white (`screenshots/48/icon-colour-candidates.png`), so I made no tomato alternative.
- **Deliverables per icon** in `design-prototypes/app-icon/top/<n>o-<slug>/`, as in job 45:
  - Icon Composer groups as SVG, plus a README with the Default, Dark and Mono fill per layer.
  - Six Apple previews: Default, Dark, Clear light, Clear dark, Tinted light, Tinted dark.
  - visionOS back (opaque), middle and front at 1024 px, PNG and SVG.
  - Android:
    - 108 dp vector drawables and `mipmap-anydpi-v26/ic_launcher.xml`
    - 432 px PNGs, legacy mipmaps from 48 to 192 px, Play 512
    - four masks and Material You themed light and dark
  - Real-pixel renders in `previews/small/`.
- **Page.**
  - A new top section, **"Peter's favorites in original 5 colors"** ("Peters Favoriten in den
    Originalfarben von 5"), with one row per icon and the job 45 original beside it.
  - Each row has a CSS-only appearance switch (six radios, keyboard and visible focus), which
    changes both icons. The visionOS tilt stacks stand still under reduced motion.
  - Each row also shows the Android masks, themed icons, the small-size table and the
    contrast table.
  - The rest of the page is unchanged, except that job 45's clear and tinted previews are now
    named `apple-clear-dark` and `apple-tinted-dark` (same SVG). I also fixed a 390 px
    overflow in the variants list.

### Contrast per layer pair (graphical, aim at least 3:1)

Clear and tinted come from the one-colour shape, so they are the same for new and original.


**5o Wabenstapel**

| Appearance | Touching layers | New | >= 3:1 | Job 45 original |
| --- | --- | --- | --- | --- |
| Standard | Hintergrund / Ring | 6.85:1 | yes | 4.88:1 |
| Standard | Hintergrund / innere Wabe | 8.87:1 | yes | 7.19:1 |
| Standard | innere Wabe / Haken | 8.87:1 | yes | 16.39:1 |
| Dunkel | Hintergrund / Ring | 11.71:1 | yes | 11.73:1 |
| Dunkel | Hintergrund / innere Wabe | 9.53:1 | yes | 1.13:1 |
| Dunkel | innere Wabe / Haken | 9.53:1 | yes | 10.41:1 |
| Klar hell | Form / Fläche (angenähert) | 4.60:1 | yes | 4.60:1 |
| Klar dunkel | Form / Fläche (angenähert) | 6.73:1 | yes | 6.73:1 |
| Getönt hell | Form / Fläche (angenähert) | 5.37:1 | yes | 5.37:1 |
| Getönt dunkel | Form / Fläche (angenähert) | 10.42:1 | yes | 10.42:1 |

**13o Kachelstapel**

| Appearance | Touching layers | New | >= 3:1 | Job 45 original |
| --- | --- | --- | --- | --- |
| Standard | Hintergrund / Kachel hinten | 6.85:1 | yes | 11.61:1 |
| Standard | Hintergrund / Kachel vorn | 8.87:1 | yes | 17.94:1 |
| Standard | Kachel vorn / Haken | 8.87:1 | yes | 8.87:1 |
| Dunkel | Hintergrund / Kachel hinten | 11.71:1 | yes | 9.30:1 |
| Dunkel | Hintergrund / Kachel vorn | 17.54:1 | yes | 17.54:1 |
| Dunkel | Kachel vorn / Haken | 7.07:1 | yes | 8.25:1 |
| Klar hell | Form / Fläche (angenähert) | 4.60:1 | yes | 4.60:1 |
| Klar dunkel | Form / Fläche (angenähert) | 6.73:1 | yes | 6.73:1 |
| Getönt hell | Form / Fläche (angenähert) | 5.37:1 | yes | 5.37:1 |
| Getönt dunkel | Form / Fläche (angenähert) | 10.42:1 | yes | 10.42:1 |

**14o Frische Wabe**

| Appearance | Touching layers | New | >= 3:1 | Job 45 original |
| --- | --- | --- | --- | --- |
| Standard | Hintergrund / Wabe | 6.85:1 | yes | 5.73:1 |
| Standard | Wabe / Haken | 6.85:1 | yes | 5.73:1 |
| Dunkel | Hintergrund / Wabe | 11.71:1 | yes | 12.19:1 |
| Dunkel | Wabe / Haken | 11.71:1 | yes | 12.19:1 |
| Klar hell | Form / Fläche (angenähert) | 4.60:1 | yes | 4.60:1 |
| Klar dunkel | Form / Fläche (angenähert) | 6.73:1 | yes | 6.73:1 |
| Getönt hell | Form / Fläche (angenähert) | 5.37:1 | yes | 5.37:1 |
| Getönt dunkel | Form / Fläche (angenähert) | 10.42:1 | yes | 10.42:1 |

### Small sizes (29 pt at 1x and 3x, 48 dp, 16 px; rendered as real pixels)

- **5o.** At 29 pt and 48 dp the check reads clearly. At 16 px a lemon ring remains with a
  white core and a blue dot. That is louder than the violet original.
- **13o.** At 29 pt and 48 dp both tiles and the check are there. At 16 px a white tile with a
  lemon corner remains on cobalt, and the check becomes a stroke. The lemon corner carries
  better than the original's mint one.
- **14o.** The check stays legible even at 16 px. This is the clearest of the three.
- No tweak is needed. The bars-merging concern from the void brief does not apply.

Screenshots in `design-prototypes/screenshots/48/`:
- `original5-{mobile,desktop}-{light,dark}.png`: the whole new section
- `o-5o-*`, `o-13o-*`, `o-14o-*`: one row each

## How to verify

    cd design-prototypes/_tools && npm ci
    node build-art-styles.mjs option-6b-hex-frische-original5 && node check.mjs ../option-6b-hex-frische-original5
    node contrast-review.mjs ../option-6b-hex-frische-original5
    node app-icon/build.mjs && node app-icon/check.mjs
    node publish.mjs <worktree> && (cd ../../site && npm ci && npm run build && npm test)
    node preview-check.mjs <worktree>
    node app-icon/shots.mjs <worktree> 48

## Results

| Check | Result |
| --- | --- |
| `check.mjs` on 6b (2 pages × 390/1440 × light/dark: tokens, CSP, fonts, axe, 48 px targets, focus, press depth, reduced motion) | All checks passed. The subagent ran it, and I reran it myself. |
| `contrast-review.mjs` on 6b | 0 failures in 8 runs; lowest median 5.42:1 (the subagent's run) |
| `build-art-styles.mjs` rerun, `make-assets.mjs` | Idempotent; assets byte for byte; 6 and 3x untouched |
| `app-icon/check.mjs` | Pass for 5, 14, 13 and 5o, 13o, 14o. It checks sizes, the opaque visionOS back, 66 dp, vector against PNG, one-colour mono, at most 4 groups, six Apple previews, the small renders and shared geometry. |
| Lidl-guard bypass | Without `allowLidlLike`, all three new records fail "yellow on a blue field". All 16 job 45 variations still pass the guard. |
| Job 45 assets | Sprite sheet and every other file byte-identical; only the clear and tinted previews were renamed (same SVG) |
| `site npm run build`, `npm test` | Build OK, 52 of 52 |
| `preview-check.mjs` | 32 pages and 65 linked files clean behind the CSP; axe clean in light and dark at 390 and 1440 |
| gitleaks | No leaks (pre-commit and `gitleaks detect` on the full history) |

## Missing or blocked

- **No `.icon` file.** Icon Composer needs a Mac. See NEEDS_PETER, job 48.
- **Clear, tinted and themed previews are approximations**, as in job 45.
- **Behind the Vercel login.** I could not look at the preview from the runner (no Vercel token).
  The local Vercel-routing crawl stands in for it, as in jobs 36, 41, 45 and 46.
