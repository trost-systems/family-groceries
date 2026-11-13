import { useReducer } from 'react'
import { cents, clampQty, type Item, MAX_GRAMS, type PriceEntry, type Sold } from './pricing'

export const STORE = 'Lidl'

/** The same synthetic Lidl trip in all five approaches. Butter starts priced, for the edit scenario. */
export const scenario: readonly Item[] = [
  { id: 'milch', name: 'Vollmilch 1\u00a0l', emoji: '🥛', category: 'Kühlregal', sold: { kind: 'piece' }, qty: 2, price: null, lastUnit: cents(119) },
  { id: 'butter', name: 'Butter', emoji: '🧈', category: 'Kühlregal', sold: { kind: 'piece' }, qty: 1, price: { basis: 'unit', amount: cents(229) }, lastUnit: cents(219) },
  { id: 'joghurt', name: 'Joghurt', emoji: '🥣', category: 'Kühlregal', sold: { kind: 'pack', perPack: 4, packUnit: 'Becher' }, qty: 1, price: null, lastUnit: cents(179) },
  { id: 'bananen', name: 'Bananen', emoji: '🍌', category: 'Obst & Gemüse', sold: { kind: 'weight' }, qty: 846, price: null, lastUnit: cents(199) },
  { id: 'aepfel', name: 'Äpfel Braeburn', emoji: '🍎', category: 'Obst & Gemüse', sold: { kind: 'weight' }, qty: 1240, price: null, lastUnit: cents(249) },
  { id: 'wasser', name: 'Mineralwasser', emoji: '💧', category: 'Getränke', sold: { kind: 'pack', perPack: 6, packUnit: 'Flaschen' }, qty: 2, price: null, lastUnit: cents(294) },
  { id: 'brot', name: 'Vollkornbrot', emoji: '🍞', category: 'Backwaren', sold: { kind: 'piece' }, qty: 1, price: null, lastUnit: cents(279) },
]

export type TripAction =
  | { type: 'price'; id: string; price: PriceEntry | null }
  | { type: 'qty'; id: string; qty: number }
  | { type: 'sold'; id: string; sold: Sold }
  | { type: 'reset' }

function reduce(items: readonly Item[], action: TripAction): readonly Item[] {
  switch (action.type) {
    case 'reset':
      return scenario
    case 'price':
      return items.map((i) => (i.id === action.id ? { ...i, price: action.price } : i))
    case 'sold':
      return items.map((i) =>
        i.id !== action.id || i.sold.kind === action.sold.kind
          ? i
          : { ...i, sold: action.sold, qty: action.sold.kind === 'weight' ? 1000 : 1, price: null },
      )
    case 'qty':
      return items.map((i) =>
        i.id !== action.id
          ? i
          : { ...i, qty: i.sold.kind === 'weight' ? Math.min(MAX_GRAMS, Math.max(1, Math.round(action.qty))) : clampQty(action.qty) },
      )
  }
}

export function useTrip() {
  const [items, dispatch] = useReducer(reduce, scenario)
  return {
    items,
    setPrice: (id: string, price: PriceEntry | null) => dispatch({ type: 'price', id, price }),
    setQty: (id: string, qty: number) => dispatch({ type: 'qty', id, qty }),
    setSold: (id: string, sold: Sold) => dispatch({ type: 'sold', id, sold }),
    reset: () => dispatch({ type: 'reset' }),
  }
}

export type TripState = ReturnType<typeof useTrip>

export function byCategory(items: readonly Item[]): [string, Item[]][] {
  const groups = new Map<string, Item[]>()
  for (const item of items) groups.set(item.category, [...(groups.get(item.category) ?? []), item])
  return [...groups]
}
