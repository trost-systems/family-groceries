# Strich: Designsprache der Hummlist-Hummel

Die Hummel als Strichzeichnung. Eine einzige Tintenlinie läuft vom linken Fühler um den ganzen Körper in den rechten Fühler, oben am Scheitel bleibt sie offen. Honig ist eine einzige flache Fläche, ein Stück neben der Linie gedruckt, wie eine zweite Druckfarbe, die verrutscht ist. Die Hummel schwebt, sie hat keine Füße.

## Konstruktion

Zeichenfläche 200 × 200, Ursprung oben links. Alle Maße gelten vor der Gesamtverschiebung: Die fertige Figur rückt um 6 px nach unten, damit Fühler und Stachel mittig sitzen. Gebaut wird in dieser Reihenfolge:

1. **Körper:** Ellipse, Mitte (100, 114), Radien 44 × 50. Sie ist Kopf und Körper zugleich. Die Fläche unter der Linie ist weiß.
2. **Honigfläche:** Ellipse 41 × 46, gegenüber dem Körper 7 px nach links und 6 px nach unten versetzt. Oben rechts bleibt eine weiße Sichel innerhalb der Linie, unten links ragt Honig über die Linie hinaus.
3. **Die eine Linie:** Sie beginnt am Haken des linken Fühlers, läuft hinunter zum Körper, um den Körper herum und hinauf in den rechten Fühler. Die Fühlerwurzeln liegen 24° links und rechts vom Scheitel; dazwischen ist die Linie offen. Jeder Fühler steigt 30 px und rückt 13 px nach außen, dann folgt ein Haken (Halbkreis r 5 nach außen, 3 px Auslauf).
4. **Drehung:** Der Gesichtsmittelpunkt liegt bei x = 100 + Drehung × 44 × 0,78. Drehung vorne 0, Dreiviertel 0,42, Seite 0,78, hinten 0. Die Fühlerwurzeln wandern mit (Drehung × 46°). Im Profil endet die Linie hinten ohne Fühler, und nur ein Fühler zeigt nach vorn.
5. **Augenlinie** y = 102, **Mundlinie** y = 117, **Streifenlinien** y = 134 und y = 150.
6. **Streifen:** zwei Striche, die 7 px vor der Körperlinie enden und sie nie berühren. Sie hängen leicht durch (Kontrollpunkt 9 px unter den Enden).
7. **Flügel:** zwei Tropfen (spitze Wurzel am Körperrand, runde Spitze), weiß gefüllt, 38 bis 44 lang und rund 25 breit. Vorne und hinten gespiegelt an den Körperwinkeln −138° und −42°; im Dreiviertel beide hinten links (Wurzeln bei −142° und −124°, Richtungen −168° und −140°).
8. **Arme:** je ein gebogener Strich vom Körperrand, ungefähr 19 lang. **Stachel:** ein kurzer Strich, 9 bis 14 lang, nur von der Seite und hinten.

Erst die Papierunterlage (alle offenen Linien und Flügel als weißer Strich der Stärke 8, also 2 px sichtbar), dann die Flügel hinter dem Körper, die weiße Körperfläche, die versetzte Honigfläche, die eine Linie mit Stachel und Streifen, das Gesicht, die Arme, zuletzt die Requisiten.

## Proportionen

| Maß | Wert | Regel |
| --- | --- | --- |
| Körper Breite : Höhe | 88 : 100 | nie runder als 1 : 1, nie schlanker als 4 : 5 |
| Honig-Versatz | 7 nach links, 6 nach unten | immer nach unten links, nie mehr als 10 px |
| Öffnung am Scheitel | 48° | die Linie schließt sich nie |
| Fühler | 30 hoch, Haken r 5 | Haken zeigen nach außen |
| Auge | 8 × 11, Abstand 28 | Augen sind gefüllte Punkte ohne Weiß |
| Streifen | zwei Striche, 16 auseinander | beginnen unter dem Mund |
| Linienstärke | 4 | überall gleich: Körper, Fühler, Streifen, Arme, Flügel, Mund |
| Papierunterlage | 2 px sichtbar | nur in der Farbfassung, damit die Linie auf dunklem Grund trägt |

## Feste Merkmale

Diese Merkmale ändern sich in keiner Pose, keinem Format und keiner Anzeige:

- Eine Linie in einem Zug: Fühler, Körper, Fühler.
- Oben am Scheitel bleibt die Linie offen.
- Eine Honigfläche, nach unten links versetzt, nie deckungsgleich mit der Linie.
- Zwei schwebende Streifenstriche, die die Körperlinie nicht berühren.
- Augen als Tintenpunkte, Fühler mit Haken statt Kugeln.
- Eine Linienstärke für alles. Keine Füße: die Hummel schwebt.

## Farb-Tokens

Alle Farben kommen aus `option-3-hummel/tokens.json`. Die Figur nutzt in hellem und dunklem Modus dieselben Werte, nur der Grund wechselt.

| Rolle | Token | Wert |
| --- | --- | --- |
| Honigfläche, Icon-Kachel | `color.light.honey` | #ffc72c |
| Linie, Streifen, Augen, Mund | `color.light.ink` | #1c1a17 |
| Flügel, Körperfläche, Papierunterlage | `color.light.surface-raised` | #ffffff |
| Schallbögen, Winkspuren, Freudenstriche | `color.light.accent` | #5a3fae |
| Freudenstriche | `color.light.success`, `color.light.brand` | #23793a, #8a5800 |

Einfarbig gibt es zwei Fassungen: Tinte (#1c1a17) auf Weiß, und ausgespart (Weiß auf Tinte). Dort entfallen Honigfläche und Papierunterlage; die Linie trägt die Figur allein. Andere Farben, Verläufe und Transparenz an der Figur sind nicht erlaubt.

## Ausdrücke

| Ausdruck | Augen | Mund | Arme | Requisite |
| --- | --- | --- | --- | --- |
| Neutral | Punkte | kleiner Bogen | hängen an den Flanken | keine |
| Freut sich | Bögen nach oben | offen, gefüllt | beide hoch und nach außen | kurze Striche in Akzent, Grün, Braun strahlen ab |
| Hört zu (Sprache, Alexa, Siri) | Punkte, Blick nach oben rechts | kleiner offener Kreis | der vordere Arm hoch ans Ohr | zwei violette Schallbögen auf Ohrhöhe |
| Winkt | Punkte | Bogen | der vordere Arm hoch | zwei violette Winkspuren |

Ausdrücke ändern nur Augen, Mund, Arme und kleine Requisiten. Körper, Linie, Honigfläche, Streifen und Flügel bleiben fest. Augenbrauen, Nase, Zähne und Wangen gibt es nicht.

## Posen-Regeln

- Standardansicht ist das Dreiviertel nach rechts. Vorne nur für frontale Momente, die Seite nur in Bewegung.
- Die Hummel schwebt immer. Füße und Boden gibt es nicht; ein Schatten ist nicht nötig.
- Die Linie bleibt ein Zug. Neue Posen dürfen sie nicht teilen, kreuzen oder am Scheitel schließen.
- Requisiten sind ebenfalls Striche in Linienstärke 4, nie Flächen.
- Arme sind einzelne Striche ohne Hände. Sie halten nichts Größeres als einen Strich.
- Kleiner als 48 px wird statt der Figur das Icon gezeigt: die Hummel im Profil auf Honig.

## Do und Don’t

- **Do:** viel Weißraum lassen; die Figur lebt von wenigen Linien.
- **Do:** den Honig-Versatz immer gleich halten, er ist das Erkennungszeichen.
- **Do:** auf dunklem Grund die Papierunterlage mitnehmen.
- **Don’t:** die Linie schließen, verdoppeln oder ihre Stärke ändern.
- **Don’t:** Honig genau in die Linie setzen, das macht daraus den Sticker.
- **Don’t:** Streifen als Bänder füllen oder bis an die Linie ziehen.
- **Don’t:** Schatten, Verläufe, Glanz oder Schraffur.
- **Don’t:** Text in die Figur schreiben oder sie als Sprechblase benutzen.

## Referenzblatt und Prompt

Das Referenzblatt (`sheet.png` in diesem Ordner, oben auf der Seite eingebettet) zeigt die Rundum-Ansicht, die vier Ausdrücke, die Farben, das Icon in vier Größen und die einfarbigen Fassungen. Es ist die Bildvorlage für Illustrator:innen und für Bildgeneratoren (als Referenzbild hochladen, dazu der folgende Block). Der Prompt ist auf Englisch, weil die gängigen Bildmodelle damit am zuverlässigsten arbeiten.

```text
Hummlist mascot "Strich bee", minimal monoline vector illustration, logo-like line drawing.
Character: a cute hovering bumblebee whose head and body are one upright oval (width:height 88:100), no neck, no feet.
Construction: ONE continuous ink line starts at the left antenna, runs down around the whole oval body and up into the right antenna. The line stays open at the crown between the two antenna roots. Antennae end in small outward hooks, not balls.
Colors only: ink #1c1a17 for every line, honey yellow #ffc72c as one flat oval fill, white #ffffff wings and body ground. Accent violet #5a3fae only for small stroke effect marks.
Signature: the honey fill is the same oval shifted down and to the left of the ink line, like a misregistered second print colour: a white crescent shows inside the line at the upper right, honey peeks out past the line at the lower left.
Fixed features: two short ink stripe strokes across the lower body that do not touch the outline, two small solid ink dot eyes, a small curved smile, two white teardrop wings at the upper back, arms as single short curved strokes without hands, a tiny stroke stinger at the back.
Style: one uniform line weight everywhere (about 2% of figure height), round caps, flat fills, no outlines around the honey, no gradients, no shading, no texture, no text. On dark backgrounds a thin white edge runs under the lines.
Default view: three-quarter view facing right, hovering, full body, centered on a plain background.
Keep proportions and features identical to the reference sheet; change only eyes, mouth, arms and small stroke props for the expression.
```
