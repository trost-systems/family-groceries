# Prices, store subtotals and the shopping total

Behind the PostHog flag `prices-and-trip-total` (rollout off in `releases/flags.json`), every row on the list carries a small hex chip at its end: „+ Preis“ / "+ Price" without a price, else the line's total („2,38 €“). A tap on the chip opens a price editor under the row; a tap on the rest of the row still ticks it. Saving a price never ticks the item, and ticking never asks for one. Each store section ends with „Summe <Laden> <Betrag>“ / "Total <store> <amount>", and a bar under the list shows „Einkaufssumme“ / "Shopping total" with „N mit Preis · M offen“ / "N priced · M open" and the sum of the shown list, all stores together. The household page gets „Währung“ / "Currency" (default EUR); any member changes it, for everyone. Prices, subtotals, the total and the currency reach the other members live. It is Free: no Premium check anywhere.

## Sub-features

- `pr-chip` the row's chip, its own button for screen readers: „Preis für <Name>“ / "Price for <name>" without a price, „Preis für <Name>: <Betrag>, ändern“ / "Price for <name>: <amount>, change" with one. The amount is the line's total in the price's own currency. A second tap on the chip closes the editor.
- `pr-editor` the editor under the row: the price field „Preis“ / "Price" (decimal keyboard, the currency's sign after it), next to it a stepper („Eins weniger“, „Menge <n>“, „Eins mehr“) for pieces or the field „Gewicht in kg“ / "Weight in kg" (or „Menge in l“ / "Amount in l") for a price per kg or l, the segmented choice „Preis gilt“ / "Price is" with „Gesamt“ / "Total" and „pro Stück“ / „pro kg“ / „pro l“ ("per item", "per kg", "per l"), the unit menu („Stück“, „kg“, „l“), one line with the other value and the total after it („Zusammen 2,38 € · Summe danach 2,38 €“, or „Das sind 0,69 € pro Stück · …“ for a typed total), and „Abbrechen“ / „Fertig“ ("Cancel" / "Done"). Enter saves too; Escape closes. With a price there is also a bin icon „Preis entfernen“ / "Remove price". While the editor is open the add bar steps aside.
- `pr-unit-price` the unit price is what is kept. A typed „Gesamt“ is divided by the quantity at save; when the quantity changes later the unit price stays and the line scales (2 Joghurt typed as 1,38 € Gesamt, then 3: 2,07 €).
- `pr-weight` an item whose quantity is a weight („846 g“, „1,2 kg“) opens per kg with the planned weight in „Gewicht in kg“ (0,846). The shopper types the price per kg or, with „Gesamt“, the price on the scale's label; saving writes the weighed amount back as the item's quantity („1,02 kg“). Volumes („500 ml“, „1,5 l“) work the same per l.
- `pr-stepper` for pieces the stepper starts at the row's count (2 for „2 Milch“); saving another count changes the item's quantity.
- `pr-input` the fields drop what cannot become a number as it is typed: letters, a second comma, a third decimal in the price, a fourth in the weight. A leading minus is allowed in the price only.
- `pr-limits` a line from −9.999,00 to 9.999,00 in the household currency; 0 and negative (deposit returns) are allowed. Weight and volume over 0 and up to 50 kg or 50 l. Messages: „Gib einen Preis ein.“, „Höchstens 9.999,00 € pro Artikel.“, „Gib das Gewicht ein.“, „Das Gewicht muss über 0 g liegen.“, „Höchstens 50 kg.“ (and the „Menge“ versions for litres).
- `pr-last-time` when the same thing (same item or another spelling of it) had a price on an earlier day, the editor's line adds „0,30 € teurer als zuletzt“ / „billiger als zuletzt“ / „Wie zuletzt“ ("more than last time", "less than last time", "Same as last time").
- `pr-today` a price counts for the total on the day it was entered (the device's calendar day). From the next day the chip shows „+ Preis“ again, and the old price is only last time's.
- `pr-subtotal` each store section with a priced item ends with „Summe <Laden> <Betrag>“, also „Summe Ohne Laden …“.
- `pr-total` the bar under the list, one screen-reader text „Einkaufssumme <Betrag>, <N> mit Preis, <M> offen“. It sums the shown list's items with today's price in the household currency, open and ticked ones; „offen“ counts open items without one. With several lists each tab has its own total. The bar shows only while the list has items.
- `pr-currency` household page „Währung“: a row „EUR · €“ with „Für Preise und die Einkaufssumme, für alle im Haushalt“; a tap opens „Währung wählen“ with 15 codes (EUR, CHF, GBP, USD, PLN, CZK, SEK, DKK, NOK, HUF, RON, BGN, TRY, CAD, AUD). Amounts are written the way the app's language writes them („1,50 CHF“). A price typed before a change keeps its own currency on its row and leaves the total until it is entered again.
- `pr-live` another member sees a saved price, the subtotals, the total and a currency change within a couple of seconds, without a reload.
- `pr-flag-off` without the flag: no chip, no editor, no subtotal lines, no total bar, no „Währung“.

## How to get to it (user POV)

- List tab: the chip at a row's end („+ Preis“ / "+ Price", or the amount).
- The total bar right above the add bar, „Einkaufssumme“ / "Shopping total".
- „Mehr“ / "More" → the household („Unser Haushalt“, or its name) → section „Währung“ / "Currency".

## Driving it with Playwright

Preconditions:

- A build with the flag on. The e2e build gets flags only from the fake PostHog collector, after an analytics yes: `fakeCollector(context, { flags: { 'prices-and-trip-total': true } })` before `newPage()`, then `signUp(page, email, '/', { consent: 'accept' })`. The verify-snacklist build: `VH_DEFINES="FLAGS_ON=prices-and-trip-total" helpers/launch.sh` (SKILL.md, "Launch").
- For subtotals the household needs two stores (`createHousehold(page, { stores: ['Lidl', 'dm'] })`, or `add_store` for the seeded household) and items moved with `setStore` (`e2e/tests/catalog.ts`).

- **Chip.** `page.getByRole('button', { name: /^Preis für Milch(: .*)?$/ })`. Its amount uses a no-break space before the sign: match money with `\s` (`/^Preis für Milch: 2,38\s€, ändern$/`).
- **Enter a price.** Click the chip, `typeInto(page.getByRole('textbox', { name: 'Preis', exact: true }), '1,19')`, `page.getByRole('button', { name: 'Fertig', exact: true }).click()`. Observable: the textbox is gone, the chip's name carries the line, `itemRow(page, 'Milch')` is still there and `not.toBeChecked()`.
- **Editor line.** A text node of its own inside the open row's group („Preis für Milch“), not part of the group's name: `page.getByText(/^Zusammen 2,38\s€ · Summe danach 2,38\s€$/)` (driven 2026-11-13 on the release web build with `FLAGS_ON=grocery-log,prices-and-trip-total`; a group-name match finds nothing).
- **Gesamt.** `page.getByRole('radio', { name: 'Gesamt', exact: true }).click()` before typing.
- **Weight.** Set the quantity first (`openEdit`, `typeInto(editField(page, 'Menge'), '846 g')`, `saveEdit`). In the editor `expectFieldValue(page.getByRole('textbox', { name: 'Gewicht in kg', exact: true }), '0,846')`; type the price and `1,02`, Fertig. Observable: `itemRow(page, 'Bananen 1,02 kg')`, chip `2,03 €`.
- **Letters.** Click the price field, `page.keyboard.type('1a2b,5xc9')`: value `12,59`; `page.keyboard.insertText('Milch')` leaves it at `12,59`.
- **Subtotal.** `page.getByText(/^Summe Lidl 2,38\s€$/)`.
- **Total.** `page.getByText(/^Einkaufssumme 5,83\s€, 2 mit Preis, 1 offen$/)` (a text node with the whole sentence).
- **Currency.** `openMore(page, 'Unser Haushalt')`, `wheelTo` then click `page.getByRole('button', { name: /^EUR · €/ })`, then `page.getByRole('radio', { name: 'CHF', exact: true }).click()`. Observable: the row reads `CHF`; the other member's total reads `Einkaufssumme 0,00 CHF, …` without a reload.
- **Live.** A second browser context joined with `createInviteCode` and `joinWithCode`, with its own `fakeCollector` and consent yes; wrap its checks in `within(3_000, …)`.
- **Spec coverage.** `e2e/tests/prices.spec.ts`: flag off; price without tick, two stores' subtotals, the total and a negative line, live for the partner; currency change live; letters dropped; scale weight and a typed total that keeps its unit price. Run `scripts/verify.sh --only e2e -- tests/prices.spec.ts`. Screenshots: `docs/screenshots/190/`.

## Gotchas

- Flags load only after an analytics yes. A spec or journey that declines (the helpers' default) never sees the feature, and `isOn` stays false without an error.
- `reveal`, `tick` and `listArea` measure from the add field, which is hidden while the editor is open: close the editor before using them.
- Ticking still works with the chip there: click the row's middle (`itemRow(...).click()`), not its end.
- The chip names a price in its own currency; after a currency change an old price stays „1,19 €“ on its row while the total, in the new currency, leaves it out and counts the item as „offen“.
- A price saved yesterday no longer counts: a run that crosses midnight, or a seed with an old `priced_at`, shows „+ Preis“ and a lower total.
- While the editor is open on a 480x900 window, the floating tab pill („Liste“ / „Mehr“) sits over the total bar's left side and hides part of „Einkaufssumme“ and the counts (seen in `docs/screenshots/190/prices-02-editor.png`, 2026-11-13).
- The unit menu's button is named „Menü anzeigen Einheit: Stück“ (the menu's own tooltip comes first).
- Prices are not in the public API, MCP, Siri or Alexa answers (from code: no function reads the price columns, 2026-11-13).
