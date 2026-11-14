# Round 2: SS4 for the sheet, BB4 for the bottom, LD4-3T not

**The picks.** On top of Peter's fixed base (B1 to B6):

- **Switcher sheet: SS4 `chips-in-row`.** Today's household sheet stays row for row. Only the shown household's row gains today's list tabs and a "Manage lists" link. The sheet grows by 114 px (the chip track and the link), with two lists as with seven. Renaming, ordering and deleting a list sit one tap deeper on a second page of the sheet. Today they live under More → Household.
- **Bottom area: BB4 `field-is-the-list-tab`.** The tab bar's List tab is the add field: "🛒 What do you need? 🎤 | History | More". On History and More the field folds back into a named "List" tab. The bottom shrinks from 150 to 86 px on an iPhone.
- **LD4-3T loses to LD1's base plus BB4.** Its full-bleed dock with named tabs takes 134 px and shows one row fewer with 25 items (6 against 7). Without LD4's handle (Peter's rule) it is close to BB3 at full width, so the real question is a full-bleed dock against a floating pill.

**Runner-ups.** SS1 `nested-tree` if lists should sit right under their household, at the price of a long sheet with many lists. BB1 `tight-stack` if History and More must keep their labels while on the list: it changes nothing but spacing and saves 22 px.

**What the base takes from LD1.** Beyond B1 to B6, every round 2 phone uses LD1's rows: slim store dividers with the open count and subtotal ("4 · 3,95 €"), a quiet € on rows without a price instead of "+ Preis", and no "Summe dm" line under each store. Rows stay 48 px, so this changes no count by more than the dividers' height, but it is part of what Peter would approve.

## Rows fully visible, 390 × 844, text 100 %

| Variant | Screenshot set | Same, First steps hidden | 25 items, top | 25 items, scrolled 420 px | Bottom (field and tabs) |
| --- | --- | --- | --- | --- | --- |
| Today | 4 | 5 | 4 | 5 | 150 px |
| LD1 (round 1) | 7 | 7 | 7 | 9 | 150 px |
| R2 base = SS1 to SS5 | 5 | 8 | 5 | 9 | 150 px |
| BB1 `tight-stack` | 6 | 8 | 6 | 9 | 128 px |
| BB2 `field-and-icon-tabs` | 6 | 8 | 7 | 10 | 86 px |
| BB3 `one-slab` | 6 | 8 | 6 | 10 | 122 px |
| **BB4 `field-is-the-list-tab`** | **6** | **8** | **7** | **10** | **86 px** |
| BB5 `tabs-hide-on-scroll` | 5 | 8 | 5 | 10 | 150 px, 88 px while scrolling |
| LD4-3T `bottom-dock-three-tabs` | 6 | 8 | 6 | 9 | 134 px |

LD1 is round 1's phone, not on Peter's base: its 7 includes First steps as a one-line nudge and a fixed 28 px total line, which B3 and B4 rule out. R2's 5 is not R2 losing room; it is today's First steps card.

At 130 % text: today 3, R2 5, BB4 6 on the screenshot set, and 6, 9 and 11 scrolled (`items-visible.tsv`). Rows stay 48 px at 130 %, as in the app, so a scrolled count can come out a row higher than at 100 %: it depends on where the 420 px land. The numbers are the same in German and English, light and dark. With First steps hidden the screenshot set has only 8 open items, so 8 is the ceiling. During a job 217 trip (screenshot set) R2 shows 4, BB4 5 and LD4-3T 4.

**Today shows 4, not round 1's 3.** Round 1 stacked a 34 px home indicator under the pill's 12 px gap. The app folds the safe area into the gap instead: pill 52 px plus max(12, 34 − 8) = 78 px (`shell.dart`, `_bandHeight`). So today's bottom is 72 + 78 = 150 px on an iPhone, and every round 2 phone is measured on that geometry. Peter's screenshot showing 3 may come from a smaller phone or larger text. At 130 % today shows 3.

**What B3 costs.** Today's full First steps card takes 3 rows from new users in every variant (R2 5 against 8 once hidden). That is Peter's call (B3). It is dismissible, and the counts with it hidden are in the table.

## Why SS4

- **It keeps what Peter likes.** Every row and action of today's sheet stays where it is: households with invite, the pending request, New household, Join with a code, and Siri, Alexa & AI.
- **List switching stays one tap in the sheet.** The chips are the list tabs people know from today's list screen, moved into the sheet.
- **It scales.** Seven lists or long names make the chip track scroll sideways, not the sheet grow. Measured content height over today's sheet: SS4 +114 px with two lists and with seven, SS1 +199 and +591, SS2 +249 and +588.
- **The trade.** A long list name is a chip of at most 184 px, cut with an ellipsis ("Drogerie & Apotheke" fits, "Geburtstag von Oma Hildegard am Samstag" does not). The full name shows under "Manage lists". SS1 and SS2 show every name in full but grow with each list.
- **SS3 and SS5 hide the households.** SS3 behind a tab and SS5 behind a back step. Peter's point about LD4 applies: people won't find what sits one level away.

## Why BB4

- **The most room.** 64 px less than today, as low as BB2. It brings the screenshot set from 5 to 6 rows and the 25-item list from 5 to 7.
- **One contour, one bar.** BB2 puts three loose hex buttons beside the field. BB4 keeps the pill people know and lets the List tab become the field while you are on the list.
- **Keyboard as today.** A tap on the field brings the keyboard. The field rides on it at full width, the tabs go, and closing brings the pill back. All three tabs, the mic and the field are 48 × 48 px targets (hit-tested).
- **The cost.** On the list, History and More show icons only, with their names for screen readers. The field is 164 px of hint instead of 278 px: "Was brauchst du?" fits at 100 % and shortens from 130 %. BB2's narrower field already cuts it at 100 %.

## Open questions

- **LQ-R1.** Which phone and text size did Peter's screenshot come from? A 390 × 844 iPhone at 100 % shows 4 rows today, not 3.
- **LQ-R2.** BB4 shows History and More as icons only while on the list. Is that fine, or must the labels stay (then BB1)?
- **LQ-R3.** With SS4, list management sits in the sheet ("Manage lists"). Should the Lists section under More → Household stay as a second way in, or go?
- **LQ-R4.** Switching household in the sheet opens which list: its first list (the prototype) or the one last shown in that household?
- **LQ-R5.** The see-through header blurs the list under it (B2). Flutter's backdrop blur costs frame time on older Android phones and the web build. Is a 92 % opaque surface without blur fine where blur is slow?
- **LQ-R6.** BB5's idea (tabs step aside while scrolling down) also works on top of BB4: the pill would then fold to the field alone while scrolling. Worth a follow-up, or one moving part too many?

## What is not decided here

This is a prototype only. Nothing in the app changed. The building job starts after Peter picks one SS and one BB label.
