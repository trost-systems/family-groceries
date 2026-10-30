# Fonts served under /fonts/

The Flutter web engine loads Roboto and, for emoji, symbols and non-Latin scripts, Noto
fallback fonts from `fontFallbackBaseUrl` (`app/web/flutter_bootstrap.js`). These are
copies of the files Google Fonts serves at fonts.gstatic.com/s/<path>, so the app never
contacts Google (job 33c). `scripts/web-fonts.sh` writes this folder and this file.

Every font here is licensed under the SIL Open Font License, Version 1.1
([OFL.txt](OFL.txt), https://openfontlicense.org). Copyright notices per folder:

| Folder | Copyright |
| --- | --- |
| notocoloremoji | Copyright 2021 Google Inc. All Rights Reserved. |
| notomusic | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/music) |
| notosans | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/latin-greek-cyrillic) |
| notosansadlam | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/adlam) |
| notosansanatolianhieroglyphs | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/anatolian-hieroglyphs) |
| notosansarabic | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/arabic) |
| notosansarmenian | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/armenian) |
| notosansavestan | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/avestan) |
| notosansbalinese | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/balinese) |
| notosansbamum | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/bamum) |
| notosansbassavah | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/bassa-vah) |
| notosansbatak | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/batak) |
| notosansbengali | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/bengali) |
| notosansbhaiksuki | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/bhaiksuki) |
| notosansbrahmi | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/brahmi) |
| notosansbuginese | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/buginese) |
| notosansbuhid | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/buhid) |
| notosanscanadianaboriginal | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/canadian-aboriginal) |
| notosanscarian | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/carian) |
| notosanscaucasianalbanian | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/caucasian-albanian) |
| notosanschakma | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/chakma) |
| notosanscham | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/cham) |
| notosanscherokee | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/cherokee) |
| notosanscoptic | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/coptic) |
| notosanscuneiform | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/cuneiform) |
| notosanscypriot | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/cypriot) |
| notosansdeseret | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/deseret) |
| notosansdevanagari | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/devanagari) |
| notosansduployan | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/duployan) |
| notosansegyptianhieroglyphs | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/egyptian-hieroglyphs) |
| notosanselbasan | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/elbasan) |
| notosanselymaic | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/elymaic) |
| notosansethiopic | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/ethiopic) |
| notosansgeorgian | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/georgian) |
| notosansglagolitic | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/glagolitic) |
| notosansgothic | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/gothic) |
| notosansgrantha | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/grantha) |
| notosansgujarati | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/gujarati) |
| notosansgunjalagondi | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/gunjala-gondi) |
| notosansgurmukhi | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/gurmukhi) |
| notosanshanunoo | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/hanunoo) |
| notosanshatran | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/hatran) |
| notosanshebrew | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/hebrew) |
| notosanshk | Copyright 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source' |
| notosansimperialaramaic | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/imperial-aramaic) |
| notosansindicsiyaqnumbers | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/indic-siyaq-numbers) |
| notosansinscriptionalpahlavi | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/inscriptional-pahlavi) |
| notosansinscriptionalparthian | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/inscriptional-parthian) |
| notosansjavanese | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/javanese) |
| notosansjp | Copyright 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source' |
| notosanskaithi | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/kaithi) |
| notosanskannada | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/kannada) |
| notosanskayahli | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/kayah-li) |
| notosanskharoshthi | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/kharoshthi) |
| notosanskhmer | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/khmer) |
| notosanskhojki | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/khojki) |
| notosanskhudawadi | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/khudawadi) |
| notosanskr | Copyright 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source' |
| notosanslao | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/lao) |
| notosanslepcha | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/lepcha) |
| notosanslimbu | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/limbu) |
| notosanslineara | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/linear-a) |
| notosanslinearb | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/linear-b) |
| notosanslisu | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/lisu) |
| notosanslycian | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/lycian) |
| notosanslydian | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/lydian) |
| notosansmahajani | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/mahajani) |
| notosansmalayalam | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/malayalam) |
| notosansmandaic | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/mandaic) |
| notosansmanichaean | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/manichaean) |
| notosansmarchen | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/marchen) |
| notosansmasaramgondi | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/masaram-gondi) |
| notosansmath | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/math) |
| notosansmayannumerals | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/mayan-numerals) |
| notosansmedefaidrin | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/medefaidrin) |
| notosansmeeteimayek | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/meetei-mayek) |
| notosansmeroitic | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/meroitic) |
| notosansmiao | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/miao) |
| notosansmodi | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/modi) |
| notosansmongolian | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/mongolian) |
| notosansmro | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/mro) |
| notosansmultani | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/multani) |
| notosansmyanmar | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/myanmar) |
| notosansnabataean | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/nabataean) |
| notosansnewa | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/newa) |
| notosansnewtailue | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/new-tai-lue) |
| notosansnko | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/nko) |
| notosansnushu | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/nushu) |
| notosansogham | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/ogham) |
| notosansolchiki | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/ol-chiki) |
| notosansoldhungarian | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/old-hungarian) |
| notosansolditalic | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/old-italic) |
| notosansoldnortharabian | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/old-north-arabian) |
| notosansoldpermic | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/old-permic) |
| notosansoldpersian | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/old-persian) |
| notosansoldsogdian | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/old-sogdian) |
| notosansoldsoutharabian | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/old-south-arabian) |
| notosansoldturkic | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/old-turkic) |
| notosansoriya | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/oriya) |
| notosansosage | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/osage) |
| notosansosmanya | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/osmanya) |
| notosanspahawhhmong | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/pahawh-hmong) |
| notosanspalmyrene | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/palmyrene) |
| notosanspaucinhau | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/pau-cin-hau) |
| notosansphagspa | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/phags-pa) |
| notosansphoenician | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/phoenician) |
| notosanspsalterpahlavi | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/psalter-pahlavi) |
| notosansrejang | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/rejang) |
| notosansrunic | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/runic) |
| notosanssaurashtra | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/saurashtra) |
| notosanssc | Copyright 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source' |
| notosanssharada | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/sharada) |
| notosansshavian | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/shavian) |
| notosanssiddham | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/siddham) |
| notosanssinhala | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/sinhala) |
| notosanssogdian | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/sogdian) |
| notosanssorasompeng | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/sora-sompeng) |
| notosanssoyombo | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/soyombo) |
| notosanssundanese | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/sundanese) |
| notosanssylotinagri | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/syloti-nagri) |
| notosanssymbols | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/symbols) |
| notosanssymbols2 | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/symbols) |
| notosanssyriac | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/syriac) |
| notosanstagalog | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/tagalog) |
| notosanstagbanwa | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/tagbanwa) |
| notosanstaile | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/tai-le) |
| notosanstaitham | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/tai-tham) |
| notosanstaiviet | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/tai-viet) |
| notosanstakri | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/takri) |
| notosanstamil | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/tamil) |
| notosanstamilsupplement | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/tamil) |
| notosanstc | Copyright 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source' |
| notosanstelugu | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/telugu) |
| notosansthaana | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/thaana) |
| notosansthai | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/thai) |
| notosanstifinagh | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/tifinagh) |
| notosanstirhuta | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/tirhuta) |
| notosansugaritic | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/ugaritic) |
| notosansvai | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/vai) |
| notosanswancho | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/wancho) |
| notosanswarangciti | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/warang-citi) |
| notosansyi | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/yi) |
| notosanszanabazarsquare | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/zanabazar-square) |
| notoseriftibetan | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/tibetan) |
| roboto | Copyright 2011 The Roboto Project Authors (https://github.com/googlefonts/roboto-classic) |

The app's own Roboto (`/assets/fonts/fallback/Roboto-Regular.ttf`, which a
`--no-web-resources-cdn` build adds from the Flutter engine) is Roboto 2, Copyright 2011
Google Inc., under the Apache License 2.0 ([Roboto-LICENSE.txt](Roboto-LICENSE.txt)).
