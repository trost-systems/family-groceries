# Job 33c: self-host CanvasKit and fonts, nothing from gstatic.com

Branch `job/33c-legal-canvaskit`, PR #108 (waits for Peter's legal OK, not
merged). Legal review H-02. Decisions: `docs/DECISIONS.md`, "Job 33c".

## What was built

- **`app/web/flutter_bootstrap.js`** passes `canvasKitBaseUrl: '/canvaskit/'`
  and `fontFallbackBaseUrl: '/fonts/'` to Flutter's loader. Both apps of the
  `--wasm` build (skwasm in Chromium, CanvasKit in Firefox and Safari) load
  their engine from our origin.
- **Roboto** comes with the build: `scripts/vercel.sh` builds with
  `--no-web-resources-cdn`, like every other web build. Flutter then puts the
  engine's Roboto 2 (Apache 2.0) into `FontManifest.json` for the web only,
  and the mobile apps are unchanged (DECISIONS 33c.2).
- **`app/web/fonts/`** holds every fallback font the engine can ask for, 725
  files and 21.7 MB, at the fonts.gstatic.com/s/ paths. A browser downloads
  only the slices it needs. `scripts/web-fonts.sh` rebuilds the folder from
  the Flutter SDK's list and writes `LICENSES.md`, `OFL.txt` and
  `Roboto-LICENSE.txt` (all Noto fonts SIL OFL 1.1).
- **`vercel.json`** sends a Content-Security-Policy on every response:
  scripts and fonts from our origin only, and connections only to our
  origin, the Supabase project and `eu.i.posthog.com`. `/fonts/` stays out
  of the SPA rewrite, and font files are cached for a year (immutable,
  versioned paths).
- **Guards.**
  - `e2e/tests/no-google.spec.ts` runs in Chromium, Firefox (new project)
    and WebKit. It signs in to a list with 🍎, umlauts, 牛奶, خبز and Молоко,
    then opens the add sheet. It fails on a request to a Google host, any
    unexpected host, PostHog before consent, a CSP violation, or a fallback
    font not fetched from `/fonts/`.
  - `e2e/serve.mjs --csp` makes the whole e2e suite run under the
    production CSP, and it now routes like Vercel (missing assets are a 404).
  - The web-prod gate fails when the bootstrap config, a CanvasKit variant,
    or a font that `main.dart.js` names is missing.
  - `e2e/host-census.mjs <url>` counts hosts per browser for the live check.

## How to verify

- `scripts/verify.sh --only web-prod`.
- `scripts/ci-e2e.sh --no-db --spec tests/no-google.spec.ts` (the
  `HOSTS <browser>` lines in the log).
- Locally: build like Vercel (`--no-web-resources-cdn --wasm`), serve with
  `node e2e/serve.mjs <out> 56580 --csp https://jdwqrallbpdbshrdhenk.supabase.co https://eu.i.posthog.com`,
  then `node e2e/host-census.mjs http://127.0.0.1:56580/ chromium,firefox`.
- After the next dispatched release: `node e2e/host-census.mjs https://app.hummlist.com/`.

## Follow-ups

- `app.hummlist.com` moves only with a dispatched release (docs/DEPLOY.md).
  Until then the live web app still loads from gstatic, so 33a's "nothing
  loaded from Google" must not go live on hummlist.com before this job has
  reached app.hummlist.com, or 33a's §3 needs a temporary note.
- After that release, rerun the host census against app.hummlist.com.
