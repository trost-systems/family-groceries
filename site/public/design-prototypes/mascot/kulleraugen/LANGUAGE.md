# Kulleraugen: Designsprache der Hummlist-Hummel

Die Hummel spielt mit den Augen. Ein runder Kopf schaut immer zu dir, zwei riesige Augen mit Lidern in Honig tragen jeden Ausdruck, darunter sitzt ein kleiner, eigener Körper mit zwei Ringstreifen. Lider, Pupillen und kurze Brauen erzählen, was die Hummel gerade fühlt. Der Rest bleibt ruhig.

## Konstruktion

Zeichenfläche 200 × 200, Ursprung oben links. Gebaut wird in dieser Reihenfolge:

1. **Kopf:** Kreis, Mitte (100, 78), Radius 46. Der Kopf ist eine Kugel: In jeder Ansicht bleibt der Umriss gleich, nur das Gesicht wandert auf ihr.
2. **Körper:** Ellipse, Mitte (100, 148), Radien 34 × 30. Der Kopf überdeckt seine Oberkante um 6 px. Die Mittelachse x = 100 ist die Symmetrieachse der Vorderansicht.
3. **Augenlinie** y = 74, **Mundlinie** y = 105. Die Augen sitzen auf der Kopfkugel bei ±0,5 rad um die Blickrichtung, 39 px von der Achse: vorne bei x = 81,3 und 118,7.
4. **Drehung:** Das Gesicht dreht sich auf der Kugel, im Dreiviertel um 0,38 rad (22°), im Profil um 1,15 rad (66°). Ein Auge wird schmaler, je weiter es zum Rand wandert (Breite nach Kosinus, nie unter 72 %). Ab 1,3 rad verschwindet es hinter dem Kopf, darum zeigt das Profil nur ein Auge.
5. **Auge:** weiße Ellipse 18 × 18 (vorne ein Kreis), Pupille r 9,5, zwei Glanzpunkte (r 3,4 oben rechts, r 1,5 unten links). Darüber liegt das Oberlid als Kreisabschnitt in Honig mit Tintenkante, die Kante leicht nach oben gewölbt.
6. **Fühler:** Kurve vom Kopf (y = 48) nach außen oben bis y = 20, Kugel r 5,5 am Ende.
7. **Flügel:** zwei Ellipsen 12 × 21 an den Schultern, hinter Kopf und Körper. Vorne gespiegelt bei (58, 120) und (142, 120), ±58°.
8. **Arme und Füße:** Arme sind Ellipsen 8 × 12 an den Körperflanken, Füße 10 × 6 auf y = 179. Der Stachel ist ein kleines Tintendreieck hinten unten.
9. **Weiße Kante:** Alle äußeren Formen (Fühler mit Kugel, Flügel, Stachel, Füße, Körper, Kopf, Arme) liegen zuerst noch einmal darunter, weiß gefüllt und weiß umrandet mit Strichstärke 8,5 (Kontur 3,5 plus 5, runde Enden). Außen bleibt so 2,5 px Weiß neben der Tintenkontur stehen.

Reihenfolge der Ebenen: weiße Kante, Fühler, Flügel, Stachel, Füße, Körper mit Streifen, Kopf, Augen mit Lidern, Mund, Wangen, Arme, Requisiten.

## Proportionen

| Maß | Wert | Regel |
| --- | --- | --- |
| Kopf : Körper (Breite) | 92 : 68 | der Kopf ist immer breiter als der Körper |
| Kopf zur Gesamthöhe | 92 von 170 | der Kopf ist mehr als die Hälfte der Figur |
| Auge | Durchmesser 36, Pupille r 9,5 | zwei Augen nehmen vorne 74 von 92 px Kopfbreite ein |
| Augenabstand | 37,4 von Mitte zu Mitte | die Augen berühren sich fast, zwischen ihnen bleiben etwa 1,5 px |
| Lid | Oberlid neutral 15 % der Augenhöhe, Kante 2,5 px nach oben gewölbt | das Oberlid deckt nie mehr als 40 % und hängt nie durch |
| Streifen | 10 hoch, zwei Stück | nur am Körper, nie am Kopf |
| Flügel | 24 × 42 | Flügel bleiben unter der Augenlinie |
| Kontur | 3,5 | Brauen 4,5, Mund 3,5, Lachbögen 5, weiße Kante 2,5 außen |

## Feste Merkmale

Diese Merkmale ändern sich in keiner Pose, keinem Format und keiner Anzeige:

- Ein runder Honigkopf und ein kleinerer, eigener Körper darunter, beide mit Tintenkontur.
- Zwei riesige weiße Augen mit großer Pupille und zwei Glanzpunkten, fast so breit wie der Kopf.
- Lider in Honig mit Tintenkante. Sie sind das wichtigste Ausdrucksmittel.
- Eine schmale weiße Kante (2,5 px) um die ganze Figur. Auf Creme ist sie eine klare Randlinie, auf dunklem Grund hält sie Fühler, Füße, Arme und Stachel sichtbar.
- Genau zwei Ringstreifen am Körper, vorne wie hinten.
- Zwei Fühler mit Kugelende, zwei weiße Flügel, ein kleiner Stachel (nur von der Seite oder hinten sichtbar).
- Zwei Wangen in hellem Honig unter den Augen.

## Farb-Tokens

Alle Farben kommen aus `option-3-hummel/tokens.json`. Die Figur nutzt in hellem und dunklem Modus dieselben Werte, nur der Grund wechselt. Die weiße Kante trägt sie in beiden Modi.

| Rolle | Token | Wert |
| --- | --- | --- |
| Kopf, Körper, Lider, Arme | `color.light.honey` | #ffc72c |
| Streifen, Kontur, Pupille, Brauen, Mund, Füße, Stachel | `color.light.ink` | #1c1a17 |
| Augenweiß, Glanzpunkte, Flügel, weiße Kante (Strich 8,5 unter der Außenkontur) | `color.light.surface-raised` | #ffffff |
| Wangen | `color.light.honey-soft` | #fde7a6 |
| Zunge | `color.light.error` | #c0262d |
| Schallbögen, Winkspuren, Konfetti | `color.light.accent` | #5a3fae |
| Konfetti | `color.light.success`, `color.light.brand` | #23793a, #8a5800 |

Einfarbig gibt es zwei Fassungen: Tinte (#1c1a17) auf Weiß, und ausgespart (Weiß auf Tinte). Die Wangen und die weiße Kante entfallen dort, alle anderen Formen tragen schon ihre Kontur. Andere Farben, Verläufe und Transparenz an der Figur sind nicht erlaubt.

## Ausdrücke

Ein Ausdruck ändert nur Augen (Lider, Pupillen, Brauen), Mund, Arme und kleine Requisiten. Kopf, Körper, Streifen, Flügel und Fühler bleiben, wie sie sind.

| Ausdruck | Oberlid | Augen | Pupillen | Brauen | Mund | Arme | Requisite |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Neutral | 15 %, Kante nach oben gewölbt | offen | leicht nach rechts | keine | kleiner Bogen | hängen an den Flanken | keine |
| Freut sich | keins | zugekniffen: je ein Tintenbogen nach oben (Strich 5), kein Weiß | keine | keine | offen, Zunge in Fehlerrot | beide hoch | Konfetti in Akzent, Grün, Braun |
| Hört zu (Sprache, Alexa, Siri) | 10 % | offen | nach oben rechts | rechte Braue 8 px höher als die linke | kleines rundes O | eine Hand an der Wange | zwei violette Schallbögen auf Augenhöhe |
| Winkt | keins | weit offen | leicht nach rechts | beide hoch | breiter Bogen | der vordere Arm hoch | zwei violette Winkspuren |

Neue Ausdrücke entstehen aus denselben Reglern: Lidhöhe, Lidneigung, Lidwölbung, Pupillenlage, Brauen, zugekniffene Bögen. Freude zeigt sich mit zugekniffenen Bögen, nie mit Unterlidern, die über die Pupille schieben: das liest sich verschmitzt statt fröhlich. Nase, Zähne und Wimpern gibt es nicht.

## Posen-Regeln

- Standardansicht ist das Dreiviertel nach rechts. Beide Augen bleiben sichtbar, der Kopf schaut fast frontal. Vorne für Icons und direkte Ansprache, die Seite nur in Bewegung.
- Der Kopf dreht sich, der Umriss nicht: Nur Augen, Mund, Wangen und Fühler wandern auf der Kugel.
- Die Augen bleiben immer ganz im Kopf, auch das schmalere am Rand.
- Der Kopf darf sich um höchstens 15° neigen, der Körper bleibt darunter und biegt sich nie.
- Arme sind kurz. Sie reichen höchstens bis zur Wange und überdecken nie ein Auge.
- Requisiten (Schallbögen, Konfetti) liegen neben der Figur und berühren sie nicht.
- Kleiner als 48 px wird statt der Figur das Icon gezeigt.

## Do und Don’t

- **Do:** den Ausdruck zuerst über Lider und Pupillen spielen, dann erst über Mund und Arme.
- **Do:** die Augen groß lassen, auch in kleinen Formaten.
- **Do:** Einfarbig nur in Tinte auf Weiß oder Weiß auf Tinte.
- **Do:** Auf dunklem Grund trägt die Figur ihre weiße Kante.
- **Don’t:** Schatten, Verläufe oder Glanz auf Kopf und Körper. Glanz gibt es nur als zwei weiße Punkte im Auge.
- **Don’t:** Streifen auf den Kopf legen oder mehr als zwei Streifen zeichnen.
- **Don’t:** Kopf und Körper zu einer Form verschmelzen oder einen Hals zeichnen.
- **Don’t:** die Lider grimmig schräg stellen oder im neutralen Gesicht tiefer als 15 % senken. Die Hummel ist nie böse und nie müde.
- **Don’t:** Text in die Figur schreiben oder sie als Sprechblase benutzen.

## Referenzblatt und Prompt

Das Referenzblatt (`sheet.png` in diesem Ordner, oben auf der Seite eingebettet) zeigt die Rundum-Ansicht, die vier Ausdrücke, die Farben, das Icon in vier Größen und die einfarbigen Fassungen. Es ist die Bildvorlage für Illustrator:innen und für Bildgeneratoren (als Referenzbild hochladen, dazu der folgende Block). Der Prompt ist auf Englisch, weil die gängigen Bildmodelle damit am zuverlässigsten arbeiten.

```text
Hummlist mascot "Kulleraugen bee", flat 2D vector character illustration.
Character: a cute bumblebee with a big perfectly round head that always faces the viewer, sitting on a separate, smaller oval body (head 92 wide, body 68 wide, head slightly overlapping the body top, no neck).
Colors only: honey yellow #ffc72c head, body, eyelids and arms; ink #1c1a17 outlines, stripes, pupils, brows, mouth and feet; pure white #ffffff eye whites, eye highlights and wings; light honey #fde7a6 cheeks. Accent violet #5a3fae only for small effect marks.
Fixed features: two huge round white eyes that almost touch and together fill most of the head width, big round ink pupils with one large and one small white highlight; honey-colored eyelids with an ink edge that cover only the top sixth of each eye in the neutral face, the lid edge arching slightly upward so the bee looks awake and friendly; when happy the eyes squeeze shut into two thick upward-curved ink arcs (^ ^); small soft cheeks under the eyes; a small curved smile low on the head; two thin antennae with round ink ball tips; exactly two horizontal ink ring stripes on the body only, never on the head; two small white oval wings at the shoulders behind the head; short stubby honey arms; two small ink oval feet; a tiny ink stinger at the back.
Acting: expressions change only eyelids, pupils, short ink brows, mouth and arms; head, body, stripes and wings never change.
Style: uniform medium ink outline (about 2% of figure height) on every shape, plus a thin white edge (about 1.5% of figure height) around the whole outer silhouette so the figure reads on dark backgrounds; flat fills, no gradients, no shading, no texture, no text.
Default view: three-quarter view facing right with both eyes visible, standing, full body, centered on a plain background.
Keep proportions and features identical to the reference sheet.
```
