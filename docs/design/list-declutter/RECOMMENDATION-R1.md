# Recommendation: LD1 `slim-chrome`, with LD3's trip bar taking the total

Round 1 (job 223). Its counts stack a 34 px home indicator under the tab pill. The app folds it into a 26 px gap instead (`shell.dart`, `_bandHeight`), so round 2 counts one row more for today and LD1. Round 2 has the corrected numbers.

**The pick.** Keep today's structure and make every band thinner:

- The header becomes job 205's two-line button. The household sits small above the list name, Anpassen stays on the right, and the list tabs row goes.
- First steps shrink to a one-line nudge. A tap opens the full card as a sheet, and the X hides it as today.
- The store row drops to 36 px: badge, rule, open count, subtotal and the fold chevron.
- A row without a price shows a quiet € mark with a 48 × 48 px tap target, as large as today's price button. A row with a price shows the amount chip.
- The shopping total becomes a 28 px line above the add field.
- The add field, the mic and the tab pill stay as they are.

From LD3 take one thing. While a job 217 trip runs, the total moves into the trip bar, so the screen never stacks two bars.

**Why.** It doubles what fits and asks nothing new of anyone.

| Variant | Screenshot set | 25 items, top | 25 items, scrolled 420 px |
| --- | --- | --- | --- |
| Today | 3 | 3 | 5 |
| LD1 `slim-chrome` | 6 | 7 | 9 |
| LD2 `collapsing-header` | 5 | 5 | 8 |
| LD3 `plan-and-shop-modes` (planning) | 7 | 7 | 10 |
| LD4 `bottom-dock` | 8 | 9 | 11 |
| LD5 `list-owns-the-chrome` | 6 | 7 | 10 |
| LD1 during a job 217 trip | 6 | | |
| LD3 during a trip | 6 | | |

The table counts items whose whole row is visible on a 390 × 844 phone with the iPhone status bar (47 px) and home indicator (34 px), in German and English, light and dark. `shoot.mjs` measures it, and the numbers are the same in every language and theme. Today's rebuild matches the real web build to within 4 px per band (rows within 1 px, the First steps card within 4). The web build shows 4 items because it has no status bar or home indicator. On a phone that becomes 3, as in Peter's screenshot.

- **No new gesture, no new state.** LD1 keeps tap to tick and hold to edit. Every control stays where it is today.
- **It fits 205 and 217.** The header is 205's recommended button. In LD1 the first tick asks 217's "Kaufst du gerade ein?", and during the trip the 217 trip bar takes the strip's place, so LD1 still shows 6. Neither job has to change.
- **It is cheap to build.** It is mostly a restyle of existing widgets, behind the same flags.

**Why not the others.**

- **LD4 `bottom-dock`** fits the most (8). It replaces the tab pill with a More button, moves list switching, Anpassen, the total and First steps behind a handle, and adds a big title that scrolls away. That is a lot to relearn for one or two more rows over LD1. Keep the dock idea in case the tab bar grows.
- **LD3 `plan-and-shop-modes`** fits 7 while planning. But people who enter prices at home would have to start a "trip" to see a price chip, and a two-state screen is a new idea to explain. It is the better long-term answer if 217's trip mode ships and people use it. The borrowed trip-bar total is the first step toward it.
- **LD2 `collapsing-header`** fits only 5 at first, because everything is still at the top until you scroll. After a scroll it shows 8. Moving headers also cost motion and complexity.
- **LD5 `list-owns-the-chrome`** needs a swipe for prices. Since job 78 a swipe does nothing on a row, on purpose, and hidden swipes are hard to discover. The quick-return header also moves on every direction change.

**Borrow later, if needed.** LD2's mini bar can come on top of LD1 if the 25-item list still feels long. LD4's dock is the move if the tab bar ever needs the room.

## Open questions

- **LQ-D1.** Is a quiet € mark enough to find prices? The alternative is no mark at all, with the price in the hold-to-edit sheet as in LD4. Both keep the amount chip on rows with a price.
- **LQ-D2.** The line in today's store row is a decorative accent rule, not progress. The brief calls it progress. Should store rows show real progress ("2 von 4 gekauft")? That needs 217's trip snapshot to mean anything.
- **LQ-D3.** First steps as a one-line nudge plus a sheet: is one extra tap to see the steps acceptable while the card is still open?
- **LQ-D4.** Should the total line show always, or only once something has a price today? Today's bar shows whenever the list has items. Hiding it at zero prices saves 32 px more for everyone who never enters a price.
- **LQ-D5.** LD1 depends on 205's pick. With `stacked-two-line` the tabs row goes. If Peter picks another 205 variant, LD1 still works with that bar.
- **LQ-D6.** If 217's trip mode ships, should the planning chrome hide during a trip, as in LD3? That would be a follow-up after both land.
- **LQ-D7.** Rows stay 48 px everywhere. 44 px rows would add about one more item. Is that worth a separate test?
- **LQ-D8.** Without the tabs row, switching lists takes two taps instead of one, and "New list" moves into the sheet. Is that fine for households that switch often (for example between "Einkaufsliste" and "Party")? Or should LD1 keep a compact tab affordance?
