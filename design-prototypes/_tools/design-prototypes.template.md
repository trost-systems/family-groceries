# Hummlist design prototypes (job 36)

Five directions for the hummlist.com homepage, each with one design-token set meant to span the Flutter app, the website, transactional emails, store screenshots and Alexa cards. Built 2026-10-30 for Peter's review on 2026-10-31 at 12:00.

- **Gallery (preview):** https://hummlist-site-git-design-36-prototypes-peter-trost.vercel.app/design-prototypes. It sits behind Vercel Authentication, so you sign in with the Vercel account first. A 302 to the Vercel login is expected.
- **Source of truth:** `/workspace/hummlist/research/design-prototypes/option-N-<slug>/`. Each option folder holds `index.html`, `tokens-sheet.html`, `styles.css`, `tokens.json` (DTCG 2025.10), `tokens.css` (generated from `tokens.json`), `fonts/` (OFL files plus licences) and `assets/` (SVG). The research notes behind section (a) are in `_research.md`.
- **Preview copy:** the branch `design/36-prototypes` (one commit, not merged, no PR) puts the same folders under `site/public/design-prototypes/`.
- **Generated proof per option:** `flutter-preview/option_N_<slug>.g.dart` is the Flutter side (a ThemeExtension, a ColorScheme and type/space/radius/motion constants). All five files pass `flutter analyze` (Flutter 3.47.8). `email-preview/option-N-<slug>.html` is an invite email with inlined values, screenshotted as `screenshots/option-N-<slug>-email.png`.

## How it was checked

Every claim below comes from a run, not a reading. The tools are in `_tools/`, and each one reruns with `node <tool> <args>`.

| Check | Tool | Result |
| --- | --- | --- |
| tokens.json has the required roles and groups; every fg/bg pair meets AA in light and dark (4.5:1 text, 3:1 brand on surface and UI lines), 44 to 54 pairs per option; tokens.css is byte-identical to the Style Dictionary output; no `<style>`, `style=""`, `<script>` or inline handlers; no external or `data:` URLs; noindex, `lang="de"`; brand spelled Hummlist; one h1, no skipped headings, alt text on every `<img>` (the site build's own rules); folder under 1.5 MB | `check.mjs` | All 5 pass |
| In Chromium behind the hummlist-site CSP (`default-src 'self'`, from `site/vercel.json`), light and dark, 390 and 1440 px: no CSP violation, no failed or off-origin request, every webfont loaded, no horizontal scroll at 390, axe-core 4.14 WCAG 2.1 AA with zero violations | `check.mjs` | All 5 pass, 40 page runs |
| Text that axe cannot decide (over textures, under the sticky header, pseudo-element backgrounds) is measured from pixels: background images removed, the node scrolled into view, its text hidden, its box captured, and its colour compared with the background pixels | `contrast-review.mjs` | 0 axe violations. The pixel outliers were checked by eye, and all are deliberate overlaps inside the illustrations. In option 1 the mock snackbar covers a list row. In option 2 a store row scrolls under the mock's input bar, and the swatch "Aa" sample for the line colour `border-strong` shows its real 3.57:1. |
| Spot check by hand, independent of the tools (WCAG formula in Python) | | Option 5 text #0f1530 on lemon #ffe24a 13.87:1 and on tomato #ff5b3a 5.82:1. Option 3 ink on honey 11.13:1. Option 4 Bonrot #c4320a on paper 4.88:1. Option 1 primary #3c6939 on surface 6.12:1. Option 2 muted #66594a on paper 5.93:1. |
| The site build (`npm run build`) accepts the pages; served the way Vercel serves them (cleanUrls, trailingSlash false, CSP), all 11 pages load, with links followed from the gallery | `publish.mjs`, `preview-check.mjs` | Build OK, 11/11 pages clean |
| Vercel built the branch | GitHub commit status `Vercel – hummlist-site` | "Deployment has completed" |
| Option 1 colours are exactly what the app renders | `m3-scheme.mjs` vs a throwaway `flutter test` printing `ColorScheme.fromSeed(0xFF2E7D32)` | Identical roles, light and dark |

**What I could not verify.** The preview content behind Vercel Authentication. There is no Vercel token on this box, so I only saw the build status and the protected 302. The local crawl emulates the same routing and CSP.

**Known conflict.** `site/test/consistency.test.mjs` expects every built page's footer to link to the real `/impressum` and `/datenschutz`. The prototypes link them to `#`, as the brief asks. On this branch that one site test fails (51 of 52 pass; all 52 pass without the folder). CI runs only on pull requests and `main`, and the brief forbids touching other site files, so the branch stays as it is. A real homepage would link the real pages.

## (a) Design skills and guidance researched

All sources were opened on 2026-10-30. Install and star counts are the ones shown on the named page. The full notes, with every URL, are in [`design-prototypes/_research.md`](design-prototypes/_research.md).

**Anthropic frontend-design** ([SKILL.md](https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md); [skills.sh](https://skills.sh/anthropics/skills/frontend-design): 1.1M installs, rank 15; [anthropics/skills](https://github.com/anthropics/skills): 185.1k stars). It asks for a short design plan first and a palette named as 4 to 6 hex values. It gives one or two type families chosen on purpose and one orchestrated motion moment instead of scattered effects. It bans the usual AI tells: cream with terracotta, an accent colour on one headline word, all-caps eyebrow labels, the SaaS card kit and arrows on links. Copy counts as design. It is web-only and says nothing about Flutter or Material roles. We used its tell list as a review step here: option 2 moved off cream-plus-terracotta to beetroot, and option 5 moved off violet indigo to cobalt.

**Anthropic's other design skills** ([repo listing](https://api.github.com/repos/anthropics/skills/contents/skills)). `brand-guidelines` is a short file of named colours, font roles and where each applies. It is a good template for a Hummlist brand skill. `canvas-design` (a design philosophy, then a single-page PNG or PDF) fits store-screenshot backgrounds. `theme-factory` (10 preset themes) and `web-artifacts-builder` (React artifacts) do not fit Hummlist. The [Agent Skills docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) set the format: a short SKILL.md, reference files loaded on demand, scripts whose code never enters context. They also warn about skills that fetch remote instructions.

**pbakaus/impeccable** ([repo](https://github.com/pbakaus/impeccable): 96,751 stars; 373.5K installs on [skills.sh](https://skills.sh)). It has 24 commands (critique, audit, polish, harden and others), a deterministic detector with 62 rules (`npx impeccable detect`, exit code 2 on findings), a craft floor (4.5:1 body text, 65 to 75ch, one authored motion moment, every state designed), and `PRODUCT.md`/`DESIGN.md` as the per-project record. It is the only popular skill with an Android/Material reference: type roles in sp, colour roles instead of hex, 48 dp targets, and a dark scheme designed on its own. It is the best fit for agents who will touch the Flutter app.

**Vercel Web Interface Guidelines** ([vercel.com/design/guidelines](https://vercel.com/design/guidelines), [repo](https://github.com/vercel-labs/web-interface-guidelines): 1,066 stars; skill `web-design-guidelines` in [vercel-labs/agent-skills](https://raw.githubusercontent.com/vercel-labs/agent-skills/main/skills/web-design-guidelines/SKILL.md): 805.0K installs). These are concrete web rules: `:focus-visible` rings, targets 24 px (44 px on mobile), 16 px inputs on iOS, optimistic updates with Undo, animate only transform and opacity, curly quotes, tabular numbers, `color-scheme` and `theme-color`. The skill fetches its rules from GitHub on every run, so the repo should vendor a pinned copy. It is the right reviewer for hummlist.com and the Flutter web build. The prototypes follow it (curly „…“ quotes, tabular figures, reduced motion, focus rings).

**Vercel v0** ([v0 design systems docs](https://v0.app/docs/design-systems)). The docs only say to bring a design system as a shadcn registry and keep shadcn's variable names. I found no public v0 system prompt or v0 rulebook, so none is cited. It does not apply to a Flutter app.

**shadcn/ui theming** ([theming](https://ui.shadcn.com/docs/theming), [registry item](https://ui.shadcn.com/docs/registry/registry-item-json); the `shadcn` skill has 271.1K installs). It uses background/foreground pairs (`primary` / `primary-foreground`), `oklch()` values, a `.dark` override and a radius scale derived from one `--radius`. A `registry:theme` item carries `cssVars` for `light` and `dark`. Takeaway: the pair convention is the same as Material's `primary`/`onPrimary`. Hummlist should name roles after the app's model (brand/on-brand), not shadcn's.

**Material 3 dynamic colour** ([ColorScheme.fromSeed](https://api.flutter.dev/flutter/material/ColorScheme/ColorScheme.fromSeed.html), [DynamicSchemeVariant](https://api.flutter.dev/flutter/material/DynamicSchemeVariant.html), [material-color-utilities](https://github.com/material-foundation/material-color-utilities): 2.3k stars). `fromSeed` defaults to `tonalSpot`, which mutes the seed. Measured here: the app's primary is `#3c6939`, not the icon's `#2E7D32`, and the seed itself appears in no role. `fidelity` and `content` stay closer to the seed. `contrastLevel` runs from -1 to 1. Generate the roles once and export them as tokens. Don't re-derive them per surface. m3.material.io renders with JavaScript only and could not be read, and I found no official Flutter support for Material 3 Expressive.

**W3C Design Tokens (DTCG) 2025.10** ([format](https://www.designtokens.org/TR/2025.10/format/), [color](https://www.designtokens.org/TR/2025.10/color/), [resolver](https://www.designtokens.org/TR/2025.10/resolver/)). This is the first stable version (2025-10-28), a Community Group report rather than a W3C standard. Colours are objects (`colorSpace`, `components`, optional `hex`). Dimensions are `{value, unit}` in px or rem, durations are in ms or s, and `cubicBezier`, `typography` and `shadow` are composites. Modes such as light/dark live in a separate `.resolver.json`. All five `tokens.json` files here use this format. Light and dark are two groups (`color.light`, `color.dark`) with identical keys, because Style Dictionary does not read resolvers yet.

**Style Dictionary 5.7.1** ([DTCG support](https://styledictionary.com/info/dtcg/), [CHANGELOG](https://raw.githubusercontent.com/style-dictionary/style-dictionary/main/CHANGELOG.md)). DTCG colour objects landed in 5.3, dimension objects in 5.4, durations in 5.7, and there is no resolver support. Built in are `flutter/class.dart` (a flat constants class) and `css/variables`. This job uses it for real: `_tools/build-css.mjs` and `_tools/build-dart.mjs` are Style Dictionary 5.7.1 custom formats that write the CSS variables (light plus `prefers-color-scheme: dark`) and a Flutter ThemeExtension plus ColorScheme from the same file.

**Tokens Studio** ([docs](https://docs.tokens.studio/)) is a Figma plugin with DTCG support. Themes and sync are paid features. **Figma MCP** ([guide](https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Dev-Mode-MCP-Server)) needs a paid seat for the desktop server. Neither fits, because Hummlist has no Figma source of truth. **dtcg_theme** ([pub.dev](https://pub.dev/packages/dtcg_theme), 0.7.1, 228 downloads) generates a per-mode ColorScheme plus ThemeExtension and has a `--check` CI mode. It has the right shape but almost no adoption.

**Other popular skills** ([skills.sh](https://skills.sh) leaderboard). `ui-ux-pro-max` ([repo](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill): 142,944 stars, 424.9K installs) has a sound priority checklist that names Flutter, plus a palette generator that would override the brand. `taste-skill` ([repo](https://github.com/leonxlnx/taste-skill): 106,174 stars, 705.5K installs) has good type and colour numbers and a scripted screenshot check at 1440/768/390. Its rule of eight or more animated elements doesn't suit a calm list app. The top "design" row, `design-mobile-apps` (1.1M installs), is an API client for sleek.design, not design guidance. `ui-taste`, `ios-design`, `emil-design-eng` and `apple-design` are popular, but I did not read them.

**Email and Alexa** ([caniemail data](https://www.caniemail.com/api/data.json), [Alexa cards](https://developer.amazon.com/en-US/docs/alexa/custom-skills/include-a-card-in-your-skills-response.html), [APL resources](https://developer.amazon.com/en-US/docs/alexa/alexa-presentation-language/apl-resources.html)). No Gmail client, Outlook on Windows, or GMX/WEB.DE/T-Online webmail supports `prefers-color-scheme` or CSS variables. Emails therefore get literal hex from the light mode, inlined, with system fonts after the brand font. Alexa Simple cards (what `supabase/functions/alexa/handler.ts` sends today) are text only. Colour reaches Alexa only through a Standard card image (720×480 / 1200×800 PNG) or, later, APL `resources` with a `viewport.theme` condition.

**Worth adopting for Hummlist agents**, in order:
1. **impeccable**, for the app and everything else. It has native/Material rules, a detector with an exit code, and the `DESIGN.md` record.
2. **Anthropic frontend-design**, for the site, emails and store art. Its AI-tell list and copy rules apply.
3. **Vercel web-design-guidelines**, vendored as a pinned file, for reviewing hummlist.com and the web build.
4. Optional: the **ui-ux-pro-max** priority table as a pre-delivery checklist, without its generator.

## (b) The five options

Preview base: `https://hummlist-site-git-design-36-prototypes-peter-trost.vercel.app/design-prototypes`. Each option has a homepage and a token sheet (`…/tokens-sheet`), with the app list mock, email header and Alexa card on the sheet. Screenshots are full pages from Playwright Chromium: mobile at 390×844 and desktop at 1440 wide, light, with dark and token-sheet variants listed under each.

### Option 1: Tonal

**Idea.** The app's own Material 3 scheme from seed `#2E7D32`, carried unchanged to the site, email, store shots and Alexa: tonal surfaces, rounded containers, the real list screen as the hero.

{{TABLE:option-1-tonal}}

**Pros.**
- Zero app migration. `ColorScheme.fromSeed` stays, and a ThemeExtension adds only mark, success, warning and device-frame. Store screenshots match the real app exactly.
- Every role is generated, so dark mode and new surfaces cost nothing. 54 contrast pairs pass.
- Roboto Flex is what Android and web already show, and it can be bundled for iOS too.

**Cons.**
- It is the least distinctive. Next to the others it reads as "Material default", and the muted sage tones are flat at large sizes.
- The icon green `#2E7D32` is in no M3 role. The brand colour people see in the app (`#3c6939`) differs from the icon unless the scheme variant changes (`fidelity` or `content`).
- Emails and Alexa cards fall back to system fonts, so the brand rests on colour alone.

**Preview.** https://hummlist-site-git-design-36-prototypes-peter-trost.vercel.app/design-prototypes/option-1-tonal

| Mobile 390 | Desktop 1440 |
| --- | --- |
| ![Option 1 mobile](design-prototypes/screenshots/option-1-tonal-mobile.png) | ![Option 1 desktop](design-prototypes/screenshots/option-1-tonal-desktop.png) |

More: [mobile dark](design-prototypes/screenshots/option-1-tonal-mobile-dark.png), [desktop dark](design-prototypes/screenshots/option-1-tonal-desktop-dark.png), [token sheet](design-prototypes/screenshots/option-1-tonal-tokens-sheet-desktop.png), [token sheet dark](design-prototypes/screenshots/option-1-tonal-tokens-sheet-desktop-dark.png), [token sheet mobile](design-prototypes/screenshots/option-1-tonal-tokens-sheet-mobile.png), [email](design-prototypes/screenshots/option-1-tonal-email.png).

### Option 2: Wochenmarkt

**Idea.** Warm and editorial, like a good market stall and a well-made food magazine: paper surfaces, forest-olive green, beetroot and mustard, Fraunces over Figtree, line-drawn produce, kraft category tags.

{{TABLE:option-2-wochenmarkt}}

**Pros.**
- The brand green stays recognisable, but the site gains real character and warmth. The dark mode is espresso, not cold grey.
- Serif store names over sans rows carry cleanly into the app list, the email, store shots and a dark "chalkboard" Alexa card.
- The strong typographic hierarchy suits long content (guides, help pages) on hummlist.com.

**Cons.**
- Fraunces costs about 270 KB, and email falls back to Georgia, so the email loses most of the look.
- The produce drawings need an illustrator to cover all ten categories without looking amateur.
- Serif plus paper feels slower than a utility you open in the shop aisle. The paper texture also hides text contrast from axe (it had to be pixel-checked).

**Preview.** https://hummlist-site-git-design-36-prototypes-peter-trost.vercel.app/design-prototypes/option-2-wochenmarkt

| Mobile 390 | Desktop 1440 |
| --- | --- |
| ![Option 2 mobile](design-prototypes/screenshots/option-2-wochenmarkt-mobile.png) | ![Option 2 desktop](design-prototypes/screenshots/option-2-wochenmarkt-desktop.png) |

More: [mobile dark](design-prototypes/screenshots/option-2-wochenmarkt-mobile-dark.png), [desktop dark](design-prototypes/screenshots/option-2-wochenmarkt-desktop-dark.png), [token sheet](design-prototypes/screenshots/option-2-wochenmarkt-tokens-sheet-desktop.png), [token sheet dark](design-prototypes/screenshots/option-2-wochenmarkt-tokens-sheet-desktop-dark.png), [token sheet mobile](design-prototypes/screenshots/option-2-wochenmarkt-tokens-sheet-mobile.png), [email](design-prototypes/screenshots/option-2-wochenmarkt-email.png).

### Option 3: Hummel

**Idea.** Built from the name: Hummlist ≈ Hummel plus humming. Honey fills with ink text, a leaf-green tick, chunky sticker outlines, springy motion and a round bumblebee mark. Hum-waves tie it to Alexa and Siri.

{{TABLE:option-3-hummel}}

**Pros.**
- The most ownable brand. The mark and colour come out of the name, and a bee is easier to remember in a store listing than a generic basket.
- Honey with ink works the same on the app tile, store screenshots, the email header and Alexa cards. In dark mode the honey glows on night ink.
- Its radii (12 to 36, pills) are already close to the app's design H shapes (chips 22, sheet 28), so the app change is mostly colour and font.

**Cons.**
- Yellow can't be text on light backgrounds, so there are two roles: `honey` (fill) and `brand` (dark honey `#8a5800` for text and lines). The email preview shows the trap: a generic builder painting the header with `brand` gets brown, not honey.
- Sticker shadows and rotated stickers are fiddly in Flutter and APL, and they turn childish if used inside the app. Keep them for the site and store art.
- In dark mode the bee's ink outline disappears, so the mark needs a dark variant.

**Preview.** https://hummlist-site-git-design-36-prototypes-peter-trost.vercel.app/design-prototypes/option-3-hummel

| Mobile 390 | Desktop 1440 |
| --- | --- |
| ![Option 3 mobile](design-prototypes/screenshots/option-3-hummel-mobile.png) | ![Option 3 desktop](design-prototypes/screenshots/option-3-hummel-desktop.png) |

More: [mobile dark](design-prototypes/screenshots/option-3-hummel-mobile-dark.png), [desktop dark](design-prototypes/screenshots/option-3-hummel-desktop-dark.png), [token sheet](design-prototypes/screenshots/option-3-hummel-tokens-sheet-desktop.png), [token sheet dark](design-prototypes/screenshots/option-3-hummel-tokens-sheet-desktop-dark.png), [token sheet mobile](design-prototypes/screenshots/option-3-hummel-tokens-sheet-mobile.png), [email](design-prototypes/screenshots/option-3-hummel-email.png).

### Option 4: Kassenzettel

**Idea.** The shopping list as a well-set receipt: thermal-paper surfaces, black ink, one signal "Bonrot", IBM Plex Sans for reading and JetBrains Mono for figures and receipt lines. Square corners, dotted leaders, torn edges, hard offsets instead of soft shadows.

{{TABLE:option-4-kassenzettel}}

**Pros.**
- Privacy becomes the hero: "Werbung … keine", "Datenbank … Frankfurt a. M.", "Cookies … 0" as receipt lines. Those are the strongest true claims we have, set where people read them.
- It is the cheapest to carry everywhere. Flat colour, radius 0 to 4 and no blur map 1:1 to Flutter, HTML email (Helvetica plus Menlo still read as a receipt) and APL. Mono figures keep quantities aligned.
- It is unmistakable on a store page, nothing like a Material green app.

**Cons.**
- It is the largest brand change. Green becomes "success only", the icon would change, and design H's rounded chips and 28 px sheet would need restyling.
- Many mono labels can feel technical to non-technical family members. frontend-design lists "monospace for small data labels" as a tell; here it is the concept, but it needs discipline.
- Torn edges and leaders need care at small sizes and in Flutter (a CustomPainter).

**Preview.** https://hummlist-site-git-design-36-prototypes-peter-trost.vercel.app/design-prototypes/option-4-kassenzettel

| Mobile 390 | Desktop 1440 |
| --- | --- |
| ![Option 4 mobile](design-prototypes/screenshots/option-4-kassenzettel-mobile.png) | ![Option 4 desktop](design-prototypes/screenshots/option-4-kassenzettel-desktop.png) |

More: [mobile dark](design-prototypes/screenshots/option-4-kassenzettel-mobile-dark.png), [desktop dark](design-prototypes/screenshots/option-4-kassenzettel-desktop-dark.png), [token sheet](design-prototypes/screenshots/option-4-kassenzettel-tokens-sheet-desktop.png), [token sheet dark](design-prototypes/screenshots/option-4-kassenzettel-tokens-sheet-desktop-dark.png), [token sheet mobile](design-prototypes/screenshots/option-4-kassenzettel-tokens-sheet-mobile.png), [email](design-prototypes/screenshots/option-4-kassenzettel-email.png).

### Option 5: Frische

**Idea.** Bold graphic colour blocking like a fresh grocery brand's poster: oversized Bricolage Grotesque headlines, cobalt, mint, tomato and lemon fields on a strict grid, with the phone overlapping the blocks. The app itself stays calm, and only small category markers carry colour.

{{TABLE:option-5-frische}}

**Pros.**
- The most energetic and memorable site. Each section is its own colour field, which suits store screenshots well (lemon field, headline, phone).
- Every pairing passes AA in both modes. The rule "fields carry dark text, never small coloured text on white" is easy to keep in Flutter.
- The ten category colours give the app a useful, subtle wayfinding cue.

**Cons.**
- The loud site is a big step from the quiet app, so the two may feel like different brands unless the store screenshots bridge them.
- Email loses Bricolage (Helvetica fallback), so mail headlines look generic.
- Four field colours plus ten category colours need discipline, or later pages turn into a fruit salad.

**Preview.** https://hummlist-site-git-design-36-prototypes-peter-trost.vercel.app/design-prototypes/option-5-frische

| Mobile 390 | Desktop 1440 |
| --- | --- |
| ![Option 5 mobile](design-prototypes/screenshots/option-5-frische-mobile.png) | ![Option 5 desktop](design-prototypes/screenshots/option-5-frische-desktop.png) |

More: [mobile dark](design-prototypes/screenshots/option-5-frische-mobile-dark.png), [desktop dark](design-prototypes/screenshots/option-5-frische-desktop-dark.png), [token sheet](design-prototypes/screenshots/option-5-frische-tokens-sheet-desktop.png), [token sheet dark](design-prototypes/screenshots/option-5-frische-tokens-sheet-desktop-dark.png), [token sheet mobile](design-prototypes/screenshots/option-5-frische-tokens-sheet-mobile.png), [email](design-prototypes/screenshots/option-5-frische-email.png).

## (c) Recommendation

**Go with option 3, Hummel, as the brand, built with option 1's discipline.** If Peter wants no app change this year, option 1 is the fallback.

Why Hummel:
- **The name already does the work.** "Hummlist" invites the bumblebee, and the other four options ignore it. A bee mark plus honey is the one identity among the five that someone would remember from a store listing or an Alexa card, and it ties to the voice features ("hum") that set Hummlist apart.
- **It is the smallest real change to the app.** Design H's shapes (radius 22 chips, 28 sheet, 26 input pill) are already round, and option 3's scale is 12/20/28/36/full. The app change is the ColorScheme, a bundled Nunito, and honey for the add disc and the active tab. The layout, spacing and motion from design H stay.
- **It spans the surfaces.** Honey with ink holds on white email, a dark Echo Show, the iOS home screen and a store screenshot alike, and its contrast is generous (ink on honey 11.13:1).

What to take from option 1: generate the app's roles instead of hand-picking them, keep the M3 component structure, and keep the stickers out of the app.
- Sticker shadows, rotation and Baloo 2 stay on the site, store art and email header.
- The app uses Nunito, flat tonal surfaces and the `honey`/`brand` split, with the leaf green for ticks.

What I'd leave out:
- Option 4's receipt is the best-crafted direction and has the strongest privacy story. It is also the largest brand change and reads as a tool for techies.
- Options 2 and 5 are strong websites that would drift away from the app.

**Peter decides.**
- Is a bee too playful for how you want Hummlist to feel? If so, option 4 is my second choice, and option 1 the zero-cost one.
- Should the icon change? Option 3 brings its own mark (`option-3-hummel/assets/mark.svg`).

## (d) Proposal: one Hummlist design system

Built and run in this job, so this is not speculation. One DTCG file produced CSS, Dart and email for five token sets.

1. **Source of truth:** `design/tokens/hummlist.tokens.json` in the repo, DTCG 2025.10. Colours sit under `color.light.*` and `color.dark.*` with identical keys, and there are groups for font, type, space, radius, shadow and motion. Add the brand fill pair (`brand-fill`/`on-brand-fill`) next to `brand` (text and lines), which option 3's email exposed. Every font records its licence and source in `$extensions["com.hummlist"]`. A `hummlist.resolver.json` documents the light/dark modifier for tools that read resolvers. Style Dictionary does not yet.
2. **Build:** `design/tokens/build.mjs`, using Style Dictionary 5.7.1 with two custom formats. They exist already as `_tools/build-css.mjs` and `_tools/build-dart.mjs`. The colour normaliser (`_tools/normalize-colors.mjs`) lets people write hex while the file stays DTCG.
   - **Flutter:** `app/lib/app/tokens.g.dart` holds a `HummlistTokens` ThemeExtension (light and dark), a `ColorScheme` built from it, and `HummlistType`, `HummlistSpace`, `HummlistRadius`, `HummlistMotion`. `appTheme()` in `app/lib/app/theme.dart` builds its ThemeData from these instead of `colorSchemeSeed`. If option 1 is chosen, keep `fromSeed`, export the seed's roles into the token file (`_tools/m3-scheme.mjs`, identical to Flutter's output), and generate only the extension. Add `lib/app/tokens.g.dart` to the analyzer's `exclude` list, or make the generator emit lint-clean code. Bundle the fonts as assets (OFL).
   - **Website:** `site/public/tokens.css` holds `--hl-*` custom properties, with dark under `prefers-color-scheme`. `styles.css` uses only those, plus self-hosted woff2 under the existing CSP.
   - **Emails:** a flat light-mode JSON for templates that inline literal hex and system font stacks (`_tools/build-email.mjs` shows the result). It feeds `supabase/templates/*.html` once the auth emails get custom templates (`config.toml` has them commented out today). An optional `prefers-color-scheme` block helps Apple Mail and Outlook apps only.
   - **Store screenshots:** an HTML/CSS frame page per screenshot (headline, phone with a real app capture), styled by `tokens.css` and rendered with Playwright at the store sizes. This is the same tooling as `check.mjs --shots`.
   - **Alexa:** today's Simple cards are text only, so nothing to do. For a branded card, render the 720×480 and 1200×800 card image with the same Playwright frame. If APL comes, emit an APL `resources` block (colours and dimensions, with a `when: viewport.theme == 'light'` override) from the same file.
3. **Gate:** a `scripts/gates/tokens.sh` CI gate (the repo rule: checks live in gate scripts). It regenerates every output and fails on a diff, and it runs the fg/bg contrast pairs from `check.mjs` in both modes, so no stale token or AA regression lands. The site gate's `check.mjs`-style CSP/axe crawl can cover hummlist.com pages too.
4. **Agent skills for design work:** add a project skill `.claude/skills/hummlist-design/` (mirrored to `.cursor/skills/`), modelled on Anthropic's `brand-guidelines`.
   - It holds a short SKILL.md: the token roles and where each applies, the fill-versus-text rule, the surfaces, and "edit tokens.json, never generated files".
   - Its references are impeccable's `android`/craft-floor rules for the app, frontend-design's tell list for web and store art, and a pinned copy of Vercel's guidelines.
   - Its scripts are the build and check tools from `_tools/`.
   - impeccable's `DESIGN.md` becomes `docs/design/DESIGN.md`, next to the existing design history.

## Files

- `design-prototypes/index.html`, `gallery.css`, `thumbs/` hold the gallery.
- `design-prototypes/option-*/` holds the five prototypes.
- `design-prototypes/screenshots/` has 45 PNGs: per option the homepage and token sheet at mobile and desktop in light and dark, plus the email.
- `design-prototypes/flutter-preview/*.g.dart` and `design-prototypes/email-preview/*.html` are the generated Flutter and email sides.
- `design-prototypes/_tools/`:
  - `check.mjs`, `contrast-review.mjs`, `preview-check.mjs` check the prototypes.
  - `build-css.mjs`, `build-dart.mjs`, `build-email.mjs`, `normalize-colors.mjs`, `m3-scheme.mjs` build the outputs.
  - `publish.mjs` and `thumbs.mjs` publish the preview.
  - `summarize.mjs` writes the token tables above.
  - `BRIEF.md` is the brief the five option builders worked from. `generators/` holds the page generators options 1, 2 and 4 used (option 5's is in its own `_build/`).
- `design-prototypes/_research.md` has the full research notes with every URL.
