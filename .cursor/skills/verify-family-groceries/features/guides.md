# Guides on hummlist.com

The public guides site (`site/`, its own Vercel project, static HTML from Markdown) explains how to set up the voice entry points: the Siri Shortcut (job 24a, #54) and the Alexa skill (#127). German guides live under `/de/anleitungen/<slug>`, English ones under `/en/guides/<slug>`; each language has an index that lists its guides, each guide links its translation, and `/` sends a visitor to the index in their browser's language. The help page and the legal pages on the same site are `features/legal.md`. The app links no guide yet (`siriGuideUrl` in `app/lib/app/guides.dart` has no caller); the help page links both guides.

## Sub-features

- `gd-index` `/de/anleitungen` ("Anleitungen") and `/en/guides` list the guides of that language with title and description, generated from `site/content/guides/<locale>/`.
- `gd-siri` `/de/anleitungen/siri-kurzbefehl` and `/en/guides/siri-shortcut` walk through the Shortcut that calls the voice endpoint (`features/voice.md`).
- `gd-alexa` `/de/anleitungen/alexa` and `/en/guides/alexa` explain enabling the skill "Hummlist", linking the account and the phrases (`features/alexa.md`).
- `gd-translation` every guide names its other language (`hreflang` de and en) and links it, such as `/de/anleitungen/alexa` → `/en/guides/alexa`.
- `gd-language-redirect` `/` answers 307 to `/de/anleitungen` for `Accept-Language: de…` (and without the header), and to `/en/guides` for any other language (`site/vercel.json`).
- `gd-noindex` every response carries `X-Robots-Tag: noindex` until the beta launch.

## How to get to it (user POV)

- Open https://hummlist.com in a browser; it lands on the guides index in the browser's language.
- From the help page (Mehr → "Hilfe & Kontakt", `features/legal.md`), follow the Siri or Alexa link.

## Driving it with fg

Preconditions: no app and no Supabase. `curl` for the live site; for a local build Node and `cd site && npm ci`.

- **Live pages.** `for p in de/anleitungen en/guides de/anleitungen/alexa de/anleitungen/siri-kurzbefehl en/guides/alexa en/guides/siri-shortcut; do curl -s -o /dev/null -w "%{http_code} $p\n" https://hummlist.com/$p; done` prints 200 for each.
- **Redirect.** `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' -H 'Accept-Language: de' https://hummlist.com/` prints `307 https://hummlist.com/de/anleitungen`; with `Accept-Language: en` it prints `307 https://hummlist.com/en/guides`.
- **Translation link.** `curl -s https://hummlist.com/de/anleitungen/alexa | grep -o -E 'href="/en/guides/[^"]*"|hreflang="[a-z]+"' | sort -u` lists `href="/en/guides/alexa"`, `hreflang="de"` and `hreflang="en"`.
- **No index.** `curl -sI https://hummlist.com/de/anleitungen | grep -i x-robots` reads `noindex`.
- **Local build.** `cd site && npm test` passes (52 tests on 2026-10-31: content rules, links, drafts, placeholders, the preview server). `npm run build`, then `PORT=<port from your block> node scripts/preview.mjs` serves `dist/` with `vercel.json`'s redirects: the pages above answer 200 on `http://127.0.0.1:<port>/`, and `/` with `Accept-Language: en-US` answers 307 to `/en/guides`. Stop the preview by its pid.
- **Proof.** The curl output; for a page's look, a screenshot of the local preview in a browser.

## Gotchas

- The site is a separate Vercel project (Root Directory `site`); the app's build (`vercel.json` at the repo root, `features/web-hosting.md`) doesn't include it.
- A guide's `slug` must equal its file name and stays stable: links point to it (`site/README.md`, "Adding a guide"). A broken internal link, a second h1 or an external resource fails the build.
- `[PETER: …]` placeholders only warn in a local build; `VERCEL_ENV=production npm run build` fails on them.
