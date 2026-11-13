# Household and list in the top bar: five prototypes (job 205)

Throwaway sandbox for the t777u prototype gate. Peter (t817u, t820u) keeps households and wants the household and the current list in the top bar next to Anpassen. The household row and the list tabs row under it go. Tapping the switcher opens a sheet for picking a list and a household. Nothing here is production UI, and the prototypes are not approval to implement. All data is invented, and nothing calls a backend.

| # | Slug | Bar | Sheet |
| --- | --- | --- | --- |
| 0 | `current` | Today: household chip, list tabs row below (reference) | Households only |
| 1 | `breadcrumb-in-bar` | Hex path "Trost › Geburtstag", two tap targets | Lists of the household, then the households |
| 2 | `stacked-two-line` | One raised hex button: household small above, list bold below | Households as chips on top, lists of the picked one below |
| 3 | `single-chip-truncate` | One flat chip "Geburtstag · Trost", middle ellipsis | Every list of every household, grouped |
| 4 | `list-first-chip` | List as a page title, household as a small hex tag before it | Two pages: lists, then households (with back) |
| 5 | `hide-household-when-solo` | Only the list with one household; like 2 with several | Segmented: Listen, Haushalte |

Variants 1 to 4 always show the household. Variant 5 is the PM idea, for comparison. No variant has the second tabs row. In all five, the sync pill shows only its icon while offline, between the switcher and Anpassen. Every household switch shows "Angezeigt: X. Siri, Alexa & KI bleiben bei Y." The switch never changes the default household for Siri, Alexa and AI (FINDINGS households-vs-lists).

The scenarios are: one household with one list, one household with four lists, three households, long household and list names, and one household with long names. The controls switch between 390, 360 and 320 px wide phones, the offline pill and large text (130 %).

The recommendation is `stacked-two-line`, with the household always shown: [`RECOMMENDATION.md`](RECOMMENDATION.md), also on the page under "Empfehlung". The screenshots are in [`../../screenshots/205/`](../../screenshots/205/).

## Look at it

```sh
./build.sh /tmp/dist205          # one self-contained static folder (fonts and tokens copied in)
node shoot.mjs <url> <out-dir>   # drives every variant and scenario, checks the bar and sheet, writes screenshots
```

`bar-names.tsv` is `shoot.mjs`'s measured table of which names each bar cuts (three households, 12 settings). `shoot.mjs` also measures the visible glyphs of each bar's names in every scenario, at 390, 360 and 320 px, 100 and 130 % text, online and offline. The household must keep two letters and an ellipsis, and the list one letter.

`#/alle` shows all six side by side, `#/<slug>` one variant with its notes, and `#/empfehlung` the recommendation. The Vercel preview of the build is in the job 205 done summary.
