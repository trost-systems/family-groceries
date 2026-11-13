# Recommendation: price entry and trip total

Job 189, 12 Nov 2026. These are throwaway prototypes for Peter's choice in job 190. They are not approval to build, and nothing here ships. Price entry and the trip total are Free for everyone (t788u), so no approach has a paywall or a Premium step.

## What was compared

The same synthetic Lidl list (7 items) runs through all five approaches. You enter Vollmilch, edit Butter, try the four errors, change a quantity, price loose bananas by weight and a two-pack of water, and read the total. Each approach ends on the same trip: **13,62 €** with 4 items priced and 3 open. The Playwright run checks this in all five (`sandbox/e2e/scenario.spec.ts`).

## Recommendation: 1 · `inline-row-price`

Build price entry on the list row, with the trip total pinned below the list.

- **Fewest steps where the price is.** In the shop you are already looking at the row. Tap "+ Preis", type 1,19 and press Enter. That is one tap and a number, and the row and total change at once. The sheet (2) takes two more taps per item, and the review (3) adds a whole mode.
- **The total is always on screen.** It sits in a bar under the list with "4 mit Preis · 3 offen", so it is clear what is missing. Like 2 and 4, it moves when a price is saved (Enter or "Fertig"), not while you type. The difference is where it lives: 1 has the full bar, 2 and 4 have a small chip in the header (2 covers it with the sheet's scrim, 4 shows "OK · Summe …" on the button), and 3 shows it only in the review mode.
- **System keyboard.** It uses the system's number keyboard (`inputMode="decimal"`), so screen readers, hardware keyboards and paste work for free. The custom keypad (4) is faster to type on, but we would have to build all of that ourselves.
- **Room to grow into 5.** When last-price memory ships, the empty "+ Preis" chip can show last time's price as a ghost suggestion with a one-tap accept. Approach 5 then becomes a layer on top of 1, not a second design. On a first trip with no history, 5 is just 1 without suggestions.

Take these from the others:

- From 2, the unit switch (piece, pack, kg) and "Summe danach", if Peter wants either at price time.
- From 4, blocking letters as you type, so only empty, zero and too large remain as errors. 4 shows this already: typing "abc" changes nothing, so its invalid-input case has no message to show.
- From 5, the price compared with last time ("0,30 € teurer als zuletzt") once there is history.
- From 3, the end-of-trip summary ("Summe 13,62 €, 3 Artikel ohne Preis, Nachtragen") as a later screen for people who enter prices from the receipt at home.

Where 1 is weakest: while the row is open it is tall, about 40 % of the phone with price, weight, "pro kg / vom Etikett" and the buttons. The prototype doesn't show the phone keyboard. With it up (roughly another 40 %), only the open row and the total bar stay in view, which is about what 4's keypad leaves too, so the screenshots flatter 1 here. The production design should shrink the open row. Second, you cannot switch an item between piece, pack and kg there. Only the sheet (2) can do that. If Peter expects people to fix units at price time, 2 is the runner-up.

Two honest limits of this comparison. First, 5 shares 1's edit panel, so it is really "1 with suggestions": four different ways to enter a price, plus one way to skip entering. Second, 5 must not look like ticking an item off. The first version used the mint hex check, which Snacklist uses for "bought". It now uses a cobalt € mark and leaves the row white, but the production design needs one clear answer for price versus tick (first open question).

## Ranking

- **First,** `inline-row-price`: best everyday fit, total always in view.
- **Second,** `item-sheet-price`: most complete (unit, quantity, "Summe danach"), slower per item.
- **Third,** `last-price-confirm`: fastest once there is history, but it depends on last-price memory and invites accepting suggestions unchecked. Best as a layer on 1.
- **Fourth,** `focused-price-keypad`: fastest typing, but a custom keyboard costs accessibility work and hides most of the list.
- **Fifth,** `trip-review-list`: good for receipt-at-home entry, but it adds a separate mode and the order rarely matches the receipt.

## Open questions for Peter

- **Price and tick.** Does saving a price also tick the item as bought, or are they separate? All five keep them separate.
- **What a trip is.** Is it one store's section, the whole list, or everything ticked since a start time? The prototypes total the single Lidl section.
- **Line price, then quantity changes.** Should a typed line total ("gesamt") stay when the quantity changes, or the unit price? The prototypes keep the line total.
- **Weight on the list.** Should the list keep a planned weight ("846 g Bananen") that the scale weight replaces, or should weight only be asked at price time?
- **Limits.** The prototypes allow 0,01 € to 999,99 € per item and up to 20 kg. Should a price of 0 or a deposit return (negative) be allowed?
- **Who sees it.** Should the other household member see prices and the total live, or only the person who entered them?
- **Currency.** The prototypes assume euros only.
