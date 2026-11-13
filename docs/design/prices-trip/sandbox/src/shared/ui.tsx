import { type ReactNode, useEffect, useRef, useState } from 'react'
import { type IconName, icons } from '../generated/icons'
import { euro, type Item, MAX_QTY, qtyText, type Trip, tripTotal } from './pricing'
import { STORE } from './trip'

export function Icon({ name, label }: { name: IconName; label?: string }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d={icons[name]} />
    </svg>
  )
}

export function AppBar({ right }: { right?: ReactNode }) {
  return (
    <header className="appbar">
      <span className="hx">
        Zuhause <Icon name="expand_more" />
      </span>
      {right}
    </header>
  )
}

export function StoreHeader({ count }: { count: number }) {
  return (
    <div className="store">
      <span className="hx hx--s">{STORE}</span>
      <span className="rule" />
      <span className="count">
        <b>{count}</b> Artikel
      </span>
    </div>
  )
}

export function Category({ name }: { name: string }) {
  return <div className="cat">{name}</div>
}

/** "2× Vollmilch 1 l" the way the list writes it: quantity in cobalt before the name. */
export function ItemName({ item, sub }: { item: Item; sub?: ReactNode }) {
  const pack = item.sold.kind === 'pack' ? ` ${item.sold.perPack}er` : ''
  return (
    <span className="name">
      <span className="qty">
        {qtyText(item)}
        {pack}
      </span>{' '}
      {item.name}
      {sub && <small>{sub}</small>}
    </span>
  )
}

export function Stepper({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <span className="stepper" role="group" aria-label={label}>
      <button className="hx hx--s" type="button" aria-label="Weniger" disabled={value <= 1} onClick={() => onChange(value - 1)}>
        <Icon name="remove" />
      </button>
      <output aria-live="polite">{value}</output>
      <button className="hx hx--s" type="button" aria-label="Mehr" disabled={value >= MAX_QTY} onClick={() => onChange(value + 1)}>
        <Icon name="add" />
      </button>
    </span>
  )
}

export function ErrorText({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <div className="err" role="alert" id={id}>
      <Icon name="error_outline" />
      {children}
    </div>
  )
}

/** A labelled hex field. The label sits above and the error below, never inside the hex. */
export function HexField({
  label,
  value,
  onChange,
  onEnter,
  error,
  suffix,
  autoFocus,
  hint,
  name,
}: {
  label: string
  value: string
  onChange: (s: string) => void
  onEnter?: () => void
  error?: string | null
  suffix?: string
  autoFocus?: boolean
  hint?: ReactNode
  name: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (autoFocus) ref.current?.select()
  }, [autoFocus])
  return (
    <label style={{ display: 'block' }}>
      <span className="label">{label}</span>
      <span className={`hx field ${error ? 'hx--error' : ''}`}>
        <input
          ref={ref}
          name={name}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          autoFocus={autoFocus}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        />
        {suffix && <span className="suffix">{suffix}</span>}
      </span>
      {error ? <ErrorText>{error}</ErrorText> : hint ? <div className="hint">{hint}</div> : null}
    </label>
  )
}

/** Re-runs the bump animation whenever `value` changes. */
export function useBump(value: unknown): string {
  const [n, setN] = useState(0)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setN((x) => x + 1)
  }, [value])
  return n === 0 ? '' : `bump-${n % 2}`
}

export function TotalBar({ trip, label = 'Einkaufssumme' }: { trip: Trip; label?: string }) {
  const bump = useBump(trip.total)
  return (
    <div className="total" data-testid="trip-total">
      <span className="meta">
        <b>{label}</b>
        {trip.open === 0 ? 'Alle Preise da' : `${trip.priced} mit Preis · ${trip.open} offen`}
      </span>
      <span key={bump} className={`sum ${bump ? 'bump' : ''}`}>
        {euro(trip.total)}
      </span>
    </div>
  )
}

export function TotalChip({ items }: { items: readonly Item[] }) {
  const trip = tripTotal(items)
  const bump = useBump(trip.total)
  return (
    <span key={bump} className={`hx hx--honey hx--edge num ${bump ? 'bump' : ''}`} data-testid="trip-total" aria-label={`Einkaufssumme ${euro(trip.total)}`}>
      <Icon name="shopping_cart_outlined" />
      {euro(trip.total)}
    </span>
  )
}
