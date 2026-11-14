# Summen je Laden: ST3, die Übersicht

**Die Wahl: ST3 `summary-block`.** Wo R2 die Summen-Zeile hat, über „Zuletzt verwendet“, steht ein Block. Er zeigt je Laden eine Zeile (Name, „2 ohne Preis“, Teilsumme) und endet mit „Gesamt“. Das ist, worum Peter gebeten hat, von oben nach unten zu lesen wie ein Kassenbon: erst die Summen je Laden, dann die Gesamtsumme. Ein Tipp auf eine Laden-Zeile springt zu ihrem Abschnitt. Ein langer Laden-Name steht in seiner Zeile ganz da; nur die Trenner kürzen ihn bei 168 px.

**Warum ST3.**

- **Oben in der Liste kostet es keine Zeile.** Der Block steht dort, wo die Summe schon steht, am Ende der offenen Artikel. Oben zeigt ST3 in jedem gemessenen Fall so viele Zeilen wie R2 (6 mit drei Läden bei 100 %, 8 ohne Erste Schritte, 4 bei 160 %). Am Ende der Liste kostet der Block 190 px bei drei Läden und 100 % (eine zweizeilige Zeile je Laden und die Überschrift). Ein langer Laden-Name steht ganz da und bricht um; bei 160 % kostet der Block 331 px.
- **Alle Zahlen stehen an einer Stelle.** Ob die Teilsummen aufgehen, sieht man ohne Scrollen zwischen den Läden. R2 zeigte die Summe eines Ladens schon im schlanken Trenner („4 · 10,05 €“), und Peter hat trotzdem nach Teilsummen gefragt. Eine kleine Zahl oben an jedem Abschnitt übersieht man leicht.
- **Nichts verschwindet.** Ein ganz abgehakter Laden bleibt im Block, mit „alles gekauft“. So ergeben die Zeilen immer die Gesamtsumme. Heute verschwindet die Summen-Zeile eines Ladens mit seinem Abschnitt.
- **Ein Laden, eine Zeile.** Mit nur einem Laden ist der Block die Summen-Zeile aus R2, sonst nichts. Eine Teilsumme würde dort nur die Summe wiederholen.

**Der Preis.** Wer in einem Laden einkauft, sieht dessen Teilsumme am Ende der Liste, nicht beim Laden. Der Sprung von der Laden-Zeile hilft nur in eine Richtung. Muss die Summe beim Einkaufen im Blick bleiben, ist ST1 die zweite Wahl.

**Zweite Wahl.**

- **ST1 `subtotal-on-divider`.** Die Teilsumme steht am Trenner jedes Ladens, darüber klein „4 offen · 2 ohne Preis“. Das ist R2s Trenner, nur lesbar, und ein ganz gekaufter Laden behält seinen Trenner. Kostet bei 100 % oben eine Zeile (5 statt 6): der zweizeilige Trenner ist 44 px hoch statt 36.
- **ST4 `expandable-total`.** So kurz wie R2 (+10 px), bis man tippt. Die Teilsummen kosten einen Tipp und sind sonst nicht zu sehen.
- **ST2 `section-foot`** ist die heutige App („Summe dm“ nach jedem Laden, Job 190). Kostet eine Zeile je Laden in der Liste und ohne Erste Schritte eine Artikel-Zeile. **ST5 `chip-line`** ist kompakt, hat aber keinen Platz für „ohne Preis“ je Laden.

## Ganz sichtbare Zeilen, 390 × 844, Deutsch, hell

Englisch und dunkel gleich (`st-items-visible.tsv`). „Oben“ mit der heutigen Erste-Schritte-Karte (B3), „ausgeblendet“ ohne sie.

| Daten | Text | Heute | R2 | ST1 | ST2 | **ST3** | ST4 | ST5 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 3 Läden | 100 %, oben | 3 | 6 | 5 | 6 | **6** | 6 | 6 |
| 3 Läden | 100 %, ausgeblendet | 6 | 8 | 8 | 7 | **8** | 8 | 8 |
| 3 Läden | 130 %, oben | 2 | 5 | 5 | 5 | **5** | 5 | 5 |
| 3 Läden | 160 %, ausgeblendet | 6 | 8 | 7 | 7 | **8** | 8 | 8 |
| 3 + ohne Laden | 100 %, oben | 3 | 6 | 5 | 6 | **6** | 6 | 6 |
| 1 Laden | 100 %, oben | 3 | 6 | 6 | 6 | **6** | 6 | 6 |

Listenhöhe über R2 (`st-height-vs-r2.tsv`). Bei drei Läden und 100 %: ST1 +24 px, ST2 +108, ST3 +190, ST4 +10 zugeklappt, ST5 +96. Mit einem Laden: 0 bei 100 und 130 %, bei 160 % +29 px für jede ST-Variante (die Zeile unter der Summe bricht um, ST-Q6). Mit „Ohne Laden“ heißt die Zeile „3 Läden + ohne Laden · …“ und bricht schon bei 100 % um (+18 px).

## Wie Artikel ohne Preis zählen

Ein Artikel ohne Preis zählt nichts. Jede Laden-Zeile sagt, wie viele seiner offenen Artikel keinen Preis haben („2 ohne Preis“), die Gesamtsumme sagt es für die Liste („3 Läden · 10 mit Preis · 4 ohne Preis“). Ein abgehakter Artikel mit Preis zählt weiter, wie bei der Summe aus Job 190. Gewogenes zählt mit dem Zeilenbetrag („846 g Bananen 1,51 €“). „Ohne Laden“ ist eine Gruppe mit eigener Zeile und Teilsumme, aber kein Laden: die Summen-Zeile sagt „3 Läden + ohne Laden“.

## Offene Fragen

- **ST-Q1.** Soll die Summe bei Artikeln ohne Preis als Untergrenze lesen („mind. 32,08 €“ oder „32,08 € + 4 ohne Preis“)? Der Prototyp zählt sie nur in der Zeile darunter.
- **ST-Q2.** Teilsummen zählen abgehakte Artikel mit, wie die Summe aus Job 190. Soll der Block gekauft und noch offen trennen („12,40 € gekauft · 19,68 € offen“)?
- **ST-Q3.** „Ohne Laden“ ist im Prototyp eine Gruppe mit eigener Teilsumme. Bleibt das so, oder zählt es nur in die Gesamtsumme?
- **ST-Q4.** Gewogenes zeigt den Zeilenbetrag aus dem geplanten Gewicht, bis es gewogen ist. Soll diese Zeile als Schätzung markiert sein („≈ 1,51 €“)?
- **ST-Q5.** Mit ST3 zeigen die Laden-Trenner nur die Zahl offener Artikel. Behalten sie R2s kleine Summe (dieselbe Zahl zweimal) oder nur die Zahl?
- **ST-Q6.** Unter der Summe steht „10 mit Preis · 4 ohne Preis“ statt „10 mit Preis · 4 offen“ wie in der App. Bei 160 % bricht das in eine zweite Zeile um (+29 px mit einem Laden). Ist das klarere Wort die Zeile wert? Die beiden Zahlen zählen auch Verschiedenes: „mit Preis“ zählt abgehakte Artikel mit (sie stecken in der Summe), „ohne Preis“ nur offene (noch einzutragen). Ist dm ganz gekauft, steht dort „10 mit Preis · 3 ohne Preis“: die abgehakten Taschentücher ohne Preis fallen heraus. So lassen, oder beide über dieselben Artikel zählen?
- **ST-Q7.** ST3s Laden-Zeile springt zu ihrem Abschnitt, aber nichts springt zurück zur Summe. Lohnt ein Rückweg (ein „Summe“-Link an jedem Trenner oder eine Taste zum Listenende, solange der Block nicht zu sehen ist)?

## Was hier nicht entschieden wird

Nur ein Prototyp; in der App hat sich nichts geändert. Job 229 baut Peters Wahl aus Runde 2 (R2 mit SS5). Die ST-Wahl käme hinter demselben Flag obendrauf.
