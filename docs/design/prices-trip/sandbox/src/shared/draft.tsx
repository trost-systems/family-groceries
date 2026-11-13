import { useState } from 'react'
import {
  amountText,
  euro,
  type Item,
  lineTotal,
  parsePrice,
  parseWeight,
  perLabel,
  perPiece,
  type PriceEntry,
  type Sold,
  priceErrorText,
  unitPrice,
  weightErrorText,
  weightField,
} from './pricing'
import type { TripState } from './trip'
import { Icon, Stepper } from './ui'

/**
 * What an open price editor holds before it is saved: the typed text, what it is per, and the
 * quantity. Errors show only after a save attempt and clear as soon as the text changes.
 */
export function usePriceDraft(original: Item, initialText?: string) {
  const [sold, setSoldRaw] = useState<Sold>(original.sold)
  const item: Item = sold === original.sold ? original : { ...original, sold, qty: sold.kind === 'weight' ? 1000 : 1, price: null }
  const [basis, setBasis] = useState<PriceEntry['basis']>(item.price?.basis ?? 'unit')
  const [text, setTextRaw] = useState(initialText ?? (item.price ? amountText(item.price.amount) : ''))
  const [qty, setQty] = useState(item.qty)
  const [weightText, setWeightTextRaw] = useState(weightField(item.qty))
  const setSold = (next: Sold) => {
    setSoldRaw(next.kind === original.sold.kind ? original.sold : next)
    setQty(next.kind === original.sold.kind ? original.qty : 1)
    setWeightTextRaw(weightField(next.kind === original.sold.kind ? original.qty : 1000))
  }
  const [tried, setTried] = useState(false)

  const price = parsePrice(text)
  const weight = item.sold.kind === 'weight' ? parseWeight(weightText) : null
  const nextQty = weight ? (weight.ok ? weight.value : item.qty) : qty
  const priceError = tried && !price.ok ? priceErrorText[price.error] : null
  const weightError = tried && weight && !weight.ok ? weightErrorText[weight.error] : null
  const preview = price.ok ? { ...item, qty: nextQty, price: { basis, amount: price.value } } : null

  return {
    item,
    sold,
    setSold,
    basis,
    setBasis,
    text,
    setText: (s: string) => {
      setTextRaw(s)
      setTried(false)
    },
    qty,
    setQty,
    weightText,
    setWeightText: (s: string) => {
      setWeightTextRaw(s)
      setTried(false)
    },
    priceError,
    weightError,
    preview,
    /** Saves into the trip and reports whether it could. */
    save(trip: TripState): boolean {
      setTried(true)
      if (!price.ok || (weight && !weight.ok)) return false
      if (sold !== original.sold) trip.setSold(item.id, sold)
      trip.setQty(item.id, nextQty)
      trip.setPrice(item.id, { basis, amount: price.value })
      return true
    },
  }
}

export type Draft = ReturnType<typeof usePriceDraft>

export function BasisChoice({ draft }: { draft: Draft }) {
  const options: [PriceEntry['basis'], string][] = [
    ['unit', perLabel(draft.item.sold)],
    ['line', draft.item.sold.kind === 'weight' ? 'vom Etikett' : 'gesamt'],
  ]
  return (
    <div className="seg" role="radiogroup" aria-label="Preis gilt">
      {options.map(([b, label]) => (
        <button
          key={b}
          type="button"
          role="radio"
          aria-checked={draft.basis === b}
          className={`hx hx--s ${draft.basis === b ? 'hx--cobalt' : ''}`}
          onClick={() => draft.setBasis(b)}
        >
          {draft.basis === b && <Icon name="check" />}
          {label}
        </button>
      ))}
    </div>
  )
}

/** One line under the fields that says what the typed price means for this quantity. */
export function DraftMeaning({ draft }: { draft: Draft }) {
  const p = draft.preview
  if (!p) return null
  const line = lineTotal(p)
  const unit = unitPrice(p)
  const piece = perPiece(p)
  const sold = draft.item.sold
  const unitWord = sold.kind === 'weight' ? '/kg' : sold.kind === 'pack' ? '/Pack' : '/Stück'
  return (
    <div className="hint num" data-testid="draft-meaning">
      {draft.basis === 'unit' ? (
        <>
          Zusammen <b className="price">{euro(line ?? 0)}</b>
        </>
      ) : (
        <>
          Das sind <b className="price">{euro(unit ?? 0)}</b>
          {unitWord}
        </>
      )}
      {piece !== null && sold.kind === 'pack' && ` · ${euro(piece)} pro ${sold.packUnit.replace(/n$/, '')}`}
    </div>
  )
}

export function QtyControl({ draft }: { draft: Draft }) {
  if (draft.item.sold.kind === 'weight') return null
  return <Stepper label={draft.item.sold.kind === 'pack' ? 'Packungen' : 'Menge'} value={draft.qty} onChange={draft.setQty} />
}
