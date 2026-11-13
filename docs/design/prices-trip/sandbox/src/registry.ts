import type { ComponentType } from 'react'
import { FocusedPriceKeypad } from './prototypes/focused-price-keypad/FocusedPriceKeypad'
import { InlineRowPrice } from './prototypes/inline-row-price/InlineRowPrice'
import { ItemSheetPrice } from './prototypes/item-sheet-price/ItemSheetPrice'
import { LastPriceConfirm } from './prototypes/last-price-confirm/LastPriceConfirm'
import { TripReviewList } from './prototypes/trip-review-list/TripReviewList'
import type { TripState } from './shared/trip'

export type Approach = {
  slug: string
  n: number
  title: string
  idea: string
  good: string[]
  bad: string[]
  Component: ComponentType<{ trip: TripState }>
}

export const approaches: Approach[] = [
  {
    slug: 'inline-row-price',
    n: 1,
    title: 'Preis in der Zeile',
    idea: 'Auf „+ Preis“ in der Zeile tippen, tippen, Enter. Die Summe steht immer unten.',
    good: ['Kein Wechsel weg von der Liste; ein Artikel = ein Tipp + Zahl + Enter.', 'Summe dauerhaft sichtbar, bewegt sich sofort.', 'Passt zum Abhaken im Laden: Preis da, wo der Artikel ist.'],
    bad: ['Die aufgeklappte Zeile schiebt die Liste; mit Tastatur bleibt wenig Platz.', 'Einheit (Stück/kg) nur als Preisbasis, nicht umstellbar.'],
    Component: InlineRowPrice,
  },
  {
    slug: 'item-sheet-price',
    n: 2,
    title: 'Artikel-Sheet',
    idea: 'Zeile antippen, ein Sheet fragt Menge, Einheit und Preis zusammen. Die Summe ändert sich erst mit „Übernehmen“.',
    good: ['Platz für alles: Einheit umstellen, Menge, Preis, Bedeutung, „Summe danach“.', 'Bekanntes Muster: wie das Bearbeiten-Sheet heute.'],
    bad: ['Ein Schritt mehr pro Artikel (öffnen, übernehmen).', 'Die Summe springt erst beim Übernehmen; die Liste ist dabei verdeckt.'],
    Component: ItemSheetPrice,
  },
  {
    slug: 'trip-review-list',
    n: 3,
    title: 'Kassen-Durchgang',
    idea: 'Erst einkaufen, dann an der Kasse (oder mit dem Bon) alle Artikel nacheinander durchgehen. Laufende Summe oben, Abschluss mit Übersicht.',
    good: ['Keine Preise während des Einkaufs nötig; ein Moment, ein Fokus.', 'Endsumme und Lücken („2 ohne Preis“) klar am Schluss.', 'Gut mit Kassenbon in der Hand.'],
    bad: ['Neuer Modus und neuer Einstieg; wer nur einen Preis will, muss durch die Folge.', 'Reihenfolge der Liste ≠ Reihenfolge auf dem Bon.'],
    Component: TripReviewList,
  },
  {
    slug: 'focused-price-keypad',
    n: 4,
    title: 'Großes Ziffernfeld',
    idea: 'Zeile antippen, unten öffnet ein großes Ziffernfeld. Artikel, Menge und Summe bleiben oben sichtbar.',
    good: ['Schnellste Eingabe mit einer Hand; große Tasten.', 'Ungültige Zeichen sind gar nicht tippbar; nur leer/zu groß bleiben als Fehler.', 'Summe im Knopf: „OK · Summe 12,34 €“.'],
    bad: ['Eigenes Ziffernfeld statt Systemtastatur: Screenreader, Hardware-Tastatur und Einfügen müssen wir selbst lösen.', 'Gewicht über einen Umschalter auf demselben Feld ist weniger offensichtlich.'],
    Component: FocusedPriceKeypad,
  },
  {
    slug: 'last-price-confirm',
    n: 5,
    title: 'Letzter Preis',
    idea: 'Jede Zeile bringt den letzten Preis mit (hier synthetisch). Sechseck antippen = übernehmen, Preis antippen = ändern. „Alle übernehmen“ oben.',
    good: ['Im Alltag fast kein Tippen: ein Tipp pro Artikel oder einer für alle.', 'Bestätigt und geschätzt sind getrennt: „Bestätigt“ groß, „mit Vorschlägen ≈ …“ klein darunter.'],
    bad: ['Braucht Preis-Historie; beim ersten Einkauf ist es Ansatz 1 ohne Vorschläge.', 'Gefahr, Vorschläge ungeprüft zu übernehmen; zwei Summen erklären sich nicht von selbst.'],
    Component: LastPriceConfirm,
  },
]

/** The shared scenario, in the same words for all five. */
export const steps: string[] = [
  'Preis eintragen: 2× Vollmilch, 1,19 € pro Stück → 2,38 €.',
  'Preis ändern: Butter steht auf 2,29 € → auf 2,49 € ändern.',
  'Fehler: leer speichern, „abc“, „1000“ (zu groß, max. 999,99 €), „0“.',
  'Menge ändern: Vollmilch auf 3 → Zeile und Summe ziehen nach.',
  'Lose Ware: Bananen 0,846 kg × 1,99 €/kg = 1,68 €, oder 1,68 € vom Waagen-Etikett.',
  'Multipack: Wasser 2× 6er-Pack zu 2,94 € = 5,88 € (0,49 € pro Flasche).',
  'Summe: läuft mit oder steht am Ende; offene Artikel werden gezählt.',
]
