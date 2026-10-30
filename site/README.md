# hummlist.com guides site

Static HTML from Markdown, no JavaScript in the browser. `build.mjs` (markdown-it, gray-matter)
writes `dist/`; it is its own Vercel project, separate from the app on app.hummlist.com.

```bash
npm ci
npm run build                          # dist/; warns about [PETER: placeholders
VERCEL_ENV=production npm run build    # fails on them, like the production deploy
npm test                               # builds real content and fixtures, checks the output
npm run preview                        # http://127.0.0.1:55990 with vercel.json's redirects and headers
```

`scripts/gates/site.sh` (the `site` CI gate, `scripts/verify.sh --only site`) runs the tests and a
production build.

## Adding a guide

Add `content/guides/<locale>/<slug>.md` (`de` or `en`). No code change: the build adds the page
and lists it on that locale's index. Frontmatter, all required:

```yaml
title: "Hummlist per Siri: Kurzbefehl einrichten"   # h1-level title, og:title, index entry
description: "…"                                    # meta and og:description, index entry
slug: siri-kurzbefehl                               # must equal the file name; the app links to it, so keep it stable
locale: de                                          # must equal the folder
translation_key: siri-shortcut                      # same key in de and en links the two versions
updated: 2026-10-27                                 # shown under the guide
```

German guides live at `/de/anleitungen/<slug>`, English ones at `/en/guides/<slug>`. The body
starts with exactly one `# ` heading and must not skip heading levels; images need alt text. A
missing field, a second h1, a skipped level, an image without alt, a script, an external resource
or a link to a page that doesn't exist fails the build with the file and the reason.

## Other pages

- `content/indexes/<locale>.md`: the index intro (`title`, `description`, `locale`); the guide list
  is generated.
- `content/legal/*.md`: pages at a fixed `path` (`title`, `description`, `locale`, `path`,
  `translation_key`, `updated`, optional `draft`), such as `/impressum` and `/en/imprint`,
  `/datenschutz` and `/en/privacy` (`/privacy` redirects there, `vercel.json`), and the help
  pages `/support` and `/en/support` (job 24). A heading ending in `{#id}` gets that anchor:
  `/datenschutz#rechte` is the stores' privacy-choices URL.
- `config.json`: `privacyPublished` shows the Datenschutz/Privacy footer links,
  `supportPublished` the Hilfe/Support one. Set a flag to `true` only together with its pages;
  a footer link to a missing page fails the build. Impressum is always linked.

## Drafts

`draft: true` in a page's or guide's frontmatter keeps it unpublished: preview and local builds
show it with a banner ("ENTWURF: Freigabe durch Peter" / "DRAFT: pending Peter's approval"), an
HTML comment and `noindex`; Vercel production builds (`VERCEL_ENV=production`) leave it out, so
its path stays a 404. The help pages `/support` and `/en/support` are drafts until Peter approves
them (job 24). To publish, delete the `draft: true` line and then set the footer flag; a footer
link to a draft fails the production build.

## Placeholders

Write open facts as `[PETER: what is missing]`. Preview builds warn; a production build
(`VERCEL_ENV=production`) fails while any published page still contains one.

## Vercel

Project settings: Root Directory `site`; everything else comes from `vercel.json` (install
`npm ci`, build `npm run build`, output `dist`). `/` redirects by `Accept-Language`: `de…` to
`/de/anleitungen`, any other language to `/en/guides`, no header to `/de/anleitungen`.
`dist/index.html` (meta refresh) only serves hosts without these redirects. Every response
carries `X-Robots-Tag: noindex` until the beta launch; remove that header then.
