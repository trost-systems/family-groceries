# Totals per store: ST3, the summary block

**The pick: ST3 `summary-block`.** Where R2 has its total row, above "Recently used", one block lists each store (name, "2 unpriced", subtotal) and ends with "Total". It is what Peter asked for, read top to bottom like a receipt: the sums per store, then the final one. A tap on a store line jumps to that store's section. A long store name shows in full in its line; only the dividers cut it at 168 px.

**Why ST3.**

- **It costs no row at the top of the list.** The block sits where the total already is, at the end of the open items. At the top, ST3 shows as many rows as R2 in every case measured (6 with three stores at 100 %, 8 with First steps hidden, 4 at 160 %). The block costs 190 px at the end of the list with three stores at 100 % (a two-line line per store plus the heading). A long store name shows in full and wraps; at 160 % the block costs 331 px.
- **All numbers sit in one place.** You can check that the subtotals add up without scrolling between stores. R2 already printed a store's sum on its slim divider ("4 · 10,05 €"), and Peter still asked for subtotals. A small number at the top of each section is easy to miss.
- **Nothing disappears.** A store ticked off in full stays in the block, marked "all bought", so the lines always add up to the total. Today the store's sum line goes with its section.
- **One store, one row.** With a single store the block is the R2 total row and nothing more. A subtotal there would repeat the total.

**The trade.** While you shop in one store, its subtotal sits at the end of the list, not next to the store. The store line's jump helps one way only. If the sum must stay in view while you shop, ST1 is the runner-up.

**Runners-up.**

- **ST1 `subtotal-on-divider`.** The subtotal sits on each store's divider, with "4 open · 2 unpriced" small above it. It is R2's divider made readable, plus a divider that stays for a store bought in full. It costs one row at the top at 100 % (5 against 6): the two-line divider is 44 px, not 36.
- **ST4 `expandable-total`.** It is as short as R2 (+10 px) until tapped. The subtotals cost a tap and are not seen by default.
- **ST2 `section-foot`** is today's app ("Total dm" after each store, job 190). It costs a line per store inside the list and one row with First steps hidden. **ST5 `chip-line`** is compact but has no room for "unpriced" per store.

## Rows fully visible, 390 × 844, German, light

Same in English and dark (`st-items-visible.tsv`). "Top" is with today's First steps card (B3), "hidden" with it closed.

| Data | Text | Today | R2 | ST1 | ST2 | **ST3** | ST4 | ST5 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 3 stores | 100 %, top | 3 | 6 | 5 | 6 | **6** | 6 | 6 |
| 3 stores | 100 %, hidden | 6 | 8 | 8 | 7 | **8** | 8 | 8 |
| 3 stores | 130 %, top | 2 | 5 | 5 | 5 | **5** | 5 | 5 |
| 3 stores | 160 %, hidden | 6 | 8 | 7 | 7 | **8** | 8 | 8 |
| 3 + no store | 100 %, top | 3 | 6 | 5 | 6 | **6** | 6 | 6 |
| 1 store | 100 %, top | 3 | 6 | 6 | 6 | **6** | 6 | 6 |

List height over R2 (`st-height-vs-r2.tsv`). With three stores at 100 %: ST1 +24 px, ST2 +108, ST3 +190, ST4 +10 folded, ST5 +96. With one store: 0 at 100 and 130 %, +29 px for every ST variant at 160 % (the line under the total wraps, ST-Q6). With "Ohne Laden" the line reads "3 stores + no store · …" and wraps at 100 % too (+18 px).

## How items without a price count

An item without a price adds nothing. Each store line says how many of its open items have no price ("2 unpriced"), and the total says it for the list ("3 stores · 10 priced · 4 unpriced"). A ticked item with a price still counts, as in job 190's total. Weighed items count with their line total ("846 g Bananas €1.51"). "No store" is a group with a line and subtotal of its own, but not a store: the total's line says "3 stores + no store".

## Open questions

- **ST-Q1.** With items still unpriced, should the total read as a floor ("at least €32.08" or "€32.08 + 4 unpriced")? The prototype only counts them in the line under it.
- **ST-Q2.** Subtotals count ticked items, as job 190's total does. Should the block split bought and still open ("€12.40 bought · €19.68 open")?
- **ST-Q3.** "No store" is a group with its own subtotal in the prototype. Keep it, or fold it into the total only?
- **ST-Q4.** A weighed item shows its line total from the planned weight until it is weighed. Should that line be marked as an estimate ("≈ €1.51")?
- **ST-Q5.** With ST3, the store dividers show only the open count. Should they keep R2's small sum too (the same number twice), or stay count only?
- **ST-Q6.** The line under the total says "10 priced · 4 unpriced" instead of the app's "10 priced · 4 open". At 160 % it wraps to a second line (+29 px with one store). Is the clearer word worth the line? The two counts also differ in base: "priced" counts ticked items (they are in the sum), "unpriced" only open ones (still to price). After dm is bought in full the line reads "10 priced · 3 unpriced": the ticked Tissues without a price drop out. Keep that, or count both over the same items?
- **ST-Q7.** ST3's store line jumps to its section, but nothing jumps back to the total. Is a way back worth adding (a "Total" link on each divider, or a scroll-to-end button while the block is out of view)?

## What is not decided here

This is a prototype only. Nothing in the app changed. Job 229 builds Peter's round 2 pick (R2 with SS5). The ST pick would go on top of it behind the same flag.
