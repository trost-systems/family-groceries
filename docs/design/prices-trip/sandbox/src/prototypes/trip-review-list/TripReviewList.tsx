import { useState } from 'react'
import { BasisChoice, DraftMeaning, QtyControl, usePriceDraft } from '../../shared/draft'
import { euro, type Item, lineTotal, tripTotal } from '../../shared/pricing'
import { byCategory, STORE, type TripState } from '../../shared/trip'
import { AppBar, Category, HexField, Icon, ItemName, StoreHeader, useBump } from '../../shared/ui'

type Mode = { at: 'list' } | { at: 'review'; index: number } | { at: 'summary' }

/** 3 · Shop first, then go through the same items once at the till, one price at a time. */
export function TripReviewList({ trip }: { trip: TripState }) {
  const [mode, setMode] = useState<Mode>({ at: 'list' })
  const next = (index: number) => setMode(index + 1 < trip.items.length ? { at: 'review', index: index + 1 } : { at: 'summary' })
  if (mode.at === 'review') {
    const item = trip.items[mode.index]
    if (!item) return null
    return <Review key={item.id} item={item} index={mode.index} trip={trip} next={() => next(mode.index)} jump={(i) => setMode({ at: 'review', index: i })} back={() => setMode({ at: 'list' })} />
  }
  if (mode.at === 'summary') return <Summary trip={trip} edit={(i) => setMode({ at: 'review', index: i })} done={() => setMode({ at: 'list' })} />
  return (
    <>
      <div className="screen">
        <AppBar />
        <StoreHeader count={trip.items.length} />
        {byCategory(trip.items).map(([cat, items]) => (
          <section key={cat}>
            <Category name={cat} />
            {items.map((i) => (
              <div className="row" key={i.id} data-item={i.id}>
                <span className="emo">{i.emoji}</span>
                <ItemName item={i} />
                {lineTotal(i) !== null && <span className="price muted">{euro(lineTotal(i) ?? 0)}</span>}
              </div>
            ))}
          </section>
        ))}
        <div style={{ height: 24 }} />
      </div>
      <div className="total" style={{ justifyContent: 'center' }}>
        <button className="hx hx--l hx--honey hx--edge" type="button" onClick={() => setMode({ at: 'review', index: 0 })}>
          <Icon name="receipt_long_outlined" />
          An der Kasse: Preise eintragen
        </button>
      </div>
    </>
  )
}

function Review({ item, index, trip, next, jump, back }: { item: Item; index: number; trip: TripState; next: () => void; jump: (i: number) => void; back: () => void }) {
  const draft = usePriceDraft(item)
  const sum = tripTotal(trip.items)
  const bump = useBump(sum.total)
  const save = () => draft.save(trip) && next()
  return (
    <div className="screen" onKeyDown={(e) => e.key === 'Escape' && back()}>
      <div className="appbar">
        <button className="hx hx--s" type="button" onClick={back} aria-label="Zurück zur Liste">
          <Icon name="arrow_back" />
        </button>
        <span className="muted num" data-testid="step">
          {index + 1} von {trip.items.length}
        </span>
      </div>
      <div style={{ padding: '0 16px' }}>
        <div className="review-sum" data-testid="trip-total">
          <span>Bisher bei {STORE}</span>
          <b key={bump} className={`num ${bump ? 'bump' : ''}`}>{euro(sum.total)}</b>
        </div>
        <Progress items={trip.items} index={index} jump={jump} />
        <div className="stack review-card">
          <div className="between">
            <span className="emo" style={{ fontSize: 28, width: 32 }}>{item.emoji}</span>
            <ItemName item={{ ...item, qty: draft.preview?.qty ?? item.qty }} />
          </div>
          {item.sold.kind !== 'weight' && (
            <div className="between">
              <span className="label">{item.sold.kind === 'pack' ? 'Packungen' : 'Menge'}</span>
              <QtyControl draft={draft} />
            </div>
          )}
          {item.sold.kind === 'weight' && (
            <HexField name="weight" label="Gewicht" value={draft.weightText} onChange={draft.setWeightText} onEnter={save} error={draft.weightError} suffix="kg" />
          )}
          <HexField name="price" label="Preis" value={draft.text} onChange={draft.setText} onEnter={save} error={draft.priceError} suffix="€" autoFocus hint={<DraftMeaning draft={draft} />} />
          <BasisChoice draft={draft} />
          <div className="actions">
            <button className="hx" type="button" onClick={next}>
              Überspringen
            </button>
            <button className="hx hx--l hx--honey hx--edge" type="button" onClick={save}>
              Weiter
              <Icon name="chevron_right" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Progress({ items, index, jump }: { items: readonly Item[]; index: number; jump: (i: number) => void }) {
  return (
    <div className="progress" role="list" aria-label="Artikel">
      {items.map((i, n) => (
        <button
          key={i.id}
          type="button"
          role="listitem"
          aria-label={`${i.name}${i.price ? ', mit Preis' : ''}`}
          aria-current={n === index}
          className={`hxp ${i.price ? 'hxp--mint' : n === index ? 'hxp--honey' : 'hxp--muted'}`}
          style={{ ['--s' as string]: '26px' }}
          onClick={() => jump(n)}
        >
          {i.price && <Icon name="check" />}
        </button>
      ))}
    </div>
  )
}

function Summary({ trip, edit, done }: { trip: TripState; edit: (i: number) => void; done: () => void }) {
  const sum = tripTotal(trip.items)
  const firstOpen = trip.items.findIndex((i) => !i.price)
  return (
    <div className="screen">
      <div className="appbar">
        <span className="screen-title">Einkauf bei {STORE}</span>
      </div>
      <div style={{ padding: '0 16px' }}>
        <div className="review-sum review-sum--end" data-testid="trip-total">
          <span>Summe</span>
          <b className="num">{euro(sum.total)}</b>
        </div>
        {sum.open > 0 && (
          <div className="between" style={{ margin: '8px 0 4px' }}>
            <span className="muted">{sum.open === 1 ? '1 Artikel ohne Preis' : `${sum.open} Artikel ohne Preis`}</span>
            <button className="hx hx--s" type="button" onClick={() => edit(firstOpen)}>
              Nachtragen
            </button>
          </div>
        )}
      </div>
      {trip.items.map((i, n) => (
        <button key={i.id} className="row" type="button" data-item={i.id} onClick={() => edit(n)} aria-label={`${i.name} ändern`}>
          <span className="emo">{i.emoji}</span>
          <ItemName item={i} />
          {i.price ? <span className="price">{euro(lineTotal(i) ?? 0)}</span> : <span className="muted">kein Preis</span>}
          <Icon name="edit_outlined" />
        </button>
      ))}
      <div className="actions" style={{ padding: 16 }}>
        <button className="hx hx--l hx--honey hx--edge" type="button" onClick={done}>
          <Icon name="check" />
          Fertig
        </button>
      </div>
    </div>
  )
}
