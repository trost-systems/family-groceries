# Job 77: five store-screenshot frame proposals

PR #204 is for review on the Vercel preview, not for merge (brief).

## What was built

- **Research:** `docs/store/frame-research.md`. It covers the competitors' current sets (AnyList,
  Bring!, Todoist, Things 3, OurGroceries, Structured, Listonic) and Apple's and Google's rules.
  It also covers the ASO vendor evidence on caption length, the first-three-shots rule,
  panoramas, device versus frameless, contrast, localisation and the feature graphic. It ends with
  twelve takeaways and a verdict per frame direction, with links to the sources.
- **Generator:** `design/store-frames/` (README there). `node design/store-frames/build.mjs`
  renders P1 Wabenband (panorama), P2 Großschrift (oversized captions), P3 Schwebend (tilted
  device), P4 Lupe (frameless with callouts) and P5 Ein Einkauf (story). Each gets six Play phone
  shots (1080 × 1920) and a feature graphic (1024 × 500), all 24-bit PNG without alpha. The input
  is job 65's de-DE captures, now in the repo. Crops are cut only at clean lines found in the
  pixels. The build fails a shot with more than 20 % frame text.
- **Review page:** `/internal/store-frames` on the site's preview deployment
  (`https://hummlist-site-git-job-77-store-frames-proposals-peter-trost.vercel.app/internal/store-frames`,
  behind Vercel's login). It shows P1 to P5 side by side (shots 1 to 3), a one-line rationale
  each, every full set, the feature graphics and the research summary. It is `noindex, nofollow`.
  `site/build.mjs` leaves `public/internal/` out of production builds.
- **Full-size PNGs:** `/workspace/hummlist/research/77-store-frames/P1` to `P5`.

## How to verify

```sh
(cd e2e && npm ci) && node design/store-frames/build.mjs --site   # prints text share per shot
(cd site && npm test && npm run build && npm run preview)         # then open /internal/store-frames
```

## Results

- `scripts/verify.sh --only gitleaks,lint,site,changelog` passes locally. The site tests include
  `site/test/internal.test.mjs`, which fails without the production exclusion.
- The page was served by the site's preview server, with the real CSP and headers. All images
  loaded and the browser logged no errors.
- All 35 PNGs are rgb24, at 1080 × 1920 or 1024 × 500. Frame text per shot is 4.6 % to 12.7 %.
- A fresh-eye review of the first render found sliced words, tags hiding words and copy errors.
  Clean-cut cropping, straight tags placed on filler and new copy fix these.
  Left as they are: the capture's own text wraps (the add toast, the add sheet's hint), the
  mid-drag rows in the order shot, and the invite code's date. All three are real app UI in job
  65's captures.

## Missing or blocked

- I could not open the preview page itself. The deployment sits behind Vercel's login, and this
  box has no Vercel token. Vercel's site check on the PR passed, and its build is the same
  `npm run build` that ran locally.
- Peter picks a direction. A final set may need fresh captures (job 65's process). The
  generator then needs no hand-measured crops.
- No mascot: no artwork exists, and design 6b rules out a bee (DECISIONS, job 77).
