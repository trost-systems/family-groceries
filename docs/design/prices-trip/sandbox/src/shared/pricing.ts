export type Cents = number & { readonly __brand: 'Cents' }
export type Grams = number & { readonly __brand: 'Grams' }

export const cents = (n: number): Cents => Math.round(n) as Cents
export const grams = (n: number): Grams => Math.round(n) as Grams

/** How an item is sold, which decides what its unit price is per. */
export type Sold =
  | { kind: 'piece' }
  | { kind: 'pack'; perPack: number; packUnit: string }
  | { kind: 'weight' }

/**
 * The price the shopper typed. `unit` is per piece, per pack or per kg; `line` is the total on the
 * shelf label or scale sticker for the whole quantity. Both are kept as typed and the other is derived.
 */
export type PriceEntry = { basis: 'unit' | 'line'; amount: Cents }

export type Item = {
  id: string
  name: string
  emoji: string
  category: string
  sold: Sold
  /** Pieces or packs for piece and pack items, grams for weight items. */
  qty: number
  price: PriceEntry | null
  /** Synthetic "last time" unit price for the prefill approach. */
  lastUnit: Cents
}

export const MAX_CENTS = 99_999
export const MAX_QTY = 99
export const MAX_GRAMS = 20_000

export type PriceError = 'empty' | 'invalid' | 'zero' | 'tooLarge'
export type Parsed<T, E> = { ok: true; value: T } | { ok: false; error: E }

export function parsePrice(input: string): Parsed<Cents, PriceError> {
  const s = input.replace(/€/g, '').replace(/\s/g, '')
  if (s === '') return { ok: false, error: 'empty' }
  const m = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(s)
  if (!m) return { ok: false, error: 'invalid' }
  const value = Number(m[1]) * 100 + Number((m[2] ?? '0').padEnd(2, '0'))
  if (value === 0) return { ok: false, error: 'zero' }
  if (value > MAX_CENTS) return { ok: false, error: 'tooLarge' }
  return { ok: true, value: cents(value) }
}

export type WeightError = 'empty' | 'invalid' | 'zero' | 'tooLarge'

/** Kilograms with a comma or point ("0,846"), or grams with a g ("846 g"). */
export function parseWeight(input: string): Parsed<Grams, WeightError> {
  const s = input.replace(/\s/g, '').toLowerCase()
  if (s === '') return { ok: false, error: 'empty' }
  const g = /^(\d{1,5})g$/.exec(s)
  const kg = /^(\d{1,2})(?:[.,](\d{1,3}))?(?:kg)?$/.exec(s)
  let value: number
  if (g) value = Number(g[1])
  else if (kg) value = Number(kg[1]) * 1000 + Number((kg[2] ?? '0').padEnd(3, '0'))
  else return { ok: false, error: 'invalid' }
  if (value === 0) return { ok: false, error: 'zero' }
  if (value > MAX_GRAMS) return { ok: false, error: 'tooLarge' }
  return { ok: true, value: grams(value) }
}

export const clampQty = (n: number): number => Math.min(MAX_QTY, Math.max(1, Math.round(n)))

/** The quantity a unit price multiplies: pieces, packs, or kilograms. */
const factor = (item: Pick<Item, 'sold' | 'qty'>): number => (item.sold.kind === 'weight' ? item.qty / 1000 : item.qty)

export function lineTotal(item: Pick<Item, 'sold' | 'qty' | 'price'>): Cents | null {
  if (!item.price) return null
  return item.price.basis === 'line' ? item.price.amount : cents(item.price.amount * factor(item))
}

export function unitPrice(item: Pick<Item, 'sold' | 'qty' | 'price'>): Cents | null {
  if (!item.price) return null
  return item.price.basis === 'unit' ? item.price.amount : cents(item.price.amount / factor(item))
}

/** Price per piece inside a multipack (a cup of yoghurt in a four-pack). */
export function perPiece(item: Pick<Item, 'sold' | 'qty' | 'price'>): Cents | null {
  const u = unitPrice(item)
  return u === null || item.sold.kind !== 'pack' ? null : cents(u / item.sold.perPack)
}

export type Trip = { total: Cents; priced: number; open: number }

export function tripTotal(items: readonly Item[]): Trip {
  let total = 0
  let priced = 0
  for (const item of items) {
    const line = lineTotal(item)
    if (line === null) continue
    total += line
    priced += 1
  }
  return { total: cents(total), priced, open: items.length - priced }
}

/** Euro amounts the German way: "1,19 €". */
export const euro = (c: number): string =>
  `${(c / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

/** Amount without the sign, for editable fields: "1,19". */
export const amountText = (c: number): string =>
  (c / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })

export const weightText = (g: number): string =>
  g >= 1000 ? `${(g / 1000).toLocaleString('de-DE', { maximumFractionDigits: 3 })} kg` : `${g} g`

export const weightField = (g: number): string =>
  (g / 1000).toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3, useGrouping: false })

/** The quantity prefix the list shows before a name: "2×", "846 g", "1× 4er". */
export function qtyText(item: Pick<Item, 'sold' | 'qty'>): string {
  if (item.sold.kind === 'weight') return weightText(item.qty)
  return `${item.qty}×`
}

/** What a unit price is per, for labels: "pro Stück", "pro kg", "pro 4er-Pack". */
export function perLabel(sold: Sold): string {
  switch (sold.kind) {
    case 'piece':
      return 'pro Stück'
    case 'weight':
      return 'pro kg'
    case 'pack':
      return `pro ${sold.perPack}er-Pack`
  }
}

export const priceErrorText: Record<PriceError, string> = {
  empty: 'Gib einen Preis ein.',
  invalid: 'Nur Zahlen mit Komma, z. B. 1,19.',
  zero: 'Der Preis muss über 0 € liegen.',
  tooLarge: 'Höchstens 999,99 € pro Artikel.',
}

export const weightErrorText: Record<WeightError, string> = {
  empty: 'Gib das Gewicht ein.',
  invalid: 'Gewicht in kg, z. B. 0,846.',
  zero: 'Das Gewicht muss über 0 g liegen.',
  tooLarge: 'Höchstens 20 kg.',
}
