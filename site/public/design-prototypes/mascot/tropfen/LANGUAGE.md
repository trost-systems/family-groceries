# Tropfen: Designsprache der Hummlist-Hummel

Die Hummel als Honigtropfen. Eine einzige glatte Silhouette, oben spitz, unten ein runder Bauch, ohne Kontur. Ein flacher weißer Glanzfleck oben links macht sie glänzend wie frischer Honig. Alles, was absteht (Fühler, Arme), ist ein Tintenstrich mit Kugelende. Die Flügel sind kleine lila Tropfen.

## Konstruktion

Zeichenfläche 200 × 200, Ursprung oben links. Gebaut wird in dieser Reihenfolge:

1. **Bauchkreis:** Mitte (100, 126), Radius 52. Die Mittelachse x = 100 ist die Symmetrieachse der Vorderansicht.
2. **Tropfen:** Die Spitze liegt 92 über der Kreismitte, also bei (100, 34). Von der Spitze laufen zwei kubische Kurven in die Kreisflanken (100 ± 52, 126); ihre Kontrollpunkte liegen 0,15 R neben und 0,45 R unter der Spitze und senkrecht 0,8 R über dem Flankenpunkt. Unten schließt der Halbkreis. Dieselbe Form, verkleinert, sind Flügel, Icon und Konfetti.
3. **Augenlinie** y = 106, **Mundlinie** y = 125, **Streifen** ab y = 139 (12 hoch) und y = 160 (11 hoch), leicht nach unten gewölbt und auf den Tropfen beschnitten.
4. **Gesichtskreis:** Radius 28 um den Gesichtsmittelpunkt. Vorne liegt er auf der Achse, im Dreiviertel 16 px nach rechts (0,42 × R × 0,75), im Profil 31 px.
5. **Glanz:** eine weiße Bohne entlang der linken oberen Flanke von (79, 61) bis (60, 104), darunter ein Glanzpunkt r = 3,5 bei (64, 114). Der Glanz hängt am Licht, nicht am Gesicht: Er sitzt in jeder Ansicht oben links.
6. **Flügel:** zwei Tropfen mit Bauchradius 15 und Länge 36, die Spitze steckt hinter dem Körper. Vorne bei (62, 58) und (138, 58), um ±140° gedreht; im Dreiviertel beide nach hinten links versetzt, (54, 62) bei 136° und (76, 46) bei 160°.
7. **Fühler:** zwei quadratische Kurven aus der Spitze (y = 38) nach außen oben, Kugel r = 5,5 am Ende bei y ≈ 16.
8. **Arme, Füße, Stachel:** Arme sind Kurven mit Strich 5 aus dem Körper heraus und Kugel r = 5,5 als Hand. Füße sind Tintenovale 22 × 12 auf y = 180, halb unter dem Bauch. Der Stachel ist ein Tintendreieck hinten unten.

Erst Fühler, Flügel, Stachel, Füße und Arme hinter dem Körper, dann der Tropfen, die Streifen, der Glanz, das Gesicht, Arme vor dem Körper, Requisiten.

## Proportionen

| Maß | Wert | Regel |
| --- | --- | --- |
| Tropfen Breite : Höhe | 104 : 144 ≈ 5 : 7 | die Spitze ist nie stumpfer, der Bauch nie flacher |
| Spitze zu Bauch | Spitze 92 über der Kreismitte, Radius 52 | Verhältnis 1,77 bleibt fest |
| Körper zur Gesamthöhe | 144 von 178 | der Tropfen ist vier Fünftel der Figur |
| Auge | Tintenoval 15 × 21, Glanzpunkt r 2,8 | Augenabstand 32 von Mitte zu Mitte |
| Streifen | 12 und 11 hoch, zwei Stück | beginnen unter dem Mund, nie über den Augen |
| Flügel | Tropfen 30 breit, 51 lang | ragen höchstens 40 px über den Körperrand |
| Striche | Arme 5, Fühler 4,5, Kugeln r 5,5 | Mund 4 |
| Kontur | keine in Farbe, 4 in den einfarbigen Fassungen | Flügel haben in Farbe einen weißen Rand 3 |

## Feste Merkmale

Diese Merkmale ändern sich in keiner Pose, keinem Format und keiner Anzeige:

- Der Körper ist ein Honigtropfen: Spitze oben, runder Bauch, eine glatte Fläche ohne Kontur.
- Die Fühler wachsen aus der Spitze, zwei Tintenstriche mit Kugelende.
- Der weiße Glanzfleck oben links, mit einem Glanzpunkt darunter.
- Perlaugen: Tintenovale mit weißem Glanzpunkt oben rechts, kein Augenweiß.
- Genau zwei Ringstreifen, vorne wie hinten.
- Zwei Flügel als kleine lila Tropfen mit weißem Rand.
- Arme als Tintenstriche mit Kugelhand, Füße als Tintenovale, ein kleiner Stachel.
- Weiße Kante: Fühler, Arme, Füße und Stachel liegen auf einer weißen Unterlage, 5 breiter als der Tintenstrich (2,5 je Seite). Von hinten bekommen die Flügel eine weiße Kante 8 (statt 3), damit sie sich vom Bauch abheben. Der Körper selbst bleibt ohne Kontur.

## Farb-Tokens

Alle Farben kommen aus `option-3-hummel/tokens.json`. Die Figur nutzt in hellem und dunklem Modus dieselben Werte, nur der Grund wechselt.

| Rolle | Token | Wert |
| --- | --- | --- |
| Körper | `color.light.honey` | #ffc72c |
| Streifen, Augen, Mund, Fühler, Arme, Füße, Stachel | `color.light.ink` | #1c1a17 |
| Glanz, Glanzpunkte, Flügelrand, weiße Kante unter Fühlern, Armen, Füßen und Stachel (Tinte + 5) | `color.light.surface-raised` | #ffffff |
| Flügel | `color.light.accent-soft` | #e5dcff |
| Zunge | `color.light.error` | #c0262d |
| Schallbögen, Winkspuren, Tröpfchen | `color.light.accent` | #5a3fae |
| Tröpfchen | `color.light.success`, `color.light.brand` | #23793a, #8a5800 |

Einfarbig gibt es zwei Fassungen: Tinte (#1c1a17) auf Weiß, und ausgespart (Weiß auf Tinte). Dort bekommen Tropfen und Flügel eine Kontur 4, und der Glanz wird zu einem Strich 3,5 mit Punkt. Andere Farben, Verläufe und Transparenz an der Figur sind nicht erlaubt.

## Ausdrücke

| Ausdruck | Augen | Mund | Arme | Requisite |
| --- | --- | --- | --- | --- |
| Neutral | offene Perlaugen, Blick leicht nach rechts | kleiner Bogen | hängen an den Flanken | keine |
| Freut sich | geschlossen als Bögen nach oben | offen, Zunge in Fehlerrot | beide hoch | Tröpfchen in Akzent, Grün, Braun |
| Hört zu (Sprache, Alexa, Siri) | offen, Blick nach oben rechts | kleines rundes O | vordere Hand am Ohr | zwei violette Schallbögen um die Hand |
| Winkt | offen | breiterer Bogen | der vordere Arm hoch | zwei violette Winkspuren |

Ausdrücke ändern nur Augen, Mund, Arme und kleine Requisiten. Tropfen, Streifen, Glanz, Fühler und Flügel bleiben in jedem Ausdruck gleich. Augenbrauen, Nase und Zähne gibt es nicht.

## Posen-Regeln

- Standardansicht ist das Dreiviertel nach rechts. Sie zeigt beide Augen, den Stachel und beide Flügel hinten links.
- Der Tropfen ist von allen Seiten gleich, die Ansicht erkennt man am Gesicht, an den Flügeln und am Stachel. Von hinten liegen die Flügel vor dem Körper.
- Der Körper bleibt starr: Er neigt sich um höchstens 10°, aber die Spitze biegt sich nie.
- Der Glanz bleibt oben links, auch wenn sich die Figur dreht.
- Arme sind dünne Striche. Sie dürfen biegen und winken, aber nie über die Fühlerkugeln reichen.
- Requisiten (Schallbögen, Tröpfchen) berühren den Körper nicht.
- Kleiner als 48 px wird statt der Figur das Icon gezeigt.

## Do und Don’t

- **Do:** die Silhouette als eine Fläche lesen lassen, nichts ragt in den Tropfen hinein.
- **Do:** Ausdruck über Augen und Arme spielen, der Körper bleibt ruhig.
- **Do:** Tröpfchen in Tropfenform als Konfetti verwenden.
- **Do:** auf dunklem Grund trägt die Figur ihre weiße Kante, sonst verschwinden Fühler, Arme, Füße und Stachel.
- **Don’t:** Kontur um den farbigen Körper, Schatten oder Verläufe.
- **Don’t:** den Glanz weglassen oder auf die rechte Seite legen.
- **Don’t:** weiße Augen mit Pupille, die gehören zu anderen Richtungen.
- **Don’t:** den Tropfen strecken, stauchen oder die Spitze kappen.
- **Don’t:** Text in die Figur schreiben oder sie als Sprechblase benutzen.

## Referenzblatt und Prompt

Das Referenzblatt (`sheet.png` in diesem Ordner, oben auf der Seite eingebettet) zeigt die Rundum-Ansicht, die vier Ausdrücke, die Farben, das Icon in vier Größen und die einfarbigen Fassungen. Es ist die Bildvorlage für Illustrator:innen und für Bildgeneratoren (als Referenzbild hochladen, dazu der folgende Block). Der Prompt ist auf Englisch, weil die gängigen Bildmodelle damit am zuverlässigsten arbeiten.

```text
Hummlist mascot "Honey drop bee", flat 2D vector illustration.
Character: a cute bumblebee whose whole body is one single honey drop: pointed tip at the top, round belly at the bottom (width:height 5:7), no neck, no separate head.
Colors only: honey yellow #ffc72c body, ink #1c1a17 for stripes, eyes, mouth, antennae, arms and feet, pure white #ffffff for the gloss, pale lavender #e5dcff wings with a thin white edge. Every ink part that sticks out of the body (antennae, arms, feet, stinger) sits on a thin white #ffffff edge about 2-3 px wide on each side, so the figure reads on dark backgrounds too; in the back view the wings get a wider white rim where they lie on the body. Accent violet #5a3fae only for small effect marks, red #c0262d only for the tongue.
Fixed features: two antennae growing out of the drop's tip as thin ink lines with round ball ends; a flat white bean-shaped gloss highlight on the upper left of the body plus one small white dot below it, always upper left; two glossy ink bead eyes (tall black ovals with a small white highlight, no eye whites); a small curved ink smile; exactly two curved ink ring stripes across the lower belly; two small lavender drop-shaped wings with their tips tucked behind the upper back; thin ink line arms ending in round ball hands; two small ink oval feet half under the belly; a tiny ink stinger at the back.
Style: no outline around the colored body (only the thin white edge under the ink lines), smooth single silhouette, flat fills only, glossy look made only by the flat white highlight shape, no gradients, no shading, no texture, no text.
Default view: three-quarter view facing right, standing, full body, centered on a plain background.
Keep proportions and features identical to the reference sheet; change only eyes, mouth, arms and small props for the expression.
```
