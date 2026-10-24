# Design preview H ("Satz final") — recovered 2026-10-24

The family-groceries design prototypes lived only on a box that was lost on 2026-10-24 (~21:30 Berlin).
This folder keeps them in GitHub so they are never box-only again. It is reference material, not app code.

| Path | What it is |
|---|---|
| `h-dist/` | Built preview H as deployed on Vercel (deployment `dpl_FrX1PMbZP5MBYyqdwLYa51u91t74`). Rebuilt from `sandbox-src` after anonymizing mock data (the deployed bundle differed only in the mock member name). Route: `#/h-satz-final`. |
| `r2-dist/` | Built round-2 preview (deployment `dpl_DJFjGjJsbDBhNjJrHHB22HAMfbZF`): directions A–G (`#/a-grid` … `#/g-satz-fliesstext`). Mock member name edited in the bundle; otherwise as deployed. |
| `shots/h-*.png` | H at 390×844 (DPR 2), retaken 2026-10-24 from the anonymized sandbox build (edit shot via right-click, not touch long-press): list, list with dm + Edeka collapsed, add sheet after typing "Windeln Pampers Größe 3", editor opened by a touch long-press on "Milch". |
| `shots/r2-*.png` | Round-2 index and each direction's list, retaken from the anonymized sandbox build. |
| `sandbox-src/` | Source of the design sandbox at commit `c5af438` ("Round 3: H Satz final"), incl. `src/prototypes/h-satz-final`, Playwright e2e, DESIGN_NOTES, DONE_SUMMARY and the sandbox's own screenshots. No `node_modules`. |
| `design-job-round3/` | The round-3 design brief, Peter's feedback and the round-3 review. |

Run a build locally: `python3 -m http.server 8771 --directory h-dist` and open `http://127.0.0.1:8771/#/h-satz-final`.
Rebuild from source: `cd sandbox-src && npm ci && npx vite build`.

All data in the prototypes is mock data. No secrets.
