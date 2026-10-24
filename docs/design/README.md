# Design history

How the family-groceries UI came to be. Reference material only, not app code. All data is mock data.

- **Round 1:** directions A–D (`a-grid`, `b-paper`, `c-cards`, `d-sentence`).
- **Round 2:** "Satz" variants E–G (`e-satz-zeilen`, `f-satz-etikett`, `g-satz-fliesstext`).
- **Round 3 / final:** H, "Satz · Laufweg" (`h-satz-final`): one sentence-style composer, list grouped by store in walking order.

Everything lives in [`h-satz-final/`](h-satz-final/): sources (`sandbox-src/`), built previews (`h-dist/`, `r2-dist/`), screenshots (`shots/`), and the round-3 brief and review (`design-job-round3/`). Design rationale: `h-satz-final/sandbox-src/DESIGN_NOTES.md`.

## Run the sandbox locally

```sh
cd docs/design/h-satz-final/sandbox-src
npm ci
npm run dev        # open the printed URL; index at #/, final design at #/h-satz-final
npm test           # unit tests (vitest)
npm run e2e        # Playwright, one run at a time
```

Or serve a prebuilt preview without installing anything:

```sh
python3 -m http.server 8771 --directory docs/design/h-satz-final/h-dist
# http://127.0.0.1:8771/#/h-satz-final
```
