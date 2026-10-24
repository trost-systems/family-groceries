import type { Item, Store } from '../types'

export const isCount = (qty: string) => /^\d+$/.test(qty.trim())
export const qtyLabel = (qty: string) => (isCount(qty) ? `${qty}×` : qty)

/** Brand tint for a store: the badge background, unless it is white (dm), then the logo color. */
export function storeTint(store: Store): string {
  return /^#f{3,6}$/i.test(store.badge.bg) ? store.badge.fg : store.badge.bg
}

/** The item as the words the parser reads back to the same item, so editing is retyping. */
export function itemToText(item: Pick<Item, 'qty' | 'name' | 'brand' | 'props'>): string {
  const qty = item.qty === '1' ? '' : isCount(item.qty) ? `${item.qty}x` : item.qty
  return [qty, item.name, item.brand, ...item.props].filter(Boolean).join(' ')
}
