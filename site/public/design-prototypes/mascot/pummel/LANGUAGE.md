# Pummel: Designsprache der Hummlist-Hummel

Eine Hummel wie ein Wollknäuel. Der Körper ist fast eine Kugel, oben sitzt ein Schopf aus drei braunen Flauschkugeln zwischen zwei kurzen Fühlern, die Flügel sind winzig und fliederfarben, Pfötchen und Füße kurze braune Knubbel. In Farbe gibt es keine Tintenkontur: Die Formen trennen sich nur über ihre Flächenfarbe. Nur nach außen, zum Grund hin, trägt die Figur eine dünne weiße Kante, damit sie auch auf dunklem Grund steht.

## Konstruktion

Zeichenfläche 200 × 200, Ursprung oben links. Gebaut wird in dieser Reihenfolge:

1. **Körperkugel:** Ellipse, Mitte (100, 114), Radien 62 × 58. Die Mittelachse x = 100 ist die Symmetrieachse der Vorderansicht.
2. **Augenlinie** y = 102, **Mundlinie** y = 118, **Streifenlinie** y = 131 (erster Streifen), Abstand 22 zum zweiten. Die Streifen sind Bänder von 13 Höhe, die sich zur Mitte um 7 nach unten wölben, und werden an der Kugel abgeschnitten.
3. **Gesichtskreis:** Radius 30 um den Gesichtsmittelpunkt (Augenlinie + 6). Vorne liegt er auf der Achse, im Dreiviertel 18,6 px nach rechts (0,4 × Körperradius × 0,75), im Profil 34,4 px.
4. **Schopf:** drei Kreise, Mitte r 11 auf (100, 52), links und rechts r 9 auf (±12, 60). Er wandert mit dem Gesicht mit, im Dreiviertel 8 px, im Profil 15 px. Er liegt vor der Kugel.
5. **Fühler:** zwei kurze quadratische Kurven von (±14, 62) nach außen oben bis y = 36, Kugel r 5,5 am Ende, Strich 4,5.
6. **Flügel:** zwei Ellipsen 13 × 20 hinter der Kugel, oben seitlich. Vorne gespiegelt auf (50 | 150, 72) bei ±38°, im Dreiviertel beide nach hinten links versetzt (46, 80, −48°) und (66, 60, −18°). Von hinten liegen sie vor der Kugel.
7. **Pfötchen und Füße:** Pfötchen 10 × 13 halb hinter der Kugel an den Flanken (y = 130), Füße 14 × 8 auf y = 170, ebenfalls halb verdeckt. Der Stachel ist ein kleines Tintendreieck hinten unten.

8. **Weiße Kante (nur Farbe):** dieselben Formen wie Kugel, Schopf, Fühler, Pfötchen, Füße und Stachel, zuerst in Weiß mit Strich 5 gezeichnet (2,5 px je Seite), die Kugel mit Strich 3 (1,5 px). Sie liegt unter allem und ist deshalb nur dort zu sehen, wo ein Teil an den Grund stößt, nie auf dem Honig. Requisiten bekommen dieselbe Kante.

Reihenfolge der Ebenen: weiße Kante, Fühler, Flügel, Stachel, Füße, Pfötchen, Kugel, Streifen, Schopf, Gesicht, Pfötchen vor dem Körper, Requisiten.

## Proportionen

| Maß | Wert | Regel |
| --- | --- | --- |
| Kugel Breite : Höhe | 124 : 116 = 16 : 15 | nie schmaler als 1 : 1, nie breiter als 4 : 3 |
| Kugel zur Gesamthöhe | 116 von 148 | die Kugel ist vier Fünftel der Figur |
| Auge | 15 × 20, Glanzpunkt r 2,8 | Augenabstand 34, Augen sitzen über der Kugelmitte |
| Bäckchen | 14 × 9 | unter und außerhalb jedes Auges, 15 tiefer |
| Streifen | 13 hoch, zwei Stück | beginnen unter dem Mund, unten bleibt ein Honigrand |
| Flügel | 26 × 40 | ragen höchstens 25 px über die Kugel, nie größer als ein Drittel der Kugelbreite |
| Pfötchen, Füße | 20 × 26, 28 × 16 | immer zur Hälfte von der Kugel verdeckt |
| Kontur | keine | nur einfarbig: 4 um Kugel, Flügel und Stachel |
| Weiße Kante | 2,5 je Seite, Kugel 1,5 | nur in Farbe, nur nach außen; Flügel ohne Kante |

## Feste Merkmale

Diese Merkmale ändern sich in keiner Pose, keinem Format und keiner Anzeige:

- Eine Kugel als Kopf und Körper zugleich, Honig, flach, ohne Kontur.
- Der Schopf aus drei braunen Flauschkugeln zwischen zwei kurzen braunen Fühlern mit Kugelende.
- Zwei winzige Flügel in Flieder, nie weiß.
- Zwei Augen als Tintenovale ohne Augenweiß, mit Glanzpunkt oben rechts, darunter helle Bäckchen.
- Genau zwei Ringstreifen vorne, drei von hinten gesehen.
- Kurze braune Pfötchen und Füße, ein kleiner Tintenstachel nur von der Seite oder hinten.
- In Farbe eine dünne weiße Außenkante um Kugel, Schopf, Fühler, Pfötchen, Füße und Stachel (2,5 px, an der Kugel 1,5 px), auf hellem wie dunklem Grund. Innen, zwischen den Formen, gibt es keine Linie.

Ausdrücke ändern nur Augen, Mund, Pfötchen und kleine Requisiten. Kugel, Schopf, Streifen und Flügel bleiben in jeder Pose gleich.

## Farb-Tokens

Alle Farben kommen aus `option-3-hummel/tokens.json`. Die Figur nutzt in hellem und dunklem Modus dieselben Werte, nur der Grund wechselt; auf dunklem Grund (#16131f) halten Stachel, Streifenenden, Braun und Violett über die weiße Außenkante.

| Rolle | Token | Wert |
| --- | --- | --- |
| Kugel | `color.light.honey` | #ffc72c |
| Streifen, Augen, Mund, Stachel | `color.light.ink` | #1c1a17 |
| Schopf, Fühler, Pfötchen, Füße | `color.light.brand` | #8a5800 |
| Bäckchen | `color.light.honey-soft` | #fde7a6 |
| Flügel | `color.light.accent-soft` | #e5dcff |
| Glanzpunkt | `color.light.surface-raised` | #ffffff |
| Weiße Außenkante (Strich 5, Kugel 3) | `color.light.surface-raised` | #ffffff |
| Zunge | `color.light.error` | #c0262d |
| Schallbögen, Winkspuren, Konfetti | `color.light.accent` | #5a3fae |
| Konfetti | `color.light.success`, `color.light.brand` | #23793a, #8a5800 |

Einfarbig gibt es zwei Fassungen: Tinte (#1c1a17) auf Weiß, und ausgespart (Weiß auf Tinte). Nur dort bekommen Kugel, Flügel und Stachel eine Kontur von 4, weil die Flächenfarben fehlen; Schopf, Fühler, Pfötchen und Füße werden voll in Tinte gefüllt, Bäckchen und Zunge entfallen. Andere Farben, Verläufe und Transparenz an der Figur sind nicht erlaubt.

## Ausdrücke

| Ausdruck | Augen | Mund | Pfötchen | Requisite |
| --- | --- | --- | --- | --- |
| Neutral | offene Tintenovale mit Glanzpunkt | kleiner Bogen | hängen halb verdeckt an den Flanken | keine |
| Freut sich | geschlossen als Bögen nach oben | offen, Zunge in Fehlerrot | beide hoch, halb hinter der Kugel | Konfetti aus Punkten und Pluszeichen in Akzent, Grün, Braun |
| Hört zu (Sprache, Alexa, Siri) | offen, nach oben rechts verschoben | kleines rundes O | das vordere Pfötchen vor der Wange, unter dem Auge | zwei violette Schallbögen mit Punkt auf Augenhöhe |
| Winkt | offen | Bogen | das vordere Pfötchen hoch | zwei violette Winkspuren über dem Pfötchen |

Neue Ausdrücke entstehen nur aus Augen, Mund, Pfötchen und kleinen Requisiten. Augenbrauen, Nase und Zähne gibt es nicht. Ein Pfötchen vor dem Gesicht bleibt unter der Augenlinie.

## Posen-Regeln

- Standardansicht ist das Dreiviertel nach rechts. Es zeigt beide Augen, den Schopf und den Stachel. Vorne nur für Icons und frontale Momente, die Seite nur in Bewegung.
- Die Kugel bleibt rund: Sie darf hüpfen und um höchstens 10° kippen, aber sie wird nie gestaucht, gestreckt oder gebogen.
- Pfötchen sind kurz und hängen immer an der Kugel, halb dahinter. Sie reichen nie über den Schopf und halten nur Gegenstände, die kleiner als ein Auge sind.
- Die Flügel bleiben winzig, auch im Flug. Fliegen zeigt die Figur über Winkspuren, nicht über größere Flügel.
- Requisiten (Schallbögen, Konfetti) liegen neben der Kugel und berühren sie nicht.
- Kleiner als 48 px wird statt der Figur das Icon gezeigt.

## Do und Don’t

- **Do:** flache Farbflächen, die Formen trennen sich nur über die Farbe.
- **Do:** Auf dunklem Grund trägt die Figur ihre weiße Kante.
- **Do:** Ausdruck über Augen und Pfötchen spielen, die Kugel bleibt ruhig.
- **Do:** Einfarbig nur in Tinte auf Weiß oder Weiß auf Tinte, dann mit Kontur 4.
- **Don’t:** Tintenkonturen oder Linien zwischen den Formen in der Farbfassung, eine dicke Sticker-Kante, Schatten, Verläufe oder Glanz auf der Kugel.
- **Don’t:** weiße Flügel, große Flügel, Augenweiß.
- **Don’t:** Hals, Taille oder lange Arme und Beine. Die Kugel bleibt eine Kugel.
- **Don’t:** mehr als zwei Streifen vorne, Streifen über dem Mund.
- **Don’t:** Text in die Figur schreiben oder sie als Sprechblase benutzen.

## Referenzblatt und Prompt

Das Referenzblatt (`sheet.png` in diesem Ordner, oben auf der Seite eingebettet) zeigt die Rundum-Ansicht, die vier Ausdrücke, die Farben, das Icon in vier Größen und die einfarbigen Fassungen. Es ist die Bildvorlage für Illustrator:innen und für Bildgeneratoren (als Referenzbild hochladen, dazu der folgende Block). Der Prompt ist auf Englisch, weil die gängigen Bildmodelle damit am zuverlässigsten arbeiten.

```text
Hummlist mascot "Pummel bee", flat 2D vector illustration, extremely round and cuddly.
Character: a chubby bumblebee whose head and body are one single ball (width:height 16:15), no neck, no waist.
Colors only: honey yellow #ffc72c ball, ink #1c1a17 stripes, eyes and mouth, warm brown #8a5800 tuft, antennae, paws and feet, pale lilac #e5dcff wings, pale honey #fde7a6 cheeks, white #ffffff eye highlights. Accent violet #5a3fae only for small effect marks.
Fixed features: a fuzzy tuft of exactly three round brown puffs on top of the head between two short brown antennae with ball tips; two tiny lilac oval wings behind the upper back, much smaller than the head; two solid ink oval eyes without whites, each with one small white highlight top right; two soft pale honey cheek ovals below the eyes; a small curved smile; exactly two horizontal ink ring stripes across the lower third of the ball (three when seen from behind), with a honey rim below them; short stubby brown paws and feet half hidden behind the ball; a tiny ink triangle stinger at the back.
Style: completely flat shapes, NO dark outlines, shapes separated only by fill color, no gradients, no shading, no texture, no text. Only edge: a thin white #ffffff edge around the outside of the silhouette (about 2.5 px at 200 px size, thinner around the ball), around ball, tuft, antennae, paws, feet and stinger, never between inner shapes, so the figure reads on dark #16131f backgrounds.
Default view: three-quarter view facing right, standing, full body, centered on a plain background.
Keep proportions and features identical to the reference sheet; change only eyes, mouth, paws and small props for the expression.
```
