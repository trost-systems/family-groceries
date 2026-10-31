# Sticker: Designsprache der Hummlist-Hummel

Die Hummel aus Option 3, aufgerichtet zur Figur. Ein Ei ohne Hals ist Kopf und Körper zugleich, zwei Ringstreifen sitzen unter dem Mund, alles hat eine Tintenkontur, und ein weißer Stanzrand läuft um die ganze Silhouette. So klebt sie wie ein Aufkleber auf jedem Grund, hell wie dunkel.

## Konstruktion

Zeichenfläche 200 × 200, Ursprung oben links. Gebaut wird in dieser Reihenfolge:

1. **Körper:** Ellipse, Mitte (100, 112), Radien 54 × 60. Die Mittelachse x = 100 ist die Symmetrieachse der Vorderansicht.
2. **Augenlinie** y = 94, **Mundlinie** y = 118, **Streifenlinie** y = 132 (erster Streifen), Abstand 28 zum zweiten.
3. **Gesichtskreis:** Radius 30 um den Gesichtsmittelpunkt. In der Vorderansicht liegt er auf der Achse, im Dreiviertel 18 px nach rechts (0,42 × Körperradius × 0,8), im Profil 34 px.
4. **Flügel:** zwei Ellipsen 17 × 27, oben hinter dem Körper. Vorne gespiegelt bei ±30 px und ±28°, im Dreiviertel nach links versetzt (−34° und +4°).
5. **Fühler:** quadratische Kurve vom Scheitel (y = 56) nach außen oben, Kugel r = 6 am Ende.
6. **Arme und Füße:** Ellipsen 10 × 14 an den Flanken, Füße 13 × 7 auf y = 172. Der Stachel ist ein kleines Tintendreieck hinten unten.

Erst die Silhouette, dann der Stanzrand (Kontur 18 in Weiß hinter allem, also 9 px sichtbar), dann Füllungen, Streifen, Kontur, Gesicht, Arme, Requisiten.

## Proportionen

| Maß | Wert | Regel |
| --- | --- | --- |
| Körper Breite : Höhe | 108 : 120 = 9 : 10 | nie runder als 1 : 1, nie schlanker als 4 : 5 |
| Körper zur Gesamthöhe | 120 von 160 | der Körper ist drei Viertel der Figur |
| Auge | 20 × 24, Pupille r 5,5 | Augenabstand 34 = ein Augendurchmesser dazwischen |
| Streifen | 15 hoch, zwei Stück | Streifen beginnen unter dem Mund, nie über den Augen |
| Flügel | 34 × 54 | Flügel ragen höchstens 40 px über den Körper |
| Kontur | 5 | Augen 3,5, Mund 4 |
| Stanzrand | 9 sichtbar | immer geschlossen, folgt allen Außenformen |

## Feste Merkmale

Diese Merkmale ändern sich in keiner Pose, keinem Format und keiner Anzeige:

- Ein Ei-Körper ohne Hals, Honig mit Tintenkontur.
- Genau zwei Ringstreifen vorne, drei von hinten gesehen.
- Zwei Fühler mit Kugelende, zwei weiße Flügel.
- Zwei Augen als weiße Ovale mit Pupille und Glanzpunkt oben rechts.
- Ein Stachel, klein und nur von der Seite oder hinten sichtbar.
- Der weiße Stanzrand rundherum.

## Farb-Tokens

Alle Farben kommen aus `option-3-hummel/tokens.json`. Die Figur nutzt in hellem und dunklem Modus dieselben Werte, nur der Grund wechselt.

| Rolle | Token | Wert |
| --- | --- | --- |
| Körper, Arme | `color.light.honey` | #ffc72c |
| Streifen, Kontur, Pupille, Mund, Füße | `color.light.ink` | #1c1a17 |
| Flügel, Augenweiß, Glanz, Stanzrand | `color.light.surface-raised` | #ffffff |
| Zunge | `color.light.error` | #c0262d |
| Schallbögen, Winkspuren, Konfetti | `color.light.accent` | #5a3fae |
| Konfetti | `color.light.success`, `color.light.brand` | #23793a, #8a5800 |

Einfarbig gibt es zwei Fassungen: Tinte (#1c1a17) auf Weiß, und ausgespart (Weiß auf Tinte). Andere Farben, Verläufe und Transparenz an der Figur sind nicht erlaubt.

## Ausdrücke

| Ausdruck | Augen | Mund | Arme | Requisite |
| --- | --- | --- | --- | --- |
| Neutral | offen, Pupille leicht in Blickrichtung | kleiner Bogen | hängen an den Flanken | keine |
| Freut sich | geschlossen als Bögen nach oben | offen, Zunge in Fehlerrot | beide hoch | Konfetti in Akzent, Grün, Braun |
| Hört zu (Sprache, Alexa, Siri) | offen, Pupillen nach oben rechts | kleines rundes O | eine Hand an der Wange | zwei violette Schallbögen auf Ohrhöhe |
| Winkt | offen | Bogen | der vordere Arm hoch | zwei violette Winkspuren |

Neue Ausdrücke entstehen nur aus Augen, Mund und Armen. Augenbrauen, Nase und Zähne gibt es nicht.

## Posen-Regeln

- Standardansicht ist das Dreiviertel nach rechts. Sie zeigt beide Augen und den Stachel. Vorne nur für Icons und frontale Momente, die Seite nur in Bewegung.
- Die Figur steht. Sie fliegt nur, wenn die Füße unsichtbar werden und die Flügel doppelt so groß gezeichnet sind. Das ist eine eigene, spätere Pose.
- Der Körper bleibt starr: Er neigt sich um höchstens 10°, aber er biegt sich nie.
- Arme sind kurz. Sie reichen nicht über den Kopf und halten nur kleine Gegenstände in Körperbreite.
- Requisiten (Schallbögen, Konfetti) liegen außerhalb des Stanzrands und berühren ihn nicht.
- Kleiner als 48 px wird statt der Figur das Icon gezeigt.

## Do und Don’t

- **Do:** auf jeden Grund stellen, der Stanzrand trennt.
- **Do:** Ausdruck über Augen und Arme spielen, der Körper bleibt ruhig.
- **Do:** Einfarbig nur in Tinte auf Weiß oder Weiß auf Tinte.
- **Don’t:** Schatten, Verläufe oder Glanz auf dem Körper.
- **Don’t:** mehr als zwei Streifen vorne, Streifen über den Augen.
- **Don’t:** die Hummel strecken, stauchen oder in Kleidung stecken.
- **Don’t:** Text in die Figur schreiben oder sie als Sprechblase benutzen.
- **Don’t:** den Stanzrand weglassen, außer in den einfarbigen Fassungen.

## Referenzblatt und Prompt

Das Referenzblatt (`sheet.png` in diesem Ordner, oben auf der Seite eingebettet) zeigt die Rundum-Ansicht, die vier Ausdrücke, die Farben, das Icon in vier Größen und die einfarbigen Fassungen. Es ist die Bildvorlage für Illustrator:innen und für Bildgeneratoren (als Referenzbild hochladen, dazu der folgende Block). Der Prompt ist auf Englisch, weil die gängigen Bildmodelle damit am zuverlässigsten arbeiten.

```text
Hummlist mascot "Sticker bee", flat 2D vector sticker illustration.
Character: a cute bumblebee whose head and body are one single egg shape (width:height 9:10), no neck.
Colors only: honey yellow #ffc72c body, ink #1c1a17 outlines and stripes, pure white #ffffff wings and eye whites. Accent violet #5a3fae only for small effect marks.
Fixed features: exactly two horizontal ink ring stripes across the lower half of the body (three when seen from behind), two big oval white eyes with round ink pupils and a small white highlight top right, a small curved smile, two thin antennae with round ball tips, two white oval wings behind the top of the body, short stubby honey arms, two small ink oval feet, a tiny ink stinger at the back.
Style: uniform thick ink outline (about 2.5% of figure height), a continuous white die-cut sticker border around the whole silhouette, flat fills, no gradients, no shading, no texture, no text.
Default view: three-quarter view facing right, standing, full body, centered on a plain background.
Keep proportions and features identical to the reference sheet; change only eyes, mouth, arms and small props for the expression.
```
