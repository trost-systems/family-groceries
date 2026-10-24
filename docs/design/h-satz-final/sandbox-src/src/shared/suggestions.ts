import { PRODUCTS, findProduct, norm, parse, type Memory } from './parser'
import type { Draft, Item } from './types'

/**
 * Where a suggestion comes from. The add sheet labels each row with it, so a tap is an informed choice.
 * `current` is the item being edited, unchanged.
 */
export type SuggestionSource = 'current' | 'typed' | 'history' | 'pack' | 'variant' | 'size' | 'brand' | 'catalog'

export interface Suggestion {
  /** stable across keystrokes for the same interpretation; React key and dedupe key */
  key: string
  source: SuggestionSource
  draft: Draft
}

export const suggestionKey = (d: Pick<Draft, 'name' | 'brand' | 'props'>) =>
  [norm(d.name), norm(d.brand ?? ''), ...d.props.map(norm).sort()].join('|')

const draftOf = ({ name, brand, props, qty, emoji, storeId, categoryId }: Item): Draft => ({ name, brand, props, qty, emoji, storeId, categoryId })

const productOf = (name: string) => (findProduct(name) ?? findProduct(name.split(/\s+/)[0] ?? ''))?.product

const CATALOG_MAX = 3

/**
 * Every row in the add sheet is one of these. The literal parse comes first (Enter adds it), then what the household
 * bought before, then the product's other packs, sizes and brands, then catalogue products matching the word being typed.
 */
export function suggestionsFor(input: string, { memory, history = [], limit = 8 }: { memory?: Memory; history?: Item[]; limit?: number } = {}): Suggestion[] {
  if (!input.trim()) return []
  const typed = parse(input, memory)
  const product = productOf(typed.name)
  const out: { source: SuggestionSource; draft: Draft }[] = [{ source: 'typed', draft: typed }]

  if (norm(typed.name).length >= 2) {
    for (const h of history) {
      const same = product ? productOf(h.name) === product : norm(h.name).startsWith(norm(typed.name))
      if (same) out.push({ source: 'history', draft: { ...draftOf(h), qty: typed.qty !== '1' ? typed.qty : h.qty } })
    }
  }

  for (const v of product?.variants ?? []) {
    if (typed.props.includes(v)) continue
    const isPack = /pack|er$/i.test(v)
    const props = isPack ? [...typed.props.filter((p) => !/pack|^\d+er$/i.test(p)), v] : [...typed.props.filter((p) => !/%$/.test(p)), v]
    out.push({ source: isPack ? 'pack' : 'variant', draft: { ...typed, props } })
  }

  const size = typed.props.find((p) => /^Größe \d+$/.test(p))
  if (size) {
    const n = Number(size.slice('Größe '.length))
    for (const m of [n + 1, n - 1].filter((m) => m >= 1 && m <= 8)) {
      out.push({ source: 'size', draft: { ...typed, props: typed.props.map((p) => (p === size ? `Größe ${m}` : p)) } })
    }
  }

  for (const b of product?.brands ?? []) if (b !== typed.brand) out.push({ source: 'brand', draft: { ...typed, brand: b } })

  const tokens = input.trim().split(/\s+/)
  const last = tokens.at(-1) ?? ''
  if (norm(last).length >= 2) {
    const prefix = norm(last)
    const hits = PRODUCTS.filter((p) => p !== product && [p.name, ...(p.aliases ?? []), ...p.en.split('|')].some((k) => norm(k).startsWith(prefix)))
    for (const p of hits.slice(0, CATALOG_MAX)) out.push({ source: 'catalog', draft: parse([...tokens.slice(0, -1), p.name].join(' '), memory) })
  }

  const seen = new Set<string>()
  const unique: Suggestion[] = []
  for (const s of out) {
    const key = suggestionKey(s.draft)
    if (seen.has(key)) continue
    seen.add(key)
    unique.push({ key, ...s })
  }
  return unique.slice(0, limit)
}
