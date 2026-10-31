# Brief for one Hummlist homepage prototype

You build ONE design direction for hummlist.com as a static prototype. Four other agents build the other four directions in parallel, in sibling folders. Peter (the owner) compares all five on Saturday 2026-10-31 at 12:00. The build must be finished, and pass the checker, by Saturday 06:00 CET at the latest. Aim to finish in about 2 to 3 hours.

## The product (facts only; do not invent features)

Hummlist is a shared grocery list for one household (a couple or a family). Facts you can use:

- One list for the whole household. What one person adds or ticks off shows up on everyone's phone immediately (live sync). Works offline and catches up.
- Fast capture: open the app and type; the input field is focused at once. The input sits at the bottom ("Was brauchst du?"). Suggestions come from what you bought before.
- Automatic sorting: every item lands in its category on its own (Obst & Gemüse, Brot & Backwaren, Kühlregal, Fleisch/Wurst/Fisch, Vorrat & Konserven, Süßes & Snacks, Getränke, Tiefkühl, Haushalt, Drogerie). It learns from corrections: move "Hafermilch" once and it stays there.
- Stores: dm, Lidl and Edeka are set up, each with its own aisle order ("Laufweg"); the list is grouped by store and sorted in the order you walk through it. Hummlist remembers which store you usually buy an item at. You can add your own stores and reorder categories.
- Tap ticks an item off (with undo). Recently used items are one tap away to re-add.
- Voice: Alexa skill "Hummlist" (German): "Alexa, sag Hummlist, füg Milch und Eier hinzu", "Alexa, frag Hummlist, was auf der Liste steht". Siri via an iPhone Shortcut ("Hey Siri, Einkaufsliste", then speak "Milch, zwei Gurken und Klopapier"). In-app dictation too.
- Invite your partner with a link or code (valid 7 days).
- Also works with AI assistants such as Claude or ChatGPT over MCP (optional, a minor point).
- Platforms: iPhone, Android, and in the browser at app.hummlist.com.
- Privacy (true statements only): no ads, no data selling ("Hummlist zeigt keine Werbung und verkauft keine Daten"); the database is in Frankfurt am Main; usage data only if you agree (opt-in), switchable off any time; export all your data as JSON; delete your account in the app. The website sets no cookies and loads nothing from other servers.
- Status: closed test for family and friends (TestFlight / Google Play internal test). No prices: do not mention pricing, free or paid.

Brand: always **Hummlist** (double m). Never "Humm" alone, never "Humlist", never "HummList". The current app icon is a white shopping basket on green #2E7D32 (you may redraw a mark in your direction's style as an SVG file, but keep it recognisably a list/basket app). The name evokes "Hummel" (bumblebee) and humming; you may use that if it fits your direction.

Copy: German (de-DE), natural, du-form, short sentences, like the app ("Was brauchst du?", "Tippe unten ein, was fehlt."). No marketing filler ("revolutionär", "nahtlos"). Use real typographic quotes „…“ and the umlauts.

## What to build

Folder: `/workspace/hummlist/research/design-prototypes/<your option folder>/` with:

- `index.html`: the homepage, mobile-first, responsive to desktop (390 px to 1440 px+). Sections: header with the Hummlist mark, hero (headline, one-line subline, a visual: e.g. a phone mock of the list, built in HTML/CSS or SVG), "what it does" (shared list with live sync; stores and Laufweg sorting with automatic categories; Alexa and Siri; privacy), app-store badges as plain placeholders (styled boxes/links to `#` with text like "Bald im App Store" / "Bald bei Google Play"; no Apple/Google logos, no real store links), a "Im Browser öffnen" placeholder link to `#`, footer with Impressum and Datenschutz links to `#` (and Hilfe to `#` if you like).
- `tokens-sheet.html`: the token sheet, a second page linked from the index footer or header. It shows: colour swatches (light and dark, with hex and the role name, and the contrast ratio of each on-/text pair), the type ramp with font names and license, spacing scale, radius scale, elevation, motion (durations/curves listed; an optional CSS transition demo on hover/focus is fine, honour prefers-reduced-motion), AND a mock app list screen (phone frame) in this style AND a transactional email header mock (e.g. "Lea hat dich zu Hummlist eingeladen" invite email, or a sign-in link email) AND optionally a store-screenshot frame and an Alexa card mock. These show Peter that one token set spans app, site, email, store screenshots and Alexa.
- `styles.css`: page styles. Use ONLY the `--hl-*` custom properties from tokens.css for colours, type, space, radius, shadow and motion (local, page-specific values like a grid width are fine).
- `tokens.json`: your design-token set in DTCG 2025.10 format (see Tokens below).
- `tokens.css`: GENERATED, never hand-edited: `node _tools/build-css.mjs <your folder>`.
- `fonts/`: self-hosted woff2 files plus their license file(s) (OFL.txt or LICENSE). Only OFL-1.1 or Apache-2.0 fonts. Get them from fontsource on npm: `cd /tmp/<your-slug>-fonts && npm pack @fontsource-variable/<name>` (or `@fontsource/<name>` for static weights), untar in that /tmp dir, copy only the `files/*-latin-*.woff2` you use (latin covers äöüß„“) and the package's LICENSE into your fonts/. Use at most 2 families (3 if one is mono), and keep the folder under 1.5 MB total (aim for under 600 KB).
- `assets/`: SVG files (mark, illustrations, icons). No raster images unless tiny. No external URLs inside SVGs.

## Hard constraints (the preview serves `Content-Security-Policy: default-src 'self'`)

- No `<style>` elements, no `style=""` attributes, no `<script>`, no inline event handlers, no `javascript:` URLs. No JS at all.
- No external URLs anywhere (no CDN, no Google Fonts, no remote images); no `data:` URLs; no `@import` in CSS (link tokens.css then styles.css with two `<link rel="stylesheet">`).
- Every page: `<html lang="de">`, `<meta charset="utf-8">`, `<meta name="viewport" content="width=device-width, initial-scale=1">`, `<meta name="robots" content="noindex">`, a `<title>`.
- Light and dark via `prefers-color-scheme` (tokens.css does this; your styles must look right in both). Honour `prefers-reduced-motion`.
- WCAG 2.1 AA: text contrast 4.5:1 (3:1 for large text), UI parts 3:1, visible focus styles, real headings in order, landmarks (header, main, footer, nav). The site build (site/build.mjs) also fails a page that has not exactly one `<h1>`, skips a heading level (the first heading must be the h1), or has an `<img>` without non-empty alt text: so every `<img>` gets real alt text, and decorative art goes in a CSS `background-image` or an inline `<svg aria-hidden="true">` (no style attributes inside it). check.mjs enforces this.
- No horizontal scrolling at 390 px.
- Relative links only (`tokens-sheet.html`, `#`), because the folder is served under `/design-prototypes/<folder>/`.

## Tokens (tokens.json)

Start from `_tools/tokens.template.json` (it shows the exact shape; its values are Material 3 from the current app, replace them with yours unless you are option 1). Rules:

- DTCG 2025.10 format: `$type`, `$value`, `$description`; dimensions `{ "value": 16, "unit": "px" }` (or rem); durations `{ "value": 200, "unit": "ms" }`; `cubicBezier` arrays; `typography` composites; `shadow` arrays. Colours: write them as `"#rrggbb"` strings (or `#rrggbbaa` in shadows) and then run `node _tools/normalize-colors.mjs <your folder>`, which rewrites them into the DTCG colour object form.
- `color.light` and `color.dark` with IDENTICAL keys. Required keys in both: brand, on-brand, accent, on-accent, surface, surface-raised, text, text-muted, border, success, on-success, warning, on-warning, error, on-error. Add more if your direction needs them (e.g. brand-container, surface-sunken, highlight); list extra fg/bg pairs to check in `$extensions["com.hummlist"].contrastPairs` as `[fg, bg, minRatio]`.
- Required groups: `font.family` (each family with `$extensions["com.hummlist"]` = { license, source, files }), `font.weight`, `type` (at least display, headline, title, body, label; add caption etc. if used), `space` (scale), `radius` (scale), `shadow` (at least 2 levels; a "flat" direction may use subtle borders but still define them), `motion.duration` and `motion.easing`.
- Set `$extensions["com.hummlist"].option` to your folder name and `$description` to your one-line idea.
- Think about the other surfaces: the same tokens must map to Flutter (ThemeData/ColorScheme/TextTheme/ThemeExtension), HTML email (inlined hex values; system font fallbacks since most mail clients ignore webfonts) and Alexa APL. Prefer a font family that Flutter can bundle (OFL/Apache) and give a sensible fallback stack.
- Store badge colours (dm `#ffffff`/`#d6001c` "dm", Edeka `#1d4ea3`/`#ffd400` "E", Lidl `#0050aa`/`#fff000` "L") are fixed and outside the token set; use them in the mock list screen as small rounded squares with the letter.

## The mock app list screen

Mirror the real app's layout (design "H"): header with the household name in small caps and "15 Artikel"; stores as section dividers (store badge, store name, a rule in the store's colour, item count); faded uppercase category dividers ("OBST & GEMÜSE", "KÜHLREGAL"); full-width rows with a small leading emoji and the item name (quantity prefix like "2×" in brand colour; optional second line like "Babylove · 4er Pack"); no checkboxes, no cards; the input pill at the bottom "Was brauchst du?" with a "+" disc; two tabs "Liste" and "Mehr". Restyle it in your direction (type, colour, radius), but keep that structure. Use German example items (Bananen, Hafermilch, Vollkornbrot, 2× Gurken, Spülmittel, Windeln "Pampers · Größe 3", Zahnpasta...).

## Verify (mandatory)

Run `cd /workspace/hummlist/research/design-prototypes/_tools && node check.mjs ../<your folder> --shots`. It serves your folder behind the real CSP and checks: tokens.json shape and contrast pairs (light and dark), tokens.css equals the generated output, no inline style/script, no external or data URLs, noindex, lang, brand spelling, size, then in Chromium (light and dark, 390 and 1440): no CSP violations, no failed or off-origin requests, all fonts loaded, no horizontal overflow at 390, axe-core WCAG 2.1 AA with zero violations. It writes screenshots to `../screenshots/<folder>-*.png`. It must end with "all checks passed". Then LOOK at your screenshots (Read the PNGs: mobile, desktop, dark, token sheet) and fix what looks broken, cramped or bland; re-run. Don't stop at "passes": it must look like a credible, polished, distinct direction that a designer would be proud to show.

Do not touch any other option's folder, `_tools/` (except reading), the screenshots of other options, or any git repository. Do not install packages globally. Do not start long-running servers.

## Report back

Reply (≤ 25 lines) with: folder; the one-line idea; fonts with license and source; the key colour tokens (light/dark brand, accent, surface, text); type scale summary (sizes/line-heights); spacing, radius and motion summary; 3 pros and 3 cons of this direction for Hummlist (app + site + email + store screenshots + Alexa); the checker's final line; the list of screenshot files.
