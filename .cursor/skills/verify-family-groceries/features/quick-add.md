# Quick add

Opening the app puts the cursor in the add field with the list visible beneath it, so a user can type an item and press Enter without tapping anything. Focus stays in the field for the next item. A tap on an item's row ticks it: the row leaves the list and an undo snackbar shows. Ticked items move to "Zuletzt gekauft", where one tap puts them back. While typing, up to five chips under the field offer what the household bought or added before, with the quantity it last had. With the field empty, a "Brauchen wir wieder?" row offers what is due again. A chip tap adds the item and leaves the cursor in the field.

## Sub-features

- `qa-autofocus` puts the cursor in the add field ("Was fehlt?") when the app opens on the list screen.
- `qa-enter` adds the typed item on Enter and clears the field.
- `qa-keep-focus` keeps focus in the field, so the next item needs no tap.
- `qa-quantity` splits a leading number into the quantity ("2 Äpfel" is stored as Äpfel with "2"; the row reads "2× Äpfel", "2 l Milch" reads "2 l Milch").
- `qa-duplicate` refuses an item already on the list with "<name> steht schon auf der Liste".
- `qa-send-button` adds through the send icon ("Hinzufügen") instead of Enter.
- `qa-tick-undo` ticks an item off with a tap on its row, shows "<name> abgehakt" with "Rückgängig", and undo restores it in its place.
- `qa-delete` deletes an item with a left swipe ("<name> gelöscht", undo).
- `qa-readd` puts an item from "Zuletzt gekauft" back on the list ("<name> steht wieder auf der Liste").
- `qa-suggest` shows up to 5 chips (key `suggestion-<name>`, label "<quantity> <name>", semantics "Vorschlag: <quantity> <name>") for usuals whose name, or a word of it, starts with the typed text. Items already on the list are left out.
- `qa-suggest-tap` adds a chip's item with its last quantity, clears the field and keeps focus in it, so Enter adds the next item.
- `qa-due` shows "Brauchen wir wieder?" and chips for due items while the field is empty: at least 2 purchases on different days, and the usual gap since the last one has passed (up to 4 times the gap; DECISIONS 8.2).
- `qa-suggest-offline` keeps the suggestions in the list snapshot, so the chips work without a connection.

## How to get to it (user POV)

- Open the app while signed in to a household. The list screen is the home screen.
- Type in the field at the top and press Enter, or tap the send icon at the field's right end.
- Tap an item's row.
- Swipe an item to the left.
- Expand "Zuletzt gekauft" at the bottom of the list and tap an entry or its "+" button.
- Type the start of something bought before ("Mi") and tap a chip under the field.
- Open the app with the field empty and tap a chip in the "Brauchen wir wieder?" row.

## Driving it with fg

Preconditions:

- Baseline from `features/README.md`; peter signed in (`fg doctor` shows `peter.marionette ... screen list`).
- None of the test items are active: `fg db query "update items set status = 'bought' where status = 'active' and name in ('Milch', 'Äpfel', 'Brot') and household_id = (select id from households where name = 'Familie Test')" --write`.

- **Open the app.** Quit and reopen it. Run `fg restart`. On linux, if `fg find --key login-email` returns a match, run `fg login peter` (see Gotchas). Then run `fg wait --key add-item-field`. The list screen shows. Run `fg screenshot --name qa-autofocus-opened`: the field has a cursor and a highlighted border.
- **Type without tapping.** Type into whatever has focus and press Enter. Run `fg type --input Milch --submit` (no matcher means the focused field). `fg wait --text Milch` succeeds, and the field is empty again. If the field had no focus, `type` fails with `no_focus`. That failure means `qa-autofocus` is broken.
- **Add the next item.** Run `fg type --input "2 Äpfel" --submit` and `fg wait --text "2× Äpfel"`: the row reads the quantity first. `fg find --row "2× Äpfel" --type Semantics` returns the label "Äpfel\n2".
- **Duplicate.** Run `fg type --input milch --submit`. `fg wait --contains "steht schon auf der Liste"` matches, and `fg db query "select count(*) from items where status = 'active' and name ilike 'milch'" --as peter` returns 1.
- **Send icon.** Run `fg type --key add-item-field --input Brot`, then `fg tap --x 372 --y 88`. That is the send icon at the field's right end on the 412-wide window. Neither `fg find` nor `fg tap --tooltip Hinzufügen` reaches the icon, so derive it from `fg find --key add-item-field` (right edge minus 24, vertical middle). The field is empty again (`fg find --key add-item-field` shows no `text`), and `fg db query "select count(*) from items where name = 'Brot' and status = 'active'" --as peter` returns 1. Don't prove this step with `fg wait --text Brot`: it matches the typed text in the field before the tap.
- **Tick and undo.** Run `fg tap --text Milch` (a tap anywhere on the row ticks it), then `fg wait --text Milch --gone` and `fg wait --contains "Milch abgehakt"`. Run `fg tap --text Rückgängig` and `fg wait --text Milch`: the row is back in its section.
- **Delete.** Run `fg swipe --row Brot --direction left`, then `fg wait --text Brot --gone`. Within a few seconds, `fg db query "select count(*) from items where name = 'Brot' and status = 'active'" --as peter` returns 0 (bought Brot rows from earlier runs stay).
- **Re-add from history.** Tick Milch again (`fg tap --text Milch`), then run `fg marionette -- scroll-to --text "Zuletzt gekauft"`, `fg tap --text "Zuletzt gekauft"` and `fg tap --row Milch --type IconButton`. `fg wait --contains "steht wieder auf der Liste"` matches, and Milch is back in its section.
- **Suggestions while typing.** Milch is on the list after the re-add, and a name already on the list is refused, so tick it first: `fg tap --text Milch`, `fg wait --contains "Milch abgehakt"`. Then buy it with a quantity: `fg type --key add-item-field --input "2 l Milch" --submit`, `fg wait --text "2 l Milch"`, `fg tap --text "2 l Milch"`, `fg wait --text "2 l Milch" --gone`. Then run `fg type --key add-item-field --input Mi`. `fg wait --key suggestion-Milch` succeeds within about 2 s (the usuals refresh 1.5 s after the list changes), and the chip reads "2 l Milch" (the label is in the screenshot only). Take `fg screenshot --name qa-suggest`.
- **Tap a chip.** Run `fg tap --key suggestion-Milch`, then `fg wait --text "2 l Milch"`. The field is empty and still focused: `fg type --input Brot --submit` (no matcher, so it fails with `no_focus` if the chip took focus) succeeds and `fg wait --text Brot` matches. `fg db query "select name, quantity from items where status = 'active' and name = 'Milch'" --as peter` returns quantity `2 l`.
- **Due again.** Give an item two purchases a week apart: buy "4 Brötchen" as above (the row reads "4× Brötchen"), then, with `H="(select id from households where name = 'Familie Test')"`, `fg db query "update item_events set created_at = now() - interval '7 days' - case action when 'added' then interval '1 hour' else interval '0' end where item_name = 'Brötchen' and household_id = $H" --write` and `fg db query "insert into item_events (household_id, item_id, action, item_name, created_at) select household_id, item_id, action, item_name, created_at - interval '7 days' from item_events where item_name = 'Brötchen' and household_id = $H" --write`. Change the list once (tick any item) or `fg restart` so the usuals reload. With the field empty, `fg wait --text "Brauchen wir wieder?"` matches and `fg wait --key suggestion-Brötchen` succeeds. `fg tap --key suggestion-Brötchen` adds Brötchen with quantity `4` (`fg wait --text "4× Brötchen"`), and `fg type --input Butter --submit` still reaches the field.
- **Proof.** Record across the add: `fg record start --name qa-enter` before typing and `fg record stop` after the wait. Take `fg screenshot --name qa-after` and run a `fg db query` showing the rows and their status.

## Gotchas

- Autofocus happens on open only. After a dialog, the menu or a tick, nothing has focus, and `fg type` without a matcher fails with `no_focus`. Use `--key add-item-field` from then on, and use `fg restart` to prove autofocus again.
- On Linux there is no soft keyboard. "Keyboard up on open" can only be proven on the android surface with `fg screenshot --native`.
- The UI is optimistic: an item vanishes before the server has it. Assert stored state with `fg db query`, and repeat the query if it lags for a second or two.
- `--text` and `--row` match the row's exact text, which starts with the quantity: "2 l Milch", "2× Äpfel" ("×" for a bare count). A row without a quantity reads the name. With Milch both on the list and in "Zuletzt gekauft", `--row Milch` targets the list row.
- With "Zuletzt gekauft" expanded, the ticked name still shows there, so `fg wait --text Milch --gone` never succeeds. Wait for the snackbar (`--contains "Milch abgehakt"`) instead.
- A tap on a row ticks it at once; there is no checkbox. To open an item, hold it: `fg marionette -- long-press --text <row text>`.
- The usuals refresh 1.5 s after the list changes. A chip that shows right after a tick can still carry the old quantity in its label; the tap adds the latest one.
- A new item takes the store memory holds for its name (`features/stores.md`), so it may land under a store rather than "Ohne Laden".
- Button labels (Rückgängig, Speichern) do not show in `fg find`, but `fg tap --text` reaches them. Wait for snackbars with `--contains` on their message text.
- Items from earlier runs stay in "Zuletzt gekauft". `fg up --fresh` clears everything.
- Suggestions come from the history, so earlier runs' purchases show up as chips too. `fg up --fresh` clears the history with the items.
- A chip for an item already on the list never shows; tick it first. Names compare case-insensitively on the device, and by `item_name_key` on the server.
- `fg find` lists each chip's key (`suggestion-<name>`), not the row around them. Wait for the due row by its text "Brauchen wir wieder?".
- One purchase is never due, and neither are purchases on the same day: backdate the history as above instead of ticking twice.
- A tick undone within 10 minutes (with "Rückgängig" or a re-add from "Zuletzt gekauft") is not a purchase.
