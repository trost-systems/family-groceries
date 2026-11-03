# Job 84: the store screenshots in frame P2

Peter picked P2 „Großschrift“ from job 77's five frame proposals (PR #204) on 2026-11-02. P2 is
now the frame of the store screenshot pipeline: German and English, every Play and App Store
size, rendered from the real web app with one command. The final PNGs are in
`store/screenshots/`. The review page is `/internal/store-frames-final` on the PR's site preview.
Nothing was uploaded to Play Console or App Store Connect.

## What was built

- **The frame.** `marketing/store-screenshots/frame.mjs`: a two-line Bricolage caption and an Inter
  subline in ink on honey, under it the real app as a card with an ink edge and a hard shadow,
  standing on the foot of the frame. The card shows the rows the caption points at, cut only
  through gaps between rows, which it finds from the pixels. The sync shot lifts Jonas's
  „Hinzugefügt: Eier → Supermarkt“ out of his phone as a tilted sticker. The feature graphic has
  the tagline with „mitsummt.“ in cobalt and the top of the list as a card.
- **The pipeline.** Job 65's `scripts/store-screenshots.sh` (PR #190, carried on this branch,
  rebased onto main):
  - P2's six scenes in P2's order: list, sync, add, order, tick, invite (`scenes.mjs`). The order
    and invite scenes are new. Sync has Jonas add through his own add sheet. The invite runs at
    https://app.hummlist.com, so the link reads as on the phones.
  - Each scene records the rows its caption points at (`out/raw/.../<scene>.json`).
  - One 360 × 800 phone capture frames all phone sizes. Tablets have their own capture.
  - `--publish` copies the set into `store/screenshots/`. `review.mjs` writes the review page.
- **Sizes** (`sets.mjs`): Play phone 1080 × 1920, App Store 6.9-inch 1320 × 2868 (the slot also
  takes 6.7-inch files) and 6.5-inch 1284 × 2778, six shots each. Play 7-inch and 10-inch tablets
  and the 13-inch iPad, four shots each. Feature graphic 1024 × 500, icon 512 × 512.
- **Checks** (`compose.mjs`): the store size, RGB24 without alpha, 8 MB, at most 20 % text,
  the caption above the card, no retailer name (Legal N-23), "Hummlist" in full, no Premium or
  price. A caption line too long for one line gets smaller type (none did).
- **Captions** (`captions.yaml`): P2's German texts and new English drafts. Only the German
  tagline is approved.
- **App fix.** English item names showed their category's icon, so every English fruit and
  vegetable showed the carrot (job 54's finding). `app/lib/list/list_view/item_icon.dart` now
  knows English names too, as whole words. The test fails on the old table.
- **Site.** `site/build.mjs` leaves `public/internal/` out of production (job 77's hunk, carried
  unchanged), with tests in `site/test/internal.test.mjs`.

## How to verify

```bash
scripts/store-screenshots.sh --locale all --publish --keep   # about 3 min with the web build in place
node marketing/store-screenshots/review.mjs
cp store/screenshots/manifest.json /tmp/before.json
scripts/store-screenshots.sh --locale all && node marketing/store-screenshots/compare.mjs /tmp/before.json
scripts/verify.sh --only gitleaks,lint,site,flutter
```

## Results

- Capture: 20 of 20 scenes pass (both locales, phone and tablet). Composition: 32 files per
  locale. Text share 4.1 % to 16.8 %. Every caption line fits at full size.
- Determinism: a second full run matched 58 of 64 files. The 6 that differ are the invite
  shots, as expected (a new code and expiry date each run). `compare.mjs` exits 0.
- Gates: gitleaks, lint, site (101 tests) and flutter pass locally (`scripts/verify.sh`). `flutter test
  test/list/sections_test.dart` passes. The icon assertions fail on the old table (`🥕` for
  "Apples").
- Review: an independent pass found nothing must-fix. All six should-fixes are in (DECISIONS 84.9).
  After them, a full rerun passed, and a compose rerun on the same captures matched 64 of 64 files.
- Review 0 (lead's reviewer, VERDICT FIX): the sync sticker showed a sliver of the next row, the
  invite button a focus ring, the review page a squashed-away commit, and the PR body a stale CI
  line. All four are fixed (DECISIONS 84.10). A full rerun passed (20 of 20). Against the previous
  set, only the 12 sync and 6 invite files changed.
- Review 1 (VERDICT FIX): the sync capture could fail at random (strict mode on a text the
  screen-reader announcement repeats), and the tablet and iPad stickers showed the grey scrim.
  Both are fixed, and a new check fails any sticker band whose edges aren't one colour (DECISIONS
  84.11). Proof: two full runs at 20 of 20, 58 of 64 files identical between them (the 6 invite
  shots differ as expected), and the sync captures 20 of 20 over five repeats.
- Review page: built like a preview, `noindex, nofollow`, no broken image. A production build
  leaves it out (site test).

## Screenshots

`docs/screenshots/84/`: both contact sheets, the six Play phone shots per locale, the review page.

## Missing or blocked

- The captions are drafts until Peter signs them off (NEEDS_LEAD "Job 84").
- The voice shot comes later (Q35 N1). P2 has no dark-mode shot.
- The English classifier files some English produce under "Other" (Radishes, Leeks, Asparagus). The
  English set uses Strawberries, which it knows. Wider English coverage is a classifier job.
- This PR carries #190. Land #190 first, or land this PR in its place. Not merged, per the brief.
