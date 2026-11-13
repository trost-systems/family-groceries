# Recommendation: `stacked-two-line`, household always shown

**The pick.** A raised hex button left of Anpassen shows the household small and quiet on top and the list bold below. One tap opens a sheet with the households as hex chips on top and the lists of the picked household below. The list tabs row goes. With two or more lists, the header shrinks from 120 px to 68 px (measured in the sandbox, `Kopf … px` under each phone).

**Why.** It keeps short names whole longest. `shoot.mjs` measures whether each bar cuts the household or the list name. It uses three households ("Trost", "Geburtstag") at 390, 360 and 320 px, at normal and 130 % text, online and offline, which makes 12 settings. `stacked-two-line` shows both names whole in 8 of them, `list-first-chip` in 7, and `breadcrumb-in-bar` and `single-chip-truncate` in 4 each. At 390 px with 130 % text and the offline pill, the two-line button (variants 2 and 5) is the only bar that does not cut "Geburtstag" (`docs/screenshots/205/grid-390-offline-big.png`, `bars-130-offline.png`). At 320 px with 130 % text and the offline pill, every variant cuts both names. Every always-on variant keeps at least two letters and an ellipsis of the household and one letter of the list, which `shoot.mjs` measures in every scenario. Where that floor doesn't fit, the switcher drops its chevron: the breadcrumb also drops its separator, and the single chip its dot. At that setting the breadcrumb reads "Tr… G…". Each line gets the button's full width, so the list never competes with the household, and the household stays whole in 11 of the 12 settings. It is one big tap target, not two small crumbs in a 52 px bar. The sheet reaches a list in another household in two taps: tap the household chip to see its lists, then tap the list. Tapping the household chip a second time switches to the household alone.

**Always show, not hide-when-solo.** Show the household always, for three reasons:

1. The bar looks the same with one household or three. In `hide-household-when-solo`, the bar changes shape the day someone joins a second group.
2. The household name is the visible way to "Neuer Haushalt" and "Mit Code beitreten".
3. Siri, Alexa and AI write to the default household, not the one on screen (research note "households vs lists", FINDINGS). A name that is always on screen makes it more likely that people notice where they are.

Hiding saves no height, only one small line inside the same 52 px button.

**Long names.**

- In the bar, each line is cut at its end on its own ("Wohngemeinschaft Kastan…" above "Geburtstagsfeier für O…").
- No middle ellipsis. With two names in one chip, `single-chip-truncate` reads poorly ("Geburts…stag · Wohn…ks").
- Every variant cuts long names in the bar.
- The sheet shows every name in full, on as many lines as it needs, with German hyphenation. That covers list rows, household rows, the household chips and the "Listen in …" heading. `shoot.mjs` measures it in all five sheets, on every page, at 390 and 320 px, at normal and 130 % text. The full name is always one tap away.

**Borrow from the others.**

- From `breadcrumb-in-bar`: the sheet always opens at the lists.
- From `single-chip-truncate`: a grouped "every list" view could help people with three or more households. It is not worth it yet.
- From all five: the switch notice "Angezeigt: WG. Siri, Alexa & KI bleiben bei Trost." The switcher never changes the default, and the "Siri, Alexa & KI nutzen" row stays in the sheet as today.

**Sync pill.** In all five variants, the pill shows only its icon while offline, between the switcher and Anpassen. A tap shows its line as today. There is no room for the word next to two names.

**Open for Peter.** Should the sheet show the households as chips on top (variant 2) or as rows under the lists, as today (variant 1)? Chips are faster with up to three households. Rows are calmer with many long names.

These are prototypes only. Nothing in the app changed, and all data is invented.
