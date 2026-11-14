# Runde 2: SS4 für das Blatt, BB4 für unten, LD4-3T nicht

**Die Wahl.** Auf Peters fester Basis (B1 bis B6):

- **Blatt des Umschalters: SS4 `chips-in-row`.** Das heutige Haushalt-Blatt bleibt Zeile für Zeile. Nur die Zeile des angezeigten Haushalts bekommt die heutigen Listen-Reiter und „Listen verwalten“. Das Blatt wird 114 px höher (die Reiter und der Link), bei zwei Listen wie bei sieben. Umbenennen, Reihenfolge und Löschen liegen einen Tipp tiefer auf einer zweiten Seite im Blatt. Heute stehen sie unter Mehr → Haushalt.
- **Unterer Bereich: BB4 `field-is-the-list-tab`.** Der Liste-Tab der Tab-Leiste ist das Eingabefeld: „🛒 Was brauchst du? 🎤 | Verlauf | Mehr“. Auf Verlauf und Mehr wird das Feld wieder zum Tab „Liste“ mit Namen. Unten werden aus 150 px auf dem iPhone 86 px.
- **LD4-3T verliert gegen die LD1-Basis mit BB4.** Sein randloses Dock mit beschrifteten Tabs braucht 134 px und zeigt bei 25 Artikeln eine Zeile weniger (6 statt 7). Ohne LD4s Griff (Peters Regel) ist es fast BB3 in voller Breite; die eigentliche Frage ist also randloses Dock gegen schwebende Leiste.

**Zweite Wahl.** SS1 `nested-tree`, wenn Listen direkt unter ihrem Haushalt stehen sollen; bei vielen Listen wird das Blatt dann lang. BB1 `tight-stack`, wenn Verlauf und Mehr auf der Liste ihre Namen behalten müssen: nur engere Abstände, 22 px gespart.

**Was die Basis von LD1 übernimmt.** Über B1 bis B6 hinaus nutzen alle Telefone von Runde 2 die Zeilen aus LD1: schlanke Laden-Trenner mit offener Anzahl und Teilsumme („4 · 3,95 €“), ein leises € statt „+ Preis“ bei Zeilen ohne Preis und keine Zeile „Summe dm“ unter jedem Laden. Die Zeilen bleiben 48 px hoch, die Zahlen ändern sich also höchstens um die Höhe der Trenner, aber Peter gibt das mit frei.

## Ganz sichtbare Zeilen, 390 × 844, Text 100 %

| Variante | Screenshot-Satz | Dasselbe, Erste Schritte ausgeblendet | 25 Artikel, oben | 25 Artikel, 420 px gescrollt | Unten (Feld und Tabs) |
| --- | --- | --- | --- | --- | --- |
| Heute | 4 | 5 | 4 | 5 | 150 px |
| LD1 (Runde 1) | 7 | 7 | 7 | 9 | 150 px |
| Basis R2 = SS1 bis SS5 | 5 | 8 | 5 | 9 | 150 px |
| BB1 `tight-stack` | 6 | 8 | 6 | 9 | 128 px |
| BB2 `field-and-icon-tabs` | 6 | 8 | 7 | 10 | 86 px |
| BB3 `one-slab` | 6 | 8 | 6 | 10 | 122 px |
| **BB4 `field-is-the-list-tab`** | **6** | **8** | **7** | **10** | **86 px** |
| BB5 `tabs-hide-on-scroll` | 5 | 8 | 5 | 10 | 150 px, beim Scrollen 88 px |
| LD4-3T `bottom-dock-three-tabs` | 6 | 8 | 6 | 9 | 134 px |

LD1 ist das Telefon aus Runde 1, nicht auf Peters Basis: Seine 7 enthalten Erste Schritte als einzeiligen Hinweis und eine feste 28-px-Summenzeile, beides schließen B3 und B4 aus. Die 5 von R2 heißen nicht, dass R2 Platz verliert; es ist die heutige Erste-Schritte-Karte.

Bei 130 % Text: heute 3, R2 5, BB4 6 im Screenshot-Satz, gescrollt 6, 9 und 11 (`items-visible.tsv`). Die Zeilen bleiben bei 130 % 48 px hoch wie in der App, darum kann eine gescrollte Zahl eine Zeile über der bei 100 % liegen: Es kommt darauf an, wo die 420 px landen. Die Zahlen sind auf Deutsch und Englisch, hell und dunkel gleich. Mit ausgeblendeten Ersten Schritten hat der Screenshot-Satz nur 8 offene Artikel, 8 ist also die Obergrenze. Während eines Einkaufs aus Job 217 (Screenshot-Satz) zeigt R2 4, BB4 5 und LD4-3T 4.

**Heute zeigt 4, nicht 3 wie in Runde 1.** Runde 1 hat einen 34-px-Home-Indikator unter den 12-px-Abstand der Tab-Leiste gelegt. Die App rechnet den sicheren Bereich in den Abstand ein: Leiste 52 px plus max(12, 34 − 8) = 78 px (`shell.dart`, `_bandHeight`). Unten sind heute also 72 + 78 = 150 px, und alle Telefone von Runde 2 sind so gemessen. Peters Screenshot mit 3 Artikeln kommt vielleicht von einem kleineren Telefon oder mit größerer Schrift. Bei 130 % zeigt heute 3.

**Was B3 kostet.** Die heutige Erste-Schritte-Karte nimmt neuen Nutzern in jeder Variante 3 Zeilen (R2 5 statt 8 nach dem Ausblenden). Das hat Peter so entschieden (B3). Die Karte lässt sich ausblenden, die Zahlen ohne sie stehen in der Tabelle.

## Warum SS4

- **Es behält, was Peter mag.** Jede Zeile und Aktion des heutigen Blatts bleibt, wo sie ist: Haushalte mit Einladen, die offene Anfrage, Neuer Haushalt, Mit Code beitreten, Siri, Alexa & KI.
- **Liste wechseln bleibt ein Tipp im Blatt.** Die Reiter sind die Listen-Reiter, die man heute vom Listen-Bildschirm kennt, nur im Blatt.
- **Es wächst nicht mit.** Sieben Listen oder lange Namen lassen die Reiter seitwärts scrollen, das Blatt bleibt gleich hoch. Gemessene Höhe über dem heutigen Blatt: SS4 +114 px bei zwei und bei sieben Listen, SS1 +199 und +591, SS2 +249 und +588.
- **Der Tausch.** Ein langer Listenname wird ein Reiter von höchstens 184 px, mit Auslassungszeichen („Drogerie & Apotheke“ passt, „Geburtstag von Oma Hildegard am Samstag“ nicht). Den ganzen Namen zeigt „Listen verwalten“. SS1 und SS2 zeigen jeden Namen ganz, wachsen aber mit jeder Liste.
- **SS3 und SS5 verstecken die Haushalte.** SS3 hinter einem Reiter, SS5 hinter einem Zurück-Schritt. Peters Einwand gegen LD4 gilt hier auch: Was eine Ebene weg ist, findet man nicht.

## Warum BB4

- **Am meisten Platz.** 64 px weniger als heute, so niedrig wie BB2. Der Screenshot-Satz geht von 5 auf 6 Zeilen, die 25-Artikel-Liste von 5 auf 7.
- **Eine Kontur, eine Leiste.** BB2 stellt drei einzelne Hex-Tasten neben das Feld. BB4 behält die bekannte Tab-Leiste, nur wird der Liste-Tab auf der Liste zum Feld.
- **Tastatur wie heute.** Ein Tipp aufs Feld holt die Tastatur. Das Feld sitzt in voller Breite darauf, die Tabs gehen, nach dem Schließen ist die Leiste wieder da. Alle drei Tabs, das Mikrofon und das Feld sind 48 × 48 px groß (per Hit-Test geprüft).
- **Der Preis.** Auf der Liste zeigen Verlauf und Mehr nur ihr Symbol, Screenreader hören den Namen. Für den Hinweis bleiben 164 statt 278 px: „Was brauchst du?“ passt bei 100 % und wird ab 130 % gekürzt. Im schmaleren Feld von BB2 ist er schon bei 100 % gekürzt.

## Offene Fragen

- **LQ-R1.** Von welchem Telefon und mit welcher Schriftgröße stammt Peters Screenshot? Ein iPhone mit 390 × 844 bei 100 % zeigt heute 4 Zeilen, nicht 3.
- **LQ-R2.** BB4 zeigt Verlauf und Mehr auf der Liste nur als Symbol. Passt das, oder müssen die Namen bleiben (dann BB1)?
- **LQ-R3.** Mit SS4 lassen sich Listen im Blatt verwalten („Listen verwalten“). Soll der Abschnitt Listen unter Mehr → Haushalt als zweiter Weg bleiben oder entfallen?
- **LQ-R4.** Welche Liste öffnet ein Haushaltswechsel im Blatt: die erste Liste des Haushalts (wie im Prototyp) oder die dort zuletzt gezeigte?
- **LQ-R5.** Die durchscheinende Kopfzeile macht die Liste darunter unscharf (B2). Flutters Unschärfe kostet auf älteren Android-Telefonen und im Web Bildzeit. Reicht dort eine zu 92 % deckende Fläche ohne Unschärfe?
- **LQ-R6.** Die Idee aus BB5 (Tabs weichen beim Runterscrollen) passt auch auf BB4: Die Leiste würde beim Scrollen auf das Feld allein schrumpfen. Lohnt ein Folgeschritt, oder ist das ein bewegliches Teil zu viel?

## Was hier nicht entschieden wird

Nur Prototyp, in der App hat sich nichts geändert. Der Bau beginnt, wenn Peter ein SS- und ein BB-Label gewählt hat.
