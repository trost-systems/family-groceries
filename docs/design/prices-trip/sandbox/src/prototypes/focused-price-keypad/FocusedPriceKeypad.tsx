import { useEffect, useState } from 'react'
import { BasisChoice, QtyControl, usePriceDraft } from '../../shared/draft'
import { euro, type Item, lineTotal, perPiece, tripTotal, unitPrice } from '../../shared/pricing'
import { byCategory, type TripState } from '../../shared/trip'
import { AppBar, Category, ErrorText, Icon, ItemName, StoreHeader, TotalChip } from '../../shared/ui'

/** 4 · Tap a row and a big amount keypad takes the lower half; the row, quantity and total stay above it. */
export function FocusedPriceKeypad({ trip }: { trip: TripState }) {
  const [open, setOpen] = useState<string | null>(null)
  const item = trip.items.find((i) => i.id === open)
  return (
    <>
      <AppBar right={<TotalChip items={trip.items} />} />
      <div className="screen" style={item ? { flex: 'none', height: 180 } : undefined}>
        <StoreHeader count={trip.items.length} />
        {byCategory(trip.items).map(([cat, items]) => (
          <section key={cat}>
            <Category name={cat} />
            {items.map((i) => (
              <button
                key={i.id}
                ref={(el) => {
                  if (el && i.id === open) el.scrollIntoView({ block: 'center' })
                }}
                className={`row ${i.id === open ? 'row--on' : ''}`}
                type="button"
                data-item={i.id}
                onClick={() => setOpen(i.id)}
                aria-label={`Preis für ${i.name}`}
              >
                <span className="emo">{i.emoji}</span>
                <ItemName item={i} />
                {lineTotal(i) === null ? <span className="muted">–</span> : <span className="price">{euro(lineTotal(i) ?? 0)}</span>}
              </button>
            ))}
          </section>
        ))}
        <div style={{ height: 24 }} />
      </div>
      {item && <Pad key={item.id} item={item} trip={trip} close={() => setOpen(null)} />}
    </>
  )
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'del'] as const

function Pad({ item, trip, close }: { item: Item; trip: TripState; close: () => void }) {
  const draft = usePriceDraft(item)
  const [target, setTarget] = useState<'price' | 'weight'>('price')
  const [fresh, setFresh] = useState(true)
  const value = target === 'price' ? draft.text : draft.weightText
  const setValue = target === 'price' ? draft.setText : draft.setWeightText
  const save = () => draft.save(trip) && close()

  const press = (k: (typeof KEYS)[number]) => {
    const base = fresh ? '' : value
    setFresh(false)
    if (k === 'del') return setValue(fresh ? '' : value.slice(0, -1))
    if (k === ',' && base.includes(',')) return
    const decimals = base.split(',')[1]
    if (decimals !== undefined && decimals.length >= (target === 'price' ? 2 : 3)) return
    setValue((base === '' && k === ',' ? '0' : base) + k)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'Enter') save()
      else if (e.key === 'Escape') close()
      else if (e.key === 'Backspace') press('del')
      else if (e.key === ',' || e.key === '.') press(',')
      else if (/^\d$/.test(e.key)) press(e.key as (typeof KEYS)[number])
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const p = draft.preview
  const others = trip.items.filter((i) => i.id !== item.id)
  const after = p ? tripTotal([...others, p]).total : null
  const piece = p ? perPiece(p) : null
  const error = target === 'weight' ? draft.weightError : draft.priceError

  return (
    <div className="pad" role="dialog" aria-label={`Preis für ${item.name}`}>
      <div className="between" style={{ flexWrap: 'nowrap' }}>
        <span className="emo">{item.emoji}</span>
        <ItemName item={{ ...item, qty: p?.qty ?? draft.qty }} />
        <button className="hx hx--s" type="button" aria-label="Schließen" onClick={close}>
          <Icon name="close" />
        </button>
      </div>
      <div className="between">
        <QtyControl draft={draft} />
        {item.sold.kind === 'weight' && (
          <button type="button" className={`hx hx--s ${target === 'weight' ? 'hx--cobalt' : ''}`} onClick={() => (setTarget(target === 'weight' ? 'price' : 'weight'), setFresh(true))}>
            <Icon name="scale_outlined" />
            {draft.weightText.replace('.', ',')} kg
          </button>
        )}
        <BasisChoice draft={draft} />
      </div>
      <div className={`amount ${fresh ? 'amount--fresh' : ''}`} data-testid="amount">
        <span className="num">{value === '' ? '0' : value}</span>
        <span className="unit">{target === 'weight' ? 'kg' : '€'}</span>
      </div>
      <div className="amount-meta num" aria-live="polite">
        {error ? (
          <ErrorText>{error}</ErrorText>
        ) : p ? (
          draft.basis === 'unit' ? (
            `= ${euro(lineTotal(p) ?? 0)}${piece !== null ? ` · ${euro(piece)} pro Stück im Pack` : ''}`
          ) : (
            `= ${euro(unitPrice(p) ?? 0)} ${item.sold.kind === 'weight' ? 'pro kg' : 'pro Stück'}`
          )
        ) : (
          ' '
        )}
      </div>
      <div className="keys">
        {KEYS.map((k) => (
          <button key={k} type="button" className="key" aria-label={k === 'del' ? 'Löschen' : k} onClick={() => press(k)}>
            {k === 'del' ? <Icon name="backspace_outlined" /> : k}
          </button>
        ))}
      </div>
      <button type="button" className="hx hx--l hx--honey hx--edge ok" onClick={save}>
        <Icon name="check" />
        {after !== null ? `OK · Summe ${euro(after)}` : 'OK'}
      </button>
    </div>
  )
}
