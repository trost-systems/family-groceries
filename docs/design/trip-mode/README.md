# Shopping trip mode: five prototypes (job 217)

Throwaway sandbox for Peter's pick (decisions t839u, t840u, 13 Nov 2026). Nothing here is app code.
All data is invented. The sandbox is German only, light only, and has no prices.

It prototypes four pieces of trip mode:

- the "Kaufst du gerade ein?" question on a tick with no trip running (PB1c), including "no" and how often it asks again;
- the trip bar at the bottom: stopwatch, pause, resume and end;
- the end-of-trip summary (approach 1 from job 196, `snapshot-vs-ticked-list`), with "von Lea" and "War geplant" (PB2a);
- the Premium gate for Free members (PB3a), with no price.

The recommendation and the open questions TQ1 to TQ15 are in [`RECOMMENDATION.md`](RECOMMENDATION.md). The page also shows them under "Empfehlung und offene Fragen".

## Run it

The preview for Peter is a protected Vercel preview (see the job's DONE_SUMMARY). To drive it locally, serve the repo root with any static server bound to 127.0.0.1, then open `docs/design/trip-mode/index.html`. The page loads `site/public/tokens.css` and the site fonts by relative path. `build.sh <out>` copies everything into one folder for a preview.

```sh
node docs/design/trip-mode/shoot.mjs <page-url> <out-dir>
```

`shoot.mjs` runs all six scenarios in all five prototypes, as Premium and as Free. It checks the state, the copy and the layout, and it writes one contact sheet per scenario. The layout checks are:

- nothing of the trip covers the add field, the tabs or the keyboard;
- every control is at least 44 × 44 px;
- no price shows.

It exits 1 on any failed check.

## Using the page

- Pick a prototype in the panel, or press the keys 1 to 5. On a phone, the dark strip at the top has the five buttons, the next scenario step, and ☰ for the panel.
- Each scenario is a list of steps. "Nächster Schritt" runs the next one through the same actions as a tap.
- "Selbst ausprobieren" holds the free controls:
  - tap an item to tick it;
  - "Was brauchst du?" opens a fake keyboard with suggestions;
  - "+5 Min.", "+30 Min." and "+3 Std." move the clock forward;
  - "Lea schreibt etwas dazu" adds an item as Lea;
  - "App beenden und neu öffnen" really reloads the page, and the trip comes back from storage.
- The Premium button switches between Premium and Free.
- Mehr › „Einkauf starten“ starts a trip by hand. Its snapshot is the list as it is at that moment.
- Simulated time starts on Saturday, 14 Nov 2026 at 10:00 Europe/Berlin and then runs in real time.

## The five prototypes

| Label | Slug | Question | Trip bar (added height) | Long-running trip | Summary | Free |
| --- | --- | --- | --- | --- | --- | --- |
| TM1 | `card-ask-slim-strip` | Card on top of the list, sticky; ticking goes on | Dark 52 px strip over the field (+60 px); gone while typing | After 2 h without a tick, the strip asks "Noch beim Einkaufen?" and offers "Ende 10:06" (the last tick) | Own page | Blurred summary under a Premium card |
| TM2 | `sheet-ask-floating-timer` | Bottom sheet: "Ja", "Nein, nur abgehakt", "Zurücknehmen" | Honey pill floating over the field (+62 px); stays while typing | Pauses itself 45 min after the last tick; ends at the last tick after 4 h | Tall sheet | Duration and tick count, then a quiet Premium card |
| TM3 | `toast-ask-timer-in-tabs` | The tick's snackbar asks, with "Starten"; gone after 6 s means no | Timer segment inside the tab pill (+0 px); a tap opens Pause and End | System notification after 3 h with "Beenden" (at the last tick) | Unfolds in Verlauf | The first summary once, then a lock row |
| TM4 | `store-ask-lap-bar` | "Bist du gerade bei Lidl?", with "no" per store | Wide bar with a lap per store (+64 px); one thin line while typing | After 90 min without a tick: "Noch bei Rewe?" | Own page, one part per store with its time | Only "Einkauf beendet · 25 Min."; lock row in Verlauf |
| TM5 | `row-ask-trip-replaces-tabs` | The ticked row unfolds into "Gekauft, Einkauf starten" or "Nicht mehr nötig" | The tab pill turns into the trip pill (+0 px); the tabs sit behind ☰ | Ends silently at the last tick after 2 h; a card says so, with "Doch weiter" | Card on the list, then a page | Counts free, names Premium |

The heights were measured on the 390 × 844 frame: the area below the list is 140 px today and 200 to 204 px with a bar. Every prototype shares one data shape (`model.js`):

- a trip is the moment of the tick that started it, the open items just before that tick (the snapshot), its pauses, the stores it passed, and when and why it ended;
- bought means ticked between start and end, by anyone;
- an item that someone else wrote onto the list during the trip is extra and carries "von <Name>";
- "War geplant" moves an extra into the planned part;
- the summary rows are frozen at the end, so a Verlauf entry still shows them after the list has changed.

## Scenarios

| Id | Scenario | What it proves |
| --- | --- | --- |
| S1 | Ein Laden | The question, start at 10:00, the bar, the keyboard, 4 of 6 planned plus Eis extra, 25 min, the Verlauf entry |
| S2 | Zwei Läden | A 15-minute pause for the drive: 18 min, not 33; TM4 shows Lidl 12 min and Rewe 6 min |
| S3 | App beendet | A real reload 10 min later: the stopwatch reads 17 min and the trip goes on |
| S4 | Lea schreibt dazu | Milch and Eier "von Lea"; Milch bought, Eier not; "War geplant" moves Milch to the planned part |
| S5 | Stunden später | 4 h in a pocket: each prototype's rule; every trip ends at the last tick (6 min) |
| S6 | Aus Versehen | Spülmittel ticked, then "no": nothing starts, the next tick is quiet; 3 h later TM1, TM3 and TM5 ask again, while TM2 (rest of the day) and TM4 (this store today) stay quiet |
