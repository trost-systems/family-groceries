# Grocery log: five prototypes and a recommendation (job 198)

Throwaway sandbox for the t777u prototype gate. Nothing here is production UI, and job 199 waits until Peter picks an approach.
The sandbox has no prices, no spend charts, no receipt scanning and no Premium gate. All data is invented, and "today" is Thursday, 12 Nov 2026.

## Run it

```sh
python3 -m http.server 4198 --bind 127.0.0.1    # from the repo root
# open http://127.0.0.1:4198/docs/design/grocery-log/index.html
node docs/design/grocery-log/shoot.mjs http://127.0.0.1:4198/docs/design/grocery-log/index.html /tmp/198-shots
```

The page loads `site/public/tokens.css` and the site's fonts by relative path, so serve the repo root.
Use the left panel or the keys 1 to 5 to switch approaches. The bottom tabs are "Liste" and "Verlauf". "Mit Verlauf" and "Leerer Verlauf" switch the data, and "Von vorn" resets it.
`shoot.mjs` runs the four shared scenarios in every approach, checks the screen text and writes the screenshots in `docs/screenshots/198/`.

## The five approaches

All five share one data shape: a trip is a store, a day, who logged it, and the items with optional quantities. They also share one entry and edit sheet. They differ in how you get to a trip and how a trip gets in.

| Slug | What it is | Good at | Weak at |
| --- | --- | --- | --- |
| `trip-journal-by-date` | Newest trip first, grouped as "Diese Woche", "Letzte Woche", then by month | Zero learning; every trip appears exactly once | Answering "what do we buy at Aldi?" takes scrolling |
| `store-timeline` | One block per store with its trips by date; stores without trips stay listed | Matches the list's store sections; per-store add presets the store | No cross-store week view; many stores means many blocks |
| `post-shop-entry-sheet` | Starts on the list. Ticking items at a store offers "Einkauf bei Rewe eintragen?", and the sheet arrives prefilled with the ticked items. "Nachtragen" covers trips made without the list | Almost no typing; the log fills from ticks people already make | Its history screen is plain; shoppers who don't use the list must type |
| `calendar-trip-browse` | Month grid with a hex mark per trip; a day shows its trips; empty days offer a backfill for that day | "When were we last at the market?", and backdating | Cramped on a phone; one to three trips a week leave the grid mostly empty; content hides behind a tap |
| `relist-from-past-trip` | A past trip becomes a template: pick items and put them on the current list; items already open show "steht schon drauf" and are skipped | Saves typing next time | Overlaps „Zuletzt verwendet“ in the add sheet; useless until a history exists |

## Recommendation

**Build `post-shop-entry-sheet` as the capture, and use `trip-journal-by-date` as its history screen.** Leave the other three out of the first build.

1. **Capture is the bottleneck, not browsing.** A log nobody fills is an empty screen. Approach 3 is the only one where logging costs a tap: the items, the store and the day already come from the list. The other four ask people to retype what they just ticked. That gets done a few times and then stops.
2. **The app already has the hooks.** `ListCubit` reports `TripCompleted` when this device's ticks empty the list (DECISIONS, review prompt). Ticked rows keep `store_id`, `bought_by` and `done_at` (foundation migration), so the prefill has real data behind it. A row only remembers its last tick, though. The trip record keeps each shop.
3. **The journal is the right default view.** In the prototype, approach 3's "Verlauf" tab already is a journal. Grouping by week and month answers "what did we get last week?" with no new concepts. "Nach Laden" can come later as a store filter chip on the journal, without a second structure. That keeps P3a's split: trips by store and date, separate from any spend graph.
4. **Calendar and relist don't earn a first release.** At one to three trips a week, a calendar is mostly empty cells and needs a tap to show anything. Relist overlaps „Zuletzt verwendet“. If it ships, it should be one button on the trip page ("Auf die Liste"), not a home screen.
5. **Free.** Logging and browsing your own trips stay Free, as written in the empty states ("Eintragen und Nachschauen sind kostenlos"). Premium stays with prices, trip totals and spend history, which are separate features.

## Open questions for Peter

- **Free vs Premium history.** The prototype keeps every trip Free with no time limit. Alternatives are a window for Free (for example 3 months) with full history in Premium, or Premium only adding prices to trips once `prices-and-trip-total` exists. My lean is no cap. A capped log punishes the capture we want, and Premium already has prices and spend history to sell.
- **Prompt or card.** The prototype shows an inline card on the list ("Einkauf bei Rewe eintragen?" with "Später"). Alternatives are a sheet that opens on `TripCompleted`, or no prompt at all with a silent automatic log you can edit afterwards. An automatic log is the least effort but records trips nobody confirmed.
- **"Kostenlos" in the copy.** The brief asks to keep the Free capture principle in the copy, so every empty state says "Eintragen und Nachschauen sind kostenlos". The Claude review warned that naming "free" unprompted makes people ask what costs money, and that it becomes a promise if any history is ever gated. Decide the boundary first, then whether the app says it at all.
- **When the prompt appears.** The prototype offers logging once a store's section is fully ticked, not on the first tick, so it doesn't interrupt mid-shop. Alternatives are on `TripCompleted` (the whole list is empty) or when the app goes to the background.
- **What logging does to the list.** The prototype removes the logged ticked items from "Abgehakt". The real list's handling of ticked rows has to agree.
- **Several stores in one trip.** The prototype offers one card per store whose items were ticked. One combined trip is simpler but loses "by store".
- **Partners.** Should Ben see Anna's prompt? The prototype follows `TripCompleted`: only the device that ticked. Should any member edit or delete any trip? The prototype allows it.
- **The data model for job 199.** A trip should snapshot its items rather than point at `items` rows. A reused row's `done_at` is overwritten on the next trip (inferred from the „Zuletzt verwendet“ reuse in the review-prompt notes; job 199 should verify this). Linking trip items by `canonical_key` would let suggestions learn from them.
- **Privacy.** A purchase log is new personal data per household member. It needs a row in `docs/PRIVACY_DATA_MAP.md`, retention, deletion with the account and the household, and the API and MCP scopes. Drugstore items can be health-adjacent, and N-127 already treats pharmacy lines as Art. 9 for receipts. Legal should say whether a manual log needs the same care.
- **Receipt input later.** Approved for docs only (N-127). If it comes, it fits as a second way to fill the same sheet ("aus Kassenbon"), never as a requirement. Nothing in the prototype depends on it.
- **Not prototyped.** English copy, dark mode and the 358 px compact layout. The sandbox is German and light only.
