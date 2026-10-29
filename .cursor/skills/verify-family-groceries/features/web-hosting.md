# Hosted web app

Anyone opens the production web app on Vercel and gets the sign-in page. Deep links such as `/oauth/consent` (MCP connections), `/join/CODE` (invites) and `/settings` boot the app on that route. "Mit Google anmelden" leads to Google's sign-in for the hosted Supabase project, and "Mit Apple anmelden" to Apple's for the Services ID `com.petertrost.familygroceries.web`. Each push to `main` deploys to `https://preview.app.hummlist.com`, behind Vercel Authentication. Production (`https://app.hummlist.com`) is the `release` branch, which `release.yml` moves to the commit it ships to the stores (`docs/DEPLOY.md`, section "Web app"). Branches get preview URLs.

## Sub-features

- `web-spa-routes` serves `index.html` with `Cache-Control: no-cache` for every app path, dotted ones such as `/join/AB.CD` included, and answers 404 for a missing asset such as `/missing.js`, `/assets/x.png` or anything under `canvaskit/` (`vercel.json`, DECISIONS 7b.2).
- `web-cache` makes `index.html`, `manifest.json`, `flutter_bootstrap.js`, `flutter_service_worker.js` and `version.json` `no-cache`, and other files (`main.dart.js`, icons, assets) `public, max-age=0, must-revalidate`. `web-smoke.mjs` checks the three Flutter files and `main.dart.js`; `curl -sI <url>/manifest.json` shows the rest.
- `web-google` takes the Google button to `accounts.google.com` with the web client ID from `app/config/auth.json`.
- `web-apple` takes the Apple button to `appleid.apple.com` with the Services ID.
- `web-build` runs `vercel.json`'s install and build commands in Amazon Linux 2023 from a fresh clone.

## How to get to it (user POV)

- Open the production URL `https://app.hummlist.com` (alias `https://family-groceries-pied.vercel.app`) in a browser.
- Follow an MCP client's "connect" link, which lands on `<url>/oauth/consent?authorization_id=...`.
- Open an invite link `<url>/join/CODE`.

## Driving it with fg

Preconditions:

- No `fg` stack is needed: the checks run against the hosted project. Install the e2e dependencies once with `(cd e2e && npm ci)`.

- **Routes, headers and both providers.** Run `node e2e/web-smoke.mjs <production-url> <dir>`. Every check line starts with `ok` (two more lines print the Google `client_id`, which must equal `GOOGLE_WEB_CLIENT_ID` in `app/config/auth.json`, and the screenshot directory), and the exit code is 0. Run it under `flock /tmp/fg-e2e.lock`: it starts a browser. `<dir>` then holds `1-sign-in.png` (Google and Apple buttons on `/oauth/consent`), `2-google-consent.png` (Google's "Anmeldung" page, "Weiter zu jdwqrallbpdbshrdhenk.supabase.co") and `3-apple-sign-in.png` (Apple's page naming the Services ID's description, "Einkauf Web" until Peter renames it to "Hummlist", `docs/NEEDS_PETER.md` job 20).
- **The build Vercel runs.** Run `scripts/vercel-local.sh /tmp/fg-vercel-out`. It ends with `output: /tmp/fg-vercel-out`. To check the providers against that output, start `node e2e/serve.mjs /tmp/fg-vercel-out 55081`, then run `SMOKE_BROWSER_ONLY=1 node e2e/web-smoke.mjs http://127.0.0.1:55081 <dir>`. `e2e/serve.mjs` has no Vercel header rules, so the HTTP checks are skipped.

## Gotchas

- The smoke test stops at the providers' sign-in pages and never signs in. A full Google or Apple round trip needs a real account, so it is a manual step (`docs/NEEDS_PETER.md`, section 4, step 18).
- Production is the last store release, not `main`: to check what just merged, use `https://preview.app.hummlist.com` (its build of `main`) with a share link. Without a share link or a Vercel login it shows Vercel's login wall, not the app, and `app.hummlist.com` stays on the last store release until the next Release run that uploads (scheduled Mondays, or started by hand); a failed or skipped run keeps it there longer.
- Previews are behind Vercel Authentication (302 to vercel.com). Pass a share link from the Vercel dashboard as the URL (`<preview>/?_vercel_share=...`); the smoke test reuses its cookie. Production is public.
- On a preview URL or on localhost, the provider round trip ends on the production Site URL unless that origin is in the hosted redirect list. Reaching the provider page does not depend on it.
- `scripts/vercel-local.sh` builds the committed `HEAD` and ignores uncommitted changes, like Vercel does.
