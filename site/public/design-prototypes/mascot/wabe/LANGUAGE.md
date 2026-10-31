# Wabe: Designsprache der Hummlist-Hummel

Eine Honigwaben-Zelle, die aufsteht. Der Körper ist ein Sechseck mit flacher Ober- und Unterkante und etwas Tiefe: Dreht sich die Hummel, zeigt sich links eine braune Seitenfacette. Die Flügel sind zwei längliche Zellen. Augen, Mund, Füße, Fühlerspitzen, Schallbögen und Konfetti folgen demselben 60°-Raster. Klar und kantig, aber durch abgerundete Ecken freundlich.

## Konstruktion

Zeichenfläche 200 × 200, Ursprung oben links. Gebaut wird in dieser Reihenfolge:

1. **Grundsechseck:** Sechseck mit flacher Ober- und Unterkante, Mitte (100, 106), Umkreisradius 62. Es ist 124 breit und 107 hoch (y = 52 bis 160). Alle Ecken sind mit Radius 7 gerundet.
2. **60°-Raster:** Die drei Achsen durch die Mitte (0°, 60°, 120°) bestimmen alle Schrägen. Jede schräge Kante an der Figur liegt parallel zu einer dieser Achsen.
3. **Drehung:** Die Vorderfläche wird waagrecht gestaucht, die Seitenfacette wächst links heraus. Vorderfläche und Facette zusammen bleiben auf x = 100 zentriert.

   | Ansicht | Stauchung | Facette | Gesicht rückt nach rechts |
   | --- | --- | --- | --- |
   | Vorne | 1,0 | 0 | 0 |
   | Dreiviertel | 0,9 | 16 | 0,22 × halbe Breite |
   | Seite | 0,7 | 28 | 0,42 × halbe Breite |
   | Hinten | 1,0 | 0 | kein Gesicht |

4. **Augenlinie** y = 86, **Mundlinie** y = 107, **Streifen** ab y = 119 und y = 139, je 13 hoch. Von hinten drei Streifen ab y = 76, 103 und 130.
5. **Flügel:** zwei längliche Sechsecke (Radius 25, quer auf 0,64 gestaucht, also 32 × 50, Ecken 6), hinter den oberen Ecken. Vorne bei ±52 px und ±56° gekippt. Im Dreiviertel liegt der hintere Flügel flach nach links (−54°), der vordere steht schräg nach oben (+30°).
6. **Fühler:** Linienzug mit einem Knick, von der Oberkante (13 px neben der Gesichtsmitte) 16 nach oben, dann schräg nach außen bis 26 über der Kante. Am Ende ein gefülltes Sechseck mit Radius 6,5.
7. **Arme:** Kapseln, Tinte 21 breit, Honig 12 darin. Die Schultern liegen auf y = 124 an der Körperkante, ein Arm ist etwa 22 lang.
8. **Füße:** Trapeze (halbe Sechsecke), unten 28 breit, oben 16, 10 hoch, bei x = ±20 auf y = 162 bis 172. Der Stachel ist ein kleines Tintendreieck hinten unten.

9. **Weiße Kante:** In Farbe liegt unter jeder Tintenform am Umriss (Fühler mit Spitzen, Flügel, Stachel, Füße, Körperkontur, Arme) dieselbe Form in Weiß, 5 breiter als die Tinte (Kontur 9,5, Arme 26, Fühlerspitzen 5), runde Enden. Außen bleibt ein Rand von 2,5 sichtbar. Braunes Konfetti bekommt dieselbe Kante (5).

Reihenfolge der Ebenen: weiße Kante, Fühler, Flügel, Stachel, Füße, Facette, Vorderfläche, Streifen (auf Facette und Vorderfläche beschnitten), Konturen, Gesicht, Arme, Requisiten. Von hinten liegen die Flügel vor dem Körper.

## Proportionen

| Maß | Wert | Regel |
| --- | --- | --- |
| Körper Breite : Höhe | 124 : 107 | immer ein regelmäßiges Sechseck, nie gestreckt |
| Körper zur Gesamthöhe | 107 von 152 | der Körper ist gut zwei Drittel der Figur |
| Auge | Sechseck mit Spitze oben, 21 × 24, Pupille r 5,6 | Augenmitten 36 auseinander, ein Auge Platz dazwischen |
| Mund | halbes Sechseck, 18 breit, 6 tief | sitzt mittig unter den Augen |
| Streifen | 13 hoch, 7 Abstand | Streifen beginnen unter dem Mund, nie über den Augen |
| Flügel | 32 × 50 | ragen höchstens 30 px über die Oberkante |
| Facette | 16 im Dreiviertel, 28 von der Seite | nur in diesen Ansichten, immer links |
| Kontur | 4,5 | Augen 3,5, Mund 4, Arme 4,5 sichtbar |

## Feste Merkmale

Diese Merkmale ändern sich in keiner Pose, keinem Format und keiner Anzeige:

- Ein Sechseck-Körper mit flacher Ober- und Unterkante, Honig mit Tintenkontur und gerundeten Ecken.
- Genau zwei waagrechte Streifen vorne, drei von hinten.
- Zwei Flügel als weiße, längliche Sechsecke.
- Zwei Augen als weiße Sechsecke mit Spitze oben, runder Pupille und Glanzpunkt.
- Ein eckiger Mund aus dem unteren Halb-Sechseck.
- Zwei geknickte Fühler mit Sechseck-Spitze, Trapez-Füße, ein kleiner Stachel.
- Die braune Seitenfacette, sobald sich die Figur dreht.
- In Farbe eine schmale weiße Kante (2,5 sichtbar) um den ganzen Umriss, damit Fühler, Füße, Stachel und Arme auch auf dunklem Grund stehen.

## Farb-Tokens

Alle Farben kommen aus `option-3-hummel/tokens.json`. Die Figur nutzt in hellem und dunklem Modus dieselben Werte, nur der Grund wechselt.

| Rolle | Token | Wert |
| --- | --- | --- |
| Vorderfläche, Arme | `color.light.honey` | #ffc72c |
| Seitenfacette, Konfetti | `color.light.brand` | #8a5800 |
| Streifen, Kontur, Pupille, Mund, Füße, Stachel | `color.light.ink` | #1c1a17 |
| Flügel, Augenweiß, Glanz, weiße Kante (Tintenbreite + 5) | `color.light.surface-raised` | #ffffff |
| Zunge | `color.light.error` | #c0262d |
| Schallbögen, Winkspuren, Konfetti | `color.light.accent` | #5a3fae |
| Konfetti | `color.light.success` | #23793a |

Einfarbig gibt es zwei Fassungen: Tinte (#1c1a17) auf Weiß, und ausgespart (Weiß auf Tinte). Die Facette wird dabei zur Tintenfläche, alle Formen behalten ihre Kontur. Die weiße Kante entfällt einfarbig, die Fassungen liegen auf ihrer eigenen Kachel. Andere Farben, Verläufe und Transparenz an der Figur sind nicht erlaubt.

## Ausdrücke

Ausdrücke ändern nur Augen, Mund, Arme und kleine Requisiten. Körper, Facette, Streifen und Flügel bleiben in jeder Pose gleich.

| Ausdruck | Augen | Mund | Arme | Requisite |
| --- | --- | --- | --- | --- |
| Neutral | offen, Pupille leicht nach rechts | halbes Sechseck als Lächeln | hängen schräg an den Flanken | keine |
| Freut sich | geschlossen als 60°-Winkel nach oben | offenes Trapez, Zunge in Fehlerrot | beide hoch | Sechseck-Konfetti in Akzent, Grün, Braun |
| Hört zu (Sprache, Alexa, Siri) | offen, Pupillen nach oben rechts | kleines gefülltes Sechseck | hängen ruhig | zwei violette Schallbögen als halbe Sechsecke neben dem Kopf |
| Winkt | offen | halbes Sechseck | der vordere Arm schräg hoch | zwei violette Winkstriche |

Neue Ausdrücke entstehen nur aus Augen, Mund und Armen. Augenbrauen, Nase und Zähne gibt es nicht. Runde Formen gibt es nur bei Pupillen, Glanzpunkten und den Enden der Arme.

## Posen-Regeln

- Standardansicht ist das Dreiviertel nach rechts: Facette links, beide Augen sichtbar, Stachel hinten unten.
- Die Figur steht. Fliegen ist eine eigene, spätere Pose: Füße weg, Flügel doppelt so groß.
- Der Körper ist eine starre Zelle. Er neigt sich höchstens um 10°, er biegt, streckt und staucht sich nie.
- Arme sind kurz, sie reichen höchstens bis auf Augenhöhe und halten nur kleine Dinge in Körperbreite.
- Requisiten folgen dem 60°-Raster: Sechsecke, halbe Sechsecke, gerade Striche.
- Requisiten berühren die Figur nicht und bleiben 8 px vom Bildrand weg.
- Kleiner als 48 px wird statt der Figur das Icon gezeigt.

## Do und Don’t

- **Do:** jede neue Form aus dem Sechseck oder dem 60°-Raster ableiten.
- **Do:** Ecken immer leicht runden, damit die Figur freundlich bleibt.
- **Do:** Ausdruck über Augen und Arme spielen, der Körper bleibt ruhig.
- **Do:** auf dunklem Grund trägt die Figur ihre weiße Kante.
- **Don’t:** den Körper rund, oval oder als Würfel zeichnen.
- **Don’t:** Schatten, Verläufe, Glanz oder Wabenmuster auf dem Körper; die Facette ist die einzige zweite Körperfarbe.
- **Don’t:** mehr als zwei Streifen vorne, Streifen schräg oder über den Augen.
- **Don’t:** die Facette auf die rechte Seite legen, wenn die Figur nach rechts schaut.
- **Don’t:** Text in die Figur schreiben oder sie als Sprechblase benutzen.

## Referenzblatt und Prompt

Das Referenzblatt (`sheet.png` in diesem Ordner, oben auf der Seite eingebettet) zeigt die Rundum-Ansicht, die vier Ausdrücke, die Farben, das Icon in vier Größen und die einfarbigen Fassungen. Es ist die Bildvorlage für Illustrator:innen und für Bildgeneratoren (als Referenzbild hochladen, dazu der folgende Block). Der Prompt ist auf Englisch, weil die gängigen Bildmodelle damit am zuverlässigsten arbeiten.

```text
Hummlist mascot "Wabe bee", flat 2D geometric vector illustration built on a 60 degree honeycomb grid.
Character: a cute bumblebee whose head and body are one single regular hexagon with flat top and flat bottom edges (width:height 124:107), all corners slightly rounded, no neck. The hexagon has a little depth: when turned, a darker side facet shows on the left.
Colors only: honey yellow #ffc72c front face and arms, brown #8a5800 side facet, ink #1c1a17 outlines, stripes, pupils, feet and stinger, pure white #ffffff wings and eye whites. Accent violet #5a3fae only for small effect marks; confetti may use #5a3fae, green #23793a and brown #8a5800.
Fixed features: exactly two straight horizontal ink stripes across the lower third of the hexagon (three when seen from behind); two eyes shaped as white pointy-top hexagons with round ink pupils and a small white highlight; an angular smile shaped like the lower half of a hexagon; two thin antennae with one sharp bend, ending in small filled ink hexagons; two white wings shaped as elongated hexagons behind the upper corners; short capsule-shaped honey arms; feet as two small ink trapezoids; a tiny ink triangle stinger at the back.
Style: uniform ink outline (about 3% of figure height) on every shape, plus a thin pure white #ffffff edge (about 1.5% of figure height) hugging the outside of the whole silhouette, around antennae, wings, arms, feet and stinger, so the figure reads on dark backgrounds too; it is a crisp edge, not a thick sticker border; flat fills, crisp straight edges with softly rounded corners, no curves on the body, no gradients, no shading, no texture, no honeycomb pattern on the body, no text.
Default view: three-quarter view facing right, side facet visible on the left, standing, full body, centered on a plain background.
Keep proportions and features identical to the reference sheet; change only eyes, mouth, arms and small props for the expression. Props are hexagons, half hexagons or straight strokes.
```
