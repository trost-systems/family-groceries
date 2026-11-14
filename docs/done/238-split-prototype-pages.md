# Job 238: one page per prototype round (2026-11-14)

Draft PR https://github.com/trost-systems/snacklist/pull/414 (DO NOT MERGE), on job 223's sandbox branch. Prototype pages only. Nothing in the app changed.

## Preview

- Vercel **preview** on `family-groceries-design`, after review 0: `https://family-groceries-design-3uyoj9dfw-peter-trost.vercel.app` (`dpl_CU3CYKY9zLF7ZYx4T7Urt2kY5vzx`, READY, target preview, built from commit 8ab20e0a's tree on 14 Nov 2026). All 21 files' SHA-1s match the build. SSO protects the bare URL (302); protection is unchanged and there is no public domain.
- **The share link is not minted yet.** This runner has no Vercel connector, so the lead mints the 23-hour link (NEEDS_LEAD "Job 238: mint share link", updated). Write the expiry next to it.
- Superseded, don't share: `6ev8d49kf` (`dpl_tNr9d9CdKaLCagbHKtm5wHWe7qBd`, job 238 before review 0), `r2gs9zc6r` (`dpl_EiJ2RGvMeNWPWC7FuzhNMTFwKFhX`, job 230's last, one shared page), and the older `6nwtheqfm`, `9odjzo3fj`, `b9fbc2wsp`, `ius2xho2k`, `8f981nh0a`.
- Paths: `/` (overview), `/st/`, `/ss-bb/`, `/round1/`. Old links such as `/#/st`, `/#/ST3`, `/#/rec1` forward to the right page. `?lang=de` for German.

## What was built

- `/` lists the rounds, newest first, each a link with its date and a one-line description: "Per-store subtotals (ST1–ST5)" Nov 14, "Switcher sheet + bottom area (SS/BB)" Nov 13, "List declutter round 1 (LD1–LD5)" Nov 13.
- Each round page has its title, a "what you're comparing" line, "← All rounds", and only its own buttons. The ST page: All side by side, Recommendation, Today, R2 base, ST1 to ST5, its three data sets, language, theme, text size. Rounds 1 and 2 keep the people switch.
- One registry, `docs/design/list-declutter/rounds.js`, drives the overview, the pages, the forwarding and the shoot scripts. A new round is one entry there plus a `<path>/index.html`.
- Rule for later jobs: appended "One page per prototype round" to `~/groceries-ops/COMMON.md`.

## How to verify

From the repo root: `python3 -m http.server 64238 --bind 127.0.0.1`, then, with `B=http://127.0.0.1:64238/docs/design/list-declutter/`:
`node docs/design/list-declutter/shoot-pages.mjs $B /tmp/p`, `shoot-st.mjs $B /tmp/st`, `shoot.mjs $B /tmp/r12`. Each prints "all checks passed" or exits 1. `build.sh /tmp/dist` and `shoot-pages.mjs http://<server of /tmp/dist>/ /tmp/p` check the built folder.

## Test results

- `shoot-pages.mjs`: all checks passed, on the sandbox and on the built folder. With one SS button added to every page it fails 5 times.
- `shoot-st.mjs` and `shoot.mjs`: all checks passed; their tables are byte-identical to jobs 230's and 227's.
- Sonnet review: no bugs; one-line descriptions and the ST page's URL fixed.
- `scripts/verify.sh --only lint,gitleaks`: passed.

## Review 0 (FIX), addressed

- Must-fix: #414's body named only job 227's superseded preview. The job 238 section now opens with the new preview and the superseded list, and job 227's preview line says it is superseded.
- `shoot.mjs`'s LD5 quick-return check was flaky. Its locator click picked a row hidden under the header, so Playwright scrolled to 0 first and the header went away. It failed 2 in 20 under ten busy loops; the fix (click a row on screen below the header, at its coordinates) failed 0 in 20, and scrollTop now stays at 500 through the tick.
- On a phone the comparing line shows once Options is open. Each round page's HTML has its own `<title>`. Overview dates sit under their titles on every card. The README notes that `#/every` exists on round pages only.
- The new `shoot-pages.mjs` checks (dates, static titles, comparing line on a phone) fail 5 times on 7f16d318 and pass now. `shoot-pages`, `shoot-st` and `shoot.mjs` all print "all checks passed", on the sandbox and (shoot-pages) on the built folder; tables byte-identical to jobs 227 and 230.

## Screenshots

`docs/screenshots/238/`: overview in English and German, each round page, the ST page on a 390 × 664 phone, closed and with Options open.
