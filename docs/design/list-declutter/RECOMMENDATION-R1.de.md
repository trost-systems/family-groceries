# Empfehlung: LD1 `slim-chrome`, die Summe wandert in die Trip-Leiste aus LD3

Runde 1 (Job 223). Ihre Zahlen legen einen 34-px-Home-Indikator unter die Tab-Leiste. Die App rechnet ihn in einen 26-px-Abstand ein (`shell.dart`, `_bandHeight`), darum zählt Runde 2 für heute und LD1 eine Zeile mehr. Die korrigierten Zahlen stehen in Runde 2.

**Die Wahl.** Der Aufbau bleibt wie heute, jede Leiste wird dünner:

- Oben steht die zweizeilige Taste aus Job 205. Der Haushalt steht klein über dem Listennamen, Anpassen bleibt rechts, die Reihe mit den Listen-Reitern entfällt.
- Erste Schritte werden ein einzeiliger Hinweis. Ein Tipp öffnet die ganze Karte als Blatt, das X blendet sie aus wie heute.
- Die Laden-Zeile wird 36 px hoch: Laden, Linie, Zahl der offenen Artikel, Teilsumme und der Pfeil zum Zuklappen.
- Eine Zeile ohne Preis zeigt ein leises €-Zeichen mit einer Tippfläche von 48 × 48 px, so groß wie der Preis-Knopf heute. Eine Zeile mit Preis zeigt den Betrag als Chip.
- Die Einkaufssumme wird eine 28-px-Zeile über dem Eingabefeld.
- Eingabefeld, Mikrofon und Tab-Leiste bleiben, wie sie sind.

Aus LD3 kommt eines dazu. Solange ein Einkauf aus Job 217 läuft, steht die Summe in der Trip-Leiste. So liegen nie zwei Leisten übereinander.

**Warum.** Es passt doppelt so viel auf den Bildschirm, und niemand muss etwas Neues lernen.

| Variante | Wie Peters Screenshot | 25 Artikel, oben | 25 Artikel, 420 px gescrollt |
| --- | --- | --- | --- |
| Heute | 3 | 3 | 5 |
| LD1 `slim-chrome` | 6 | 7 | 9 |
| LD2 `collapsing-header` | 5 | 5 | 8 |
| LD3 `plan-and-shop-modes` (Planen) | 7 | 7 | 10 |
| LD4 `bottom-dock` | 8 | 9 | 11 |
| LD5 `list-owns-the-chrome` | 6 | 7 | 10 |
| LD1 während eines Einkaufs (Job 217) | 6 | | |
| LD3 während eines Einkaufs | 6 | | |

Gezählt sind Artikel, deren Zeile ganz zu sehen ist, auf einem 390 × 844-Telefon mit iPhone-Statusleiste (47 px) und Home-Balken (34 px). `shoot.mjs` misst das auf Deutsch und Englisch, hell und dunkel, mit denselben Zahlen. Der Nachbau von heute liegt in jeder Leiste höchstens 4 px neben der echten Web-App (Zeilen höchstens 1 px, die Erste-Schritte-Karte 4 px). Die Web-App zeigt 4 Artikel, weil ihr Statusleiste und Home-Balken fehlen. Auf dem Telefon werden daraus 3, wie auf Peters Screenshot.

- **Keine neue Geste, kein neuer Zustand.** Tippen hakt ab, Halten bearbeitet. Jede Funktion bleibt an ihrem Platz.
- **Passt zu 205 und 217.** Oben steht die empfohlene Taste aus 205. In LD1 fragt das erste Abhaken „Kaufst du gerade ein?“ wie in 217, und während des Einkaufs steht die Trip-Leiste aus 217 an Stelle der Summen-Zeile. LD1 zeigt dann weiter 6 Artikel. Keiner der beiden Jobs muss sich ändern.
- **Günstig zu bauen.** Vor allem neue Maße für vorhandene Widgets, hinter denselben Flags.

**Warum nicht die anderen.**

- **LD4 `bottom-dock`** zeigt am meisten (8). Dafür ersetzt eine Mehr-Taste die Tab-Leiste. Listenwechsel, Anpassen, Summe und Erste Schritte liegen hinter einem Griff, und ein großer Titel scrollt weg. Das ist viel Neues für ein, zwei Zeilen mehr als LD1. Das Dock bleibt eine Option, falls die Tab-Leiste wächst.
- **LD3 `plan-and-shop-modes`** zeigt beim Planen 7. Wer Preise zu Hause einträgt, müsste dafür erst einen Einkauf starten. Und zwei Zustände muss man erklären. Wenn der Einkaufsmodus aus 217 kommt und genutzt wird, ist LD3 die bessere Antwort auf Dauer. Die Summe in der Trip-Leiste ist der erste Schritt dahin.
- **LD2 `collapsing-header`** zeigt anfangs nur 5, weil oben noch alles steht. Nach dem Scrollen sind es 8. Bewegliche Köpfe kosten Bewegung und Aufwand.
- **LD5 `list-owns-the-chrome`** braucht für Preise ein Wischen. Seit Job 78 macht Wischen auf einer Zeile absichtlich nichts, und versteckte Wischgesten findet kaum jemand. Die Kopfzeile kommt außerdem bei jedem Richtungswechsel.

**Später borgen, wenn nötig.** Die Mini-Leiste aus LD2 passt auf LD1, falls die lange Liste noch zu eng ist. Das Dock aus LD4, falls die Tab-Leiste mal den Platz braucht.

## Offene Fragen

- **LQ-D1.** Reicht ein leises €-Zeichen, damit man Preise findet? Die andere Möglichkeit ist gar kein Zeichen, mit dem Preis im Bearbeiten-Blatt (Halten) wie in LD4. Beide zeigen den Betrag als Chip, sobald es einen Preis gibt.
- **LQ-D2.** Die Linie in der heutigen Laden-Zeile ist Schmuck, kein Fortschritt. Der Auftrag nennt sie Fortschritt. Soll die Laden-Zeile echten Fortschritt zeigen („2 von 4 gekauft“)? Das ergibt erst mit dem Einkaufs-Schnappschuss aus 217 Sinn.
- **LQ-D3.** Erste Schritte als einzeiliger Hinweis mit Blatt: Ist ein Tipp mehr zu den Schritten in Ordnung, solange die Karte noch offen ist?
- **LQ-D4.** Soll die Summen-Zeile immer stehen oder erst, wenn heute etwas einen Preis hat? Heute steht die Leiste, sobald die Liste Artikel hat. Bei null Preisen ausblenden spart allen, die nie Preise eintragen, weitere 32 px.
- **LQ-D5.** LD1 hängt an der Wahl in 205. Mit `stacked-two-line` entfällt die Reiter-Reihe. Wählt Peter eine andere 205-Variante, funktioniert LD1 mit deren Leiste genauso.
- **LQ-D6.** Wenn der Einkaufsmodus aus 217 kommt: Soll das Planungs-Beiwerk während eines Einkaufs verschwinden wie in LD3? Das wäre ein Folgeschritt, wenn beide gelandet sind.
- **LQ-D7.** Zeilen bleiben überall 48 px hoch. Mit 44 px käme etwa ein Artikel dazu. Lohnt ein eigener Test?
- **LQ-D8.** Ohne Reiter-Reihe braucht der Listenwechsel zwei Tipps statt einem, und „Neue Liste“ wandert ins Blatt. Passt das für Haushalte, die oft wechseln (etwa zwischen „Einkaufsliste“ und „Party“)? Oder soll LD1 eine kleine Reiter-Möglichkeit behalten?
