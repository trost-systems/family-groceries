import { useState } from 'react'
import { BasisChoice, DraftMeaning, type Draft, QtyControl, usePriceDraft } from '../../shared/draft'
import { euro, type Item, lineTotal, type Sold, tripTotal, unitPrice } from '../../shared/pricing'
import { byCategory, scenario, type TripState } from '../../shared/trip'
import { AppBar, Category, HexField, Icon, ItemName, StoreHeader, TotalChip } from '../../shared/ui'

/** 2 · Tap a row, a sheet asks for price, quantity and unit together. The total moves on "Übernehmen". */
export function ItemSheetPrice({ trip }: { trip: TripState }) {
  const [open, setOpen] = useState<string | null>(null)
  const item = trip.items.find((i) => i.id === open)
  return (
    <>
      <div className="screen">
        <AppBar right={<TotalChip items={trip.items} />} />
        <StoreHeader count={trip.items.length} />
        {byCategory(trip.items).map(([cat, items]) => (
          <section key={cat}>
            <Category name={cat} />
            {items.map((i) => (
              <Row key={i.id} item={i} onOpen={() => setOpen(i.id)} />
            ))}
          </section>
        ))}
        <div style={{ height: 24 }} />
      </div>
      {item && <Sheet key={item.id} item={item} trip={trip} close={() => setOpen(null)} />}
    </>
  )
}

function Row({ item, onOpen }: { item: Item; onOpen: () => void }) {
  const line = lineTotal(item)
  const unit = unitPrice(item)
  return (
    <button className="row" type="button" data-item={item.id} onClick={onOpen} aria-label={`${item.name} bearbeiten`}>
      <span className="emo">{item.emoji}</span>
      <ItemName item={item} sub={unit !== null && item.qty !== 1 && item.sold.kind !== 'weight' ? `je ${euro(unit)}` : undefined} />
      {line === null ? <span className="muted">kein Preis</span> : <span className="price">{euro(line)}</span>}
      <Icon name="chevron_right" />
    </button>
  )
}

function soldOptions(item: Item): [Sold, string][] {
  const original = scenario.find((s) => s.id === item.id)?.sold ?? item.sold
  const pack: Sold = original.kind === 'pack' ? original : { kind: 'pack', perPack: 6, packUnit: 'Stück' }
  return [
    [{ kind: 'piece' }, 'Stück'],
    [pack, pack.kind === 'pack' ? `${pack.perPack}er-Pack` : 'Pack'],
    [{ kind: 'weight' }, 'kg'],
  ]
}

function Sheet({ item, trip, close }: { item: Item; trip: TripState; close: () => void }) {
  const draft = usePriceDraft(item)
  const save = () => draft.save(trip) && close()
  const others = trip.items.filter((i) => i.id !== item.id)
  const after = draft.preview ? tripTotal([...others, draft.preview]).total : null
  return (
    <div onKeyDown={(e) => e.key === 'Escape' && close()}>
      <div className="scrim" onClick={close} />
      <div className="sheet stack" role="dialog" aria-label={`Preis für ${item.name}`}>
        <div className="grab" />
        <div className="between">
          <h2>
            {item.emoji} {item.name}
          </h2>
          <button className="hx hx--s" type="button" aria-label="Schließen" onClick={close}>
            <Icon name="close" />
          </button>
        </div>
        <UnitChoice draft={draft} />
        {draft.sold.kind === 'weight' ? (
          <HexField name="weight" label="Gewicht" value={draft.weightText} onChange={draft.setWeightText} onEnter={save} error={draft.weightError} suffix="kg" />
        ) : (
          <div className="between">
            <span className="label">{draft.sold.kind === 'pack' ? 'Packungen' : 'Menge'}</span>
            <QtyControl draft={draft} />
          </div>
        )}
        <HexField name="price" label="Preis" value={draft.text} onChange={draft.setText} onEnter={save} error={draft.priceError} suffix="€" autoFocus hint={<DraftMeaning draft={draft} />} />
        <BasisChoice draft={draft} />
        <div className="between">
          <span className="hint num" data-testid="total-after">
            {after !== null ? (
              <>
                Summe danach <b className="price">{euro(after)}</b>
              </>
            ) : (
              <>Summe jetzt {euro(tripTotal(trip.items).total)}</>
            )}
          </span>
          <div className="actions">
            {item.price && (
              <button
                type="button"
                className="hx hx--s hx--ghost"
                onClick={() => {
                  trip.setPrice(item.id, null)
                  close()
                }}
              >
                Entfernen
              </button>
            )}
            <button type="button" className="hx hx--l hx--honey hx--edge" onClick={save}>
              Übernehmen
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function UnitChoice({ draft }: { draft: Draft }) {
  return (
    <div>
      <span className="label">Einheit</span>
      <div className="seg" role="radiogroup" aria-label="Einheit">
        {soldOptions(draft.item).map(([sold, label]) => (
          <button
            key={sold.kind}
            type="button"
            role="radio"
            aria-checked={draft.sold.kind === sold.kind}
            className={`hx hx--s ${draft.sold.kind === sold.kind ? 'hx--cobalt' : ''}`}
            onClick={() => draft.setSold(sold)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
