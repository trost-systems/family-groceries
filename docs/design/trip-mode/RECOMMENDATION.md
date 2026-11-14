# Trip mode: recommendation and open questions (job 217, 14 Nov 2026)

Peter picks. Nothing here is built in the app. After the pick, the lead writes the production job: it ships behind a PostHog flag that is on for internal installs only.

## Recommendation: TM1 `card-ask-slim-strip`, with two parts taken from the others

Build TM1's question, bar and summary page. Take two parts from the other prototypes:

- **End at the last tick (TM2, TM5).** Every proposed or automatic end uses the time of the last tick, so a trip forgotten in a pocket still says 6 minutes and not 4 hours.
- **The Premium card from TM2, inside TM1's page, without the blur.** Free members see the date, the stores and how long they shopped. Below that is one calm card: "Was war geplant, was kam dazu?".

The reasons:

1. **The question doesn't stop the shop.** TM1's card sits on top of the list and stays there while you scroll. You can keep ticking, and the ticks you make before you answer still count, because the trip starts at the tick that raised the card. TM2's sheet blocks the screen on the first tick of every shopping day. TM5 asks for a second tap on every first tick. TM3's snackbar is gone after 6 seconds; it asks once more on the third tick, and after that the shop goes untracked unless it is started by hand.
2. **"No" is cheap and stays answered.** "Nein" holds until 2 hours pass without a tick. That is one shopping session, so ticking off the next item does not ask again (S6). The next trip, hours later, asks again. If the "no" was wrong, Mehr › „Einkauf starten“ starts a trip by hand; the snapshot is the list as it is then. TM2's "rest of the day" misses a second shop in the evening. TM4's per-store memory only matters to households with several stores.
3. **The bar is visible and costs one row.** The 52 px strip adds 60 px to the bottom area (140 → 200 px on a 390 × 844 phone). It never covers the add field or the tabs, the drive checks this at every step, and it leaves while you type. TM3 and TM5 cost 0 px, but each loses something. TM3 needs two taps to end and hides its stopwatch among the tabs. TM5 takes the tabs away during the shop. Both also collide with job 227's BB4, where the tab pill becomes the add field. The strip is also where job 223's LD1 puts the price total during a trip.
4. **Two stores need no new idea.** "Pause" for the drive keeps the time honest: 18 minutes, not 33 (S2). The summary names both stores and tags each row with its store. TM4's laps answer "how long at Rewe?", which nobody asked. Keep them for later if Peter wants that number.
5. **The summary is a page you can come back to.** It is the same page at the end of the trip and on its Verlauf entry, which is Peter's "on each grocery-log history entry". It shows approach 1 as chosen in job 197: "Beim Start auf der Liste" with each item ticked or "nicht gekauft", then "Seit dem Start dazugekommen" with "von Lea" and "War geplant".
6. **The gate respects the household's own data.** A blurred list of your own groceries reads as holding them back (TM1). Showing the counts for free (TM5) gives away most of the value. A one-time free summary (TM3) is a product call, see TQ8. TM2's card says what Premium adds, with no price and no blur.

Ranked: TM1 (with the two changes), TM2, TM4, TM3, TM5.

## What the drive proved

A Claude review (VERDICT FIX, 14 Nov 01:03) found seven must-fixes, all fixed:

- "Läuft noch" on the nudge now holds for another quiet window. It used to come back within a second.
- "Doch weiter" after an automatic end no longer ends the trip again at once.
- A paused trip is nudged or ended like a running one.
- TM3's question waits during a scenario step.
- TM4 counts ticks made while the question waited, and times each store over all its visits.
- TM4's current store time runs.
- The panel now gives TM1's bar its real height.

Every repro is now a check in `shoot.mjs`.

`shoot.mjs` passed every check: six scenarios × five prototypes, Premium and Free, plus the phone layout. It checks state (snapshot, start time, duration, pauses, frozen summary), copy and layout (nothing of the trip over the field, tabs or keyboard; every control at least 44 × 44 px; no price). The layout checks fail when they should: with the bar's buttons at 34 px, 84 checks fail, and with the bar pushed 40 px down onto the field, 42 checks fail. In S3 a real page reload brings the trip back with the stopwatch at 17 minutes (7 before, 10 closed).

## Open questions

- **TQ1. Where does a running trip live?** In the prototypes it lives on the device, so it survives a restart but not a reinstall or a second phone. On the server, Lea could see "Peter kauft gerade ein" and her app could stop asking her. Recommendation: server-side (one row per trip in the household), shown only on the starter's devices at first.
- **TQ2. Two shoppers.** If Lea ticks items while Peter's trip runs, the prototypes count them as bought on his trip. Should they count, or should her first tick ask her about her own trip?
- **TQ3. How long does "Nein" hold?** TM1 holds it for 2 hours without a tick, TM2 for the rest of the day, TM3 for two ticks or 3 hours, TM4 for a store until tomorrow, and TM5 for 30 minutes. A setting "Beim Abhaken nicht mehr fragen" (in Mehr) would cover households that never want trips.
- **TQ4. The long-running rule.** The recommendation is a nudge in the strip after 2 hours without a tick (paused or not), ending at the last tick; "Läuft noch" asks again 2 hours later. Should there also be a silent end, for example after 6 hours, for a phone that is never opened again? Should the nudge also arrive as a notification (TM3)? The app has no push notifications for this today.
- **TQ5. Do ticks during a pause count?** They count in the prototypes (you may tick at home while unpacking). The other choice is that a pause freezes the trip.
- **TQ6. Items someone else added but nobody bought.** The prototypes list them under "Seit dem Start dazugekommen" as "nicht gekauft · von Lea". Should they show at all, or only on the list?
- **TQ7. Items you add yourself mid-trip.** These are extras with no "von", such as the Eis in S1. "War geplant" fixes one that was forgotten at home. Should the app treat items added in the first minutes as planned? A related edge: an item ticked before the trip, then unticked and bought during it, shows as "dazugekommen" although nobody added it.
- **TQ8. The Free gate.** The recommendation is TM2's card with no blur, and the duration stays free. The alternatives are TM1's blur, TM5's free counts, TM3's one free summary and TM4's lock row in Verlauf only. Is the stopwatch itself free? It is in all five.
- **TQ9. Trip mode and the grocery log (#394).** A finished trip already holds the store, the day and the ticked items. Should ending it log the grocery-log trip and replace the card "Einkauf bei Lidl eintragen?"? The prototypes keep them apart. One record is simpler, and it is what "the summary on each history entry" needs.
- **TQ10. A trip across two stores in the log.** A grocery-log trip is one store on one day. Should a two-store trip become two log entries that share one summary, or should the log allow several stores per trip?
- **TQ11. The bottom area after job 227.** If BB4 (the field is the List tab) ships, the strip sits over an 86 px bottom area instead of 150 px. Should the strip carry job 223's price total during a trip, as LD1 proposes?
- **TQ12. Ending by mistake.** The summary offers "Weiter einkaufen" right after an end, and the gap counts as a pause. How long should that undo stay?
- **TQ13. Privacy and analytics.** Start time, duration and who added what are new personal data per member. They need a row in `docs/PRIVACY_DATA_MAP.md`, retention, deletion with the account, and allow-listed events (`trip_started`, `trip_ended` with a duration bucket, no item names).
- **TQ14. Not prototyped.** English copy, dark mode, 130 % text, the 358 px compact layout and the tablet rail. The recommended strip has the least text, so it is the easiest of the five to fit at 358 px.
- **TQ15. A visible manual start.** Every prototype now has „Einkauf starten“ in Mehr, for a "no" that was wrong or a missed question. Should it also sit somewhere visible on the list, for example under the store row, or is Mehr enough?
