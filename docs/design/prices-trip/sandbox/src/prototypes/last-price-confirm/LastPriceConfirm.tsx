import { useState } from 'react'
import { BasisChoice, DraftMeaning, QtyControl, usePriceDraft } from '../../shared/draft'
import { amountText, cents, euro, type Item, lineTotal, perLabel, tripTotal, unitPrice } from '../../shared/pricing'
import { byCategory, type TripState } from '../../shared/trip'
import { AppBar, Category, HexField, Icon, ItemName, StoreHeader, useBump } from '../../shared/ui'

/** The prefill: last time's unit price for the quantity on the list. Synthetic, never a store's price. */
const suggestion = (item: Item): Item => ({ ...item, price: { basis: 'unit', amount: item.lastUnit } })

/** 5 · Every row arrives with last time's price. Tap the hex to accept it, or the price to change it. */
export function LastPriceConfirm({ trip }: { trip: TripState }) {
  const [open, setOpen] = useState<string | null>(null)
  const open_ = trip.items.filter((i) => !i.price)
  return (
    <>
      <div className="screen">
        <AppBar
          right={
            open_.length > 0 && (
              <button className="hx hx--s" type="button" onClick={() => open_.forEach((i) => trip.setPrice(i.id, { basis: 'unit', amount: i.lastUnit }))}>
                <Icon name="done_all" />
                Alle übernehmen
              </button>
            )
          }
        />
        <StoreHeader count={trip.items.length} />
        {byCategory(trip.items).map(([cat, items]) => (
          <section key={cat}>
            <Category name={cat} />
            {items.map((item) =>
              open === item.id ? (
                <Editor key={item.id} item={item} trip={trip} close={() => setOpen(null)} />
              ) : (
                <Row key={item.id} item={item} trip={trip} edit={() => setOpen(item.id)} />
              ),
            )}
          </section>
        ))}
        <div style={{ height: 24 }} />
      </div>
      <Footer items={trip.items} />
    </>
  )
}

function Row({ item, trip, edit }: { item: Item; trip: TripState; edit: () => void }) {
  const confirmed = item.price !== null
  const shown = confirmed ? item : suggestion(item)
  const line = lineTotal(shown) ?? 0
  const changed = confirmed && item.price?.basis === 'unit' && item.price.amount !== item.lastUnit
  return (
    <div className="row" data-item={item.id}>
      <button
        type="button"
        className={`hxp ${confirmed ? 'hxp--accent' : 'hxp--muted'}`}
        aria-label={confirmed ? `${item.name}: Preis zurücknehmen` : `${item.name}: ${euro(line)} übernehmen`}
        aria-pressed={confirmed}
        onClick={() => trip.setPrice(item.id, confirmed ? null : { basis: 'unit', amount: item.lastUnit })}
      >
        {confirmed && <Icon name="euro" />}
      </button>
      <ItemName
        item={item}
        sub={
          confirmed ? (
            changed ? (
              <>
                <Icon name="history" /> zuletzt {euro(item.lastUnit)}
              </>
            ) : undefined
          ) : (
            <>
              <Icon name="history" /> zuletzt {euro(item.lastUnit)} {perLabel(item.sold)}
            </>
          )
        }
      />
      <button
        type="button"
        className={`hx hx--s num ${confirmed ? '' : 'hx--ghost suggest'}`}
        onClick={edit}
        aria-label={`Preis für ${item.name} ändern`}
      >
        {euro(line)}
      </button>
    </div>
  )
}

function Editor({ item, trip, close }: { item: Item; trip: TripState; close: () => void }) {
  const draft = usePriceDraft(item, item.price ? undefined : amountText(item.lastUnit))
  const save = () => draft.save(trip) && close()
  const now = draft.preview ? unitPrice(draft.preview) : null
  const delta = now === null ? 0 : now - item.lastUnit
  return (
    <div className="row row--on" data-item={item.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12, paddingBlock: 12 }} onKeyDown={(e) => e.key === 'Escape' && close()}>
      <div className="between">
        <span className="emo">{item.emoji}</span>
        <ItemName item={{ ...item, qty: draft.preview?.qty ?? item.qty }} sub={`zuletzt ${euro(item.lastUnit)} ${perLabel(item.sold)}`} />
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
      {delta !== 0 && (
        <div className="hint num" data-testid="delta">
          <Icon name="history" /> {euro(Math.abs(delta))} {delta > 0 ? 'teurer' : 'günstiger'} als zuletzt ({euro(item.lastUnit)} {perLabel(item.sold)})
        </div>
      )}
      <div className="actions">
        <button type="button" className="hx hx--s" onClick={close}>
          Abbrechen
        </button>
        <button type="button" className="hx hx--s hx--honey hx--edge" onClick={save}>
          <Icon name="check" />
          Übernehmen
        </button>
      </div>
    </div>
  )
}

function Footer({ items }: { items: readonly Item[] }) {
  const sure = tripTotal(items)
  const withSuggestions = cents(sure.total + items.filter((i) => !i.price).reduce((s, i) => s + (lineTotal(suggestion(i)) ?? 0), 0))
  const bump = useBump(sure.total)
  return (
    <div className="total" data-testid="trip-total">
      <span className="meta">
        <b>Bestätigt</b>
        {sure.open === 0 ? 'Alle Preise bestätigt' : `mit Vorschlägen ≈ ${euro(withSuggestions)}`}
      </span>
      <span key={bump} className={`sum ${bump ? 'bump' : ''}`}>
        {euro(sure.total)}
      </span>
    </div>
  )
}
