import { useState } from 'react'
import { BasisChoice, DraftMeaning, QtyControl, usePriceDraft } from '../../shared/draft'
import { euro, type Item, lineTotal, tripTotal } from '../../shared/pricing'
import { byCategory, type TripState } from '../../shared/trip'
import { AppBar, Category, HexField, Icon, ItemName, StoreHeader, TotalBar } from '../../shared/ui'

/** 1 · The price lives on the row. Tap it, type, Enter; the total in the footer moves at once. */
export function InlineRowPrice({ trip }: { trip: TripState }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <>
      <div className="screen">
        <AppBar />
        <StoreHeader count={trip.items.length} />
        {byCategory(trip.items).map(([cat, items]) => (
          <section key={cat}>
            <Category name={cat} />
            {items.map((item) =>
              open === item.id ? (
                <InlineEditor key={item.id} item={item} trip={trip} close={() => setOpen(null)} />
              ) : (
                <Row key={item.id} item={item} onPrice={() => setOpen(item.id)} />
              ),
            )}
          </section>
        ))}
        <div style={{ height: 24 }} />
      </div>
      <TotalBar trip={tripTotal(trip.items)} />
    </>
  )
}

function Row({ item, onPrice }: { item: Item; onPrice: () => void }) {
  const line = lineTotal(item)
  return (
    <div className="row" data-item={item.id}>
      <span className="emo">{item.emoji}</span>
      <ItemName item={item} />
      {line === null ? (
        <button className="hx hx--s hx--ghost" type="button" onClick={onPrice} aria-label={`Preis für ${item.name}`}>
          <Icon name="add" />
          Preis
        </button>
      ) : (
        <button className="hx hx--s num" type="button" onClick={onPrice} aria-label={`Preis für ${item.name}: ${euro(line)}, ändern`}>
          {euro(line)}
        </button>
      )}
    </div>
  )
}

function InlineEditor({ item, trip, close }: { item: Item; trip: TripState; close: () => void }) {
  const draft = usePriceDraft(item)
  const save = () => draft.save(trip) && close()
  return (
    <div
      className="row row--on"
      data-item={item.id}
      style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12, paddingBlock: 12 }}
      onKeyDown={(e) => e.key === 'Escape' && close()}
    >
      <div className="between">
        <span className="emo">{item.emoji}</span>
        <ItemName item={{ ...item, qty: draft.preview?.qty ?? item.qty }} />
        <QtyControl draft={draft} />
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <HexField name="price" label="Preis" value={draft.text} onChange={draft.setText} onEnter={save} error={draft.priceError} suffix="€" autoFocus hint={<DraftMeaning draft={draft} />} />
        </div>
        {item.sold.kind === 'weight' && (
          <div style={{ width: 120 }}>
            <HexField name="weight" label="Gewicht" value={draft.weightText} onChange={draft.setWeightText} onEnter={save} error={draft.weightError} suffix="kg" />
          </div>
        )}
      </div>
      <BasisChoice draft={draft} />
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
            Preis entfernen
          </button>
        )}
        <button type="button" className="hx hx--s" onClick={close}>
          Abbrechen
        </button>
        <button type="button" className="hx hx--s hx--honey hx--edge" onClick={save}>
          <Icon name="check" />
          Fertig
        </button>
      </div>
    </div>
  )
}
