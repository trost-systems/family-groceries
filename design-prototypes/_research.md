# Design guidance, agent skills and token pipeline: research for Hummlist

Researched 2026-10-30. Every fact below comes from a page fetched that day. Popularity numbers are copied from the page named next to them. "Not shown" means the fetched page did not show a number. Where a summarizing fetch and raw data disagreed (caniemail), the raw data wins and the note says so.

Hummlist context: Flutter app on Material 3 `ColorScheme.fromSeed(seedColor: Color(0xFF2E7D32))`, static site hummlist.com, transactional email, store screenshots, Alexa skill with cards.

## 1. Anthropic

### anthropics/skills: frontend-design

- URL: https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md (raw file read; the fetch tool paraphrased it, it did not return it verbatim)
- Prescribes:
  - Write a short design plan first: color, type, layout (with ASCII wireframes), principles. Review it against the brief and revise any part that reads as a generic default.
  - Name the core palette as 4 to 6 hex values. Avoid the stock AI palettes: cream background with terracotta accent, near-black with one acid-green or vermilion accent, tinted near-blacks such as `#111` used in place of black. Avoid the Anthropic clay accent unless the brief asks for it.
  - One type family, or two clearly distinct ones. Choose faces on purpose, set a clear scale and weights. Line length under about 80 characters. Serif body text gets slightly more line-height.
  - Motion: one orchestrated moment beats scattered effects. No fade-and-slide on every section, no hover effect on every card. Motion that answers a user action is welcome. Respect reduced motion.
  - Layout: borders, dividers, numbering and labels must carry information. Numbered markers only for real sequences. Avoid the SaaS card kit (identical rounded cards, uniform radii, soft shadows, gradient washes) and the "big number, small label, gradient accent" hero.
  - Banned tells: accenting one headline word, all-caps or tracked eyebrow labels, middle-dot meta strings, "WORD, fragment" labels with spaced dashes, monospace for small data labels, arrows appended to link text.
  - Quality floor: responsive, visible focus states, accessible contrast. Concentrate boldness in one element.
  - Copy is design: plain words, active voice, consistent action names, errors that say what happened and how to fix it without apologizing, empty states that invite action, sentence case.
- Popularity: skills.sh leaderboard rank 15, 1.1M installs (https://skills.sh). Repo anthropics/skills 185.1k stars, 21.9k forks (https://github.com/anthropics/skills). skills.sh skill page shows 1.1M installs, 184.8K stars, first seen Jan 19, 2026 (https://skills.sh/anthropics/skills/frontend-design).
- Takeaway: The most reusable rulebook for Hummlist's website, emails and store-screenshot frames. It is web-first (HTML/CSS/React) and says nothing about Flutter or Material roles, so the app needs a Material-specific layer next to it. Its banned-tells list and "palette as 4 to 6 named hex values" fit directly into a Hummlist design brief.

### anthropics/skills: other design-related skills

- URL: https://api.github.com/repos/anthropics/skills/contents/skills (19 entries). Design-related ones present: `frontend-design`, `canvas-design`, `brand-guidelines`, `theme-factory`, `web-artifacts-builder`, `algorithmic-art`. Also `skill-creator` (skills.sh rank 187, 419.7K installs).
- `theme-factory` (https://raw.githubusercontent.com/anthropics/skills/main/skills/theme-factory/SKILL.md):
  - 10 preset themes (Ocean Depths, Forest Canopy, Botanical Garden, and so on), each a hex palette plus a header/body font pairing in `themes/`.
  - Show the showcase PDF, ask the user to pick, wait for confirmation, apply colors and fonts consistently, check contrast. Can generate a custom theme from a description.
- `brand-guidelines` (https://raw.githubusercontent.com/anthropics/skills/main/skills/brand-guidelines/SKILL.md):
  - Anthropic's own brand: `#141413`, `#faf9f5`, `#b0aea5`, `#e8e6dc`, accents `#d97757`, `#6a9bcc`, `#788c5d`. Poppins headings (24pt and up), Lora body. Applied through python-pptx `RGBColor`.
  - Useful only as a template for the shape of a brand skill (named colors, font roles, application rules).
- `canvas-design` (https://raw.githubusercontent.com/anthropics/skills/main/skills/canvas-design/SKILL.md):
  - Two steps: write a 4 to 6 paragraph design philosophy (.md), then a single-page PDF or PNG that is about 90% visual, 10% text.
  - Nothing overlaps or falls off the page. Fonts from `./canvas-fonts`. Final pass refines, never adds.
- `web-artifacts-builder` (https://raw.githubusercontent.com/anthropics/skills/main/skills/web-artifacts-builder/SKILL.md):
  - React 18, TypeScript, Vite, Tailwind 3.4.1, shadcn/ui; `scripts/init-artifact.sh` and `scripts/bundle-artifact.sh` (Parcel, single `bundle.html`).
  - Design rule: avoid centered layouts everywhere, purple gradients, uniform rounded corners, Inter.
- `algorithmic-art`: present in the listing; its SKILL.md was not read.
- Popularity: per-skill installs for these were not on the visible leaderboard rows (not shown).
- Takeaway: `brand-guidelines` is the model for a Hummlist brand skill: a short file with named colors, font roles and where each applies. `canvas-design` fits store-screenshot backgrounds and social images. `theme-factory` and `web-artifacts-builder` do not fit (preset themes, React artifact bundling).

### Agent Skills documentation

- URL: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview (docs.claude.com redirects here with 302).
- Prescribes:
  - `SKILL.md` with YAML frontmatter. `name`: at most 64 characters, lowercase letters, digits, hyphens; no XML tags; must not contain `anthropic` or `claude`. `description`: non-empty, at most 1,024 characters, says what the skill does and when to use it.
  - Progressive disclosure: metadata about 100 tokens per skill always loaded; SKILL.md body under 5k tokens when triggered; bundled files and scripts cost nothing until read or run (script code never enters context, only output).
  - Claude Code skills live in `~/.claude/skills/` (personal) or `.claude/skills/` (project), or ship in plugins.
  - Security: use skills only from trusted sources; audit bundled scripts; skills that fetch external URLs are a risk because fetched content can carry instructions.
- Popularity: not applicable.
- Takeaway: A Hummlist design skill should be a short SKILL.md plus reference files (tokens, banned patterns, per-surface notes) and a script that checks contrast or regenerates tokens. The security note matters: `web-design-guidelines` (below) fetches its rules from GitHub at run time.

## 2. Skill marketplaces and popular design skills

### skills.sh leaderboard (design rows)

- URL: https://skills.sh (fetched; many ranks collapsed into "+N more" groups, so names in those groups are not shown).
- Design and UI rows with installs as shown:
  - 11 `design-mobile-apps` (designed-by-ai/skills) 1.1M. Its skill page (https://skills.sh/designed-by-ai/skills/design-mobile-apps) shows a REST API guide for sleek.design, not design rules; 21 GitHub stars.
  - 15 `frontend-design` (anthropics/skills) 1.1M.
  - 30 `vercel-react-best-practices` 855.5K; 31 `ui-taste` (uizze.sh) 846.5K; 56 `web-design-guidelines` (vercel-labs/agent-skills) 805.0K.
  - 72 `design-taste-frontend` (leonxlnx/taste-skill) 705.5K; 152 `high-end-visual-design` 458.8K; 178 `minimalist-ui` 425.1K.
  - 180 `ui-ux-pro-max` (nextlevelbuilder/ui-ux-pro-max-skill) 424.9K.
  - 191 `ios-design` (uizze.sh) 417.1K; 199 `emil-design-eng` (emilkowalski/skills) 402.1K; 272 `review-animations` 268.5K; 277 `apple-design` 257.7K.
  - 233 `impeccable` (pbakaus/impeccable) 373.5K; 271 `shadcn` (shadcn/ui) 271.1K.
- Takeaway: Install counts measure reach, not fit. The top "design" row is an API client for a paid service. `ui-taste`, `ios-design`, `emil-design-eng` and `apple-design` were not opened, so their rules are not reported here.

### nextlevelbuilder/ui-ux-pro-max-skill

- URLs: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill, https://raw.githubusercontent.com/nextlevelbuilder/ui-ux-pro-max-skill/main/.claude/skills/ui-ux-pro-max/SKILL.md
- Prescribes:
  - A searchable dataset (README counts): 79 styles (50 active), 192 palettes, 74 font pairings, 25 chart types, 119 UX guidelines, 22 stacks including Flutter (`--stack flutter`).
  - `scripts/search.py "<product> <industry> <keywords>" --design-system -p "Name"` (Python stdlib, no network) emits a design system; `--persist` writes `design-system/<project>/MASTER.md` with per-page overrides.
  - Priority table: 1 accessibility (contrast 4.5:1, labels on icon buttons, keep focus rings); 2 touch (44x44 px targets, 8 px spacing, loading feedback, no hover-only actions); 3 performance (CLS < 0.1); 5 layout (mobile first, no horizontal scroll, never disable zoom); 6 type and color (16 px base, 1.5 line height, semantic color tokens, no raw hex in components); 7 motion (no single duration for everything, reduced motion); 8 forms (visible labels, errors at the field); 9 navigation (bottom nav at most 5 items, predictable back, deep links).
  - Pre-delivery checklist lives in `references/pro-rules.md` (not read): icons, interaction feedback, light and dark contrast, safe areas, accessibility.
- Popularity: 142,944 stars, 15,131 forks (https://api.github.com/repos/nextlevelbuilder/ui-ux-pro-max-skill); 424.9K installs on skills.sh.
- Takeaway: The priority table is a sound checklist and it knows Flutter. The palette and style generator would push a generic industry palette onto Hummlist, which already has a seed color and needs its own identity. Use the checklist, skip the generator.

### leonxlnx/taste-skill (design-taste-frontend)

- URLs: https://github.com/leonxlnx/taste-skill, https://raw.githubusercontent.com/leonxlnx/taste-skill/main/skills/taste-skill/SKILL.md
- Prescribes:
  - Process: inventory the subject, write each section as a claim with proof, run `draw.mjs` to deal three directions from 20, record any redraw with a reason. Never invent customers, reviews or numbers.
  - Type: headlines at most two lines (about 32 characters); display tracking -0.02 to -0.05em, leading 0.85 to 1.05; body 16 to 20 px, leading 1.45 to 1.6, 45 to 75 characters; at most five sizes; left-aligned by default.
  - Color: one ground, one ink, one accent used on the action. Running text in full ink, not grey. Surfaces separated by small tone steps, no lines or shadows. No gradients or glows. Banned: cream with terracotta, violet or indigo.
  - Layout: equal outer margins 16 to 32 px; no card grids; flat buttons; plain nav bar (wordmark, 3 to 5 links, one action).
  - Banned: eyebrow labels and pill badges, monospace outside code, index numbering, hairlines, emoji, icon-topped identical cards, accent words in headlines.
  - Motion: at least eight animated elements on load and scroll (staggered 60 to 90 ms, 16 to 32 px rise), transform and opacity only, reduced-motion fallback.
  - Checks: `lint.mjs` for banned patterns, `inspect.mjs` screenshots at 1440, 768, 390 px and measures type, contrast, overflow, margins; fix the top three problems, up to three rounds; final gate on the production build.
- Popularity: 106,174 stars (https://api.github.com/repos/leonxlnx/taste-skill); skills.sh skill page shows 704.8K installs and 105.5K stars (https://skills.sh/leonxlnx/taste-skill/design-taste-frontend). The other taste-* rows on the leaderboard now live in `taste-skill-classics` and `imagegen-skills` per the README.
- Takeaway: Built for landing pages and portfolios. Its scripted browser check at three widths is the strongest idea for hummlist.com. The motion floor (eight or more animated elements) conflicts with a calm grocery-list brand; adopt the type and color numbers, not the motion rule.

### pbakaus/impeccable

- URLs: https://github.com/pbakaus/impeccable, https://raw.githubusercontent.com/pbakaus/impeccable/main/.claude/skills/impeccable/SKILL.md, `.../reference/craft-floor.md`, `.../reference/android.md`
- Prescribes:
  - 24 commands: steer (`bolder`, `quieter`, `distill`, `colorize`, `typeset`, `layout`, `animate`, `delight`), review (`critique`, `audit` with P0 to P3), finish (`polish`, `harden`, `clarify`, `adapt`, `optimize`, `onboard`), setup (`init` writes `PRODUCT.md`, `document` writes `DESIGN.md`, `extract`).
  - `npx impeccable detect <dir|url>`: 62 deterministic rules (Inter everywhere, purple-blue gradients, nested cards, grey text on color, cramped padding, skipped heading levels). Exit 2 on findings. Contrast rules need a rendered page.
  - Craft floor: body text 4.5:1, large 3:1; secondary text on color tinted from the hue, never grey; 65 to 75ch measure; display max 6rem; tracking no tighter than -0.04em; one authored motion moment with exponential ease-out; every state designed (hover, disabled, loading, error, empty). Absolute ban: eyebrow labels. Avoid colored side borders over 1 px, nested cards, hero-metric template, emoji as icons, glass as decoration.
  - Android reference: map text to Material type roles, never hand-picked sizes; sp units; Material color roles, not raw hex; dark theme designed as its own scheme; tonal surface levels instead of ad-hoc shadows; touch targets at least 48x48 dp with 8 dp gaps. Flutter is named in scope; no Flutter-specific rules.
- Popularity: 96,751 stars (https://api.github.com/repos/pbakaus/impeccable); 373.5K installs on skills.sh.
- Takeaway: The only popular skill with native (iOS and Android) references and a deterministic detector. `DESIGN.md` as a per-project record matches what Hummlist needs. The detector targets web markup, so for the Flutter app only the `android` and `craft-floor` references transfer.

## 3. Vercel

### Web Interface Guidelines and the web-design-guidelines skill

- URLs: https://vercel.com/design/guidelines, https://github.com/vercel-labs/web-interface-guidelines, https://raw.githubusercontent.com/vercel-labs/agent-skills/main/skills/web-design-guidelines/SKILL.md
- Prescribes (selection):
  - Visible focus ring via `:focus-visible`; hit targets at least 24 px, 44 px on mobile; inputs at least 16 px on mobile so iOS Safari does not zoom; never disable zoom or paste.
  - Spinner show-delay 150 to 300 ms, minimum visible 300 to 500 ms; optimistic updates with rollback or Undo; confirm destructive actions or offer Undo.
  - `prefers-reduced-motion` variant; animate `transform` and `opacity` only; never `transition: all`.
  - Curly quotes, the ellipsis character, `tabular-nums` for compared numbers, non-breaking spaces in `10&nbsp;MB`; brand names in `translate="no"`; locale-formatted dates and numbers, language from `Accept-Language`, never IP.
  - Dark mode: `color-scheme: dark` on `<html>`, `theme-color` meta matches the page background; set `background-color` and `color` on native `<select>`.
  - Prefer APCA over WCAG 2 for contrast; hover, active and focus more contrasted than rest; child radius at most parent radius; tint borders and shadows toward the background hue.
  - The skill fetches `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md` at each run and reports findings as `file:line`.
- Popularity: `web-design-guidelines` 805.0K installs (skills.sh rank 56). vercel-labs/agent-skills 33,254 stars; vercel-labs/web-interface-guidelines 1,066 stars (GitHub API).
- Takeaway: The best review checklist for hummlist.com and any web build of the app. Optimistic updates with Undo already match Hummlist's `ItemOp` design. Pin a copy of `command.md` instead of fetching it live, per the security note in the Agent Skills docs.

### v0 design guidance

- URLs: https://v0.app/docs/design-systems (labelled a legacy registry workflow; it points to "Design Systems 2.0").
- Prescribes: bring a design system to v0 as a shadcn registry; keep shadcn CSS variable names; change colors in `src/app/tokens.css`; fonts via `--font-sans`, `--font-mono`, `--font-serif`; components and blocks as `registry-item`s; the shadcn MCP server with `REGISTRY_URL` gives editors the same context.
- No official v0 system prompt or v0 design rulebook was found. Search returned only third-party reverse-engineered DESIGN.md files (shadcn.io), which are not used here.
- Takeaway: Not relevant to a Flutter app. It confirms that the shadcn variable names are the de facto web token interface for AI tools.

## 4. shadcn/ui theming

- URLs: https://ui.shadcn.com/docs/theming, https://ui.shadcn.com/docs/registry/registry-item-json
- Prescribes:
  - Background/foreground pairs: the surface token has no suffix and the text token adds `-foreground` (`primary` / `primary-foreground`, used as `bg-primary text-primary-foreground`).
  - Variables: `background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive` (each with `-foreground` except destructive), `border`, `input`, `ring`, `chart-1` to `chart-5`, `sidebar-*`, `radius`.
  - Values in `oklch()` in the default theme. Dark mode overrides the same names under `.dark`; Tailwind v4 `@custom-variant dark (&:is(.dark *))`.
  - Radius scale derived from `--radius` (0.625rem): sm 0.6x, md 0.8x, lg 1x, xl 1.4x, 2xl 1.8x.
  - New color: define `--warning` and `--warning-foreground` under `:root` and `.dark`, expose via `@theme inline` as `--color-warning`.
  - Registry `registry:theme` items carry `cssVars` with `theme`, `light`, `dark` keys.
- Popularity: `shadcn` skill 271.1K installs (skills.sh rank 271). Repo stars not fetched (not shown).
- Takeaway: If hummlist.com and the email templates use CSS variables, name them as Material roles (`--md-sys-color-primary`, `--md-sys-color-on-primary`), not shadcn names: the app is the source of truth and Material already defines the pair convention (`primary` / `onPrimary`). The shadcn `light`/`dark` split is the same per-mode idea the token pipeline needs.

## 5. Material 3

### ColorScheme.fromSeed, DynamicSchemeVariant, material-color-utilities

- URLs: https://api.flutter.dev/flutter/material/ColorScheme/ColorScheme.fromSeed.html, https://api.flutter.dev/flutter/material/DynamicSchemeVariant.html, https://api.flutter.dev/flutter/material/ColorScheme-class.html, https://github.com/material-foundation/material-color-utilities
- Prescribes:
  - `fromSeed(seedColor, brightness = light, dynamicSchemeVariant = tonalSpot, contrastLevel = 0.0, ...overrides)`. `contrastLevel` runs -1.0 to 1.0; 0.5 is medium, 1.0 high. About 50 nullable overrides replace single roles.
  - The seed color may not appear in the result. `tonalSpot` (default) gives low-chroma pastel palettes even for a saturated seed. `fidelity` keeps palettes close to the seed. `content` is near `fidelity`, with `primaryContainer` set to the seed adjusted for contrast and an analogous tertiary. Others: `monochrome`, `neutral`, `vibrant`, `expressive`, `rainbow`, `fruitSalad`.
  - Roles: `primary`/`onPrimary`, `primaryContainer`/`onPrimaryContainer`, `primaryFixed`/`primaryFixedDim` (same in light and dark), `surfaceContainerLowest` to `surfaceContainerHighest` (tone-based replacement for elevation tint), `surfaceDim`, `surfaceBright`, `outline`, `outlineVariant` (dividers, no 3:1 needed), `inverseSurface` (SnackBar), `scrim`, `shadow`. On-colors should reach 4.5:1 with their pair.
  - material-color-utilities: HCT color space, tonal palettes, scheme generation, contrast, `score`, `quantize`. Dart, TypeScript, Java, Kotlin, Swift, C++.
- Popularity: material-color-utilities 2.3k stars, 220 forks (repo page).
- Takeaway: Hummlist's `#2E7D32` under `tonalSpot` will come out more muted than the brand green, and the green itself may not be any role. Decide on purpose between `tonalSpot` and `fidelity`/`content`. Since the web, email and Alexa need the same values, generate the scheme once (material-color-utilities in TypeScript or a Dart script calling `ColorScheme.fromSeed`) and export the resolved roles as tokens; do not re-derive by hand per surface.

### Material 3 tokens and Material 3 Expressive

- m3.material.io pages (`/foundations/design-tokens/overview`, `/styles/color/roles`) render with JavaScript; the fetch returned only titles. Not read.
- Secondary sources describe three token classes: reference (`md.ref.palette.primary40`), system (`md.sys.color.primary` pointing to a reference token) and component tokens (Medium article and an Angular Material article, both from search; m3 itself not confirmed).
- Material 3 Expressive in Flutter: no official Flutter documentation found. Only community packages on pub.dev (`material_3_expressive`, `material_expressive`, `m3e_design`), reported by search; not opened.
- Takeaway: Use the `md.sys.color.*` naming for exported tokens. Treat Expressive as out of scope for the Flutter app until Flutter ships it.

## 6. Design tokens: DTCG, Style Dictionary, Tokens Studio, Flutter generators

### W3C Design Tokens Community Group format

- URLs: https://www.designtokens.org/technical-reports/, https://www.designtokens.org/TR/2025.10/format/, https://www.designtokens.org/TR/2025.10/color/, https://www.designtokens.org/TR/2025.10/resolver/, https://www.designtokens.org/TR/drafts/format/
- Status: 2025.10 is the first stable version, published 2025-10-28 as a Final Community Group Report (not a W3C Standard). Three modules: Format, Color, Resolver. A preview draft dated 2026-09-08 exists and says not to implement it.
- Details in "Token pipeline facts" below.
- Takeaway: Author Hummlist tokens in DTCG 2025.10. It is stable, and both Style Dictionary 5 and `dtcg_theme` read it.

### Style Dictionary

- URLs: https://styledictionary.com/info/dtcg/, https://styledictionary.com/reference/hooks/formats/predefined/, https://styledictionary.com/reference/hooks/transform-groups/predefined/, https://styledictionary.com/reference/hooks/transforms/predefined/, https://github.com/style-dictionary/style-dictionary/releases, https://raw.githubusercontent.com/style-dictionary/style-dictionary/main/CHANGELOG.md, https://registry.npmjs.org/style-dictionary/latest
- Facts: latest npm version 5.7.1 (release page dated Oct 24). DTCG support since v4. The DTCG docs page still says 2025.10 "does not have full support yet" and is "a work in progress in v5"; the changelog shows it landing piece by piece (see pipeline facts).
- Popularity: repo stars not fetched (not shown).
- Takeaway: The standard tool for CSS output and a usable one for Dart. Its Flutter output is a flat class of constants, not a `ColorScheme`.

### Tokens Studio

- URL: https://docs.tokens.studio/
- Facts: a Figma plugin for tokens; supports "W3C DTCG vs Legacy" token formats; themes, multi-file sync and branch switching are marked pro; `sd-transforms` bridges to Style Dictionary.
- Popularity: not shown.
- Takeaway: Only relevant if Hummlist designs in Figma. With tokens authored as JSON in the repo, it is not needed.

### Flutter token generators

- `dtcg_theme` (https://pub.dev/packages/dtcg_theme): version 0.7.1, publisher bomsamdi.com (verified), 0 likes, 160 pub points, 228 downloads, published 60 days before the fetch.
  - Reads DTCG `.tokens.json` (from Figma Variables, Tokens Studio, Style Dictionary); config in `dtcg.yaml` (base files, modes, output, class name, `root_font_size`, optional `color_scheme`, `text_theme`, `contrast`).
  - Generates a `ThemeExtension` with one constant per mode (`AppTokens.light`, `AppTokens.dark`) with `copyWith`, `lerp`, `of`/`maybeOf`; optionally a `ColorScheme` and `TextTheme` per mode.
  - `dart run dtcg_theme --check` fails CI when the file is stale. The build fails on broken aliases, cycles, missing modes, and color pairs below the WCAG target.
  - Resolver documents are not mentioned on the page.
- `design_tokens_generator` (https://pub.dev/documentation/design_tokens_generator/latest/): seen only in search; the install section points to a placeholder git URL. Not evaluated.
- Takeaway: `dtcg_theme` fits Hummlist's shape best (per-mode `ColorScheme` plus a `ThemeExtension`, a CI check, contrast gate). Adoption is tiny (228 downloads, 0 likes), so the safe plan is Style Dictionary as the main pipeline, with `dtcg_theme` evaluated on a branch, or a small in-repo Dart generator.

## 7. Other AI design tooling

### Figma MCP server

- URL: https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Dev-Mode-MCP-Server (page title "Guide to the Figma MCP server").
- Facts: remote server at `https://mcp.figma.com/mcp` (recommended) or desktop server. Generates code from frames, extracts variables, components and layout data, Code Connect, writes to the canvas (remote, beta, will become usage-based). Desktop server needs a Dev or Full seat on a paid plan. Tool names were not on this page.
- Popularity: not shown.
- Takeaway: Only useful if Hummlist keeps its source of truth in Figma. It does not today.

### Google Stitch

- URL: https://stitch.withgoogle.com/ returned only its title ("Stitch - Design with AI").
- Third-party sources from search (not Google): a moda.app review says Stitch exports Flutter and Tailwind; a pasqualepillitteri.it post describes a Stitch MCP server and a `DESIGN.md` export. Neither confirmed against Google documentation.
- Popularity: not shown.
- Takeaway: Possibly useful to sketch screens, unverified. Do not plan on it.

### Refactoring UI-derived and other skills

- Not found with visible counts in the fetched pages. `emil-design-eng` (402.1K), `review-animations` (268.5K), `apple-design` (257.7K), `ui-taste` (846.5K) and `ios-design` (417.1K) appear on skills.sh; their content was not read.

## 8. Email and Alexa

### Design tokens in HTML email

- URLs: https://www.caniemail.com/features/css-at-media-prefers-color-scheme/, https://www.caniemail.com/features/css-variables/, raw data https://www.caniemail.com/api/data.json (parsed locally; the page summarizer misread Gmail as supported, the raw data says no).
- Facts (latest listed version per platform in the raw data):
  - `@media (prefers-color-scheme)`: 41.86% overall, last tested 2023-03-08. Yes in Apple Mail (macOS, iOS), Outlook macOS, Outlook.com, Outlook iOS and Android (these add `data-ogsc`/`data-ogsb` attributes in dark mode), Samsung Email, GMX and WEB.DE apps. No in every Gmail client, Outlook Windows, Yahoo, Thunderbird macOS, GMX/WEB.DE/T-Online webmail.
  - CSS custom properties: 45.24%, last tested 2020-02-25. Gmail supports `var()` but not the declaration (useless), Outlook no on all platforms, Apple Mail yes.
  - `<meta name="color-scheme">` (tested 2026-09-16): Apple Mail macOS yes, iOS no; Gmail apps only `light only`; Outlook no.
  - `<style>` in Gmail: partial (not in `<body>`, 16 KB limit, non-Google accounts in apps lack support).
- Takeaway: Email gets resolved literal hex values, inlined, from the light mode of the token set; CSS variables are out. A dark-mode block via `prefers-color-scheme` is a progressive extra for Apple Mail and Outlook apps. German webmail (GMX, WEB.DE, T-Online) ignores it, and Gmail inverts colors on its own, so pick a brand green and logo that survive inversion.

### Alexa cards and APL

- URLs: https://developer.amazon.com/en-US/docs/alexa/custom-skills/include-a-card-in-your-skills-response.html, https://developer.amazon.com/en-US/docs/alexa/alexa-presentation-language/apl-style-definition-and-evaluation.html, https://developer.amazon.com/en-US/docs/alexa/alexa-presentation-language/apl-resources.html
- Facts:
  - Simple card: `title`, `content`. Standard card: `title`, `text`, optional `image` with `smallImageUrl` (720x480) and `largeImageUrl` (1200x800), JPEG or PNG under 500 KB, HTTPS, CORS for `ask-ifr-download.s3.amazonaws.com`, public and non-expiring. Only line breaks as formatting. 8,000 characters combined. Shown in the Alexa app Activity page, and on screen devices when no APL is sent.
  - APL `resources`: blocks of `colors`, `dimensions`, `strings`, `easings`, `gradients`, each optionally gated by `when` (e.g. `${viewport.theme == 'light'}`); later blocks override earlier; reference with `@name`. Colors accept hex, names, `rgb()`. Dimensions accept `dp`, `px`, `vw`, `%`.
  - APL `styles`: `extends` plus ordered `values` with `when`, can read `state.pressed`, `state.disabled` and `viewport.theme`.
- Takeaway: Cards carry no brand color; the brand reaches them only through the card image (a PNG rendered from tokens). If Hummlist adds APL later, a token build can emit an APL `resources` block with a dark default and a `when: viewport.theme == 'light'` override.

## Worth adopting for Hummlist agents

1. **impeccable** (pbakaus/impeccable). The only popular skill with Android/Material rules (type roles in sp, color roles not hex, 48 dp targets, dark scheme designed separately) and a deterministic detector with an exit code. Its `PRODUCT.md`/`DESIGN.md` record gives every future agent the same brief. Evidence: 96,751 stars, 373.5K installs.
2. **anthropics frontend-design**. Short, concrete, and explicit about AI tells (stock palettes, eyebrow labels, card kits, accent words) that also show up in store screenshots and emails. Its copy rules (errors that name the fix, empty states that invite action) suit a German consumer app. Evidence: 1.1M installs, repo 185.1k stars.
3. **Vercel web-design-guidelines**, pinned. A file:line review checklist for hummlist.com and the Flutter web build: focus, target sizes, `color-scheme`/`theme-color`, tabular numbers, locale formatting, Undo for destructive actions. Vendor `command.md` into the repo instead of fetching it each run. Evidence: 805.0K installs.
4. **ui-ux-pro-max priority table only** (optional). A ranked checklist that names Flutter as a stack. Skip its palette/style generator, which would override the Hummlist brand. Evidence: 142,944 stars, 424.9K installs.

Not adopted: taste-skill (landing-page focus, motion floor of eight-plus animated elements), theme-factory (preset themes), design-mobile-apps (API client for sleek.design), Figma MCP and Stitch (no Figma source of truth; Stitch unverified).

## Token pipeline facts

DTCG 2025.10 format (https://www.designtokens.org/TR/2025.10/format/):

- JSON files, `.tokens` or `.tokens.json`, media type `application/design-tokens+json`.
- A token is an object with `$value`; optional `$type`, `$description`, `$extensions` (reverse-domain keys), `$deprecated`. `$type` inherits from the nearest group; tools must not guess types from values.
- Groups are objects without `$value`. `$root` gives a group its own value (`{color.accent.$root}`). `$extends` deep-merges another group.
- Aliases: `{group.token}` resolves to a whole token's `$value`; JSON Pointer `$ref` (`#/colors/blue/$value/components/0`) can target a property. Cycles are errors.
- `dimension`: `{ "value": 16, "unit": "px" }`, units `px` or `rem` only, unit required even for 0.
- `duration`: `{ "value": 200, "unit": "ms" }`, units `ms` or `s`. `cubicBezier`: `[P1x, P1y, P2x, P2y]`, x in [0, 1]. `fontWeight`: 1 to 1000 or aliases such as `bold`.
- `typography`: required `fontFamily`, `fontSize` (dimension), `fontWeight`, `letterSpacing` (dimension), `lineHeight` (number, multiplier of fontSize). `shadow`: `color`, `offsetX`, `offsetY`, `blur`, `spread`, optional `inset`; a single object or an array.

DTCG 2025.10 color (https://www.designtokens.org/TR/2025.10/color/):

- `$value` is `{ "colorSpace": "srgb", "components": [0.18, 0.49, 0.196], "alpha": 1, "hex": "#2e7d32" }`. `colorSpace` and `components` are required; `alpha` defaults to 1; `hex` is an optional 6-digit fallback.
- 14 spaces: `srgb`, `srgb-linear`, `hsl`, `hwb`, `lab`, `lch`, `oklab`, `oklch`, `display-p3`, `a98-rgb`, `prophoto-rgb`, `rec2020`, `xyz-d65`, `xyz-d50`. A component may be `"none"` (differs from 0 when interpolating).

DTCG 2025.10 resolver, i.e. modes (https://www.designtokens.org/TR/2025.10/resolver/):

- A `.resolver.json` with `version: "2025.10"`, optional `sets` (with `sources`), `modifiers` (with `contexts` and optional `default`), and a required `resolutionOrder` where later entries win.
- Light/dark is a modifier, for example `"theme": { "contexts": { "light": [{"$ref": "theme/light.json"}], "dark": [{"$ref": "theme/dark.json"}] }, "default": "light" }`. Inputs are `{ "theme": "dark" }`; unknown names or contexts are errors.

Style Dictionary (CHANGELOG at https://raw.githubusercontent.com/style-dictionary/style-dictionary/main/CHANGELOG.md, docs pages listed in section 6):

- Version 5.7.1 is current on npm. DTCG 2025.10 arrived in steps: 5.3.0 structured color objects in all color transforms (all 14 spaces, `hex` used as the out-of-gamut fallback, new `color/oklch`, `color/oklab`, `color/p3`, `color/lch`); 5.4.0 dimension objects in all built-in transforms, including typography, border and shadow shorthands; 5.7.0 `duration` objects and `$root` naming (`--color-text-warning`, not `...-root`).
- The changelog has no entry mentioning the resolver (grep for "resolver" matched only unrelated reference utilities). Modes therefore mean one Style Dictionary run per mode: the same base files plus `theme/light.json` or `theme/dark.json` as sources.
- Flutter: `transformGroup: "flutter"` = `attribute/cti`, `name/camel`, `color/hex8flutter` (outputs `Color(0xff2e7d32)`), `size/flutter/remToDouble` (rem times 16 or `basePxFontSize`), `content/flutter/literal`, `asset/flutter/literal`. Format `flutter/class.dart` with options `className`, `outputReferences`, `showFileHeader`. Per mode, emit one file per run, for example `HummlistTokensLight` and `HummlistTokensDark`, then build `ColorScheme(...)` from them in `app/lib` by hand or with a custom format.
- CSS: `transformGroup: "css"` (`name/kebab`, `color/css`, `size/rem`, `typography/css/shorthand`, `shadow/css/shorthand`, and others). Format `css/variables` with option `selector` (string or array): the light run uses `:root`, the dark run uses `[data-theme="dark"]` or a `@media (prefers-color-scheme: dark)` wrapper added by a custom format. Swap `color/css` for `color/oklch` if the site wants OKLCH.
- Email: a third platform per run (for example `json/flat` or `javascript/es6`) that the email templates inline as literal hex at build time, light mode only, since CSS variables fail in Gmail and Outlook (caniemail raw data above).

Recommended shape for Hummlist (inference from the facts above, not tested):

1. Generate the Material roles once from `#2E7D32` with material-color-utilities or `ColorScheme.fromSeed`, for light and dark, after choosing the variant on purpose (`tonalSpot` vs `fidelity`).
2. Write them as DTCG 2025.10 files: `base.tokens.json` (type, spacing, radius, motion), `theme/light.tokens.json`, `theme/dark.tokens.json`, plus a `hummlist.resolver.json` documenting the modifier even though Style Dictionary does not read it yet.
3. Style Dictionary 5.7: one run per mode, emitting `flutter/class.dart`, `css/variables`, and a flat JSON for email and Alexa card images.
4. Gate it the way the repo gates everything else: a `scripts/gates/` check that regenerates and fails on a diff (the `dtcg_theme --check` idea), plus a contrast check on every `primary`/`onPrimary`-style pair.
