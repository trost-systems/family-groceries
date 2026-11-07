# Job 151: Baumarkt categories and a Baumarkt store type

PR: https://github.com/trost-systems/family-groceries/pull/295 (lead merges after review).

## What was built

A household that adds a store called „Baumarkt“ (or „Heimwerkermarkt“, "Hardware store", "DIY
store") now gets seven DIY categories and a Baumarkt walking order. DIY items are sorted into those
categories and go to that store on their own. Onboarding offers „Baumarkt“ as its last store chip.

| Seed key | DE | EN | Emoji |
| --- | --- | --- | --- |
| paint | Farben & Lacke | Paint & varnish | 🎨 |
| plumbing | Sanitär | Plumbing | 🚿 |
| electrical | Elektro & Leuchtmittel | Electrical & lighting | 💡 |
| tools | Werkzeug | Tools | 🔨 |
| fasteners | Schrauben & Befestigung | Screws & fixings | 🔩 |
| building | Holz & Baustoffe | Wood & building | 🪵 |
| garden | Garten & Pflanzen | Garden & plants | 🌱 |

- **Server.** `supabase/migrations/20261106163919_hardware_categories.sql` holds:
  - the registry `public.hardware_categories()` and `seed_hardware_categories`;
  - the `hardware` store type in `add_store`, which survives a rename in `rename_store`;
  - the Baumarkt layout in `apply_store_layout`, with the DIY categories just before Sonstiges at Lidl, Edeka and dm;
  - `category_store` (drugstore items go to dm, DIY items to the Baumarkt), used by `parse_item` and `guess_store`;
  - the Haushalt fallback in `classify_item_detail`;
  - the four-letter rule for DIY suggestions in `suggest_entries`;
  - a data migration for stores already named Baumarkt.
- **Classifier.** `supabase/classifier/dictionary.tsv` has 251 DIY terms (30 to 40 per category) plus guard terms for the grocery and drugstore compounds that new heads would catch. It is generated into `20261106164917_classifier_dictionary_hardware.sql`.
- **App.** ARB names (DE, EN), divider emoji, the onboarding chip, and the optimistic rename that keeps `hardware`.
- **Item icons.** More DIY items get an icon (paint, varnish, taps, shower heads, battens, nuts, sockets, wrenches). Table revision 2.
- **Docs.** `docs/DECISIONS.md` "Job 151", `docs/STORE_LAYOUTS.md` "Baumarkt" (sourced and inferred parts; the hidden-flag section is corrected), and the feature map: verify-hummlist `categories.md` (`cat-baumarkt`), `stores-walk-order.md` (`sw-baumarkt`), `classifier.md` (`cl-baumarkt`), `onboarding.md` and FEATURES-FOR-WRITERS; verify-family-groceries `stores.md`, `classifier.md` and `household.md`.
- **Journey.** `.cursor/skills/verify-hummlist/journeys/baumarkt.mjs`.

## Key decisions
- The seven categories come with the first Baumarkt, not with every household, so grocery-only households keep 11 categories in their picker.
- Seeding never renames or reorders a household's categories. A same-named own category is adopted, and a deleted one stays deleted.
- Without a Baumarkt, DIY words go to Haushalt. Glühbirne and Kabelbinder went there before; Schrauben, Dübel and Pinsel used to go to Sonstiges.
- No retailer name is recognized or shown (Legal Addendum D).

## How to verify
- `scripts/verify.sh --only lint,db,flutter` (pgTAP `supabase/tests/hardware_categories.test.sql`, 42 tests).
- `.cursor/skills/verify-hummlist/helpers/launch.sh --fresh`, then `cd .cursor/skills/verify-hummlist && node journeys/baumarkt.mjs <evidence dir> [--lang en]`, once in German and once with `--lang en`, under `flock /tmp/fg-e2e.lock`. `drive.sh` cannot run it: it takes a feature id, and `baumarkt` is a sub-feature journey.

## Test results
- Web build, `journeys/baumarkt.mjs` DE and EN: PASS (evidence `/workspace/hummlist/research/151/evidence/baumarkt-201418/`). Screenshots in `docs/screenshots/151/`.
- Local: `scripts/verify.sh --only lint,db` passed. The flutter gate passed earlier with 2,030 app tests and widgetbook; the household and list tests passed again after the rebase.
- CI: ci-ok green on c4aa673b and 627d6c3a (db, flutter, both e2e shards).
- An independent review of the first push found five issues, all fixed: chain order depended on which store came first, misplaced compounds (Wimpernfarbe, Eierfarbe, Puderpinsel …), lost Glühbirne suggestions for grocery-only households, a two-name seed-key race, and the undocumented rename rule.

## Review 0 (FIX), addressed
- Cosmetic brushes: Kosmetik-, Makeup- (also „Makeup-Pinsel“ and „Make-up Pinsel“), Rouge-, Foundation-, Kabuki-, Augenbrauen-, Nagel- and Concealerpinsel are Drogerie guards now, so they no longer go to Farben & Lacke or the Baumarkt. pgTAP control rows cover five of them.
- „LED“ and „LEDs“ alone are Elektro & Leuchtmittel (with a Baumarkt) or Haushalt (without), with 💡. pgTAP DIY rows cover both.
- The rerun command is fixed here and in `stores-walk-order.md` (`sw-baumarkt`): `cd .cursor/skills/verify-hummlist && node journeys/baumarkt.mjs <dir> [--lang en]`.
- Nice-to-haves taken: Sandpapier, Kriechöl and Rostlöser → Werkzeug; Heizlüfter → Elektro; Unkrautvlies → Garten; Terrassenöl → Farben & Lacke; Schraubverschluss stays Haushalt; the EN changelog line names "Hardware store"; the EN ARB descriptions of the seven keys say what the EN value is.
- Not taken: Bretter (would pull in Schneidebretter), Kette (Halskette), Türgriff and E27 (digits are not dictionary terms), applying the Baumarkt walk to migrated stores (DECISIONS 151 item 8 keeps the household's order).
- Gates after the fix: `scripts/verify.sh --only lint` and `--only db` pass (pgTAP 42), `flutter test test/list/` passes (639). The db gate's suggest_entries bench first hit p95 50.0 ms at load 17 on 12 cores. Alternating runs of this dictionary against main's on the same stack differed by +0.8 ms on average (−0.7 to +1.5), and the rerun at load 10 gave p95 42 ms.
- The web journey was not re-driven for this round: the changes are dictionary rows, covered by pgTAP.

## Review 1 (FIX), addressed
- Kitchen, make-up and craft compounds no longer take a DIY head. A sweep of 164 such words (`/tmp/j151/sweep2.txt`) went through `classify_item_detail` with a Baumarkt; 70 landed in a DIY category. Guards that cover many words (glasur → pantry; backform, spatel, schaber, deckel, backmatte → Haushalt) plus single-word guards (…zange, …pinsel, …farbe, …nägel, Fleischhammer, Schraubglas …) bring that to the defensible rest: bike lamps and bells, hooks, wire, glue, Springseil and Lackschuhe. „Feile“ moved to Werkzeug; Nagel-, Hornhaut-, Glas-, Sandblatt- and Fußfeile are Drogerie.
- The class is guarded by the db gate from now on: `wordlist.sh` classifies with a Baumarkt, and `wordlist.tsv` has 101 of the sweep's words as rows, so a drift into a DIY category is a false match (now 1/525 = 0.19 %, the one being Fahrradschlauch → produce, as on main). Twelve of the reviewer's probe words are pgTAP controls.
- Nice-to-haves: Maurerkelle, Feile, Drahtbürste, Lötzinn → Werkzeug; Rigips(platte) → Holz & Baustoffe; Öse(n) → Schrauben & Befestigung; Abdeckvlies → Farben & Lacke. Hanf stays out (Hanfsamen). The FEATURES-FOR-WRITERS onboarding stamp now cites the reviewer's web drive.
- Gates: `scripts/verify.sh --only lint,db` pass (pgTAP 42, sweep, word list); `flutter test test/list/` passes (639). The suggest_entries bench failed once at p95 56 ms; alternating runs of this dictionary (1,578 terms) and main's (1,202) differed by −0.2 ms on average, main's also reached 55 ms in that window, and the gate passed at p95 40.6 ms.

## Review 5 (FIX), addressed
- Wooden kitchen things no longer go to Holz & Baustoffe and the Baumarkt: `löffel`, `brett`, `schüssel` and `teller` are Haushalt heads (Holzlöffel, Kochlöffel, Holzbrett, Schneidebrett, Frühstücksbrett, Holzschüssel, Holzteller), plus guards for Nudelholz, Bilderrahmen, Fotorahmen (was Kühlregal through `rahm`) and Holzstäbchen. Löffelbiskuits stay sweets, Regalbrett and Holzlatten stay Holz & Baustoffe. A 46-word sweep (`/tmp/j151/sweep3.txt`) checked it; 17 rows went into `wordlist.tsv` (false matches 1/542 = 0.18 %), five into the pgTAP controls.
- Kept on purpose (DECISIONS 151 item 13): Holzspielzeug, Holzperlen and Spielsand in Holz & Baustoffe.
- `journeys/baumarkt.mjs` now checks the database rows too: Milch has no store, each DIY item is at the Baumarkt. The logged rows of the last drive (`baumarkt-201418`) satisfy it; the web build was not re-driven for this round.
- Icons: Dübel, Kabelbinder, Silikon, Tapete, Gießkanne and Nudelholz show the plain hexagon on purpose. Up to Unicode 14 no emoji reads as those items (job 147's rule), so a guess would be worse than the hexagon.
- Seen, not changed (older than this PR): „Topf“ classifies as Kühlregal and „Schlauch“ as Obst & Gemüse.

## Review 6 (FIX), addressed
- The Nagel- cosmetics went to Schrauben & Befestigung through the `nagel` prefix: Nagelhaut (-öl, -schere, -creme, -entferner), Nagelset, -sticker, -polierer, -design, -kleber, -tips, -pflege and -weiß are Drogerie terms now. Nagel, Nägel, Stahlnägel and Drahtstifte (newly listed) stay Schrauben & Befestigung.
- Tellerlinsen and Löffelerbsen (caught by review 5's `teller` and `löffel` heads) are pantry; Haferschleim pantry; Pfannenwender and Holzpfannenwender Haushalt; Wechselrahmen Haushalt; Schalbrett Holz & Baustoffe. A 43-word sweep (`/tmp/j151/sweep4.txt`) checked the Nagel-, Teller-, Löffel-, Schüssel- and Brett- starts; 16 rows went into `wordlist.tsv` (false matches 1/558 = 0.18 %), eight into pgTAP.
- Kept: plain „Rahmen“ reads as Rahm (Kühlregal) because both have the key `rahm`, as on main; Brettspiel goes to Haushalt (no toy aisle).

## Not verified
- The iOS and Android apps (no simulators on this runner). They run the same Dart code.
- Web onboarding with the „Baumarkt“ chip was not driven by hand. It is covered by the widget tests and by the CI e2e onboarding specs.

## Follow-up (not done)
- The landing page's store chips (job 145) could add Baumarkt now that the app has hardware categories.
