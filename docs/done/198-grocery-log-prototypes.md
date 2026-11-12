# Job 198: grocery log prototypes (sandbox only)

Started 12 Nov 2026 20:26 Europe/Berlin, after the lead moved it ahead of its 16 Nov start (BOARD 20:13, Peter t803u, prototypes only).
This is the t777u prototype gate, not an approval to build. Job 199 waits until Peter picks an approach.

## What was built

- The sandbox is `docs/design/grocery-log/`: `index.html` (switcher), `proto.js` (the five approaches), `model.js` (shared data and operations), `proto.css`, `icons.js` (the app's Material glyphs) and `shoot.mjs` (the scenario driver).
- The comparison and recommendation are in `docs/design/grocery-log/RECOMMENDATION.md`.
- Screenshots of every approach and scenario are in `docs/screenshots/198/` (40 PNGs).

The five slugs are `trip-journal-by-date`, `store-timeline`, `post-shop-entry-sheet`, `calendar-trip-browse` and `relist-from-past-trip`.
Each one is interactive. You can record a trip, browse, edit, delete with undo, and switch between the "Mit Verlauf" and "Leerer Verlauf" data.

## Recommendation

Build `post-shop-entry-sheet` as the capture. Ticking at a store offers "Einkauf bei Rewe eintragen?" with the ticked items prefilled. Use `trip-journal-by-date` as the history screen, and keep logging and browsing Free.
Store grouping can come later as a filter chip, and relist as one button on a trip. Calendar is not recommended for a first build.
The open questions are the Free vs Premium history window, prompt vs card vs automatic log, multi-store trips, partners, the trip snapshot data model, privacy and retention, and receipt input as a later optional source. Details are in `RECOMMENDATION.md`.

## How to verify

```sh
python3 -m http.server 4198 --bind 127.0.0.1   # repo root
node docs/design/grocery-log/shoot.mjs http://127.0.0.1:4198/docs/design/grocery-log/index.html /tmp/198-shots
```

The driver runs the four shared scenarios in all five approaches. They are recording milk and bread today at Rewe, browsing an October trip by date, store or calendar day, editing a trip (quantity plus a new item), and the empty history. On top, it checks delete with undo, a calendar backfill for an empty day, relist skipping items already on the list, and that every empty state says capture is free.
Result: `all scenarios pass in all five approaches, 0 page errors`.

## Review

A separate Claude agent reviewed all 40 screenshots and clicked through the running sandbox. It found eleven issues. The link to `RECOMMENDATION.md` it reported broken was not written yet when it looked. The rest were fixed:

- Save was disabled while the first item was typed but not yet added.
- A chip tap cleared the typed item.
- Approach 3 kept the ticked items when the store was changed.
- Approach 3's empty state offered "nachtragen" with nothing to catch up on.
- Relist offered nothing after an edit.
- The toast followed you to other screens.
- Store cards shrank.
- The calendar kept the old day after a month change.
- The German wording was awkward: "zuletzt Heute", "+1", "Einkauf am heute" and the "Einkäufe" tab, now "Verlauf".
- The prompt appeared on the first tick, mid-shop.

The driver now checks every fix except the card shrink, which the screenshots show. Seven of those checks were run against the pre-review code and failed there: chip tap, typed item, toast, "zuletzt heute", mid-shop prompt, and the two store-change checks. That run stopped at the calendar's renamed button, so the relist and calendar checks were not tried against the old code. Its points on the "kostenlos" copy and on prompt timing are open questions in `RECOMMENDATION.md`.

## Not built

- No production UI. Nothing under `app/`, `supabase/`, `site/` or `alexa/` changed.
- No receipt scanning, no prices, no spend graphs, no Premium gate.
- No Vercel preview, because none was needed. No Vercel project, domain or protection setting was touched.
- English copy, dark mode and the 358 px compact layout were not prototyped.
