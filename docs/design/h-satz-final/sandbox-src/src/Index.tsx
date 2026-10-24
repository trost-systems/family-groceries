import { prototypes } from './registry'
import { useI18n } from './shared/i18n'
import { LangToggle } from './shared/ui/bits'
import './index-page.css'

const COPY = {
  title: { de: 'Familieneinkauf: Entwürfe', en: 'Family Groceries: design directions' },
  lede: {
    de: 'Runde 3 macht Peters Favoriten E fertig: Artikel stehen in der Reihenfolge, in der du durch den Laden läufst, Läden und Kategorien sind leise Trenner ohne Kleben, Bearbeiten hat eigene Felder, und das Blatt ist nur so groß wie nötig.',
    en: 'Round 3 finishes Peter’s favourite, E: items stand in the order you walk the store, stores and categories are quiet dividers that do not stick, edit has its own fields, and the sheet is only as tall as it needs to be.',
  },
  round2Lede: {
    de: 'Runde 2 baut auf „Satz“ auf, mit Kategorien direkt im Fluss der Liste, zuklappbaren Läden, Eingabe unten und einem Hinzufügen-Blatt, in dem jeder Vorschlag antippbar ist. Gesten wie gehabt: Tippen hakt ab, Halten und Loslassen bearbeitet, Halten und Ziehen verschiebt, Rechtsklick bearbeitet.',
    en: 'Round 2 builds on “Sentence”, with categories inline in the list, collapsible stores, the input at the bottom and an add sheet where every suggestion is tappable. Same gestures: tap checks off, hold and release edits, hold and drag moves, right-click edits.',
  },
  round1Lede: {
    de: 'Die vier Richtungen aus Runde 1, unverändert als Referenz.',
    en: 'The four round-1 directions, kept unchanged for reference.',
  },
  open: { de: 'Öffnen', en: 'Open' },
}

export function Index() {
  const { l, t } = useI18n()
  const rounds = [
    { round: 3, title: t('round3'), lede: null },
    { round: 2, title: t('round2'), lede: l(COPY.round2Lede) },
    { round: 1, title: t('round1'), lede: l(COPY.round1Lede) },
  ] as const
  return (
    <main className="ix-root" data-testid="index-page">
      <header className="ix-head">
        <h1>{l(COPY.title)}</h1>
        <LangToggle />
      </header>
      <p className="ix-lede">{l(COPY.lede)}</p>
      {rounds.map((r) => (
        <section key={r.round} className="ix-round" data-testid={`index-round-${r.round}`}>
          <h2 className="ix-round-title">{r.title}</h2>
          {r.lede && <p className="ix-lede">{r.lede}</p>}
          <ol className="ix-list">
            {prototypes
              .filter((p) => p.round === r.round)
              .map((p) => (
                <li key={p.name}>
                  <a className="ix-card" href={`#/${p.name}`} data-testid={`index-link-${p.name}`}>
                    <span className="ix-letter">{p.meta.letter}</span>
                    <span className="ix-text">
                      <strong>{l(p.meta.title)}</strong>
                      <span>{l(p.meta.rationale)}</span>
                    </span>
                    <span className="ix-open">{l(COPY.open)} →</span>
                  </a>
                </li>
              ))}
          </ol>
        </section>
      ))}
    </main>
  )
}
