# Guides on hummlist.com

The public guides site (`site/`, its own Vercel project, static HTML from Markdown) explains how to set up the voice entry points: the Siri Shortcut (job 24a, #54) and the Alexa skill (#127). German guides live under `/de/anleitungen/<slug>`, English ones under `/en/guides/<slug>`; each language has an index that lists its guides, each guide links its translation, and `/` sends a visitor to the index in their browser's language. The help page and the legal pages on the same site are `features/legal.md`. The app links no guide yet (`siriGuideUrl` in `app/lib/app/guides.dart` has no caller); the help page links both guides.

## Sub-features

- `gd-index` `/de/anleitungen` ("Anleitungen") and `/en/guides` list the guides of that language with title and description, generated from `site/content/guides/<locale>/`.
- `gd-siri` `/de/anleitungen/siri-kurzbefehl` and `/en/guides/siri-shortcut` walk through the Shortcut that calls the voice endpoint (`features/voice.md`).
- `gd-alexa` `/de/anleitungen/alexa` and `/en/guides/alexa` explain enabling the skill "Hummlist", linking the account and the phrases (`features/alexa.md`).
- `gd-translation` every guide names its other language (`hreflang` de and en) and links it, such as `/de/anleitungen/alexa` → `/en/guides/alexa`.
- `gd-language-redirect` `/` answers 307 to `/de/anleitungen` for `Accept-Language: de…` (and without the header), and to `/en/guides` for any other language (`site/vercel.json`).
- `gd-changelog` `/de/changelog` („Neuigkeiten“) and `/en/changelog` ("What's new") list each public release of `releases/releases.json`, newest first, with date and its changelog items; preview and local builds also show drafts from `releases/changelog/<version>.json` on top with the banner "Entwurf, noch nicht im Store". Every page's footer links it. Before the first public release production shows only the line that the first version is coming soon (`site/README.md`, "Changelog").
- `gd-noindex` every response carries `X-Robots-Tag: noindex` until the beta launch.
- `gd-since` content tagged `since` a version above the live version (newest public release in `releases/releases.json`, else `app/pubspec.yaml`) is left out of production and shown with a banner ("Ab Version X, noch nicht im Store") in preview and local builds; guide frontmatter `since:`, heading suffix `{since=X}`, block `::: since X` (`site/README.md`, "Versioned content"). Today no content is tagged.

## How to get to it (user POV)

- Open https://hummlist.com in a browser; it lands on the guides index in the browser's language.
- From the help page (Mehr → "Hilfe & Kontakt", `features/legal.md`), follow the Siri or Alexa link.

## Driving it with fg

Preconditions: no app and no Supabase. `curl` for the live site; for a local build Node and `cd site && npm ci`.

- **Live pages.** `for p in de/anleitungen en/guides de/anleitungen/alexa de/anleitungen/siri-kurzbefehl en/guides/alexa en/guides/siri-shortcut; do curl -s -o /dev/null -w "%{http_code} $p\n" https://hummlist.com/$p; done` prints 200 for each.
- **Redirect.** `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' -H 'Accept-Language: de' https://hummlist.com/` prints `307 https://hummlist.com/de/anleitungen`; with `Accept-Language: en` it prints `307 https://hummlist.com/en/guides`.
- **Translation link.** `curl -s https://hummlist.com/de/anleitungen/alexa | grep -o -E 'href="/en/guides/[^"]*"|hreflang="[a-z]+"' | sort -u` lists `href="/en/guides/alexa"`, `hreflang="de"` and `hreflang="en"`.
- **No index.** `curl -sI https://hummlist.com/de/anleitungen | grep -i x-robots` reads `noindex`.
- **Local build.** `cd site && npm test` passes (79 tests on 2026-11-01: content rules, links, drafts, placeholders, versioned content, the changelog, the preview server). `npm run build`, then `PORT=<port from your block> node scripts/preview.mjs` serves `dist/` with `vercel.json`'s redirects: the pages above answer 200 on `http://127.0.0.1:<port>/`, and `/` with `Accept-Language: en-US` answers 307 to `/en/guides`. Stop the preview by its pid.
- **Live version.** `cd site && VERCEL_ENV=production node build.mjs` prints `live version: 0.1.0 (from app/pubspec.yaml, no public release yet)` before the page count while the record has no public release. `node --test test/versions.test.mjs` covers hidden guides, sections and blocks against fixture records.
- **Changelog.** `curl -s https://hummlist.com/de/changelog | grep -o 'Die erste Version[^<]*'` prints the empty state while the record has no public release; `curl -s https://hummlist.com/impressum | grep -o 'href="/de/changelog"'` finds the footer link. `node --test test/changelog.test.mjs` covers releases, drafts and the anchors (`#v1-0-0`) against fixtures.
- **Proof.** The curl output; for a page's look, a screenshot of the local preview in a browser.

## Gotchas

- The site is a separate Vercel project (Root Directory `site`); the app's build (`vercel.json` at the repo root, `features/web-hosting.md`) doesn't include it.
- A guide's `slug` must equal its file name and stays stable: links point to it (`site/README.md`, "Adding a guide"). A broken internal link, a second h1 or an external resource fails the build.
- `[PETER: …]` placeholders only warn in a local build; `VERCEL_ENV=production npm run build` fails on them.
